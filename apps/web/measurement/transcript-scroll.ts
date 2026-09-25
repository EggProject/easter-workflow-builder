// A transcript lista görgetésének MÉRŐ ESZKÖZE (2026-09-25).
//
// MIÉRT VAN A REPÓBAN. A `docs/research/2026-09-23-transcript-panel-meresek.md`
// 13-16. szekciójának számait korábban repón kívüli, eldobható scriptek
// adták, amik a munkamenet végén elvesztek; ez a `.claude/CLAUDE.md` 12.
// szekciójával ütközött ("minden bizonyíték előállító eszköz a repóba
// tartozik"). A mérés ugyanazt a fixtúrát használja, mint az e2e
// (`apps/web/e2e/run-view-stream.ts`): a `node:http` SSE szervert, a REST
// mockokat és a lista méréseit.
//
// KÉPET NEM ÍR. Csak számokat: minden jelenet egy `MEASUREMENT <json>` sort
// ír a szabványos kimenetre. Képernyőképet lemezre kizárólag a szentesített
// `apps/web/e2e/capture-screenshots.ts` írhat (`tooling/scripts`
// `screenshot-pipeline` invariánsai).
//
// NEM E2E TESZT, és nem kapu. Nem `.spec.ts`, és nem az `e2e/` mappában áll,
// mert a verseny jelenet a mért változó miatt időzítőt használ: a folyamatos
// stream időköze és a kattintás véletlen fázisa maga a mérés tárgya. Az e2e
// tesztekre vonatkozó időzítő tilalom (`.claude/CLAUDE.md` 11. szekció) a
// determinisztikus állításokat védi; itt állítás nincs, csak számlálás.
//
// FUTTATÁS (a gépen egyszerre csak egy Playwright folyamat, legfeljebb három
// worker, `.claude/CLAUDE.md` 11. szekció):
//
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:transcript
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:transcript -g verseny
//
// Környezeti változók: `MEASURE_TRIALS` (a verseny kísérleteinek száma
// beállításonként, alapból 20), `MEASURE_OVERFLOW_ANCHOR` (ha `auto`, a
// lista `overflow-anchor` értékét a mérés idejére visszaállítja, így a
// böngésző görgetés rögzítése mérhető, research 17. szekció).
import type { Server } from 'node:http';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  captureEventSources,
  deliverFrameWithNextClick,
  expectLastRowFullyVisibleAtBottom,
  headerOffsetInList,
  lastRowBottomOverflow,
  openFollowingTranscript,
  REPLAYED_ROW_COUNT,
  TABBED_LAYOUT,
  textDeltaTransientFrame,
  transcriptList,
  transientFrames,
  WIDE_LAYOUT,
  type OpenStreamServer,
  type TranscriptLayout,
} from '../e2e/run-view-stream.ts';

declare global {
  // Ambiens globális változó deklaráció a `coverage-fixture.ts` mintájára.
  /**
   * A React DevTools csatlakozási pontján (`__REACT_DEVTOOLS_GLOBAL_HOOK__`)
   * gyűjtött napló: a commitok, a passzív effektek lefutása és a kattintások
   * sorrendje (`installRenderLog`).
   */
  var measureRenderLog: RenderLogEntry[] | undefined;
}

interface RenderLogEntry {
  readonly kind: 'click' | 'list-listener' | 'commit' | 'effects' | 'measured';
  readonly expanded: string;
  readonly rowTotal: string;
  readonly scrollTop: number;
}

test.describe.configure({ mode: 'serial' });

const THEMES = ['light', 'dark'] as const;

const LAYOUTS: readonly { readonly name: string; readonly layout: TranscriptLayout }[] = [
  { name: '1440x900', layout: WIDE_LAYOUT },
  { name: '375x812', layout: TABBED_LAYOUT },
];

/**
 * A kinyitás előtt érkező átmeneti sorok száma, ugyanannyi, mint az e2e-ben:
 * a lista görgethető, és az alján átmeneti sor áll.
 */
const TRANSIENT_BEFORE_EXPAND = 10;

const serverHolder: { current: Server | undefined } = { current: undefined };

test.afterEach(() => {
  serverHolder.current?.closeAllConnections();
  serverHolder.current?.close();
  serverHolder.current = undefined;
});

function report(scenario: string, values: Readonly<Record<string, unknown>>): void {
  console.log(`MEASUREMENT ${JSON.stringify({ scenario, ...values })}`);
}

function round(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 100) / 100;
}

async function open(
  page: Page,
  theme: 'light' | 'dark',
  layout: TranscriptLayout,
): Promise<{ readonly streamServer: OpenStreamServer; readonly list: Locator }> {
  const streamServer = await openFollowingTranscript(page, theme, serverHolder, layout);
  if (process.env['MEASURE_OVERFLOW_ANCHOR'] === 'auto') {
    await page.addStyleTag({ content: '.transcript-panel__list { overflow-anchor: auto !important; }' });
  }
  return { streamServer, list: transcriptList(page) };
}

async function animationFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(async (frames) => {
    for (let frame = 0; frame < frames; frame += 1) {
      await new Promise((resolve) => {
        globalThis.requestAnimationFrame(resolve);
      });
    }
  }, count);
}

/**
 * Az utolsó sor alsó éle mínusz a lista látható alsó éle, miután az érték
 * tíz egymást követő képkockán át nem változott (legfeljebb 120 képkocka).
 */
async function stableLastRowOverflow(page: Page, list: Locator, rowCount: number): Promise<number | undefined> {
  let previous: number | undefined;
  let stableFrames = 0;
  for (let frame = 0; frame < 120 && stableFrames < 10; frame += 1) {
    await animationFrames(page, 1);
    const current = await lastRowBottomOverflow(list, rowCount);
    stableFrames = current === previous ? stableFrames + 1 : 0;
    previous = current;
  }
  return round(previous);
}

async function jumpButtonText(page: Page): Promise<string | undefined> {
  const button = page.getByRole('button', { name: /Ugrás az aljára/ });
  return (await button.count()) > 0 ? ((await button.textContent()) ?? undefined) : undefined;
}

// ------------------------------------------------------------
// 1. A lista alja négy helyzetben (research 13. és 16. szekció).
// ------------------------------------------------------------
for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    test(`alja ${name} ${theme}`, async ({ page }) => {
      const { streamServer, list } = await open(page, theme, layout);
      let rowCount = REPLAYED_ROW_COUNT;
      streamServer.pushBatch(transientFrames(3));
      rowCount += 3;
      const threeRows = await stableLastRowOverflow(page, list, rowCount);
      streamServer.pushBatch(transientFrames(120));
      rowCount += 120;
      const batch = await stableLastRowOverflow(page, list, rowCount);
      await list.evaluate((element) => {
        element.scrollTo({ top: 0 });
      });
      await animationFrames(page, 4);
      streamServer.pushBatch(transientFrames(120));
      rowCount += 120;
      await page.getByRole('button', { name: /Ugrás az aljára/ }).click();
      const jump = await stableLastRowOverflow(page, list, rowCount);
      const oneByOne: (number | undefined)[] = [];
      for (let arrival = 1; arrival <= 10; arrival += 1) {
        streamServer.push(textDeltaTransientFrame(`Egyenként ${String(arrival)}`));
        rowCount += 1;
        oneByOne.push(await stableLastRowOverflow(page, list, rowCount));
      }
      report('alja', { layout: name, theme, threeRows, batch, jump, oneByOne });
    });
  }
}

// ------------------------------------------------------------
// 2. A kinyitás négy útja, a kattintással egy feladatban érkező sorral
//    (research 16. szekció, az e2e determinisztikus kézbesítése).
// ------------------------------------------------------------
for (const theme of THEMES) {
  for (const path of ['mouse', 'space', 'enter', 'click'] as const) {
    test(`kinyitas-ut ${theme} ${path}`, async ({ page }) => {
      await captureEventSources(page);
      const { streamServer, list } = await open(page, theme, WIDE_LAYOUT);
      streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
      let rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      const position = rowCount - 1;
      const header = list.locator(`[role="listitem"][aria-posinset="${String(position)}"]`).getByRole('button');
      await deliverFrameWithNextClick(page, textDeltaTransientFrame('A kattintással egy feladatban'));
      let offsetBefore: number | undefined;
      switch (path) {
        case 'space': {
          await header.focus();
          await page.keyboard.down('Space');
          streamServer.push(textDeltaTransientFrame('Space közben'));
          rowCount += 1;
          await expectLastRowFullyVisibleAtBottom(list, rowCount);
          offsetBefore = await headerOffsetInList(list, position);
          await page.keyboard.up('Space');
          break;
        }
        case 'enter': {
          await header.focus();
          offsetBefore = await headerOffsetInList(list, position);
          await page.keyboard.press('Enter');
          break;
        }
        case 'mouse': {
          offsetBefore = await headerOffsetInList(list, position);
          const center = await header.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          });
          await page.mouse.click(center.x, center.y);
          break;
        }
        case 'click': {
          offsetBefore = await headerOffsetInList(list, position);
          await header.dispatchEvent('click');
          break;
        }
      }
      await expect(header).toHaveAttribute('aria-expanded', 'true');
      await animationFrames(page, 3);
      const afterExpand = await headerOffsetInList(list, position);
      streamServer.push(textDeltaTransientFrame('Kinyitás után'));
      await expect(page.getByRole('button', { name: /Ugrás az aljára/ })).toBeVisible();
      await animationFrames(page, 3);
      const afterNext = await headerOffsetInList(list, position);
      report('kinyitas-ut', {
        theme,
        path,
        deltaAfterExpand: round((afterExpand ?? NaN) - (offsetBefore ?? NaN)),
        deltaAfterNext: round((afterNext ?? NaN) - (offsetBefore ?? NaN)),
        button: await jumpButtonText(page),
      });
    });
  }
}

// ------------------------------------------------------------
// 3. A kinyitott utolsó sor és a következő új sor (SPEC-008 7.4).
// ------------------------------------------------------------
for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    test(`utolso-sor ${name} ${theme}`, async ({ page }) => {
      const { streamServer, list } = await open(page, theme, layout);
      streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
      const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      const lastRow = list.locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`);
      const collapsedHeight = await lastRow.evaluate((element) => element.getBoundingClientRect().height);
      const offsetBefore = await headerOffsetInList(list, rowCount);
      await lastRow.getByRole('button').dispatchEvent('click');
      await animationFrames(page, 10);
      const expandedHeight = await lastRow.evaluate((element) => element.getBoundingClientRect().height);
      const afterExpand = await headerOffsetInList(list, rowCount);
      streamServer.push(textDeltaTransientFrame('A kinyitott utolsó sor után'));
      const overflowAfterNext = await stableLastRowOverflow(page, list, rowCount + 1);
      const afterNext = await headerOffsetInList(list, rowCount);
      report('utolso-sor', {
        layout: name,
        theme,
        collapsedHeight: round(collapsedHeight),
        bodyHeight: round(expandedHeight - collapsedHeight),
        deltaAfterExpand: round((afterExpand ?? NaN) - (offsetBefore ?? NaN)),
        deltaAfterNext: round((afterNext ?? NaN) - (offsetBefore ?? NaN)),
        overflowAfterNext,
        button: await jumpButtonText(page),
      });
    });
  }
}

// ------------------------------------------------------------
// 4. Kinyitás és fülváltás egy feladatban, 375 pixelen (research 17.
//    szekció): a sor a mérése előtt leszerelődik.
// ------------------------------------------------------------
for (const theme of THEMES) {
  test(`fulvaltas ${theme}`, async ({ page }) => {
    const { streamServer, list } = await open(page, theme, TABBED_LAYOUT);
    streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
    let rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
    await expectLastRowFullyVisibleAtBottom(list, rowCount);
    await list.evaluate((element, position) => {
      const header = element.querySelector(
        `[role="listitem"][aria-posinset="${CSS.escape(String(position))}"] [aria-expanded]`,
      );
      const graphTab = [...globalThis.document.querySelectorAll('[role="tab"]')].find(
        (tab) => tab.textContent === 'Gráf',
      );
      if (!(header instanceof HTMLElement) || !(graphTab instanceof HTMLElement)) {
        throw new TypeError('a fejléc vagy a Gráf fül nem található');
      }
      header.click();
      graphTab.click();
    }, rowCount - 1);
    await animationFrames(page, 10);
    streamServer.pushBatch(transientFrames(3));
    rowCount += 3;
    await page.getByRole('tab', { name: 'Transcript' }).click();
    await animationFrames(page, 10);
    const buttonAfterReturn = await jumpButtonText(page);
    await list.hover();
    await page.mouse.wheel(0, 100_000);
    const overflowAfterWheel = await stableLastRowOverflow(page, list, rowCount);
    const followed: (number | undefined)[] = [];
    for (let arrival = 1; arrival <= 3; arrival += 1) {
      streamServer.push(textDeltaTransientFrame(`Kilépés után ${String(arrival)}`));
      rowCount += 1;
      followed.push(await stableLastRowOverflow(page, list, rowCount));
    }
    report('fulvaltas', { theme, buttonAfterReturn, overflowAfterWheel, followed, button: await jumpButtonText(page) });
  });
}

// ------------------------------------------------------------
// 5. A commitok sorrendje a kattintás és a mérés között (research 16. és
//    17. szekció). A React DevTools csatlakozási pontja a React saját,
//    éles buildben is meglévő hívása: minden commit után `onCommitFiberRoot`,
//    a passzív effektek lefutása után `onPostCommitFiberRoot`.
// ------------------------------------------------------------

/**
 * A napló telepítése a betöltés ELŐTT: a React a csatlakozási pontot a saját
 * betöltésekor keresi. A kinyitott sor mérését egy, a kattintáskor a sorra
 * kötött `ResizeObserver` jelzi (csak itt, a mérésben; a termékkód saját
 * `ResizeObserver`-t nem használ).
 */
async function installRenderLog(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: RenderLogEntry[] = [];
    const snapshot = (kind: RenderLogEntry['kind']): RenderLogEntry => {
      const list = globalThis.document.querySelector('[aria-label="Futás eseményei"]');
      const target = list?.querySelector(':scope [data-measure-target] [aria-expanded]');
      const firstRow = list?.querySelector('[role="listitem"]');
      return {
        kind,
        expanded: target?.getAttribute('aria-expanded') ?? '-',
        rowTotal: firstRow?.getAttribute('aria-setsize') ?? '-',
        scrollTop: list?.scrollTop ?? -1,
      };
    };
    const record = (kind: RenderLogEntry['kind']): void => {
      if (globalThis.document.querySelector('[data-measure-target]') !== null) {
        log.push(snapshot(kind));
      }
    };
    Object.defineProperties(globalThis, {
      measureRenderLog: { configurable: true, value: log },
      __REACT_DEVTOOLS_GLOBAL_HOOK__: {
        configurable: true,
        value: {
          supportsFiber: true,
          inject: () => 1,
          onCommitFiberRoot: () => {
            record('commit');
          },
          onPostCommitFiberRoot: () => {
            record('effects');
          },
        },
      },
    });
    globalThis.addEventListener(
      'click',
      () => {
        record('click');
      },
      { capture: true },
    );
  });
}

for (const path of ['mouse', 'space', 'enter', 'click'] as const) {
  test(`render-sorrend ${path}`, async ({ page }) => {
    await installRenderLog(page);
    await captureEventSources(page);
    const { streamServer, list } = await open(page, 'light', WIDE_LAYOUT);
    streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
    const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
    await expectLastRowFullyVisibleAtBottom(list, rowCount);
    const row = list.locator(`[role="listitem"][aria-posinset="${String(rowCount - 1)}"]`);
    const header = row.getByRole('button');
    await row.evaluate((element) => {
      element.dataset['measureTarget'] = '';
      const initialHeight = element.getBoundingClientRect().height;
      const observer = new ResizeObserver(() => {
        if (element.getBoundingClientRect().height === initialHeight) {
          return;
        }

        globalThis.measureRenderLog?.push({ kind: 'measured', expanded: '-', rowTotal: '-', scrollTop: -1 });
        observer.disconnect();
      });
      observer.observe(element);
      // A lista elemén a hook kattintás figyelője UTÁN regisztrált figyelő:
      // a naplóban ettől a ponttól számít a kattintás a hook számára.
      element.closest('[role="list"]')?.addEventListener('click', (event) => {
        const list = event.currentTarget;
        globalThis.measureRenderLog?.push({
          kind: 'list-listener',
          expanded: element.querySelector('[aria-expanded]')?.getAttribute('aria-expanded') ?? '-',
          rowTotal: element.getAttribute('aria-setsize') ?? '-',
          scrollTop: list instanceof HTMLElement ? list.scrollTop : -1,
        });
      });
    });
    await deliverFrameWithNextClick(page, textDeltaTransientFrame('A kattintással egy feladatban'));
    if (path === 'mouse') {
      const center = await header.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      });
      await page.mouse.click(center.x, center.y);
    } else if (path === 'click') {
      await header.dispatchEvent('click');
    } else {
      await header.focus();
      await page.keyboard.press(path === 'space' ? 'Space' : 'Enter');
    }
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await animationFrames(page, 10);
    const log = await page.evaluate(() => globalThis.measureRenderLog ?? []);
    const clickIndex = log.findIndex((entry) => entry.kind === 'click');
    const measuredIndex = log.findIndex((entry) => entry.kind === 'measured');
    const beforeMeasurement = log.slice(clickIndex + 1, measuredIndex).filter((entry) => entry.kind === 'commit');
    report('render-sorrend', {
      path,
      commitsBeforeMeasurement: beforeMeasurement.length,
      sequence: log
        .slice(clickIndex, measuredIndex + 1)
        .map(
          (entry) =>
            `${entry.kind}(expanded=${entry.expanded} rows=${entry.rowTotal} scrollTop=${String(entry.scrollTop)})`,
        ),
    });
  });
}

// ------------------------------------------------------------
// 6. Verseny: folyamatos stream, véletlen fázisú, csak `click` eseménnyel
//    indított kinyitás a végétől ötödik soron (research 15., 16. és 17.
//    szekció). Egy kísérlet ELRÁNTÁS, ha a kinyitott sor fejléce a listához
//    mérve bármely képkockán elmozdul, és a mérés utáni harmadik képkockán az
//    utolsó sor nem látszik (ha látszik, a predikátum szerint a követés
//    folytatódik, és a fejléc elmozdulása szándékos).
// ------------------------------------------------------------
interface RaceTrial {
  readonly maxDelta: number;
  readonly lastRowVisibleAfterMeasurement: boolean;
}

function isRaceTrial(value: unknown): value is RaceTrial {
  return typeof value === 'object' && value !== null && 'maxDelta' in value && typeof value.maxDelta === 'number';
}

for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    for (const period of [150, 40]) {
      test(`verseny ${name} ${theme} ${String(period)}ms`, async ({ page }) => {
        test.setTimeout(600_000);
        const { streamServer, list } = await open(page, theme, layout);
        streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
        await expectLastRowFullyVisibleAtBottom(list, REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND);
        let sequence = 0;
        const stream = setInterval(() => {
          sequence += 1;
          streamServer.push(textDeltaTransientFrame(`Stream ${String(sequence)}`));
        }, period);
        const trials: RaceTrial[] = [];
        try {
          for (let trial = 0; trial < Number(process.env['MEASURE_TRIALS'] ?? '20'); trial += 1) {
            const jump = page.getByRole('button', { name: /Ugrás az aljára/ });
            if ((await jump.count()) > 0) {
              await jump.click();
            }
            const result: unknown = await list.evaluate(async (element, streamPeriod) => {
              const frame = async (): Promise<void> =>
                new Promise((resolve) => {
                  requestAnimationFrame(() => {
                    resolve();
                  });
                });
              const lastRow = (): Element | null => {
                const rowTotal = element.querySelector('[role="listitem"]')?.getAttribute('aria-setsize') ?? '0';
                return element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(rowTotal)}"]`);
              };
              const visibleBottom = (): number =>
                element.getBoundingClientRect().top + element.clientTop + element.clientHeight;
              for (let index = 0; index < 120; index += 1) {
                await frame();
                const last = lastRow();
                if (last !== null && Math.abs(last.getBoundingClientRect().bottom - visibleBottom()) < 1) {
                  break;
                }
              }
              // A kattintás véletlen fázisa a mérés tárgya, nem biztonsági célú.
              // eslint-disable-next-line sonarjs/pseudo-random -- a verseny mérésének véletlen fázisa
              const phase = Math.random() * streamPeriod;
              await new Promise((resolve) => {
                setTimeout(resolve, 60 + phase);
              });
              const rowTotal = Number(element.querySelector('[role="listitem"]')?.getAttribute('aria-setsize') ?? '0');
              const header = element.querySelector(
                `[role="listitem"][aria-posinset="${CSS.escape(String(rowTotal - 4))}"] [aria-expanded]`,
              );
              if (!(header instanceof HTMLElement)) {
                return;
              }
              const offset = (): number => header.getBoundingClientRect().top - element.getBoundingClientRect().top;
              const offsetBefore = offset();
              header.click();
              let maxDelta = 0;
              let isLastRowVisibleAfterMeasurement = false;
              const start = performance.now();
              let frames = 0;
              while (performance.now() - start < streamPeriod * 4 + 250) {
                await frame();
                frames += 1;
                const delta = offset() - offsetBefore;
                if (Math.abs(delta) > Math.abs(maxDelta)) {
                  maxDelta = delta;
                }
                if (frames === 3) {
                  const last = lastRow();
                  isLastRowVisibleAfterMeasurement =
                    last !== null && last.getBoundingClientRect().top < visibleBottom();
                }
              }
              return {
                maxDelta: Math.round(maxDelta),
                lastRowVisibleAfterMeasurement: isLastRowVisibleAfterMeasurement,
              };
            }, period);
            if (isRaceTrial(result)) {
              trials.push(result);
            }
          }
        } finally {
          clearInterval(stream);
        }
        const relevant = trials.filter((trial) => !trial.lastRowVisibleAfterMeasurement);
        const yanks = relevant.filter((trial) => trial.maxDelta !== 0);
        report('verseny', {
          layout: name,
          theme,
          period,
          overflowAnchor: process.env['MEASURE_OVERFLOW_ANCHOR'] ?? 'none',
          trials: trials.length,
          relevant: relevant.length,
          yanks: yanks.length,
          yankDeltas: yanks.map((trial) => trial.maxDelta),
        });
      });
    }
  }
}
