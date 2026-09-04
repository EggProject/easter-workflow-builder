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

test('kitöltött leírással és provider nélkül a létrehozás törzse a leírást és null providerId-t küld', async ({
  page,
}) => {
  const created: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('createWorkflow', async (route) => {
      created.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ ...ALFA, id: 'w-delta', name: 'Delta workflow' }));
    }),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();

  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await dialog.getByLabel('Név').fill('Delta workflow');
  await dialog.getByLabel('Leírás').fill('A delta leírása');
  await dialog.getByRole('button', { name: 'Létrehozás' }).click();

  await expect(dialog).toBeHidden();
  await expect
    .poll(() => created.body)
    .toEqual({ name: 'Delta workflow', description: 'A delta leírása', providerId: null });
});

test('a kiválasztott provider szükséges környezeti változóit a modális kiírja', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) =>
      route.fulfill(
        jsonBody([
          {
            id: 'minimax',
            displayName: 'MiniMax',
            models: [],
            requiredEnvNames: ['MINIMAX_API_KEY', 'ANTHROPIC_BASE_URL'],
          },
        ]),
      ),
    ),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();

  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await dialog.getByRole('combobox', { name: 'Provider' }).selectOption('minimax');

  // Kizárólag a változó NEVE jelenik meg, az értéke soha
  // (SPEC-007 16. szekció 49. kritérium).
  await expect(dialog.getByText('Szükséges környezeti változók: MINIMAX_API_KEY, ANTHROPIC_BASE_URL')).toBeVisible();
});

test('a létrehozás hibájára a modálison belül riasztás jelenik meg, a modális nyitva marad', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('createWorkflow', async (route) =>
      route.fulfill(jsonBody({ code: 'conflict', message: 'Ilyen nevű workflow már van.' }, 409)),
    ),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();

  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await dialog.getByLabel('Név').fill('Ütköző név');
  await dialog.getByRole('button', { name: 'Létrehozás' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Ilyen nevű workflow már van.');
  await expect(dialog).toBeVisible();
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

test('leírás nélküli workflow átnevezésekor a leírás mező üresen indul és kitölthető', async ({ page }) => {
  const updated: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([BETA]))),
    mockRoute('updateWorkflow', async (route) => {
      updated.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ ...BETA, description: 'Most már van leírás' }));
    }),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Béta workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  // A `null` leírás üres sztringre képződik le (`workflow.description ?? ''`).
  await expect(dialog.getByLabel('Leírás')).toHaveValue('');
  await dialog.getByLabel('Leírás').fill('Most már van leírás');
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  await expect.poll(() => updated.body).toEqual({ name: 'Béta workflow', description: 'Most már van leírás' });
});

test('a leírás mező kiürítésével az átnevezés törzse null leírást küld', async ({ page }) => {
  const updated: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('updateWorkflow', async (route) => {
      updated.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ ...ALFA, description: null }));
    }),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  await dialog.getByLabel('Leírás').fill('');
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  await expect.poll(() => updated.body).toEqual({ name: 'Alfa workflow', description: null });
});

test('a workflow tábla a Név oszlop szerint rendez, a Műveletek oszlop szerint nem', async ({ page }) => {
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([BETA, ALFA])))]);

  await page.goto('/');
  const table = page.getByRole('table', { name: 'Workflow-k' });
  const nameHeader = table.getByRole('columnheader', { name: 'Név' });

  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  // A nulladik sor a fejléc sor; növekvő sorrendben az "Alfa" előzi a "Béta"-t.
  await expect(table.getByRole('row').nth(1)).toContainText('Alfa workflow');

  // A "Műveletek" oszlop `sortable: false`, ezért nincs `aria-sort`
  // attribútuma, és kattintás után sem kap egyet; a tábla mind a két sort
  // tovább mutatja, mert a rendezés kulcsa minden sorra üres sztring.
  const actionsHeader = table.getByRole('columnheader', { name: 'Műveletek' });
  await expect(actionsHeader).not.toHaveAttribute('aria-sort');
  await actionsHeader.click();
  await expect(actionsHeader).not.toHaveAttribute('aria-sort');
  await expect(table.getByRole('row', { name: /Alfa workflow/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /Béta workflow/ })).toBeVisible();
});

test('az átnevezés hibájára a modálison belül riasztás jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('updateWorkflow', async (route) =>
      route.fulfill(jsonBody({ code: 'not_found', message: 'Időközben törölték.' }, 404)),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Átnevezés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow átnevezése' });
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Időközben törölték.');
});

test('a törlési összegzés hibájára riasztás jelenik meg, és a törlés gomb tiltott marad', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('summarizeWorkflowDeletion', async (route) =>
      route.fulfill(jsonBody({ code: 'internal', message: 'Nem sikerült összeszámolni.' }, 500)),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Törlés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow törlése' });
  await expect(dialog.getByRole('alert')).toContainText('Nem sikerült összeszámolni.');
  // Összegzés nélkül nincs mit megerősíteni, tehát a gomb tiltott marad.
  await expect(dialog.getByRole('button', { name: 'Törlés' })).toBeDisabled();
});

test('a törlés hibájára a modálison belül riasztás jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('summarizeWorkflowDeletion', async (route) =>
      route.fulfill(jsonBody({ runCount: 1, eventCount: 2, snapshotCount: 3 })),
    ),
    mockRoute('deleteWorkflow', async (route) =>
      route.fulfill(jsonBody({ code: 'conflict', message: 'Fut még egy futás.' }, 409)),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Törlés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow törlése' });
  await dialog.getByText('Tudomásul veszem, hogy a törlés nem vonható vissza').click();
  await dialog.getByRole('button', { name: 'Törlés' }).click();

  await expect(dialog.getByRole('alert')).toContainText('Fut még egy futás.');
  await expect(dialog).toBeVisible();
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

test('a futás indítás hibájára toast jelenik meg, és a lista marad a helyén', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('startRun', async (route) =>
      route.fulfill(jsonBody({ code: 'unprocessable', message: 'Nincs gráf a workflow-hoz.' }, 422)),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Indítás' }).click();

  await expect(page.getByText('A futás indítása sikertelen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Workflow-k' })).toBeVisible();
});
