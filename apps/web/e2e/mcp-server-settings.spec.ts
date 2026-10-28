// E2E a Beállítások "MCP szerverek" kártyájára valós Chromiumban (PLAN-012
// T-012-23, SPEC-009 3.1 5. pont, 6.2, 12. szekció AC17, O-31, O-32, O-43):
// a központi lista, a hozzáadás és a szerkesztés modálisban, a szerver oldali
// név kiválasztása a környezet neveinek listájából, a mező alatti hibák, a
// létező névre mentés felülírása és a törlés megerősítéssel. A mentés `PUT`
// törzse `page.route()` mockon rögzül, a `McpServerDefinitionSchema` szerint
// értelmezve; a REST hívások mind mockoltak.
/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import {
  McpServerDefinitionSchema,
  type McpServerDefinition,
  type McpServerDefinitionRecord,
  type ProviderSummary,
  type SettingsRecord,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

const PROVIDERS: readonly ProviderSummary[] = [];

const GITHUB: McpServerDefinitionRecord = {
  name: 'github',
  definition: {
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@mcp/github'],
    envNames: ['GITHUB_TOKEN'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
  },
};

const TAVOLI: McpServerDefinitionRecord = {
  name: 'tavoli',
  definition: { type: 'http', url: 'https://mcp.example.test', authEnvName: null },
};

const ESEMENY: McpServerDefinitionRecord = {
  name: 'esemeny',
  definition: { type: 'sse', url: 'https://sse.example.test', authEnvName: 'MCP_TOKEN' },
};

const ENVIRONMENT_NAMES: readonly string[] = ['GITHUB_TOKEN_CEG', 'GITHUB_TOKEN_SAJAT', 'MCP_TOKEN'];

interface MockState {
  servers: readonly McpServerDefinitionRecord[];
  readonly puts: { readonly name: string; readonly body: unknown }[];
  readonly deletes: string[];
  isSaveFailing: boolean;
  isEnvironmentFailing: boolean;
  isListFailing: boolean;
  isDeleteFailing: boolean;
}

const mockState: MockState = {
  servers: [],
  puts: [],
  deletes: [],
  isSaveFailing: false,
  isEnvironmentFailing: false,
  isListFailing: false,
  isDeleteFailing: false,
};

function lastPathSegment(url: URL): string {
  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
}

function withRecord(
  servers: readonly McpServerDefinitionRecord[],
  record: McpServerDefinitionRecord,
): readonly McpServerDefinitionRecord[] {
  return [...servers.filter((server) => server.name !== record.name), record].toSorted((left, right) =>
    left.name.localeCompare(right.name),
  );
}

test.beforeEach(async ({ page }) => {
  mockState.servers = [GITHUB, TAVOLI];
  mockState.puts.length = 0;
  mockState.deletes.length = 0;
  mockState.isSaveFailing = false;
  mockState.isEnvironmentFailing = false;
  mockState.isListFailing = false;
  mockState.isDeleteFailing = false;
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody(PROVIDERS))),
    mockRoute('listConcurrencyLimits', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listSkills', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listServerEnvironmentNames', async (route) =>
      mockState.isEnvironmentFailing
        ? route.fulfill(jsonBody({ code: 'internal', message: 'belső hiba' }, 500))
        : route.fulfill(jsonBody(ENVIRONMENT_NAMES)),
    ),
    mockRoute('listMcpServerDefinitions', async (route) =>
      mockState.isListFailing
        ? route.fulfill(jsonBody({ code: 'internal', message: 'belső hiba' }, 500))
        : route.fulfill(jsonBody(mockState.servers)),
    ),
    mockRoute('saveMcpServerDefinition', async (route, url) => {
      const name = lastPathSegment(url);
      const body: unknown = route.request().postDataJSON();
      mockState.puts.push({ name, body });
      const parsed = McpServerDefinitionSchema.safeParse(body);
      if (mockState.isSaveFailing || !parsed.success) {
        await route.fulfill(jsonBody({ code: 'invalid_request', message: 'hibás kérés' }, 400));
        return;
      }
      const record: McpServerDefinitionRecord = { name, definition: parsed.data };
      mockState.servers = withRecord(mockState.servers, record);
      await route.fulfill(jsonBody(record));
    }),
    mockRoute('deleteMcpServerDefinition', async (route, url) => {
      const name = lastPathSegment(url);
      mockState.deletes.push(name);
      if (mockState.isDeleteFailing) {
        await route.fulfill(jsonBody({ code: 'not_found', message: 'nincs ilyen szerver' }, 404));
        return;
      }
      mockState.servers = mockState.servers.filter((server) => server.name !== name);
      await route.fulfill({ status: 204 });
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

function card(page: Page): Locator {
  return page.getByRole('region', { name: 'MCP szerverek', exact: true });
}

function dialog(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name, exact: true });
}

function row(page: Page, name: string): Locator {
  return card(page).getByRole('group', { name, exact: true });
}

async function openAddModal(page: Page): Promise<Locator> {
  await page.goto('/settings');
  await card(page).getByRole('button', { name: 'MCP szerver hozzáadása', exact: true }).click();
  const modal = dialog(page, 'MCP szerver hozzáadása');
  await expect(modal).toBeVisible();
  return modal;
}

function savedDefinition(index: number): McpServerDefinition {
  const parsed = McpServerDefinitionSchema.safeParse(mockState.puts[index]?.body);
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes McpServerDefinition');
  }
  return parsed.data;
}

test('a kártya a központi listát soronként mutatja: név, parancs vagy URL, a változók az alapértelmezett hozzárendeléssel', async ({
  page,
}) => {
  await page.goto('/settings');

  await expect(row(page, 'github')).toContainText('stdio: npx -y @mcp/github');
  await expect(row(page, 'github')).toContainText('Változók: GITHUB_TOKEN ← GITHUB_TOKEN_CEG');
  await expect(row(page, 'tavoli')).toContainText('http: https://mcp.example.test');
  await expect(row(page, 'tavoli')).toContainText('Nincs Authorization fejléc.');
  await expect(card(page)).toContainText('csak neveket tárol');
});

test('stdio szerver hozzáadása: az argumentumok és a deklarált változó címkék, a szerver oldali név a környezet neveinek listájából választható, a PUT törzs csak neveket hordoz (AC16, AC17)', async ({
  page,
}) => {
  const modal = await openAddModal(page);

  await modal.getByRole('textbox', { name: 'Név', exact: true }).fill('github-sajat');
  await modal.getByRole('textbox', { name: 'Parancs', exact: true }).fill('npx');
  const argumentsField = modal.getByRole('textbox', { name: 'Argumentumok', exact: true });
  await argumentsField.fill('-y');
  await argumentsField.press('Enter');
  await argumentsField.fill('@mcp/github');
  await argumentsField.press('Enter');
  const declared = modal.getByRole('textbox', { name: 'Deklarált környezeti változók', exact: true });
  await declared.fill('GITHUB_TOKEN');
  await declared.press('Enter');

  const binding = modal.getByRole('combobox', { name: 'Szerver oldali változó: GITHUB_TOKEN', exact: true });
  await expect(binding).toHaveText('azonos név (GITHUB_TOKEN)');
  await binding.click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
    'azonos név (GITHUB_TOKEN)',
    ...ENVIRONMENT_NAMES,
  ]);
  await page.getByRole('listbox').getByRole('option', { name: 'GITHUB_TOKEN_SAJAT', exact: true }).click();
  await expect(binding).toHaveText('GITHUB_TOKEN_SAJAT');

  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(mockState.puts).toHaveLength(1);
  expect(mockState.puts[0]?.name).toBe('github-sajat');
  expect(savedDefinition(0)).toEqual({
    type: 'stdio',
    command: 'npx',
    args: ['-y', '@mcp/github'],
    envNames: ['GITHUB_TOKEN'],
    envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT' },
  });
  await expect(row(page, 'github-sajat')).toContainText('Változók: GITHUB_TOKEN ← GITHUB_TOKEN_SAJAT');
});

test('http szerver hozzáadása: az Authorization fejlécet adó változó a listából választható, a "nincs" opció null értéket ad', async ({
  page,
}) => {
  const modal = await openAddModal(page);

  await modal.getByRole('textbox', { name: 'Név', exact: true }).fill('masik');
  await chooseSelectOption(page, modal.getByRole('combobox', { name: 'Típus', exact: true }), 'http (távoli szerver)');
  await modal.getByRole('textbox', { name: 'URL', exact: true }).fill('https://masik.example.test');
  const auth = modal.getByRole('combobox', { name: 'Authorization fejléc: szerver oldali változó', exact: true });
  await expect(auth).toHaveText('nincs');
  await chooseSelectOption(page, auth, 'MCP_TOKEN');
  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(savedDefinition(0)).toEqual({ type: 'http', url: 'https://masik.example.test', authEnvName: 'MCP_TOKEN' });
  await expect(row(page, 'masik')).toContainText('Authorization fejléc: a(z) MCP_TOKEN változó értéke.');

  await row(page, 'masik').getByRole('button', { name: 'Szerkesztés: masik' }).click();
  const editModal = dialog(page, 'MCP szerver szerkesztése');
  await chooseSelectOption(
    page,
    editModal.getByRole('combobox', { name: 'Authorization fejléc: szerver oldali változó', exact: true }),
    'nincs',
  );
  await editModal.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(editModal).toBeHidden();
  expect(savedDefinition(1)).toEqual({ type: 'http', url: 'https://masik.example.test', authEnvName: null });
});

test('szerkesztésnél a név nem módosítható, a PUT a tárolt névre megy a módosított definícióval', async ({ page }) => {
  await page.goto('/settings');
  await row(page, 'github').getByRole('button', { name: 'Szerkesztés: github' }).click();
  const modal = dialog(page, 'MCP szerver szerkesztése');

  await expect(modal.getByRole('textbox', { name: 'Név', exact: true })).toHaveAttribute('readonly', '');
  await expect(modal.getByText('A név nem módosítható')).toBeVisible();
  await expect(modal.getByRole('textbox', { name: 'Parancs', exact: true })).toHaveValue('npx');
  await expect(modal.getByRole('combobox', { name: 'Szerver oldali változó: GITHUB_TOKEN' })).toHaveText(
    'GITHUB_TOKEN_CEG',
  );

  await modal.getByRole('textbox', { name: 'Parancs', exact: true }).fill('node');
  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(mockState.puts[0]?.name).toBe('github');
  expect(savedDefinition(0)).toMatchObject({ type: 'stdio', command: 'node' });
  await expect(row(page, 'github')).toContainText('stdio: node -y @mcp/github');
});

test('érvénytelen értékre a hiba a mező alatt jelenik meg, és a PUT nem megy ki', async ({ page }) => {
  const modal = await openAddModal(page);

  await expect(modal.getByRole('alert')).toHaveCount(0);
  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();

  await expect(modal.getByRole('alert')).toHaveText([
    'A név csak betűt, számot, aláhúzást és kötőjelet tartalmazhat, nem lehet üres, és nem lehet __proto__, constructor vagy prototype.',
    'A mező nem lehet üres.',
  ]);
  // A hibaüzenet a `<label>` része, ezért a mező neve a hibával együtt áll.
  await expect(modal.getByRole('textbox', { name: /^Név/ })).toHaveAttribute('aria-invalid', 'true');

  const declared = modal.getByRole('textbox', { name: 'Deklarált környezeti változók', exact: true });
  await declared.fill('1ROSSZ');
  await declared.press('Enter');
  await expect(modal.getByRole('alert').filter({ hasText: 'betűvel vagy aláhúzással kezdődik' })).toBeVisible();

  expect(mockState.puts).toHaveLength(0);
});

test('a létező névre mentés figyelmeztet, és Felülírás gombbal menthető (a PUT a meglévő rekordot cseréli)', async ({
  page,
}) => {
  const modal = await openAddModal(page);

  await modal.getByRole('textbox', { name: 'Név', exact: true }).fill('github');
  await modal.getByRole('textbox', { name: 'Parancs', exact: true }).fill('uj-parancs');
  await expect(modal.getByRole('status').filter({ hasText: 'Már van github nevű MCP szerver' })).toHaveClass(
    /\balert--warning\b/,
  );
  await expect(modal.getByRole('button', { name: 'Mentés', exact: true })).toHaveCount(0);

  await modal.getByRole('button', { name: 'Felülírás', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(mockState.puts[0]?.name).toBe('github');
  await expect(row(page, 'github')).toContainText('stdio: uj-parancs');
  await expect(card(page).getByRole('group')).toHaveCount(2);
});

test('a szerver elutasítása a modálisban danger Alert, a modális nyitva marad', async ({ page }) => {
  mockState.isSaveFailing = true;
  const modal = await openAddModal(page);

  await modal.getByRole('textbox', { name: 'Név', exact: true }).fill('uj');
  await modal.getByRole('textbox', { name: 'Parancs', exact: true }).fill('npx');
  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();

  await expect(modal.getByRole('alert').filter({ hasText: 'A kérés nem volt érvényes.' })).toHaveClass(
    /\balert--danger\b/,
  );
  await expect(modal).toBeVisible();
});

test('a szerver környezet neveinek betöltési hibája danger Alert a választó mellett, a mentés a nevek nélkül is megy', async ({
  page,
}) => {
  mockState.isEnvironmentFailing = true;
  const modal = await openAddModal(page);

  await chooseSelectOption(page, modal.getByRole('combobox', { name: 'Típus', exact: true }), 'sse (távoli szerver)');

  await expect(modal.getByRole('alert').filter({ hasText: 'Váratlan szerver hiba történt.' })).toHaveClass(
    /\balert--danger\b/,
  );
  await modal.getByRole('textbox', { name: 'Név', exact: true }).fill('esemeny');
  await modal.getByRole('textbox', { name: 'URL', exact: true }).fill('https://sse.example.test');
  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(savedDefinition(0)).toEqual({ type: 'sse', url: 'https://sse.example.test', authEnvName: null });
});

test('a törlés megerősítő modálist kér, kimondja a hivatkozás következményét, és a DELETE után a sor eltűnik (O-43)', async ({
  page,
}) => {
  await page.goto('/settings');
  await row(page, 'github').getByRole('button', { name: 'Törlés: github' }).click();
  const modal = dialog(page, 'MCP szerver törlése');

  await expect(modal).toContainText('a workflow indítása a törlés után hibával áll meg');
  expect(mockState.deletes).toHaveLength(0);
  await modal.getByRole('button', { name: 'Mégse', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(mockState.deletes).toHaveLength(0);

  await row(page, 'github').getByRole('button', { name: 'Törlés: github' }).click();
  await modal.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(mockState.deletes).toEqual(['github']);
  await expect(row(page, 'github')).toHaveCount(0);
  await expect(row(page, 'tavoli')).toBeVisible();
});

test('az utolsó szerver törlése után az üres állapot jelenik meg, a Hozzáadás gomb megmarad', async ({ page }) => {
  mockState.servers = [TAVOLI];
  await page.goto('/settings');

  await row(page, 'tavoli').getByRole('button', { name: 'Törlés: tavoli' }).click();
  await dialog(page, 'MCP szerver törlése').getByRole('button', { name: 'Törlés', exact: true }).click();

  await expect(card(page).getByText('Még nincs MCP szerver.')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'MCP szerver hozzáadása', exact: true })).toBeVisible();
});

test('szerkesztésnél az sse szerver URL és Authorization mezője, és a nullázott Authorization fejléces http szerver "nincs" választása töltődik be', async ({
  page,
}) => {
  mockState.servers = [ESEMENY, TAVOLI];
  await page.goto('/settings');

  await row(page, 'esemeny').getByRole('button', { name: 'Szerkesztés: esemeny' }).click();
  const sseModal = dialog(page, 'MCP szerver szerkesztése');
  await expect(sseModal.getByRole('combobox', { name: 'Típus', exact: true })).toHaveText('sse (távoli szerver)');
  await expect(sseModal.getByRole('textbox', { name: 'URL', exact: true })).toHaveValue('https://sse.example.test');
  await expect(
    sseModal.getByRole('combobox', { name: 'Authorization fejléc: szerver oldali változó', exact: true }),
  ).toHaveText('MCP_TOKEN');
  await sseModal.getByRole('button', { name: 'Mégse', exact: true }).click();
  await expect(sseModal).toBeHidden();

  await row(page, 'tavoli').getByRole('button', { name: 'Szerkesztés: tavoli' }).click();
  const httpModal = dialog(page, 'MCP szerver szerkesztése');
  await expect(
    httpModal.getByRole('combobox', { name: 'Authorization fejléc: szerver oldali változó', exact: true }),
  ).toHaveText('nincs');
});

test('a hozzárendelés nélküli deklarált változó a soron csak a nevével áll, és az argumentum címke eltávolítható, a PUT törzs már nem tartalmazza', async ({
  page,
}) => {
  const modal = await openAddModal(page);

  await modal.getByRole('textbox', { name: 'Név', exact: true }).fill('egyszeru');
  await modal.getByRole('textbox', { name: 'Parancs', exact: true }).fill('npx');
  const argumentsField = modal.getByRole('textbox', { name: 'Argumentumok', exact: true });
  await argumentsField.fill('-y');
  await argumentsField.press('Enter');
  await argumentsField.fill('felesleges');
  await argumentsField.press('Enter');
  await modal.getByRole('button', { name: 'Eltávolítás: felesleges', exact: true }).click();
  await expect(modal.getByRole('button', { name: 'Eltávolítás: felesleges', exact: true })).toHaveCount(0);
  await expect(modal.getByRole('status').filter({ hasText: 'Eltávolítva: felesleges' })).toHaveCount(1);
  const declared = modal.getByRole('textbox', { name: 'Deklarált környezeti változók', exact: true });
  await declared.fill('SAJAT_VALTOZO');
  await declared.press('Enter');
  await modal.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(savedDefinition(0)).toMatchObject({
    type: 'stdio',
    command: 'npx',
    args: ['-y'],
    envNames: ['SAJAT_VALTOZO'],
  });
  await expect(row(page, 'egyszeru')).toContainText('stdio: npx -y');
  await expect(row(page, 'egyszeru')).toContainText('Változók: SAJAT_VALTOZO');
  await expect(row(page, 'egyszeru')).not.toContainText('←');
});

test('a központi lista betöltési hibája danger Alert a kártyán, hozzáadás gomb nélkül', async ({ page }) => {
  mockState.isListFailing = true;
  await page.goto('/settings');

  await expect(card(page).getByRole('alert')).toHaveClass(/\balert--danger\b/u);
  await expect(card(page).getByRole('group')).toHaveCount(0);
});

test('a törlés hibája danger Alert a modálisban, a modális nyitva marad, a sor megmarad', async ({ page }) => {
  mockState.isDeleteFailing = true;
  await page.goto('/settings');

  await row(page, 'github').getByRole('button', { name: 'Törlés: github' }).click();
  const modal = dialog(page, 'MCP szerver törlése');
  await modal.getByRole('button', { name: 'Törlés', exact: true }).click();

  await expect(modal.getByRole('alert')).toHaveClass(/\balert--danger\b/u);
  await expect(modal).toBeVisible();
  await expect(row(page, 'github')).toBeVisible();
});
