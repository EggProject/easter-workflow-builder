// A REPÓBAN ÉLŐ képernyőkép készítés (2026-09-09).
//
// MIÉRT VAN EZ A FÁJL A REPÓBAN. Korábban a képernyőkép készítő script a
// repón kívül, eldobható helyen élt (`/tmp/shots/`), és minden munkamenet
// újraírta. Kétszer is hibás gráf fixtúrával futott (üres `edges` tömb,
// illetve két csomópontra szűkített gráf), ezért a szállított képernyőképeken
// nem volt egyetlen él sem, és a felhasználó jogosan hitte, hogy a termék
// hibás. A bisect és a pixel mérés szerint a termékkód végig hibátlan volt
// (`docs/research/2026-09-09-graf-el-vonal-meres.md`). A védelem: a fixtúra
// és ez a script is verziókövetve van, EGYETLEN forrásból dolgoznak, és
// ugyanazt a fixtúrát a `showcase-graph.spec.ts` regressziós tesztje is
// őrzi a `test:e2e` kapun.
//
// MIÉRT PLAYWRIGHT TESZT ÉS NEM ÖNÁLLÓ NODE SCRIPT. A képernyőkép
// készítéshez pontosan ugyanaz kell, amit a `playwright.config.ts` már
// felállít: a `vite build` plusz `vite preview` webszerver a `VITE_*`
// kötelező konfigurációval, a böngésző, a viewport és a téma kezelése.
// Ezeket egy önálló script megduplikálná. A fájl neve SZÁNDÉKOSAN nem
// `.spec.ts`, ezért a `playwright.config.ts` alapértelmezett `testMatch`
// mintája nem veszi fel: kizárólag a `playwright.screenshots.config.ts`
// futtatja, tehát a `bun run test:e2e` kapu ideje és a `.nyc_output`
// tartalma sem változik tőle.
//
// A KIMENET HELYE: az `EASTER_SCREENSHOT_DIR` környezeti változó, vagy
// alapértelmezésben az `apps/web/screenshots/` mappa (a `.gitignore` kizárja).
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { measureEdgePaintDifference } from './edge-paint-measurement.ts';
import {
  countNodesOutsideCanvas,
  fitShowcaseGraphIntoView,
  installShowcaseMocks,
  openShowcaseEditor,
  SHOWCASE_GRAPH,
  SHOWCASE_SELECTED_NODE_ID,
} from './showcase-graph.ts';

const DEFAULT_OUTPUT_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshots');

const OUTPUT_DIRECTORY = process.env['EASTER_SCREENSHOT_DIR'] ?? DEFAULT_OUTPUT_DIRECTORY;

/**
 * Ugyanaz az ablakméret, amin a gráf él mérés készült
 * (`docs/research/2026-09-09-graf-el-vonal-meres.md`), és amin a korábbi
 * szállított képernyőképek is: a két kép így összehasonlítható.
 */
const VIEWPORT = { width: 1440, height: 900 };

function outputPath(name: string): string {
  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  return path.join(OUTPUT_DIRECTORY, name);
}

/**
 * A kifestett vonalak megszámolása UGYANAZON az oldalállapoton, amiről a
 * képernyőkép készült. Ez a szám a bizonyíték arra, hogy a képen ténylegesen
 * látszanak a vonalak, nem csak a DOM-ban vannak ott.
 */
async function reportPaintedEdges(page: Page, imageName: string): Promise<void> {
  for (const edge of SHOWCASE_GRAPH.edges) {
    const difference = await measureEdgePaintDifference(page, edge.id);
    // eslint-disable-next-line no-console -- ez a script kimenete, a mért szám a bizonyíték
    console.log(`${imageName} ${edge.id}: legnagyobb csatorna eltérés ${String(difference)}`);
  }
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await installShowcaseMocks(page);
    });

    test(`editor-panel-${theme}`, async ({ page }) => {
      const imageName = `editor-panel-${theme}.png`;
      await openShowcaseEditor(page);
      // ELŐSZÖR a panel nyílik meg, UTÁNA jön az illesztés: a beállítás panel
      // elveszi a vászon szélességének egy részét, tehát a nyitás előtt
      // illesztett nézet jobb széle levágódna.
      await page.getByTestId(`rf__node-${SHOWCASE_SELECTED_NODE_ID}`).click();
      await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();
      await fitShowcaseGraphIntoView(page);
      expect(await countNodesOutsideCanvas(page)).toBe(0);

      await page.screenshot({ path: outputPath(imageName) });
      await reportPaintedEdges(page, imageName);
    });

    test(`editor-no-selection-${theme}`, async ({ page }) => {
      const imageName = `editor-no-selection-${theme}.png`;
      await openShowcaseEditor(page);
      await fitShowcaseGraphIntoView(page);
      expect(await countNodesOutsideCanvas(page)).toBe(0);

      await page.screenshot({ path: outputPath(imageName) });
      await reportPaintedEdges(page, imageName);
    });

    test.describe('nagyított kivágat', () => {
      test.use({ deviceScaleFactor: 2 });

      test(`graph-edges-${theme}`, async ({ page }) => {
        await openShowcaseEditor(page);
        await fitShowcaseGraphIntoView(page);
        // A teljes vászon, kétszeres pixelsűrűségen: ezen a kivágaton az
        // elágazás három szétágazó vonala és az összefésülés három bejövő
        // vonala is közelről látszik. A kivágat a `.react-flow` KONTÉNER
        // doboza, nem a `.react-flow__viewport` transzformált gyerekéé: az
        // utóbbi a konténer méretét viseli a nagyítással szorozva, nem a
        // gráf tartalmi határait, tehát rossz kivágatot adna.
        const clip = await page.evaluate(() => {
          const canvas = globalThis.document.querySelector('.react-flow');
          if (canvas === null) {
            throw new Error('a kivágat számítása nem talált .react-flow elemet');
          }
          const rect = canvas.getBoundingClientRect();
          const left = Math.max(0, Math.floor(rect.left));
          const top = Math.max(0, Math.floor(rect.top));
          const right = Math.min(globalThis.innerWidth, Math.ceil(rect.right));
          const bottom = Math.min(globalThis.innerHeight, Math.ceil(rect.bottom));
          return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
        });
        await page.screenshot({ path: outputPath(`graph-edges-${theme}.png`), clip });
      });
    });
  });
}
