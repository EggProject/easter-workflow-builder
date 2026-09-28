// A futás nézet gráf/transcript KÜLSŐ sáv-váltási pontjának MÉRŐ ESZKÖZE
// (2026-09-28, T-009-29, SPEC-008 14.1 O-7, `docs/research/2026-09-28-futas-nezet-sav-valtas-meres.md`).
//
// MIÉRT VAN A REPÓBAN. A szabálykönyv 12. szekciója szerint minden
// bizonyíték előállító eszköz a repóba tartozik, verziókövetve, mert amit
// munkamenetenként újra kell írni, azt munkamenetenként újra el is lehet
// rontani.
//
// A MÓDSZER a SPEC-007 5.3 szekcióé: valódi Chromium, `apps/web` preview
// build, a dokumentum vízszintes túllógása (`scrollWidth - clientWidth`) a
// vizsgált szélességeken - ugyanaz a módszer, amivel a mobil túllógás és a
// márkanév csonkolásának határa lezárult. A futás nézet vízszintes
// túllógásának HIÁNYÁT a `responsive.spec.ts` "a futás nézet egyetlen
// támogatott viewport szélességen sem lóg túl vízszintesen" tesztje már
// kapuként őrzi a design system mind a hét töréspontján (és eggyel
// alattuk); ez a jelenet ezt KIZÁRÓLAG a futás nézet két érintett tokenje
// (`--ep-screen-md`, `--ep-screen-lg`) körüli, sűrűbb rácson ismétli meg,
// és emellé méri a gráf és a transcript panel TÉNYLEGES pixelméretét a
// token mindkét oldalán: a "helyes-e a váltási pont" kérdésre (SPEC-008
// 14.1 O-7) nemcsak a túllógás hiánya, hanem a panelek gyakorlati
// használhatósága (a design system `resizable-panel` CSS pixeles
// minimuma, 80x60, `packages/ui/src/resizable/resizable.css`, fölött
// maradnak-e) is választ ad.
//
// KÉPET NEM ÍR. Csak számokat: minden mért szélesség egy `MEASUREMENT
// <json>` sort ír a szabványos kimenetre. Képernyőképet lemezre kizárólag a
// szentesített `apps/web/e2e/capture-screenshots.ts` írhat (`tooling/scripts`
// `screenshot-pipeline` invariánsai).
//
// NEM E2E TESZT, és nem kapu: állítás nincs a mért számokról, csak
// számlálás (a `toBeVisible()` hívás a lap betöltésének kivárása, nem a
// mért mennyiségről szóló állítás, az `approval-panel.ts` `openRun`
// mintája szerint).
//
// FUTTATÁS (a gépen egyszerre csak egy Playwright folyamat, legfeljebb
// három worker, `.claude/CLAUDE.md` 11. szekció):
//
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:run-view-band
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockRunView, RUN_SNAPSHOT, stepRun } from '../e2e/run-view-stream.ts';
import { mockIdleStream } from '../e2e/sse-mock.ts';

function report(scenario: string, values: Readonly<Record<string, unknown>>): void {
  console.log(`MEASUREMENT ${JSON.stringify({ scenario, ...values })}`);
}

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

function breakpointTokenValue(tokenName: string): number {
  const content = readFileSync(BREAKPOINTS_CSS_PATH, 'utf8');
  const match = new RegExp(String.raw`${tokenName}:\s*(\d+)px`).exec(content);
  if (match?.[1] === undefined) {
    throw new Error(`A ${tokenName} token nem található a breakpoints.css fájlban.`);
  }
  return Number(match[1]);
}

const MEDIUM_SCREEN_WIDTH = breakpointTokenValue('--ep-screen-md');
const LARGE_SCREEN_WIDTH = breakpointTokenValue('--ep-screen-lg');
const VIEWPORT_HEIGHT = 900;
const RUN_URL = '/run?runId=r-1';

/**
 * A design system `resizable-panel` CSS pixeles minimuma
 * (`packages/ui/src/resizable/resizable.css`), amihez a panel gyakorlati
 * használhatóságát viszonyítjuk.
 */
const PANEL_MIN_WIDTH_PX = 80;
const PANEL_MIN_HEIGHT_PX = 60;

/**
 * A vizsgált szélességek: mindkét token 64 pixellel alatta és fölötte, plusz
 * a token eggyel alatti értéke (a media query illesztésének másik oldala) -
 * a `responsive.spec.ts` "SUPPORTED_VIEWPORT_WIDTHS" mintája szerint a
 * token maga és a token-1 adja a media query mindkét oldalát, a plusz/mínusz
 * 64 pixel pedig a sáv belsejét mintázza, hogy a panelek mérete a sáv
 * KÖZEPÉN is látszódjon, ne csak a határon.
 */
const SWEEP_WIDTHS: readonly number[] = [
  ...new Set([MEDIUM_SCREEN_WIDTH, LARGE_SCREEN_WIDTH].flatMap((token) => [token - 64, token - 1, token, token + 64])),
].toSorted((a, b) => a - b);

interface RunViewGeometry {
  readonly band: 'horizontal' | 'vertical' | 'tabs' | undefined;
  readonly overflow: number;
  readonly graphSizePx: number | undefined;
  readonly transcriptSizePx: number | undefined;
  readonly graphAboveFloorPx: number | undefined;
  readonly transcriptAboveFloorPx: number | undefined;
}

/**
 * A futás nézet mért geometriája: a dokumentum vízszintes túllógása, az
 * aktuális sáv (a fülsor, illetve az elválasztó `aria-orientation`
 * attribútuma dönti el), és a két panel mérete a sáv tengelye szerint
 * (vízszintes sávban szélesség, függőleges sávban magasság).
 */
async function readRunViewGeometry(page: Page): Promise<RunViewGeometry> {
  return page.evaluate(
    ({ minWidth, minHeight }) => {
      const { document } = globalThis;
      const root = document.documentElement;
      const overflow = Math.round((root.scrollWidth - root.clientWidth) * 100) / 100;
      if (document.querySelector('[role="tablist"]') !== null) {
        return {
          band: 'tabs' as const,
          overflow,
          graphSizePx: undefined,
          transcriptSizePx: undefined,
          graphAboveFloorPx: undefined,
          transcriptAboveFloorPx: undefined,
        };
      }
      const orientation = document.querySelector('[role="separator"]')?.getAttribute('aria-orientation');
      const band = orientation === 'vertical' ? ('horizontal' as const) : ('vertical' as const);
      const graphBox = document.querySelector('.run-view-screen__graph')?.getBoundingClientRect();
      const transcriptBox = document.querySelector('.run-view-screen__transcript')?.getBoundingClientRect();
      const graphSize = band === 'vertical' ? graphBox?.height : graphBox?.width;
      const transcriptSize = band === 'vertical' ? transcriptBox?.height : transcriptBox?.width;
      const floor = band === 'vertical' ? minHeight : minWidth;
      return {
        band,
        overflow,
        graphSizePx: graphSize === undefined ? undefined : Math.round(graphSize * 100) / 100,
        transcriptSizePx: transcriptSize === undefined ? undefined : Math.round(transcriptSize * 100) / 100,
        graphAboveFloorPx: graphSize === undefined ? undefined : Math.round((graphSize - floor) * 100) / 100,
        transcriptAboveFloorPx:
          transcriptSize === undefined ? undefined : Math.round((transcriptSize - floor) * 100) / 100,
      };
    },
    { minWidth: PANEL_MIN_WIDTH_PX, minHeight: PANEL_MIN_HEIGHT_PX },
  );
}

test.describe.configure({ mode: 'serial' });

for (const width of SWEEP_WIDTHS) {
  test(`atmenet ${String(width)}x${String(VIEWPORT_HEIGHT)}`, async ({ page }) => {
    await mockIdleStream(page);
    await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun('succeeded')] });
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    await page.goto(RUN_URL);
    await expect(page.getByTestId(`rf__node-${RUN_SNAPSHOT.nodes[0]?.id ?? ''}`)).toBeVisible();
    const geometry = await readRunViewGeometry(page);
    report('atmenet', {
      width,
      mediumToken: MEDIUM_SCREEN_WIDTH,
      largeToken: LARGE_SCREEN_WIDTH,
      ...geometry,
    });
  });
}
