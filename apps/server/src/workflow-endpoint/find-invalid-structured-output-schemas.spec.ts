/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig, ReplaceGraphRequest } from '@easter-workflow-builder/protocol';
import { findInvalidStructuredOutputSchemas } from './find-invalid-structured-output-schemas.ts';

function settings(structuredOutput: AgentStepConfig['structuredOutput']): AgentStepConfig {
  return {
    promptTemplate: 'p',
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
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput,
  };
}

const INVALID = { strategy: 'sdk_output_format', schema: { type: 'strin' } } as const;
const VALID = { strategy: 'sdk_output_format', schema: { type: 'object' } } as const;

function node(config: ReplaceGraphRequest['nodes'][number]['config']): ReplaceGraphRequest['nodes'][number] {
  return { id: `n-${config.type}`, type: config.type, label: 'x', positionX: 0, positionY: 0, config };
}

describe('findInvalidStructuredOutputSchemas', () => {
  it('a nem fordítható sémák mezőútját adja, az agent_step és a join ai_synthesis alakjában', () => {
    expect(
      findInvalidStructuredOutputSchemas([
        node({ type: 'start', inputFields: [], onUnhandledError: 'fail_run' }),
        node({ type: 'agent_step', onUnhandledError: 'fail_run', ...settings(INVALID) }),
        node({ type: 'join', mode: 'ai_synthesis', onUnhandledError: 'fail_run', settings: settings(INVALID) }),
      ]),
    ).toStrictEqual([
      { path: ['nodes', 1, 'config', 'structuredOutput', 'schema'] },
      { path: ['nodes', 2, 'config', 'settings', 'structuredOutput', 'schema'] },
    ]);
  });

  it('az érvényes séma, a strukturált kimenet nélküli lépés és a merge módú join nem ad hibát', () => {
    expect(
      findInvalidStructuredOutputSchemas([
        node({ type: 'agent_step', onUnhandledError: 'fail_run', ...settings(VALID) }),
        node({ type: 'agent_step', onUnhandledError: 'fail_run', ...settings(null) }),
        node({ type: 'join', mode: 'ai_synthesis', onUnhandledError: 'fail_run', settings: settings(VALID) }),
        node({ type: 'join', mode: 'ai_synthesis', onUnhandledError: 'fail_run', settings: settings(null) }),
        node({ type: 'join', mode: 'merge', onUnhandledError: 'fail_run' }),
      ]),
    ).toStrictEqual([]);
  });
});
