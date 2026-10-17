// A változtatások elvetésének és az elnavigálás megerősítésének minimális e2e
// lefedése (PLAN-009 T-009-52, SPEC-008 5.10): az elvetés és a visszavonása,
// a belső navigáció megerősítése mindkét gombbal (nyitott modálisnál hatástalan
// visszavonás billentyűvel), és a lap elhagyásának `beforeunload` párbeszéde. A teljes O-22 e2e és a szándékos rontások a
// T-009-53 lépésé.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
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

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

/**
 * A szerkesztő betöltése és egy mentetlen változás: egy "Szkript" csomópont
 * felvétele a lábléc "Hozzáadás" menüjéből.
 */
async function openEditorWithUnsavedNode(page: Page): Promise<void> {
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
  await page.getByRole('menu', { name: 'Hozzáadás' }).getByRole('menuitem', { name: 'Szkript' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
}

test('a "Változtatások elvetése" a betöltött dokumentumra állít, és egy Visszavonás visszahozza', async ({ page }) => {
  await openEditorWithUnsavedNode(page);
  const nodes = page.locator('.react-flow__node');
  const unsavedStatus = page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' });
  await expect(unsavedStatus).toBeVisible();

  await page.getByRole('button', { name: 'További műveletek' }).click();
  await page.getByRole('menuitem', { name: 'Változtatások elvetése' }).click();

  await expect(nodes).toHaveCount(1);
  await expect(unsavedStatus).toBeHidden();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'További műveletek' }).click();
  await expect(page.getByRole('menuitem', { name: 'Változtatások elvetése' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Visszavonás', exact: true }).click();
  await expect(nodes).toHaveCount(2);
  await expect(unsavedStatus).toBeVisible();
});

test('mentetlen változásnál a belső navigáció megerősítést kér: a "Mégse" marad, a "Kilépés mentés nélkül" a célra navigál', async ({
  page,
}) => {
  await openEditorWithUnsavedNode(page);
  const dialog = page.getByRole('dialog', { name: 'Mentetlen változtatások' });

  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(dialog).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/editor');
  // Nyitott megerősítő modálisnál a visszavonás billentyű nem hat (5.10, 4.
  // szabály).
  await page.keyboard.press('Control+z');
  await expect(dialog).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Morzsamenü' }).getByRole('link', { name: 'Workflow-k' }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Kilépés mentés nélkül' }).click();
  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('mentetlen változásnál a lap elhagyása beforeunload párbeszédet ad', async ({ page }) => {
  await openEditorWithUnsavedNode(page);

  const dialogPromise = page.waitForEvent('dialog');
  await page.close({ runBeforeUnload: true });
  const unloadDialog = await dialogPromise;
  expect(unloadDialog.type()).toBe('beforeunload');
  // Az elutasítás után a lap nyitva marad, tehát a lefedettségi fixtúra a
  // teszt végén kiolvashatja.
  await unloadDialog.dismiss();
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});
