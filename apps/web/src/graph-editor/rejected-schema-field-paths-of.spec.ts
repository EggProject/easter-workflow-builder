import { describe, expect, it } from 'vitest';
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { DEFAULT_AGENT_STEP_SETTINGS } from '../node-inspector/default-agent-step-settings.ts';
import { rejectedSchemaFieldPathsOf } from './rejected-schema-field-paths-of.ts';

const schema = { type: 'strin' };

function agentNode(id: string, nodeSchema: unknown): WorkflowNodeInput {
  return {
    id,
    type: 'agent_step',
    label: id,
    positionX: 0,
    positionY: 0,
    config: {
      ...DEFAULT_AGENT_STEP_SETTINGS,
      type: 'agent_step',
      onUnhandledError: 'fail_run',
      structuredOutput: { strategy: 'sdk_output_format', schema: nodeSchema },
    },
  };
}

describe('rejectedSchemaFieldPathsOf', () => {
  const rejected = [{ nodeId: 'lepes', fieldPath: 'structuredOutput.schema', schema }] as const;

  it('a változatlan (azonos hivatkozású) sémájú csomópont mezőútját adja', () => {
    expect(rejectedSchemaFieldPathsOf(rejected, agentNode('lepes', schema))).toStrictEqual(['structuredOutput.schema']);
  });

  it('a szerkesztett séma (új érték, akár azonos tartalommal) és a másik csomópont nem kap hibát', () => {
    expect(rejectedSchemaFieldPathsOf(rejected, agentNode('lepes', { type: 'strin' }))).toStrictEqual([]);
    expect(rejectedSchemaFieldPathsOf(rejected, agentNode('masik', schema))).toStrictEqual([]);
  });
});
