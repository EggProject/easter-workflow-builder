/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { afterEach, describe, expect, it } from 'vitest';
import { findKeyboardActivatedNode } from './find-keyboard-activated-node.ts';

const FAN_OUT_NODE: WorkflowNodeInput = {
  id: 'n-fan',
  type: 'fan_out',
  label: 'Elemek szétosztása',
  positionX: 0,
  positionY: 0,
  config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}', onUnhandledError: null },
};

const NODES: readonly WorkflowNodeInput[] = [FAN_OUT_NODE];

/**
 * Egy React Flow csomópont doboz alakú elem (`react-flow__node` osztály és
 * `data-id` attribútum), benne egy gombbal.
 */
function nodeWrapper(nodeId: string): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'react-flow__node react-flow__node-workflowNode';
  wrapper.dataset['id'] = nodeId;
  wrapper.append(document.createElement('button'));
  document.body.append(wrapper);
  return wrapper;
}

describe('findKeyboardActivatedNode', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('a csomópont dobozán az Enter és a szóköz a csomópontot adja', () => {
    const wrapper = nodeWrapper('n-fan');
    expect(findKeyboardActivatedNode({ key: 'Enter', target: wrapper }, NODES)).toBe(FAN_OUT_NODE);
    expect(findKeyboardActivatedNode({ key: ' ', target: wrapper }, NODES)).toBe(FAN_OUT_NODE);
  });

  it('más billentyűre nincs aktivált csomópont, az Escape-re sem', () => {
    const wrapper = nodeWrapper('n-fan');
    expect(findKeyboardActivatedNode({ key: 'Escape', target: wrapper }, NODES)).toBeUndefined();
    expect(findKeyboardActivatedNode({ key: 'a', target: wrapper }, NODES)).toBeUndefined();
  });

  it('a dobozon belüli gombon, a doboz nélküli elemen és nem HTML célponton nincs aktivált csomópont', () => {
    const button = nodeWrapper('n-fan').querySelector('button');
    expect(findKeyboardActivatedNode({ key: 'Enter', target: button }, NODES)).toBeUndefined();
    expect(findKeyboardActivatedNode({ key: 'Enter', target: document.createElement('div') }, NODES)).toBeUndefined();
    const edge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    expect(findKeyboardActivatedNode({ key: 'Enter', target: edge }, NODES)).toBeUndefined();
    expect(findKeyboardActivatedNode({ key: 'Enter', target: null }, NODES)).toBeUndefined();
  });

  it('ismeretlen azonosítójú dobozon nincs aktivált csomópont', () => {
    expect(findKeyboardActivatedNode({ key: 'Enter', target: nodeWrapper('n-masik') }, NODES)).toBeUndefined();
  });
});
