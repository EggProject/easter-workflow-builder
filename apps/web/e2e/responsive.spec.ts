// Reszponzív e2e (T-008-29): a topnav lenyíló menüje mobil viewporton, és a
// tábla másodlagos oszlopainak elrejtése a --ep-screen-lg (1024px)
// töréspont alatt (packages/ui/src/topnav-shell/topnav-shell.css,
// packages/ui/src/data-table/data-table.css).
//
// A `page.setViewportSize()` a Desktop Chrome projekten a CDP viewportot
// állítja közvetlenül, de ez NEM ugyanaz, mint egy valódi mobil eszköz
// rétegzett viewport modellje (layout viewport kontra vizuális viewport):
// a `<meta name="viewport">` hiánya csak VALÓDI mobil emulációban (isMobile,
// touch) okoz eltérést, egy egyszerűen keskenyre állított asztali ablakban
// nem. Ezt a hiányt (a `index.html`-ből valaha hiányzó viewport meta tag,
// ami miatt egy valódi telefonon a layout viewport 980px maradt volna, a
// --ep-screen-md media query pedig sosem illeszkedett volna) a fájl végén
// egy `devices['Pixel 7']` preseten futó, valódi mobil emulációs teszt
// fedi le, nem csak a `setViewportSize`-os asztali szimuláció.
import type { RunSummary, WorkflowSummary } from '@easter-workflow-builder/protocol';
import { devices, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: 'leírás',
  providerId: 'claude-subscription',
  createdAtMs: 1,
  updatedAtMs: 1,
};

/* eslint-disable unicorn/no-null -- a RunSummary nullable mezői a protokoll
   szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/run/run-record.ts). */
const RUNNING_RUN: RunSummary = {
  id: 'r-01H8XYZABCDEF0123456789',
  workflowId: 'w-alfa',
  status: 'running',
  providerId: 'claude-subscription',
  createdAtMs: 10,
  startedAtMs: 11,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};
/* eslint-enable unicorn/no-null */

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUNNING_RUN]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
});

test('768px fölött a navigáció a barban látszik, a hamburger gomb rejtett', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Futás előzmények' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Navigáció megnyitása' })).toBeHidden();
});

test('768px alatt a hamburger gomb nyitja a lenyíló navigációt', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  const toggleButton = page.getByRole('button', { name: 'Navigáció megnyitása' });
  const navigationLink = page.getByRole('link', { name: 'Futás előzmények' });

  await expect(toggleButton).toBeVisible();
  await expect(navigationLink).toBeHidden();

  await toggleButton.click();
  await expect(navigationLink).toBeVisible();
  await expect(toggleButton).toHaveAttribute('aria-expanded', 'true');
});

test('768px alatt a navigációra kattintva bezárul a lenyíló menü', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');

  await page.getByRole('button', { name: 'Navigáció megnyitása' }).click();
  await page.getByRole('link', { name: 'Futás előzmények' }).click();

  await expect(page.getByRole('heading', { name: 'Futás előzmények' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Futás előzmények' })).toBeHidden();
});

test('1024px alatt a másodlagos oszlopok (Leírás, Provider) elrejtőznek', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/');

  const table = page.getByRole('table', { name: 'Workflow-k' });
  await expect(table.getByRole('columnheader', { name: 'Név' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Leírás' })).toBeHidden();
  await expect(table.getByRole('columnheader', { name: 'Provider' })).toBeHidden();
});

test('1024px fölött minden oszlop látszik', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const table = page.getByRole('table', { name: 'Workflow-k' });
  await expect(table.getByRole('columnheader', { name: 'Leírás' })).toBeVisible();
  await expect(table.getByRole('columnheader', { name: 'Provider' })).toBeVisible();
});

// ============================================================
// REGRESSZIÓ: vízszintes túllógás mobil szélességen (2026-09-02).
//
// A MÉRT HIBA, ami ezt a blokkot indokolja. A `.app-tn__bar` nem törő
// flex sorában a brand (229px) és az akciók (142px) együtt nem fértek el
// 468px alatt, ezért a bar tartalma kilógott, és mivel a `.app-tn`
// blokk szintű, a túllógás a dokumentumra terjedt: 320px-en a
// `documentElement.scrollWidth` 427 volt a 320-as `clientWidth` mellett,
// a téma váltó gomb pedig teljesen a képernyőn kívülre került. Ezzel
// egyidejűleg a tábla `flex: 1 1 0` cellái a tartalmuk alá zsugorodtak,
// és a művelet gombok kifutottak a viewportból (375px-en a Törlés jobb
// széle 390, az Indításé 457 volt).
//
// A VIEWPORT LISTA FORRÁSA. Egyetlen kitalált szám sincs benne, két
// dokumentált forrásból áll össze:
//   1. a Playwright saját `devices` regisztere adja a mobil és tablet
//      szélességeket (a `viewport.width` mezőből olvasva, nem beírva),
//   2. a design system `design-token/breakpoints.css` fájlja adja a hét
//      `--ep-screen-*` töréspontot, plusz az egy pixellel alattuk lévő
//      szélességet, hogy a media query mindkét oldala mérve legyen.
// ============================================================

const BREAKPOINT_TOKEN_PATTERN = /--ep-screen-[a-z0-9]+:\s*(\d+)px/g;

const BREAKPOINTS_CSS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'design-token',
  'breakpoints.css',
);

/**
 * A Playwright `devices` regiszterének néhány, egymástól ténylegesen
 * eltérő szélességű bejegyzése: a legkeskenyebb máig gyártott telefontól
 * (`iPhone SE`, 320px) a tabletig.
 */
const DEVICE_NAMES = ['iPhone SE', 'iPhone 8', 'iPhone 14 Pro', 'Pixel 7', 'iPad Mini'] as const;

function deviceViewportWidths(): readonly number[] {
  return DEVICE_NAMES.map((name) => devices[name].viewport.width);
}

function designSystemBreakpointWidths(): readonly number[] {
  const content = readFileSync(BREAKPOINTS_CSS_PATH, 'utf8');
  const widths: number[] = [];
  for (const match of content.matchAll(BREAKPOINT_TOKEN_PATTERN)) {
    const rawValue = match[1];
    if (rawValue !== undefined) {
      widths.push(Number(rawValue));
    }
  }
  return widths;
}

const SUPPORTED_VIEWPORT_WIDTHS: readonly number[] = [
  ...new Set([...deviceViewportWidths(), ...designSystemBreakpointWidths().flatMap((width) => [width - 1, width])]),
].toSorted((a, b) => a - b);

const VIEWPORT_HEIGHT = 900;

/**
 * A dokumentum törzsének vízszintes túllógása pixelben. Nulla fölötti
 * érték azt jelenti, hogy az oldal vízszintesen görgethető, ami a
 * szabálykönyv 11. szekciója szerint egyetlen viewport méreten sem
 * megengedett: a széles tartalom a saját `overflow-x: auto` konténerén
 * belül görgethet, az oldal törzse nem.
 */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const root = globalThis.document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
}

test('a workflow lista egyetlen támogatott viewport szélességen sem lóg túl vízszintesen', async ({ page }) => {
  expect(SUPPORTED_VIEWPORT_WIDTHS.length).toBeGreaterThan(10);

  for (const width of SUPPORTED_VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/');
    await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();

    await expect
      .poll(async () => horizontalOverflow(page), { message: `viewport szélesség: ${String(width)}px` })
      .toBe(0);
  }
});

test('a futás előzmények egyetlen támogatott viewport szélességen sem lóg túl vízszintesen', async ({ page }) => {
  for (const width of SUPPORTED_VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/runs');
    await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();

    await expect
      .poll(async () => horizontalOverflow(page), { message: `viewport szélesség: ${String(width)}px` })
      .toBe(0);
  }
});

// A táblázat sor műveletek 2026-09-04 óta egyetlen hárompontos ikon gomb
// mögötti lebegő menübe kerültek (felhasználói kérés), a korábbi három
// önálló szöveges gomb helyett. A teszt ezért a triggert ÉS a megnyitott
// menü mindhárom elemét ellenőrzi a viewportban, nem törölve a korábbi
// állítást, hanem átfogalmazva rá.
test('a téma váltó és a workflow sor műveletek menüje minden szélességen a viewporton belül vannak', async ({
  page,
}) => {
  for (const width of SUPPORTED_VIEWPORT_WIDTHS) {
    // A `test.step` a viewport szélességet a hibaüzenetbe emeli: a
    // `toBeInViewport` maga csak arányt jelent, azt nem, melyik
    // szélességen bukott.
    await test.step(`viewport szélesség: ${String(width)}px`, async () => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/');
      await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();

      // A `ratio: 1` a teljes elem viewportba esését követeli meg, nem csak
      // az érintkezést, és a köztes, `overflow` konténerek okozta vágást is
      // elkapja - pontosan ez bukott el a hibás állapotban.
      await expect(page.getByRole('button', { name: /^Téma:/ })).toBeInViewport({ ratio: 1 });

      const trigger = page.getByRole('button', { name: /^Műveletek/ });
      await expect(trigger).toBeInViewport({ ratio: 1 });
      await trigger.click();
      for (const label of ['Átnevezés', 'Törlés', 'Indítás']) {
        await expect(page.getByRole('menuitem', { name: label })).toBeInViewport({ ratio: 1 });
      }
      // Zárás billentyűzettel, hogy a következő iteráció (`page.goto`)
      // előtt ne maradjon nyitott menü - bár az új navigáció úgyis
      // eltünteti, ez explicit dokumentálja az Escape zárás elvárását.
      await page.keyboard.press('Escape');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  }
});

// A KORÁBBI MÉRT KIVÉTEL (320px-en a "Megszakítás" szöveges gomb 91px
// tartalmi szélessége 13px-cel meghaladta a cellára jutó helyet, ezért a
// tábla saját `overflow-x: auto` konténerén belül görgetve volt csak
// elérhető) 2026-09-04 óta NEM ÁLL FENN: a gomb ikon gombbá vált
// (`.btn--icon`, 28px szélesség `sm` méretben), ami jelentősen a korábbi
// 91px alatt van. A teszt ezért a szigorú, görgetés nélküli
// `toBeInViewport` állítást használja, a korábbi `scrollIntoViewIfNeeded`
// kerülőút nélkül - lásd SPEC-007 5.3 a lezárt mérésért.
test('a futás előzmények téma váltója és művelet gombja minden szélességen elérhető', async ({ page }) => {
  for (const width of SUPPORTED_VIEWPORT_WIDTHS) {
    await test.step(`viewport szélesség: ${String(width)}px`, async () => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await page.goto('/runs');
      await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();

      await expect(page.getByRole('button', { name: /^Téma:/ })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: /^Megszakítás/ })).toBeInViewport({ ratio: 1 });
    });
  }
});

test('a lenyíló navigáció nyitott állapotban sem okoz vízszintes túllógást', async ({ page }) => {
  const narrowWidth = SUPPORTED_VIEWPORT_WIDTHS[0];
  expect(narrowWidth).toBeDefined();

  await page.setViewportSize({ width: narrowWidth ?? 0, height: VIEWPORT_HEIGHT });
  await page.goto('/');
  await page.getByRole('button', { name: 'Navigáció megnyitása' }).click();

  await expect(page.getByRole('link', { name: 'Futás előzmények' })).toBeInViewport({ ratio: 1 });
  await expect.poll(async () => horizontalOverflow(page)).toBe(0);
});

test.describe('valódi mobil eszköz emuláció', () => {
  // A `devices['Pixel 7']` `defaultBrowserType` mezőjét nem lehet tovább
  // adni: a Playwright ezt csak a config `projects` szintjén fogadja el, egy
  // `describe`-on belüli `test.use()` új workert kényszerítene ki miatta.
  // Csak a valódi mobil rendereléshez szükséges mezőket adjuk át.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('a viewport meta tag miatt a layout viewport a tényleges eszközszélesség, nem a 980px asztali alapérték', async ({
    page,
  }) => {
    await page.goto('/');

    const layoutWidth = await page.evaluate(() => globalThis.document.documentElement.clientWidth);
    expect(layoutWidth).toBeLessThan(500);

    // Ugyanez a --ep-screen-md töréspont hatásán keresztül is látszik:
    // a hamburger gomb valódi mobil emuláción is a helyes állapotban van.
    await expect(page.getByRole('button', { name: 'Navigáció megnyitása' })).toBeVisible();
  });
});
