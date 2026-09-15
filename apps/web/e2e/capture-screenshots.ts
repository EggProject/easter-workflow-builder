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
//
// A BIZONYÍTÉK MANIFESZT. A képek maguk nincsenek verziókövetve (nem is
// lehetnek: a Playwright saját dokumentációja szerint "Screenshots differ
// between browsers and platforms", ezért a snapshot fájlnév is platformot
// kódol, <https://playwright.dev/docs/test-snapshots>), ezért a futás
// bizonyítéka kerül a repóba: a `screenshot-manifest.json`. Ez rögzíti annak
// a KÉT fájlnak a `sha256` lenyomatát, amiből a kép származik (a fixtúra és
// ez a script), és képenként azoknak az éleknek az azonosítóját, amiknek a
// vonala a pixel mérés szerint TÉNYLEGESEN ki volt festve. A manifesztet a
// `tooling/scripts/src/screenshot-pipeline/` regressziós tesztje ellenőrzi a
// `bun run test` kapun: ha a fixtúra vagy ez a script megváltozik és a
// szentesített csővezeték nem futott le újra, a lenyomat elavul és a kapu
// bukik. Nyers mért számok SZÁNDÉKOSAN nem kerülnek a manifesztbe (a
// `.claude/CLAUDE.md` 4. szekció 3. pontja szerint a mérési próza és a nyers
// szám a `docs/research/` alá tartozik, nem a kódba), így a manifeszt két
// futás között bájtra azonos marad, ha semmi valódi nem változott.
import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE, measureEdgePaintDifference } from './edge-paint-measurement.ts';
import {
  countNodesOutsideCanvas,
  fitShowcaseGraphIntoView,
  installShowcaseMocks,
  installShowcaseRunMocks,
  openShowcaseEditor,
  openShowcaseRunView,
  SHOWCASE_GRAPH,
  SHOWCASE_SELECTED_NODE_ID,
} from './showcase-graph.ts';

const E2E_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_OUTPUT_DIRECTORY = path.join(E2E_DIRECTORY, '..', 'screenshots');

const OUTPUT_DIRECTORY = process.env['EASTER_SCREENSHOT_DIR'] ?? DEFAULT_OUTPUT_DIRECTORY;

const MANIFEST_PATH = path.join(E2E_DIRECTORY, 'screenshot-manifest.json');

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

function sha256OfFile(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * A képenként mért, ténylegesen kifestett élek. Kizárólag ebben a futásban
 * keletkezett bejegyzéseket tartalmaz: a manifeszt minden mérés után ebből
 * íródik újra, tehát egy korábbi futás bejegyzése nem tud átszivárogni.
 */
const measuredImages = new Map<string, readonly string[]>();

/**
 * UTF-16 kódegység összehasonlító. Explicit komparátor kell (a
 * `unicorn/require-array-sort-compare` nem engedi el), és NEM `localeCompare`,
 * mert az locale függő, tehát nem determinisztikus kimenetet adna
 * (`packages/db` CLAUDE.md ugyanezen okból).
 */
function compareCodeUnits(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * A bizonyíték manifeszt kiírása. Minden mérés után lefut, tehát egy
 * megszakadt vagy worker újraindítás után részlegessé váló futás hiányos
 * manifesztet hagy, amit a `screenshot-pipeline` kapu elbuktat: a védelem
 * ZÁRVA hibázik, nem nyitva.
 */
function writeManifest(): void {
  const images = [...measuredImages]
    .map(([name, paintedEdgeIds]) => ({ name, paintedEdgeIds }))
    .toSorted((left, right) => compareCodeUnits(left.name, right.name));
  const manifest = {
    fixtureSha256: sha256OfFile(path.join(E2E_DIRECTORY, 'showcase-graph.ts')),
    captureScriptSha256: sha256OfFile(path.join(E2E_DIRECTORY, 'capture-screenshots.ts')),
    fixtureEdgeIds: SHOWCASE_GRAPH.edges.map((edge) => edge.id),
    images,
  };
  // Két szóköz behúzás és záró újsor: ez a Prettier alakja JSON fájlra, tehát
  // a `bun run format:check` kapu a generált fájlon is zöld marad.
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, undefined, 2)}\n`, 'utf8');
}

/**
 * A kifestett vonalak megszámolása UGYANAZON az oldalállapoton, amiről a
 * képernyőkép készült. Ez a szám a bizonyíték arra, hogy a képen ténylegesen
 * látszanak a vonalak, nem csak a DOM-ban vannak ott.
 *
 * Az él azonosítója CSAK a küszöböt teljesítő mérés után kerül a
 * manifesztbe, tehát a manifeszt nem tud kifestetlen vonalat bizonyítékként
 * felmutatni: a küszöb alatti mérés elbuktatja a futást.
 */
async function recordPaintedEdges(page: Page, imageName: string): Promise<void> {
  const paintedEdgeIds: string[] = [];
  for (const edge of SHOWCASE_GRAPH.edges) {
    const difference = await measureEdgePaintDifference(page, edge.id);
    // eslint-disable-next-line no-console -- ez a script kimenete, a mért szám a bizonyíték
    console.log(`${imageName} ${edge.id}: legnagyobb csatorna eltérés ${String(difference)}`);
    expect(difference).toBeGreaterThanOrEqual(EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE);
    paintedEdgeIds.push(edge.id);
  }
  measuredImages.set(imageName, paintedEdgeIds);
  writeManifest();
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT });

    // A `beforeEach` KIZÁRÓLAG a témát állítja: a mockolás tesztenként külön
    // megy, mert a szerkesztő és a futás nézet más végpontokat hív. Egyetlen
    // közös telepítés esetén a később regisztrált útvonal minta nyerne (a
    // Playwright a legutóbb regisztráltat próbálja először), és a korábbi
    // telepítés csendben soha nem szólalna meg.
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
    });

    test(`editor-panel-${theme}`, async ({ page }) => {
      const imageName = `editor-panel-${theme}.png`;
      await installShowcaseMocks(page);
      await openShowcaseEditor(page);
      // ELŐSZÖR a panel nyílik meg, UTÁNA jön az illesztés: a beállítás panel
      // elveszi a vászon szélességének egy részét, tehát a nyitás előtt
      // illesztett nézet jobb széle levágódna.
      await page.getByTestId(`rf__node-${SHOWCASE_SELECTED_NODE_ID}`).click();
      await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();
      await fitShowcaseGraphIntoView(page);
      expect(await countNodesOutsideCanvas(page)).toBe(0);

      await page.screenshot({ path: outputPath(imageName) });
      await recordPaintedEdges(page, imageName);
    });

    test(`editor-no-selection-${theme}`, async ({ page }) => {
      const imageName = `editor-no-selection-${theme}.png`;
      await installShowcaseMocks(page);
      await openShowcaseEditor(page);
      await fitShowcaseGraphIntoView(page);
      expect(await countNodesOutsideCanvas(page)).toBe(0);

      await page.screenshot({ path: outputPath(imageName) });
      await recordPaintedEdges(page, imageName);
    });

    // A FUTÁS nézet, ugyanabból a gráfból: a pillanatkép a `SHOWCASE_GRAPH`
    // származtatott alakja, tehát ugyanaz a tizenegy él van rajta, és a pixel
    // mérés ugyanazt a listát tudja igazolni. Enélkül a most megépült
    // felületre (`run-view`, `run-graph`) nulla szállított vizuális bizonyíték
    // lenne (felhasználói kérés, 2026-09-15).
    test(`run-view-${theme}`, async ({ page }) => {
      const imageName = `run-view-${theme}.png`;
      await installShowcaseRunMocks(page);
      await openShowcaseRunView(page);
      await fitShowcaseGraphIntoView(page);
      expect(await countNodesOutsideCanvas(page)).toBe(0);

      await page.screenshot({ path: outputPath(imageName) });
      await recordPaintedEdges(page, imageName);
    });

    test.describe('nagyított kivágat', () => {
      test.use({ deviceScaleFactor: 2 });

      test(`graph-edges-${theme}`, async ({ page }) => {
        const imageName = `graph-edges-${theme}.png`;
        await installShowcaseMocks(page);
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
        await page.screenshot({ path: outputPath(imageName), clip });
        // 2026-09-15 óta ez a két kép is MÉRT: korábban a nagyított kivágat
        // kimaradt a manifesztből, tehát a frissesség bizonyíték a hat
        // szállított képből csak négyre szólt.
        await recordPaintedEdges(page, imageName);
      });
    });
  });
}
