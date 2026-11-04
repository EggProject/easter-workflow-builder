/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import { describe, expect, it } from 'vitest';
import type { NodeConfig } from '@easter-workflow-builder/protocol';
import { DEFAULT_AGENT_STEP_SETTINGS } from '../node-inspector/default-agent-step-settings.ts';
import { readStructuredOutputSchema } from './read-structured-output-schema.ts';

const schema = { type: 'object' };
const agentStep: NodeConfig = {
  ...DEFAULT_AGENT_STEP_SETTINGS,
  type: 'agent_step',
  onUnhandledError: 'fail_run',
  structuredOutput: { strategy: 'sdk_output_format', schema },
};
const synthesis: NodeConfig = {
  type: 'join',
  mode: 'ai_synthesis',
  onUnhandledError: 'fail_run',
  settings: { ...DEFAULT_AGENT_STEP_SETTINGS, structuredOutput: { strategy: 'sdk_output_format', schema } },
};

describe('readStructuredOutputSchema', () => {
  it('az agent_step sémáját a saját mezőútján adja, hivatkozás szerint', () => {
    expect(readStructuredOutputSchema(agentStep, 'structuredOutput.schema')).toBe(schema);
  });

  it('a join ai_synthesis sémáját a settings mezőúton adja', () => {
    expect(readStructuredOutputSchema(synthesis, 'settings.structuredOutput.schema')).toBe(schema);
  });

  it('strukturált kimenet nélkül undefined', () => {
    const withoutOutput: NodeConfig = { ...DEFAULT_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: null };

    expect(readStructuredOutputSchema(withoutOutput, 'structuredOutput.schema')).toBeUndefined();
    expect(
      readStructuredOutputSchema(
        { type: 'join', mode: 'ai_synthesis', onUnhandledError: null, settings: DEFAULT_AGENT_STEP_SETTINGS },
        'settings.structuredOutput.schema',
      ),
    ).toBeUndefined();
  });

  it('a csomópont típusán nem álló mezőútra undefined', () => {
    expect(readStructuredOutputSchema(synthesis, 'structuredOutput.schema')).toBeUndefined();
    expect(readStructuredOutputSchema(agentStep, 'settings.structuredOutput.schema')).toBeUndefined();
    expect(
      readStructuredOutputSchema(
        { type: 'join', mode: 'merge', onUnhandledError: null },
        'settings.structuredOutput.schema',
      ),
    ).toBeUndefined();
  });
});
