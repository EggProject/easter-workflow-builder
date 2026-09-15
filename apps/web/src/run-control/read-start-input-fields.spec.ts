/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { readStartInputFields } from './read-start-input-fields.ts';

function node(id: string, config: WorkflowNodeInput['config']): WorkflowNodeInput {
  return { id, type: config.type, label: id, positionX: 0, positionY: 0, config };
}

const BRANCH_NODE = node('n-branch', {
  type: 'branch',
  expression: 'input.a',
  branches: [],
  defaultBranchKey: null,
  onUnhandledError: null,
});

describe('readStartInputFields', () => {
  it('a start csomópont inputFields listáját adja vissza', () => {
    const fields = [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }];
    const nodes = [BRANCH_NODE, node('n-start', { type: 'start', inputFields: fields, onUnhandledError: null })];

    expect(readStartInputFields(nodes)).toEqual(fields);
  });

  it('start csomópont nélküli gráfra üres listát ad, hibaág nélkül', () => {
    expect(readStartInputFields([BRANCH_NODE])).toEqual([]);
  });

  it('üres gráfra üres listát ad', () => {
    expect(readStartInputFields([])).toEqual([]);
  });
});
