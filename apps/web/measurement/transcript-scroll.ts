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
// Környezeti változók: `MEASURE_TRIALS` (a verseny kísérleteinek, illetve az
// `anchoring` jelenet ismétléseinek száma beállításonként, alapból 20, illetve
// 10), `MEASURE_OVERFLOW_ANCHOR` (ha `auto`, a lista `overflow-anchor`
// értékét a mérés idejére visszaállítja, így a böngésző görgetés rögzítése
// mérhető, research 17. és 18. szekció), `MEASURE_JUMP_BAND` (ha `none`, a
// lista felső belső margóját a mérés idejére nullára állítja, így a margó
// nélküli, a lista tetején lebegő gomb takarása mérhető; research 21.
// szekció, a research 20. szekció `MEASURE_JUMP_PLACEMENT=top` kapcsolójának
// utódja, mióta a gomb a lista tetején áll).
import type { Server } from 'node:http';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  APPROVAL_RUN_URL,
  APPROVAL_TRANSCRIPT_ROW_COUNT,
  FIRST_APPROVAL,
  manyApprovals,
  mockApprovalRunWithTranscript,
} from '../e2e/approval-fixture.ts';
import {
  captureEventSources,
  deliverFrameOnMeasuredCommit,
  deliverFrameWithNextClick,
  expectLastRowFullyVisibleAtBottom,
  headerOffsetInList,
  installMeasuredCommitDelivery,
  lastRowBottomOverflow,
  openFollowingTranscript,
  REPLAYED_ROW_COUNT,
  mockRunView,
  rowsUnderJumpButton,
  startOpenStreamServer,
  stepEventFrame,
  stepRun,
  streamReadyFrame,
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
  replayedRowCount = REPLAYED_ROW_COUNT,
): Promise<{ readonly streamServer: OpenStreamServer; readonly list: Locator }> {
  const streamServer = await openFollowingTranscript(page, theme, serverHolder, layout, replayedRowCount);
  if (process.env['MEASURE_OVERFLOW_ANCHOR'] === 'auto') {
    await page.addStyleTag({ content: '.transcript-panel__list { overflow-anchor: auto !important; }' });
  }
  if (process.env['MEASURE_JUMP_BAND'] === 'none') {
    await page.addStyleTag({ content: '.transcript-panel__list { padding-top: 0 !important; }' });
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

/**
 * A lebegő gomb helye a lista látható területéhez képest, a lista felső
 * belső margója (research 21. szekció), és az első sor teteje a gomb alja
 * alatt (pozitív: a sor a gomb alatt kezdődik, nem takart; `undefined`, ha az
 * első sor nincs kirajzolva).
 */
async function jumpPlacement(list: Locator, jump: Locator): Promise<Readonly<Record<string, number | undefined>>> {
  const box = await jump.boundingBox();
  if (box === null) {
    return {};
  }
  const geometry = await list.evaluate((element, button) => {
    const visibleTop = element.getBoundingClientRect().top + element.clientTop;
    const firstRow = element.querySelector('[role="listitem"][aria-posinset="1"]');
    const paddingTop = element.computedStyleMap().get('padding-top');
    return {
      buttonTopMinusListTop: button.y - visibleTop,
      listBottomMinusButtonBottom: visibleTop + element.clientHeight - (button.y + button.height),
      buttonHeight: button.height,
      listPaddingTop: paddingTop instanceof CSSUnitValue ? paddingTop.value : undefined,
      firstRowTopMinusButtonBottom:
        firstRow === null ? undefined : firstRow.getBoundingClientRect().top - (button.y + button.height),
    };
  }, box);
  return {
    buttonTopMinusListTop: round(geometry.buttonTopMinusListTop),
    listBottomMinusButtonBottom: round(geometry.listBottomMinusButtonBottom),
    buttonHeight: round(geometry.buttonHeight),
    listPaddingTop: geometry.listPaddingTop,
    firstRowTopMinusButtonBottom: round(geometry.firstRowTopMinusButtonBottom),
  };
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
//    indított kinyitás a végétől ötödik soron (research 15-18. szekció). Egy
//    kísérlet ELRÁNTÁS, ha a kinyitott sor fejléce a listához mérve bármely
//    képkockán elmozdul. Minden kísérlet számít: a kinyitott törzs a lista
//    alján állva az utolsó sort mindig kitolja a látható tartományból, tehát
//    a követésnek mindegyik hook szerint le kell állnia. A korábbi szűrő
//    (csak az a kísérlet számított, amelyikben a kinyitás utáni harmadik
//    képkockán az utolsó sor NEM látszott) pontosan a teljes elrántást dobta
//    ki, mert az a listát az aljára viszi (research 18. szekció).
// ------------------------------------------------------------
interface RaceTrial {
  readonly maxDelta: number;
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
              const start = performance.now();
              while (performance.now() - start < streamPeriod * 4 + 250) {
                await frame();
                const delta = offset() - offsetBefore;
                if (Math.abs(delta) > Math.abs(maxDelta)) {
                  maxDelta = delta;
                }
              }
              return { maxDelta: Math.round(maxDelta) };
            }, period);
            if (isRaceTrial(result)) {
              trials.push(result);
            }
          }
        } finally {
          clearInterval(stream);
        }
        const yanks = trials.filter((trial) => trial.maxDelta !== 0);
        report('verseny', {
          layout: name,
          theme,
          period,
          overflowAnchor: process.env['MEASURE_OVERFLOW_ANCHOR'] ?? 'none',
          trials: trials.length,
          yanks: yanks.length,
          yankDeltas: yanks.map((trial) => trial.maxDelta),
        });
      });
    }
  }
}

// ------------------------------------------------------------
// 7. A görgetés rögzítés determinisztikus előállíthatósága (research 18.
//    szekció). Ugyanaz a lépéssor ismételve, időzítő nélkül: felgörgetés,
//    három sor, "ugrás az aljára", majd a végétől ötödik sor kinyitása
//    `element.click()` hívással, és új sor az érkezési mód szerint: a
//    kattintás feladatában, a mérés commitjában, a negyedik képkockán,
//    sehogy, vagy egy követett sor a kattintással egy feladatban, illetve egy
//    képkockával előtte (mindkettő után a negyedik képkockán még egy). A
//    kinyitott fejléc és a `scrollTop` képkockánként mérve; a hook a kinyitás
//    után nem görget, tehát minden elmozdulás a böngészőé.
//    `MEASURE_OVERFLOW_ANCHOR=auto` mellett mér a rögzítésre.
// ------------------------------------------------------------
const ANCHORING_ARRIVALS = [
  'click-task',
  'measured-commit',
  'after-measurement',
  'none',
  'followed-same-task',
  'followed-frame-before',
] as const;

/**
 * A kinyitás előtt, követés közben érkező sor helye: `task` a kattintással egy
 * feladatban, `frame` egy képkockával előtte, `no` nincs ilyen sor.
 */
const FOLLOWED_BEFORE: Readonly<Record<(typeof ANCHORING_ARRIVALS)[number], 'no' | 'task' | 'frame'>> = {
  'click-task': 'no',
  'measured-commit': 'no',
  'after-measurement': 'no',
  none: 'no',
  'followed-same-task': 'task',
  'followed-frame-before': 'frame',
};

for (const arrival of ANCHORING_ARRIVALS) {
  for (const theme of THEMES) {
    test(`anchoring ${arrival} ${theme}`, async ({ page }) => {
      await captureEventSources(page);
      await installMeasuredCommitDelivery(page);
      const { streamServer, list } = await open(page, theme, WIDE_LAYOUT);
      streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
      let rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      const movements: { readonly header: number; readonly scrollTop: number }[] = [];
      for (let repetition = 0; repetition < Number(process.env['MEASURE_TRIALS'] ?? '10'); repetition += 1) {
        await list.hover();
        await page.mouse.wheel(0, -100_000);
        await expect(list.locator('[role="listitem"][aria-posinset="1"]')).toBeInViewport({ ratio: 1 });
        streamServer.pushBatch(transientFrames(3));
        rowCount += 3;
        await page.getByRole('button', { name: /Ugrás az aljára/ }).click();
        await expectLastRowFullyVisibleAtBottom(list, rowCount);
        const position = rowCount - 4;
        const frame = textDeltaTransientFrame(`Rögzítés ${String(repetition)}`);
        if (arrival === 'click-task') {
          await deliverFrameWithNextClick(page, frame);
        } else if (arrival === 'measured-commit') {
          await deliverFrameOnMeasuredCommit(page, position, frame);
        }
        const movement = await list.evaluate(
          async (element, { rowPosition, deliverAfterMeasurement, followedBefore, data }) => {
            const header = element.querySelector(
              `[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"] [aria-expanded]`,
            );
            if (!(header instanceof HTMLElement)) {
              throw new TypeError('a fejléc nem található');
            }
            const offset = (): number => header.getBoundingClientRect().top - element.getBoundingClientRect().top;
            if (followedBefore !== 'no') {
              globalThis.e2eDeliverFrame?.('run_event_transient', data);
            }
            if (followedBefore === 'frame') {
              await new Promise((resolve) => {
                requestAnimationFrame(resolve);
              });
            }
            const offsetBefore = offset();
            const scrollTopBefore = element.scrollTop;
            header.click();
            let maxHeader = 0;
            let maxScrollTop = 0;
            for (let index = 0; index < 20; index += 1) {
              await new Promise((resolve) => {
                requestAnimationFrame(resolve);
              });
              if (index === 4 && (deliverAfterMeasurement || followedBefore !== 'no')) {
                globalThis.e2eDeliverFrame?.('run_event_transient', data);
              }
              const headerDelta = offset() - offsetBefore;
              const scrollTopDelta = element.scrollTop - scrollTopBefore;
              maxHeader = Math.abs(headerDelta) > Math.abs(maxHeader) ? headerDelta : maxHeader;
              maxScrollTop = Math.abs(scrollTopDelta) > Math.abs(maxScrollTop) ? scrollTopDelta : maxScrollTop;
            }
            return { header: Math.round(maxHeader), scrollTop: Math.round(maxScrollTop) };
          },
          {
            rowPosition: position,
            deliverAfterMeasurement: arrival === 'after-measurement',
            followedBefore: FOLLOWED_BEFORE[arrival],
            data: JSON.stringify(frame),
          },
        );
        if (FOLLOWED_BEFORE[arrival] !== 'no') {
          rowCount += 2;
        } else if (arrival !== 'none') {
          rowCount += 1;
        }
        movements.push(movement);
      }
      report('anchoring', {
        arrival,
        theme,
        overflowAnchor: process.env['MEASURE_OVERFLOW_ANCHOR'] ?? 'none',
        repetitions: movements.length,
        moved: movements.filter((movement) => movement.header !== 0 || movement.scrollTop !== 0),
      });
    });
  }
}

// ------------------------------------------------------------
// 8. Az "ugrás az aljára" gomb megjelenése és a lista helye az ablakban
//    (research 19. szekció). A lista alján a legutolsó sor kinyitva, majd
//    egy új sor: a gomb megjelenik. Mérve a lista és a kinyitott fejléc
//    függőleges helye az ablakban a gomb előtt és után, a fejlécből a lista
//    látható területén belül eső rész, és a gomb alsó éle a lista tetejéhez
//    képest (pozitív: a gomb a lista fölött áll, nem takar sort).
// ------------------------------------------------------------
interface ListGeometry {
  readonly listTop: number;
  readonly headerTop: number;
  readonly headerVisible: number;
}

function isListGeometry(value: unknown): value is ListGeometry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'listTop' in value &&
    typeof value.listTop === 'number' &&
    'headerTop' in value &&
    typeof value.headerTop === 'number' &&
    'headerVisible' in value &&
    typeof value.headerVisible === 'number'
  );
}

async function listGeometry(list: Locator, position: number): Promise<ListGeometry | undefined> {
  const geometry: unknown = await list.evaluate((element, rowPosition) => {
    const header = element.querySelector(
      `[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"] [aria-expanded]`,
    );
    if (header === null) {
      return;
    }
    const listBox = element.getBoundingClientRect();
    const visibleBottom = listBox.top + element.clientTop + element.clientHeight;
    const headerBox = header.getBoundingClientRect();
    return {
      listTop: listBox.top,
      headerTop: headerBox.top,
      headerVisible: Math.max(0, Math.min(headerBox.bottom, visibleBottom) - Math.max(headerBox.top, listBox.top)),
    };
  }, position);
  return isListGeometry(geometry) ? geometry : undefined;
}

for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    test(`gombsav ${name} ${theme}`, async ({ page }) => {
      const { streamServer, list } = await open(page, theme, layout);
      streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
      const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      await list
        .locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`)
        .getByRole('button')
        .dispatchEvent('click');
      await animationFrames(page, 10);
      const before = await listGeometry(list, rowCount);
      streamServer.push(textDeltaTransientFrame('A gomb megjelenése'));
      const jump = page.getByRole('button', { name: /Ugrás az aljára/ });
      await expect(jump).toBeVisible();
      await animationFrames(page, 10);
      const after = await listGeometry(list, rowCount);
      const buttonBottom = await jump.evaluate((element) => element.getBoundingClientRect().bottom);
      const listVisibleBottom = await list.evaluate(
        (element) => element.getBoundingClientRect().top + element.clientTop + element.clientHeight,
      );
      const covered = await rowsUnderJumpButton(list, jump);
      // A kinyitott sor fejlécének a gomb doboza alá eső magassága (0: a
      // fejléc egyetlen képpontját sem takarja).
      const headerBox = await list
        .locator(`[role="listitem"][aria-posinset="${String(rowCount)}"]`)
        .getByRole('button')
        .boundingBox();
      const jumpBox = await jump.boundingBox();
      const headerUnderButton =
        headerBox === null || jumpBox === null
          ? undefined
          : Math.max(
              0,
              Math.min(headerBox.y + headerBox.height, jumpBox.y + jumpBox.height) - Math.max(headerBox.y, jumpBox.y),
            );
      report('gombsav', {
        layout: name,
        theme,
        listTopDelta: round((after?.listTop ?? NaN) - (before?.listTop ?? NaN)),
        headerTopDelta: round((after?.headerTop ?? NaN) - (before?.headerTop ?? NaN)),
        headerVisibleBefore: round(before?.headerVisible),
        headerVisibleAfter: round(after?.headerVisible),
        headerUnderButton: round(headerUnderButton),
        listTopMinusButtonBottom: round((after?.listTop ?? NaN) - buttonBottom),
        listVisibleBottomMinusButtonBottom: round(listVisibleBottom - buttonBottom),
        ...(await jumpPlacement(list, jump)),
        rowsUnderButton: covered.map((row) => row.position),
        unreachableRowsUnderButton: covered.filter((row) => !row.isReachableByScrolling).map((row) => row.position),
        button: await jumpButtonText(page),
      });
    });
  }
}

// ------------------------------------------------------------
// 9. Nem teli lista (research 19. szekció): három pótolt sor, az utolsó
//    vagy az első kinyitva, majd egyenként tizenkét új sor. Érkezésenként
//    mérve a kinyitott fejléc függőleges elmozdulása az ablakban a kinyitás
//    utáni helyéhez képest, és a gomb szövege.
// ------------------------------------------------------------
const SHORT_REPLAYED_ROW_COUNT = 3;

for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    for (const target of [
      { label: 'utolso', position: SHORT_REPLAYED_ROW_COUNT },
      { label: 'elso', position: 1 },
    ] as const) {
      test(`rovid-lista ${name} ${theme} ${target.label}`, async ({ page }) => {
        const { streamServer, list } = await open(page, theme, layout, SHORT_REPLAYED_ROW_COUNT);
        await list
          .locator(`[role="listitem"][aria-posinset="${String(target.position)}"]`)
          .getByRole('button')
          .dispatchEvent('click');
        await animationFrames(page, 10);
        const expanded = await listGeometry(list, target.position);
        const headerTopBefore = expanded?.headerTop;
        const deltas: (number | undefined)[] = [];
        const buttons: (string | undefined)[] = [];
        const covered: (readonly number[])[] = [];
        const unreachable: (readonly number[])[] = [];
        const jump = page.getByRole('button', { name: /Ugrás az aljára/ });
        let rowCount = SHORT_REPLAYED_ROW_COUNT;
        for (let arrival = 1; arrival <= 12; arrival += 1) {
          streamServer.push(textDeltaTransientFrame(`Rövid lista ${String(arrival)}`));
          rowCount += 1;
          await expect(list.getByRole('listitem').first()).toHaveAttribute('aria-setsize', String(rowCount));
          await animationFrames(page, 6);
          const geometry = await listGeometry(list, target.position);
          deltas.push(round((geometry?.headerTop ?? NaN) - (headerTopBefore ?? NaN)));
          buttons.push(await jumpButtonText(page));
          const rows = (await jump.count()) > 0 ? await rowsUnderJumpButton(list, jump) : [];
          covered.push(rows.map((row) => row.position));
          unreachable.push(rows.filter((row) => !row.isReachableByScrolling).map((row) => row.position));
        }
        report('rovid-lista', {
          layout: name,
          theme,
          target: target.label,
          band: process.env['MEASURE_JUMP_BAND'] ?? 'default',
          deltas,
          buttons,
          rowsUnderButton: covered,
          unreachableRowsUnderButton: unreachable,
          lastRowOverflow: round(await lastRowBottomOverflow(list, rowCount)),
        });
      });
    }
  }
}

// ------------------------------------------------------------
// 10. A lista magassága új esemény nélkül (research 20. szekció): a lista
//     doboza és a transcript panelé az ablakban, a követő (az alján álló)
//     listán. A gomb sáv fenntartása (`1c7dd13`) ezt a lista fölötti
//     sávval csökkentette.
// ------------------------------------------------------------
for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    test(`lista-magassag ${name} ${theme}`, async ({ page }) => {
      const { list } = await open(page, theme, layout);
      await animationFrames(page, 10);
      const geometry = await list.evaluate((element) => {
        const panel = element.closest('.transcript-panel');
        const listBox = element.getBoundingClientRect();
        const panelBox = panel?.getBoundingClientRect();
        const paddingTop = element.computedStyleMap().get('padding-top');
        return {
          listHeight: listBox.height,
          listClientHeight: element.clientHeight,
          listPaddingTop: paddingTop instanceof CSSUnitValue ? paddingTop.value : undefined,
          panelHeight: panelBox?.height,
          listTopMinusPanelTop: panelBox === undefined ? undefined : listBox.top - panelBox.top,
          listBottomMinusPanelBottom: panelBox === undefined ? undefined : listBox.bottom - panelBox.bottom,
        };
      });
      report('lista-magassag', {
        layout: name,
        theme,
        listHeight: round(geometry.listHeight),
        listClientHeight: geometry.listClientHeight,
        listPaddingTop: geometry.listPaddingTop,
        panelHeight: round(geometry.panelHeight),
        listTopMinusPanelTop: round(geometry.listTopMinusPanelTop),
        listBottomMinusPanelBottom: round(geometry.listBottomMinusPanelBottom),
        button: await jumpButtonText(page),
      });
    });
  }
}

// ------------------------------------------------------------
// 11. A lebegő gomb takarása felgörgetett listán (research 20. és 21.
//     szekció): 20 + 10 sor, kézzel (egérkerékkel) a lista tetejére, majd egy
//     új sor, és a gomb megjelenik. Mérve a lista tetején a gomb alatti sorok,
//     és hogy görgetéssel kiszabadíthatók-e, a gomb helye és az első sor
//     teteje a gomb alja alatt; utána a lista görgetési tartományának felénél
//     ugyanez, és az ott legelső takart sor kiszabadítása egérkerékkel a gomb
//     szabad oldalára (a lista tetején álló gombnál alá, az alján állónál
//     fölé), a sor helyével a gombhoz és a lista látható területéhez képest.
// ------------------------------------------------------------
async function rowPlacement(
  list: Locator,
  jump: Locator,
  position: number,
): Promise<Readonly<Record<string, number | undefined>>> {
  const buttonBox = await jump.boundingBox();
  const row = await list.evaluate((element, rowPosition) => {
    const item = element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(rowPosition))}"]`);
    const visibleTop = element.getBoundingClientRect().top + element.clientTop;
    const box = item?.getBoundingClientRect();
    return { top: box?.top, bottom: box?.bottom, visibleTop, visibleBottom: visibleTop + element.clientHeight };
  }, position);
  return {
    rowTopMinusButtonBottom: round((row.top ?? NaN) - ((buttonBox?.y ?? NaN) + (buttonBox?.height ?? NaN))),
    rowBottomMinusButtonTop: round((row.bottom ?? NaN) - (buttonBox?.y ?? NaN)),
    rowTopMinusVisibleTop: round((row.top ?? NaN) - row.visibleTop),
    rowBottomMinusVisibleBottom: round((row.bottom ?? NaN) - row.visibleBottom),
  };
}

for (const { name, layout } of LAYOUTS) {
  for (const theme of THEMES) {
    test(`takaras ${name} ${theme}`, async ({ page }) => {
      const { streamServer, list } = await open(page, theme, layout);
      streamServer.pushBatch(transientFrames(TRANSIENT_BEFORE_EXPAND));
      const rowCount = REPLAYED_ROW_COUNT + TRANSIENT_BEFORE_EXPAND;
      await expectLastRowFullyVisibleAtBottom(list, rowCount);
      await list.hover();
      await page.mouse.wheel(0, -100_000);
      await expect(list.locator('[role="listitem"][aria-posinset="1"]')).toBeInViewport({ ratio: 1 });
      streamServer.push(textDeltaTransientFrame('Felgörgetve'));
      const jump = page.getByRole('button', { name: /Ugrás az aljára/ });
      await expect(jump).toBeVisible();
      await animationFrames(page, 10);
      const coveredAtTop = await rowsUnderJumpButton(list, jump);
      const placementAtTop = await jumpPlacement(list, jump);
      const scrollTopAtTop = await list.evaluate((element) => element.scrollTop);

      await list.evaluate((element) => {
        element.scrollTo({ top: Math.round((element.scrollHeight - element.clientHeight) / 2) });
      });
      await animationFrames(page, 10);
      const coveredInMiddle = await rowsUnderJumpButton(list, jump);
      const [first] = coveredInMiddle;
      let freed: Readonly<Record<string, unknown>> = {};
      if (first !== undefined) {
        const isButtonAtTop =
          (placementAtTop['buttonTopMinusListTop'] ?? NaN) < (placementAtTop['listBottomMinusButtonBottom'] ?? NaN);
        await list.hover();
        await page.mouse.wheel(0, isButtonAtTop ? Math.floor(first.shiftBelow) : Math.ceil(first.shiftAbove));
        await animationFrames(page, 20);
        const coveredAfterWheel = await rowsUnderJumpButton(list, jump);
        freed = {
          freedRow: first.position,
          freedTo: isButtonAtTop ? 'below' : 'above',
          ...(await rowPlacement(list, jump, first.position)),
          stillUnderButton: coveredAfterWheel.some((row) => row.position === first.position),
          buttonAfterWheel: await jumpButtonText(page),
        };
      }
      report('takaras', {
        layout: name,
        theme,
        band: process.env['MEASURE_JUMP_BAND'] ?? 'default',
        scrollTopAtTop,
        rowsUnderButtonAtTop: coveredAtTop.map((row) => row.position),
        unreachableRowsUnderButtonAtTop: coveredAtTop
          .filter((row) => !row.isReachableByScrolling)
          .map((row) => row.position),
        ...placementAtTop,
        rowsUnderButtonInMiddle: coveredInMiddle.map((row) => row.position),
        unreachableRowsUnderButtonInMiddle: coveredInMiddle
          .filter((row) => !row.isReachableByScrolling)
          .map((row) => row.position),
        ...freed,
      });
    });
  }
}

// ------------------------------------------------------------
// 12. Tört listamagasság a jóváhagyás panel mellett (research 20. szekció):
//     a húzható elválasztó százalékos felosztása tört magasságot adhat a
//     listának, a böngésző görgetési tartománya viszont egész pixelre
//     kerekít. Mérve a lista doboza, a `clientHeight`, a legnagyobb
//     `scrollTop`, és a lista végére görgetve az utolsó sor alja a lista
//     dobozának alja alatt (pozitív: ennyi nem látszik belőle), a kezdő
//     állásban, három méreten.
// ------------------------------------------------------------
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1440, height: 600 },
  { width: 375, height: 812 },
] as const) {
  test(`tort-magassag ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await mockApprovalRunWithTranscript(page, manyApprovals(1));
    await page.goto(APPROVAL_RUN_URL);
    if (viewport.width < 768) {
      await page.getByRole('tab', { name: 'Transcript' }).click();
    }
    const list = transcriptList(page);
    await expect(list.getByRole('listitem').first()).toBeVisible();
    await list.evaluate((element) => {
      element.scrollTo({ top: element.scrollHeight });
    });
    await animationFrames(page, 10);
    // Az utolsó sor alja a lista DOBOZÁNAK aljához mérve: a `clientHeight`
    // egész pixelre kerekített, tehát a tört magasság fél pixelét nem mutatja.
    const geometry = await list.evaluate((element, position) => {
      const row = element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(position))}"]`);
      const box = element.getBoundingClientRect();
      return {
        height: box.height,
        clientHeight: element.clientHeight,
        maxScrollTop: element.scrollTop,
        lastRowBelowBox: row === null ? undefined : row.getBoundingClientRect().bottom - box.bottom,
      };
    }, APPROVAL_TRANSCRIPT_ROW_COUNT);
    report('tort-magassag', {
      viewport: `${String(viewport.width)}x${String(viewport.height)}`,
      listHeight: round(geometry.height),
      clientHeight: geometry.clientHeight,
      maxScrollTop: geometry.maxScrollTop,
      lastRowBelowBox: round(geometry.lastRowBelowBox),
    });
  });
}

// ------------------------------------------------------------
// 13. Szűk lista a látott jóváhagyás mellett (user döntés 2026-09-25,
//     SPEC-008 7.4, a 14.1 O-15 lezárása): a lista közepére görgetve három
//     új sor után a gomb helye (`position`, a keret szűk alakja), a gomb
//     alatt álló sorok, a lista magassága és helye a gomb megjelenése előtt
//     és után, a lista tartalom doboza (a felső belső margó nélkül), és a
//     gomb megnyomása után az utolsó sor alja a lista alján. Négy méreten,
//     két témában; a jóváhagyás a `r-1` futásé.
// ------------------------------------------------------------
const COMPACT_APPROVAL = { ...FIRST_APPROVAL, runId: 'r-1', stepRunId: 's-1' } as const;

for (const { name, layout } of [
  { name: '1440x900', layout: WIDE_LAYOUT },
  { name: '900x1000', layout: { viewport: { width: 900, height: 1000 }, isTabbed: false } },
  { name: '1440x600', layout: { viewport: { width: 1440, height: 600 }, isTabbed: false } },
  { name: '375x812', layout: TABBED_LAYOUT },
] as const) {
  for (const theme of THEMES) {
    test(`szuk-lista ${name} ${theme}`, async ({ page }) => {
      // A megnyitás az `openFollowingTranscript` lépései szerint, de az utolsó
      // sor teljes láthatóságának állítása nélkül: ahol a transcript panel a
      // tartalma minimumánál kisebb, a transcript burkolója görget, és az
      // állítás elbukna (research 22. szekció).
      const streamServer = await startOpenStreamServer(page, [streamReadyFrame('s-1', [])]);
      serverHolder.current = streamServer.server;
      await page.addInitScript((mode) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun('running')], approvals: [COMPACT_APPROVAL] });
      await page.setViewportSize(layout.viewport);
      await page.goto('/run?runId=r-1');
      if (layout.isTabbed) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      streamServer.pushBatch([
        ...Array.from({ length: REPLAYED_ROW_COUNT }, (_, index) =>
          stepEventFrame(index + 1, 'step_started', 'replayed'),
        ),
        { event: 'replay_complete', runId: 'r-1', throughEventId: REPLAYED_ROW_COUNT },
      ]);
      const list = transcriptList(page);
      await expect(list.locator(`[role="listitem"][aria-posinset="${String(REPLAYED_ROW_COUNT)}"]`)).toBeAttached();
      await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toBeAttached();
      // A lista közepére görgetve (nem a tetejére, ahol a gomb alatt a felső
      // belső margó áll): itt dől el, hogy a gomb sort takar-e (O-15).
      await list.evaluate((element) => {
        element.scrollTo({ top: Math.round((element.scrollHeight - element.clientHeight) / 2) });
      });
      await animationFrames(page, 5);
      const before = await list.boundingBox();
      streamServer.pushBatch(transientFrames(3));
      const jump = page.getByRole('button', { name: 'Ugrás az aljára (3 új esemény)' });
      await expect(jump).toBeVisible();
      await animationFrames(page, 5);
      const after = await list.boundingBox();
      const frame = await list.evaluate((element) => {
        const style = element.computedStyleMap().get('padding-top');
        return {
          clientHeight: element.clientHeight,
          paddingTop: style instanceof CSSUnitValue ? style.value : undefined,
          isCompactFrame: element.parentElement?.classList.contains('transcript-panel__list-frame--compact') ?? false,
        };
      });
      const covered = await rowsUnderJumpButton(list, jump);
      const position = await jump.evaluate((element) => globalThis.getComputedStyle(element).position);
      // Esemény küldése, nem a Playwright kattintása: az a gombot a
      // kattintás előtt a nézetbe görgetné (a transcript burkolóját is), ami a
      // mért arányt elrontaná.
      await jump.dispatchEvent('click');
      const rowCount = REPLAYED_ROW_COUNT + 3;
      report('szuk-lista', {
        layout: name,
        theme,
        listHeight: round(before?.height),
        listContentHeight: frame.paddingTop === undefined ? undefined : frame.clientHeight - frame.paddingTop,
        isCompactFrame: frame.isCompactFrame,
        position,
        coveredRows: covered.map((row) => row.position),
        listMovedY: round((after?.y ?? 0) - (before?.y ?? 0)),
        listHeightChange: round((after?.height ?? 0) - (before?.height ?? 0)),
        lastRowOverflowAfterJump: await stableLastRowOverflow(page, list, rowCount),
        // Az utolsó sor látható aránya az ablakban, minden levágó őssel
        // metszve (a transcript burkolója is): kisebb egynél, ha a transcript
        // panel a tartalma minimumánál kisebb.
        lastRowVisibleRatio: await list.evaluate((element, position) => {
          const row = element.querySelector(`[role="listitem"][aria-posinset="${CSS.escape(String(position))}"]`);
          if (row === null) {
            return;
          }
          const rect = row.getBoundingClientRect();
          let top = Math.max(rect.top, 0);
          let bottom = Math.min(rect.bottom, globalThis.innerHeight);
          for (let ancestor = row.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
            if (globalThis.getComputedStyle(ancestor).overflowY === 'visible') {
              continue;
            }
            const box = ancestor.getBoundingClientRect();
            top = Math.max(top, box.top + ancestor.clientTop);
            bottom = Math.min(bottom, box.top + ancestor.clientTop + ancestor.clientHeight);
          }
          return Math.round((Math.max(0, bottom - top) / rect.height) * 100) / 100;
        }, rowCount),
      });
    });
  }
}
