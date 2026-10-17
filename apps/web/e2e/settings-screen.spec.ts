// A Beállítások képernyő e2e (PLAN-009 T-009-59, SPEC-008 5.10, 5.11, O-31,
// O-32, 114. és 115. kritérium): a topnav harmadik linkje a `/settings`
// útvonalra visz, a választó a tárolt értéket mutatja, a választás hálózati
// kérés nélkül az `eggGraphEditorUndoModifier` kulcsba íródik, és a szerkesztő
// ezt követő betöltése a kiválasztott módosítót használja.
//
// Minden választás más tárolt értékről indul, mint amit beír, és a felhasználói
// ügynök is úgy van rögzítve, hogy a kiinduló érték a másik módosítót adná:
// így a mért viselkedés csak a választásból jöhet.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
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

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
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
  await expect(page.getByRole('region', { name: 'Szerkesztő' })).toBeVisible();
  await expect(page.getByLabel(ROW_LABEL)).toBeVisible();
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
