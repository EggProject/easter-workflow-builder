/* eslint-disable unicorn/no-null -- a WorkflowSummary nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/workflow/workflow-record.ts). */
// A workflow lista képernyő e2e folyamatai (T-008-27, SPEC-007 10.1): lista
// betöltés, létrehozás, átnevezés, és a törlés teljes, megerősítő folyamata.
// Minden REST hívás `page.route()` mockon megy (rest-mock.ts), az SSE
// csatorna egyetlen `stream_ready` kerettel (sse-mock.ts), hogy az AppShell
// mindig nyitva tartott kapcsolata ne szóljon valódi hálózat felé.
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: 'Az első teszt workflow',
  providerId: 'claude-subscription',
  createdAtMs: 1_735_689_600_000,
  updatedAtMs: 1_735_689_600_000,
};

const BETA: WorkflowSummary = {
  id: 'w-beta',
  name: 'Béta workflow',
  description: null,
  providerId: null,
  createdAtMs: 1_735_776_000_000,
  updatedAtMs: 1_735_776_000_000,
};

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
});

test('betölti és megjeleníti a workflow listát', async ({ page }) => {
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA, BETA])))]);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Workflow-k' })).toBeVisible();
  const table = page.getByRole('table', { name: 'Workflow-k' });
  await expect(table.getByRole('row', { name: /Alfa workflow/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Béta workflow/ })).toBeVisible();
  // A hiányzó leírás/provider a null -> placeholder leképezést igazolja.
  await expect(table.getByRole('row', { name: /Béta workflow/ })).toContainText('nincs megadva');
});

test('lista betöltési hibára riasztás jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) =>
      route.fulfill(jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500)),
    ),
  ]);

  await page.goto('/');

  await expect(page.getByRole('alert')).toBeVisible();
});

test('új workflow létrehozása a modálison keresztül', async ({ page }) => {
  const created: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) =>
      route.fulfill(
        jsonBody([{ id: 'claude-subscription', displayName: 'Claude Code', models: [], requiredEnvNames: [] }]),
      ),
    ),
    mockRoute('createWorkflow', async (route) => {
      created.body = route.request().postDataJSON();
      await route.fulfill(
        jsonBody({
          id: 'w-gamma',
          name: 'Gamma workflow',
          description: null,
          providerId: 'claude-subscription',
          createdAtMs: 1,
          updatedAtMs: 1,
        }),
      );
    }),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();

  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Név').fill('Gamma workflow');
  await dialog.getByRole('combobox', { name: 'Provider' }).selectOption('claude-subscription');
  await dialog.getByRole('button', { name: 'Létrehozás' }).click();

  await expect(dialog).toBeHidden();
  await expect
    .poll(() => created.body)
    .toEqual({ name: 'Gamma workflow', description: null, providerId: 'claude-subscription' });
});

test('workflow átnevezése a soronkénti modálison keresztül', async ({ page }) => {
  const updated: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('updateWorkflow', async (route) => {
      updated.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ ...ALFA, name: 'Alfa módosítva' }));
    }),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  // A sor műveletek 2026-09-04 óta egy hárompontos triggerből nyíló, portálon
  // (`document.body`) át renderelt menü mögé kerültek (felhasználói kérés),
  // ezért a menüelem NEM a sor leszármazottja - a triggert kell előbb
  // megnyitni, a menüitemet pedig a `page` szintjén kell megcélozni.
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  const nameField = dialog.getByLabel('Név');
  await nameField.fill('Alfa módosítva');
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  await expect.poll(() => updated.body).toMatchObject({ name: 'Alfa módosítva' });
});

test('workflow törlése: az összegzés és a jelölőnégyzet nélkül a gomb tiltott', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('summarizeWorkflowDeletion', async (route) =>
      route.fulfill(jsonBody({ runCount: 3, eventCount: 42, snapshotCount: 2 })),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  // Lásd a fenti "Átnevezés" tesztnél lévő megjegyzést: a menü portálon
  // (`document.body`) át nyílik, nem a sor leszármazottjaként.
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Törlés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow törlése' });
  await expect(dialog.getByText('3 futást')).toBeVisible();
  await expect(dialog.getByText('42 eseményt')).toBeVisible();
  await expect(dialog.getByText('2 gráf pillanatképet')).toBeVisible();

  const confirmButton = dialog.getByRole('button', { name: 'Törlés' });
  await expect(confirmButton).toBeDisabled();

  // A jelölőnégyzet natív <label> köré épül, a pipa SVG-je pedig vizuálisan
  // az <input> fölött ül (packages/ui Checkbox.tsx, bájtazonosan átemelt
  // .ctrl__box réteg) - Playwright a role=checkbox elemre célzott .check()
  // hívással nem tudja becélozni a valódi inputot (a fedő SVG elfogja a
  // szintetikus kattintást), ezért a hozzá tartozó SZÖVEGRE kattint, amit a
  // natív label-továbbítás helyesen a mögötte álló inputra vezet.
  await dialog.getByText('Tudomásul veszem, hogy a törlés nem vonható vissza').click();
  await expect(dialog.getByRole('checkbox')).toBeChecked();
  await expect(confirmButton).toBeEnabled();
});

test('workflow törlése: a megerősítés után a DELETE törzse acknowledgeIrreversible: true', async ({ page }) => {
  const capturedDeleteRequest: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('summarizeWorkflowDeletion', async (route) =>
      route.fulfill(jsonBody({ runCount: 0, eventCount: 0, snapshotCount: 0 })),
    ),
    mockRoute('deleteWorkflow', async (route) => {
      capturedDeleteRequest.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ runCount: 0, eventCount: 0, snapshotCount: 0 }));
    }),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  // Lásd a fenti "Átnevezés" tesztnél lévő megjegyzést: a menü portálon
  // (`document.body`) át nyílik, nem a sor leszármazottjaként.
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Törlés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow törlése' });
  await dialog.getByText('Tudomásul veszem, hogy a törlés nem vonható vissza').click();
  await dialog.getByRole('button', { name: 'Törlés' }).click();

  await expect(dialog).toBeHidden();
  await expect.poll(() => capturedDeleteRequest.body).toEqual({ acknowledgeIrreversible: true });
});

test('futás indítása a Futás előzmények útvonalra navigál', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('startRun', async (route) => route.fulfill(jsonBody({ runId: 'r-1', status: 'pending' }))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  // Lásd a fenti "Átnevezés" tesztnél lévő megjegyzést: a menü portálon
  // (`document.body`) át nyílik, nem a sor leszármazottjaként.
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Indítás' }).click();

  await expect(page.getByRole('heading', { name: 'Futás előzmények' })).toBeVisible();
});
