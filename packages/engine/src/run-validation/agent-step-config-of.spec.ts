/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { agentStepConfigOf } from './agent-step-config-of.ts';

const CONFIG: AgentStepConfig = {
  promptTemplate: 'prompt',
  providerId: null,
  modelId: 'modell-1',
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
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  sessionMode: 'isolated',
  structuredOutput: null,
};

describe('agentStepConfigOf', () => {
  it('az agent_step node a saját configját adja', () => {
    const node = { type: 'agent_step', onUnhandledError: 'fail_run', ...CONFIG } as const;

    expect(agentStepConfigOf(node)).toBe(node);
  });

  it('a join ai_synthesis módja a settings mezőt adja', () => {
    expect(
      agentStepConfigOf({ type: 'join', mode: 'ai_synthesis', settings: CONFIG, onUnhandledError: 'fail_run' }),
    ).toBe(CONFIG);
  });

  it('a join merge módja és a más típusú node undefined', () => {
    expect(agentStepConfigOf({ type: 'join', mode: 'merge', onUnhandledError: 'fail_run' })).toBeUndefined();
    expect(agentStepConfigOf({ type: 'start', inputFields: [], onUnhandledError: 'fail_run' })).toBeUndefined();
  });
});
