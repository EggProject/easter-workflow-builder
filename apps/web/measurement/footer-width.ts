// A gráf szerkesztő lábléc gombsorának MÉRŐ ESZKÖZE (2026-10-16, T-009-51,
// SPEC-008 5.8, `docs/research/2026-10-14-csomopont-felvetel.md` 51.6 és 51.8).
//
// MIÉRT VAN A REPÓBAN. A szabálykönyv 12. szekciója szerint minden
// bizonyíték előállító eszköz a repóba tartozik, verziókövetve, mert amit
// munkamenetenként újra kell írni, azt munkamenetenként újra el is lehet
// rontani.
//
// A MÓDSZER: valódi Chromium, `apps/web` preview build, a bemutató
// szerkesztő fixtúrája (`e2e/showcase-graph.ts`). Minden vizsgált
// szélességen a lábléc hat gombjának `boundingBox()` értéke, a gombsor
// szélessége (az első gomb bal és az utolsó gomb jobb széle között), a
// legkijjebb álló gomb jobb szélének túllógása a nézetablakhoz képest, és
// a lábléc `scrollWidth - clientWidth` különbsége. A dokumentum vízszintes
// túllógása erre VAK (az `.app-content` `overflow: auto`), ezért a gombok
// saját doboza a mért mennyiség.
//
// KÉPET NEM ÍR. Csak számokat: minden mért szélesség egy `MEASUREMENT
// <json>` sort ír a szabványos kimenetre.
//
// NEM E2E TESZT, és nem kapu: a kapu a `responsive.spec.ts` lábléc tesztje
// (`toBeInViewport({ ratio: 1 })`). Állítás nincs a mért számokról.
//
// FUTTATÁS (a gépen egyszerre csak egy Playwright folyamat, legfeljebb
// három worker, `.claude/CLAUDE.md` 11. szekció):
//
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:footer-width
import { test, type Page } from '@playwright/test';
import { installShowcaseMocks, openShowcaseEditor } from '../e2e/showcase-graph.ts';

/**
 * A vizsgált szélességek: a támogatott legszűkebb (320), a mobil
 * szélességek, és a `--ep-screen-sm` token (640) mindkét oldala.
 */
const WIDTHS: readonly number[] = [320, 340, 360, 375, 393, 640, 641];
const VIEWPORT_HEIGHT = 900;
const FOOTER_BUTTON_NAMES = ['Futás indítása', 'Visszavonás', 'Újra', 'Hozzáadás', 'Mentés', 'További műveletek'];

interface ButtonBox {
  readonly name: string;
  readonly left: number;
  readonly right: number;
}

function roundPixels(value: number): number {
  return Math.round(value * 100) / 100;
}

async function readButtonBoxes(page: Page): Promise<readonly ButtonBox[]> {
  const boxes: ButtonBox[] = [];
  for (const name of FOOTER_BUTTON_NAMES) {
    const box = await page.getByRole('button', { name, exact: true }).boundingBox();
    if (box === null) {
      throw new Error(`A(z) ${name} gomb nincs a lapon.`);
    }
    boxes.push({ name, left: roundPixels(box.x), right: roundPixels(box.x + box.width) });
  }
  return boxes;
}

test.describe.configure({ mode: 'serial' });

for (const width of WIDTHS) {
  test(`lablec ${String(width)}x${String(VIEWPORT_HEIGHT)}`, async ({ page }) => {
    await installShowcaseMocks(page);
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await openShowcaseEditor(page);
    const boxes = await readButtonBoxes(page);
    const first = boxes[0];
    const last = boxes.at(-1);
    if (first === undefined || last === undefined) {
      throw new Error('Üres gomb lista.');
    }
    const footerOverflow = await page
      .locator('.page-footer')
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    const rights = boxes.map((box) => box.right);
    const report = {
      scenario: 'lablec',
      width,
      rowWidthPx: roundPixels(last.right - first.left),
      maxRightPx: Math.max(...rights),
      viewportOverhangPx: roundPixels(Math.max(0, ...rights) - width),
      footerOverflowPx: footerOverflow,
      buttons: boxes,
    };
    console.log(`MEASUREMENT ${JSON.stringify(report)}`);
  });
}
