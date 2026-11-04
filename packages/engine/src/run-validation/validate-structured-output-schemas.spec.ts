/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateStructuredOutputSchemas } from './validate-structured-output-schemas.ts';

function agentStepConfig(structuredOutput: AgentStepConfig['structuredOutput']): AgentStepConfig {
  return {
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
    structuredOutput,
  };
}

function withSchema(schema: unknown): AgentStepConfig['structuredOutput'] {
  return { strategy: 'sdk_output_format', schema };
}

function agentNode(structuredOutput: AgentStepConfig['structuredOutput']): ExecutableNodeConfig {
  return { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig(structuredOutput) };
}

function synthesisNode(structuredOutput: AgentStepConfig['structuredOutput']): ExecutableNodeConfig {
  return {
    type: 'join',
    mode: 'ai_synthesis',
    settings: agentStepConfig(structuredOutput),
    onUnhandledError: 'fail_run',
  };
}

function configsOf(
  entries: readonly (readonly [string, ExecutableNodeConfig])[],
): ReadonlyMap<string, ExecutableNodeConfig> {
  return new Map<string, ExecutableNodeConfig>(entries);
}

const NEWER_DRAFT = 'https://json-schema.org/draft/2020-12/schema';

describe('validateStructuredOutputSchemas', () => {
  it('a strukturált kimenet nélküli, az érvényes sémájú és a nem agent lépés zöld', () => {
    const configs = configsOf([
      ['nincs', agentNode(null)],
      ['van', agentNode(withSchema({ type: 'object', required: ['a'] }))],
      ['szintezis', synthesisNode(withSchema(true))],
      ['osszefesules', { type: 'join', mode: 'merge', onUnhandledError: 'fail_run' }],
    ]);

    expect(validateStructuredOutputSchemas(configs)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('az agent_step érvénytelen sémája invalid_structured_output_schema, a csomópont nevével', () => {
    const configs = configsOf([
      ['jo', agentNode(withSchema({ type: 'object' }))],
      ['rossz', agentNode(withSchema({ type: 'strin' }))],
    ]);

    const outcome = validateStructuredOutputSchemas(configs);

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toMatch(
      /^A\(z\) rossz csomópont strukturált kimenet sémája nem fordítható: A strukturált kimenet sémája érvénytelen: schema is invalid.* \(invalid_structured_output_schema\)\.$/u,
    );
  });

  it('a join ai_synthesis draft-07-nél újabb sémája ugyanígy elbukik (SPEC-015 5.6)', () => {
    const configs = configsOf([['szintezis', synthesisNode(withSchema({ $schema: NEWER_DRAFT }))]]);

    expect(validateStructuredOutputSchemas(configs)).toStrictEqual({
      kind: 'error',
      message: `A(z) szintezis csomópont strukturált kimenet sémája nem fordítható: A strukturált kimenet sémája érvénytelen: no schema with key or ref "${NEWER_DRAFT}" (invalid_structured_output_schema).`,
    });
  });
});
