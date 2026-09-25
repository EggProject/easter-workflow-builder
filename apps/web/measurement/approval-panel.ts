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
  approvalBaseMocks,
  FIRST_APPROVAL,
  manyApprovals,
  mockApprovalRun,
} from '../e2e/approval-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from '../e2e/rest-mock.ts';
import { mockIdleStream } from '../e2e/sse-mock.ts';

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
  return page.evaluate(() => {
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
    const scrollArea =
      document.querySelector('.approval-prompt-panel .drawer__body') ??
      document.querySelector('.approval-prompt-panel__content') ??
      panel;
    const buttons = [...(panel?.querySelectorAll('button') ?? [])];
    const decisionRatios = (name: string): number[] =>
      buttons.filter((button) => button.textContent === name).map((button) => visibleRatio(button));
    const navigation = document.querySelector('.approval-prompt-panel nav.pagination');
    const appContent = document.querySelector('.app-content');
    const warning = [...(panel?.querySelectorAll('.alert__title') ?? [])].find(
      (element) => element.textContent === 'A döntés visszavonhatatlan',
    );
    return {
      canvas: height('.run-graph-canvas'),
      appContentOverflowY: appContent === null ? undefined : appContent.scrollHeight - appContent.clientHeight,
      appContentOverflowX: appContent === null ? undefined : appContent.scrollWidth - appContent.clientWidth,
      panel: height('.approval-prompt-panel'),
      panelContent: panel === null ? undefined : panel.scrollHeight,
      scrollArea: scrollArea === null ? undefined : round(scrollArea.clientHeight),
      scrollAreaContent: scrollArea === null ? undefined : scrollArea.scrollHeight,
      footer: height('.approval-prompt-panel .drawer__footer'),
      approve: decisionRatios('Jóváhagyás'),
      reject: decisionRatios('Elutasítás'),
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
      paginationSlots:
        navigation === null ? undefined : navigation.querySelectorAll(':scope .pagination__pages > *').length,
      paginationHeight: navigation === null ? undefined : round(navigation.getBoundingClientRect().height),
      paginationMetaHeight:
        navigation === null ? undefined : height('.approval-prompt-panel nav.pagination .pagination__meta'),
    };
  });
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
        const panel = page.locator('.approval-prompt-panel');
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
