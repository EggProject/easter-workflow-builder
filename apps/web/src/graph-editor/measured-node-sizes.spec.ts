import type { NodeDimensionChange } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { mergeMeasuredNodeSizes, withMeasuredNodeSize } from './measured-node-sizes.ts';

const FLOW_NODE: GraphNodeCardFlowNode = {
  id: 'n1',
  type: 'workflowNode',
  position: { x: 0, y: 0 },
  data: {
    workflowNode: {
      id: 'n1',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      // eslint-disable-next-line unicorn/no-null -- a `start` config nullázható mezője a dróton ténylegesen `null`
      config: { type: 'start', inputFields: [], onUnhandledError: null },
    },
  },
};

describe('mergeMeasuredNodeSizes', () => {
  it('felveszi az új mért méretet', () => {
    const changes: readonly NodeDimensionChange[] = [
      { id: 'n1', type: 'dimensions', dimensions: { width: 10, height: 20 } },
    ];
    expect(mergeMeasuredNodeSizes({}, changes)).toEqual({ n1: { width: 10, height: 20 } });
  });

  it('felülírja a korábbi mért méretet, a többit megtartja', () => {
    const previous = { n1: { width: 1, height: 1 }, n2: { width: 2, height: 2 } };
    const changes: readonly NodeDimensionChange[] = [
      { id: 'n1', type: 'dimensions', dimensions: { width: 30, height: 40 } },
    ];
    expect(mergeMeasuredNodeSizes(previous, changes)).toEqual({
      n1: { width: 30, height: 40 },
      n2: { width: 2, height: 2 },
    });
  });

  it('a méret nélküli változást figyelmen kívül hagyja', () => {
    const changes: readonly NodeDimensionChange[] = [{ id: 'n1', type: 'dimensions', resizing: true }];
    expect(mergeMeasuredNodeSizes({ n2: { width: 2, height: 2 } }, changes)).toEqual({ n2: { width: 2, height: 2 } });
  });
});

describe('withMeasuredNodeSize', () => {
  it('mért méret hiányában ugyanazt az objektumot adja vissza', () => {
    expect(withMeasuredNodeSize(FLOW_NODE, undefined)).toBe(FLOW_NODE);
  });

  it('mért mérettel a `measured` mezőt tölti ki', () => {
    const measured = { width: 358, height: 106 };
    expect(withMeasuredNodeSize(FLOW_NODE, measured)).toEqual({ ...FLOW_NODE, measured });
  });
});
