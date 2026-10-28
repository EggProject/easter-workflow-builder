import type { AgentStepConfig, McpServerDefinitionRecord } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';
import { resolveMcpServers, type McpServerResolution } from '../mcp-server-resolution/resolve-mcp-servers.ts';
import type { OutgoingAgents } from './outgoing-agents.ts';
import { parseAgentDefinition } from './parse-agent-definition.ts';
import { qualifySkillNames } from './qualify-skill-names.ts';

/**
 * A `resolveOutgoingAgents` eredménye: a hibaág a hibaosztályt külön mezőben
 * is hordozza, a `resolveMcpServers` mintájára (a futás indítása az üzenetet,
 * a lépés a hibaosztályt használja).
 */
export type OutgoingAgentsResolution =
  | { readonly kind: 'ok'; readonly value: OutgoingAgents }
  | {
      readonly kind: 'error';
      readonly errorKind: 'malformed_node_config' | Extract<McpServerResolution, { kind: 'error' }>['errorKind'];
      readonly message: string;
    };

/**
 * A lépés `agents` rekordjának kimenő alakja (SPEC-009 5.2, 6.2, M-147,
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 5. szekció).
 * Definíciónként:
 *
 * - a `skills` a lépés mezőjének szabálya szerint minősül (`qualifySkillNames`;
 *   a `null` és a hiányzó kulcs nem megy ki), mert az agent definíció `skills`
 *   listája a puszta nevet egy azonos nevű beépített skillre oldja (M-147 A8);
 * - a `mcpServerReferences` a lépés hivatkozás mezőjének alakja, és a
 *   `resolveMcpServers` oldja fel, ugyanazzal a három szintű név feloldással;
 *   a kimenő `mcpServers` lista szerverenként egy `{ <név>: <konfiguráció> }`
 *   elem, mert az `AgentMcpServerSpec` objektum ága az al-agent saját
 *   szerverét adja (M-147 B3), a szöveg ága viszont csak a lépés szerverére
 *   mutathat, amit az al-agent enélkül is örököl (B1, B4, B5); a régi
 *   `mcpServers` lista elemei elöl, változatlanul maradnak;
 * - minden más mező változatlan, a `mcpServerReferences` kulcs nem megy ki.
 *
 * Érvénytelen alakú definícióra (`parseAgentDefinition`) `malformed_node_config`,
 * a csomópont és az agent nevével. A futás indítása (`validateMcpServerReferences`)
 * és a lépés (`runAgentStep`) ugyanezt futtatja.
 */
export function resolveOutgoingAgents(
  nodeId: string,
  agents: AgentStepConfig['agents'],
  library: SkillLibrarySnapshot,
  definitions: readonly McpServerDefinitionRecord[],
  processEnvironment: ProcessEnvironmentPort,
): OutgoingAgentsResolution {
  const outgoing: (readonly [string, Readonly<Record<string, unknown>>])[] = [];
  let hasSkillReferences = false;
  for (const [agentName, value] of Object.entries(agents)) {
    const subject = `A(z) ${nodeId} csomópont "${agentName}" agent definíciója`;
    const parsed = parseAgentDefinition(value);
    if (parsed === undefined) {
      return {
        kind: 'error',
        errorKind: 'malformed_node_config',
        message: formatEngineErrorMessage('malformed_node_config', `${subject} érvénytelen alakú`),
      };
    }
    const servers = resolveMcpServers(subject, parsed.mcpServerReferences, definitions, processEnvironment);
    if (servers.kind === 'error') {
      return servers;
    }
    // `Object.fromEntries`, mert a név szabály a `__proto__` nevet is engedi (`resolveMcpServers`).
    const serverEntries = Object.entries(servers.value).map((entry) => Object.fromEntries([entry]));
    const legacyServers: readonly unknown[] = Array.isArray(parsed.rest['mcpServers']) ? parsed.rest['mcpServers'] : [];
    hasSkillReferences ||= parsed.skills !== null;
    outgoing.push([
      agentName,
      {
        ...parsed.rest,
        ...(parsed.skills !== null && { skills: qualifySkillNames(parsed.skills, library) }),
        ...(serverEntries.length > 0 && { mcpServers: [...legacyServers, ...serverEntries] }),
      },
    ]);
  }
  return { kind: 'ok', value: { definitions: Object.fromEntries(outgoing), hasSkillReferences } };
}
