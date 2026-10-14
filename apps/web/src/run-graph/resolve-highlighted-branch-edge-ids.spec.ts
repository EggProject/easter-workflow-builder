/* eslint-disable unicorn/no-null -- a szintetikus drótszintű fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import type { BranchDecision } from './branch-decision.ts';
import { groupBranchDecisionsByNode } from './group-branch-decisions-by-node.ts';
import { resolveHighlightedBranchEdgeIds } from './resolve-highlighted-branch-edge-ids.ts';

function branchNode(id: string, defaultBranchKey: string | null): WorkflowNodeInput {
  return {
    id,
    type: 'branch',
    label: 'Elágazás',
    positionX: 0,
    positionY: 0,
    config: {
      type: 'branch',
      expression: 'input.kind',
      branches: [
        { key: 'igen', label: 'Igen' },
        { key: 'nem', label: 'Nem' },
      ],
      defaultBranchKey,
      onUnhandledError: null,
    },
  };
}

const LOOP_NODE: WorkflowNodeInput = {
  id: 'n-loop',
  type: 'loop',
  label: 'Ciklus',
  positionX: 0,
  positionY: 0,
  config: { type: 'loop', maxIterations: 3, continueExpression: 'i < 3', onUnhandledError: null },
};

function edge(id: string, sourceNodeId: string, branchKey: string | null): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId: `${id}-cel`, sourceHandle: branchKey, targetHandle: null, branchKey };
}

/**
 * Az elágazás három kimenő éle: két kulcsos és egy régi, kulcs nélküli; plusz
 * egy MÁSIK csomópontból induló él, aminek a kulcsa véletlenül egyezik.
 */
const EDGES: readonly WorkflowEdgeInput[] = [
  edge('e-igen', 'n-branch', 'igen'),
  edge('e-nem', 'n-branch', 'nem'),
  edge('e-kulcs-nelkul', 'n-branch', null),
  edge('e-mas-forras', 'n-loop', 'igen'),
];

function chosen(eventId: number, branchKey: string | null): BranchDecision {
  return { eventId, stepRunId: `s-${String(eventId)}`, branchKey, usedDefault: false };
}

function defaulted(eventId: number): BranchDecision {
  return { eventId, stepRunId: `s-${String(eventId)}`, branchKey: null, usedDefault: true };
}

function highlight(
  decisions: readonly BranchDecision[],
  mode: 'latest' | 'all',
  defaultBranchKey: string | null = 'nem',
): readonly string[] {
  return [
    ...resolveHighlightedBranchEdgeIds({
      decisionsByNodeId: new Map([
        ['n-branch', decisions],
        ['n-loop', decisions],
      ]),
      nodes: [branchNode('n-branch', defaultBranchKey), LOOP_NODE],
      edges: EDGES,
      mode,
    }),
  ];
}

describe('resolveHighlightedBranchEdgeIds', () => {
  it('usedDefault: false esetén a payload kulcsával egyező, a branch csomópontból induló élt emeli ki', () => {
    expect(highlight([chosen(4, 'igen')], 'latest')).toEqual(['e-igen']);
  });

  it('usedDefault: true esetén a pillanatkép defaultBranchKey értékével egyező élt emeli ki, nem a null payload kulcsot', () => {
    expect(highlight([defaulted(4)], 'latest')).toEqual(['e-nem']);
  });

  it('a null kulcsú él soha nem emelődik ki, akkor sem, ha a választott kulcs null', () => {
    expect(highlight([chosen(4, null)], 'all')).toEqual([]);
  });

  it('alapértelmezett döntés null defaultBranchKey mellett semmit nem emel ki', () => {
    expect(highlight([defaulted(4)], 'all', null)).toEqual([]);
  });

  it('a "legutóbbi" mód csak a legnagyobb eventId-jű döntés élét emeli ki', () => {
    expect(highlight([chosen(4, 'igen'), defaulted(9)], 'latest')).toEqual(['e-nem']);
  });

  it('a "minden bejárt" mód minden döntés élét kiemeli', () => {
    expect(highlight([chosen(4, 'igen'), defaulted(9)], 'all')).toEqual(['e-igen', 'e-nem']);
  });

  it('a két mód ugyanarra a döntés sorra különböző élhalmazt ad', () => {
    const decisions = [chosen(4, 'nem'), chosen(9, 'igen')];

    expect(highlight(decisions, 'latest')).toEqual(['e-igen']);
    expect(highlight(decisions, 'all')).toEqual(['e-igen', 'e-nem']);
  });

  it('döntés nélküli branch csomópontnál nincs kiemelt él', () => {
    expect(highlight([], 'all')).toEqual([]);
  });

  it('a nem branch típusú csomóponthoz leképezett döntés nem emel ki élt', () => {
    const highlighted = resolveHighlightedBranchEdgeIds({
      decisionsByNodeId: new Map([['n-loop', [chosen(4, 'igen')]]]),
      nodes: [branchNode('n-branch', 'nem'), LOOP_NODE],
      edges: EDGES,
      mode: 'all',
    });

    expect([...highlighted]).toEqual([]);
  });

  it('a pillanatképben nem szereplő csomóponthoz leképezett döntés nem emel ki élt', () => {
    const highlighted = resolveHighlightedBranchEdgeIds({
      decisionsByNodeId: new Map([['n-torolt', [chosen(4, 'igen')]]]),
      nodes: [branchNode('n-branch', 'nem')],
      edges: [...EDGES, edge('e-torolt', 'n-torolt', 'igen')],
      mode: 'all',
    });

    expect([...highlighted]).toEqual([]);
  });

  it('a még le nem képezhető lépés futás döntése nem hiba és nem emel ki élt, a lista frissülése után kiemel', () => {
    const branchStepRun: StepRunRecord = {
      id: 's-9',
      runId: 'r-1',
      nodeId: 'n-branch',
      nodeType: 'branch',
      parentStepRunId: null,
      iteration: 0,
      attempt: 1,
      status: 'succeeded',
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      sdkSessionId: null,
      resumedFromSessionId: null,
      forkedSession: false,
      structuredOutputStrategy: null,
      output: null,
      resultSubtype: null,
      numTurns: null,
      inputTokens: null,
      outputTokens: null,
      cacheReadInputTokens: null,
      cacheCreationInputTokens: null,
      subWorkflowRunId: null,
      errorKind: null,
      errorMessage: null,
      startedAtMs: 1,
      finishedAtMs: 2,
      createdAtMs: 1,
    };
    const decisions = new Map([[9, defaulted(9)]]);
    const highlightFor = (stepRuns: readonly StepRunRecord[]): readonly string[] => [
      ...resolveHighlightedBranchEdgeIds({
        decisionsByNodeId: groupBranchDecisionsByNode(decisions, stepRuns),
        nodes: [branchNode('n-branch', 'nem')],
        edges: EDGES,
        mode: 'latest',
      }),
    ];

    expect(highlightFor([])).toEqual([]);
    expect(highlightFor([branchStepRun])).toEqual(['e-nem']);
  });
});
