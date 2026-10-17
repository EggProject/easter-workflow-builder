// E2E a futás nézet ág kiemelésére, a kapcsoló két módjára és a két
// jelvényre, egy KÉTSZER FUTÓ elágazás fixtúráján (PLAN-009 T-009-40,
// SPEC-008 6.6, 86., 89., 90., 91.).
//
// MIT VÉD.
//   1. A kiemelt él vonala TÉNYLEGESEN ki van festve: a kivágat képe az
//      osztállyal eltér ugyanannak a kivágatnak az osztály nélküli képétől,
//      mindkét témában, a valós futás nézet alakján (a szabálykönyv 11.
//      szekciójának kifestett pixel szabálya, az `edge-paint-measurement.ts`
//      szondájával, memóriában). A számított `stroke` a `--ep-accent` feloldott
//      értéke, a `stroke-width` 2.4, a nem kiemelt élé a React Flow
//      alapértéke (O-26, M-108).
//   2. A két mód különböző élhalmazt emel ki, és újratöltés után a mentett
//      mód marad (90.).
//   3. Az "alapértelmezett ág" jelvény a "minden bejárt" módban is csak a
//      legutóbbi döntést követi (91., O-24).
//   4. A "2. próbálkozás" jelvény a kétszer futó elágazáson áll, a kártya
//      dobozán belül (86.).
//
// A FIXTÚRA. Az elágazásnak két lépés futása van (a második a második
// próbálkozás), és mindkettő hozott egy `branch_taken` döntést. A két forgatókönyv
// csak a döntések sorrendjében tér el: az egyikben a legutóbbi döntés lépett az
// alapértelmezett ágra, a másikban csak a korábbi. Így a "csak a legutóbbi"
// mód a két forgatókönyvben más élt emel ki, a "minden bejárt" mód
// ugyanazt a kettőt, és a jelvény a "minden bejárt" módban is csak a
// legutóbbi döntésen múlik. Minden REST hívás `page.route()` mockon megy, az
// SSE csatorna lezárt `page.route()` válasz (`.claude/CLAUDE.md` 11. szekció).
//
// A KÜSZÖB MÉRT SZÁM, a származtatás és a nyers számok:
// `docs/research/2026-10-14-ag-kiemeles.md`, `## T-009-40` szekció.
import type {
  NodeConfig,
  RunDetail,
  RunEventRecord,
  RunSnapshotResponse,
  StepRunRecord,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { API_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { measureEdgeClassPaintDifference } from './edge-paint-measurement.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { countNodesOutsideCanvas } from './showcase-graph.ts';
import { mockSseFrames, mockSseFramesWithoutReconnect } from './sse-mock.ts';
import { makeRunEventRecord, replayFrames } from './transcript-fixture.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), ugyanaz a minta, mint a `branch-decision-data.spec.ts`-ben */

const VIEWPORT = { width: 1440, height: 900 };

/**
 * A kiemelt él osztálya és a mód tárolási kulcsa, szó szerint a termékkódból
 * (`src/run-graph/build-run-graph-flow-edges.ts`
 * `HIGHLIGHTED_BRANCH_EDGE_CLASS_NAME`, `branch-highlight-mode-storage.ts`
 * `BRANCH_HIGHLIGHT_MODE_STORAGE_KEY`). Az e2e a `src` modulokat nem
 * importálja, ezért itt literál áll.
 */
const HIGHLIGHTED_EDGE_CLASS_NAME = 'run-graph-edge--highlighted';
const MODE_STORAGE_KEY = 'eggRunGraphBranchHighlightMode';

const TOGGLE_NAME = 'Minden bejárt ág kiemelése';

/**
 * A várakozás jelzés elemei (SPEC-008 9. szekció): a nem async pontok (AC94)
 * után egyik sem állhat a lapon.
 */
const BUSY_INDICATOR_SELECTOR = '[aria-busy="true"], .is-loading, .progress-bar, [role="progressbar"], .skel';

/**
 * Az alsó korlát a kiemelt él osztállyal és osztály nélkül készült képének
 * legnagyobb csatorna eltérésére, mindkét témában: a kiemelés nélküli (hibás)
 * és az ép állapot mért tartományának egész felezőpontja. A mérés és a nyers
 * számok: `docs/research/2026-10-14-ag-kiemeles.md`, `## T-009-40` szekció.
 */
const HIGHLIGHT_MINIMUM_CHANNEL_DIFFERENCE = 58;

/**
 * A React Flow szállított él festése, amin a futás nézet nem kiemelt éle marad
 * (`@xyflow/react@12.11.6` `dist/style.css`: `--xy-edge-stroke-default:
 * #b1b1b7`, `--xy-edge-stroke-width-default: 1`), a számított stílus
 * alakjában.
 */
const DEFAULT_EDGE_STROKE = 'rgb(177, 177, 183)';
const DEFAULT_EDGE_STROKE_WIDTH = 1;

/**
 * A kiemelt él vastagsága: a design system `LineChart.jsx` 239. sorának
 * kiemelt sorozat értéke (O-26, `run-graph.css`).
 */
const HIGHLIGHTED_EDGE_STROKE_WIDTH = 2.4;

const START_EDGE_ID = 'ag-e-start';
const YES_EDGE_ID = 'ag-e-igen';
const NO_EDGE_ID = 'ag-e-nem';
const BRANCH_NODE_ID = 'ag-branch';
const START_NODE_ID = 'ag-start';

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

/**
 * Minden elágazás él kulcsos, tehát a kulcs nélküli élek elhagyása (O-27)
 * erre a fixtúrára nem hat.
 */
const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-ag', name: 'Kétszer futó elágazás', description: null },
  nodes: [
    {
      id: START_NODE_ID,
      type: 'start',
      label: 'Indítás',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: BRANCH_NODE_ID,
      type: 'branch',
      label: 'Döntés',
      position: { x: 400, y: 0 },
      config: BRANCH_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'ag-igen',
      type: 'script',
      label: 'Igen ág',
      position: { x: 800, y: -150 },
      config: SCRIPT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'ag-nem',
      type: 'script',
      label: 'Nem ág',
      position: { x: 800, y: 150 },
      config: SCRIPT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [
    {
      id: START_EDGE_ID,
      sourceNodeId: START_NODE_ID,
      targetNodeId: BRANCH_NODE_ID,
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: YES_EDGE_ID,
      sourceNodeId: BRANCH_NODE_ID,
      targetNodeId: 'ag-igen',
      sourceHandle: 'igen',
      targetHandle: null,
      branchKey: 'igen',
    },
    {
      id: NO_EDGE_ID,
      sourceNodeId: BRANCH_NODE_ID,
      targetNodeId: 'ag-nem',
      sourceHandle: 'nem',
      targetHandle: null,
      branchKey: 'nem',
    },
  ],
};

interface BranchTakenPayload {
  readonly branchKey: string | null;
  readonly usedDefault: boolean;
}

interface BranchScenario {
  readonly runId: string;
  readonly records: readonly RunEventRecord[];
  readonly routes: readonly MockRoute[];
}

function stepRun(runId: string, overrides: Partial<StepRunRecord>): StepRunRecord {
  return {
    id: 'sr-start',
    runId,
    nodeId: START_NODE_ID,
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
 * Egy forgatókönyv: a kezdő lépés futás, az elágazás két lépés futása (a
 * második a második próbálkozás), és a két döntés, sorrendben az elsőhöz és a
 * másodikhoz kötve. A futás nézet öt meglévő végpontja mockolva, ugyanúgy, mint
 * a `branch-decision-data.spec.ts`-ben.
 */
function buildScenario(runId: string, decisions: readonly [BranchTakenPayload, BranchTakenPayload]): BranchScenario {
  const stepRuns: readonly StepRunRecord[] = [
    stepRun(runId, {}),
    stepRun(runId, { id: 'sr-branch-1', nodeId: BRANCH_NODE_ID, nodeType: 'branch', createdAtMs: 4 }),
    stepRun(runId, { id: 'sr-branch-2', nodeId: BRANCH_NODE_ID, nodeType: 'branch', attempt: 2, createdAtMs: 6 }),
  ];
  const [first, second] = decisions;
  const records: readonly RunEventRecord[] = [
    makeRunEventRecord(1, runId, { stepRunId: 'sr-start' }),
    makeRunEventRecord(2, runId, { kind: 'branch_taken', stepRunId: 'sr-branch-1', payload: first }),
    makeRunEventRecord(3, runId, { kind: 'branch_taken', stepRunId: 'sr-branch-2', payload: second }),
  ];
  const runDetail: RunDetail = {
    id: runId,
    workflowId: 'w-ag',
    status: 'running',
    input: null,
    providerId: 'claude-subscription',
    rootRunId: runId,
    depth: 0,
    workflowAncestry: ['w-ag'],
    graphSnapshotHash: 'd'.repeat(64),
    persistedStreamDeltas: false,
    restartedFromRunId: null,
    createdAtMs: 1,
    startedAtMs: 2,
    finishedAtMs: null,
    errorKind: null,
    errorMessage: null,
  };
  const routes: readonly MockRoute[] = [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetail))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(stepRuns))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ];
  return { runId, records, routes };
}

/**
 * A legutóbbi döntés az alapértelmezett ágra lépett (a payload kulcsa ilyenkor
 * `null`, a választott kulcs a `defaultBranchKey`, M-106), a korábbi az
 * "igen" ágra.
 */
const LATEST_DEFAULT = buildScenario('run-ag-legutobbi-alap', [
  { branchKey: 'igen', usedDefault: false },
  { branchKey: null, usedDefault: true },
]);

/**
 * Csak a KORÁBBI döntés lépett az alapértelmezett ágra, a legutóbbi az "igen"
 * ágra.
 */
const EARLIER_DEFAULT = buildScenario('run-ag-korabbi-alap', [
  { branchKey: null, usedDefault: true },
  { branchKey: 'igen', usedDefault: false },
]);

/* eslint-enable unicorn/no-null */

/**
 * A rajz és a döntések megérkezésének megvárása, állapot alapon: minden
 * csomópont látható, minden él a DOM-ban van, a transcript utolsó sora a
 * pótlás utolsó eseménye (tehát a döntések kerete is megérkezett), és az
 * elágazás kártyáján a megjelenített lépés futás állapot jelvénye áll (tehát
 * a lépés futás lista is betöltődött, amin a döntés a csomóponthoz kötődik).
 * A várakozás egyik vizsgált jelvényre sem épül, hogy azok rontása csak a
 * saját tesztjét buktassa.
 */
async function waitForBranchRun(page: Page, scenario: BranchScenario): Promise<void> {
  for (const node of SNAPSHOT.nodes) {
    await expect(page.getByTestId(`rf__node-${node.id}`)).toBeVisible();
  }
  for (const edge of SNAPSHOT.edges) {
    await expect(page.getByTestId(`rf__edge-${edge.id}`)).toBeAttached();
  }
  const transcript = page.getByRole('list', { name: 'Futás eseményei' });
  await expect(transcript.getByRole('listitem').last()).toHaveAttribute(
    'aria-posinset',
    String(scenario.records.length),
  );
  await expect(branchCard(page).getByText('sikeres', { exact: true })).toBeVisible();
}

function branchCard(page: Page): Locator {
  return page.getByTestId(`rf__node-${BRANCH_NODE_ID}`);
}

function modeToggle(page: Page): Locator {
  return page.getByRole('button', { name: TOGGLE_NAME });
}

/**
 * A kiemelés osztályát viselő élek azonosítói, a pillanatkép élsorrendjében.
 */
async function readHighlightedEdgeIds(page: Page): Promise<readonly string[]> {
  const ids: string[] = [];
  for (const edge of SNAPSHOT.edges) {
    const isHighlighted = await page
      .getByTestId(`rf__edge-${edge.id}`)
      .evaluate((element, className: string) => element.classList.contains(className), HIGHLIGHTED_EDGE_CLASS_NAME);
    if (isHighlighted) {
      ids.push(edge.id);
    }
  }
  return ids;
}

async function readStoredMode(page: Page): Promise<string | null> {
  return page.evaluate((key: string) => globalThis.localStorage.getItem(key), MODE_STORAGE_KEY);
}

interface ComputedEdgePaint {
  readonly stroke: string;
  readonly strokeWidth: number;
}

/**
 * Az él útvonalának számított festése: a `stroke` szöveg alakja és a
 * `stroke-width` számértéke.
 */
async function readComputedEdgePaint(page: Page, edgeId: string): Promise<ComputedEdgePaint> {
  const paint = await page.evaluate((selector: string) => {
    const element = globalThis.document.querySelector(selector);
    if (element === null) {
      throw new Error(`nincs ilyen él útvonal: ${selector}`);
    }
    const style = globalThis.getComputedStyle(element);
    return { stroke: style.stroke, strokeWidth: style.strokeWidth };
  }, `[data-testid="rf__edge-${edgeId}"] .react-flow__edge-path`);
  return { stroke: paint.stroke, strokeWidth: Number(paint.strokeWidth.replace(/px$/u, '')) };
}

/**
 * A `--ep-accent` token feloldott értéke a vászon környezetében, ugyanabban a
 * számított `stroke` alakban, amiben az él útvonalán megjelenik: egy ideiglenes
 * elem `stroke` tulajdonsága a tokenre áll, és a számított értéke a válasz.
 */
async function readResolvedAccentStroke(page: Page): Promise<string> {
  return page.evaluate(() => {
    const canvas = globalThis.document.querySelector('.run-graph-canvas');
    if (canvas === null) {
      throw new Error('nincs .run-graph-canvas elem');
    }
    const probe = globalThis.document.createElement('div');
    probe.style.stroke = 'var(--ep-accent)';
    canvas.append(probe);
    const resolved = globalThis.getComputedStyle(probe).stroke;
    probe.remove();
    return resolved;
  });
}

/**
 * A teljes gráf beillesztése a látható vászonba a React Flow saját "Fit View"
 * gombjával, hogy minden él kivágata a képernyőn legyen; a záró állítás
 * mérhető (`showcase-graph.ts` `countNodesOutsideCanvas`).
 */
async function fitGraphIntoView(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fit View' }).click();
  await expect.poll(async () => countNodesOutsideCanvas(page)).toBe(0);
}

/**
 * A belső doboz a külsőn belül van-e, mindkét tengelyen.
 */
async function expectBoxInside(inner: Locator, outer: Locator): Promise<void> {
  const innerBox = await inner.boundingBox();
  const outerBox = await outer.boundingBox();
  expect(innerBox).not.toBeNull();
  expect(outerBox).not.toBeNull();
  if (innerBox === null || outerBox === null) {
    return;
  }
  expect(innerBox.x).toBeGreaterThanOrEqual(outerBox.x);
  expect(innerBox.y).toBeGreaterThanOrEqual(outerBox.y);
  expect(innerBox.x + innerBox.width).toBeLessThanOrEqual(outerBox.x + outerBox.width);
  expect(innerBox.y + innerBox.height).toBeLessThanOrEqual(outerBox.y + outerBox.height);
}

async function openScenario(page: Page, scenario: BranchScenario): Promise<void> {
  await page.goto(`/run?runId=${scenario.runId}`);
  await waitForBranchRun(page, scenario);
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`az ág kiemelés kifestése, ${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await mockSseFramesWithoutReconnect(page, replayFrames(LATEST_DEFAULT.runId, LATEST_DEFAULT.records));
      await installApiMocks(page, LATEST_DEFAULT.routes);
      await openScenario(page, LATEST_DEFAULT);
      await fitGraphIntoView(page);
    });

    test('a kiemelt él vonala eltér ugyanannak a kivágatnak az osztály nélküli képétől, mindkét módban', async ({
      page,
    }) => {
      const latestDifference = await measureEdgeClassPaintDifference(page, NO_EDGE_ID, HIGHLIGHTED_EDGE_CLASS_NAME);
      console.log(
        `ág kiemelés ${theme} legutóbbi ${NO_EDGE_ID}: legnagyobb csatorna eltérés ${String(latestDifference)}`,
      );
      expect(latestDifference).toBeGreaterThanOrEqual(HIGHLIGHT_MINIMUM_CHANNEL_DIFFERENCE);

      await modeToggle(page).click();
      await expect(modeToggle(page)).toHaveAttribute('aria-pressed', 'true');
      for (const edgeId of [YES_EDGE_ID, NO_EDGE_ID]) {
        const difference = await measureEdgeClassPaintDifference(page, edgeId, HIGHLIGHTED_EDGE_CLASS_NAME);
        console.log(`ág kiemelés ${theme} minden ${edgeId}: legnagyobb csatorna eltérés ${String(difference)}`);
        expect(difference).toBeGreaterThanOrEqual(HIGHLIGHT_MINIMUM_CHANNEL_DIFFERENCE);
      }

      // Kontroll, állítás nélkül: a kiemelés nélküli élen az osztály levétele
      // semmit nem változtat, ez a raszterezés zaja.
      const control = await measureEdgeClassPaintDifference(page, START_EDGE_ID, HIGHLIGHTED_EDGE_CLASS_NAME);
      console.log(`ág kiemelés ${theme} kontroll ${START_EDGE_ID}: legnagyobb csatorna eltérés ${String(control)}`);
    });

    test('a kiemelt él számított stroke értéke a --ep-accent feloldott értéke és 2.4 vastag, a nem kiemelté a React Flow alapértéke', async ({
      page,
    }) => {
      const accent = await readResolvedAccentStroke(page);
      console.log(`ág kiemelés ${theme} --ep-accent feloldott stroke értéke: ${accent}`);
      await expect
        .poll(async () => readComputedEdgePaint(page, NO_EDGE_ID))
        .toEqual({
          stroke: accent,
          strokeWidth: HIGHLIGHTED_EDGE_STROKE_WIDTH,
        });
      for (const edgeId of [START_EDGE_ID, YES_EDGE_ID]) {
        expect(await readComputedEdgePaint(page, edgeId)).toEqual({
          stroke: DEFAULT_EDGE_STROKE,
          strokeWidth: DEFAULT_EDGE_STROKE_WIDTH,
        });
      }
    });
  });
}

test.describe('a kapcsoló két módja', () => {
  test('a két mód különböző élhalmazt emel ki, és újratöltés után a mentett mód marad', async ({ page }) => {
    // Újracsatlakozó mock: az újratöltés utáni kapcsolat is megkapja a
    // pótlást (`sse-mock.ts`).
    await mockSseFrames(page, replayFrames(LATEST_DEFAULT.runId, LATEST_DEFAULT.records));
    await installApiMocks(page, LATEST_DEFAULT.routes);
    await openScenario(page, LATEST_DEFAULT);

    const toggle = modeToggle(page);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([NO_EDGE_ID]);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([YES_EDGE_ID, NO_EDGE_ID]);
    expect(await readStoredMode(page)).toBe('all');

    await page.reload();
    await waitForBranchRun(page, LATEST_DEFAULT);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([YES_EDGE_ID, NO_EDGE_ID]);

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([NO_EDGE_ID]);
    expect(await readStoredMode(page)).toBe('latest');

    await page.reload();
    await waitForBranchRun(page, LATEST_DEFAULT);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([NO_EDGE_ID]);
  });
});

test.describe('a kapcsoló nem async pont (AC94)', () => {
  test('a kapcsoló megnyomása helyi művelet: nem indít API kérést, és nincs várakozás jelzés', async ({ page }) => {
    // Újracsatlakozás nélküli mock: a lezárt válasz utáni újrapótlás
    // `replay_complete` kerete maga is újratöltést (API kérést) váltana ki, és
    // elfedné, hogy a kérést a kapcsoló indította-e (`sse-mock.ts`).
    await mockSseFramesWithoutReconnect(page, replayFrames(LATEST_DEFAULT.runId, LATEST_DEFAULT.records));
    await installApiMocks(page, LATEST_DEFAULT.routes);
    await openScenario(page, LATEST_DEFAULT);

    const toggle = modeToggle(page);
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([NO_EDGE_ID]);
    await expect(page.locator(BUSY_INDICATOR_SELECTOR)).toHaveCount(0);

    const apiRequestsAfterClick: string[] = [];
    page.on('request', (request) => {
      if (request.url().startsWith(`${API_ORIGIN}/api/`)) {
        apiRequestsAfterClick.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([YES_EDGE_ID, NO_EDGE_ID]);

    expect(apiRequestsAfterClick).toEqual([]);
    await expect(page.locator(BUSY_INDICATOR_SELECTOR)).toHaveCount(0);
  });
});

test.describe('az alapértelmezett ág jelvény', () => {
  test('ha a legutóbbi döntés az alapértelmezett ágra lépett, a jelvény mindkét módban áll', async ({ page }) => {
    await mockSseFramesWithoutReconnect(page, replayFrames(LATEST_DEFAULT.runId, LATEST_DEFAULT.records));
    await installApiMocks(page, LATEST_DEFAULT.routes);
    await openScenario(page, LATEST_DEFAULT);

    const badge = branchCard(page).getByText('alapértelmezett ág');
    await expect(badge).toBeVisible();
    await expectBoxInside(badge, branchCard(page));

    await modeToggle(page).click();
    await expect(modeToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([YES_EDGE_ID, NO_EDGE_ID]);
    await expect(badge).toBeVisible();
  });

  test('ha csak egy korábbi döntés lépett az alapértelmezett ágra, a jelvény a minden bejárt módban sem áll', async ({
    page,
  }) => {
    await mockSseFramesWithoutReconnect(page, replayFrames(EARLIER_DEFAULT.runId, EARLIER_DEFAULT.records));
    await installApiMocks(page, EARLIER_DEFAULT.routes);
    await openScenario(page, EARLIER_DEFAULT);

    const badge = branchCard(page).getByText('alapértelmezett ág');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([YES_EDGE_ID]);
    await expect(badge).toHaveCount(0);

    // A "minden bejárt" mód a korábbi, alapértelmezett döntés élét is
    // kiemeli: a döntés tehát megérkezett és leképeződött, a jelvény mégsem áll.
    await modeToggle(page).click();
    await expect(modeToggle(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => readHighlightedEdgeIds(page)).toEqual([YES_EDGE_ID, NO_EDGE_ID]);
    await expect(badge).toHaveCount(0);
  });
});

test('a kétszer futó elágazáson a próbálkozás jelvény "2. próbálkozás" felirattal, a kártya dobozán belül áll', async ({
  page,
}) => {
  await mockSseFramesWithoutReconnect(page, replayFrames(LATEST_DEFAULT.runId, LATEST_DEFAULT.records));
  await installApiMocks(page, LATEST_DEFAULT.routes);
  await openScenario(page, LATEST_DEFAULT);

  const attemptBadge = branchCard(page).getByText('2. próbálkozás');
  await expect(attemptBadge).toBeVisible();
  await expectBoxInside(attemptBadge, branchCard(page));
  const startCard = page.getByTestId(`rf__node-${START_NODE_ID}`);
  await expect(startCard.getByText('próbálkozás')).toHaveCount(0);
});
