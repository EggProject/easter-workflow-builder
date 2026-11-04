import { describe, expect, it } from 'vitest';
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { DEFAULT_AGENT_STEP_SETTINGS } from '../node-inspector/default-agent-step-settings.ts';
import { findRejectedStructuredOutputSchemas } from './find-rejected-structured-output-schemas.ts';

const agentSchema = { type: 'strin' };
const synthesisSchema = { $schema: 'https://json-schema.org/draft/2020-12/schema' };

const nodes: readonly WorkflowNodeInput[] = [
  {
    id: 'start',
    type: 'start',
    label: 'Indítás',
    positionX: 0,
    positionY: 0,
    config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
  },
  {
    id: 'lepes',
    type: 'agent_step',
    label: 'Lépés',
    positionX: 0,
    positionY: 0,
    config: {
      ...DEFAULT_AGENT_STEP_SETTINGS,
      type: 'agent_step',
      onUnhandledError: 'fail_run',
      structuredOutput: { strategy: 'sdk_output_format', schema: agentSchema },
    },
  },
  {
    id: 'osszegzes',
    type: 'join',
    label: 'Összefésülés',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'join',
      mode: 'ai_synthesis',
      onUnhandledError: 'fail_run',
      settings: {
        ...DEFAULT_AGENT_STEP_SETTINGS,
        structuredOutput: { strategy: 'sdk_output_format', schema: synthesisSchema },
      },
    },
  },
];

describe('findRejectedStructuredOutputSchemas', () => {
  it('a két séma mezőútját a csomóponthoz és a mentett séma értékéhez köti', () => {
    const rejected = findRejectedStructuredOutputSchemas(
      ['nodes.1.config.structuredOutput.schema', 'nodes.2.config.settings.structuredOutput.schema'],
      nodes,
    );

    expect(rejected).toStrictEqual([
      { nodeId: 'lepes', fieldPath: 'structuredOutput.schema', schema: agentSchema },
      { nodeId: 'osszegzes', fieldPath: 'settings.structuredOutput.schema', schema: synthesisSchema },
    ]);
    expect(rejected[0]?.schema).toBe(agentSchema);
  });

  it('más mezőutat és nem létező indexet kihagy', () => {
    expect(
      findRejectedStructuredOutputSchemas(
        ['nodes.1.config.promptTemplate', '(gyökér)', 'nodes.9.config.structuredOutput.schema'],
        nodes,
      ),
    ).toStrictEqual([]);
  });
});
