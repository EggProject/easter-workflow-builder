/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig, ReplaceGraphRequest } from '@easter-workflow-builder/protocol';
import { findInvalidStructuredOutputSchemas } from './find-invalid-structured-output-schemas.ts';
import { TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER } from '../engine-assembly/test-structured-output-schema-compiler.ts';

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

const START = node({ type: 'start', inputFields: [], onUnhandledError: 'fail_run' });
const INVALID_AGENT = node({ type: 'agent_step', onUnhandledError: 'fail_run', ...settings(INVALID) });
const INVALID_JOIN = node({
  type: 'join',
  mode: 'ai_synthesis',
  onUnhandledError: 'fail_run',
  settings: settings(INVALID),
});
const VALID_AGENT = node({ type: 'agent_step', onUnhandledError: 'fail_run', ...settings(VALID) });
const PLAIN_AGENT = node({ type: 'agent_step', onUnhandledError: 'fail_run', ...settings(null) });
const VALID_JOIN = node({
  type: 'join',
  mode: 'ai_synthesis',
  onUnhandledError: 'fail_run',
  settings: settings(VALID),
});
const PLAIN_JOIN = node({ type: 'join', mode: 'ai_synthesis', onUnhandledError: 'fail_run', settings: settings(null) });
const MERGE_JOIN = node({ type: 'join', mode: 'merge', onUnhandledError: 'fail_run' });

function withFormat(format: string): ReplaceGraphRequest['nodes'][number] {
  return node({
    type: 'agent_step',
    onUnhandledError: 'fail_run',
    ...settings({ strategy: 'sdk_output_format', schema: { type: 'string', format } }),
  });
}

describe('findInvalidStructuredOutputSchemas', () => {
  it('a nem fordítható sémák mezőútját adja, az agent_step és a join ai_synthesis alakjában', () => {
    expect(
      findInvalidStructuredOutputSchemas([START, INVALID_AGENT, INVALID_JOIN], TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER),
    ).toStrictEqual([
      { path: ['nodes', 1, 'config', 'structuredOutput', 'schema'] },
      { path: ['nodes', 2, 'config', 'settings', 'structuredOutput', 'schema'] },
    ]);
  });

  it('az érvényes séma, a strukturált kimenet nélküli lépés és a merge módú join nem ad hibát', () => {
    expect(
      findInvalidStructuredOutputSchemas(
        [VALID_AGENT, PLAIN_AGENT, VALID_JOIN, PLAIN_JOIN, MERGE_JOIN],
        TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER,
      ),
    ).toStrictEqual([]);
  });
  it('a format kulcsszó a mentéskor is az ajv-formats listája szerint dönt: az ismert név elfogadott, az ismeretlen elutasított', () => {
    expect(
      findInvalidStructuredOutputSchemas(
        [withFormat('email'), withFormat('date-time'), withFormat('nem-letezo')],
        TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER,
      ),
    ).toStrictEqual([{ path: ['nodes', 2, 'config', 'structuredOutput', 'schema'] }]);
  });
});
