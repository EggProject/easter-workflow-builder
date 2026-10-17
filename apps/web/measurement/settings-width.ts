// A topnav navigáció és a Beállítások képernyő MÉRŐ ESZKÖZE (2026-10-17,
// T-009-59, SPEC-008 5.11, `docs/research/2026-10-14-csomopont-felvetel.md`
// T-009-59 szekció).
//
// MIÉRT VAN A REPÓBAN. A szabálykönyv 12. szekciója szerint minden
// bizonyíték előállító eszköz a repóba tartozik, verziókövetve.
//
// A MÓDSZER: valódi Chromium, `apps/web` preview build, a `/settings`
// útvonal, mockolt, üres stream. Minden vizsgált szélességen:
//   - a topnav módja (`bar`: a linkek a sávban, `dropdown`: a nyitó gomb
//     látszik, a linkek a lenyíló menüben, a mérés előtt kinyitva),
//   - a három navigációs link `boundingBox()` bal és jobb széle, és a
//     legkijjebb álló link jobb szélének túllógása a nézetablakhoz képest,
//   - a `.app-tn__bar` `scrollWidth - clientWidth` különbsége,
//   - a sor feliratának és a választó triggerének doboza, a kettő
//     vízszintes átfedése (a felirat jobb széle mínusz a trigger bal széle,
//     ha a kettő egy sorban áll), a trigger feliratának csonkolása (a
//     `.select__value` `scrollWidth - clientWidth` különbsége, a kiválasztott
//     Automatikus felirattal), ugyanez a kinyitott lista Automatikus opciójára
//     (a `.menu__text` különbsége), és az `.app-content` vízszintes túllógása.
//
// KÉPET NEM ÍR. Csak számokat: minden mért szélesség egy `MEASUREMENT
// <json>` sort ír a szabványos kimenetre.
//
// NEM E2E TESZT, és nem kapu: a kapu a `responsive.spec.ts` két Beállítások
// tesztje. Állítás nincs a mért számokról, csak az előfeltételről (a képernyő
// kirajzolva).
//
// FUTTATÁS (a gépen egyszerre csak egy Playwright folyamat, legfeljebb
// három worker, `.claude/CLAUDE.md` 11. szekció):
//
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:settings-width
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockIdleStream } from '../e2e/sse-mock.ts';

/**
 * A vizsgált szélességek: a támogatott legszűkebb (320), a mobil
 * szélességek, és a `--ep-screen-sm` (640), `--ep-screen-md` (768),
 * `--ep-screen-lg` (1024) token mindkét oldala, plus két asztali szélesség.
 */
const WIDTHS: readonly number[] = [320, 340, 360, 375, 393, 639, 640, 767, 768, 769, 1023, 1024, 1280, 1440];
const VIEWPORT_HEIGHT = 900;
const NAVIGATION_LINK_NAMES = ['Workflow-k', 'Futás előzmények', 'Beállítások'];
const ROW_LABEL = 'Visszavonás/újra billentyű módosítója';
const AUTO_LABEL = 'Automatikus (macOS-en Cmd, máshol Ctrl)';

interface HorizontalBox {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function roundPixels(value: number): number {
  return Math.round(value * 100) / 100;
}

async function readBox(locator: Locator, name: string): Promise<HorizontalBox> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error(`A(z) ${name} elemnek nincs doboza.`);
  }
  return {
    left: roundPixels(box.x),
    right: roundPixels(box.x + box.width),
    top: roundPixels(box.y),
    bottom: roundPixels(box.y + box.height),
  };
}

async function readOverflow(page: Page, selector: string): Promise<number> {
  return page.locator(selector).evaluate((element) => element.scrollWidth - element.clientWidth);
}

/**
 * A kinyitott lista Automatikus opciójának csonkolása pixelben; a mérés után a
 * lista bezárul.
 */
async function readOptionTextClipping(page: Page): Promise<number> {
  const trigger = page.getByLabel(ROW_LABEL);
  await trigger.click();
  const clipped = await page
    .getByRole('listbox')
    .getByRole('option', { name: AUTO_LABEL, exact: true })
    .locator('.menu__text')
    .evaluate((element) => element.scrollWidth - element.clientWidth);
  await page.keyboard.press('Escape');
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  return clipped;
}

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`beallitasok ${String(width)}x${String(VIEWPORT_HEIGHT)}`, async ({ page }) => {
    await mockIdleStream(page);
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto('/settings');
    // Előfeltétel, nem a mért számokról szóló állítás: a mérés a kirajzolt
    // képernyőn fut.
    await expect(page.getByLabel(ROW_LABEL)).toBeVisible();
    const toggle = page.getByRole('button', { name: 'Navigáció megnyitása' });
    const mode = (await toggle.isVisible()) ? 'dropdown' : 'bar';
    if (mode === 'dropdown') {
      await toggle.click();
    }
    const navigation = page.locator('.app-tn__navigation');
    const links: (HorizontalBox & { readonly name: string })[] = [];
    for (const name of NAVIGATION_LINK_NAMES) {
      const box = await readBox(navigation.getByRole('link', { name, exact: true }), name);
      links.push({ name, ...box });
    }
    const barOverflow = await readOverflow(page, '.app-tn__bar');
    if (mode === 'dropdown') {
      await toggle.click();
    }
    const title = await readBox(page.locator('.preference-row__title'), 'felirat');
    const trigger = await readBox(page.getByLabel(ROW_LABEL), 'trigger');
    const isSameLine = title.top < trigger.bottom && trigger.top < title.bottom;
    const report = {
      scenario: 'beallitasok',
      width,
      navigationMode: mode,
      linkMaxRightPx: Math.max(...links.map((link) => link.right)),
      linkViewportOverhangPx: roundPixels(Math.max(0, ...links.map((link) => link.right - width))),
      barOverflowPx: barOverflow,
      links,
      titleWidthPx: roundPixels(title.right - title.left),
      triggerWidthPx: roundPixels(trigger.right - trigger.left),
      triggerRightOverhangPx: roundPixels(Math.max(0, trigger.right - width)),
      titleTriggerOverlapPx: isSameLine ? roundPixels(Math.max(0, title.right - trigger.left)) : 0,
      isSameLine,
      triggerValueClippedPx: await readOverflow(page, '.preference-row .select__value'),
      optionTextClippedPx: await readOptionTextClipping(page),
      contentOverflowPx: await readOverflow(page, '.app-content'),
    };
    console.log(`MEASUREMENT ${JSON.stringify(report)}`);
  });
}
