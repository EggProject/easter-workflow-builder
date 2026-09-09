// Regressziós e2e a gráf szerkesztő ÚJRATERVEZETT elrendezésére
// (felhasználói kérés, 2026-09-09). Négy állítást őriz, mind olyat, amit
// kizárólag valós böngészőben lehet igazolni, mert számított stílusra és
// tényleges geometriára épül:
//
//   1. faltól falig: az .app-content belső margója nulla ezen a screen-en,
//      és a szerkesztő gyökere a viewport teljes szélességét kitölti,
//   2. NINCS card in card: a .resizable-group nem visel kártya keretet
//      (nincs szegélye, nincs lekerekítése, nincs saját háttere),
//   3. a lábléc ragadós, benne balra a státusz, jobbra a `sm` méretű
//      összeragasztott gombcsoport,
//   4. a jobb oldali panel KIZÁRÓLAG kiválasztásra jelenik meg, és az
//      osztott elrendezés aránya a localStorage-be mentődik, majd
//      újratöltés után visszaáll.
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
      // SZÁNDÉKOSAN nem az origó: az "Elrendezés" gomb az automatikus
      // elrendezés után csak akkor állítja piszkosra a gráfot (és csak akkor
      // van mit MÉRNI a lábléc bal oldalán), ha a számított pozíció eltér a
      // mostanitól. Egy origóban álló, egyetlen csomópont épp az origó közelébe
      // kerülne vissza.
      positionX: 500,
      positionY: 500,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
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
 * A perzisztált elrendezés arány kulcsa. Szándékosan az e2e oldalon is
 * kiírva, nem a termékkódból importálva: a teszt a DRÓTSZINTŰ szerződést
 * (a böngészőben ténylegesen ezen a néven megjelenő kulcsot) őrzi, tehát
 * egy kulcs átnevezés BUKTASSA el a tesztet, ne kövesse némán.
 */
const LAYOUT_STORAGE_KEY = 'eggGraphEditorLayout';

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
});

test('a szerkesztő faltól falig ér: az oldal belső margója nulla, a vászon a teljes szélességet kapja', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  const layout = await page.evaluate(() => {
    const content = globalThis.document.querySelector('.app-content');
    const screen = globalThis.document.querySelector('.graph-editor-screen');
    if (content === null || screen === null) {
      throw new Error('a teszt nem talált .app-content es .graph-editor-screen elemet');
    }
    const contentStyle = globalThis.getComputedStyle(content);
    return {
      paddingLeft: contentStyle.paddingLeft,
      paddingRight: contentStyle.paddingRight,
      paddingTop: contentStyle.paddingTop,
      paddingBottom: contentStyle.paddingBottom,
      screenWidth: screen.getBoundingClientRect().width,
      viewportWidth: globalThis.document.documentElement.clientWidth,
    };
  });

  expect(layout.paddingLeft).toBe('0px');
  expect(layout.paddingRight).toBe('0px');
  expect(layout.paddingTop).toBe('0px');
  expect(layout.paddingBottom).toBe('0px');
  // A korábbi, kártyás állapotban a 40-40px oldalsó margó miatt a
  // szerkesztő 80px-szel keskenyebb volt a viewportnál.
  expect(layout.screenWidth).toBe(layout.viewportWidth);
});

test('NINCS card in card: a szerkesztő gyökér konténere nem visel kártya keretet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  const frame = await page.evaluate(() => {
    const group = globalThis.document.querySelector('.resizable-group');
    if (group === null) {
      throw new Error('a teszt nem talált .resizable-group elemet');
    }
    const style = globalThis.getComputedStyle(group);
    return {
      borderTopWidth: style.borderTopWidth,
      borderLeftWidth: style.borderLeftWidth,
      borderTopLeftRadius: style.borderTopLeftRadius,
      backgroundColor: style.backgroundColor,
    };
  });

  // A design system .resizable-group szabálya 1px szegélyt,
  // --ep-radius-xl (26px) lekerekítést és --ep-bg-elevated hátteret ad -
  // ez a kártya recept, amit a fogyasztó oldali felülírás töröl.
  expect(frame.borderTopWidth).toBe('0px');
  expect(frame.borderLeftWidth).toBe('0px');
  expect(frame.borderTopLeftRadius).toBe('0px');
  // Az `rgba(0, 0, 0, 0)` a `transparent` számított alakja.
  expect(frame.backgroundColor).toBe('rgba(0, 0, 0, 0)');
});

test('a lábléc ragadós, balra a státusszal és jobbra a sm méretű gombcsoporttal', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  const actionGroup = page.getByRole('group', { name: 'Gráf műveletek' });
  await expect(actionGroup).toBeVisible();
  const saveButton = actionGroup.getByRole('button', { name: 'Mentés' });
  const layoutButton = actionGroup.getByRole('button', { name: 'Elrendezés' });
  await expect(saveButton).toBeVisible();
  await expect(layoutButton).toBeVisible();

  // A gombok `sm` méretűek: a design system .btn--sm szabálya 12px
  // betűméretet ad, a md alapértelmezés 14px-et (button.css).
  for (const button of [saveButton, layoutButton]) {
    await expect(button).toHaveCSS('font-size', '12px');
  }

  // A két gomb ÖSSZERAGASZTOTT: a második gomb bal széle a első jobb
  // szélével esik egybe (a .button-group -1px margója miatt épp azon).
  const saveBox = await saveButton.boundingBox();
  const layoutBox = await layoutButton.boundingBox();
  if (saveBox === null || layoutBox === null) {
    throw new Error('hiányzó befoglaló doboz a gombcsoportban');
  }
  expect(Math.abs(layoutBox.x - (saveBox.x + saveBox.width))).toBeLessThanOrEqual(1);

  // Az elrendezés gomb megnyomása után megjelenik a státusz - így van mit
  // MÉRNI a bal oldalon, és egyben a jelzés meglétét is igazolja.
  await layoutButton.click();
  const status = page.getByRole('status');
  await expect(status).toHaveText('Mentetlen változtatások');

  const geometry = await page.evaluate(() => {
    const footer = globalThis.document.querySelector('.page-footer');
    const statusSlot = globalThis.document.querySelector('.page-footer__status');
    const actionsSlot = globalThis.document.querySelector('.page-footer__actions');
    if (footer === null || statusSlot === null || actionsSlot === null) {
      throw new Error('a teszt nem talált .page-footer sávokat');
    }
    return {
      position: globalThis.getComputedStyle(footer).position,
      bottom: globalThis.getComputedStyle(footer).bottom,
      statusLeft: statusSlot.getBoundingClientRect().left,
      actionsLeft: actionsSlot.getBoundingClientRect().left,
      footerLeft: footer.getBoundingClientRect().left,
      footerRight: footer.getBoundingClientRect().right,
      actionsRight: actionsSlot.getBoundingClientRect().right,
      viewportWidth: globalThis.document.documentElement.clientWidth,
    };
  });

  expect(geometry.position).toBe('sticky');
  expect(geometry.bottom).toBe('0px');
  // A státusz balra, a gombok jobbra: a két sáv nem cserélhető fel.
  expect(geometry.statusLeft).toBeLessThan(geometry.actionsLeft);
  // És a sáv a teljes szélességet kitölti (faltól falig).
  expect(geometry.footerLeft).toBe(0);
  expect(geometry.footerRight).toBe(geometry.viewportWidth);
  expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.viewportWidth);
});

test('a jobb oldali panel csak kiválasztásra jelenik meg, és az arány a localStorage-ből tér vissza', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  // Kiválasztás nélkül nincs panel és nincs elválasztó.
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeAttached({ attached: false });
  await expect(page.getByRole('separator')).toBeAttached({ attached: false });

  const canvasWidthWithoutPanel = await page.evaluate(() => {
    const canvas = globalThis.document.querySelector('.react-flow');
    if (canvas === null) {
      throw new Error('a teszt nem talált .react-flow elemet');
    }
    return canvas.getBoundingClientRect().width;
  });

  // Kattintásra megjelenik, és a vászon ténylegesen szűkül mellette.
  await page.getByTestId('rf__node-n1').click();
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();
  const separator = page.getByRole('separator');
  await expect(separator).toBeVisible();

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const canvas = globalThis.document.querySelector('.react-flow');
        return canvas === null ? 0 : canvas.getBoundingClientRect().width;
      }),
    )
    .toBeLessThan(canvasWidthWithoutPanel);

  // Az elválasztó billentyűzetes mozgatása átírja az arányt, és azt a
  // felület azonnal a localStorage-be menti.
  await separator.focus();
  await separator.press('ArrowLeft');

  await expect
    .poll(async () => page.evaluate((key: string) => globalThis.localStorage.getItem(key), LAYOUT_STORAGE_KEY))
    .toBe('[65,35]');

  // Újratöltés után a MENTETT arány áll vissza, nem az alapértelmezés.
  await page.reload();
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();
  await page.getByTestId('rf__node-n1').click();
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();

  const restoredSizes = await page.evaluate(() =>
    [...globalThis.document.querySelectorAll('.resizable-panel')].map(
      (panel) => globalThis.getComputedStyle(panel).flexBasis,
    ),
  );
  expect(restoredSizes).toEqual(['65%', '35%']);
});

test('dobó localStorage (szimulált privát böngészés) esetén az alapértelmezett arányra esik vissza, és a szerkesztő használható marad', async ({
  page,
}) => {
  // A `readStoredLayoutSizes` `try`/`catch` ágát (`graph-editor-layout.ts`)
  // valós böngészőben csak úgy lehet ténylegesen lefuttatni, ha a
  // `localStorage.getItem` dob - ez normál böngészésben sosem történik meg,
  // de Safari privát módban és letiltott tároláskor igen. A hook KIZÁRÓLAG
  // a szerkesztő elrendezés kulcsára dob, más kulcsot (pl. a téma módot)
  // változatlanul kiszolgál, hogy a többi felületi elem ne törjön el.
  await page.addInitScript((storageKey: string) => {
    const store = globalThis.localStorage;
    const originalGetItem = store.getItem.bind(store);
    // `Object.defineProperty` a `store` PÉLDÁNYÁN ad új tulajdonságot, nem a
    // `Storage.prototype`-on: a `this` kötés elkerülése miatt (a projekt
    // `unicorn/no-this-outside-of-class` szabálya tiltja), és hogy a
    // `sessionStorage` (ugyanazt a prototípust örökli) érintetlen maradjon.
    Object.defineProperty(store, 'getItem', {
      configurable: true,
      value: (key: string): string | null => {
        if (key === storageKey) {
          throw new Error('a tárolás le van tiltva (szimulált privát böngészés)');
        }
        return originalGetItem(key);
      },
    });
  }, LAYOUT_STORAGE_KEY);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  await page.getByTestId('rf__node-n1').click();
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();

  // A dobás elnyelve: az alapértelmezett [70, 30] arány áll be, a felület
  // nem omlik össze.
  const sizes = await page.evaluate(() =>
    [...globalThis.document.querySelectorAll('.resizable-panel')].map(
      (panel) => globalThis.getComputedStyle(panel).flexBasis,
    ),
  );
  expect(sizes).toEqual(['70%', '30%']);
});

test('érvényes JSON, de rossz alakú tárolt kulcsra is az alapértelmezett arányra esik vissza', async ({ page }) => {
  // A `readStoredLayoutSizes` `isLayoutSizePair` ellenőrzésének HAMIS ágát
  // (`graph-editor-layout.ts`) egy korábbi teszt már a MEGFELELŐ alakú
  // ([65, 35]) értékkel fedi - ez a teszt a másik oldalt, egy szintaktikailag
  // érvényes, de rossz ALAKÚ tárolt értéket ad, amit a `JSON.parse` még
  // hibátlanul feldolgoz, csak az `isLayoutSizePair` utasítja el.
  await page.addInitScript(
    (parameters: { readonly storageKey: string; readonly badShape: string }) => {
      globalThis.localStorage.setItem(parameters.storageKey, parameters.badShape);
    },
    { storageKey: LAYOUT_STORAGE_KEY, badShape: JSON.stringify({ left: 70 }) },
  );

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__node-n1')).toBeVisible();

  await page.getByTestId('rf__node-n1').click();
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();

  const sizes = await page.evaluate(() =>
    [...globalThis.document.querySelectorAll('.resizable-panel')].map(
      (panel) => globalThis.getComputedStyle(panel).flexBasis,
    ),
  );
  expect(sizes).toEqual(['70%', '30%']);
});
