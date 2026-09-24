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
//
// AZ INK GYŰRŰ (user döntés 2026-09-24). Sötét témában a pötty a forrás ink
// példái szerint gyűrűt kap, halo nélkül, világosban változatlan. A gyűrű
// vizuális állítás, tehát kifestett pixel bizonyítja, nem az osztály
// (`.claude/CLAUDE.md` 11. szekció): két kép ugyanarról a kivágatról, egyszer
// a pötty `box-shadow` rétegével, egyszer anélkül, és a két kép legnagyobb
// csatorna eltérése. A mérés és a küszöb származtatása:
// `docs/research/2026-09-24-feed-indicator-ink-gyuru.md`.
import type { Locator, Page } from '@playwright/test';
import { STREAM_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { maximumChannelDifference } from './edge-paint-measurement.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';

const CONNECTING_NAME = 'Stream kapcsolat: kapcsolódás';

const PAPER_CLASS = 'ep-feed ep-feed--connecting ep-feed--md';

const INK_CLASS = 'ep-feed ep-feed--connecting ep-feed--md ep-feed--ink';

const PAPER_DOT_CLASS = 'ep-dot ep-dot--info ep-dot--md ep-dot--halo ep-dot--pulse';

const INK_DOT_CLASS = 'ep-dot ep-dot--info ep-dot--md ep-dot--ring ep-dot--pulse';

/**
 * Ennél nagyobb legnagyobb csatorna eltérés a pötty `box-shadow` rétegén
 * kifestett gyűrűt jelent. Mért szám: a gyűrű nélküli állapotok (világos
 * témában a halo, sötét témában a gyűrű előtti halo) legnagyobb értéke 34,
 * a sötét témás gyűrűé 188; a 111 a kettő egész felezőpontja
 * (`docs/research/2026-09-24-feed-indicator-ink-gyuru.md`).
 */
const RING_MINIMUM_CHANNEL_DIFFERENCE = 111;

/**
 * A kivágat ráhagyása a pötty befoglaló doboza körül, CSS pixelben: a gyűrű
 * és a halo 3px-re nyúlik túl a pöttyön (`dot.css`).
 */
const DOT_CLIP_MARGIN = 5;

const DOT_SHADOW_PROBE_ID = 'dot-shadow-probe';

async function readBoxShadow(dot: Locator): Promise<string> {
  return dot.evaluate((element) => globalThis.getComputedStyle(element).boxShadow);
}

/**
 * A pötty `box-shadow` rétegét (a halót vagy a gyűrűt) a mérés idejére
 * elnyomó stíluslap be- és kikapcsolása. A várakozás állapot alapú: a
 * számított `box-shadow` értéket figyeli, nem időzítőt.
 */
async function setDotShadowSuppressed(page: Page, dot: Locator, isSuppressed: boolean): Promise<void> {
  await page.evaluate(
    (input: { readonly styleId: string; readonly isSuppressed: boolean }) => {
      const document_ = globalThis.document;
      document_.querySelector(`#${input.styleId}`)?.remove();
      if (!input.isSuppressed) {
        return;
      }
      const created = document_.createElement('style');
      created.id = input.styleId;
      created.textContent = '.ep-dot { box-shadow: none !important; }';
      document_.head.append(created);
    },
    { styleId: DOT_SHADOW_PROBE_ID, isSuppressed },
  );
  if (isSuppressed) {
    await expect.poll(async () => readBoxShadow(dot)).toBe('none');
    return;
  }
  await expect.poll(async () => readBoxShadow(dot)).not.toBe('none');
}

/**
 * A pötty `box-shadow` rétegének kifestett hozzájárulása: a legnagyobb
 * csatorna eltérés a réteggel és anélkül készült kép között. A képernyőkép
 * `animations: 'disabled'` mellett készül, hogy a `pulse` hullám ne essen a
 * kivágatba (a Playwright dokumentációja szerint a végtelen animáció a
 * felvétel idejére a kezdő állapotára áll vissza,
 * <https://playwright.dev/docs/api/class-page#page-screenshot>).
 */
async function measureDotShadowDifference(page: Page, dot: Locator): Promise<number> {
  const box = await dot.boundingBox();
  if (box === null) {
    throw new Error('a stream jelző pöttye nem látható');
  }
  const clip = {
    x: box.x - DOT_CLIP_MARGIN,
    y: box.y - DOT_CLIP_MARGIN,
    width: box.width + 2 * DOT_CLIP_MARGIN,
    height: box.height + 2 * DOT_CLIP_MARGIN,
  };
  const paintedShot = await page.screenshot({ clip, animations: 'disabled' });
  await setDotShadowSuppressed(page, dot, true);
  const blankShot = await page.screenshot({ clip, animations: 'disabled' });
  await setDotShadowSuppressed(page, dot, false);
  return maximumChannelDifference(page, paintedShot.toString('base64'), blankShot.toString('base64'));
}

/**
 * A jelző belső pöttye. A pötty dekoratív (`aria-hidden`, a nevet a
 * `role="status"` gyökér viseli), tehát szerep, név és szöveg alapú locator
 * nem éri el; a CSS osztály az egyetlen alkalmazható út (`.claude/CLAUDE.md`
 * 11. szekció locator sorrend).
 */
function dotOf(indicator: Locator): Locator {
  return indicator.locator('.ep-dot');
}

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

  test(`${theme} témában a pötty gyűrűje ${theme === 'dark' ? 'ki van festve, halo nélkül' : 'nincs, a halo marad'}`, async ({
    page,
  }) => {
    await page.addInitScript((mode: string) => {
      globalThis.localStorage.setItem('eggTheme', mode);
    }, theme);
    const releaseStream = await holdStreamConnection(page);
    await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([])))]);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const dot = dotOf(page.getByRole('status', { name: CONNECTING_NAME }));
    await expect(dot).toHaveClass(theme === 'dark' ? INK_DOT_CLASS : PAPER_DOT_CLASS);
    const difference = await measureDotShadowDifference(page, dot);
    console.log(`stream jelző pötty ${theme}: legnagyobb csatorna eltérés ${String(difference)}`);
    if (theme === 'dark') {
      expect(difference).toBeGreaterThanOrEqual(RING_MINIMUM_CHANNEL_DIFFERENCE);
    } else {
      expect(difference).toBeLessThan(RING_MINIMUM_CHANNEL_DIFFERENCE);
    }

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

test('élő témaváltásnál a pötty gyűrűje újratöltés nélkül megjelenik, és vissza eltűnik', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'light');
  });
  const releaseStream = await holdStreamConnection(page);
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([])))]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const dot = dotOf(page.getByRole('status', { name: CONNECTING_NAME }));
  await expect(dot).toHaveClass(PAPER_DOT_CLASS);
  expect(await measureDotShadowDifference(page, dot)).toBeLessThan(RING_MINIMUM_CHANNEL_DIFFERENCE);

  await page.getByRole('button', { name: 'Téma: világos' }).click();
  await expect(page.getByRole('button', { name: 'Téma: sötét' })).toBeVisible();
  await expect(dot).toHaveClass(INK_DOT_CLASS);
  expect(await measureDotShadowDifference(page, dot)).toBeGreaterThanOrEqual(RING_MINIMUM_CHANNEL_DIFFERENCE);

  await page.getByRole('button', { name: 'Téma: sötét' }).click();
  await expect(page.getByRole('button', { name: 'Téma: rendszerkövető' })).toBeVisible();
  await expect(dot).toHaveClass(PAPER_DOT_CLASS);
  expect(await measureDotShadowDifference(page, dot)).toBeLessThan(RING_MINIMUM_CHANNEL_DIFFERENCE);

  releaseStream();
});
