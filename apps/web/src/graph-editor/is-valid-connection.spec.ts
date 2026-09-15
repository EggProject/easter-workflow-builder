/* eslint-disable unicorn/no-null -- a szintetikus fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { Edge } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { isValidGraphConnection } from './is-valid-connection.ts';

function buildNode(id: string, type: GraphNodeCardFlowNode['data']['workflowNode']['type']): GraphNodeCardFlowNode {
  return {
    id,
    type: 'workflowNode',
    position: { x: 0, y: 0 },
    data: {
      workflowNode: {
        id,
        type,
        label: id,
        positionX: 0,
        positionY: 0,
        config:
          type === 'start'
            ? { type: 'start', inputFields: [], onUnhandledError: null }
            : { type: 'fan_out', itemsExpression: 'x', branchLabelTemplate: 'x', onUnhandledError: null },
      },
    },
  };
}

const START_NODE = buildNode('start-1', 'start');
const FAN_OUT_NODE = buildNode('fan-out-1', 'fan_out');
const NODES = [START_NODE, FAN_OUT_NODE];

describe('isValidGraphConnection', () => {
  it('elutasítja a start csomópontra kötést, mert nincs bemenő handle-je', () => {
    const isValid = isValidGraphConnection({ source: 'fan-out-1', target: 'start-1', sourceHandle: null }, NODES, []);
    expect(isValid).toBe(false);
  });

  it('engedélyezi a bemenő handle-lel rendelkező csomópontra kötést', () => {
    const isValid = isValidGraphConnection({ source: 'start-1', target: 'fan-out-1', sourceHandle: null }, NODES, []);
    expect(isValid).toBe(true);
  });

  it('engedélyezi az ismeretlen (a vászonról még hiányzó) célt - a szerver validálja', () => {
    const isValid = isValidGraphConnection({ source: 'start-1', target: 'ismeretlen', sourceHandle: null }, NODES, []);
    expect(isValid).toBe(true);
  });

  it('elutasítja a duplikált élt: ugyanaz a forrás, handle és cél már létezik', () => {
    const existingEdge: Edge = { id: 'e-1', source: 'start-1', target: 'fan-out-1', sourceHandle: null };
    const isValid = isValidGraphConnection({ source: 'start-1', target: 'fan-out-1', sourceHandle: null }, NODES, [
      existingEdge,
    ]);
    expect(isValid).toBe(false);
  });

  it('engedélyezi ugyanazt a forrás-cél párt, ha a sourceHandle eltér', () => {
    const existingEdge: Edge = { id: 'e-1', source: 'start-1', target: 'fan-out-1', sourceHandle: 'a' };
    const isValid = isValidGraphConnection({ source: 'start-1', target: 'fan-out-1', sourceHandle: 'b' }, NODES, [
      existingEdge,
    ]);
    expect(isValid).toBe(true);
  });

  it('a hiányzó (undefined) sourceHandle-t null-lal egyenértékűen kezeli a duplikáció ellenőrzésekor', () => {
    const existingEdge: Edge = { id: 'e-1', source: 'start-1', target: 'fan-out-1' };
    const isValid = isValidGraphConnection({ source: 'start-1', target: 'fan-out-1', sourceHandle: null }, NODES, [
      existingEdge,
    ]);
    expect(isValid).toBe(false);
  });
});
