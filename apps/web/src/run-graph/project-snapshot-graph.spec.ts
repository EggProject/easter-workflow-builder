/* eslint-disable unicorn/no-null -- a szintetikus pillanatkép fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { RunSnapshotResponse } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { projectSnapshotGraph } from './project-snapshot-graph.ts';

function buildSnapshot(overrides: Partial<RunSnapshotResponse> = {}): RunSnapshotResponse {
  return {
    version: 1,
    sdkVersionPin: '0.1.13',
    workflow: { id: 'wf-1', name: 'Első workflow', description: null },
    nodes: [
      {
        id: 'n-start',
        type: 'start',
        label: 'Indítás',
        position: { x: 10, y: 20 },
        config: { type: 'start', inputFields: [], onUnhandledError: null },
        effectiveProviderId: 'minimax',
      },
      {
        id: 'n-loop',
        type: 'loop',
        label: 'Ciklus',
        position: { x: 200, y: 20 },
        config: { type: 'loop', maxIterations: 4, continueExpression: 'i < 4', onUnhandledError: null },
        effectiveProviderId: 'minimax',
      },
    ],
    edges: [
      {
        id: 'e-1',
        sourceNodeId: 'n-start',
        targetNodeId: 'n-loop',
        sourceHandle: null,
        targetHandle: null,
        branchKey: null,
      },
    ],
    ...overrides,
  };
}

describe('projectSnapshotGraph', () => {
  it('a position mezőt positionX/positionY párra fordítja, és a config-ot a tíz ágra szűkíti', () => {
    const projected = projectSnapshotGraph(buildSnapshot());

    expect(projected.kind).toBe('ok');
    if (projected.kind !== 'ok') {
      throw new Error('a projekció váratlanul hibát adott');
    }
    expect(projected.value.nodes).toHaveLength(2);
    expect(projected.value.nodes[0]).toMatchObject({ id: 'n-start', positionX: 10, positionY: 20 });
    expect(projected.value.nodes[1]?.config.type).toBe('loop');
    expect(projected.value.edges).toEqual([
      {
        id: 'e-1',
        sourceNodeId: 'n-start',
        targetNodeId: 'n-loop',
        sourceHandle: null,
        targetHandle: null,
        branchKey: null,
      },
    ]);
  });

  it('hibás config alakra a hibás mező útvonalát nevezi meg, és nem ad gráfot', () => {
    const projected = projectSnapshotGraph(
      buildSnapshot({
        nodes: [
          {
            id: 'n-loop',
            type: 'loop',
            label: 'Ciklus',
            position: { x: 0, y: 0 },
            // A `maxIterations` hiányzik: egy régebbi séma szerint írt vagy
            // sérült pillanatkép esete (a `graph_snapshot` sor
            // megváltoztathatatlan, SPEC-003 5.5).
            config: { type: 'loop', continueExpression: 'i < 4', onUnhandledError: null },
            effectiveProviderId: 'minimax',
          },
        ],
        edges: [],
      }),
    );

    expect(projected.kind).toBe('error');
    if (projected.kind !== 'error') {
      throw new Error('a projekció váratlanul sikeres lett');
    }
    expect(projected.message).toContain('maxIterations');
  });
});
