// A jóváhagyás panel közös fixtúrája (T-009-27, SPEC-008 8. szekció).
//
// EGYETLEN FORRÁS a futás nézet jóváhagyás felületének e2e tesztjeihez
// (`approval-prompt.spec.ts`) és a panel mérő eszközéhez
// (`measurement/approval-panel.ts`), hogy a mért számok és a tesztek
// ugyanazon a fixtúrán álljanak (`.claude/CLAUDE.md` 12. szekció: minden
// bizonyíték előállító eszköz a repóba tartozik, és amit munkamenetenként
// újra kell írni, azt munkamenetenként újra el is lehet rontani). Minden REST
// hívás `page.route()` mockon megy, az SSE csatorna egyetlen `stream_ready`
// kerete (`mockIdleStream`).
import type {
  NodeConfig,
  PendingApproval,
  RunDetail,
  RunSnapshotResponse,
  StepRunRecord,
  StreamFrame,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { mockIdleStream, mockSseFrames } from './sse-mock.ts';
import { makeRunEventRecord, replayFrames } from './transcript-fixture.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), lásd `run-view.spec.ts` azonos megjegyzését */

function approvalConfig(title: string): NodeConfig {
  return {
    type: 'human_approval',
    title,
    bodyTemplate: 'Kérlek erősítsd meg',
    timeoutMs: null,
    onUnhandledError: null,
  };
}

export const APPROVAL_RUN_DETAIL: RunDetail = {
  id: 'run-approval',
  workflowId: 'w-approval',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: 'run-approval',
  depth: 1,
  workflowAncestry: ['w-approval'],
  graphSnapshotHash: 'c'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const BASE_STEP_RUN: StepRunRecord = {
  id: 'sr-1',
  runId: APPROVAL_RUN_DETAIL.id,
  nodeId: 'n-1',
  nodeType: 'human_approval',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'waiting_approval',
  providerId: 'claude-subscription',
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
  startedAtMs: 2,
  finishedAtMs: null,
  createdAtMs: 2,
};

export const APPROVAL_RUN_URL = `/run?runId=${APPROVAL_RUN_DETAIL.id}`;

/**
 * A csomópontok vízszintes távolsága: a kártya mért szélessége
 * (`GRAPH_NODE_CARD_WIDTH`, 358, `apps/web/src/graph-node-catalog/`) plusz a
 * `@dagrejs/dagre` szállított `ranksep` alapértéke (50), ugyanaz, amit a
 * `showcase-graph.ts` `COLUMN_X` sora is használ. A futás nézet a pillanatkép
 * pozícióit használja (SPEC-008 5.7), tehát egy ennél kisebb távolság
 * egymásra rajzolná a kártyákat; ezt az `approval-prompt.spec.ts` első
 * tesztje méri.
 */
const NODE_SPACING_X = 408;

/**
 * Két függő `human_approval` csomópont, és egy harmadik, már ELDÖNTÖTT
 * (`succeeded`), ami nem szerepel a `GET /api/approvals` válaszában (a végpont
 * csak `waiting_approval` lépést listáz, user döntés 2026-09-23/24), tehát a
 * kártyáján sincs várakozás felirat. A `sub_workflow` csomópont gombja
 * UGYANERRE a képernyőre navigál, másik `?runId=` értékkel: ezen át mérhető,
 * hogy a futás váltása előtt indított kérés késve érkező válasza eldobódik.
 */
export function buildApprovalSnapshot(): RunSnapshotResponse {
  return {
    version: 1,
    sdkVersionPin: '0.1.13',
    workflow: { id: APPROVAL_RUN_DETAIL.workflowId, name: 'Jóváhagyás teszt workflow', description: null },
    nodes: [
      {
        id: 'n-first',
        type: 'human_approval',
        label: 'Első jóváhagyás',
        position: { x: 0, y: 0 },
        config: approvalConfig('Első jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-second',
        type: 'human_approval',
        label: 'Második jóváhagyás',
        position: { x: NODE_SPACING_X, y: 0 },
        config: approvalConfig('Második jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-done',
        type: 'human_approval',
        label: 'Már eldöntött jóváhagyás',
        position: { x: 2 * NODE_SPACING_X, y: 0 },
        config: approvalConfig('Már eldöntött jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-sub',
        type: 'sub_workflow',
        label: 'Al-workflow',
        position: { x: 3 * NODE_SPACING_X, y: 0 },
        config: { type: 'sub_workflow', targetWorkflowId: 'w-child', inputMapping: {}, onUnhandledError: null },
        effectiveProviderId: 'claude-subscription',
      },
    ],
    edges: [],
  };
}

export const APPROVAL_STEP_RUNS: readonly StepRunRecord[] = [
  { ...BASE_STEP_RUN, id: 'sr-first', nodeId: 'n-first' },
  { ...BASE_STEP_RUN, id: 'sr-second', nodeId: 'n-second' },
  { ...BASE_STEP_RUN, id: 'sr-done', nodeId: 'n-done', status: 'succeeded', finishedAtMs: 3 },
  {
    ...BASE_STEP_RUN,
    id: 'sr-sub',
    nodeId: 'n-sub',
    nodeType: 'sub_workflow',
    status: 'running',
    subWorkflowRunId: 'run-child',
  },
];

// Két rögzített, eltérő kérés időpont (helyi idő szerint 10:32:05 és
// 11:47:30): a felirat abszolút időpont, tehát a futás pillanatától nem függ.
export const FIRST_REQUESTED_AT_MS = new Date(2026, 8, 24, 10, 32, 5).getTime();
export const SECOND_REQUESTED_AT_MS = new Date(2026, 8, 24, 11, 47, 30).getTime();

export const FIRST_APPROVAL: PendingApproval = {
  id: 'appr-first',
  runId: APPROVAL_RUN_DETAIL.id,
  stepRunId: 'sr-first',
  title: 'Engedélyezed a fizetést?',
  body: 'Kérlek erősítsd meg a tranzakciót',
  payload: { amount: 100, currency: 'EUR' },
  decision: null,
  requestedAtMs: FIRST_REQUESTED_AT_MS,
  decidedAtMs: null,
};

export const SECOND_APPROVAL: PendingApproval = {
  ...FIRST_APPROVAL,
  id: 'appr-second',
  stepRunId: 'sr-second',
  title: 'Engedélyezed a szállítást?',
  requestedAtMs: SECOND_REQUESTED_AT_MS,
};

/**
 * `n` darab függő jóváhagyás, eltérő címmel és kérés időponttal. A lépés
 * futás azonosítók a rajzon nem szereplő lépésekre mutatnak, tehát a
 * csomópontok dekorációja minden `n` mellett azonos: a mérés kizárólag a
 * panel hatását látja.
 */
export function manyApprovals(count: number): readonly PendingApproval[] {
  return Array.from({ length: count }, (_, index) => ({
    ...FIRST_APPROVAL,
    id: `appr-many-${String(index)}`,
    stepRunId: `sr-many-${String(index)}`,
    title: `Tömeges jóváhagyás ${String(index + 1)}`,
    requestedAtMs: FIRST_REQUESTED_AT_MS + index * 60_000,
  }));
}

/**
 * Egy `fan_out` ág szerinti jóváhagyás sorozat: a `human_approval` csomópont
 * címe minden ágon ugyanaz (`execute-human-approval.ts` `title:
 * config.title`, SPEC-004), csak a `payload` különbözik. Ezen mérhető, hogy
 * a döntés gombja a LÁTOTT jóváhagyáshoz tartozik, nem egy azonos című
 * másikhoz.
 */
export const FAN_OUT_APPROVAL_TITLE = 'Kifizetés jóváhagyása';

export function fanOutApprovals(count: number): readonly PendingApproval[] {
  return Array.from({ length: count }, (_, index) => ({
    ...FIRST_APPROVAL,
    id: `appr-branch-${String(index)}`,
    stepRunId: `sr-branch-${String(index)}`,
    title: FAN_OUT_APPROVAL_TITLE,
    body: 'A fan_out ág kifizetése jóváhagyásra vár.',
    payload: { branch: index, amount: 100 * (index + 1), currency: 'EUR' },
    requestedAtMs: FIRST_REQUESTED_AT_MS + index * 1000,
  }));
}

export function approvalBaseMocks(listPendingApprovals: MockRoute['handle']): readonly MockRoute[] {
  return [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(APPROVAL_RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(buildApprovalSnapshot()))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(APPROVAL_STEP_RUNS))),
    mockRoute('listPendingApprovals', listPendingApprovals),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ];
}

export async function mockApprovalRun(page: Page, approvals: readonly PendingApproval[]): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(
    page,
    approvalBaseMocks(async (route) => route.fulfill(jsonBody(approvals))),
  );
}

/**
 * A transcript pótlásának sorai a szélső állás méréséhez és e2e tesztjéhez:
 * elég ahhoz, hogy a lista görgethető legyen (a `run-view-stream.ts`
 * `REPLAYED_ROW_COUNT` értéke).
 */
export const APPROVAL_TRANSCRIPT_ROW_COUNT = 20;

/**
 * A futás a megadott jóváhagyásokkal és egy lezárt pótlással
 * (`APPROVAL_TRANSCRIPT_ROW_COUNT` tárolt sor), hogy a transcript utolsó sora
 * mérhető legyen (research 10. szekció). Az `extraRoutes` további REST
 * mockokat ad (például a döntés válaszát), mert egy második
 * `installApiMocks` a többi útvonalat is elfogná. A `mockStream` a stream
 * mockja: alapból minden újracsatlakozáskor újra pótol (`mockSseFrames`); a
 * `mockSseFramesWithoutReconnect` csak egyszer, hogy az újracsatlakozás
 * újratöltése ne renderelje újra a képernyőt (2026-09-26).
 */
export async function mockApprovalRunWithTranscript(
  page: Page,
  approvals: readonly PendingApproval[],
  extraRoutes: readonly MockRoute[] = [],
  mockStream: (page: Page, frames: readonly StreamFrame[]) => Promise<void> = mockSseFrames,
): Promise<void> {
  const records = Array.from({ length: APPROVAL_TRANSCRIPT_ROW_COUNT }, (_, index) =>
    makeRunEventRecord(index + 1, APPROVAL_RUN_DETAIL.id),
  );
  await mockStream(page, replayFrames(APPROVAL_RUN_DETAIL.id, records));
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => route.fulfill(jsonBody(approvals))),
    ...extraRoutes,
  ]);
}

/* eslint-enable unicorn/no-null */
