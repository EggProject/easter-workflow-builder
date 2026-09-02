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
import type { WorkflowSummary } from '@easter-workflow-builder/protocol';
import { devices } from '@playwright/test';
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

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA])))]);
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
