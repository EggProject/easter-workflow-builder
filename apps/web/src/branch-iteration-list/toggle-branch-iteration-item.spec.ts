/* eslint-disable unicorn/no-null -- a szintetikus konfiguráció nullázható mezője a dróton ténylegesen `null` értéket hordoz (SPEC-005 protokoll alak) */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import type { BranchIterationSelection } from './branch-iteration-selection.ts';
import { toggleBranchIterationItem } from './toggle-branch-iteration-item.ts';

const FAN_OUT_NODE: WorkflowNodeInput = {
  id: 'n-fan',
  type: 'fan_out',
  label: 'Szétosztás',
  positionX: 0,
  positionY: 0,
  config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
};

const NODE_WIDE: BranchIterationSelection = { node: FAN_OUT_NODE, kind: 'fan_out', stepRunId: undefined };

describe('toggleBranchIterationItem', () => {
  it('a csomópont szintű nézetből a megnyomott tételre szűkít', () => {
    expect(toggleBranchIterationItem(NODE_WIDE, 's-a')).toEqual({ ...NODE_WIDE, stepRunId: 's-a' });
  });

  it('egy másik tétel megnyomása arra a tételre vált', () => {
    expect(toggleBranchIterationItem({ ...NODE_WIDE, stepRunId: 's-a' }, 's-b')).toEqual({
      ...NODE_WIDE,
      stepRunId: 's-b',
    });
  });

  it('a kiválasztott tétel ismételt megnyomása a csomópont minden tételére állít vissza', () => {
    expect(toggleBranchIterationItem({ ...NODE_WIDE, stepRunId: 's-a' }, 's-a')).toEqual(NODE_WIDE);
  });
});
