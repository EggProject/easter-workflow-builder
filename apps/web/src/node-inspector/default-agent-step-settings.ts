/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem `undefined`-et (SPEC-005 protokoll alak) */
import type { AgentStepConfig } from '@easter-workflow-builder/protocol';

/**
 * Az érvényes, "üres" alapértelmezett `AgentStepConfig` (SPEC-008 5.8). Két
 * fogyasztója van: a `join` `ai_synthesis` módra váltása (`JoinNodeFields`),
 * és a felvett `agent_step` csomópont kezdő konfigja (`graph-editor`
 * `createInitialNodeConfig`). A mezők a szerver oldali alapértelmezést nem
 * tükrözik, csak az "üres" jelentést adják: minden nullázható mező `null`,
 * minden lista és rekord üres, a `sessionMode` `'isolated'`.
 */
export const DEFAULT_AGENT_STEP_SETTINGS: AgentStepConfig = {
  promptTemplate: '',
  providerId: null,
  modelId: null,
  effort: null,
  thinking: null,
  allowedTools: [],
  disallowedTools: [],
  permissionMode: null,
  maxTurns: null,
  maxBudgetUsd: null,
  systemPrompt: null,
  agents: {},
  skills: null,
  mcpServers: {},
  enabledEngineHooks: [],
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  agentTools: [],
  sessionMode: 'isolated',
  structuredOutput: null,
};
