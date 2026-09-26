// E2E a jóváhagyás szakasz FELÜLETÉRE és BAL IGAZÍTÁSI VONALÁRA (user döntés
// 2026-09-25, SPEC-008 8. szekció 1. pont).
//
// MIÉRT KÜLÖN FÁJL. A felület állítása kifestett képpontot mér
// (`.claude/CLAUDE.md` 11. szekció: vizuális állítást csak kifestett pixel
// bizonyít), tehát a lapról képernyőkép készül, a memóriában. A
// `tooling/scripts` `screenshot-pipeline` invariánsa szerint egy képernyőképet
// készítő fájl egyetlen `path` kulcsot sem tarthat, az `approval-prompt.spec.ts`
// viszont a döntés kérések útvonalát `path` mezőben rögzíti; a mérés ezért
// saját fájlban áll, a `react-flow-theme.spec.ts` mintájára.
//
// A HIBA, AMIT ŐRIZ (a `da9fa70` állapot, független ellenőrzés és research 9.
// szekció): a tapadó akciósáv saját `--ep-bg-elevated` hátterű fehér doboz
// volt a bézs panelen, a törzs háttér nélkül, és a lapozó a transcript sáv 16
// pixeles szélén állt, a törzs tartalma a 24 pixeles drawer térközön, tehát két
// bal igazítási vonal volt. 2026-09-25 óta a jobb belső térközt is (a
// `5093e67` állapotban 19 pixel volt a bal 24 helyett, mert a `Resizable`
// csoport 5 pixellel túllógott, és a túllógást levágta; research 10.
// szekció).
import type { Page } from '@playwright/test';
import { APPROVAL_RUN_URL, manyApprovals, mockApprovalRun } from './approval-fixture.ts';
import { expect, test } from './coverage-fixture.ts';

/**
 * A görgethető törzs és a tapadó akciósáv KIFESTETT háttérszíne, és
 * összevetésül a design system `--ep-bg-elevated` tokenjével festő szonda
 * színe. A `background-color` kiszámított értéke nem elég: egy átlátszó
 * törzs alatt a szülő színe látszik, és pontosan ez volt a hiba (a fehér
 * akciósáv a bézs panelen, `docs/research/2026-09-24-jovahagyas-panel-helye.md`
 * 9. szekció). A kép memóriában készül és a lap saját `canvas` elemén
 * dekódolódik, lemezre nem íródik (a `react-flow-theme.spec.ts` mintája).
 */
async function readSurfacePixels(
  page: Page,
): Promise<Readonly<Record<'body' | 'pagination' | 'footer' | 'elevated', string>>> {
  const points = await page.evaluate(() => {
    const { document } = globalThis;
    const probe = document.createElement('div');
    probe.id = 'e2e-elevated-probe';
    probe.style.cssText =
      'position: fixed; left: 0; top: 0; width: 8px; height: 8px; z-index: 2147483647; background: var(--ep-bg-elevated)';
    document.body.append(probe);
    const cornerOf = (selector: string): { x: number; y: number } => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      if (rect === undefined) {
        throw new Error(`a mérés nem találta a ${selector} elemet`);
      }
      // A szakasz belső térközéből, a bal felső saroktól 4 pixelre: ott
      // tartalom nem áll (a törzs belső térköze 18 és 24, az akciósávé 16 és
      // 24 pixel, `drawer.css`; a lapozó bal belső térköze 24 pixel,
      // `approval-prompt.css`).
      return { x: Math.ceil(rect.left) + 4, y: Math.ceil(rect.top) + 4 };
    };
    return {
      body: cornerOf('.run-view-screen__transcript .drawer__body'),
      pagination: cornerOf('.run-view-screen__transcript nav.pagination'),
      footer: cornerOf('.run-view-screen__transcript .drawer__footer'),
      elevated: { x: 2, y: 2 },
    };
  });
  const shot = await page.screenshot({ animations: 'disabled' });
  await page.evaluate(() => {
    globalThis.document.querySelector('#e2e-elevated-probe')?.remove();
  });
  return page.evaluate(
    async (input: {
      readonly image: string;
      readonly points: Readonly<
        Record<'body' | 'pagination' | 'footer' | 'elevated', { readonly x: number; readonly y: number }>
      >;
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
      const colorAt = (point: { readonly x: number; readonly y: number }): string =>
        [...context.getImageData(point.x, point.y, 1, 1).data.slice(0, 3)].join(',');
      return {
        body: colorAt(input.points.body),
        pagination: colorAt(input.points.pagination),
        footer: colorAt(input.points.footer),
        elevated: colorAt(input.points.elevated),
      };
    },
    { image: shot.toString('base64'), points },
  );
}

/**
 * A lapozó, a "visszavonhatatlan" `Alert` és a látott jóváhagyás címének
 * bal széle (viewport koordinátában). A lapozóé az első gyerekéé, mert a
 * `<nav>` doboza a belső térközzel együtt a szakasz szélén kezdődik.
 */
async function readLeftEdges(page: Page): Promise<readonly (number | undefined)[]> {
  return page.evaluate(() => {
    const { document } = globalThis;
    return [
      document.querySelector('.run-view-screen__transcript nav.pagination')?.firstElementChild,
      document.querySelector('.run-view-screen__transcript .drawer__body .alert'),
      document.querySelector('.run-view-screen__transcript .approval-prompt-card__title'),
    ].map((element) => element?.getBoundingClientRect().left);
  });
}

/**
 * A felület két oldalsó belső térköze, ahogy LÁTSZIK: a törzsben az `Alert`
 * bal és jobb széle a törzs bal, illetve LÁTHATÓ jobb széléhez mérve, az
 * akciósávban az utolsó gomb jobb széle a sáv látható jobb széléhez mérve. A
 * látható jobb szél a doboz jobb széle és minden levágó ős (`overflow` nem
 * `visible`) kliens területének jobb széle közül a kisebb: pontosan ez vágta
 * le a jobb térköz 5 pixelét.
 */
async function readInsets(page: Page): Promise<Readonly<Record<'bodyLeft' | 'bodyRight' | 'footerRight', number>>> {
  return page.evaluate(() => {
    const { document } = globalThis;
    const visibleRight = (element: Element): number => {
      let right = Math.min(element.getBoundingClientRect().right, globalThis.innerWidth);
      for (let ancestor = element.parentElement; ancestor !== null; ancestor = ancestor.parentElement) {
        if (globalThis.getComputedStyle(ancestor).overflowX === 'visible') {
          continue;
        }
        right = Math.min(right, ancestor.getBoundingClientRect().left + ancestor.clientLeft + ancestor.clientWidth);
      }
      return right;
    };
    const find = (selector: string): Element => {
      const element = document.querySelector(selector);
      if (element === null) {
        throw new Error(`a mérés nem találta a ${selector} elemet`);
      }
      return element;
    };
    const body = find('.run-view-screen__transcript .drawer__body');
    const alert = find('.run-view-screen__transcript .drawer__body .alert');
    const footer = find('.run-view-screen__transcript .drawer__footer');
    const lastButton = [...footer.querySelectorAll('button')].at(-1);
    if (lastButton === undefined) {
      throw new Error('a mérés nem talált gombot az akciósávban');
    }
    return {
      bodyLeft: alert.getBoundingClientRect().left - body.getBoundingClientRect().left,
      bodyRight: visibleRight(body) - alert.getBoundingClientRect().right,
      footerRight: visibleRight(footer) - lastButton.getBoundingClientRect().right,
    };
  });
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1440, height: 600 },
    { width: 375, height: 812 },
  ] as const) {
    test(`${String(viewport.width)}x${String(viewport.height)}, ${theme} téma: a görgethető törzs, a lapozó és a tapadó akciósáv egy felület a --ep-bg-elevated tokenen, a lapozó, az Alert és a cím bal széle egy vonalban áll, és a jobb belső térköz a ballal azonos`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((mode) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await mockApprovalRun(page, manyApprovals(4));
      await page.goto(APPROVAL_RUN_URL);
      await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
      if (viewport.width < 768) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toBeVisible();

      const pixels = await readSurfacePixels(page);
      expect(pixels.body).toBe(pixels.elevated);
      expect(pixels.pagination).toBe(pixels.elevated);
      expect(pixels.footer).toBe(pixels.elevated);

      const [paginationLeft, alertLeft, titleLeft] = await readLeftEdges(page);
      expect(paginationLeft).toBeGreaterThan(0);
      expect(alertLeft).toBe(paginationLeft);
      expect(titleLeft).toBe(paginationLeft);

      // A jobb belső térköz a ballal azonos, a törzsben és az akciósávban is
      // (a forrás `drawer` 24 pixele); a `5093e67` állapotban a vízszintes
      // sávban 19 volt.
      const insets = await readInsets(page);
      expect(insets.bodyLeft).toBe(24);
      expect(insets.bodyRight).toBe(insets.bodyLeft);
      expect(insets.footerRight).toBe(insets.bodyLeft);
    });
  }
}
