// A jóváhagyás panel MÉRŐ ESZKÖZE (2026-09-25).
//
// MIÉRT VAN A REPÓBAN. A `docs/research/2026-09-24-jovahagyas-panel-helye.md`
// 7. szekciójának számait korábban repón kívüli, eldobható script adta
// (`/private/tmp/jovahagyas-panel-2/measure.mjs`), ami a munkamenet végén
// elveszett; ez a `.claude/CLAUDE.md` 12. szekciójával ütközött ("minden
// bizonyíték előállító eszköz a repóba tartozik"). A mérés ugyanazt a
// fixtúrát használja, mint az e2e (`apps/web/e2e/approval-fixture.ts`).
//
// KÉPET NEM ÍR. Csak számokat: minden jelenet egy `MEASUREMENT <json>` sort
// ír a szabványos kimenetre. Képernyőképet lemezre kizárólag a szentesített
// `apps/web/e2e/capture-screenshots.ts` írhat (`tooling/scripts`
// `screenshot-pipeline` invariánsai).
//
// JELENETEK: 1. elrendezés (0, 1, 4, 10 jóváhagyás), 2. döntés (siker és
// conflict), 3. lapozó (375 pixel), 4. felület (a törzs és az akciósáv
// kifestett képpontja, a bal szélek és az oldalsó belső térköz), 5. küszöb
// (a gombok az elválasztó teljes tartományán), 6. érintés (CDP érintés
// események a fül sávban). A 4-6. jelenet 2026-09-25 óta áll, a húzható
// elválasztóhoz (research 9. szekció). 7. szélső állás (Home, kezdő arány,
// End: a lapozó és a gombok, a transcript utolsó sora, a jelentett és a
// valódi arány, a csoport túllógása, a két oldalsó belső térköz) és 8.
// megszakított érintés (`pointercancel` a külső és a belső elválasztón),
// mindkettő 2026-09-25 óta, a research 10. szekciójához.
//
// NEM E2E TESZT, és nem kapu: állítás nincs benne, csak számlálás. A
// kiválasztók szándékosan a panel több alakját is felismerik (a görgethető
// rész a mai `.drawer__body`, a `05b6818` állapot
// `.approval-prompt-panel__content` eleme, a `bffd75d` állapotban maga a
// panel), hogy ugyanez az eszköz egy korábbi commit buildjén is lefusson; a
// research 8. szekciója így mérte az "előtte" oszlopot.
//
// FUTTATÁS (a gépen egyszerre csak egy Playwright folyamat, legfeljebb három
// worker, `.claude/CLAUDE.md` 11. szekció):
//
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:approval
//   cd apps/web && flock /tmp/playwright-gep.lock bun run measure:approval -g elrendezes
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { expect, test, type Page } from '@playwright/test';
import {
  APPROVAL_RUN_URL,
  APPROVAL_TRANSCRIPT_ROW_COUNT,
  approvalBaseMocks,
  FIRST_APPROVAL,
  manyApprovals,
  mockApprovalRun,
  mockApprovalRunWithTranscript,
} from '../e2e/approval-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from '../e2e/rest-mock.ts';
import { mockIdleStream } from '../e2e/sse-mock.ts';

declare global {
  // Ambiens globális változó deklaráció a `coverage-fixture.ts` mintájára.
  /**
   * Az érintéses húzás alatt a lapon látott pointer események sorrendje
   * (egymás utáni ismétlés nélkül), a 6. jelenet naplója.
   */
  var e2ePointerLog: string[] | undefined;
}

test.describe.configure({ mode: 'serial' });

const THEMES = ['light', 'dark'] as const;

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1440, height: 600 },
  { width: 375, height: 812 },
] as const;

const APPROVAL_COUNTS = [0, 1, 4, 10] as const;

/**
 * A `--ep-screen-md` (768px) alatt a futás nézet fül sávban áll, a panel a
 * "Transcript" fülön (SPEC-008 10. szekció).
 */
const TABBED_WIDTH_LIMIT = 768;

/**
 * A jóváhagyás panel és a transcript közti húzható elválasztó hozzáférhető
 * neve (`RunViewTranscriptSide.tsx`, 2026-09-25). A `da9fa70` és a `741f63e`
 * állapotban nincs ilyen elválasztó: az eszköz ott `separator: false` értéket
 * ír, és a küszöb jelenetet kihagyja.
 */
const APPROVAL_SEPARATOR_NAME = 'A jóváhagyás és a transcript aránya';

function report(scenario: string, values: Readonly<Record<string, unknown>>): void {
  console.log(`MEASUREMENT ${JSON.stringify({ scenario, ...values })}`);
}

async function openRun(
  page: Page,
  theme: 'light' | 'dark',
  viewport: Readonly<{ width: number; height: number }>,
): Promise<void> {
  await page.setViewportSize(viewport);
  await page.addInitScript((mode) => {
    globalThis.localStorage.setItem('eggTheme', mode);
  }, theme);
  await page.goto(APPROVAL_RUN_URL);
  await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
}

/**
 * A lap mért értékei egyetlen `evaluate` hívásban. A gomb "látható aránya"
 * a gomb befoglaló doboza metszve minden levágó ős (`overflow` nem
 * `visible`) kliens területével és a viewporttal, osztva a teljes dobozzal,
 * ugyanaz a definíció, mint a research 7. szekciójában.
 */
async function readPanelGeometry(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((separatorName) => {
    const { document } = globalThis;
    const round = (value: number): number => Math.round(value * 100) / 100;
    const visibleRatio = (element: Element): number => {
      const rect = element.getBoundingClientRect();
      let left = Math.max(rect.left, 0);
      let top = Math.max(rect.top, 0);
      let right = Math.min(rect.right, globalThis.innerWidth);
      let bottom = Math.min(rect.bottom, globalThis.innerHeight);
      for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
        const style = globalThis.getComputedStyle(ancestor);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') {
          continue;
        }
        const box = ancestor.getBoundingClientRect();
        const clientLeft = box.left + ancestor.clientLeft;
        const clientTop = box.top + ancestor.clientTop;
        left = Math.max(left, clientLeft);
        top = Math.max(top, clientTop);
        right = Math.min(right, clientLeft + ancestor.clientWidth);
        bottom = Math.min(bottom, clientTop + ancestor.clientHeight);
      }
      const area = rect.width * rect.height;
      return area === 0 ? 0 : round((Math.max(0, right - left) * Math.max(0, bottom - top)) / area);
    };
    const height = (selector: string): number | undefined => {
      const element = document.querySelector(selector);
      return element === null ? undefined : round(element.getBoundingClientRect().height);
    };
    const panel = document.querySelector('.approval-prompt-panel');
    // A 2026-09-25-i javítás óta a törzs és az akciósáv nem a panel alatt,
    // hanem a transcript oldalon, a `Resizable` két oldalán áll; a transcript
    // oldal minden mért alakban létezik, tehát a keresés ott megy.
    const side = document.querySelector('.run-view-screen__transcript') ?? panel;
    const scrollArea =
      side?.querySelector('.drawer__body') ?? document.querySelector('.approval-prompt-panel__content') ?? panel;
    const buttons = [
      ...(side?.querySelectorAll(':scope .approval-prompt-panel button, :scope .drawer__footer button') ?? []),
    ];
    const decisionRatios = (name: string): number[] =>
      buttons.filter((button) => button.textContent === name).map((button) => visibleRatio(button));
    const navigation = document.querySelector('.approval-prompt-panel nav.pagination');
    const appContent = document.querySelector('.app-content');
    const warning = [...(side?.querySelectorAll('.alert__title') ?? [])].find(
      (element) => element.textContent === 'A döntés visszavonhatatlan',
    );
    const alert = warning?.closest('.alert') ?? undefined;
    const left = (element: Element | null | undefined): number | undefined =>
      element === null || element === undefined ? undefined : round(element.getBoundingClientRect().left);
    const background = (selector: string): string | undefined => {
      const element = document.querySelector(selector);
      return element === null ? undefined : globalThis.getComputedStyle(element).backgroundColor;
    };
    const separator = [...document.querySelectorAll('[role="separator"]')].find(
      (element) => element.getAttribute('aria-label') === separatorName,
    );
    return {
      canvas: height('.run-graph-canvas'),
      appContentOverflowY: appContent === null ? undefined : appContent.scrollHeight - appContent.clientHeight,
      appContentOverflowX: appContent === null ? undefined : appContent.scrollWidth - appContent.clientWidth,
      panel: height('.approval-prompt-panel'),
      panelContent: panel === null ? undefined : panel.scrollHeight,
      scrollArea: scrollArea === null ? undefined : round(scrollArea.clientHeight),
      scrollAreaContent: scrollArea === null ? undefined : scrollArea.scrollHeight,
      footer: height('.run-view-screen__transcript .drawer__footer'),
      approve: decisionRatios('Jóváhagyás'),
      reject: decisionRatios('Elutasítás'),
      decisionFullyVisible:
        decisionRatios('Jóváhagyás').length === 1 &&
        [...decisionRatios('Jóváhagyás'), ...decisionRatios('Elutasítás')].every((ratio) => ratio === 1),
      pagination: navigation?.querySelector('.pagination__meta')?.textContent ?? undefined,
      paginationOverflowX:
        navigation === null || panel === null
          ? undefined
          : round(
              Math.max(
                navigation.scrollWidth - navigation.clientWidth,
                navigation.getBoundingClientRect().right - panel.getBoundingClientRect().right,
              ),
            ),
      warningRatio: warning === undefined ? undefined : visibleRatio(warning),
      alertRatio: alert === undefined ? undefined : visibleRatio(alert),
      separator: separator !== undefined,
      separatorValue: separator?.getAttribute('aria-valuenow') ?? undefined,
      leftEdges: {
        pagination: left(navigation?.firstElementChild),
        alert: left(alert),
        title: left(side?.querySelector('.approval-prompt-card__title')),
        transcript: left(document.querySelector('.transcript-panel')),
      },
      // A felület két oldalsó belső térköze, ahogy LÁTSZIK: bal oldalon az
      // Alert és a törzs bal széle között, jobb oldalon az utolsó döntés
      // gomb és az akciósáv látható jobb széle között (a sáv doboza a futás
      // nézet törzsének jobb szélén túl is folytatódhatott, azt a külső
      // `Resizable` levágta; research 9. és 10. szekció).
      insets: {
        left: (() => {
          const body = side?.querySelector('.drawer__body');
          return alert === undefined || body === null || body === undefined
            ? undefined
            : round(alert.getBoundingClientRect().left - body.getBoundingClientRect().left);
        })(),
        right: (() => {
          const footer = side?.querySelector('.drawer__footer');
          const screenBody = document.querySelector('.run-view-screen__body');
          const lastButton = buttons.at(-1);
          return footer === null || footer === undefined || screenBody === null || lastButton === undefined
            ? undefined
            : round(
                Math.min(footer.getBoundingClientRect().right, screenBody.getBoundingClientRect().right) -
                  lastButton.getBoundingClientRect().right,
              );
        })(),
      },
      backgrounds: {
        section: background('.approval-prompt-panel__approval'),
        body: background('.run-view-screen__transcript .drawer__body'),
        footer: background('.run-view-screen__transcript .drawer__footer'),
      },
      paginationSlots:
        navigation === null ? undefined : navigation.querySelectorAll(':scope .pagination__pages > *').length,
      paginationHeight: navigation === null ? undefined : round(navigation.getBoundingClientRect().height),
      paginationMetaHeight:
        navigation === null ? undefined : height('.approval-prompt-panel nav.pagination .pagination__meta'),
    };
  }, APPROVAL_SEPARATOR_NAME);
}

// ------------------------------------------------------------
// 1. Az elrendezés 0, 1, 4 és 10 jóváhagyással, három méreten, két témában.
// ------------------------------------------------------------
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const count of APPROVAL_COUNTS) {
      test(`elrendezes ${theme} ${String(viewport.width)}x${String(viewport.height)} ${String(count)}`, async ({
        page,
      }) => {
        await mockApprovalRun(page, manyApprovals(count));
        await openRun(page, theme, viewport);
        await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toHaveCount(count === 0 ? 0 : 1);
        // A vászon magassága a "Gráf" fülön mérhető, a panel a "Transcript"
        // fülön: fül sávban kétszer olvasunk.
        const beforeTab = await readPanelGeometry(page);
        if (viewport.width < TABBED_WIDTH_LIMIT) {
          await page.getByRole('tab', { name: 'Transcript' }).click();
        }
        const geometry = await readPanelGeometry(page);
        report('elrendezes', {
          theme,
          viewport: `${String(viewport.width)}x${String(viewport.height)}`,
          count,
          ...geometry,
          canvas: beforeTab['canvas'],
        });
      });
    }
  }
}

// ------------------------------------------------------------
// 2. A döntés után: siker és conflict, négy jóváhagyásnál.
// ------------------------------------------------------------
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    for (const outcome of ['siker', 'conflict'] as const) {
      test(`dontes ${theme} ${String(viewport.width)}x${String(viewport.height)} ${outcome}`, async ({ page }) => {
        const approvals: readonly PendingApproval[] = manyApprovals(4);
        const [shown] = approvals;
        await mockIdleStream(page);
        await installApiMocks(page, [
          ...approvalBaseMocks(async (route) => route.fulfill(jsonBody(approvals))),
          mockRoute('decideApproval', async (route) =>
            route.fulfill(
              outcome === 'siker'
                ? jsonBody({ ...(shown ?? FIRST_APPROVAL), decision: 'approved', decidedAtMs: Date.now() })
                : jsonBody({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, 409),
            ),
          ),
        ]);
        await openRun(page, theme, viewport);
        if (viewport.width < TABBED_WIDTH_LIMIT) {
          await page.getByRole('tab', { name: 'Transcript' }).click();
        }
        const panel = page.locator('.run-view-screen__transcript');
        await panel.getByRole('button', { name: 'Jóváhagyás', exact: true }).first().click();
        // A "visszavonhatatlan" `Alert` is `status` szerepkörű, ezért a
        // siker eredménye a szövegével szűrve.
        const result =
          outcome === 'siker'
            ? panel.getByRole('status').filter({ hasText: /^Döntés rögzítve/ })
            : panel.getByRole('alert').first();
        await expect(result).toBeAttached();
        const resultRatio = await result.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          let top = Math.max(rect.top, 0);
          let bottom = Math.min(rect.bottom, globalThis.innerHeight);
          for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
            const style = globalThis.getComputedStyle(ancestor);
            if (style.overflowY === 'visible') {
              continue;
            }
            const box = ancestor.getBoundingClientRect();
            top = Math.max(top, box.top + ancestor.clientTop);
            bottom = Math.min(bottom, box.top + ancestor.clientTop + ancestor.clientHeight);
          }
          return rect.height === 0 ? 0 : Math.round((Math.max(0, bottom - top) / rect.height) * 100) / 100;
        });
        const geometry = await readPanelGeometry(page);
        report('dontes', {
          theme,
          viewport: `${String(viewport.width)}x${String(viewport.height)}`,
          outcome,
          resultRatio,
          resultText: await result.textContent(),
          ...geometry,
        });
      });
    }
  }
}

// ------------------------------------------------------------
// 3. A lapozó szélessége a legkeskenyebb mért méreten, tíz jóváhagyásnál, az
//    első, a középső és az utolsó oldalon (a `PAGINATION_SIBLINGS` értéke,
//    `ApprovalPromptPanel.tsx`).
// ------------------------------------------------------------
for (const theme of THEMES) {
  test(`lapozo ${theme} 375x812 10`, async ({ page }) => {
    await mockApprovalRun(page, manyApprovals(10));
    await openRun(page, theme, { width: 375, height: 812 });
    await page.getByRole('tab', { name: 'Transcript' }).click();
    const navigation = page.getByRole('navigation', { name: 'Jóváhagyások lapozása' });
    const pages: Record<string, unknown>[] = [];
    for (const target of [1, 5, 10]) {
      while ((await navigation.getByText(`${String(target)} / 10`, { exact: true }).count()) === 0) {
        await navigation.getByRole('button', { name: 'Következő' }).click();
      }
      const geometry = await readPanelGeometry(page);
      pages.push({
        page: target,
        pagination: geometry['pagination'],
        overflowX: geometry['paginationOverflowX'],
        slots: geometry['paginationSlots'],
        height: geometry['paginationHeight'],
        metaHeight: geometry['paginationMetaHeight'],
      });
    }
    report('lapozo', { theme, viewport: '375x812', count: 10, pages });
  });
}

/**
 * A görgethető törzs és a tapadó akciósáv KIFESTETT háttérszíne: egy-egy
 * képpont a két szakasz belső térközéből (a bal felső saroktól 4 pixelre,
 * ahol tartalom nem áll), a lapról készült, lemezre NEM írt képernyőképen
 * (a `react-flow-theme.spec.ts` mintája: a kép memóriában, a lap saját
 * `canvas` elemén dekódolva). A kiszámított `background-color` önmagában nem
 * elég, mert egy átlátszó szakasz alatt a szülő színe látszik
 * (`.claude/CLAUDE.md` 11. szekció: vizuális állítást csak kifestett pixel
 * bizonyít).
 */
async function readSurfacePixels(page: Page): Promise<Record<string, string>> {
  const points = await page.evaluate(
    (selectors: Readonly<Record<string, string>>) =>
      Object.fromEntries(
        Object.entries(selectors).map(([name, selector]) => {
          const element = globalThis.document.querySelector(selector);
          if (element === null) {
            throw new Error(`a mérés nem találta a ${selector} elemet`);
          }
          const rect = element.getBoundingClientRect();
          return [name, { x: Math.ceil(rect.left) + 4, y: Math.ceil(rect.top) + 4 }];
        }),
      ),
    { body: '.run-view-screen__transcript .drawer__body', footer: '.run-view-screen__transcript .drawer__footer' },
  );
  const shot = await page.screenshot({ animations: 'disabled' });
  return page.evaluate(
    async (input: {
      readonly image: string;
      readonly points: Readonly<Record<string, { readonly x: number; readonly y: number }>>;
    }) => {
      const image = new globalThis.Image();
      image.src = `data:image/png;base64,${input.image}`;
      await image.decode();
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (context === null) {
        throw new Error('a 2d rajzoló kontextus nem érhető el');
      }
      context.drawImage(image, 0, 0);
      return Object.fromEntries(
        Object.entries(input.points).map(([name, point]) => [
          name,
          [...context.getImageData(point.x, point.y, 1, 1).data.slice(0, 3)].join(','),
        ]),
      );
    },
    { image: shot.toString('base64'), points },
  );
}

// ------------------------------------------------------------
// 4. A jóváhagyás szakasz felülete: a törzs és az akciósáv kifestett
//    háttérszíne, és a bal élek (a lapozó, az Alert, a cím), egy
//    jóváhagyással, három méreten, két témában.
// ------------------------------------------------------------
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`felulet ${theme} ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
      await mockApprovalRun(page, manyApprovals(1));
      await openRun(page, theme, viewport);
      if (viewport.width < TABBED_WIDTH_LIMIT) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toBeVisible();
      const geometry = await readPanelGeometry(page);
      report('felulet', {
        theme,
        viewport: `${String(viewport.width)}x${String(viewport.height)}`,
        pixels: await readSurfacePixels(page),
        backgrounds: geometry['backgrounds'],
        leftEdges: geometry['leftEdges'],
        insets: geometry['insets'],
      });
    });
  }
}

// ------------------------------------------------------------
// 5. A gombok láthatósága az elválasztó teljes tartományán: `Home` (a
//    `Resizable` minimuma), majd `ArrowDown` lépésenként (5 százalék) a
//    maximumig; minden állásban a két gomb görgetés nélküli látható aránya
//    és a törzs magassága. A küszöb a
//    legkisebb érték, ahonnan fölfelé minden állásban mindkét gomb teljesen
//    látszik. Elválasztó nélküli buildben (`741f63e` és korábban) kihagyva.
// ------------------------------------------------------------
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`kuszob ${theme} ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
      await mockApprovalRun(page, manyApprovals(1));
      await openRun(page, theme, viewport);
      if (viewport.width < TABBED_WIDTH_LIMIT) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      const separator = page.getByRole('separator', { name: APPROVAL_SEPARATOR_NAME });
      if ((await separator.count()) === 0) {
        report('kuszob', { theme, viewport: `${String(viewport.width)}x${String(viewport.height)}`, separator: false });
        return;
      }
      const initial = await readPanelGeometry(page);
      await separator.focus();
      await separator.press('Home');
      // A `Home` érkezési helye 2026-09-25 óta a mért pixeles minimum, nem
      // feltétlenül 5 (research 10. szekció), tehát a lépések a jelentett
      // értéket követik, a jelentett maximumig.
      const rows: Record<string, unknown>[] = [];
      let value = Number(await separator.getAttribute('aria-valuenow'));
      const maximum = Number(await separator.getAttribute('aria-valuemax'));
      for (;;) {
        const geometry = await readPanelGeometry(page);
        rows.push({
          value,
          fullyVisible: geometry['decisionFullyVisible'],
          scrollArea: geometry['scrollArea'],
          panel: geometry['panel'],
        });
        if (value >= maximum) {
          break;
        }
        await separator.press('ArrowDown');
        const previous = value;
        await expect(separator).not.toHaveAttribute('aria-valuenow', String(previous));
        value = Number(await separator.getAttribute('aria-valuenow'));
      }
      const firstHidden = rows.findLast((row) => row['fullyVisible'] !== true);
      report('kuszob', {
        theme,
        viewport: `${String(viewport.width)}x${String(viewport.height)}`,
        initialValue: initial['separatorValue'],
        initialScrollArea: initial['scrollArea'],
        threshold: firstHidden === undefined ? rows[0]?.['value'] : Number(firstHidden['value']) + 5,
        rows,
      });
    });
  }
}

// ------------------------------------------------------------
// 6. Érintéses húzás a fül sávban (375x812): a Chrome DevTools Protocol
//    `Input.dispatchTouchEvent` hívásával, valódi érintés eseményekkel, és a
//    lapon naplózott pointer eseményekkel (a `Resizable` kizárólag pointer
//    eseményekre hallgat). A mérés a telefonos húzás használhatóságát adja
//    (SPEC-008 10. szekció).
// ------------------------------------------------------------
test.describe('erintes', () => {
  test.use({ hasTouch: true });

  for (const theme of THEMES) {
    test(`erintes ${theme} 375x812`, async ({ page }) => {
      await page.addInitScript(() => {
        const log: string[] = [];
        Object.defineProperty(globalThis, 'e2ePointerLog', { configurable: true, value: log });
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
          globalThis.addEventListener(
            type,
            (event) => {
              if (log.at(-1) !== event.type) {
                log.push(event.type);
              }
            },
            { capture: true },
          );
        }
      });
      await mockApprovalRun(page, manyApprovals(1));
      await openRun(page, theme, { width: 375, height: 812 });
      await page.getByRole('tab', { name: 'Transcript' }).click();
      const separator = page.getByRole('separator', { name: APPROVAL_SEPARATOR_NAME });
      if ((await separator.count()) === 0) {
        report('erintes', { theme, viewport: '375x812', separator: false });
        return;
      }
      const before = await separator.getAttribute('aria-valuenow');
      const box = await separator.boundingBox();
      if (box === null) {
        throw new Error('az elválasztónak nincs befoglaló doboza');
      }
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const session = await page.context().newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (let step = 1; step <= 10; step += 1) {
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + step * 10 }] });
      }
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      report('erintes', {
        theme,
        viewport: '375x812',
        before,
        after: await separator.getAttribute('aria-valuenow'),
        pointerEvents: await page.evaluate(() => globalThis.e2ePointerLog),
      });
    });
  }
});

/**
 * A szélső állás mért értékei egyetlen `evaluate` hívásban. A "látható
 * arány" ugyanaz a definíció, mint a `readPanelGeometry` függvényben (a
 * befoglaló doboz metszve minden levágó ős kliens területével és a
 * viewporttal). A kiválasztók a transcript oldal EGÉSZÉN keresnek, nem a
 * `.approval-prompt-panel` alatt, mert a 2026-09-25-i javítás óta a lapozó és
 * az akciósáv a `Resizable` elemen kívül áll.
 */
async function readExtremeGeometry(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate(
    (input: { readonly separatorName: string; readonly rowCount: number }) => {
      const { document } = globalThis;
      const clipRect = (element: Element): { left: number; top: number; right: number; bottom: number } => {
        const rect = element.getBoundingClientRect();
        let left = Math.max(rect.left, 0);
        let top = Math.max(rect.top, 0);
        let right = Math.min(rect.right, globalThis.innerWidth);
        let bottom = Math.min(rect.bottom, globalThis.innerHeight);
        for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
          const style = globalThis.getComputedStyle(ancestor);
          if (style.overflowX === 'visible' && style.overflowY === 'visible') {
            continue;
          }
          const box = ancestor.getBoundingClientRect();
          const clientLeft = box.left + ancestor.clientLeft;
          const clientTop = box.top + ancestor.clientTop;
          left = Math.max(left, clientLeft);
          top = Math.max(top, clientTop);
          right = Math.min(right, clientLeft + ancestor.clientWidth);
          bottom = Math.min(bottom, clientTop + ancestor.clientHeight);
        }
        return { left, top, right, bottom };
      };
      const visibleRatio = (element: Element | null | undefined): number | undefined => {
        if (element === null || element === undefined) {
          return undefined;
        }
        const rect = element.getBoundingClientRect();
        const clip = clipRect(element);
        const area = rect.width * rect.height;
        return area === 0
          ? 0
          : Math.round(((Math.max(0, clip.right - clip.left) * Math.max(0, clip.bottom - clip.top)) / area) * 100) /
              100;
      };
      const side = document.querySelector('.run-view-screen__transcript');
      const group = side?.querySelector(':scope > .resizable-group') ?? undefined;
      const groupChildren = group === undefined ? [] : [...group.children];
      const panels = groupChildren.filter((child) => child.classList.contains('resizable-panel'));
      const panelSizes = panels.map((panel) => Math.round(panel.getBoundingClientRect().height * 100) / 100);
      const [first, second] = panelSizes;
      const separator = [...document.querySelectorAll('[role="separator"]')].find(
        (element) => element.getAttribute('aria-label') === input.separatorName,
      );
      const buttons = [...(side?.querySelectorAll('button') ?? [])];
      const buttonRatio = (name: string): number | undefined =>
        visibleRatio(buttons.find((button) => button.textContent === name));
      const navigation = side?.querySelector('nav.pagination') ?? undefined;
      const body = side?.querySelector('.drawer__body') ?? undefined;
      const alert = body?.querySelector('.alert') ?? undefined;
      const bodyClip = body === undefined ? undefined : clipRect(body);
      const bodyRect = body?.getBoundingClientRect();
      const alertRect = alert?.getBoundingClientRect();
      const lastRow = [...(side?.querySelectorAll('[role="listitem"]') ?? [])].find(
        (row) => row.getAttribute('aria-posinset') === String(input.rowCount),
      );
      return {
        valueNow: separator?.getAttribute('aria-valuenow') ?? undefined,
        valueMin: separator?.getAttribute('aria-valuemin') ?? undefined,
        valueMax: separator?.getAttribute('aria-valuemax') ?? undefined,
        panelSizes,
        realRatio:
          first === undefined || second === undefined
            ? undefined
            : Math.round((first / (first + second)) * 10_000) / 100,
        groupOverflow:
          group === undefined
            ? undefined
            : Math.round(
                (groupChildren.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0) -
                  group.clientHeight) *
                  100,
              ) / 100,
        approve: buttonRatio('Jóváhagyás'),
        reject: buttonRatio('Elutasítás'),
        paginationMeta: visibleRatio(navigation?.querySelector('.pagination__meta')),
        paginationNext: visibleRatio(
          [...(navigation?.querySelectorAll('button') ?? [])].find(
            (button) => button.getAttribute('aria-label') === 'Következő',
          ),
        ),
        transcriptPanel: visibleRatio(side?.querySelector('.transcript-panel')),
        lastRow: lastRow === undefined ? 0 : visibleRatio(lastRow),
        insets:
          bodyClip === undefined || bodyRect === undefined || alertRect === undefined
            ? undefined
            : {
                left: Math.round((alertRect.left - bodyRect.left) * 100) / 100,
                right: Math.round((bodyClip.right - alertRect.right) * 100) / 100,
              },
      };
    },
    { separatorName: APPROVAL_SEPARATOR_NAME, rowCount: APPROVAL_TRANSCRIPT_ROW_COUNT },
  );
}

/**
 * A user görgetése a transcripten: egérgörgő a transcript panel LÁTHATÓ
 * részének közepén (nem `scrollIntoView`, ami egy `overflow: hidden` őst is
 * görgetne). Két képkocka megvárása a görgetés és a virtualizált lista
 * újrarajzolása után; időzítő nélkül. Ha a panelből semmi nem látszik, nincs
 * hova görgetni.
 */
async function scrollTranscriptToBottom(page: Page): Promise<void> {
  const target = await page.evaluate(() => {
    const panel = globalThis.document.querySelector('.run-view-screen__transcript .transcript-panel');
    if (panel === null) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    let top = Math.max(rect.top, 0);
    let bottom = Math.min(rect.bottom, globalThis.innerHeight);
    for (let ancestor = panel.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
      if (globalThis.getComputedStyle(ancestor).overflowY === 'visible') {
        continue;
      }
      const box = ancestor.getBoundingClientRect();
      top = Math.max(top, box.top + ancestor.clientTop);
      bottom = Math.min(bottom, box.top + ancestor.clientTop + ancestor.clientHeight);
    }
    return bottom - top < 1 ? undefined : { x: rect.left + rect.width / 2, y: (top + bottom) / 2 };
  });
  if (target === undefined) {
    return;
  }
  await page.mouse.move(target.x, target.y);
  for (let turn = 0; turn < 3; turn += 1) {
    await page.mouse.wheel(0, 3000);
    await page.evaluate(
      async () =>
        new Promise<number>((resolve) => {
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve));
        }),
    );
  }
}

// ------------------------------------------------------------
// 7. Szélső állások: `Home`, a kezdő arány és `End`, egy jóváhagyással és
//    20 tárolt transcript sorral. Minden állásban: a jelentett érték és a két
//    határ, a panelek valódi aránya, a csoport túllógása, a lapozó és a két
//    gomb görgetés nélküli látható aránya, a transcript panel látható
//    aránya, az utolsó sor látható aránya a user görgetése után, és a
//    jóváhagyás törzs két oldalsó belső térköze (a `.drawer__body` bal és
//    LÁTHATÓ jobb széle az `Alert` blokkhoz mérve).
// ------------------------------------------------------------
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    test(`szelso ${theme} ${String(viewport.width)}x${String(viewport.height)}`, async ({ page }) => {
      await mockApprovalRunWithTranscript(page, manyApprovals(1));
      await openRun(page, theme, viewport);
      if (viewport.width < TABBED_WIDTH_LIMIT) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toBeAttached();
      await expect(
        page.getByRole('list', { name: 'Futás eseményei' }).locator('[role="listitem"]').first(),
      ).toBeAttached();
      const separator = page.getByRole('separator', { name: APPROVAL_SEPARATOR_NAME });
      const positions: Record<string, unknown>[] = [];
      for (const position of ['kezdo', 'Home', 'End'] as const) {
        if (position !== 'kezdo') {
          await separator.focus();
          await separator.press(position);
        }
        const beforeScroll = await readExtremeGeometry(page);
        await scrollTranscriptToBottom(page);
        const afterScroll = await readExtremeGeometry(page);
        positions.push({ position, ...beforeScroll, lastRow: afterScroll['lastRow'] });
      }
      report('szelso', { theme, viewport: `${String(viewport.width)}x${String(viewport.height)}`, positions });
    });
  }
}

/**
 * A gráf és a transcript közti KÜLSŐ elválasztó hozzáférhető neve
 * (`RunViewLayout.tsx`).
 */
const OUTER_SEPARATOR_NAME = 'A Gráf és a Transcript aránya';

// ------------------------------------------------------------
// 8. Megszakított érintéses húzás (`pointercancel`), 900x1000-en (a
//    függőleges sáv, ahol mindkét elválasztó áll): a KÜLSŐ elválasztón egy
//    valódi érintéses húzás (a design system eleme `touch-action` nélkül a
//    böngésző pásztázásának adja át a mozdulatot, és `pointercancel` jön),
//    a BELSŐN (`touch-action: none`) egy `touchCancel` CDP esemény zárja a
//    húzást. Utána egy puszta egérmozgás a vásznon és egy görgetés a
//    transcripten: ha a húzás állapota bent ragadt, ezek mozdítják az
//    elválasztót.
// ------------------------------------------------------------
test.describe('megszakitas', () => {
  test.use({ hasTouch: true });

  for (const theme of THEMES) {
    for (const which of ['kulso', 'belso'] as const) {
      test(`megszakitas ${theme} 900x1000 ${which}`, async ({ page }) => {
        await page.addInitScript(() => {
          const log: string[] = [];
          Object.defineProperty(globalThis, 'e2ePointerLog', { configurable: true, value: log });
          for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
            globalThis.addEventListener(
              type,
              (event) => {
                if (log.at(-1) !== event.type) {
                  log.push(event.type);
                }
              },
              { capture: true },
            );
          }
        });
        await mockApprovalRunWithTranscript(page, manyApprovals(1));
        await openRun(page, theme, { width: 900, height: 1000 });
        const separator = page.getByRole('separator', {
          name: which === 'kulso' ? OUTER_SEPARATOR_NAME : APPROVAL_SEPARATOR_NAME,
        });
        const before = await separator.getAttribute('aria-valuenow');
        const box = await separator.boundingBox();
        if (box === null) {
          throw new Error('az elválasztónak nincs befoglaló doboza');
        }
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const session = await page.context().newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        const steps = which === 'kulso' ? 10 : 3;
        for (let step = 1; step <= steps; step += 1) {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y + step * 10 }],
          });
        }
        await session.send('Input.dispatchTouchEvent', {
          type: which === 'kulso' ? 'touchEnd' : 'touchCancel',
          touchPoints: [],
        });
        const afterTouch = await separator.getAttribute('aria-valuenow');
        const isDraggingAfterTouch = ((await separator.getAttribute('class')) ?? '').includes('is-dragging');
        const canvas = await page.locator('.run-graph-canvas').boundingBox();
        if (canvas !== null) {
          await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 20);
          await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 40, { steps: 3 });
        }
        const afterMouseMove = await separator.getAttribute('aria-valuenow');
        const list = await page.getByRole('list', { name: 'Futás eseményei' }).boundingBox();
        if (list !== null) {
          await page.mouse.move(list.x + list.width / 2, list.y + list.height / 2);
          await page.mouse.wheel(0, -300);
        }
        const afterWheel = await separator.getAttribute('aria-valuenow');
        report('megszakitas', {
          theme,
          viewport: '900x1000',
          separator: which,
          before,
          afterTouch,
          isDraggingAfterTouch,
          afterMouseMove,
          afterWheel,
          isDraggingAtEnd: ((await separator.getAttribute('class')) ?? '').includes('is-dragging'),
          pointerEvents: await page.evaluate(() => globalThis.e2ePointerLog),
        });
      });
    }
  }
});

// ------------------------------------------------------------
// 9. A KÜLSŐ elválasztó szélső állásai a függőleges sávban (900x1000, a
//    gráf felül, a transcript oldal alul): a transcript oldal a külső
//    `Resizable` panelje, tehát a `End` állásban a design system 60 pixeles
//    minimumára zsugorodik. Mérjük, hogy a lapozó és a két gomb ilyenkor is
//    látszik-e (a belső elválasztó jelenetei ezt nem fedik).
// ------------------------------------------------------------
for (const theme of THEMES) {
  test(`kulso-szelso ${theme} 900x1000`, async ({ page }) => {
    await mockApprovalRunWithTranscript(page, manyApprovals(1));
    await openRun(page, theme, { width: 900, height: 1000 });
    const separator = page.getByRole('separator', { name: OUTER_SEPARATOR_NAME });
    const positions: Record<string, unknown>[] = [];
    for (const position of ['kezdo', 'Home', 'End'] as const) {
      if (position !== 'kezdo') {
        await separator.focus();
        await separator.press(position);
      }
      const geometry = await readExtremeGeometry(page);
      positions.push({
        position,
        outerValue: await separator.getAttribute('aria-valuenow'),
        approve: geometry['approve'],
        reject: geometry['reject'],
        paginationMeta: geometry['paginationMeta'],
        transcriptSide: await page
          .locator('.run-view-screen__transcript')
          .evaluate((element) => Math.round(element.getBoundingClientRect().height)),
      });
    }
    report('kulso-szelso', { theme, viewport: '900x1000', positions });
  });
}
