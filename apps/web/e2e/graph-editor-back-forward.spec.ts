// A böngésző vissza és előre gombja mentetlen változásnál (PLAN-009
// T-009-57, SPEC-008 5.10 3. pont, O-30, a 112. kritérium e2e része): a
// `popstate` utáni cím visszaírása, a megerősítő `Modal`, a "Mégse" és a
// "Kilépés mentés nélkül" útja, az előre lépés, mentetlen változás nélkül az
// azonnali váltás, és a másik dokumentumra vezető vissza lépés.
import type {
  RunDetail,
  RunSnapshotResponse,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Ügyfél kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

/**
 * Egy al-workflow futás: a futás nézet morzsasorának "w-alfa" őse az
 * alkalmazáson belüli út a szerkesztőre (`RunViewScreen` ős linkje), tehát a
 * szerkesztő előtti bejegyzés ugyanannak a dokumentumnak a futás nézete.
 */
const CHILD_RUN: RunDetail = {
  id: 'run-child',
  workflowId: 'w-beta',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: 'run-root',
  depth: 1,
  workflowAncestry: ['w-alfa', 'w-beta'],
  graphSnapshotHash: 'c'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const CHILD_SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-beta', name: 'Béta al-workflow', description: null },
  nodes: [
    {
      id: 'b1',
      type: 'start',
      label: 'Al-workflow kezdete',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';
const RUN_URL = '/run?runId=run-child';

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(CHILD_RUN))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(CHILD_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

/**
 * A futás nézetről az al-workflow ős linkjén a szerkesztőre: a két bejegyzés
 * ugyanannak a dokumentumnak a része, tehát a vissza lépés `popstate`-et ad.
 */
async function openEditorFromRunView(page: Page): Promise<void> {
  await page.goto(RUN_URL);
  await page.getByRole('navigation', { name: 'Al-workflow útvonal' }).getByRole('link', { name: 'w-alfa' }).click();
  await expect(page).toHaveURL(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
}

/**
 * Egy mentetlen változás: egy "Szkript" csomópont felvétele a lábléc
 * "Hozzáadás" menüjéből.
 */
async function addUnsavedNode(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
  await page.getByRole('menu', { name: 'Hozzáadás' }).getByRole('menuitem', { name: 'Szkript' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
}

test('mentetlen változásnál a vissza gomb megerősítést kér: a cím a szerkesztőé, a "Mégse" marad, egy újabb vissza és a "Kilépés mentés nélkül" a célra navigál', async ({
  page,
}) => {
  await openEditorFromRunView(page);
  await addUnsavedNode(page);
  const dialog = page.getByRole('dialog', { name: 'Kilépés mentés nélkül?' });
  const unsavedStatus = page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' });

  await page.goBack();

  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(EDITOR_URL);
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(EDITOR_URL);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(unsavedStatus).toBeVisible();

  await page.goBack();

  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(EDITOR_URL);
  await dialog.getByRole('button', { name: 'Kilépés mentés nélkül' }).click();
  await expect(page).toHaveURL(RUN_URL);
  await expect(page.getByRole('navigation', { name: 'Al-workflow útvonal' })).toContainText('Béta al-workflow');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
});

test('mentetlen változásnál az előre gomb is megerősítést kér, és a "Mégse" után az előre lista elvész', async ({
  page,
}) => {
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await addUnsavedNode(page);
  const dialog = page.getByRole('dialog', { name: 'Kilépés mentés nélkül?' });

  await page.goForward();

  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(EDITOR_URL);
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  // A visszaíró `pushState` a jelenlegi bejegyzés utáni bejegyzéseket törli
  // (SPEC-008 M-119): előre lépni nincs hova, tehát a Playwright `null`
  // választ ad, és a cím a szerkesztőé marad.
  expect(await page.goForward()).toBeNull();
  await expect(page).toHaveURL(EDITOR_URL);
  await expect(dialog).toHaveCount(0);
});

test('mentetlen változás nélkül a vissza gomb megerősítés nélkül vált', async ({ page }) => {
  await openEditorFromRunView(page);

  await page.goBack();

  await expect(page).toHaveURL(RUN_URL);
  await expect(page.getByRole('navigation', { name: 'Al-workflow útvonal' })).toContainText('Béta al-workflow');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('a másik dokumentumra vezető vissza lépés nem ad popstate-et: a lap elhagyása a beforeunload párbeszéddel kér megerősítést', async ({
  page,
}) => {
  // Két teljes lapbetöltés: a szerkesztő előtti bejegyzés egy másik dokumentum
  // (SPEC-008 5.10, a 3. pont nem ellenőrzött állítása). A `popstate` jelét a
  // `sessionStorage` őrzi, mert az a dokumentum váltását is túléli.
  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await addUnsavedNode(page);
  await page.evaluate(() => {
    globalThis.addEventListener('popstate', () => {
      globalThis.sessionStorage.setItem('e2e-popstate', 'fired');
    });
  });

  // Az elutasított párbeszéd után a lap marad. A `page.goBack()` a meg nem
  // történt navigációra várna, ezért ezt az ágat a `history.back()` váltja ki.
  const dismissedDialogPromise = page.waitForEvent('dialog');
  await page.evaluate(() => {
    globalThis.history.back();
  });
  const dismissedDialog = await dismissedDialogPromise;
  expect(dismissedDialog.type()).toBe('beforeunload');
  await dismissedDialog.dismiss();
  await expect(page).toHaveURL(EDITOR_URL);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Az elfogadott párbeszéd után a böngésző a másik dokumentumra lép, és a
  // szerkesztő dokumentumában `popstate` nem futott.
  const acceptedDialogTypes: string[] = [];
  page.once('dialog', (dialog) => {
    acceptedDialogTypes.push(dialog.type());
    void dialog.accept();
  });
  await page.goBack();
  expect(acceptedDialogTypes).toEqual(['beforeunload']);
  await expect(page).toHaveURL('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
  expect(await page.evaluate(() => globalThis.sessionStorage.getItem('e2e-popstate'))).toBeNull();
});
