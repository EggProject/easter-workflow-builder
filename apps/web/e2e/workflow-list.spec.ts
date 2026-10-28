/* eslint-disable unicorn/no-null -- a WorkflowSummary nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/workflow/workflow-record.ts). */
// A workflow lista képernyő e2e folyamatai (T-008-27, SPEC-007 10.1): lista
// betöltés, létrehozás, szerkesztés, és a törlés teljes, megerősítő folyamata.
// Minden REST hívás `page.route()` mockon megy (rest-mock.ts), az SSE
// csatorna egyetlen `stream_ready` kerettel (sse-mock.ts), hogy az AppShell
// mindig nyitva tartott kapcsolata ne szóljon valódi hálózat felé.
import type { ProviderSummary, WorkflowSummary } from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { expectHorizontallyInside } from './expect-horizontally-inside.ts';
import { createRequestGate } from './request-gate.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { chooseSelectOption, expectSelectedLabel } from './select-field.ts';
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

  await expect(page.getByRole('navigation', { name: 'Morzsamenü' }).getByText('Workflow-k')).toBeVisible();
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

  // A kódhoz rendelt mondat a design system danger `Alert` blokkjában, a
  // szerver `message` mezője nélkül (SPEC-007 8.4, user döntés 2026-09-24).
  await expect(page.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(page.getByRole('alert')).toHaveClass(/\balert--danger\b/);
  await expect(page.locator('body')).not.toContainText('A szerver hibát adott.');
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
  await chooseSelectOption(page, dialog.getByRole('combobox', { name: 'Provider' }), 'Claude Code');
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

test('a létrehozás alatt a Létrehozás gomb tiltott és betöltést jelez, a felirata nem változik, a Mégse is tiltott', async ({
  page,
}) => {
  const creationGate = createRequestGate();
  const created: { count: number } = { count: 0 };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('createWorkflow', async (route) => {
      await creationGate.passed;
      created.count += 1;
      await route.fulfill(jsonBody({ ...ALFA, id: 'w-epszilon', name: 'Epszilon workflow' }));
    }),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();
  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await dialog.getByLabel('Név').fill('Epszilon workflow');
  await dialog.getByRole('button', { name: 'Létrehozás', exact: true }).click();

  const creatingButton = dialog.getByRole('button', { name: 'Létrehozás', exact: true });
  await expect(creatingButton).toBeDisabled();
  await expect(creatingButton).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByRole('button', { name: 'Mégse' })).toBeDisabled();
  expect(created.count).toBe(0);

  creationGate.open();
  await expect(dialog).toBeHidden();
  expect(created.count).toBe(1);
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
            requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'], ['ANTHROPIC_BASE_URL']],
          },
        ]),
      ),
    ),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();

  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await chooseSelectOption(page, dialog.getByRole('combobox', { name: 'Provider' }), 'MiniMax');

  // Kizárólag a változó NEVE jelenik meg, az értéke soha (SPEC-007 16. szekció
  // 49. kritérium); egy követelmény elfogadott nevei " vagy " kötőszóval (SPEC-013 4.8).
  await expect(
    dialog.getByText('Szükséges környezeti változók: ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL'),
  ).toBeVisible();
});

// A "Kapcsolat teszt" gomb a provider választó része (SPEC-009 3.2, O-2, AC4):
// provider nélkül tiltott és megindokolt, választás után a kiválasztott
// providerre a törzs nélküli POST megy, az eredmény design system Alertben áll.
test('a létrehozó modális Kapcsolat teszt gombja provider nélkül tiltott, siker és hiba esetén Alerttel felel', async ({
  page,
}) => {
  const testedProviders: string[] = [];
  let isSuccessResponse = true;
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) =>
      route.fulfill(jsonBody([{ id: 'minimax', displayName: 'MiniMax', models: [], requiredEnvNames: [] }])),
    ),
    mockRoute('testProviderConnection', async (route) => {
      testedProviders.push(new URL(route.request().url()).pathname);
      await route.fulfill(
        jsonBody({
          succeeded: isSuccessResponse,
          errorMessage: isSuccessResponse ? null : 'Hiányzik az ANTHROPIC_AUTH_TOKEN',
        }),
      );
    }),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();
  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  const testButton = dialog.getByRole('button', { name: 'Kapcsolat teszt' });

  await expect(testButton).toBeDisabled();
  await expect(dialog.getByText('A kapcsolat teszthez válassz ki egy providert.')).toBeVisible();

  await chooseSelectOption(page, dialog.getByRole('combobox', { name: 'Provider' }), 'MiniMax');
  await expect(testButton).toBeEnabled();
  await testButton.click();
  await expect(dialog.getByRole('status')).toHaveText('A kapcsolat teszt sikeres.');
  await expect(dialog.getByRole('status')).toHaveClass(/\balert--success\b/);

  isSuccessResponse = false;
  await testButton.click();
  const failure = dialog.getByRole('alert');
  await expect(failure).toContainText('A kapcsolat teszt sikertelen');
  await expect(failure).toContainText('Hiányzik az ANTHROPIC_AUTH_TOKEN');
  await expect(failure).toHaveClass(/\balert--danger\b/);
  expect(testedProviders).toEqual(['/api/providers/minimax/connection-test', '/api/providers/minimax/connection-test']);
});

test('a Kapcsolat teszt hívásának hibája danger Alertben, a kódhoz rendelt mondattal jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) =>
      route.fulfill(jsonBody([{ id: 'minimax', displayName: 'MiniMax', models: [], requiredEnvNames: [] }])),
    ),
    mockRoute('testProviderConnection', async (route) =>
      route.fulfill(jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500)),
    ),
  ]);

  await page.goto('/');
  await page.getByRole('button', { name: 'Új workflow' }).click();
  const dialog = page.getByRole('dialog', { name: 'Új workflow' });
  await chooseSelectOption(page, dialog.getByRole('combobox', { name: 'Provider' }), 'MiniMax');
  await dialog.getByRole('button', { name: 'Kapcsolat teszt' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(dialog.getByRole('alert')).toHaveClass(/\balert--danger\b/);
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

  await expect(dialog.getByRole('alert')).toHaveText('Az elem állapota most nem engedi a műveletet.');
  await expect(dialog).not.toContainText('Ilyen nevű workflow már van.');
  await expect(dialog).toBeVisible();
});

test('workflow szerkesztése a soronkénti modálison keresztül', async ({ page }) => {
  const updated: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
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
  await page.getByRole('menuitem', { name: 'Szerkesztés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow szerkesztése' });
  const nameField = dialog.getByLabel('Név');
  await nameField.fill('Alfa módosítva');
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  await expect.poll(() => updated.body).toMatchObject({ name: 'Alfa módosítva' });
});

test('leírás nélküli workflow szerkesztésekor a leírás mező üresen indul és kitölthető', async ({ page }) => {
  const updated: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([BETA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('updateWorkflow', async (route) => {
      updated.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ ...BETA, description: 'Most már van leírás' }));
    }),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Béta workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Szerkesztés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow szerkesztése' });
  // A `null` leírás üres sztringre képződik le (`workflow.description ?? ''`).
  await expect(dialog.getByLabel('Leírás')).toHaveValue('');
  await dialog.getByLabel('Leírás').fill('Most már van leírás');
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  await expect
    .poll(() => updated.body)
    .toEqual({ name: 'Béta workflow', description: 'Most már van leírás', providerId: null });
});

test('a leírás mező kiürítésével a szerkesztés törzse null leírást küld', async ({ page }) => {
  const updated: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('updateWorkflow', async (route) => {
      updated.body = route.request().postDataJSON();
      await route.fulfill(jsonBody({ ...ALFA, description: null }));
    }),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Szerkesztés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow szerkesztése' });
  await dialog.getByLabel('Leírás').fill('');
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  await expect
    .poll(() => updated.body)
    .toEqual({ name: 'Alfa workflow', description: null, providerId: 'claude-subscription' });
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

test('a szerkesztés hibájára a modálison belül riasztás jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('updateWorkflow', async (route) =>
      route.fulfill(jsonBody({ code: 'not_found', message: 'A(z) "w-alfa" workflow nem található (not_found).' }, 404)),
    ),
  ]);

  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Szerkesztés' }).click();

  const dialog = page.getByRole('dialog', { name: 'Workflow szerkesztése' });
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  // 404: csak a mondat, az azonosító és a zárójeles hibaosztály nem jut a
  // felületre (SPEC-007 8.4, user döntés 2026-09-24).
  await expect(dialog.getByRole('alert')).toHaveText('A keresett elem nem létezik, esetleg időközben törölték.');
  await expect(dialog.getByRole('alert')).toHaveClass(/\balert--danger\b/);
  await expect(dialog).not.toContainText('(not_found)');
  await expect(dialog).not.toContainText('"w-alfa"');
});

// A "Workflow szerkesztése" modális provider választója (SPEC-009 3.3, O-3, AC8):
// a `PATCH` törzse a `providerId` mezőt hordozza, az "örökölt" választás `null`
// értékkel; a "Kapcsolat teszt" gomb a választó része (AC4).
const EDIT_PROVIDERS: readonly ProviderSummary[] = [
  { id: 'claude-subscription', displayName: 'Claude Code', models: [], requiredEnvNames: [] },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    models: [],
    requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'], ['ANTHROPIC_BASE_URL']],
  },
];

interface EditMockOptions {
  readonly workflow: WorkflowSummary;
  /**
   * A providerek listájának válasza előtt megvárt kapu.
   */
  readonly providersGate?: Promise<undefined>;
  /**
   * A `PATCH` válasza előtt megvárt kapu.
   */
  readonly updateGate?: Promise<undefined>;
  readonly isProvidersFailing?: boolean;
}

interface EditMockCalls {
  readonly updates: { readonly pathname: string; readonly body: unknown }[];
  readonly connectionTests: string[];
}

async function installEditMocks(page: Page, options: EditMockOptions): Promise<EditMockCalls> {
  const calls: EditMockCalls = { updates: [], connectionTests: [] };
  // A szerkesztés után a lista újratölt: a mock a legutóbb mentett providert adja vissza.
  let current: WorkflowSummary = options.workflow;
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([current]))),
    mockRoute('listProviders', async (route) => {
      await options.providersGate;
      await route.fulfill(
        options.isProvidersFailing === true
          ? jsonBody({ code: 'internal', message: 'belső hiba' }, 500)
          : jsonBody(EDIT_PROVIDERS),
      );
    }),
    mockRoute('updateWorkflow', async (route, url) => {
      await options.updateGate;
      const body: unknown = route.request().postDataJSON();
      calls.updates.push({ pathname: url.pathname, body });
      const patch = body !== null && typeof body === 'object' && 'providerId' in body ? body.providerId : undefined;
      current = { ...current, providerId: typeof patch === 'string' ? patch : current.providerId };
      await route.fulfill(jsonBody(current));
    }),
    mockRoute('testProviderConnection', async (route, url) => {
      calls.connectionTests.push(url.pathname);
      await route.fulfill(jsonBody({ succeeded: true, errorMessage: null }));
    }),
  ]);
  return calls;
}

async function openEditModal(page: Page, workflowName: RegExp): Promise<Locator> {
  await page.goto('/');
  const row = page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: workflowName });
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Szerkesztés' }).click();
  const dialog = page.getByRole('dialog', { name: 'Workflow szerkesztése' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('a szerkesztő modális a workflow providerét mutatja, a választás a PATCH törzsébe kerül, a lista az új providert mutatja', async ({
  page,
}) => {
  const calls = await installEditMocks(page, { workflow: ALFA });
  const dialog = await openEditModal(page, /Alfa workflow/);
  const providerSelect = dialog.getByRole('combobox', { name: 'Provider' });

  await expectSelectedLabel(providerSelect, 'Claude Code');
  await expect(dialog.getByText('Ehhez a providerhez nem kell környezeti változó.')).toBeVisible();

  await chooseSelectOption(page, providerSelect, 'MiniMax');
  await expect(
    dialog.getByText('Szükséges környezeti változók: ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL'),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  expect(calls.updates).toEqual([
    {
      pathname: '/api/workflows/w-alfa',
      body: { name: 'Alfa workflow', description: 'Az első teszt workflow', providerId: 'minimax' },
    },
  ]);
  await expect(
    page.getByRole('table', { name: 'Workflow-k' }).getByRole('row', { name: /Alfa workflow/ }),
  ).toContainText('minimax');
});

test('a "Nincs megadva" választás a PATCH törzsében null providerId, az örökölt állapotban nincs env mondat', async ({
  page,
}) => {
  const calls = await installEditMocks(page, { workflow: ALFA });
  const dialog = await openEditModal(page, /Alfa workflow/);
  const providerSelect = dialog.getByRole('combobox', { name: 'Provider' });
  await expectSelectedLabel(providerSelect, 'Claude Code');

  await chooseSelectOption(page, providerSelect, 'Nincs megadva');
  await expectSelectedLabel(providerSelect, 'Nincs megadva');
  await expect(dialog.getByText('Ehhez a providerhez nem kell környezeti változó.')).toBeHidden();
  await dialog.getByRole('button', { name: 'Mentés' }).click();

  await expect(dialog).toBeHidden();
  expect(calls.updates.map((update) => update.body)).toEqual([
    { name: 'Alfa workflow', description: 'Az első teszt workflow', providerId: null },
  ]);
});

test('a szerkesztő modális Kapcsolat teszt gombja örökölt providernél tiltott és megindokolt, választás után a provider tesztjét futtatja, váltás elrejti az eredményt', async ({
  page,
}) => {
  const calls = await installEditMocks(page, { workflow: BETA });
  const dialog = await openEditModal(page, /Béta workflow/);
  const providerSelect = dialog.getByRole('combobox', { name: 'Provider' });
  const testButton = dialog.getByRole('button', { name: 'Kapcsolat teszt' });

  await expectSelectedLabel(providerSelect, 'Nincs megadva');
  await expect(testButton).toBeDisabled();
  await expect(dialog.getByText('A kapcsolat teszthez válassz ki egy providert.')).toBeVisible();

  await chooseSelectOption(page, providerSelect, 'MiniMax');
  await expect(testButton).toBeEnabled();
  await expect(dialog.getByText('A kapcsolat teszthez válassz ki egy providert.')).toBeHidden();
  await testButton.click();

  const result = dialog.getByRole('status');
  await expect(result).toHaveText('A kapcsolat teszt sikeres.');
  await expect(result).toHaveClass(/\balert--success\b/);
  expect(calls.connectionTests).toEqual(['/api/providers/minimax/connection-test']);

  await chooseSelectOption(page, providerSelect, 'Claude Code');
  await expect(result).toBeHidden();
  expect(calls.updates).toEqual([]);
});

test('a provider lista betöltése alatt a választó "betöltés" feliratú és tiltott', async ({ page }) => {
  const providersGate = createRequestGate();
  await installEditMocks(page, { workflow: ALFA, providersGate: providersGate.passed });
  const dialog = await openEditModal(page, /Alfa workflow/);
  const providerSelect = dialog.getByRole('combobox', { name: 'Provider' });

  await expect(providerSelect).toHaveText('betöltés');
  await expect(providerSelect).toBeDisabled();
  providersGate.open();
  await expectSelectedLabel(providerSelect, 'Claude Code');
  await expect(providerSelect).toBeEnabled();
});

test('a provider lista betöltési hibája danger Alert a modálison belül', async ({ page }) => {
  await installEditMocks(page, { workflow: ALFA, isProvidersFailing: true });
  const dialog = await openEditModal(page, /Alfa workflow/);

  await expect(dialog.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(dialog.getByRole('alert')).toHaveClass(/\balert--danger\b/);
});

test('a szerkesztés mentése alatt a Mentés gomb tiltott és betöltést jelez, a Mégse is tiltott; üres névvel a Mentés tiltott', async ({
  page,
}) => {
  const updateGate = createRequestGate();
  const calls = await installEditMocks(page, { workflow: ALFA, updateGate: updateGate.passed });
  const dialog = await openEditModal(page, /Alfa workflow/);
  const nameField = dialog.getByLabel('Név');

  await nameField.fill('');
  await expect(dialog.getByRole('button', { name: 'Mentés', exact: true })).toBeDisabled();
  await nameField.fill('Alfa módosítva');
  await dialog.getByRole('button', { name: 'Mentés', exact: true }).click();

  const savingButton = dialog.getByRole('button', { name: 'Mentés', exact: true });
  await expect(savingButton).toBeDisabled();
  await expect(savingButton).toHaveAttribute('aria-busy', 'true');
  await expect(dialog.getByRole('button', { name: 'Mégse' })).toBeDisabled();
  expect(calls.updates).toEqual([]);

  updateGate.open();
  await expect(dialog).toBeHidden();
  expect(calls.updates).toHaveLength(1);
});

// A szerkesztő modális elrendezése és festése mindkét témában, 320 és 1440
// pixelen (SPEC-009 10. szekció, AC4, AC8).
for (const theme of ['light', 'dark'] as const) {
  for (const width of [320, 1440] as const) {
    test.describe(`a szerkesztő modális, ${theme} téma, ${String(width)} pixel`, () => {
      test.use({ colorScheme: theme });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((mode: string) => {
          globalThis.localStorage.setItem('eggTheme', mode);
        }, theme);
        await page.setViewportSize({ width, height: 900 });
      });

      test('a modális és minden vezérlője a nézetablakban áll, túllógás nélkül, kifestve, a kapcsolat teszt eredménye is', async ({
        page,
      }) => {
        await installEditMocks(page, { workflow: BETA });
        const dialog = await openEditModal(page, /Béta workflow/);
        if (theme === 'dark') {
          await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        } else {
          await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        }

        const providerSelect = dialog.getByRole('combobox', { name: 'Provider' });
        await chooseSelectOption(page, providerSelect, 'MiniMax');
        await dialog.getByRole('button', { name: 'Kapcsolat teszt' }).click();
        const result = dialog.getByRole('status');
        await expect(result).toHaveText('A kapcsolat teszt sikeres.');

        for (const control of [
          dialog,
          dialog.getByLabel('Név'),
          dialog.getByLabel('Leírás'),
          providerSelect,
          dialog.getByRole('button', { name: 'Kapcsolat teszt' }),
          result,
          dialog.getByText('Szükséges környezeti változók', { exact: false }),
          dialog.getByRole('button', { name: 'Mégse' }),
          dialog.getByRole('button', { name: 'Mentés', exact: true }),
        ]) {
          await expectHorizontallyInside(page, control);
        }
        expect(await dialog.evaluate((element) => element.scrollWidth - element.clientWidth)).toBe(0);
        expect(await dialog.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)).not.toBe(
          'rgba(0, 0, 0, 0)',
        );
        expect(await result.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor)).not.toBe(
          'rgba(0, 0, 0, 0)',
        );
      });
    });
  }
}

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
  await expect(dialog.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(dialog).not.toContainText('Nem sikerült összeszámolni.');
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

  await expect(dialog.getByRole('alert')).toHaveText('Az elem állapota most nem engedi a műveletet.');
  await expect(dialog.getByRole('alert')).toHaveClass(/\balert--danger\b/);
  await expect(dialog).not.toContainText('Fut még egy futás.');
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
  // Lásd a fenti "Szerkesztés" tesztnél lévő megjegyzést: a menü portálon
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
  // Lásd a fenti "Szerkesztés" tesztnél lévő megjegyzést: a menü portálon
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
  // Lásd a fenti "Szerkesztés" tesztnél lévő megjegyzést: a menü portálon
  // (`document.body`) át nyílik, nem a sor leszármazottjaként.
  await row.getByRole('button', { name: /^Műveletek/ }).click();
  await page.getByRole('menuitem', { name: 'Indítás' }).click();

  await expect(page.getByRole('navigation', { name: 'Morzsamenü' }).getByText('Futás előzmények')).toBeVisible();
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
  await expect(page.getByText('A kérés rendben volt, de a rendszer nem tudja végrehajtani.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Nincs gráf a workflow-hoz.');
  await expect(page.getByRole('navigation', { name: 'Morzsamenü' }).getByText('Workflow-k')).toBeVisible();
});
