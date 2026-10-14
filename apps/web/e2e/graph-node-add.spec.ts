// A csomópont felvétel két útjának minimális e2e lefedése (PLAN-009 T-009-43,
// SPEC-008 5.8): a "Hozzáadás" gomb menüje és a vászon jobb klikk menüje,
// mindkettőn egy felvétel. A teljes D1 e2e (a két pozíció szabály, a
// csomóponton és élen nem nyíló menü, mindkét téma, az UUID a `PUT` törzsben)
// a T-009-45 lépésé.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { API_ORIGIN } from './api-origin.ts';
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

const ADDABLE_NODE_LABELS = [
  'Agent lépés',
  'Elágazás',
  'Szétosztás',
  'Összefésülés',
  'Ciklus',
  'Emberi jóváhagyás',
  'Hibakezelő',
  'Al-workflow',
  'Szkript',
];

/**
 * Az API origin minden kérése a betöltéstől kezdve: a felvétel helyi művelet,
 * tehát a három betöltő kérés után egy sem jöhet (SPEC-008 78. kritérium).
 */
function recordApiRequests(page: Page): readonly string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(`${API_ORIGIN}/api/`)) {
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return requests;
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a "Hozzáadás" gomb menüje kilenc típust ad, és mindegyik felvett csomópont kiválasztva, a saját panelével kerül fel, kérés nélkül', async ({
  page,
}) => {
  const apiRequests = recordApiRequests(page);
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await expect.poll(() => apiRequests.length).toBe(3);

  const menuTrigger = page.getByRole('button', { name: 'Hozzáadás', exact: true });
  const menu = page.getByRole('menu', { name: 'Hozzáadás' });
  await menuTrigger.click();
  await expect(menu.getByRole('menuitem')).toHaveText(ADDABLE_NODE_LABELS);
  await page.keyboard.press('Escape');

  // Mind a kilenc típus felvétele egymás után: a beállítás panel minden
  // alkalommal a felvett, kiválasztott csomópont típusát mutatja.
  for (const label of ADDABLE_NODE_LABELS) {
    await menuTrigger.click();
    await menu.getByRole('menuitem', { name: label, exact: true }).click();
    await expect(page.getByRole('complementary', { name: `${label} beállításai` })).toBeVisible();
  }

  await expect(page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' })).toBeVisible();
  expect(apiRequests).toHaveLength(3);
});

test('a vászon üres területén jobb klikkre a "Hozzáadás" menü nyílik, és a választott csomópont kiválasztva, nyitott panellel kerül fel, kérés nélkül', async ({
  page,
}) => {
  const apiRequests = recordApiRequests(page);
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await expect.poll(() => apiRequests.length).toBe(3);

  const wrapperBox = await page.getByTestId('rf__wrapper').boundingBox();
  if (wrapperBox === null) {
    throw new Error('a teszt nem találta a vászon dobozát');
  }
  // A vászon bal felső sarkához közeli pont: a `fitView` a csomópontot a
  // vászon közepére illeszti, tehát itt üres terület van.
  await page.mouse.click(wrapperBox.x + 40, wrapperBox.y + 40, { button: 'right' });
  const menu = page.getByRole('menu', { name: 'Hozzáadás' });
  await expect(menu.getByRole('menuitem')).toHaveText(ADDABLE_NODE_LABELS);
  await menu.getByRole('menuitem', { name: 'Elágazás' }).click();

  await expect(menu).toBeHidden();
  await expect(page.getByRole('complementary', { name: 'Elágazás beállításai' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' })).toBeVisible();
  expect(apiRequests).toHaveLength(3);
});
