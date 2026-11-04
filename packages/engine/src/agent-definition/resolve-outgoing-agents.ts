import type { AgentStepConfig, McpServerDefinitionRecord } from '@easter-workflow-builder/db';
import { isString } from '@easter-workflow-builder/typeguards';
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
      readonly errorKind:
        | 'malformed_node_config'
        | 'agent_skill_not_in_step'
        | 'agent_mcp_server_override_conflict'
        | Extract<McpServerResolution, { kind: 'error' }>['errorKind'];
      readonly message: string;
    };

/**
 * Egy tárolt `skills` mező puszta nevei: a `null` üres, az `'all'` a skill
 * könyvtár aktuális nevei (a `qualifySkillNames` szabálya, minősítés nélkül).
 */
function skillNames(skills: AgentStepConfig['skills'], library: SkillLibrarySnapshot): readonly string[] {
  if (skills === null) {
    return [];
  }
  return skills === 'all' ? library.skillNames : skills;
}

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
 *   `mcpServers` listából csak a szöveg (név) elemek maradnak elöl, a
 *   közvetlen szerver objektum nem megy ki (O-53, user döntés 2026-10-28);
 * - a `memory` mező nem megy ki (O-53), minden más mező változatlan, a
 *   `mcpServerReferences` kulcs nem megy ki.
 *
 * A definíció csak a lépés kiválasztott skilljei közül kaphat (SPEC-009 O-47, koordinátor döntés
 * 2026-11-04 a user "Mód + jelölő lista" és "Nem, izolált futás" döntéséből): a lépés `skills`
 * mezőjén kívüli név (a `null` lépésen bármely név) `agent_skill_not_in_step`, mert az al-agent a
 * `plugins` gyökér minden skilljét látja (M-147 A4, A5), és a gyökér ezért a lépés listájára szűkül
 * (az `apps/server` `sdk-query-hardening` témája; M-150). A lépés által is hivatkozott szerver nevű
 * MCP felülírás `agent_mcp_server_override_conflict` (O-48, user döntés 2026-11-04), mert azonos
 * névnél a lépés konfigurációja szolgálná ki a hívást (M-147 B6).
 *
 * Érvénytelen alakú definícióra (`parseAgentDefinition`) `malformed_node_config`,
 * a csomópont és az agent nevével. A futás indítása (`validateMcpServerReferences`)
 * és a lépés (`runAgentStep`) ugyanezt futtatja.
 */
export function resolveOutgoingAgents(
  nodeId: string,
  config: AgentStepConfig,
  library: SkillLibrarySnapshot,
  definitions: readonly McpServerDefinitionRecord[],
  processEnvironment: ProcessEnvironmentPort,
): OutgoingAgentsResolution {
  const outgoing: (readonly [string, Readonly<Record<string, unknown>>])[] = [];
  const stepSkills = new Set(skillNames(config.skills, library));
  const stepServerNames = new Set(Object.keys(config.mcpServerReferences ?? {}));
  for (const [agentName, value] of Object.entries(config.agents)) {
    const subject = `A(z) ${nodeId} csomópont "${agentName}" agent definíciója`;
    const parsed = parseAgentDefinition(value);
    if (parsed === undefined) {
      return {
        kind: 'error',
        errorKind: 'malformed_node_config',
        message: formatEngineErrorMessage('malformed_node_config', `${subject} érvénytelen alakú`),
      };
    }
    const outsideSkill = skillNames(parsed.skills, library).find((name) => !stepSkills.has(name));
    if (outsideSkill !== undefined) {
      return {
        kind: 'error',
        errorKind: 'agent_skill_not_in_step',
        message: formatEngineErrorMessage(
          'agent_skill_not_in_step',
          `${subject} a(z) "${outsideSkill}" skillre hivatkozik, ami nincs a lépés kiválasztott skilljei között`,
        ),
      };
    }
    const conflictingServer = Object.keys(parsed.mcpServerReferences ?? {}).find((name) => stepServerNames.has(name));
    if (conflictingServer !== undefined) {
      return {
        kind: 'error',
        errorKind: 'agent_mcp_server_override_conflict',
        message: formatEngineErrorMessage(
          'agent_mcp_server_override_conflict',
          `${subject} a(z) "${conflictingServer}" MCP szervert felülírja, de a lépés is ezt a szervert hivatkozza`,
        ),
      };
    }
    const servers = resolveMcpServers(subject, parsed.mcpServerReferences, definitions, processEnvironment);
    if (servers.kind === 'error') {
      return servers;
    }
    // `Object.fromEntries`, mert a név szabály a `__proto__` nevet is engedi (`resolveMcpServers`).
    const serverEntries = Object.entries(servers.value).map((entry) => Object.fromEntries([entry]));
    // O-53 (user döntés 2026-10-28): a régi lista csak a név elemeivel megy ki, a közvetlen szerver
    // objektum (ami a központi listát megkerülné) és a `memory` mező (a gép agent memória
    // könyvtárának betöltése) nem.
    const rest = Object.fromEntries(
      Object.entries(parsed.rest).filter(([key]) => key !== 'mcpServers' && key !== 'memory'),
    );
    const legacyValue = parsed.rest['mcpServers'];
    const legacyNames: readonly unknown[] = Array.isArray(legacyValue) ? legacyValue.filter(isString) : [];
    const outgoingServers = [...legacyNames, ...serverEntries];
    outgoing.push([
      agentName,
      {
        ...rest,
        ...(parsed.skills !== null && { skills: qualifySkillNames(parsed.skills, library) }),
        ...(outgoingServers.length > 0 && { mcpServers: outgoingServers }),
      },
    ]);
  }
  return { kind: 'ok', value: { definitions: Object.fromEntries(outgoing) } };
}
