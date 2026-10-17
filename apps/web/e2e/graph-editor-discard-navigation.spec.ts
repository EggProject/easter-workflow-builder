// A változtatások elvetésének és az elnavigálás megerősítésének e2e lefedése
// (PLAN-009 T-009-52, T-009-53, SPEC-008 5.10, 104. és 105. kritérium): az
// elvetés helye a menüben és a visszavonása, a belső navigáció megerősítése a
// felső navigáció és a morzsamenü linkjén mindkét gombbal (nyitott modálisnál
// hatástalan visszavonás billentyűvel), mentetlen változás nélkül modális nélkül,
// és a lap elhagyásának `beforeunload` párbeszéde a bezárásra, az újratöltésre és
// a kézzel beírt címre, mentetlen változás nélkül párbeszéd nélkül. Az elvetés
// visszavonása és újra elvégzése mind az öt úton a
// `graph-editor-undo-operations.spec.ts` fájlban áll.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { API_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';
import { WINDOWS_CHROME_USER_AGENT } from './user-agent.ts';

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

/**
 * A várakozás jelzés elemei (SPEC-008 9. szekció): a nem async pontok (AC94)
 * után egyik sem állhat a lapon.
 */
const BUSY_INDICATOR_SELECTOR = '[aria-busy="true"], .is-loading, .progress-bar, [role="progressbar"], .skel';

// A fájl a `Ctrl` módosítót méri: az Automatikus beállítás a felhasználói
// ügynökből old fel (SPEC-008 5.10, O-31), ezért az ügynök nem macOS értékre
// van rögzítve.
test.use({ userAgent: WINDOWS_CHROME_USER_AGENT });

async function installEditorMocks(target: Page): Promise<void> {
  await mockIdleStream(target);
  await installApiMocks(target, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await target.setViewportSize({ width: 1440, height: 900 });
}

test.beforeEach(async ({ page }) => {
  await installEditorMocks(page);
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
  const dialog = page.getByRole('dialog', { name: 'Kilépés mentés nélkül?' });

  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('A mentetlen változtatások elvesznek.')).toBeVisible();
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

test('az elnavigálás megerősítése nem async pont: a modális megnyitása és a "Mégse" nem indít API kérést, és nincs várakozás jelzés (AC94)', async ({
  page,
}) => {
  await openEditorWithUnsavedNode(page);
  const dialog = page.getByRole('dialog', { name: 'Kilépés mentés nélkül?' });
  const busyIndicators = page.locator(BUSY_INDICATOR_SELECTOR);
  await expect(busyIndicators).toHaveCount(0);

  // A felvétel utáni állapottól számolva: a betöltés kérései már lezajlottak.
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(`${API_ORIGIN}/api/`)) {
      apiRequests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });

  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(dialog).toBeVisible();
  expect(apiRequests).toEqual([]);
  await expect(busyIndicators).toHaveCount(0);

  await dialog.getByRole('button', { name: 'Mégse', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  expect(apiRequests).toEqual([]);
  await expect(busyIndicators).toHaveCount(0);
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

test('a "Változtatások elvetése" a split button menüjében az "Elrendezés" után áll', async ({ page }) => {
  await openEditorWithUnsavedNode(page);
  await page.getByRole('button', { name: 'További műveletek' }).click();
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Elrendezés', 'Változtatások elvetése']);
  await expect(page.getByRole('menuitem', { name: 'Változtatások elvetése' })).toBeEnabled();
});

// A két link és a két gomb hiányzó párosítása (a fenti teszt a felső navigációt
// a "Mégse", a morzsamenüt a "Kilépés mentés nélkül" gombbal méri).
const NAVIGATION_CASES = [
  {
    name: 'a felső navigáció linkje és a "Kilépés mentés nélkül"',
    link: (page: Page) => page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }),
    button: 'Kilépés mentés nélkül',
    expectedPathname: '/runs',
  },
  {
    name: 'a morzsamenü linkje és a "Mégse"',
    link: (page: Page) =>
      page.getByRole('navigation', { name: 'Morzsamenü' }).getByRole('link', { name: 'Workflow-k' }),
    button: 'Mégse',
    expectedPathname: '/editor',
  },
] as const;

for (const navigation of NAVIGATION_CASES) {
  test(`mentetlen változásnál ${navigation.name}: a cím a döntésig nem változik`, async ({ page }) => {
    await openEditorWithUnsavedNode(page);
    const dialog = page.getByRole('dialog', { name: 'Kilépés mentés nélkül?' });

    await navigation.link(page).click();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/editor\?workflowId=w-alfa$/);
    await dialog.getByRole('button', { name: navigation.button, exact: true }).click();

    await expect(dialog).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe(navigation.expectedPathname);
    if (navigation.expectedPathname === '/editor') {
      await expect(page.locator('.react-flow__node')).toHaveCount(2);
      await expect(page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' })).toBeVisible();
    } else {
      await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
    }
  });
}

test('mentetlen változás nélkül a belső navigáció modális nélkül, azonnal megtörténik, a visszavont változás után is', async ({
  page,
}) => {
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(page).toHaveURL(/\/runs$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A betöltött állapotig visszavont változás után sincs mentetlen változás.
  await openEditorWithUnsavedNode(page);
  await page.keyboard.press('Control+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await page.getByRole('navigation', { name: 'Morzsamenü' }).getByRole('link', { name: 'Workflow-k' }).click();
  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('mentetlen változás nélkül a lap bezárása beforeunload párbeszéd nélkül zár, a visszavont változás után is', async ({
  page,
}) => {
  // Külön lap, mert a bezárt lapról a lefedettségi fixtúra nem olvashat; a
  // felvétel és a visszavonás felhasználói interakció, tehát a böngésző
  // párbeszédének feltétele (sticky activation, M-114) teljesül.
  const secondPage = await page.context().newPage();
  await installEditorMocks(secondPage);
  await openEditorWithUnsavedNode(secondPage);
  await secondPage.keyboard.press('Control+z');
  await expect(secondPage.locator('.react-flow__node')).toHaveCount(1);
  await expect(secondPage.getByRole('status').filter({ hasText: 'Mentetlen változtatások' })).toHaveCount(0);

  const dialogTypes: string[] = [];
  secondPage.on('dialog', async (dialog) => {
    dialogTypes.push(dialog.type());
    await dialog.dismiss();
  });
  const closed = secondPage.waitForEvent('close');
  await secondPage.close({ runBeforeUnload: true });
  await closed;
  expect(dialogTypes).toEqual([]);
  expect(secondPage.isClosed()).toBe(true);
});

test('mentetlen változásnál az újratöltés beforeunload párbeszédet ad, elfogadva a lap újratölt', async ({ page }) => {
  await openEditorWithUnsavedNode(page);
  const dialogTypes: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogTypes.push(dialog.type());
    await dialog.accept();
  });

  await page.reload();

  expect(dialogTypes).toEqual(['beforeunload']);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await expect(page.locator('.react-flow__node')).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' })).toHaveCount(0);
});

test('mentetlen változásnál a kézzel beírt cím beforeunload párbeszédet ad: elutasítva a szerkesztő marad, elfogadva a cím betölt', async ({
  page,
}) => {
  await openEditorWithUnsavedNode(page);
  const dialogTypes: string[] = [];
  let shouldAcceptDialog = false;
  page.on('dialog', async (dialog) => {
    dialogTypes.push(dialog.type());
    await (shouldAcceptDialog ? dialog.accept() : dialog.dismiss());
  });

  // Elutasítva a navigáció megszakad (mért: `net::ERR_ABORTED`), a lap és a
  // változás megmarad.
  await expect(page.goto('/runs')).rejects.toThrow('net::ERR_ABORTED');
  expect(dialogTypes).toEqual(['beforeunload']);
  await expect(page).toHaveURL(/\/editor\?workflowId=w-alfa$/);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);

  shouldAcceptDialog = true;
  await page.goto('/runs');
  expect(dialogTypes).toEqual(['beforeunload', 'beforeunload']);
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();
});
