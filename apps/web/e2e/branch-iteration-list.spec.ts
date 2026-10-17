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
//
// Függő jóváhagyás alatt a lista egyetlen sor magas legördülő (user döntés
// 2026-10-17, "Legördülő jóváhagyáskor", SPEC-008 6.3 és 8. szekció). Az
// ÉLŐBEN érkező és eltűnő jóváhagyás tesztje az egyetlen kivétel a lezárt
// pótlás alól: egy már megnyitott kapcsolatba menet közben beszúrt keret a
// `route.fulfill()` lezárt válaszán nem küldhető, ezért ott a kapcsolat a
// célra írt `node:http` teszt szerveren nyitott (`run-view-stream.ts`
// `startOpenStreamServer`; szabálykönyv 11. szekció, SPEC-007 13.4,
// `docs/research/2026-08-30-sse-mockolas-meres.md`), a REST hívások
// változatlanul `page.route()` mockon mennek.
import type { Server } from 'node:http';
import type {
  NodeConfig,
  PendingApproval,
  RunDetail,
  RunEventRecord,
  RunSnapshotResponse,
  StepRunRecord,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { FIRST_APPROVAL } from './approval-fixture.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { startOpenStreamServer } from './run-view-stream.ts';
import { chooseSelectOption, expectSelectedLabel } from './select-field.ts';
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
 * iterációja, a második törzsében egy elbukott lépéssel (SPEC-004 4.3 és 4.6:
 * a hatókörben futó lépés szülője a hatókört nyitó lépés futás). A második
 * iteráció kiértékelése (`sr-l1`) sikeres, tehát a tétel "sikertelen"
 * jelvénye csak a törzs lépéséből jöhet (user döntés 2026-10-17).
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
    status: 'failed',
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

/**
 * A függő jóváhagyások listája, amit a `listPendingApprovals` mock minden
 * kérésre újraolvas: menet közben átírható.
 */
interface ApprovalListState {
  approvals: readonly PendingApproval[];
}

/**
 * Az üres jóváhagyás lista alapértéke; sosem íródik át.
 */
const NO_APPROVALS: ApprovalListState = { approvals: [] };

/**
 * A futás nézet REST mockjai. A futás rekordja alapból a lezárt futásé; a
 * jóváhagyás tesztjei a még futó futást adják.
 */
async function mockRest(
  page: Page,
  stepRuns: readonly StepRunRecord[],
  approvalState: ApprovalListState = NO_APPROVALS,
  runDetail: RunDetail = RUN_DETAIL,
): Promise<void> {
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetail))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(stepRuns))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody(approvalState.approvals))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

async function mockRun(
  page: Page,
  stepRuns: readonly StepRunRecord[] = STEP_RUNS,
  records: readonly RunEventRecord[] = RECORDS,
): Promise<void> {
  await mockSseFramesWithoutReconnect(page, replayFrames(RUN_ID, records));
  await mockRest(page, stepRuns);
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

test('a fókuszált fan_out és loop csomóponton az Enter és a szóköz ugyanúgy nyitja a listát, mint a kattintás, kijelölés nélkül (O-41, AC19)', async ({
  page,
}) => {
  await openRunView(page);

  const fanNode = nodeLocator(page, 'n-fan');
  await fanNode.focus();
  await expect(fanNode).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Ágak: Elemek szétosztása' })).toBeVisible();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);
  await expect(fanNode).not.toHaveClass(/selected/);

  const loopNode = nodeLocator(page, 'n-loop');
  await loopNode.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Iterációk: Ismétlés' })).toBeVisible();
  await expect(loopNode).not.toHaveClass(/selected/);
  await expect(loopNode).not.toHaveClass(/selectable/);

  // Más típusú csomóponton a billentyű, mint a kattintás, a nézetet nem
  // változtatja: a nyitott lista marad.
  const startNode = nodeLocator(page, 'n-start');
  await startNode.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page.getByRole('region', { name: 'Iterációk: Ismétlés' })).toBeVisible();
  await expect(startNode).not.toHaveClass(/selected/);

  // Más billentyű a fókuszált fan_out csomóponton a listát nem nyitja: csak
  // az Enter és a szóköz aktivál (`find-keyboard-activated-node.ts`).
  await page.getByRole('button', { name: 'A lista bezárása' }).click();
  await fanNode.focus();
  await page.keyboard.press('ArrowDown');
  await expect(fanNode).toBeFocused();
  await expect(page.getByRole('region', { name: /^(Ágak|Iterációk): / })).toHaveCount(0);
});

test('a fan_out csomópontra kattintva kinyílik az ágak listája, egy ágra kattintva a transcript csak annak eseményeit mutatja, a bezárás visszaállít', async ({
  page,
}) => {
  await openRunView(page);

  await nodeLocator(page, 'n-fan').click();
  const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
  await expect(region).toBeVisible();
  // Jóváhagyás nélkül a tábla áll, legördülő nincs (user döntés 2026-10-17).
  await expect(region.getByRole('table')).toBeVisible();
  await expect(region.getByRole('combobox')).toHaveCount(0);
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
  // A felirat a kártya "iteráció: N / M" alakja; a jelvény az iteráció
  // lépéseiből számol, nem a kiértékelés saját (sikeres) állapotából.
  await expect(region.getByRole('row', { name: /iteráció: 0 \/ 5/ }).getByText('sikeres')).toBeVisible();
  await expect(region.getByRole('row', { name: /iteráció: 1 \/ 5/ }).getByText('sikertelen')).toBeVisible();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);

  await region.getByRole('button', { name: 'iteráció: 1 / 5' }).click();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(2);
  expect(await transcriptTitles(page)).toEqual([
    expect.stringContaining('Első iteráció sora'),
    expect.stringContaining('Ciklus törzs sora'),
  ]);

  // Az ismételt megnyomás a csomópont minden tételére állít vissza.
  await region.getByRole('button', { name: 'iteráció: 1 / 5' }).click();
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

test('a lista bezárása után a transcript tiszta lappal indul: a szűkített nézetben feljebb görgetett lista nem jelez új eseményt, és a teljes lista az aljára áll (SPEC-008 6.3)', async ({
  page,
}) => {
  // A szétosztás első ágához annyi sor, hogy a szűkített lista görgessen. Ha
  // a transcript panel a szűkítés váltásakor nem indulna újra, a görgetés
  // követésének állapota (feljebb görgetve: nem követ) átjönne a teljes
  // listára, és a bezáráskor visszatérő sorokat új eseménynek számolná
  // ("Ugrás az aljára (N új esemény)").
  const branchRecords = Array.from({ length: 40 }, (_unused, index) =>
    userTurn(RECORDS.length + 1 + index, 'sr-a', `Első ág ${String(index + 1)}. sora`),
  );
  const records = [...RECORDS, ...branchRecords];
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockRun(page, STEP_RUNS, records);
  await page.goto(`/run?runId=${RUN_ID}`);
  await expect(nodeLocator(page, 'n-fan')).toBeVisible();

  await nodeLocator(page, 'n-fan').click();
  const list = transcriptList(page);
  const filteredRowCount = 3 + branchRecords.length;
  await expect(list.locator(`[role="listitem"][aria-posinset="${String(filteredRowCount)}"]`)).toBeInViewport();

  await list.hover();
  await page.mouse.wheel(0, -10_000);
  await expect(list.locator('[role="listitem"][aria-posinset="1"]')).toBeInViewport({ ratio: 1 });

  await page
    .getByRole('region', { name: 'Ágak: Elemek szétosztása' })
    .getByRole('button', { name: 'A lista bezárása' })
    .click();
  await expect(list.locator(`[role="listitem"][aria-posinset="${String(records.length)}"]`)).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Ugrás az aljára/ })).toHaveCount(0);
});

// ============================================================
// FÜGGŐ JÓVÁHAGYÁS ALATT LEGÖRDÜLŐ (user döntés 2026-10-17, "Legördülő
// jóváhagyáskor", SPEC-008 6.3 és 8. szekció). A korábbi "lista és
// transcript plusz jóváhagyás fele-fele" elrendezés 1440x600-on és
// 1000x700-on egyetlen teljes listasort sem mutatott, és a transcript szinte
// eltűnt (`docs/research/2026-10-17-ag-iteracio-lista.md` 11. szekció).
// ============================================================

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const RUNNING_RUN_DETAIL: RunDetail = { ...RUN_DETAIL, status: 'running', finishedAtMs: null };

/* eslint-enable unicorn/no-null */

/**
 * A szétosztás első ága jóváhagyásra vár; a jóváhagyás ehhez a lépés
 * futáshoz tartozik.
 */
const WAITING_STEP_RUNS: readonly StepRunRecord[] = STEP_RUNS.map((record) =>
  record.id === 'sr-a' ? { ...record, status: 'waiting_approval' } : record,
);

const BRANCH_APPROVAL: PendingApproval = { ...FIRST_APPROVAL, runId: RUN_ID, stepRunId: 'sr-a' };

interface ApprovalLayout {
  readonly viewport: { readonly width: number; readonly height: number };
  /**
   * A fül sáv (telefon): a csomópontra a "Gráf" fülön kell kattintani, a
   * lista és a jóváhagyás a "Transcript" fülön áll.
   */
  readonly isTabbed: boolean;
}

const APPROVAL_LAYOUTS: readonly ApprovalLayout[] = [
  { viewport: { width: 1440, height: 600 }, isTabbed: false },
  { viewport: { width: 1000, height: 700 }, isTabbed: false },
  { viewport: { width: 375, height: 812 }, isTabbed: true },
];

function layoutName(layout: ApprovalLayout): string {
  return `${String(layout.viewport.width)}x${String(layout.viewport.height)}`;
}

function listCombobox(page: Page): Locator {
  return page
    .getByRole('region', { name: 'Ágak: Elemek szétosztása' })
    .getByRole('combobox', { name: 'Ágak: Elemek szétosztása' });
}

/**
 * A látott jóváhagyás kérdése (a cím és a szöveg) és a két gomb teljes
 * egészében látszik (a 2026-09-25-i "a kérdés kifér" szabály, SPEC-008 8.
 * szekció 1. pont).
 */
async function expectQuestionVisible(page: Page): Promise<void> {
  const body = page.locator('.run-view-screen__transcript .approval-prompt-body');
  await expect(body.getByRole('heading', { name: BRANCH_APPROVAL.title })).toBeInViewport({ ratio: 1 });
  await expect(body.getByText(BRANCH_APPROVAL.body, { exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Jóváhagyás', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole('button', { name: 'Elutasítás', exact: true })).toBeInViewport({ ratio: 1 });
}

/**
 * A futás nézet megnyitása és a `fan_out` lista kinyitása a megadott
 * elrendezésben; a fül sávban utána a "Transcript" fülre vált.
 */
async function openFanOutList(page: Page, layout: ApprovalLayout): Promise<void> {
  await page.setViewportSize(layout.viewport);
  await page.goto(`/run?runId=${RUN_ID}`);
  await expect(nodeLocator(page, 'n-fan')).toBeVisible();
  await nodeLocator(page, 'n-fan').click();
  if (layout.isTabbed) {
    await page.getByRole('tab', { name: 'Transcript' }).click();
  }
  await expect(page.getByRole('region', { name: 'Ágak: Elemek szétosztása' })).toBeVisible();
}

for (const layout of APPROVAL_LAYOUTS) {
  test(`${layoutName(layout)}, nyitott lista és függő jóváhagyás: a lista legördülő, látható és használható, szűkít, és a kérdés meg a gombok teljesen látszanak`, async ({
    page,
  }) => {
    await mockSseFramesWithoutReconnect(page, replayFrames(RUN_ID, RECORDS));
    await mockRest(page, WAITING_STEP_RUNS, { approvals: [BRANCH_APPROVAL] }, RUNNING_RUN_DETAIL);
    await openFanOutList(page, layout);

    const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
    const select = listCombobox(page);
    await expect(select).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'A lista bezárása' })).toBeInViewport({ ratio: 1 });
    await expect(region.getByRole('table')).toHaveCount(0);
    await expectSelectedLabel(select, 'Összes ág');
    await expectQuestionVisible(page);
    await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);

    // Az opciók: a csomópont minden ága, utána tételenként a felirat és az
    // állapot jelvényének felirata.
    await select.click();
    await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
      'Összes ág',
      '1. Ellenőrzés, jóváhagyásra vár',
      '2. Ellenőrzés, elutasítva',
    ]);
    await page.keyboard.press('Escape');
    await expect(select).toHaveAttribute('aria-expanded', 'false');

    await chooseSelectOption(page, select, '2. Ellenőrzés, elutasítva');
    await expectSelectedLabel(select, '2. Ellenőrzés, elutasítva');
    await expect(transcriptList(page).getByRole('listitem')).toHaveCount(1);
    expect(await transcriptTitles(page)).toEqual([expect.stringContaining('Második ág sora')]);
    await expectQuestionVisible(page);

    await chooseSelectOption(page, select, 'Összes ág');
    await expect(transcriptList(page).getByRole('listitem')).toHaveCount(3);
  });
}

const streamServerHolder: { current: Server | undefined } = { current: undefined };

test.afterEach(() => {
  // A `closeAllConnections()` KELL a `close()` mellé: a nyitva hagyott SSE
  // kapcsolat egyébként életben tartaná a szervert (és vele a portját) a
  // worker folyamat végéig (`sse-real-server.spec.ts` azonos mintája).
  streamServerHolder.current?.closeAllConnections();
  streamServerHolder.current?.close();
  streamServerHolder.current = undefined;
});

/**
 * Egy élő, futás szintű (lépéshez nem kötött) jóváhagyás lista változás
 * keret: a szűkített transcriptbe nem kerül sor miatta.
 */
function approvalListFrame(id: number, kind: 'approval_requested' | 'approval_decided'): RunEventRecord {
  return makeRunEventRecord(id, RUN_ID, { kind });
}

test('1440x600, élőben érkező és eltűnő jóváhagyásnál a választás és a szűkítés megmarad, és a transcript panel nem szerel le', async ({
  page,
}) => {
  const approvalState: ApprovalListState = { approvals: [] };
  const streamServer = await startOpenStreamServer(page, replayFrames(RUN_ID, RECORDS));
  streamServerHolder.current = streamServer.server;
  await mockRest(page, WAITING_STEP_RUNS, approvalState, RUNNING_RUN_DETAIL);
  await openFanOutList(page, { viewport: { width: 1440, height: 600 }, isTabbed: false });

  const region = page.getByRole('region', { name: 'Ágak: Elemek szétosztása' });
  await region.getByRole('button', { name: '2. Ellenőrzés' }).click();
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(1);
  // A transcript panel DOM eleme megjelölve: ha a panel leszerelne és újra
  // felcsatolódna, az új elemen a jelölés nem állna.
  await page.locator('.transcript-panel').evaluate((element) => {
    element.dataset['e2eMounted'] = 'eredeti';
  });
  const markedPanel = page.locator('.transcript-panel[data-e2e-mounted="eredeti"]');

  approvalState.approvals = [BRANCH_APPROVAL];
  streamServer.push({
    event: 'run_event',
    delivery: 'live',
    runEvent: approvalListFrame(RECORDS.length + 1, 'approval_requested'),
  });
  await expectQuestionVisible(page);
  const select = listCombobox(page);
  await expectSelectedLabel(select, '2. Ellenőrzés, elutasítva');
  await expect(region.getByRole('table')).toHaveCount(0);
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(1);
  expect(await transcriptTitles(page)).toEqual([expect.stringContaining('Második ág sora')]);
  await expect(markedPanel).toHaveCount(1);

  approvalState.approvals = [];
  streamServer.push({
    event: 'run_event',
    delivery: 'live',
    runEvent: approvalListFrame(RECORDS.length + 2, 'approval_decided'),
  });
  await expect(page.getByRole('heading', { name: BRANCH_APPROVAL.title })).toHaveCount(0);
  await expect(region.getByRole('table')).toBeVisible();
  await expect(region.getByRole('combobox')).toHaveCount(0);
  await expect(region.getByRole('button', { name: '2. Ellenőrzés' })).toHaveAttribute('aria-pressed', 'true');
  await expect(transcriptList(page).getByRole('listitem')).toHaveCount(1);
  await expect(markedPanel).toHaveCount(1);
});
