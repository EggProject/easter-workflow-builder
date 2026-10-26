/* eslint-disable unicorn/no-null -- a szintetikus fixture nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { StepRunRecord, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import type { BranchDecision } from './branch-decision.ts';
import { buildRunGraphNodes } from './build-run-graph-nodes.ts';

const BASE_STEP_RUN: StepRunRecord = {
  id: 's-1',
  runId: 'r-1',
  nodeId: 'n-agent',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'running',
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
  startedAtMs: 100,
  finishedAtMs: null,
  createdAtMs: 100,
};

const AGENT_NODE: WorkflowNodeInput = {
  id: 'n-agent',
  type: 'agent_step',
  label: 'Összefoglaló',
  positionX: 0,
  positionY: 0,
  config: {
    type: 'agent_step',
    promptTemplate: 'Foglald össze: {{input}}',
    providerId: null,
    modelId: null,
    effort: null,
    thinking: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: null,
    maxTurns: null,
    maxBudgetUsd: null,
    systemPrompt: null,
    agents: {},
    skills: null,
    mcpServers: {},
    enabledEngineHooks: [],
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
    onUnhandledError: null,
  },
};

const onOpenSubWorkflowRun = (): void => {
  // a build tiszta függvény: a callback csak áthalad rajta
};

const LOOP_NODE: WorkflowNodeInput = {
  id: 'n-loop',
  type: 'loop',
  label: 'Ciklus',
  positionX: 0,
  positionY: 0,
  config: { type: 'loop', maxIterations: 3, continueExpression: 'i < 3', onUnhandledError: null },
};

const APPROVAL_NODE: WorkflowNodeInput = {
  id: 'n-approval',
  type: 'human_approval',
  label: 'Jóváhagyás',
  positionX: 0,
  positionY: 0,
  config: {
    type: 'human_approval',
    title: 'Engedélyezed?',
    bodyTemplate: 'Kérlek erősítsd meg',
    timeoutMs: null,
    onUnhandledError: null,
  },
};

const NO_PENDING_APPROVALS: ReadonlyMap<string, number> = new Map();

const NO_BRANCH_DECISIONS: ReadonlyMap<string, readonly BranchDecision[]> = new Map();

const BRANCH_NODE: WorkflowNodeInput = {
  id: 'n-branch',
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
    defaultBranchKey: 'nem',
    onUnhandledError: null,
  },
};

function decision(eventId: number, isDefault: boolean): BranchDecision {
  return { eventId, stepRunId: 's-branch', branchKey: isDefault ? null : 'igen', usedDefault: isDefault };
}

describe('buildRunGraphNodes', () => {
  it('lépés futás nélküli csomópontra nem tesz fel status és runDecoration kulcsot', () => {
    const built = buildRunGraphNodes({
      nodes: [AGENT_NODE],
      nodeStepRuns: new Map(),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(built).toHaveLength(1);
    expect(built[0]?.workflowNode.id).toBe('n-agent');
    expect(Object.hasOwn(built[0] ?? {}, 'status')).toBe(false);
    expect(Object.hasOwn(built[0] ?? {}, 'attempt')).toBe(false);
    expect(Object.hasOwn(built[0] ?? {}, 'runDecoration')).toBe(false);
    expect(Object.hasOwn(built[0] ?? {}, 'usedDefaultBranch')).toBe(false);
  });

  it('a megjelenített lépés futás állapotát teszi a kártya adatába', () => {
    const built = buildRunGraphNodes({
      nodes: [AGENT_NODE],
      nodeStepRuns: new Map([
        [
          'n-agent',
          [
            { ...BASE_STEP_RUN, id: 's-early', status: 'failed', createdAtMs: 100 },
            { ...BASE_STEP_RUN, id: 's-late', status: 'running', createdAtMs: 200 },
          ],
        ],
      ]),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(built[0]?.status).toBe('running');
  });

  it('az összesítést és a navigációt EGY mezőben adja tovább', () => {
    const loopStepRun = { ...BASE_STEP_RUN, id: 's-loop', nodeId: 'n-loop', nodeType: 'loop', iteration: 1 } as const;
    const built = buildRunGraphNodes({
      nodes: [LOOP_NODE],
      nodeStepRuns: new Map([['n-loop', [loopStepRun]]]),
      stepRuns: [loopStepRun],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(built[0]?.runDecoration?.summary).toEqual({ kind: 'loop', iteration: 1, maxIterations: 3 });
    expect(built[0]?.runDecoration?.onOpenSubWorkflowRun).toBe(onOpenSubWorkflowRun);
  });

  it('a waiting_approval összesítést a pendingApprovalRequestedAtByStepRunId térképből adja tovább', () => {
    const approvalStepRun = {
      ...BASE_STEP_RUN,
      id: 's-approval',
      nodeId: 'n-approval',
      nodeType: 'human_approval',
      status: 'waiting_approval',
    } as const;
    const built = buildRunGraphNodes({
      nodes: [APPROVAL_NODE],
      nodeStepRuns: new Map([['n-approval', [approvalStepRun]]]),
      stepRuns: [approvalStepRun],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: new Map([['s-approval', 4000]]),
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(built[0]?.runDecoration?.summary).toEqual({ kind: 'waiting_approval', requestedAtMs: 4000 });
  });

  // ============================================================
  // A KÉT JELVÉNY ADATA (SPEC-008 6.6, T-009-38).
  // ============================================================

  it('a próbálkozás számot a megjelenített (legkésőbb létrehozott) lépés futásból adja, az állapottal együtt', () => {
    const built = buildRunGraphNodes({
      nodes: [AGENT_NODE],
      nodeStepRuns: new Map([
        [
          'n-agent',
          [
            { ...BASE_STEP_RUN, id: 's-late', status: 'running', attempt: 2, createdAtMs: 200 },
            { ...BASE_STEP_RUN, id: 's-early', status: 'failed', attempt: 1, createdAtMs: 100 },
          ],
        ],
      ]),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(built[0]?.status).toBe('running');
    expect(built[0]?.attempt).toBe(2);
  });

  it('az első próbálkozás értéke is átmegy: a jelvény szabálya (1 felett) a kártyáé', () => {
    const built = buildRunGraphNodes({
      nodes: [AGENT_NODE],
      nodeStepRuns: new Map([['n-agent', [BASE_STEP_RUN]]]),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(built[0]?.attempt).toBe(1);
  });

  it.each([
    ['csak egy alapértelmezett döntés', [decision(4, true)], true],
    ['a korábbi nem, a legutóbbi alapértelmezett', [decision(4, false), decision(9, true)], true],
    ['a korábbi alapértelmezett, a legutóbbi nem', [decision(4, true), decision(9, false)], false],
    ['csak nem alapértelmezett döntés', [decision(4, false)], false],
    ['üres döntés lista', [], false],
  ] as const)(
    'az alapértelmezett ág adata a legutóbbi döntést követi: %s',
    (_title, decisions: readonly BranchDecision[], hasBadge: boolean) => {
      const built = buildRunGraphNodes({
        nodes: [BRANCH_NODE],
        nodeStepRuns: new Map(),
        stepRuns: [],
        onOpenSubWorkflowRun,
        pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
        branchDecisionsByNodeId: new Map([['n-branch', decisions]]),
        isStatusLoading: false,
      });

      expect(Object.hasOwn(built[0] ?? {}, 'usedDefaultBranch')).toBe(hasBadge);
      expect(built[0]?.usedDefaultBranch).toBe(hasBadge ? true : undefined);
    },
  );

  it('a döntés csak a saját csomópontja kártyájára kerül', () => {
    const built = buildRunGraphNodes({
      nodes: [BRANCH_NODE, AGENT_NODE],
      nodeStepRuns: new Map(),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: new Map([['n-branch', [decision(4, true)]]]),
      isStatusLoading: false,
    });

    expect(built.map((node) => node.usedDefaultBranch)).toEqual([true, undefined]);
  });

  it('az állapot betöltése alatt minden csomópont isStatusLoading jelzőt kap, a rajz megmarad', () => {
    const built = buildRunGraphNodes({
      nodes: [AGENT_NODE],
      nodeStepRuns: new Map(),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: true,
    });

    expect(built).toHaveLength(1);
    expect(built[0]?.workflowNode.id).toBe('n-agent');
    expect(built[0]?.isStatusLoading).toBe(true);
  });

  it('betöltött lépés futásoknál nincs isStatusLoading kulcs', () => {
    const built = buildRunGraphNodes({
      nodes: [AGENT_NODE],
      nodeStepRuns: new Map(),
      stepRuns: [],
      onOpenSubWorkflowRun,
      pendingApprovalRequestedAtByStepRunId: NO_PENDING_APPROVALS,
      branchDecisionsByNodeId: NO_BRANCH_DECISIONS,
      isStatusLoading: false,
    });

    expect(Object.hasOwn(built[0] ?? {}, 'isStatusLoading')).toBe(false);
  });
});
