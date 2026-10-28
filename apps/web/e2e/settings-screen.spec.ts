// A Beállítások képernyő e2e (PLAN-009 T-009-59, SPEC-008 5.10, 5.11, O-31,
// O-32, 114. és 115. kritérium): a topnav harmadik linkje a `/settings`
// útvonalra visz, a választó a tárolt értéket mutatja, a választás hálózati
// kérés nélkül az `eggGraphEditorUndoModifier` kulcsba íródik, és a szerkesztő
// ezt követő betöltése a kiválasztott módosítót használja.
//
// Minden választás más tárolt értékről indul, mint amit beír, és a felhasználói
// ügynök is úgy van rögzítve, hogy a kiinduló érték a másik módosítót adná:
// így a mért viselkedés csak a választásból jöhet.
import {
  SetConcurrencyLimitRequestSchema,
  UpdateSettingsRequestSchema,
  type ConcurrencyLimitView,
  type ConnectionTestResponse,
  type ProviderSummary,
  type RouteId,
  type SettingsRecord,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { expectHorizontallyInside } from './expect-horizontally-inside.ts';
import { createRequestGate } from './request-gate.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { chooseSelectOption, expectSelectedLabel } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';
import { MACOS_CHROME_USER_AGENT, WINDOWS_CHROME_USER_AGENT } from './user-agent.ts';

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

const SETTINGS_WITH_DELTAS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: true };

const CONNECTION_OK: ConnectionTestResponse = { succeeded: true, errorMessage: null };

const CONNECTION_FAILED_WITHOUT_MESSAGE: ConnectionTestResponse = { succeeded: false, errorMessage: null };

const PROVIDERS: readonly ProviderSummary[] = [
  { id: 'claude-subscription', displayName: 'Claude Code', models: [], requiredEnvNames: [] },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    models: [],
    requiredEnvNames: [['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'], ['ANTHROPIC_BASE_URL']],
  },
];

const CLAUDE_LIMIT: ConcurrencyLimitView = {
  providerId: 'claude-subscription',
  configuredMaxConcurrentSteps: null,
  suggestion: { suggestedLimit: null, note: 'Erre a providerre nincs mért párhuzamossági javaslat.' },
};

const MINIMAX_LIMIT: ConcurrencyLimitView = {
  providerId: 'minimax',
  configuredMaxConcurrentSteps: null,
  suggestion: { suggestedLimit: 3, note: 'A javasolt érték mérési ALSÓ KORLÁT.' },
};

const CONCURRENCY_LIMITS: readonly ConcurrencyLimitView[] = [CLAUDE_LIMIT, MINIMAX_LIMIT];

/**
 * A sor beállított korlátja nélkül (a `DELETE` válasza utáni állapot).
 */
function withoutConfiguredLimit(limit: ConcurrencyLimitView): ConcurrencyLimitView {
  return { ...limit, configuredMaxConcurrentSteps: null };
}

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

/**
 * A beállítás `localStorage` kulcsa, szándékosan kiírva (a
 * `graph-editor-undo-modifier.spec.ts` indoklása szerint): a teszt a
 * böngészőben ténylegesen megjelenő kulcsot őrzi.
 */
const UNDO_MODIFIER_STORAGE_KEY = 'eggGraphEditorUndoModifier';

const ROW_LABEL = 'Visszavonás/újra billentyű módosítója';
const AUTO_LABEL = 'Automatikus (macOS-en Cmd, máshol Ctrl)';

type ModifierKey = 'Control' | 'Meta';

interface ChoiceCase {
  readonly name: string;
  readonly userAgent: string;
  /**
   * A választás előtt tárolt érték: a felhasználói ügynökkel együtt a MÁSIK
   * módosítót adná.
   */
  readonly initial: string;
  readonly optionLabel: string;
  readonly stored: string;
  readonly working: ModifierKey;
  readonly ignored: ModifierKey;
}

const CHOICE_CASES: readonly ChoiceCase[] = [
  {
    name: 'Ctrl választás nem macOS ügynökkel (a kiinduló meta helyett)',
    userAgent: WINDOWS_CHROME_USER_AGENT,
    initial: 'meta',
    optionLabel: 'Ctrl',
    stored: 'ctrl',
    working: 'Control',
    ignored: 'Meta',
  },
  {
    name: 'Cmd választás macOS ügynökkel (a kiinduló ctrl helyett)',
    userAgent: MACOS_CHROME_USER_AGENT,
    initial: 'ctrl',
    optionLabel: 'Cmd',
    stored: 'meta',
    working: 'Meta',
    ignored: 'Control',
  },
  {
    name: 'Automatikus választás macOS ügynökkel (a kiinduló ctrl helyett)',
    userAgent: MACOS_CHROME_USER_AGENT,
    initial: 'ctrl',
    optionLabel: AUTO_LABEL,
    stored: 'auto',
    working: 'Meta',
    ignored: 'Control',
  },
  {
    name: 'Automatikus választás nem macOS ügynökkel (a kiinduló meta helyett)',
    userAgent: WINDOWS_CHROME_USER_AGENT,
    initial: 'meta',
    optionLabel: AUTO_LABEL,
    stored: 'auto',
    working: 'Control',
    ignored: 'Meta',
  },
];

/*
 * A szerver oldali mock állapota: a `PUT /api/settings` mock ezt írja, a `GET`
 * ezt adja vissza, a hívások nyoma a kérések ellenőrzéséhez gyűlik.
 */
interface ConcurrencyPutRequest {
  readonly providerId: string;
  readonly body: unknown;
}

interface ServerMockState {
  settings: SettingsRecord;
  connectionResult: ConnectionTestResponse;
  limits: readonly ConcurrencyLimitView[];
  readonly updateBodies: unknown[];
  readonly testedPaths: string[];
  /**
   * A `PUT .../concurrency-limits/{providerId}` hívások nyoma (az útvonal
   * azonosítója és a törzs), és a `DELETE` hívások providerei.
   */
  readonly limitPuts: ConcurrencyPutRequest[];
  readonly limitDeletes: string[];
  isUpdateFailing: boolean;
  /**
   * Igaz esetén a `DELETE` válasza 204 helyett 200 és JSON törzs.
   */
  isClearBodyUnexpected: boolean;
  /**
   * Az itt szereplő útvonal-azonosítóra a `mockGated` kezelők 500-as hibát
   * adnak, ahelyett hogy kiszolgálnának.
   */
  readonly failingRoutes: Set<RouteId>;
  /**
   * Az itt szereplő ígéretet a `mockGated` kezelők a válasz előtt megvárják:
   * a teszt a várakozás alatti állapotot állítja, majd kinyitja a kaput.
   */
  readonly gates: Map<RouteId, Promise<undefined>>;
}

const mockState: ServerMockState = {
  settings: SETTINGS,
  connectionResult: CONNECTION_OK,
  limits: CONCURRENCY_LIMITS,
  updateBodies: [],
  testedPaths: [],
  limitPuts: [],
  limitDeletes: [],
  isUpdateFailing: false,
  isClearBodyUnexpected: false,
  failingRoutes: new Set(),
  gates: new Map(),
};

/**
 * Egy `MockRoute`, ami a `mockState.gates` kapuját megvárja, és a
 * `mockState.failingRoutes` tagjára 500-as `internal` hibát ad.
 */
function mockGated(routeId: RouteId, respond: MockRoute['handle']): MockRoute {
  return mockRoute(routeId, async (route, url) => {
    await mockState.gates.get(routeId);
    if (mockState.failingRoutes.has(routeId)) {
      await route.fulfill(jsonBody({ code: 'internal', message: 'belső hiba' }, 500));
      return;
    }
    await respond(route, url);
  });
}

function lastPathSegment(url: URL): string {
  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
}

test.beforeEach(async ({ page }) => {
  mockState.settings = SETTINGS;
  mockState.connectionResult = CONNECTION_OK;
  mockState.limits = CONCURRENCY_LIMITS;
  mockState.updateBodies.length = 0;
  mockState.testedPaths.length = 0;
  mockState.limitPuts.length = 0;
  mockState.limitDeletes.length = 0;
  mockState.isUpdateFailing = false;
  mockState.isClearBodyUnexpected = false;
  mockState.failingRoutes.clear();
  mockState.gates.clear();
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockGated('readSettings', async (route) => route.fulfill(jsonBody(mockState.settings))),
    mockGated('listProviders', async (route) => route.fulfill(jsonBody(PROVIDERS))),
    mockGated('listConcurrencyLimits', async (route) => route.fulfill(jsonBody(mockState.limits))),
    mockGated('setConcurrencyLimit', async (route, url) => {
      const providerId = lastPathSegment(url);
      const body: unknown = route.request().postDataJSON();
      mockState.limitPuts.push({ providerId, body });
      const parsed = SetConcurrencyLimitRequestSchema.safeParse(body);
      const current = mockState.limits.find((limit) => limit.providerId === providerId);
      if (current === undefined || !parsed.success) {
        await route.fulfill(jsonBody({ code: 'invalid_request', message: 'hibás kérés' }, 400));
        return;
      }
      const updated: ConcurrencyLimitView = {
        ...current,
        configuredMaxConcurrentSteps: parsed.data.maxConcurrentSteps,
      };
      mockState.limits = mockState.limits.map((limit) => (limit.providerId === providerId ? updated : limit));
      await route.fulfill(jsonBody(updated));
    }),
    mockGated('clearConcurrencyLimit', async (route, url) => {
      const providerId = lastPathSegment(url);
      mockState.limitDeletes.push(providerId);
      mockState.limits = mockState.limits.map((limit) =>
        limit.providerId === providerId ? withoutConfiguredLimit(limit) : limit,
      );
      await (mockState.isClearBodyUnexpected ? route.fulfill(jsonBody({})) : route.fulfill({ status: 204 }));
    }),
    mockRoute('updateSettings', async (route) => {
      await mockState.gates.get('updateSettings');
      const body: unknown = route.request().postDataJSON();
      mockState.updateBodies.push(body);
      if (mockState.isUpdateFailing) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ code: 'internal', message: 'belső hiba' }),
        });
        return;
      }
      const parsed = UpdateSettingsRequestSchema.safeParse(body);
      if (parsed.success) {
        mockState.settings = {
          defaultProviderId: parsed.data.defaultProviderId ?? mockState.settings.defaultProviderId,
          persistStreamDeltas: parsed.data.persistStreamDeltas ?? mockState.settings.persistStreamDeltas,
        };
      }
      await route.fulfill(jsonBody(mockState.settings));
    }),
    mockGated('testProviderConnection', async (route, url) => {
      mockState.testedPaths.push(url.pathname);
      await route.fulfill(jsonBody(mockState.connectionResult));
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

async function readStoredPreference(page: Page): Promise<string | null> {
  return page.evaluate((key) => globalThis.localStorage.getItem(key), UNDO_MODIFIER_STORAGE_KEY);
}

/**
 * A Beállítások képernyő megnyitása egy előre tárolt értékkel. Nem
 * `addInitScript`, mert az minden későbbi betöltésnél (a szerkesztőnél is)
 * újraírná a kulcsot, és felülírná a választást.
 */
async function openSettingsWithStored(page: Page, stored: string): Promise<void> {
  await page.goto('/settings');
  await page.evaluate(
    ([key, value]) => {
      globalThis.localStorage.setItem(key, value);
    },
    [UNDO_MODIFIER_STORAGE_KEY, stored] as const,
  );
  await page.reload();
}

test('a topnav "Beállítások" linkje a /settings útvonalra visz, a morzsamenü felirata is "Beállítások"', async ({
  page,
}) => {
  await page.goto('/');

  const settingsLink = page.getByRole('link', { name: 'Beállítások' });
  await expect(settingsLink).toBeVisible();
  await settingsLink.click();

  expect(new URL(page.url()).pathname).toBe('/settings');
  await expect(
    page.getByRole('navigation', { name: 'Morzsamenü' }).getByText('Beállítások', { exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('region', { name: 'Gráf szerkesztő' })).toBeVisible();
  await expect(page.getByLabel(ROW_LABEL)).toBeVisible();
});

// A Provider kártya (SPEC-009 3.1, O-4, O-5, O-8, AC1, AC2, AC3).
const PROVIDER_LABEL = 'Globális alapértelmezett provider';

test('a Provider kártya a Párhuzamossági korlát, a Futás napló és a Gráf szerkesztő kártya fölött áll, alapértelmezés nélkül warning Alertet mutat, "nincs" opció nélkül', async ({
  page,
}) => {
  await page.goto('/settings');

  const headings = page.getByRole('heading', { level: 3 });
  await expect(headings).toHaveText(['Provider', 'Párhuzamossági korlát', 'Futás napló', 'Gráf szerkesztő']);
  const warning = page.getByRole('status').filter({ hasText: 'Nincs alapértelmezett provider' });
  await expect(warning).toHaveClass(/\balert--warning\b/);

  const select = page.getByRole('combobox', { name: PROVIDER_LABEL });
  await expect(select).toHaveText('Válassz providert');
  await select.click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Claude Code', 'MiniMax']);
});

test('az alapértelmezett provider választása PUT hívással mentődik, a hiba pedig a kód mondatával jelenik meg', async ({
  page,
}) => {
  await page.goto('/settings');
  const select = page.getByRole('combobox', { name: PROVIDER_LABEL });

  await chooseSelectOption(page, select, 'MiniMax');

  await expectSelectedLabel(select, 'MiniMax');
  expect(mockState.updateBodies).toEqual([{ defaultProviderId: 'minimax' }]);
  await expect(page.getByRole('status').filter({ hasText: 'Nincs alapértelmezett provider' })).toBeHidden();
  await expect(
    page.getByText('Szükséges környezeti változók: ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL'),
  ).toBeVisible();

  mockState.isUpdateFailing = true;
  await chooseSelectOption(page, select, 'Claude Code');
  await expect(page.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expectSelectedLabel(select, 'MiniMax');
});

test('a Kapcsolat teszt gomb alapértelmezés nélkül tiltott és megindokolt, választás után a provider tesztjét futtatja', async ({
  page,
}) => {
  await page.goto('/settings');
  const testButton = page.getByRole('button', { name: 'Kapcsolat teszt' });

  await expect(testButton).toBeDisabled();
  await expect(page.getByText('A kapcsolat teszthez válassz ki egy providert.')).toBeVisible();

  await chooseSelectOption(page, page.getByRole('combobox', { name: PROVIDER_LABEL }), 'MiniMax');
  await expect(testButton).toBeEnabled();
  await testButton.click();

  await expect(page.getByRole('status').filter({ hasText: 'A kapcsolat teszt sikeres.' })).toHaveClass(
    /\balert--success\b/,
  );
  expect(mockState.testedPaths).toEqual(['/api/providers/minimax/connection-test']);
});

test('a mentett alapértelmezett provider betöltéskor kiválasztva áll, warning nélkül', async ({ page }) => {
  mockState.settings = { defaultProviderId: 'claude-subscription', persistStreamDeltas: false };
  await page.goto('/settings');

  await expectSelectedLabel(page.getByRole('combobox', { name: PROVIDER_LABEL }), 'Claude Code');
  await expect(page.getByText('Ehhez a providerhez nem kell környezeti változó.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Nincs alapértelmezett provider' })).toBeHidden();
});

// A Provider kártya várakozás és hiba állapotai (SPEC-009 3.1, AC2, AC4).
test('az alapértelmezett provider mentése alatt a választó "Mentés…" feliratú és tiltott, a Kapcsolat teszt is tiltott', async ({
  page,
}) => {
  const gate = createRequestGate();
  await page.goto('/settings');
  const select = page.getByRole('combobox', { name: PROVIDER_LABEL });
  await expect(select).toBeVisible();
  mockState.gates.set('updateSettings', gate.passed);

  await select.click();
  await page.getByRole('listbox').getByRole('option', { name: 'MiniMax', exact: true }).click();

  await expect(select).toHaveText('Mentés…');
  await expect(select).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Kapcsolat teszt' })).toBeDisabled();
  expect(mockState.updateBodies).toEqual([]);

  gate.open();
  await expectSelectedLabel(select, 'MiniMax');
  await expect(select).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Kapcsolat teszt' })).toBeEnabled();
});

test('a kapcsolat teszt futása alatt a gomb betöltés állapotú és tiltott, a sikertelen teszt a motor szövegével danger Alert, a választás váltása elrejti', async ({
  page,
}) => {
  mockState.settings = { defaultProviderId: 'minimax', persistStreamDeltas: false };
  await page.goto('/settings');
  const select = page.getByRole('combobox', { name: PROVIDER_LABEL });
  await expectSelectedLabel(select, 'MiniMax');
  const testButton = page.getByRole('button', { name: 'Kapcsolat teszt' });
  const gate = createRequestGate();
  mockState.gates.set('testProviderConnection', gate.passed);
  mockState.connectionResult = { succeeded: false, errorMessage: 'Hiányzik az ANTHROPIC_AUTH_TOKEN' };

  await testButton.click();
  await expect(testButton).toBeDisabled();
  await expect(testButton).toHaveAttribute('aria-busy', 'true');

  gate.open();
  const failure = page.getByRole('alert');
  await expect(failure).toContainText('A kapcsolat teszt sikertelen');
  await expect(failure).toContainText('Hiányzik az ANTHROPIC_AUTH_TOKEN');
  await expect(failure).toHaveClass(/\balert--danger\b/);
  await expect(testButton).toBeEnabled();
  await expect(testButton).not.toHaveAttribute('aria-busy');

  await chooseSelectOption(page, select, 'Claude Code');
  await expect(failure).toBeHidden();
});

test('a motor üzenet nélküli sikertelen kapcsolat tesztje is danger Alert, csak a címmel', async ({ page }) => {
  mockState.settings = { defaultProviderId: 'minimax', persistStreamDeltas: false };
  mockState.connectionResult = CONNECTION_FAILED_WITHOUT_MESSAGE;
  await page.goto('/settings');

  await page.getByRole('button', { name: 'Kapcsolat teszt' }).click();

  const failure = page.getByRole('alert');
  await expect(failure).toHaveText('A kapcsolat teszt sikertelen');
  await expect(failure).toHaveClass(/\balert--danger\b/);
});

// A betöltési hibák külön tesztek, újratöltés nélkül: a `coverage-fixture.ts` a
// lefedettséget a teszt végén nyitott lapról gyűjti, tehát egy `page.reload()`
// előtti lap fedése elveszne.
test('a provider lista betöltési hibája a Provider és a Párhuzamossági korlát kártyában danger Alert, a kód mondatával', async ({
  page,
}) => {
  mockState.failingRoutes.add('listProviders');
  await page.goto('/settings');

  const providerCard = page.getByRole('region', { name: 'Provider', exact: true });
  const concurrencyCard = page.getByRole('region', { name: 'Párhuzamossági korlát', exact: true });
  await expect(providerCard.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(concurrencyCard.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(providerCard.getByRole('alert')).toHaveClass(/\balert--danger\b/);
});

test('a beállítás rekord betöltési hibája a Provider és a Futás napló kártyában danger Alert, kapcsoló nélkül', async ({
  page,
}) => {
  mockState.failingRoutes.add('readSettings');
  await page.goto('/settings');

  const providerCard = page.getByRole('region', { name: 'Provider', exact: true });
  const runLogCard = page.getByRole('region', { name: 'Futás napló', exact: true });
  await expect(providerCard.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(runLogCard.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(runLogCard.getByRole('switch')).toHaveCount(0);
});

test('betöltés alatt a Provider, a Párhuzamossági korlát és a Futás napló kártya csontváz, a betöltés után eltűnik', async ({
  page,
}) => {
  const providersGate = createRequestGate();
  const settingsGate = createRequestGate();
  const limitsGate = createRequestGate();
  mockState.gates.set('listProviders', providersGate.passed);
  mockState.gates.set('readSettings', settingsGate.passed);
  mockState.gates.set('listConcurrencyLimits', limitsGate.passed);
  await page.goto('/settings');

  const providerCard = page.getByRole('region', { name: 'Provider', exact: true });
  const concurrencyCard = page.getByRole('region', { name: 'Párhuzamossági korlát', exact: true });
  const runLogCard = page.getByRole('region', { name: 'Futás napló', exact: true });
  for (const card of [providerCard, concurrencyCard, runLogCard]) {
    await expect(card.locator('.skel').first()).toBeVisible();
  }

  // A Párhuzamossági korlát kártya a provider listára ÉS a korlátokra vár:
  // a lista betöltése után is csontváz marad, amíg a korlátok nem érkeznek.
  providersGate.open();
  await expect(providerCard.locator('.skel').first()).toBeVisible();
  await expect(concurrencyCard.locator('.skel').first()).toBeVisible();
  settingsGate.open();
  await expect(providerCard.locator('.skel')).toHaveCount(0);
  await expect(runLogCard.locator('.skel')).toHaveCount(0);
  await expect(concurrencyCard.locator('.skel').first()).toBeVisible();
  limitsGate.open();
  await expect(concurrencyCard.locator('.skel')).toHaveCount(0);
  await expect(concurrencyCard.getByRole('group')).toHaveCount(2);
});

// A Párhuzamossági korlát kártya (SPEC-009 3.1 2. pont, O-6, AC5, AC6).
const CLAUDE_NAME = 'Claude Code';
const MINIMAX_NAME = 'MiniMax';

function limitRow(page: Page, providerName: string): Locator {
  return page.getByRole('group', { name: providerName, exact: true });
}

function limitField(row: Locator, providerName: string): Locator {
  return row.getByRole('spinbutton', { name: `Egyszerre futó agent lépések száma: ${providerName}` });
}

test('a Párhuzamossági korlát kártya providerenként mutatja a beállított értéket vagy a "nincs" szöveget és a javaslatot, a mező mindig üres', async ({
  page,
}) => {
  mockState.limits = [CLAUDE_LIMIT, { ...MINIMAX_LIMIT, configuredMaxConcurrentSteps: 2 }];
  await page.goto('/settings');

  const claudeRow = limitRow(page, CLAUDE_NAME);
  const minimaxRow = limitRow(page, MINIMAX_NAME);
  await expect(claudeRow).toContainText('Nincs beállított párhuzamossági korlát.');
  await expect(claudeRow).toContainText('Nincs javaslat. Erre a providerre nincs mért párhuzamossági javaslat.');
  await expect(minimaxRow).toContainText('Beállított korlát: 2 egyszerre futó agent lépés.');
  await expect(minimaxRow).toContainText(
    'Javaslat: 3 egyszerre futó agent lépés. A javasolt érték mérési ALSÓ KORLÁT.',
  );

  // AC6: a mező üresen indul, a beállított érték csak a szövegben látszik, a
  // javaslat nem kerül a mezőbe.
  await expect(limitField(claudeRow, CLAUDE_NAME)).toHaveValue('');
  await expect(limitField(minimaxRow, MINIMAX_NAME)).toHaveValue('');
  await expect(claudeRow.getByRole('button', { name: 'Korlát törlése' })).toBeDisabled();
  await expect(minimaxRow.getByRole('button', { name: 'Korlát törlése' })).toBeEnabled();
});

test('a korlát mentése PUT hívással a mező értékével megy, a mező újra üres, a törlés DELETE hívással visszaadja a "nincs" szöveget', async ({
  page,
}) => {
  await page.goto('/settings');
  const row = limitRow(page, MINIMAX_NAME);
  const field = limitField(row, MINIMAX_NAME);
  const clearButton = row.getByRole('button', { name: 'Korlát törlése' });
  await expect(clearButton).toBeDisabled();

  await field.fill('4');
  await row.getByRole('button', { name: 'Mentés', exact: true }).click();

  await expect(row).toContainText('Beállított korlát: 4 egyszerre futó agent lépés.');
  await expect(field).toHaveValue('');
  await expect(row.getByRole('alert')).toBeHidden();
  expect(mockState.limitPuts).toEqual([{ providerId: 'minimax', body: { maxConcurrentSteps: 4 } }]);
  expect(mockState.limitDeletes).toEqual([]);
  // A másik provider sora érintetlen.
  await expect(limitRow(page, CLAUDE_NAME)).toContainText('Nincs beállított párhuzamossági korlát.');

  await expect(clearButton).toBeEnabled();
  await clearButton.click();

  await expect(row).toContainText('Nincs beállított párhuzamossági korlát.');
  await expect(clearButton).toBeDisabled();
  expect(mockState.limitDeletes).toEqual(['minimax']);
  expect(mockState.limitPuts).toHaveLength(1);
});

test('nem pozitív egész értékre a hiba a mező alatt áll, a PUT nem megy ki; érvényes értékre a hiba eltűnik és a mentés kimegy', async ({
  page,
}) => {
  await page.goto('/settings');
  const row = limitRow(page, MINIMAX_NAME);
  const field = limitField(row, MINIMAX_NAME);
  const saveButton = row.getByRole('button', { name: 'Mentés', exact: true });
  const fieldError = row.getByRole('alert');
  // Még nem volt beküldési kísérlet, a mező nincs érintve: nincs hiba.
  await expect(fieldError).toBeHidden();

  for (const invalidDraft of ['', '0', '-3', '1.5']) {
    await field.fill(invalidDraft);
    await saveButton.click();
    await expect(fieldError).toHaveText('Pozitív egész számot adj meg.');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
  }
  expect(mockState.limitPuts).toEqual([]);

  await field.fill('5');
  await expect(fieldError).toBeHidden();
  await saveButton.click();
  await expect(row).toContainText('Beállított korlát: 5 egyszerre futó agent lépés.');
  expect(mockState.limitPuts).toEqual([{ providerId: 'minimax', body: { maxConcurrentSteps: 5 } }]);
});

test('a korlát mentése és törlése alatt mindkét gomb tiltott, a futó művelet gombja betöltés állapotú', async ({
  page,
}) => {
  mockState.limits = [CLAUDE_LIMIT, { ...MINIMAX_LIMIT, configuredMaxConcurrentSteps: 2 }];
  await page.goto('/settings');
  const row = limitRow(page, MINIMAX_NAME);
  const saveButton = row.getByRole('button', { name: 'Mentés', exact: true });
  const clearButton = row.getByRole('button', { name: 'Korlát törlése' });
  await expect(row).toContainText('Beállított korlát: 2');

  const saveGate = createRequestGate();
  mockState.gates.set('setConcurrencyLimit', saveGate.passed);
  await limitField(row, MINIMAX_NAME).fill('6');
  await saveButton.click();
  await expect(saveButton).toBeDisabled();
  await expect(saveButton).toHaveAttribute('aria-busy', 'true');
  await expect(clearButton).toBeDisabled();
  await expect(clearButton).not.toHaveAttribute('aria-busy');
  await expect(row).toContainText('Beállított korlát: 2');
  saveGate.open();
  await expect(row).toContainText('Beállított korlát: 6');
  await expect(saveButton).toBeEnabled();
  await expect(saveButton).not.toHaveAttribute('aria-busy');

  const clearGate = createRequestGate();
  mockState.gates.set('clearConcurrencyLimit', clearGate.passed);
  await clearButton.click();
  await expect(clearButton).toBeDisabled();
  await expect(clearButton).toHaveAttribute('aria-busy', 'true');
  await expect(saveButton).toBeDisabled();
  await expect(saveButton).not.toHaveAttribute('aria-busy');
  await expect(row).toContainText('Beállított korlát: 6');
  clearGate.open();
  await expect(row).toContainText('Nincs beállított párhuzamossági korlát.');
  await expect(saveButton).toBeEnabled();
});

test('a mentés és a törlés hibája danger Alert a sorban, a megjelenített érték változatlan; a következő művelet törli a hibát', async ({
  page,
}) => {
  mockState.limits = [CLAUDE_LIMIT, { ...MINIMAX_LIMIT, configuredMaxConcurrentSteps: 2 }];
  await page.goto('/settings');
  const row = limitRow(page, MINIMAX_NAME);
  const failure = row.getByRole('alert');

  mockState.failingRoutes.add('setConcurrencyLimit');
  await limitField(row, MINIMAX_NAME).fill('4');
  await row.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(failure).toHaveText('Váratlan szerver hiba történt.');
  await expect(failure).toHaveClass(/\balert--danger\b/);
  await expect(row).toContainText('Beállított korlát: 2 egyszerre futó agent lépés.');

  mockState.failingRoutes.clear();
  mockState.failingRoutes.add('clearConcurrencyLimit');
  await row.getByRole('button', { name: 'Korlát törlése' }).click();
  await expect(failure).toHaveText('Váratlan szerver hiba történt.');
  await expect(row).toContainText('Beállított korlát: 2 egyszerre futó agent lépés.');

  mockState.failingRoutes.clear();
  await limitField(row, MINIMAX_NAME).fill('7');
  await row.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(row).toContainText('Beállított korlát: 7 egyszerre futó agent lépés.');
  await expect(failure).toBeHidden();
});

test('a törlés 204 helyett törzset adó válasza hiba a sorban, a megjelenített érték változatlan', async ({ page }) => {
  mockState.limits = [CLAUDE_LIMIT, { ...MINIMAX_LIMIT, configuredMaxConcurrentSteps: 2 }];
  mockState.isClearBodyUnexpected = true;
  await page.goto('/settings');
  const row = limitRow(page, MINIMAX_NAME);

  await row.getByRole('button', { name: 'Korlát törlése' }).click();

  await expect(row.getByRole('alert')).toHaveText('A szerver váratlan választ adott ((gyökér)).');
  await expect(row).toContainText('Beállított korlát: 2 egyszerre futó agent lépés.');
});

test('a korlátok listájának betöltési hibája danger Alert a kártyán, sorok nélkül', async ({ page }) => {
  mockState.failingRoutes.add('listConcurrencyLimits');
  await page.goto('/settings');

  const concurrencyCard = page.getByRole('region', { name: 'Párhuzamossági korlát', exact: true });
  await expect(concurrencyCard.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(concurrencyCard.getByRole('group')).toHaveCount(0);
});

test('a provider listában nem szereplő azonosítójú korlát sora az azonosítót mutatja névként', async ({ page }) => {
  mockState.limits = [{ ...CLAUDE_LIMIT, providerId: 'ismeretlen-provider' }];
  await page.goto('/settings');

  await expect(limitRow(page, 'ismeretlen-provider')).toContainText('Nincs beállított párhuzamossági korlát.');
});

// A Futás napló kártya (SPEC-009 3.1 3. pont, O-7, AC7).
const DELTA_SWITCH_LABEL = 'Delta események tárolása';

/**
 * A kapcsoló váltása a megrajzolt sávra kattintással: a `Switch` natív inputja
 * rejtett (`pointer-events: none`), a sávot (`.ctrl__switch`) pedig a saját
 * `<label>` burkolója a kattintást az inputra továbbítja. Szerepe nincs, tehát
 * a locator sorrendjében az utolsó (CSS) eszköz (`workflow-list.spec.ts` azonos
 * indoklása a jelölőnégyzetre).
 */
async function toggleDeltaSwitch(page: Page): Promise<void> {
  await page.getByRole('region', { name: 'Futás napló', exact: true }).locator('.ctrl__switch').click();
}

test('a Futás napló kártya a tárolt értéket mutatja, kikapcsolt alapértékkel, a "csak az ezután indított futásokra hat" mondattal', async ({
  page,
}) => {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Futás napló', exact: true });
  const deltaSwitch = card.getByRole('switch', { name: DELTA_SWITCH_LABEL });

  await expect(deltaSwitch).not.toBeChecked();
  await expect(card).toContainText('A beállítás csak az ezután indított futásokra hat');
  await expect(deltaSwitch).toHaveAccessibleDescription(/csak az ezután indított futásokra hat/);

  mockState.settings = SETTINGS_WITH_DELTAS;
  await page.reload();
  await expect(card.getByRole('switch', { name: DELTA_SWITCH_LABEL })).toBeChecked();
});

test('a kapcsoló váltása azonnal PUT hívás a persistStreamDeltas mezővel, a válasz értékét mutatja, mindkét irányban', async ({
  page,
}) => {
  await page.goto('/settings');
  const deltaSwitch = page.getByRole('switch', { name: DELTA_SWITCH_LABEL });
  await expect(deltaSwitch).not.toBeChecked();

  await toggleDeltaSwitch(page);
  await expect(deltaSwitch).toBeChecked();
  expect(mockState.updateBodies).toEqual([{ persistStreamDeltas: true }]);

  await toggleDeltaSwitch(page);
  await expect(deltaSwitch).not.toBeChecked();
  expect(mockState.updateBodies).toEqual([{ persistStreamDeltas: true }, { persistStreamDeltas: false }]);
  // A Provider kártya alapértelmezése a mentésektől érintetlen.
  await expect(page.getByRole('status').filter({ hasText: 'Nincs alapértelmezett provider' })).toBeVisible();
});

test('a mentés alatt a kapcsoló tiltott és a régi értéket mutatja, "Mentés…" jelzéssel; a válasz után az új érték áll', async ({
  page,
}) => {
  const gate = createRequestGate();
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Futás napló', exact: true });
  const deltaSwitch = card.getByRole('switch', { name: DELTA_SWITCH_LABEL });
  await expect(deltaSwitch).toBeEnabled();
  mockState.gates.set('updateSettings', gate.passed);

  await toggleDeltaSwitch(page);
  await expect(card.getByRole('status')).toHaveText('Mentés…');
  await expect(deltaSwitch).toBeDisabled();
  await expect(deltaSwitch).not.toBeChecked();

  gate.open();
  await expect(card.getByRole('status')).toBeHidden();
  await expect(deltaSwitch).toBeEnabled();
  await expect(deltaSwitch).toBeChecked();
});

test('a kapcsoló mentésének hibája danger Alert a kód mondatával, a kapcsoló a legutóbb mentett értéken marad', async ({
  page,
}) => {
  await page.goto('/settings');
  const card = page.getByRole('region', { name: 'Futás napló', exact: true });
  const deltaSwitch = card.getByRole('switch', { name: DELTA_SWITCH_LABEL });
  await expect(deltaSwitch).toBeEnabled();

  mockState.isUpdateFailing = true;
  await toggleDeltaSwitch(page);
  await expect(card.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.');
  await expect(card.getByRole('alert')).toHaveClass(/\balert--danger\b/);
  await expect(deltaSwitch).not.toBeChecked();
  await expect(deltaSwitch).toBeEnabled();
});

test('üres tárolónál a választó az Automatikus értéket mutatja, három opcióval, sm méretben', async ({ page }) => {
  await page.goto('/settings');

  const select = page.getByLabel(ROW_LABEL);
  await expectSelectedLabel(select, AUTO_LABEL);
  await expect(select).toHaveClass(/\bselect--sm\b/);
  await select.click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText([AUTO_LABEL, 'Ctrl', 'Cmd']);
});

test('a tárolt értéket mutatja: meta esetén "Cmd", ismeretlen érték esetén az Automatikus', async ({ page }) => {
  await openSettingsWithStored(page, 'meta');
  await expectSelectedLabel(page.getByLabel(ROW_LABEL), 'Cmd');

  await page.evaluate((key) => {
    globalThis.localStorage.setItem(key, 'cmd');
  }, UNDO_MODIFIER_STORAGE_KEY);
  await page.reload();
  await expectSelectedLabel(page.getByLabel(ROW_LABEL), AUTO_LABEL);
});

// A kulcsba írás és a hálózati kérés hiánya külön teszt, navigáció nélkül: a
// lefedettséget a `coverage-fixture.ts` a teszt végén, az akkor nyitott lapról
// gyűjti, tehát a szerkesztőre navigáló teszt a Beállítások lap fedését elveszítené.
for (const choiceCase of CHOICE_CASES.slice(0, 3)) {
  const { initial, optionLabel, stored } = choiceCase;

  test(`a(z) "${optionLabel}" választása hálózati kérés nélkül a(z) "${stored}" értéket írja a kulcsba (a kiinduló "${initial}" helyett)`, async ({
    page,
  }) => {
    await openSettingsWithStored(page, initial);
    // A Provider kártya betöltésének kérései (providerek, beállítások) a
    // választás előtt lezárulnak: a választó csak ekkor jelenik meg.
    await expect(page.getByRole('combobox', { name: PROVIDER_LABEL })).toBeVisible();
    const apiRequests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) {
        apiRequests.push(`${request.method()} ${url.pathname}`);
      }
    });

    await chooseSelectOption(page, page.getByLabel(ROW_LABEL), optionLabel);

    await expectSelectedLabel(page.getByLabel(ROW_LABEL), optionLabel);
    await expect.poll(async () => readStoredPreference(page)).toBe(stored);
    expect(apiRequests).toEqual([]);
  });
}

for (const choiceCase of CHOICE_CASES) {
  const { name, userAgent, initial, optionLabel, stored, working, ignored } = choiceCase;

  test.describe(name, () => {
    test.use({ userAgent });

    test('a választás után a szerkesztő következő betöltése a kiválasztott módosítót használja', async ({ page }) => {
      await openSettingsWithStored(page, initial);
      await chooseSelectOption(page, page.getByLabel(ROW_LABEL), optionLabel);
      await expect.poll(async () => readStoredPreference(page)).toBe(stored);

      await page.goto(EDITOR_URL);
      await expect(page.getByTestId('rf__node-n1')).toBeVisible();
      const nodes = page.locator('.react-flow__node');
      for (let added = 1; added <= 2; added += 1) {
        await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
        await page.getByRole('menu', { name: 'Hozzáadás' }).getByRole('menuitem', { name: 'Szkript' }).click();
        await expect(nodes).toHaveCount(1 + added);
      }

      // A másik módosító nem hat: a két billentyű együtt pontosan egy lépést
      // von vissza, és a kiválasztott módosító a következőt is.
      await page.keyboard.press(`${ignored}+z`);
      await page.keyboard.press(`${working}+z`);
      await expect(nodes).toHaveCount(2);
      await page.keyboard.press(`${working}+z`);
      await expect(nodes).toHaveCount(1);
    });
  });
}

// A kártyák elrendezése és festése mindkét témában, 320 és 1440 pixelen
// (SPEC-009 10. szekció, AC1, AC5, AC7): minden kártya és minden vezérlője
// teljes szélességében a nézetablakban áll, a kártyák és a sorok nem lógnak
// túl a saját dobozukon, a sor vezérlői nem fedik egymást, a kártya háttere és
// a kapcsoló sávja kifestett, és a kapcsoló két állapota különbözik.
const LAYOUT_WIDTHS = [320, 1440] as const;
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

async function backgroundOf(locator: Locator): Promise<string> {
  return locator.evaluate((element) => globalThis.getComputedStyle(element).backgroundColor);
}

async function overflowOf(locator: Locator): Promise<number> {
  return locator.evaluate((element) => element.scrollWidth - element.clientWidth);
}

async function expectNoOverlap(first: Locator, second: Locator): Promise<void> {
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  const isSeparatedHorizontally =
    (firstBox?.x ?? 0) + (firstBox?.width ?? 0) <= (secondBox?.x ?? 0) ||
    (secondBox?.x ?? 0) + (secondBox?.width ?? 0) <= (firstBox?.x ?? 0);
  const isSeparatedVertically =
    (firstBox?.y ?? 0) + (firstBox?.height ?? 0) <= (secondBox?.y ?? 0) ||
    (secondBox?.y ?? 0) + (secondBox?.height ?? 0) <= (firstBox?.y ?? 0);
  expect(isSeparatedHorizontally || isSeparatedVertically).toBe(true);
}

for (const theme of ['light', 'dark'] as const) {
  for (const width of LAYOUT_WIDTHS) {
    test.describe(`a Beállítások kártyái, ${theme} téma, ${String(width)} pixel`, () => {
      test.use({ colorScheme: theme });

      test.beforeEach(async ({ page }) => {
        await page.addInitScript((mode: string) => {
          globalThis.localStorage.setItem('eggTheme', mode);
        }, theme);
        // A kapcsoló sávjának színe átmenet nélkül mérhető.
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.setViewportSize({ width, height: 900 });
      });

      test('mind a négy kártya és a vezérlői a nézetablakban állnak, átfedés és túllógás nélkül, kifestve', async ({
        page,
      }) => {
        mockState.limits = [CLAUDE_LIMIT, { ...MINIMAX_LIMIT, configuredMaxConcurrentSteps: 2 }];
        await page.goto('/settings');
        if (theme === 'dark') {
          await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        } else {
          await expect(page.locator('html')).not.toHaveAttribute('data-theme');
        }

        const cardNames = ['Provider', 'Párhuzamossági korlát', 'Futás napló', 'Gráf szerkesztő'];
        for (const cardName of cardNames) {
          const card = page.getByRole('region', { name: cardName, exact: true });
          await expect(card).toBeVisible();
          await expectHorizontallyInside(page, card);
          expect(await overflowOf(card)).toBe(0);
          expect(await backgroundOf(card)).not.toBe(TRANSPARENT);
          const preferenceRows = await card.locator('.preference-row').all();
          for (const row of preferenceRows) {
            expect(await overflowOf(row)).toBe(0);
          }
        }

        const providerCard = page.getByRole('region', { name: 'Provider', exact: true });
        const warning = providerCard.getByRole('status').filter({ hasText: 'Nincs alapértelmezett provider' });
        await expectHorizontallyInside(page, warning);
        const providerSelect = providerCard.getByRole('combobox', { name: PROVIDER_LABEL });
        const connectionTest = providerCard.getByRole('button', { name: 'Kapcsolat teszt' });
        await expectHorizontallyInside(page, providerSelect);
        await expectHorizontallyInside(page, connectionTest);
        await expectNoOverlap(providerSelect, connectionTest);

        for (const providerName of [CLAUDE_NAME, MINIMAX_NAME]) {
          const row = limitRow(page, providerName);
          const field = limitField(row, providerName);
          const saveButton = row.getByRole('button', { name: 'Mentés', exact: true });
          const clearButton = row.getByRole('button', { name: 'Korlát törlése' });
          for (const control of [row, field, saveButton, clearButton]) {
            await expectHorizontallyInside(page, control);
          }
          expect(await overflowOf(row)).toBe(0);
          await expectNoOverlap(field, saveButton);
          await expectNoOverlap(field, clearButton);
          await expectNoOverlap(saveButton, clearButton);
        }

        const runLogCard = page.getByRole('region', { name: 'Futás napló', exact: true });
        const deltaSwitch = runLogCard.getByRole('switch', { name: DELTA_SWITCH_LABEL });
        const track = runLogCard.locator('.ctrl__switch');
        await expectHorizontallyInside(page, track);
        const offBackground = await backgroundOf(track);
        expect(offBackground).not.toBe(TRANSPARENT);
        await toggleDeltaSwitch(page);
        await expect(deltaSwitch).toBeChecked();
        const onBackground = await backgroundOf(track);
        expect(onBackground).not.toBe(TRANSPARENT);
        expect(onBackground).not.toBe(offBackground);

        const editorSelect = page.getByLabel(ROW_LABEL);
        await expectHorizontallyInside(page, editorSelect);
      });
    });
  }
}
