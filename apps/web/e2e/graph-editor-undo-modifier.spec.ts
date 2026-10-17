// A visszavonás billentyű módosítója e2e (PLAN-009 T-009-58, SPEC-008 5.10, O-31,
// 113. kritérium): az Automatikus beállítás a felhasználói ügynökből old fel
// (macOS-en Cmd, máshol Ctrl), a tárolt `ctrl` és `meta` érték az ügynöktől
// függetlenül dönt, és a tipp a feloldott módosítót mutatja. Minden eset a másik
// módosítót is méri: a nem beállított módosító egyik billentyűre sem hat.
//
// A `Cmd+Y` valós macOS Chrome-beli viselkedése itt NEM mérhető: a Chrome
// macOS-en a `⌘ + y` kombinációra az Előzmények oldalt nyitja, és hogy a lap
// `preventDefault()` hívása ezt megelőzi-e, arra nincs forrás (SPEC-008 M-122,
// nem ellenőrzött). A Linux alatti Chromium csak azt igazolja, hogy a szerkesztő
// a `metaKey` + `y` eseményre újra elvégez.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
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
 * A módosító beállítás `localStorage` kulcsa. Szándékosan itt is kiírva, nem a
 * termékkódból importálva: a teszt a DRÓTSZINTŰ szerződést (a böngészőben
 * ténylegesen ezen a néven megjelenő kulcsot) őrzi, tehát egy kulcs átnevezés
 * BUKTASSA el a tesztet.
 */
const UNDO_MODIFIER_STORAGE_KEY = 'eggGraphEditorUndoModifier';

type ModifierKey = 'Control' | 'Meta';

interface ModifierCase {
  readonly name: string;
  readonly userAgent: string;
  /**
   * A tárolt érték; `undefined` esetén a kulcs hiányzik (üres tároló).
   */
  readonly stored: string | undefined;
  /**
   * A feloldott módosító, és a másik, aminek nem szabad hatnia.
   */
  readonly working: ModifierKey;
  readonly ignored: ModifierKey;
  /**
   * A tipp jelölésének módosító neve.
   */
  readonly label: 'Ctrl' | 'Cmd';
}

const CASES: readonly ModifierCase[] = [
  {
    name: 'macOS ügynök és üres tároló: az Automatikus a Cmd',
    userAgent: MACOS_CHROME_USER_AGENT,
    stored: undefined,
    working: 'Meta',
    ignored: 'Control',
    label: 'Cmd',
  },
  {
    name: 'macOS ügynök és tárolt ctrl: a Ctrl',
    userAgent: MACOS_CHROME_USER_AGENT,
    stored: 'ctrl',
    working: 'Control',
    ignored: 'Meta',
    label: 'Ctrl',
  },
  {
    name: 'macOS ügynök és hibás tárolt érték: az Automatikus a Cmd',
    userAgent: MACOS_CHROME_USER_AGENT,
    stored: 'cmd',
    working: 'Meta',
    ignored: 'Control',
    label: 'Cmd',
  },
  {
    name: 'nem macOS ügynök és üres tároló: az Automatikus a Ctrl',
    userAgent: WINDOWS_CHROME_USER_AGENT,
    stored: undefined,
    working: 'Control',
    ignored: 'Meta',
    label: 'Ctrl',
  },
  {
    name: 'nem macOS ügynök és tárolt meta: a Cmd',
    userAgent: WINDOWS_CHROME_USER_AGENT,
    stored: 'meta',
    working: 'Meta',
    ignored: 'Control',
    label: 'Cmd',
  },
];

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

/**
 * A szerkesztő megnyitása a tárolt értékkel, és `count` darab szkript csomópont
 * felvétele a "Hozzáadás" menüből: minden felvétel egy visszavonható lépés.
 */
async function openEditorWithAddedNodes(page: Page, stored: string | undefined, count: number): Promise<void> {
  if (stored !== undefined) {
    await page.addInitScript(
      ([key, value]) => {
        globalThis.localStorage.setItem(key, value);
      },
      [UNDO_MODIFIER_STORAGE_KEY, stored] as const,
    );
  }
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  for (let added = 1; added <= count; added += 1) {
    await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
    await page.getByRole('menu', { name: 'Hozzáadás' }).getByRole('menuitem', { name: 'Szkript' }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1 + added);
  }
}

for (const modifierCase of CASES) {
  const { name, userAgent, stored, working, ignored, label } = modifierCase;

  test.describe(name, () => {
    test.use({ userAgent });

    test('a feloldott módosító visszavon és újra elvégez, a másik módosító egyik billentyűre sem hat', async ({
      page,
    }) => {
      await openEditorWithAddedNodes(page, stored, 2);
      const nodes = page.locator('.react-flow__node');
      await expect(nodes).toHaveCount(3);

      // Visszavonás: a másik módosítóval, illetve mindkét módosítóval a Z nem
      // hat, tehát a három billentyű együtt pontosan egy lépést von vissza.
      await page.keyboard.press(`${ignored}+z`);
      await page.keyboard.press('Control+Meta+z');
      await page.keyboard.press(`${working}+z`);
      await expect(nodes).toHaveCount(2);
      await page.keyboard.press(`${working}+z`);
      await expect(nodes).toHaveCount(1);

      // Újra elvégzés: a másik módosítóval sem az Y, sem a Shift+Z nem hat,
      // tehát a feloldott módosító Y billentyűje egyetlen lépést ad vissza.
      await page.keyboard.press(`${ignored}+y`);
      await page.keyboard.press(`${ignored}+Shift+Z`);
      await page.keyboard.press(`${working}+y`);
      await expect(nodes).toHaveCount(2);
      await page.keyboard.press(`${working}+Shift+Z`);
      await expect(nodes).toHaveCount(3);
    });

    test('a két gomb tippje a feloldott módosítót mutatja', async ({ page }) => {
      await openEditorWithAddedNodes(page, stored, 1);
      // A kattintás után az egér a Visszavonás gombon marad, tehát annak tippje
      // is nyitva maradhat: a tippet a felirata szűri.
      const undoTooltip = page.getByRole('tooltip').filter({ hasText: 'Visszavonás' });
      const redoTooltip = page.getByRole('tooltip').filter({ hasText: 'Újra' });

      await page.getByRole('button', { name: 'Visszavonás', exact: true }).focus();
      await expect(undoTooltip.locator('kbd')).toHaveText(`${label}+Z`);

      await page.getByRole('button', { name: 'Visszavonás', exact: true }).click();
      await page.getByRole('button', { name: 'Újra', exact: true }).focus();
      await expect(redoTooltip.locator('kbd')).toHaveText(`${label}+Shift+Z / ${label}+Y`);
    });
  });
}
