/* eslint-disable unicorn/no-null -- a névtelen kimenő handle azonosítója a dróton ténylegesen `null`, nem helyőrző `undefined` (SPEC-008 5.1, M-88) */
import { NodeTypeSchema } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { GRAPH_NODE_CATALOG } from './graph-node-catalog.ts';

describe('GRAPH_NODE_CATALOG', () => {
  it('mind a tíz NodeType értékre tartalmaz bejegyzést', () => {
    for (const nodeType of NodeTypeSchema.options) {
      expect(GRAPH_NODE_CATALOG[nodeType]).toBeDefined();
    }
    expect(Object.keys(GRAPH_NODE_CATALOG)).toHaveLength(10);
  });

  it('a start node bemenet nélküli, egy névtelen kimenettel', () => {
    expect(GRAPH_NODE_CATALOG.start.hasInputHandle).toBe(false);
    expect(GRAPH_NODE_CATALOG.start.outputHandles).toEqual({
      kind: 'fixed',
      handles: [{ id: null, label: 'Kimenet' }],
    });
  });

  it('az agent_step, a fan_out, a join, a sub_workflow és a script egy bemenő és egy névtelen kimenő handle-t hordoz', () => {
    for (const nodeType of ['agent_step', 'fan_out', 'join', 'sub_workflow', 'script'] as const) {
      expect(GRAPH_NODE_CATALOG[nodeType].hasInputHandle).toBe(true);
      expect(GRAPH_NODE_CATALOG[nodeType].outputHandles).toEqual({
        kind: 'fixed',
        handles: [{ id: null, label: 'Kimenet' }],
      });
    }
  });

  it('a branch kimenő handle-e dinamikus, a node saját config.branches listájából épül', () => {
    expect(GRAPH_NODE_CATALOG.branch.hasInputHandle).toBe(true);
    expect(GRAPH_NODE_CATALOG.branch.outputHandles).toEqual({ kind: 'dynamic-branch' });
  });

  it('a loop két, fenntartott azonosítójú kimenő handle-t hordoz (M-88)', () => {
    expect(GRAPH_NODE_CATALOG.loop.outputHandles).toEqual({
      kind: 'fixed',
      handles: [
        { id: 'continue', label: 'Folytatás' },
        { id: 'exit', label: 'Kilépés' },
      ],
    });
  });

  it('a human_approval két, fenntartott azonosítójú kimenő handle-t hordoz (M-88)', () => {
    expect(GRAPH_NODE_CATALOG.human_approval.outputHandles).toEqual({
      kind: 'fixed',
      handles: [
        { id: 'approved', label: 'Jóváhagyva' },
        { id: 'rejected', label: 'Elutasítva' },
      ],
    });
  });

  it('az error_handler egy névtelen és egy on_error kimenő handle-t hordoz (M-88)', () => {
    expect(GRAPH_NODE_CATALOG.error_handler.outputHandles).toEqual({
      kind: 'fixed',
      handles: [
        { id: null, label: 'Kimenet' },
        { id: 'on_error', label: 'Hiba esetén' },
      ],
    });
  });

  it('minden bejegyzés magyar címkét hordoz, üres string nélkül', () => {
    for (const nodeType of NodeTypeSchema.options) {
      expect(GRAPH_NODE_CATALOG[nodeType].label.length).toBeGreaterThan(0);
    }
  });
});
