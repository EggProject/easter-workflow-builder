/* eslint-disable unicorn/no-null -- a szintetikus WorkflowGraphDocument/WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { WorkflowGraphDocument, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { isGraphDirty } from './is-graph-dirty.ts';

const NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: null },
};

const BASELINE_EDGE = {
  id: 'e-1',
  sourceNodeId: 'n-1',
  targetNodeId: 'n-2',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
  createdAtMs: 1,
};

const BASELINE: WorkflowGraphDocument = {
  nodes: [{ ...NODE, createdAtMs: 1, updatedAtMs: 1 }],
  edges: [BASELINE_EDGE],
};

const BASELINE_EDGE_INPUT = {
  id: 'e-1',
  sourceNodeId: 'n-1',
  targetNodeId: 'n-2',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
};

describe('isGraphDirty', () => {
  it('betöltés előtt (baseline undefined) sosem piszkos', () => {
    expect(isGraphDirty(undefined, [NODE], [])).toBe(false);
  });

  it('a betöltéssel azonos szerkesztett állapotra (node ÉS él is egyezik) nem piszkos', () => {
    expect(isGraphDirty(BASELINE, [NODE], [BASELINE_EDGE_INPUT])).toBe(false);
  });

  it('egy módosított mezőre (pl. elmozgatott pozíció) piszkos', () => {
    expect(isGraphDirty(BASELINE, [{ ...NODE, positionX: 50 }], [BASELINE_EDGE_INPUT])).toBe(true);
  });

  it('egy visszavont változtatás után (vissza az eredeti értékre) újra nem piszkos', () => {
    const isDirtyAfterMove = isGraphDirty(BASELINE, [{ ...NODE, positionX: 50 }], [BASELINE_EDGE_INPUT]);
    const isDirtyAfterRevert = isGraphDirty(BASELINE, [{ ...NODE, positionX: 0 }], [BASELINE_EDGE_INPUT]);
    expect(isDirtyAfterMove).toBe(true);
    expect(isDirtyAfterRevert).toBe(false);
  });

  it('a betöltött él eltávolítására is piszkos', () => {
    expect(isGraphDirty(BASELINE, [NODE], [])).toBe(true);
  });
});
