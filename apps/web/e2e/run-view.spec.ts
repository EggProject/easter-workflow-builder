// E2E a futás nézetre (`run-view` és `run-graph` téma, T-009-20, T-009-21).
//
// Miért kell e2e a happy-dom unit tesztek MELLETT: a csak olvasható vászon
// éleit és a csomópontok tényleges kirajzolását happy-dom alatt semmilyen
// körülmények között nem lehet megfigyelni (SPEC-008 12.2, M-53, M-54), és a
// SPEC-008 12.5 ratchet szabálya szerint egy új képernyő nem hagyhat hátra
// fedetlen sort. Minden REST hívás `page.route()` mockon megy, valós backend
// szervert egyetlen teszt sem szólít meg (.claude/CLAUDE.md 11. szekció).
import type { NodeConfig, RunDetail, RunSnapshotResponse, StepRunRecord } from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), ugyanaz a minta, mint a `graph-node-card.spec.ts`-ben */

const START_CONFIG: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

const FAN_OUT_CONFIG: NodeConfig = {
  type: 'fan_out',
  itemsExpression: 'items',
  branchLabelTemplate: '{{item}}',
  onUnhandledError: null,
};

const LOOP_CONFIG: NodeConfig = {
  type: 'loop',
  maxIterations: 5,
  continueExpression: 'i < 5',
  onUnhandledError: null,
};

const SUB_WORKFLOW_CONFIG: NodeConfig = {
  type: 'sub_workflow',
  targetWorkflowId: 'w-child',
  inputMapping: {},
  onUnhandledError: null,
};

const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-parent', name: 'Szülő workflow', description: null },
  nodes: [
    {
      id: 'r-start',
      type: 'start',
      label: 'Futás indítása',
      position: { x: 0, y: 0 },
      config: START_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'r-fan-out',
      type: 'fan_out',
      label: 'Elemek szétosztása',
      position: { x: 500, y: 0 },
      config: FAN_OUT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'r-loop',
      type: 'loop',
      label: 'Ismétlés amíg van elem',
      position: { x: 1000, y: 0 },
      config: LOOP_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'r-sub',
      type: 'sub_workflow',
      label: 'Gyerek workflow futtatása',
      position: { x: 0, y: 300 },
      config: SUB_WORKFLOW_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    // A nulla ágú szétosztás (a lépés futása lefutott, de üres listát adott)
    // és három olyan csomópont, amit a futás MÉG nem ért el: ezek együtt
    // fedik le az összesítés "nincs mit mutatni" ágait (SPEC-008 6.3).
    {
      id: 'r-fan-zero',
      type: 'fan_out',
      label: 'Üres szétosztás',
      position: { x: 500, y: 300 },
      config: FAN_OUT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'r-fan-pending',
      type: 'fan_out',
      label: 'Még nem futott szétosztás',
      position: { x: 1000, y: 300 },
      config: FAN_OUT_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'r-loop-pending',
      type: 'loop',
      label: 'Még nem futott ciklus',
      position: { x: 0, y: 600 },
      config: LOOP_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'r-sub-pending',
      type: 'sub_workflow',
      label: 'Még nem indult al-workflow',
      position: { x: 500, y: 600 },
      config: SUB_WORKFLOW_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [
    {
      id: 'r-e1',
      sourceNodeId: 'r-start',
      targetNodeId: 'r-fan-out',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: 'r-e2',
      sourceNodeId: 'r-fan-out',
      targetNodeId: 'r-loop',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
  ],
};

const RUN_DETAIL: RunDetail = {
  id: 'run-2',
  workflowId: 'w-parent',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: 'run-1',
  depth: 2,
  workflowAncestry: ['w-root', 'w-middle', 'w-parent'],
  graphSnapshotHash: 'b'.repeat(64),
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
  runId: 'run-2',
  nodeId: 'r-start',
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
 * A futás lépés futásai: a `fan_out` sor kimenete a kiértékelt elemlista
 * (ebből jön az ág darabszám), a hatókörében két sikeres és egy bukott lépés
 * fut, a `loop` a második iterációnál tart, a `sub_workflow` pedig elindított
 * egy gyerek futást. Az utolsó sor SZÁNDÉKOSAN olyan csomópontra hivatkozik,
 * ami a pillanatképben nincs benne (a `step_run.node_id` nem idegen kulcs,
 * SPEC-003 4.10).
 */
const STEP_RUNS: readonly StepRunRecord[] = [
  BASE_STEP_RUN,
  { ...BASE_STEP_RUN, id: 'sr-fan', nodeId: 'r-fan-out', nodeType: 'fan_out', output: ['a', 'b', 'c'] },
  {
    ...BASE_STEP_RUN,
    id: 'sr-branch-1',
    nodeId: 'r-loop',
    nodeType: 'loop',
    parentStepRunId: 'sr-fan',
    iteration: 1,
    createdAtMs: 4,
  },
  {
    ...BASE_STEP_RUN,
    id: 'sr-branch-2',
    nodeId: 'r-loop',
    nodeType: 'loop',
    parentStepRunId: 'sr-fan',
    iteration: 2,
    status: 'running',
    createdAtMs: 5,
  },
  {
    ...BASE_STEP_RUN,
    id: 'sr-branch-3',
    nodeId: 'r-loop',
    nodeType: 'loop',
    parentStepRunId: 'sr-fan',
    iteration: 2,
    status: 'failed',
    createdAtMs: 3,
  },
  { ...BASE_STEP_RUN, id: 'sr-sub', nodeId: 'r-sub', nodeType: 'sub_workflow', subWorkflowRunId: 'run-9' },
  { ...BASE_STEP_RUN, id: 'sr-fan-zero', nodeId: 'r-fan-zero', nodeType: 'fan_out', output: [] },
  { ...BASE_STEP_RUN, id: 'sr-orphan', nodeId: 'r-torolt', nodeType: 'agent_step', status: 'failed' },
];

/**
 * Egy szándékosan hibás alakú pillanatkép: a `loop` config `maxIterations`
 * mezője hiányzik. A `graph_snapshot` sor megváltoztathatatlan (SPEC-003
 * 5.5), tehát egy régebbi séma szerint írt pillanatkép valóban elbukhat a mai
 * ellenőrzésen; a felület ilyenkor a hibás mező ÚTVONALÁT nevezi meg.
 */
const INVALID_SNAPSHOT = {
  ...SNAPSHOT,
  nodes: [
    {
      id: 'r-loop',
      type: 'loop',
      label: 'Ismétlés',
      position: { x: 0, y: 0 },
      config: { type: 'loop', continueExpression: 'i < 5', onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

/* eslint-enable unicorn/no-null */

const RUN_URL = '/run?runId=run-2';

interface RunViewMocks {
  readonly snapshot?: unknown;
  readonly snapshotStatus?: number;
}

async function mockRun(page: Page, overrides: RunViewMocks = {}): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) =>
      route.fulfill(jsonBody(overrides.snapshot ?? SNAPSHOT, overrides.snapshotStatus ?? 200)),
    ),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    // A futás nézet a SAJÁT futására iratkozik fel az app szintű stream
    // kapcsolaton (T-009-23): enélkül a hívás a `installApiMocks` "nincs mock"
    // 404-esére futna.
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

/**
 * Lásd a `graph-node-card.spec.ts` `nodeLocator` doksiját: a `getByTestId`
 * kizárólag a React Flow saját, dokumentált `rf__` előtagú fogódzójára áll
 * (SPEC-008 12.3 locator kivétel).
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

test('a fejléc kimondja, hogy a rajz pillanatkép, és megnevezi az SDK verziót', async ({ page }) => {
  await mockRun(page);
  await page.goto(RUN_URL);

  await expect(nodeLocator(page, 'r-start')).toBeVisible();
  await expect(page.getByText('A rajz a futás pillanatképe')).toBeVisible();
  await expect(page.getByText(SNAPSHOT.sdkVersionPin)).toBeVisible();
});

test('a fejléc morzsasora a workflowAncestry több szintjéből épül, saját hozzáférhető névvel', async ({ page }) => {
  await mockRun(page);
  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-start')).toBeVisible();

  // Két külön morzsasor áll a lapon: az útvonalé a topnav alatt, az
  // al-workflow hierarchiáé a képernyő fejlécében. A W3C APG landmark
  // mintája szerint mindkettőnek egyedi neve van, tehát a locator sem
  // kétértelmű.
  const ancestry = page.getByRole('navigation', { name: 'Al-workflow útvonal' });
  await expect(ancestry.getByRole('link', { name: 'w-root' })).toBeVisible();
  await expect(ancestry.getByRole('link', { name: 'w-middle' })).toBeVisible();
  await expect(ancestry.getByText('Szülő workflow')).toBeVisible();

  await ancestry.getByRole('link', { name: 'w-middle' }).click();
  await expect(page).toHaveURL(/\/editor\?workflowId=w-middle$/);
});

test('a vászon csak olvasható: a csomópont nem húzható és nem kiválasztható', async ({ page }) => {
  await mockRun(page);
  await page.goto(RUN_URL);

  const startNode = nodeLocator(page, 'r-start');
  await expect(startNode).toBeVisible();
  // Az él VALÓS kirajzolása kizárólag e2e-vel figyelhető meg (M-53, M-54). Az
  // állítás `toBeAttached()`, nem `toBeVisible()`: egy VÍZSZINTES él befoglaló
  // doboza nulla magas, amire a `toBeVisible()` hamis bukást ad (a
  // `graph-edge-stroke.spec.ts` fejléc komment 2. pontja ezt mérten leírja).
  await expect(page.getByTestId('rf__edge-r-e1')).toBeAttached();

  // A `nodesDraggable` és az `elementsSelectable` KIRAJZOLT következménye, a
  // könyvtár saját osztálylistája szerint (`@xyflow/react`
  // `dist/esm/index.mjs`: a node `draggable` és `selectable` osztálya az
  // `isDraggable`/`isSelectable` értéktől függ). Húzás szimulálása helyett ez
  // a mérés, mert `nodesDraggable={false}` mellett a node a `nopan` osztályt
  // sem kapja meg, tehát a rajta kezdett húzás a VÁSZNAT pásztázná, és a
  // csomópont befoglaló doboza emiatt mozdulna el.
  //
  // A `nodesConnectable` propnak NINCS ilyen kirajzolt nyoma: a `Handle`
  // komponens saját `isConnectable` propja `true` alapértékű, és a mérés
  // szerint a `connectable` osztály a `nodesConnectable={false}` mellett is
  // kikerül a handle-re. Ezt a propot ezért a unit teszt igazolja, közvetlenül
  // a `<ReactFlow>` propján (`RunGraphCanvas.spec.tsx`).
  await expect(startNode).not.toHaveClass(/draggable/);
  await expect(startNode).not.toHaveClass(/selectable/);
});

test('a fan_out és a loop csomópont összesítést mutat, a sub_workflow gombja pedig másik futásra navigál', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockRun(page);
  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-fan-out')).toBeVisible();

  // Három elem a `fan_out` kimeneti listájából, a hatókörében két sikeres
  // (`sr-branch-1`, `sr-branch-3` bukott) lépés futással.
  await expect(nodeLocator(page, 'r-fan-out').getByText('3 ág, 1 sikeres, 1 sikertelen')).toBeVisible();
  await expect(nodeLocator(page, 'r-loop').getByText('iteráció: 2 / 5')).toBeVisible();

  await nodeLocator(page, 'r-sub').getByRole('button', { name: 'Al-workflow futás megnyitása' }).click();
  await expect(page).toHaveURL(/\/run\?runId=run-9$/);
});

test('a nulla ágú szétosztás kimondott feliratot kap, a még nem futott csomópontoknak nincs összesítése', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockRun(page);
  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-fan-zero')).toBeVisible();

  await expect(nodeLocator(page, 'r-fan-zero').getByText('nulla ág', { exact: false })).toBeVisible();
  // A futás által még el nem ért csomópontokon nincs összesítő sor és nincs
  // al-workflow gomb: nincs mit mutatni, nem is találgatunk.
  for (const nodeId of ['r-fan-pending', 'r-loop-pending', 'r-sub-pending']) {
    await expect(nodeLocator(page, nodeId).locator('.graph-node-card__summary')).toHaveCount(0);
    await expect(nodeLocator(page, nodeId).getByRole('button')).toHaveCount(0);
  }
});

test('a pillanatképpel nem párosítható lépés futás a gráf alatt, listás alakban jelenik meg', async ({ page }) => {
  await mockRun(page);
  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-start')).toBeVisible();

  const section = page.getByRole('region', { name: 'A rajzon nem szereplő lépés futások' });
  await expect(section.getByText('r-torolt')).toBeVisible();
  await expect(section.getByRole('listitem')).toHaveCount(1);
});

test('érvénytelen alakú pillanatképre a hibás mező útvonalát mutatja, rajz nélkül', async ({ page }) => {
  await mockRun(page, { snapshot: INVALID_SNAPSHOT });
  await page.goto(RUN_URL);

  await expect(page.getByRole('alert')).toContainText('maxIterations');
  await expect(page.getByTestId('rf__wrapper')).toHaveCount(0);
});

test('a pillanatkép betöltésének hibájára a hibaüzenetet mutatja', async ({ page }) => {
  await mockRun(page, { snapshot: { code: 'not_found', message: 'nincs ilyen futás' }, snapshotStatus: 404 });
  await page.goto(RUN_URL);

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('rf__wrapper')).toHaveCount(0);
});

// ============================================================
// AZ OSZTOTT ELRENDEZÉS ÉS A HÁROM RESZPONZÍV SÁV (T-009-22, AC33, AC34).
//
// A sáv váltás kizárólag valódi böngészőben figyelhető meg: a `matchMedia`
// tényleges illeszkedése a layout viewporton múlik, amit happy-dom alatt nem
// a termékkód, hanem a környezet dönt el. A sáv ELRENDEZÉSÉT unit teszt fedi
// (`RunViewLayout.spec.tsx`), a sáv VÁLASZTÁST pedig ez.
//
// A viewport szélességek a design system `breakpoints.css` tokenjeiből
// olvasva, nem beírva - ugyanaz a módszer, mint a `responsive.spec.ts`
// fájlban. Az elválasztó húzása pointer eseménnyel és a billentyűs mozgatás a
// PLAN-009 T-009-29 hatóköre.
// ============================================================

const BREAKPOINTS_CSS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'design-token',
  'breakpoints.css',
);

function breakpointTokenValue(tokenName: string): number {
  const content = readFileSync(BREAKPOINTS_CSS_PATH, 'utf8');
  const match = new RegExp(String.raw`${tokenName}:\s*(\d+)px`).exec(content);
  if (match?.[1] === undefined) {
    throw new Error(`A ${tokenName} token nem található a breakpoints.css fájlban.`);
  }
  return Number(match[1]);
}

const LARGE_SCREEN_WIDTH = breakpointTokenValue('--ep-screen-lg');
const MEDIUM_SCREEN_WIDTH = breakpointTokenValue('--ep-screen-md');
const RUN_VIEW_VIEWPORT_HEIGHT = 900;

const RUN_VIEW_LAYOUT_STORAGE_KEY = 'eggRunViewLayout';

function separatorLocator(page: Page): Locator {
  return page.getByRole('separator', { name: 'A Gráf és a Transcript aránya' });
}

test('a --ep-screen-lg token szélességén és fölötte a gráf és a transcript egymás mellett áll', async ({ page }) => {
  await mockRun(page);
  for (const width of [LARGE_SCREEN_WIDTH, LARGE_SCREEN_WIDTH + 1]) {
    await test.step(`viewport szélesség: ${String(width)}px`, async () => {
      await page.setViewportSize({ width, height: RUN_VIEW_VIEWPORT_HEIGHT });
      await page.goto(RUN_URL);
      await expect(nodeLocator(page, 'r-start')).toBeVisible();

      // Az elválasztó `aria-orientation` értéke a MÉRT bizonyíték a
      // vízszintes osztásra: a W3C Window Splitter minta szerint egy
      // egymás MELLETTI panelpárt elválasztó separator orientációja
      // "vertical".
      await expect(separatorLocator(page)).toHaveAttribute('aria-orientation', 'vertical');
      await expect(page.getByRole('tablist', { name: 'Futás nézet' })).toHaveCount(0);

      // A két panel TÉNYLEGESEN egymás mellett van: a transcript bal széle a
      // gráf jobb széle után kezdődik, és a felső élük egy vonalban van.
      const graphBox = await page.locator('.run-view-screen__graph').boundingBox();
      const transcriptBox = await page.locator('.run-view-screen__transcript').boundingBox();
      if (graphBox === null || transcriptBox === null) {
        throw new Error('hiányzó befoglaló doboz az osztott elrendezésen');
      }
      expect(transcriptBox.x).toBeGreaterThanOrEqual(graphBox.x + graphBox.width);
      expect(Math.abs(transcriptBox.y - graphBox.y)).toBeLessThanOrEqual(1);
    });
  }
});

test('a --ep-screen-md és a --ep-screen-lg között a gráf és a transcript egymás alatt áll', async ({ page }) => {
  await mockRun(page);
  for (const width of [MEDIUM_SCREEN_WIDTH, LARGE_SCREEN_WIDTH - 1]) {
    await test.step(`viewport szélesség: ${String(width)}px`, async () => {
      await page.setViewportSize({ width, height: RUN_VIEW_VIEWPORT_HEIGHT });
      await page.goto(RUN_URL);
      await expect(nodeLocator(page, 'r-start')).toBeVisible();

      await expect(separatorLocator(page)).toHaveAttribute('aria-orientation', 'horizontal');
      await expect(page.getByRole('tablist', { name: 'Futás nézet' })).toHaveCount(0);

      const graphBox = await page.locator('.run-view-screen__graph').boundingBox();
      const transcriptBox = await page.locator('.run-view-screen__transcript').boundingBox();
      if (graphBox === null || transcriptBox === null) {
        throw new Error('hiányzó befoglaló doboz az osztott elrendezésen');
      }
      expect(transcriptBox.y).toBeGreaterThanOrEqual(graphBox.y + graphBox.height);
      expect(Math.abs(transcriptBox.x - graphBox.x)).toBeLessThanOrEqual(1);
    });
  }
});

test('a --ep-screen-md alatt fülek állnak, egyszerre egy nézettel, elválasztó nélkül', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: MEDIUM_SCREEN_WIDTH - 1, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await page.goto(RUN_URL);

  const tabList = page.getByRole('tablist', { name: 'Futás nézet' });
  await expect(tabList).toBeVisible();
  await expect(separatorLocator(page)).toHaveCount(0);

  const graphTab = page.getByRole('tab', { name: 'Gráf' });
  const transcriptTab = page.getByRole('tab', { name: 'Transcript' });
  await expect(graphTab).toHaveAttribute('aria-selected', 'true');
  await expect(transcriptTab).toHaveAttribute('aria-selected', 'false');
  await expect(page.getByText('A futás eseményei itt jelennek meg.')).toBeHidden();

  await transcriptTab.click();
  await expect(transcriptTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('A futás eseményei itt jelennek meg.')).toBeVisible();
  // A gráf panelje FELCSATOLVA marad, csak rejtett: a natív `hidden`
  // attribútum rejti, tehát a vászon állapota nem veszik el.
  await expect(page.getByTestId('rf__wrapper')).toBeAttached();
});

test('a viewport szűkülése menet közben átváltja a sávot', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await page.goto(RUN_URL);
  await expect(separatorLocator(page)).toHaveAttribute('aria-orientation', 'vertical');

  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH - 1, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await expect(separatorLocator(page)).toHaveAttribute('aria-orientation', 'horizontal');

  await page.setViewportSize({ width: MEDIUM_SCREEN_WIDTH - 1, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await expect(page.getByRole('tablist', { name: 'Futás nézet' })).toBeVisible();
  await expect(separatorLocator(page)).toHaveCount(0);
});

/**
 * A tárolt arány beültetése a lap betöltése ELŐTT. `addInitScript`, nem
 * `evaluate`: a `localStorage` olvasása a komponens csatolásakor, az első
 * renderen történik, tehát egy betöltés utáni írás már nem hatna. Az
 * `addInitScript` minden navigációra újra lefut, ezért tesztenként EGY
 * beültetés áll (egy `reload` a beültetett értéket írná vissza).
 */
async function seedStoredLayout(page: Page, storedValue: string): Promise<void> {
  await page.addInitScript(
    ([key, value]: readonly string[]) => {
      globalThis.localStorage.setItem(key ?? '', value ?? '');
    },
    [RUN_VIEW_LAYOUT_STORAGE_KEY, storedValue],
  );
}

test('az elrendezés aránya a localStorage-ből töltődik vissza', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await seedStoredLayout(page, JSON.stringify([45, 55]));

  await page.goto(RUN_URL);
  await expect(separatorLocator(page)).toHaveAttribute('aria-valuenow', '45');
});

test('hibás alakú tárolt arányra az alapértelmezés áll be, és az íródik vissza', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await seedStoredLayout(page, JSON.stringify({ graph: 45 }));

  await page.goto(RUN_URL);
  await expect(separatorLocator(page)).toHaveAttribute('aria-valuenow', '70');
  // A `Resizable` kezdő értesítése a helyes alakot írja vissza a tárolóba.
  await expect
    .poll(async () => page.evaluate((key: string) => globalThis.localStorage.getItem(key), RUN_VIEW_LAYOUT_STORAGE_KEY))
    .toBe('[70,30]');
});

test('letiltott tárolás esetén az alapértelmezés áll be, a felület nem tör el', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });

  // A privát ablak / letiltott tárolás esete a böngészőben: KIZÁRÓLAG a futás
  // nézet kulcsának olvasása dob, minden más kulcs (pl. a téma váltó
  // `eggTheme` kulcsa) változatlanul működik. Ez a `run-view-layout.spec.ts`
  // `withThrowingLocalStorage` segédfüggvényének böngészőbeli párja: a
  // `try`/`catch` ág e2e alatt csak így futtatható, mert a `localStorage`
  // dobó viselkedését a Playwright nem tudja kívülről beállítani.
  await page.addInitScript((key: string) => {
    const storage = globalThis.localStorage;
    const originalGetItem = storage.getItem.bind(storage);
    storage.getItem = (name: string): ReturnType<Storage['getItem']> => {
      if (name === key) {
        throw new Error('a tárolás le van tiltva');
      }
      return originalGetItem(name);
    };
  }, RUN_VIEW_LAYOUT_STORAGE_KEY);

  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-start')).toBeVisible();
  await expect(separatorLocator(page)).toHaveAttribute('aria-valuenow', '70');
});

/**
 * Regresszió a T-009-23 él esetére: a kézzel húzott arány NEM veszhet el, ha
 * a nézet a fül sávba, majd vissza megy. A `Resizable` a fül sávban
 * LESZEREL (a `Tabs` a másik ágat rajzolja), és visszaváltáskor a
 * `defaultSizes` propból épül újra a kezdő állapota
 * (`RunViewLayout.tsx` fejléc komment). Ha a hívó oldal ezt a propot
 * CSATOLÁSKOR egyszer olvasott `useState` értékben tartaná, a
 * visszacsatolás a RÉGI (a húzás előtti) arányt adná vissza, mert a
 * `storeRunViewLayoutSizes` írása nem frissíti azt az állapotot.
 *
 * A teszt előbb billentyűzettel húz (`ResizableHandle` `ARROW_STEP_PERCENT`
 * értéke 5, tehát három `ArrowLeft` 70-ről 55-re viszi a bal panelt, lásd
 * `packages/ui/src/resizable/ResizableHandle.tsx`), majd a `--ep-screen-md`
 * alá szűkítve fül sávba vált (az elválasztó eltűnik), végül visszaáll
 * `--ep-screen-lg`-re, és a húzott arány megmaradását ellenőrzi.
 */
test('a fül sávba váltás után visszaváltva a kézzel húzott arány megmarad (T-009-23 regresszió)', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-start')).toBeVisible();

  const separator = separatorLocator(page);
  await expect(separator).toHaveAttribute('aria-valuenow', '70');

  await separator.focus();
  await separator.press('ArrowLeft');
  await separator.press('ArrowLeft');
  await separator.press('ArrowLeft');
  await expect(separator).toHaveAttribute('aria-valuenow', '55');
  await expect
    .poll(async () => page.evaluate((key: string) => globalThis.localStorage.getItem(key), RUN_VIEW_LAYOUT_STORAGE_KEY))
    .toBe('[55,45]');

  // Fül sávba váltás: a `Resizable` leszerel, az elválasztó eltűnik.
  await page.setViewportSize({ width: MEDIUM_SCREEN_WIDTH - 1, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await expect(page.getByRole('tablist', { name: 'Futás nézet' })).toBeVisible();
  await expect(separator).toHaveCount(0);

  // Vissza a horizontális sávba: a `Resizable` újracsatlakozik, a MENTETT
  // aránnyal, nem az eredeti alapértelmezéssel.
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await expect(separatorLocator(page)).toHaveAttribute('aria-valuenow', '55');
});

test('a tartalom terület magassága a viewport és a bar magasságából számít, üres sáv nélkül', async ({ page }) => {
  await mockRun(page);
  await page.setViewportSize({ width: LARGE_SCREEN_WIDTH, height: RUN_VIEW_VIEWPORT_HEIGHT });
  await page.goto(RUN_URL);
  await expect(nodeLocator(page, 'r-start')).toBeVisible();

  const measurement = await page.evaluate(() => {
    function heightOf(selector: string): number {
      const element = globalThis.document.querySelector(selector);
      if (element === null) {
        throw new Error(`a mérés nem találta a ${selector} elemet`);
      }
      return element.getBoundingClientRect().height;
    }
    const content = globalThis.document.querySelector('.app-content');
    if (content === null) {
      throw new Error('a mérés nem találta az .app-content elemet');
    }
    const contentStyle = globalThis.getComputedStyle(content);
    return {
      viewportHeight: globalThis.innerHeight,
      barHeight: heightOf('.app-tn__bar'),
      pageHeadHeight: heightOf('.app-pagehead'),
      contentHeight: heightOf('.app-content'),
      contentPaddingBottom: contentStyle.paddingBottom,
      screenBottom: globalThis.document.querySelector('.run-view-screen')?.getBoundingClientRect().bottom ?? 0,
    };
  });

  // A lánc: `.app-tn { height: 100vh }`, a bar fix magasságú, a maradékot a
  // flex osztja. Kitalált szám nincs a futás nézet CSS-ében: a magasságot ez
  // az egyenlőség adja.
  expect(measurement.barHeight + measurement.pageHeadHeight + measurement.contentHeight).toBeCloseTo(
    measurement.viewportHeight,
    0,
  );
  // A screen a tartalom terület ALJÁIG ér: a görgetett listákra szánt 80px
  // alsó belső margó ezen a screen-en nulla (SPEC-008 10. "faltól falig").
  expect(measurement.contentPaddingBottom).toBe('0px');
  expect(measurement.screenBottom).toBeCloseTo(measurement.viewportHeight, 0);
});
