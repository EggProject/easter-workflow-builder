// Regressziós e2e: a topnav stream állapot jelzője a design system
// `FeedIndicator` komponense, mindkét témában (2026-09-23).
//
// A HIBA, AMIT ŐRIZ. Az `abbcca5` (2026-09-05) óta a jelző nyers `<span>`
// volt, osztály, `role` és `aria-live` nélkül: a törzs 16px/400 betűjét
// örökölte a navigáció 13px/500 betűje mellett. A forrás
// (`eggproject-design-components/components/feed-indicator/`) a `.ep-feed`
// szabályon 500-as vastagságot, az alapértelmezett `md` méreten 12px-et ad,
// és a nem kompakt alak `role="status"` élő régió.
//
// A "kapcsolódás" állapot determinisztikus: a `/events` kérés a teszt végéig
// válasz nélkül áll, tehát az `EventSource` az első `CONNECTING` állapotában
// marad (`useStreamConnection`, SPEC-007 11. szekció 14. pont).
import type { Page } from '@playwright/test';
import { STREAM_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';

const CONNECTING_NAME = 'Stream kapcsolat: kapcsolódás';

const PAPER_CLASS = 'ep-feed ep-feed--connecting ep-feed--md';

const INK_CLASS = 'ep-feed ep-feed--connecting ep-feed--md ep-feed--ink';

/**
 * A `/events` kérés visszatartása a visszaadott függvény hívásáig, a
 * `skeleton-theme.spec.ts` kapu mintájával.
 */
async function holdStreamConnection(page: Page): Promise<() => void> {
  const { promise: streamGate, resolve } = Promise.withResolvers<undefined>();
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    await streamGate;
    await route.abort();
  });
  return () => {
    resolve(undefined);
  };
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} témában a "kapcsolódás" jelző a forrás FeedIndicator méretével, vastagságával és szerepével fest`, async ({
    page,
  }) => {
    await page.addInitScript((mode: string) => {
      globalThis.localStorage.setItem('eggTheme', mode);
    }, theme);
    const releaseStream = await holdStreamConnection(page);
    await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([])))]);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const indicator = page.getByRole('status', { name: CONNECTING_NAME });
    await expect(indicator).toBeVisible();
    await expect(indicator).toHaveText('kapcsolódás');
    await expect(indicator).toHaveClass(theme === 'dark' ? INK_CLASS : PAPER_CLASS);
    await expect(indicator).toHaveCSS('font-size', '12px');
    await expect(indicator).toHaveCSS('font-weight', '500');

    releaseStream();
  });
}

test('élő témaváltásnál a jelző újratöltés nélkül a forrás ink felületére vált, és vissza', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'light');
  });
  const releaseStream = await holdStreamConnection(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([])))]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const indicator = page.getByRole('status', { name: CONNECTING_NAME });
  await expect(indicator).toHaveClass(PAPER_CLASS);

  await page.getByRole('button', { name: 'Téma: világos' }).click();
  await expect(page.getByRole('button', { name: 'Téma: sötét' })).toBeVisible();
  await expect(indicator).toHaveClass(INK_CLASS);

  await page.getByRole('button', { name: 'Téma: sötét' }).click();
  await expect(page.getByRole('button', { name: 'Téma: rendszerkövető' })).toBeVisible();
  await expect(indicator).toHaveClass(PAPER_CLASS);

  releaseStream();
});
