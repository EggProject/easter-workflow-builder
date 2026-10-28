import type { McpServerDefinitionRecord } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import { resolveOutgoingAgents } from '../agent-definition/resolve-outgoing-agents.ts';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';
import { resolveMcpServers } from '../mcp-server-resolution/resolve-mcp-servers.ts';
import { agentStepConfigOf } from './agent-step-config-of.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A futás indítási ellenőrzése a lépések és az agent definícióik MCP
 * hivatkozásaira (SPEC-009 6.2, 6.4): minden hivatkozott név a központi MCP
 * szerver listában áll (különben `mcp_server_not_found`, O-43 (a)), és minden
 * feloldott szerver oldali env változó be van állítva (különben
 * `missing_mcp_server_env`, O-18); az érvénytelen alakú agent definíció
 * `malformed_node_config` (`resolveOutgoingAgents`). Ugyanazt a feloldást
 * futtatja, mint a lépés (`runAgentStep`), és az eredményt eldobja: az
 * értékek csak a kimenő `Options`-ba kerülhetnek. A `skillLibrary` csak az
 * agent definíciók `skills` minősítéséhez kell, amit ez az ellenőrzés szintén
 * eldob.
 *
 * A SPEC-004 4.8 3. lépésében fut, a `validateSkillReferences` után, tehát
 * egyetlen adatbázis sort sem ír; az első hibánál megáll.
 */
export function validateMcpServerReferences(
  configsById: ReadonlyMap<string, ExecutableNodeConfig>,
  definitions: readonly McpServerDefinitionRecord[],
  processEnvironment: ProcessEnvironmentPort,
  skillLibrary: SkillLibrarySnapshot,
): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    const agentStep = agentStepConfigOf(config);
    if (agentStep === undefined) {
      continue;
    }
    const resolved = resolveMcpServers(
      `A(z) ${nodeId} csomópont`,
      agentStep.mcpServerReferences,
      definitions,
      processEnvironment,
    );
    if (resolved.kind === 'error') {
      return { kind: 'error', message: resolved.message };
    }
    const agents = resolveOutgoingAgents(nodeId, agentStep.agents, skillLibrary, definitions, processEnvironment);
    if (agents.kind === 'error') {
      return { kind: 'error', message: agents.message };
    }
  }
  return { kind: 'ok', value: undefined };
}
