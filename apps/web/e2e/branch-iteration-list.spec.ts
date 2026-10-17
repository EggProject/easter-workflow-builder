// E2E a futás nézet tételes listájára (SPEC-008 6.3, 14.1 O-39, 118.
// kritérium, PLAN-009 T-009-61, user döntés 2026-10-17): a `fan_out` és a
// `loop` csomópontra kattintva a transcript sáv tetején kinyílik az ágak,
// illetve az iterációk listája, a transcript a csomópont tételeinek
// eseményeire szűkül, egy tételre kattintva csak az övéire, és a lista
// bezárása visszahozza a teljes transcriptet.
//
// Miért kell e2e: a csomópontra kattintás a valódi React Flow csomópont
// dobozán megy át (`pointer-events`, a `NodeWrapper` kattintás kezelője), és a
// lista meg a transcript magasság megosztása (`branch-iteration-list.css`)
// csak valódi elrendezésben figyelhető meg. Minden REST hívás `page.route()`
// mockon megy; az SSE csatorna egyetlen lezárt pótlás, ami a szabálykönyv 11.
// szekciója szerint a HASZNÁLANDÓ út egyetlen lezárt válaszon belüli
// viselkedéshez.
import type {
  NodeConfig,
  RunDetail,
  RunEventRecord,
  RunSnapshotResponse,
  StepRunRecord,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockSseFramesWithoutReconnect } from './sse-mock.ts';
import { makeRunEventRecord, replayFrames } from './transcript-fixture.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), ugyanaz a minta, mint a `run-view.spec.ts`-ben */

const RUN_ID = 'run-lista';

const START_CONFIG: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

const FAN_OUT_CONFIG: NodeConfig = {
  type: 'fan_out',
  itemsExpression: 'items',
  branchLabelTemplate: '{{item}}',
  onUnhandledError: null,
};

const CHECK_CONFIG: NodeConfig = {
  type: 'human_approval',
  title: 'Ellenőrzés',
  bodyTemplate: 'Rendben?',
  timeoutMs: null,
  onUnhandledError: null,
};

const LOOP_CONFIG: NodeConfig = {
  type: 'loop',
  maxIterations: 5,
  continueExpression: 'i < 5',
  onUnhandledError: null,
};

function snapshotNode(
  id: string,
  type: RunSnapshotResponse['nodes'][number]['type'],
  label: string,
  x: number,
  config: NodeConfig,
): RunSnapshotResponse['nodes'][number] {
  return { id, type, label, position: { x, y: 0 }, config, effectiveProviderId: 'claude-subscription' };
}

const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-lista', name: 'Tételes lista', description: null },
  nodes: [
    snapshotNode('n-start', 'start', 'Futás indítása', 0, START_CONFIG),
    snapshotNode('n-fan', 'fan_out', 'Elemek szétosztása', 400, FAN_OUT_CONFIG),
    snapshotNode('n-check', 'human_approval', 'Ellenőrzés', 800, CHECK_CONFIG),
    snapshotNode('n-loop', 'loop', 'Ismétlés', 1200, LOOP_CONFIG),
  ],
  edges: [],
};

const RUN_DETAIL: RunDetail = {
  id: RUN_ID,
  workflowId: 'w-lista',
  status: 'succeeded',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: RUN_ID,
  depth: 0,
  workflowAncestry: ['w-lista'],
  graphSnapshotHash: 'c'.repeat(64),
  persistedStreamDeltas: true,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: 90,
  errorKind: null,
  errorMessage: null,
};

function stepRun(overrides: Partial<StepRunRecord>): StepRunRecord {
  return {
    id: 'sr-start',
    runId: RUN_ID,
    nodeId: 'n-start',
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
    ...overrides,
  };
}

/**
 * A szétosztás két ága egy-egy jóváhagyás lépéssel, és a ciklus két
 * iterációja, a második törzsében egy lépéssel (SPEC-004 4.3 és 4.6: a
 * hatókörben futó lépés szülője a hatókört nyitó lépés futás).
 */
const STEP_RUNS: readonly StepRunRecord[] = [
  stepRun({}),
  stepRun({ id: 'sr-fan', nodeId: 'n-fan', nodeType: 'fan_out', output: ['a', 'b'], createdAtMs: 3 }),
  stepRun({ id: 'sr-a', nodeId: 'n-check', nodeType: 'human_approval', parentStepRunId: 'sr-fan', createdAtMs: 4 }),
  stepRun({
    id: 'sr-b',
    nodeId: 'n-check',
    nodeType: 'human_approval',
    parentStepRunId: 'sr-fan',
    status: 'rejected',
    createdAtMs: 5,
  }),
  stepRun({ id: 'sr-l0', nodeId: 'n-loop', nodeType: 'loop', iteration: 0, createdAtMs: 6 }),
  stepRun({ id: 'sr-l1', nodeId: 'n-loop', nodeType: 'loop', iteration: 1, createdAtMs: 7 }),
  stepRun({
    id: 'sr-body',
    nodeId: 'n-check',
    nodeType: 'human_approval',
    parentStepRunId: 'sr-l1',
    iteration: 1,
    createdAtMs: 8,
  }),
];

/**
 * Egy felhasználói fordulat sor a megadott szöveggel: a sor címe a szöveget
 * hordozza (`run-event-row-summary.ts` `describeUser`), tehát a lépés futása
 * a látható szövegből azonosítható.
 */
function userTurn(id: number, stepRunId: string | null, text: string): RunEventRecord {
  return makeRunEventRecord(id, RUN_ID, {
    stepRunId,
    origin: 'sdk',
    kind: 'sdk_user',
    sdkMessageType: 'user',
    payload: { type: 'user', message: { role: 'user', content: text } },
  });
}

const RECORDS: readonly RunEventRecord[] = [
  userTurn(1, null, 'Futás szintű sor'),
  userTurn(2, 'sr-start', 'Indítás sora'),
  userTurn(3, 'sr-fan', 'Szétosztás sora'),
  userTurn(4, 'sr-a', 'Első ág sora'),
  userTurn(5, 'sr-b', 'Második ág sora'),
  userTurn(6, 'sr-l0', 'Nulladik iteráció sora'),
  userTurn(7, 'sr-l1', 'Első iteráció sora'),
  userTurn(8, 'sr-body', 'Ciklus törzs sora'),
];

/* eslint-enable unicorn/no-null */

async function mockRun(page: Page, stepRuns: readonly StepRunRecord[] = STEP_RUNS): Promise<void> {
  await mockSseFramesWithoutReconnect(page, replayFrames(RUN_ID, RECORDS));
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(stepRuns))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

/**
 * A React Flow csomópont a könyvtár saját `rf__node-<id>` fogódzóján: a
 * SPEC-008 12.3 locator kivétele.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

function transcriptList(page: Page): Locator {
  return page.getByRole('list', { name: 'Futás eseményei' });
}

/**
 * A transcript látható sorainak címei, sorrendben: nyolc sornál a 1440x900-as
 * ablakban mind kirajzolódik (a virtualizált lista a látható sorokat
 * rajzolja).
 */
async function transcriptTitles(page: Page): Promise<readonly string[]> {
  return transcriptList(page).getByRole('listitem').locator('.accordion__title').allTextContents();
}

async function openRunView(page: Page, stepRuns?: readonly StepRunRecord[]): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockRun(page, stepRuns);
  await page.goto(`/run?runId=${RUN_ID}`);
  await expect(nodeLocator(page, 'n-fan')).toBeVisible();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(RECORDS.length);
}

test('a fan_out csomópontra kattintva kinyílik az ágak listája, egy ágra kattintva a transcript csak annak eseményeit mutatja, a bezárás visszaállít', async ({
  page,
}) => {
  await openRunView(page);

  await nodeLocator(page, 'n-fan').click();
  const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('row')).toHaveCount(3);
  await expect(region.getByRole('button', { name: '1. Ellenőrzés' })).toHaveAttribute('aria-pressed', 'false');
  await expect(region.getByRole('row', { name: /2\. Ellenőrzés/ }).getByText('elutasítva')).toBeVisible();

  // A csomópont minden tétele: a szétosztás saját sora és a két ág.
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);
  expect(await transcriptTitles(page)).toEqual([
    expect.stringContaining('Szétosztás sora'),
    expect.stringContaining('Első ág sora'),
    expect.stringContaining('Második ág sora'),
  ]);

  await region.getByRole('button', { name: '2. Ellenőrzés' }).click();
  await expect(region.getByRole('button', { name: '2. Ellenőrzés' })).toHaveAttribute('aria-pressed', 'true');
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(1);
  expect(await transcriptTitles(page)).toEqual([expect.stringContaining('Második ág sora')]);

  await region.getByRole('button', { name: 'A lista bezárása' }).click();
  await expect(region).toBeAttached({ attached: false });
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(RECORDS.length);
});

test('a loop csomópontra kattintva kinyílik az iterációk listája, egy iteráció a törzsével együtt szűkít, a bezárás visszaállít', async ({
  page,
}) => {
  await openRunView(page);

  await nodeLocator(page, 'n-loop').click();
  const region = page.getByRole('region', { name: 'Iterációk: Ismétlés' });
  await expect(region).toBeVisible();
  await expect(region.getByRole('button', { name: '1. iteráció: 0' })).toBeVisible();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);

  await region.getByRole('button', { name: '2. iteráció: 1' }).click();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(2);
  expect(await transcriptTitles(page)).toEqual([
    expect.stringContaining('Első iteráció sora'),
    expect.stringContaining('Ciklus törzs sora'),
  ]);

  // Az ismételt megnyomás a csomópont minden tételére állít vissza.
  await region.getByRole('button', { name: '2. iteráció: 1' }).click();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);

  await region.getByRole('button', { name: 'A lista bezárása' }).click();
  await expect(region).toBeAttached({ attached: false });
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(RECORDS.length);
});

/**
 * Egy inline `style` attribútum `transform` értéke: a React Flow csomópont
 * doboza ebben hordozza a saját helyét.
 */
function transformOf(style: string | null): string | undefined {
  return /transform:\s*([^;]+)/.exec(style ?? '')?.[1];
}

test('a kattintás után a vászon csak olvasható marad: a csomópont nem lesz kijelölt, és húzásra a helye nem változik (AC19)', async ({
  page,
}) => {
  await openRunView(page);
  const fanNode = nodeLocator(page, 'n-fan');

  await fanNode.click();
  await expect(page.getByRole('region', { name: 'Ágak: Elemek szétosztása' })).toBeVisible();
  await expect(fanNode).not.toHaveClass(/selected/);
  await expect(fanNode).not.toHaveClass(/selectable/);
  await expect(fanNode).not.toHaveClass(/draggable/);

  // A csomópont saját helye az inline `transform` (a React Flow
  // `positionAbsolute` értéke); egy húzás legfeljebb a vásznat pásztázza,
  // ami a nézet transzformációját változtatja, nem a csomópontét.
  const positionBefore = await fanNode.getAttribute('style');
  const box = await fanNode.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem találta a csomópont dobozát');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 5 });
  await page.mouse.up();
  expect(transformOf(await fanNode.getAttribute('style'))).toBe(transformOf(positionBefore));
  await expect(fanNode).not.toHaveClass(/selected/);
});

test('más típusú csomópontra kattintás a transcriptet nem szűkíti', async ({ page }) => {
  await openRunView(page);

  await nodeLocator(page, 'n-start').click();
  await expect(page.getByRole('region', { name: /^(Ágak|Iterációk): / })).toHaveCount(0);
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(RECORDS.length);
});

/**
 * A lista és a transcript panel magassága, és hogy a lista táblája görget-e
 * (`branch-iteration-list.css` "A MAGASSÁG" bekezdése).
 */
async function measureSplit(page: Page): Promise<{
  readonly listHeight: number;
  readonly panelHeight: number;
  readonly isTableScrolling: boolean;
}> {
  return page.evaluate(() => {
    const list = globalThis.document.querySelector('.branch-iteration-list');
    const panel = globalThis.document.querySelector('.run-view-screen__transcript-content > .transcript-panel');
    const table = globalThis.document.querySelector('.branch-iteration-list .data-table-scroll');
    if (list === null || panel === null || table === null) {
      throw new Error('a mérés nem találta a listát, a panelt vagy a táblát');
    }
    return {
      listHeight: list.getBoundingClientRect().height,
      panelHeight: panel.getBoundingClientRect().height,
      isTableScrolling: table.scrollHeight > table.clientHeight,
    };
  });
}

test('rövid listánál a lista a saját magasságát kapja, a maradék a transcripté, a tábla nem görget', async ({
  page,
}) => {
  await openRunView(page);
  await nodeLocator(page, 'n-fan').click();
  await expect(page.getByRole('region', { name: 'Ágak: Elemek szétosztása' })).toBeVisible();

  const split = await measureSplit(page);
  expect(split.isTableScrolling).toBe(false);
  expect(split.listHeight).toBeLessThan(split.panelHeight);
  await expect(transcriptList(page)).toBeVisible();
});

test('hosszú listánál a lista és a transcript egyenlően osztozik, a lista táblája görget, a transcript látszik', async ({
  page,
}) => {
  const manyBranches = Array.from({ length: 30 }, (_unused, index) =>
    stepRun({
      id: `sr-many-${String(index)}`,
      nodeId: 'n-check',
      nodeType: 'human_approval',
      parentStepRunId: 'sr-fan',
      createdAtMs: 100 + index,
    }),
  );
  await openRunView(page, [...STEP_RUNS, ...manyBranches]);
  await nodeLocator(page, 'n-fan').click();
  const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
  await expect(region.getByRole('button', { name: '32. Ellenőrzés' })).toBeAttached();

  const split = await measureSplit(page);
  expect(split.isTableScrolling).toBe(true);
  expect(Math.abs(split.listHeight - split.panelHeight)).toBeLessThanOrEqual(1);
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);
  await expect(transcriptList(page).getByRole('listitem').first()).toBeInViewport({ ratio: 1 });

  // A görgetett táblában az utolsó tétel is elérhető, és ugyanúgy szűkít.
  await region.getByRole('button', { name: '32. Ellenőrzés' }).click();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(0);
  await expect(page.getByText('A kiválasztott tételeknek nincs eseménye.')).toBeVisible();
});

test('a lista oszlopai nem rendezhetők: a fejlécre kattintva is a létrehozási sorrend marad', async ({ page }) => {
  await openRunView(page);
  await nodeLocator(page, 'n-fan').click();
  const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
  const itemButtons = region.getByRole('button', { name: /^\d+\. / });
  await expect(itemButtons).toHaveText(['1. Ellenőrzés', '2. Ellenőrzés']);

  for (const header of ['Tétel', 'Állapot']) {
    const columnHeader = region.getByRole('columnheader', { name: header });
    await columnHeader.click();
    await expect(columnHeader).not.toHaveAttribute('aria-sort');
    await expect(itemButtons).toHaveText(['1. Ellenőrzés', '2. Ellenőrzés']);
  }
});

test('a pillanatképen kívüli csomópontra mutató ág tétele a csomópont azonosítóját viseli (SPEC-003 4.10)', async ({
  page,
}) => {
  // A `step_run.node_id` szándékosan nem idegen kulcs: egy ág lépés futása a
  // pillanatképben nem szereplő csomópontra is mutathat.
  const orphanBranch = stepRun({
    id: 'sr-orphan',
    nodeId: 'n-torolt',
    nodeType: 'human_approval',
    parentStepRunId: 'sr-fan',
    createdAtMs: 9,
  });
  await openRunView(page, [...STEP_RUNS, orphanBranch]);
  await nodeLocator(page, 'n-fan').click();

  const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
  await expect(region.getByRole('button', { name: '3. n-torolt' })).toBeVisible();
  await region.getByRole('button', { name: '3. n-torolt' }).click();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(0);
});
