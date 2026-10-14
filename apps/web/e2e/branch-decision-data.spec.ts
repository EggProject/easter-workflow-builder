// E2E a futás nézet elágazás döntéseinek KERET ÚTJÁRA (PLAN-009 T-009-38,
// SPEC-008 6.6, 87.).
//
// Amit véd: a valódi böngésző `EventSource` útján, a veszteségmentes
// `subscribeToFrames` feliratkozáson érkező hibás alakú, ismétlődő, más
// futáshoz tartozó és le nem képezhető `branch_taken` keretek mellett a keret
// út hibátlanul fut, a futás nézet nem törik el, új REST hívás nem indul
// (SPEC-008 6.6 "Nem async pont", 87.), és az új kód érvényes döntés ága e2e
// lefedettségben marad: ez a lefedettségi ratchet őre (T-009-38 3. szekció,
// `docs/research/2026-10-14-ag-kiemeles.md`).
//
// Amit NEM bizonyít: hogy a döntések gyűjtője fut és az adat a csomópont
// kártyára jut. A megjelenítés (jelvény, kiemelt él, kapcsoló) még nincs
// bekötve, ezért a gyűjtő hook kivétele, a `RunViewScreen` bekötésének
// kivétele és a duplikátum szűrés kikapcsolása mellett is zöld marad. Az adat
// út megfigyelhető e2e bizonyítéka a T-009-40, amikor a T-009-39 a jelvényt és
// a kiemelést kirajzolja. A döntés adatának tartalmát a
// `use-branch-decisions.spec.tsx`, a `group-branch-decisions-by-node.spec.ts`
// és a `RunViewScreen.spec.tsx` unit tesztjei állítják. Minden REST hívás
// `page.route()` mockon megy, az SSE válasz egyetlen, lezárt `page.route()`
// válasz, újracsatlakozás nélkül (`.claude/CLAUDE.md` 11. szekció).
import type {
  NodeConfig,
  RunDetail,
  RunEventRecord,
  RunSnapshotResponse,
  StepRunRecord,
  StreamFrame,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { mockSseFramesWithoutReconnect } from './sse-mock.ts';
import { makeRunEventRecord, replayFrames } from './transcript-fixture.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), ugyanaz a minta, mint a `run-view.spec.ts`-ben */

const RUN_ID = 'run-branch';

const BRANCH_CONFIG: NodeConfig = {
  type: 'branch',
  expression: 'input.kind',
  branches: [
    { key: 'igen', label: 'Igen' },
    { key: 'nem', label: 'Nem' },
  ],
  defaultBranchKey: 'nem',
  onUnhandledError: null,
};

const SCRIPT_CONFIG: NodeConfig = {
  type: 'script',
  source: 'input',
  runtime: 'expression',
  onUnhandledError: null,
};

const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-branch', name: 'Elágazó workflow', description: null },
  nodes: [
    {
      id: 'b-start',
      type: 'start',
      label: 'Indítás',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'b-branch',
      type: 'branch',
      label: 'Döntés',
      position: { x: 400, y: 0 },
      config: BRANCH_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'b-yes',
      type: 'script',
      label: 'Igen ág',
      position: { x: 800, y: -150 },
      config: SCRIPT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'b-no',
      type: 'script',
      label: 'Nem ág',
      position: { x: 800, y: 150 },
      config: SCRIPT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [
    {
      id: 'b-e-start',
      sourceNodeId: 'b-start',
      targetNodeId: 'b-branch',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: 'b-e-yes',
      sourceNodeId: 'b-branch',
      targetNodeId: 'b-yes',
      sourceHandle: 'igen',
      targetHandle: null,
      branchKey: 'igen',
    },
    {
      id: 'b-e-no',
      sourceNodeId: 'b-branch',
      targetNodeId: 'b-no',
      sourceHandle: 'nem',
      targetHandle: null,
      branchKey: 'nem',
    },
  ],
};

const RUN_DETAIL: RunDetail = {
  id: RUN_ID,
  workflowId: 'w-branch',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: RUN_ID,
  depth: 0,
  workflowAncestry: ['w-branch'],
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
  id: 'sr-start',
  runId: RUN_ID,
  nodeId: 'b-start',
  nodeType: 'start',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
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
  finishedAtMs: 3,
  createdAtMs: 2,
};

/**
 * Az elágazás kétszer futott: a második futás a második próbálkozás. A
 * döntések ezekhez a sorokhoz kötődnek, a `sr-ismeretlen` lépés futás nincs a
 * listában.
 */
const STEP_RUNS: readonly StepRunRecord[] = [
  BASE_STEP_RUN,
  { ...BASE_STEP_RUN, id: 'sr-branch-1', nodeId: 'b-branch', nodeType: 'branch', createdAtMs: 4 },
  { ...BASE_STEP_RUN, id: 'sr-branch-2', nodeId: 'b-branch', nodeType: 'branch', attempt: 2, createdAtMs: 6 },
];

function branchTakenRecord(id: number, stepRunId: string | null, payload: unknown): RunEventRecord {
  return makeRunEventRecord(id, RUN_ID, { kind: 'branch_taken', stepRunId, payload });
}

/**
 * A nézett futás nyolc egyedi eseménye: két érvényes döntés (a legutóbbi az
 * alapértelmezett ágra lépett), egy le nem képezhető lépés futású döntés, és
 * négy hibás alakú `branch_taken` keret.
 */
const FIRST_DECISION = branchTakenRecord(2, 'sr-branch-1', { branchKey: 'igen', usedDefault: false });

const RECORDS: readonly RunEventRecord[] = [
  makeRunEventRecord(1, RUN_ID, { stepRunId: 'sr-start' }),
  FIRST_DECISION,
  branchTakenRecord(3, 'sr-branch-2', { branchKey: null, usedDefault: true }),
  branchTakenRecord(4, 'sr-ismeretlen', { branchKey: 'igen', usedDefault: false }),
  branchTakenRecord(5, 'sr-branch-2', 'nem objektum'),
  branchTakenRecord(6, 'sr-branch-2', { branchKey: 3, usedDefault: false }),
  branchTakenRecord(7, 'sr-branch-2', { branchKey: 'igen', usedDefault: 'false' }),
  branchTakenRecord(8, null, { branchKey: 'igen', usedDefault: false }),
];

/**
 * A pótlás, egy ismétlődő `id`-vel (az első döntés másodszor) és egy MÁSIK
 * futás döntésével: egyik sem számít, és a transcript sem kap tőlük sort.
 */
function streamFrames(): readonly StreamFrame[] {
  const frames = replayFrames(RUN_ID, RECORDS);
  const duplicate: StreamFrame = { event: 'run_event', delivery: 'replayed', runEvent: FIRST_DECISION };
  const otherRun: StreamFrame = {
    event: 'run_event',
    delivery: 'live',
    runEvent: makeRunEventRecord(99, 'run-masik', {
      kind: 'branch_taken',
      stepRunId: 'sr-branch-1',
      payload: { branchKey: 'nem', usedDefault: false },
    }),
  };
  return [...frames.slice(0, -1), duplicate, otherRun, ...frames.slice(-1)];
}

/**
 * A futás nézet öt meglévő végpontja: a T-009-38 előtt is pontosan ezeket
 * hívta (`run-view.spec.ts` `mockRun`).
 */
const RUN_VIEW_ROUTES: readonly MockRoute[] = [
  mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
  mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
  mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
  mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
  mockRoute('replaceStreamSubscriptions', async (route) =>
    route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
  ),
];

interface ApiRequest {
  readonly method: string;
  readonly pathname: string;
}

/**
 * Az `/api/` alá menő kérések naplója, a lap megnyitása előtt bekötve.
 */
function recordApiRequests(page: Page): readonly ApiRequest[] {
  const requests: ApiRequest[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/api/')) {
      requests.push({ method: request.method(), pathname });
    }
  });
  return requests;
}

/* eslint-enable unicorn/no-null */

test('a branch_taken keretek mellett a futás nézet nem törik el, és új REST hívást nem indít', async ({ page }) => {
  await mockSseFramesWithoutReconnect(page, streamFrames());
  await installApiMocks(page, RUN_VIEW_ROUTES);
  const requests = recordApiRequests(page);

  await page.goto(`/run?runId=${RUN_ID}`);

  await expect(page.getByTestId('rf__node-b-branch')).toBeVisible();
  // A transcript utolsó sora a nyolcadik: a pótlás keretei eljutottak a
  // nézetig, az ismétlődő és a más futáshoz tartozó keret nem kapott sort.
  // Ez a transcript útját bizonyítja, nem a döntések gyűjtőjét.
  const transcript = page.getByRole('list', { name: 'Futás eseményei' });
  await expect(transcript.getByRole('listitem').last()).toHaveAttribute('aria-posinset', String(RECORDS.length));
  // A pótlás végét jelző keretre a lépés futás lista egyszer újratöltődik: ez
  // a kérés azt jelzi, hogy a pótlás összes kerete megérkezett (SPEC-008 6.2),
  // tehát az alábbi "nincs új REST hívás" állítás a teljes pótlásra szól.
  await expect
    .poll(() => requests.filter((request) => request.pathname === `/api/runs/${RUN_ID}/steps`).length)
    .toBe(2);

  const unexpected = requests.filter((request) =>
    RUN_VIEW_ROUTES.every((route) => route.method !== request.method || !route.pathname.test(request.pathname)),
  );
  expect(unexpected).toEqual([]);
});
