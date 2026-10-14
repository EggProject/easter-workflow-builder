// A visszavonás és az újra elvégzés minimális e2e lefedése (PLAN-009 T-009-51,
// SPEC-008 5.10): egy felvétel visszavonása és újra elvégzése billentyűvel és a
// lábléc két gombjával. A hét művelettípus, a mező natív visszavonása, a tipp
// egérrel és a szándékos rontások a T-009-53 lépésé.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
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
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('egy felvétel visszavonása és újra elvégzése billentyűvel és a két gombbal', async ({ page }) => {
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  const nodes = page.locator('.react-flow__node');
  const undoButton = page.getByRole('button', { name: 'Visszavonás', exact: true });
  const redoButton = page.getByRole('button', { name: 'Újra', exact: true });
  const panel = page.getByRole('complementary', { name: 'Szkript beállításai' });
  const unsavedStatus = page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' });
  await expect(undoButton).toBeDisabled();
  await expect(redoButton).toBeDisabled();

  await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
  await page.getByRole('menu', { name: 'Hozzáadás' }).getByRole('menuitem', { name: 'Szkript' }).click();
  await expect(nodes).toHaveCount(2);
  await expect(panel).toBeVisible();
  await expect(undoButton).toBeEnabled();

  // Billentyű: a betöltött állapotig visszavonva a mentetlen jelző eltűnik, a
  // kiválasztás megszűnik; üres listán a billentyű nem változtat.
  await page.keyboard.press('Control+z');
  await expect(nodes).toHaveCount(1);
  await expect(panel).toBeHidden();
  await expect(unsavedStatus).toBeHidden();
  await expect(undoButton).toBeDisabled();
  await page.keyboard.press('Control+z');
  await expect(nodes).toHaveCount(1);

  await page.keyboard.press('Control+y');
  await expect(nodes).toHaveCount(2);
  await expect(panel).toBeHidden();
  await expect(unsavedStatus).toBeVisible();
  await expect(redoButton).toBeDisabled();
  await page.keyboard.press('Control+y');
  await expect(nodes).toHaveCount(2);

  // Gombok, és a második újra elvégző billentyű.
  await undoButton.click();
  await expect(nodes).toHaveCount(1);
  await redoButton.click();
  await expect(nodes).toHaveCount(2);
  await undoButton.click();
  await expect(nodes).toHaveCount(1);
  await page.keyboard.press('Control+Shift+Z');
  await expect(nodes).toHaveCount(2);
});
