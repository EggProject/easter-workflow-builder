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
