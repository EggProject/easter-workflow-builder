import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';

/**
 * A node agent lépés alobjektuma, vagy `undefined`, ha a node nem futtat agent
 * lépést: az `agent_step` maga, a `join` `ai_synthesis` módja a `settings`
 * mezőjében (SPEC-004 5. szekció táblázatának 2. és 5. sora). A lépés szintű
 * indítási ellenőrzések (`validateSkillReferences`,
 * `validateMcpServerReferences`) közös bemenete.
 */
export function agentStepConfigOf(config: WellFormedNodeConfig): AgentStepConfig | undefined {
  if (config.type === 'agent_step') {
    return config;
  }
  if (config.type === 'join' && config.mode === 'ai_synthesis') {
    return config.settings;
  }
  return undefined;
}
