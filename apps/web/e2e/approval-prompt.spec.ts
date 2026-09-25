// E2E az `approval-prompt` témára (T-009-27, SPEC-008 8. szekció, AC35).
//
// MIÉRT KELL E2E A HAPPY-DOM UNIT TESZTEK MELLETT. A panel HELYE (a
// transcript sávban, nem a vászon fölött) és az, hogy a vászon magassága nem
// függ a jóváhagyások számától, csak valódi layouttal mérhető: happy-dom nem
// számol elrendezést. Ugyanígy csak valódi böngészőben igazolható, hogy a
// látott jóváhagyás két döntés gombja GÖRGETÉS NÉLKÜL látszik, a tartalma a
// törzsben legalább görgetve olvasható (user döntés 2026-09-25: "egyszerre
// egy", SPEC-008 8. szekció 1. pont), és hogy a gombok valódi `disabled`
// attribútuma a siker, a conflict és az újratöltési hiba után sem kapcsol
// vissza. Minden REST hívás `page.route()` mockon megy, valós backend szervert
// egyetlen teszt sem szólít meg (`.claude/CLAUDE.md` 11. szekció). Az élő (SSE
// keretre történő) frissítés e2e tesztjei a nyitott kapcsolatot igénylik,
// ezért a `sse-real-server.spec.ts` fájlban állnak. A fixtúra a mérő
// eszközzel közös (`approval-fixture.ts`).
import type { ApprovalDecisionRequest, PendingApproval } from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import {
  APPROVAL_RUN_URL,
  APPROVAL_TRANSCRIPT_ROW_COUNT,
  approvalBaseMocks,
  buildApprovalSnapshot,
  FAN_OUT_APPROVAL_TITLE,
  fanOutApprovals,
  FIRST_APPROVAL,
  FIRST_REQUESTED_AT_MS,
  manyApprovals,
  mockApprovalRun,
  mockApprovalRunWithTranscript,
  SECOND_APPROVAL,
  SECOND_REQUESTED_AT_MS,
} from './approval-fixture.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

declare global {
  // Ambiens globális változó deklaráció, a `coverage-fixture.ts` mintájára: a
  // TypeScript a `globalThis` kiegészítését csak `var` alakban engedi.
  /**
   * A lapon belül KIOLVASOTT `GET /api/approvals` válasz törzsek száma: a
   * késve érkező válasz feldolgozása ebből figyelhető meg, várakozó időzítő
   * nélkül (a `run-view.spec.ts` `e2eLateStepRunBodyRead` mintája).
   */
  var e2eApprovalListBodyReads: number | undefined;
}

/**
 * A lap saját `fetch` hívásába kötött számláló (`addInitScript`, a betöltés
 * ELŐTT): minden kiolvasott `GET /api/approvals` törzs után nő.
 */
async function installApprovalListBodyReadCounter(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalFetch = globalThis.fetch.bind(globalThis);
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: async (...parameters: Parameters<typeof fetch>) => {
        const response = await originalFetch(...parameters);
        const [input] = parameters;
        const url = input instanceof Request ? input.url : String(input);
        if (!new URL(url).pathname.endsWith('/approvals')) {
          return response;
        }
        const readText = response.text.bind(response);
        Object.defineProperty(response, 'text', {
          value: async () => {
            const text = await readText();
            Object.defineProperty(globalThis, 'e2eApprovalListBodyReads', {
              configurable: true,
              value: (globalThis.e2eApprovalListBodyReads ?? 0) + 1,
            });
            return text;
          },
        });
        return response;
      },
    });
  });
}

function openSubWorkflowRun(page: Page): Promise<void> {
  return page.getByTestId('rf__node-n-sub').getByRole('button', { name: 'Al-workflow futás megnyitása' }).click();
}

/**
 * A "Függő jóváhagyások" régió (`region` szerepkör a `<section>` nevével): a
 * lapozó és a döntés akciósávja, a transcript oldal alján, a húzható
 * elválasztón kívül (user döntés 2026-09-25, "transcript felül, kérdés
 * alul").
 */
function approvalRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Függő jóváhagyások' });
}

/**
 * A látott jóváhagyás szövege: a görgethető törzs a húzható panelben
 * (`ApprovalPromptBody`: a "visszavonhatatlan" figyelmeztetés, a cím, a
 * szöveg és a `payload`). Nem régió, mert a régió a húzható panelen kívül
 * áll, és szerepköre sincs, ezért a hatókör CSS kiválasztó.
 */
function approvalText(page: Page): Locator {
  return page.locator('.run-view-screen__transcript .approval-prompt-body');
}

/**
 * A döntés akciósávja a transcript oldalon, a jóváhagyás szövege alatt. A
 * hatókör CSS kiválasztó, és szándékosan nem a csoport szerepköre és neve: az
 * ARIA kötést külön teszt őrzi, a láthatósági és a döntés tesztek pedig a
 * kötés nélküli sávon is a gombokat találják meg. Szándékosan leszármazott,
 * nem közvetlen gyerek kiválasztó: ha a sáv a `Resizable` panelébe kerülne, a
 * gombokat a láthatósági állítások találják meg és buktatják el, nem egy
 * hiányzó elem.
 */
function decisionBar(page: Page): Locator {
  return page.locator('.run-view-screen__transcript .drawer__footer');
}

/**
 * A látott jóváhagyás egyik döntés gombja, pontos névegyezéssel.
 */
function decisionButton(page: Page, name: 'Jóváhagyás' | 'Elutasítás'): Locator {
  return decisionBar(page).getByRole('button', { name, exact: true });
}

function pagination(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Jóváhagyások lapozása' });
}

/**
 * A lapozó "k / n" alakú helyjelzője (nem interaktív szöveg).
 */
function paginationPosition(page: Page, position: string): Locator {
  return pagination(page).getByText(position, { exact: true });
}

/**
 * A lap összes csomópont kártyájának befoglaló doboza (viewport
 * koordinátában; az átfedés a nagyítástól független).
 */
async function nodeBoxes(page: Page): Promise<readonly { x: number; y: number; width: number; height: number }[]> {
  return page.locator('.react-flow__node').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }),
  );
}

function areBoxesIntersecting(
  first: Readonly<{ x: number; y: number; width: number; height: number }>,
  second: Readonly<{ x: number; y: number; width: number; height: number }>,
): boolean {
  return (
    first.x < second.x + second.width &&
    second.x < first.x + first.width &&
    first.y < second.y + second.height &&
    second.y < first.y + first.height
  );
}

/**
 * A látott jóváhagyás döntésének eredménye (`role="status"`). A szűrés a
 * szövegre kell, mert a "visszavonhatatlan" `Alert` is `status` szerepkörű.
 */
function decisionResult(page: Page): Locator {
  return decisionBar(page)
    .getByRole('status')
    .filter({ hasText: /^Döntés rögzítve/ });
}

/**
 * A rész a görgethető törzsben legalább görgetéssel olvasható: a törzs
 * görgetése után a lehető legnagyobb hányada látszik. Ha a rész magasabb a
 * törzs látható magasságánál (a `payload` 1440x600-on), a teljes rész
 * egyszerre nem férhet el, ezért ilyenkor a törzs látható magassága szabja a
 * várt arányt. A tűrés EGY képpont: a húzható elválasztó óta a panel magassága
 * a sáv százaléka, tehát a törzs teteje tört képponton áll, a görgetési
 * pozíció viszont egész, így a görgetett rész legfeljebb egy képponttal
 * lóghat ki (mérve 375x812-n 0,27 pixel egy 24 pixeles sorból).
 */
async function expectReadableByScrolling(page: Page, part: Locator): Promise<void> {
  await part.scrollIntoViewIfNeeded();
  const partBox = await part.boundingBox();
  const partHeight = partBox?.height ?? 0;
  const scrollAreaHeight = await approvalText(page)
    .locator('.drawer__body')
    .evaluate((element) => element.clientHeight);
  expect(partHeight).toBeGreaterThan(0);
  await expect(part).toBeInViewport({ ratio: Math.min(1, scrollAreaHeight / partHeight) - 1 / partHeight });
}

function decidedResponse(approval: PendingApproval): { status: number; contentType: string; body: string } {
  return jsonBody({ ...approval, decision: 'approved', decidedAtMs: Date.now() } satisfies PendingApproval);
}

test('a csomópont a kérés abszolút időpontját mutatja, a fejlécben jelvény, a panel a transcript sávban kimondja a visszavonhatatlanságot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await mockApprovalRun(page, [FIRST_APPROVAL, SECOND_APPROVAL]);
  await page.goto(APPROVAL_RUN_URL);

  // A `.graph-node-card__summary` a `waiting_approval` felirat saját osztálya
  // (`GraphNodeCard.tsx`): a `waiting_approval` ÁLLAPOT jelvényének felirata
  // ("jóváhagyásra vár") is "vár" végű, tehát a locator az összesítésre szűkül.
  const firstSummary = page.getByTestId('rf__node-n-first').locator('.graph-node-card__summary');
  const secondSummary = page.getByTestId('rf__node-n-second').locator('.graph-node-card__summary');
  const doneSummary = page.getByTestId('rf__node-n-done').locator('.graph-node-card__summary');

  // A várt szöveg a BÖNGÉSZŐ helyi idejében formázott időpont: a teszt nem
  // feltételezi, hogy a Node és a Chromium ugyanabban az időzónában fut.
  const formatInBrowser = async (ms: number): Promise<string> =>
    page.evaluate((value) => new Date(value).toLocaleTimeString('hu-HU'), ms);
  await expect(firstSummary).toHaveText(`${await formatInBrowser(FIRST_REQUESTED_AT_MS)} óta vár`);
  await expect(secondSummary).toHaveText(`${await formatInBrowser(SECOND_REQUESTED_AT_MS)} óta vár`);
  await expect(firstSummary).toHaveText(/^\d{1,2}:\d{2}:\d{2} óta vár$/);
  await expect(doneSummary).toHaveCount(0);

  // A jelzés a fejléc vezérlő sávjában, az állapot jelvény mellett áll.
  await expect(page.locator('.run-control__bar').getByText('jóváhagyásra vár', { exact: true })).toBeVisible();

  // A panel a transcript sávban, a transcript alatt áll, nem a vászon
  // fölött, és egyszerre egy jóváhagyást mutat: a legrégebbit.
  const transcriptSide = page.locator('.run-view-screen__transcript');
  await expect(transcriptSide.getByRole('region', { name: 'Függő jóváhagyások' })).toBeVisible();
  await expect(page.locator('.run-view-screen > .approval-prompt-panel')).toHaveCount(0);
  await expect(approvalText(page).getByRole('heading')).toHaveText([FIRST_APPROVAL.title]);
  await expect(paginationPosition(page, '1 / 2')).toBeVisible();
  await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toBeVisible();

  // A fixtúra csomópontjai a pillanatkép pozícióin nem fedik egymást.
  const boxes = await nodeBoxes(page);
  expect(boxes).toHaveLength(buildApprovalSnapshot().nodes.length);
  const overlapping = boxes.flatMap((box, index) =>
    boxes.slice(index + 1).filter((other) => areBoxesIntersecting(box, other)),
  );
  expect(overlapping).toEqual([]);
});

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1440, height: 600 },
    { width: 375, height: 812 },
  ] as const) {
    test(`${String(viewport.width)}x${String(viewport.height)}, ${theme} téma: 1, 4 és 10 jóváhagyásnál a lapozó "k / n" alakú, a látott jóváhagyás két gombja görgetés nélkül teljesen látszik, a tartalma a törzsben görgetve olvasható, a vászon magassága 0, 1, 4 és 10 jóváhagyással azonos, a tartalom terület nem görget`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((mode) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      const approvalsHolder: { current: readonly PendingApproval[] } = { current: [] };
      await mockIdleStream(page);
      await installApiMocks(
        page,
        approvalBaseMocks(async (route) => route.fulfill(jsonBody(approvalsHolder.current))),
      );

      const canvasHeights: number[] = [];
      for (const count of [0, 1, 4, 10]) {
        approvalsHolder.current = manyApprovals(count);
        await page.goto(APPROVAL_RUN_URL);
        await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
        // A 375 pixeles fül sávban a panel a (rejtett) Transcript fülön áll:
        // a DOM-ban van, de nem látszik, ezért a darabszám a mérce.
        await expect(page.locator('.approval-prompt-card')).toHaveCount(count === 0 ? 0 : 1);
        const canvasBox = await page.locator('.run-graph-canvas').boundingBox();
        canvasHeights.push(canvasBox?.height ?? -1);
        const appContentOverflow = await page
          .locator('.app-content')
          .evaluate((element) => [
            element.scrollHeight - element.clientHeight,
            element.scrollWidth - element.clientWidth,
          ]);
        expect(appContentOverflow).toEqual([0, 0]);

        const [shown] = approvalsHolder.current;
        if (shown === undefined) {
          continue;
        }
        if (viewport.width < 768) {
          await page.getByRole('tab', { name: 'Transcript' }).click();
        }
        await expect(paginationPosition(page, `1 / ${String(count)}`)).toBeVisible();
        // Görgetés nélkül: a `toBeInViewport` nem görget, és a levágó ősöket
        // (a görgethető törzset, a panelt, a transcript sávot) is figyelembe
        // veszi, tehát a `ratio: 1` a TELJES gombot követeli meg.
        await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
        await expect(decisionButton(page, 'Elutasítás')).toBeInViewport({ ratio: 1 });
        // A lapozó teljes doboza látszik, a jobb belső térközével együtt: a
        // `Resizable` panelei 2026-09-25 óta zsugorodnak, tehát a csoport nem
        // lóg túl, és a transcript oldal jobb szélét semmi nem vágja le
        // (`docs/research/2026-09-24-jovahagyas-panel-helye.md` 10. szekció).
        await expect(pagination(page)).toBeInViewport({ ratio: 1 });
        await expect(pagination(page).getByRole('button', { name: 'Következő' })).toBeInViewport({ ratio: 1 });

        // A látott jóváhagyás minden része a törzsben legalább görgetve
        // teljesen olvasható, és a gombok a törzs görgetése után is a helyükön
        // maradnak (nem a törzs részei).
        const readableParts = [
          approvalText(page).getByText('A döntés visszavonhatatlan', { exact: true }),
          approvalText(page).getByRole('heading', { name: shown.title, exact: true }),
          approvalText(page).getByText(shown.body, { exact: true }),
          approvalText(page).getByText('"currency": "EUR"'),
        ];
        for (const part of readableParts) {
          await expectReadableByScrolling(page, part);
        }
        await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
        await expect(decisionButton(page, 'Elutasítás')).toBeInViewport({ ratio: 1 });
      }

      expect(canvasHeights[0]).toBeGreaterThan(0);
      expect(canvasHeights).toEqual([canvasHeights[0], canvasHeights[0], canvasHeights[0], canvasHeights[0]]);
    });
  }
}

/**
 * A transcript és a jóváhagyás szövege közti húzható elválasztó
 * (`RunViewTranscriptSide.tsx`, user döntés 2026-09-25); az elsődleges
 * panele a transcript, tehát az `aria-valuenow` a transcript százaléka.
 */
function approvalSeparator(page: Page): Locator {
  return page.getByRole('separator', { name: 'A transcript és a jóváhagyás aránya' });
}

async function readLayoutState(page: Page): Promise<{ readonly canvas: number; readonly overflow: readonly number[] }> {
  return page.evaluate(() => {
    const { document } = globalThis;
    const appContent = document.querySelector('.app-content');
    return {
      canvas: document.querySelector('.run-graph-canvas')?.getBoundingClientRect().height ?? -1,
      overflow:
        appContent === null
          ? []
          : [appContent.scrollHeight - appContent.clientHeight, appContent.scrollWidth - appContent.clientWidth],
    };
  });
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1440, height: 600 },
    { width: 375, height: 812 },
  ] as const) {
    test(`${String(viewport.width)}x${String(viewport.height)}, ${theme} téma: a jóváhagyás és a transcript között húzható elválasztó áll, kezdetben felén; valódi egér húzással és billentyűvel mozdul, az aria-valuenow követi, az arány újratöltés után megmarad; a gombok görgetés nélkül látszanak, a vászon és a tartalom terület nem változik`, async ({
      page,
    }) => {
      const isTabbed = viewport.width < 768;
      await page.setViewportSize(viewport);
      await page.addInitScript((mode) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await mockApprovalRun(page, manyApprovals(4));
      await page.goto(APPROVAL_RUN_URL);
      await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
      const initialLayout = await readLayoutState(page);
      expect(initialLayout.canvas).toBeGreaterThan(0);
      expect(initialLayout.overflow).toEqual([0, 0]);
      if (isTabbed) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }

      // Kezdetben felén (user döntés 2026-09-25), vízszintes elválasztóval
      // (egymás ALATTI panelpár, W3C Window Splitter).
      const separator = approvalSeparator(page);
      await expect(separator).toHaveAttribute('aria-valuenow', '50');
      await expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
      await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
      await expect(decisionButton(page, 'Elutasítás')).toBeInViewport({ ratio: 1 });

      // Valódi egér húzás: 60 pixellel lejjebb. A `Resizable` a húzás
      // hosszát a két panel együttes magasságához méri, az elválasztó nélkül
      // (`measure-panel-geometry.ts`, `compute-drag-delta-percent.ts`), és a
      // kerekített értéket jelenti.
      const panelsHeight = await readApprovalPanelsHeight(page);
      const box = await separator.boundingBox();
      if (box === null) {
        throw new Error('az elválasztónak nincs befoglaló doboza');
      }
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      await page.mouse.move(centerX, centerY);
      await page.mouse.down();
      await page.mouse.move(centerX, centerY + 60, { steps: 5 });
      await page.mouse.up();
      const dragged = Math.round(50 + (60 / panelsHeight) * 100);
      await expect(separator).toHaveAttribute('aria-valuenow', String(dragged));

      // Billentyű: a nyíl lépésköze 5 (`ResizableHandle.tsx`).
      await separator.focus();
      await separator.press('ArrowUp');
      const final = String(dragged - 5);
      await expect(separator).toHaveAttribute('aria-valuenow', final);
      await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
      await expect(decisionButton(page, 'Elutasítás')).toBeInViewport({ ratio: 1 });
      // A vászon a fül sávban a (rejtett) "Gráf" fülön mérhető.
      if (isTabbed) {
        await page.getByRole('tab', { name: 'Gráf' }).click();
      }
      expect(await readLayoutState(page)).toEqual(initialLayout);

      // Az arány megmarad újratöltés után.
      await page.reload();
      await expect(page.getByTestId('rf__node-n-first')).toBeAttached();
      if (isTabbed) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      await expect(separator).toHaveAttribute('aria-valuenow', final);
    });
  }
}

/**
 * A húzható elválasztó két paneljének együttes magassága (az elválasztó
 * nélkül): ennek a százaléka a jelentett érték (`measure-panel-geometry.ts`).
 */
async function readApprovalPanelsHeight(page: Page): Promise<number> {
  return page
    .locator('.run-view-screen__transcript > .resizable-group > .resizable-panel')
    .evaluateAll((panels) => panels.reduce((sum, panel) => sum + panel.getBoundingClientRect().height, 0));
}

/**
 * A két panel VALÓDI aránya a kirajzolt magasságokból, a jelentett érték
 * kerekítésével, és a csoport túllógása (a gyerekek együttes magassága mínusz
 * a csoport kliens magassága).
 */
async function readApprovalSplit(page: Page): Promise<{ readonly ratio: number; readonly overflow: number }> {
  return page.locator('.run-view-screen__transcript > .resizable-group').evaluate((group) => {
    const panels = [...group.children].filter((child) => child.classList.contains('resizable-panel'));
    const [first, second] = panels.map((panel) => panel.getBoundingClientRect().height);
    const childrenHeight = [...group.children].reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
    return {
      ratio: first === undefined || second === undefined ? -1 : Math.round((first / (first + second)) * 100),
      overflow: Math.round(childrenHeight - group.clientHeight),
    };
  });
}

/**
 * A transcript utolsó sora a USER görgetésével (egérgörgő a transcript
 * burkolójának közepén, nem `scrollIntoView`, ami egy `overflow: hidden` őst
 * is görgetne) teljesen láthatóvá tehető. A görgő a lista végén a burkolóra
 * lép tovább (a panel minimumán a burkoló görget, `run-view.css`), ezért a
 * lépés ismétlődik, amíg a sor teljesen nem látszik (`toPass`, időzítő
 * nélkül).
 */
async function expectLastTranscriptRowReachable(page: Page): Promise<void> {
  const lastRow = page
    .getByRole('list', { name: 'Futás eseményei' })
    .locator(`[role="listitem"][aria-posinset="${String(APPROVAL_TRANSCRIPT_ROW_COUNT)}"]`);
  const content = page.locator('.run-view-screen__transcript-content');
  await expect(async () => {
    const box = await content.boundingBox();
    if (box === null) {
      throw new Error('a transcript burkolónak nincs befoglaló doboza');
    }
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1000);
    await expect(lastRow).toBeInViewport({ ratio: 1, timeout: 1000 });
  }).toPass();
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1440, height: 600 },
    { width: 375, height: 812 },
  ] as const) {
    test(`${String(viewport.width)}x${String(viewport.height)}, ${theme} téma: az elválasztó minden állásában (kezdő, Home, End) a lapozó és a két gomb teljesen látszik, a transcript utolsó sora görgetve teljesen látszik, a jelentett érték a valódi arány, és a Home és az End a határ; a vászon és a tartalom terület nem változik`, async ({
      page,
    }) => {
      const isTabbed = viewport.width < 768;
      await page.setViewportSize(viewport);
      await page.addInitScript((mode) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await mockApprovalRunWithTranscript(page, manyApprovals(1));
      await page.goto(APPROVAL_RUN_URL);
      await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
      const initialLayout = await readLayoutState(page);
      expect(initialLayout.canvas).toBeGreaterThan(0);
      expect(initialLayout.overflow).toEqual([0, 0]);
      if (isTabbed) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      await expect(page.getByRole('list', { name: 'Futás eseményei' }).getByRole('listitem').first()).toBeVisible();
      const separator = approvalSeparator(page);

      for (const position of ['kezdő', 'Home', 'End'] as const) {
        if (position !== 'kezdő') {
          await separator.focus();
          await separator.press(position);
        }
        // A csoport nem lóg túl: a transcript alját semmi nem vágja le.
        const split = await readApprovalSplit(page);
        expect(split.overflow).toBe(0);
        // A jelentett érték a VALÓDI arány (W3C WAI-ARIA separator:
        // `aria-valuenow` az elválasztó tényleges helye), és a Home, illetve
        // az End állás maga a határ (APG Window Splitter: `aria-valuemin` és
        // `aria-valuemax` a legkisebb és a legnagyobb elsődleges panel).
        await expect(separator).toHaveAttribute('aria-valuenow', String(split.ratio));
        if (position === 'Home') {
          await expect(separator).toHaveAttribute('aria-valuemin', String(split.ratio));
          expect(split.ratio).toBeGreaterThan(5);
        } else if (position === 'End') {
          await expect(separator).toHaveAttribute('aria-valuemax', String(split.ratio));
          expect(split.ratio).toBeLessThan(95);
        }
        // A lapozó és a két gomb a `Resizable` elemen kívül áll, tehát
        // görgetés nélkül, teljesen látszik.
        await expect(pagination(page)).toBeInViewport({ ratio: 1 });
        await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
        await expect(decisionButton(page, 'Elutasítás')).toBeInViewport({ ratio: 1 });
        await expectLastTranscriptRowReachable(page);
      }

      if (isTabbed) {
        await page.getByRole('tab', { name: 'Gráf' }).click();
      }
      expect(await readLayoutState(page)).toEqual(initialLayout);
    });
  }
}

/**
 * A transcript oldal részeinek függőleges doboza (viewport koordinátában): a
 * transcript burkolója, az elválasztó, a jóváhagyás szövege (a görgethető
 * törzs), a lapozó és a döntés akciósávja.
 */
async function readSideBoxes(
  page: Page,
): Promise<Readonly<Record<'transcript' | 'separator' | 'text' | 'pagination' | 'buttons', DomBox>>> {
  const box = async (locator: Locator): Promise<DomBox> => {
    const rect = await locator.boundingBox();
    if (rect === null) {
      throw new Error('a mért résznek nincs befoglaló doboza');
    }
    return { top: rect.y, bottom: rect.y + rect.height };
  };
  return {
    transcript: await box(page.locator('.run-view-screen__transcript-content')),
    separator: await box(approvalSeparator(page)),
    text: await box(approvalText(page).locator('.drawer__body')),
    pagination: await box(pagination(page)),
    buttons: await box(decisionBar(page)),
  };
}

interface DomBox {
  readonly top: number;
  readonly bottom: number;
}

/**
 * Tab lépések az elválasztótól a "Jóváhagyás" gombig: a lépések száma, és
 * hány fókuszt kapott elem állt közben a transcript burkolójában.
 */
async function tabFromSeparatorToApprove(
  page: Page,
): Promise<{ readonly tabs: number; readonly inTranscript: number }> {
  await approvalSeparator(page).focus();
  let inTranscript = 0;
  for (let tabs = 1; tabs <= 30; tabs += 1) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => {
      const active = globalThis.document.activeElement;
      return {
        isInTranscript: active?.closest('.run-view-screen__transcript-content') !== null,
        isApprove: active?.tagName === 'BUTTON' && active.textContent === 'Jóváhagyás',
      };
    });
    if (focused.isInTranscript) {
      inTranscript += 1;
    }
    if (focused.isApprove) {
      return { tabs, inTranscript };
    }
  }
  throw new Error('a Tab sorrend 30 lépésen belül nem érte el a Jóváhagyás gombot');
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1440, height: 600 },
    { width: 375, height: 812 },
    { width: 900, height: 1000 },
  ] as const) {
    test(`${String(viewport.width)}x${String(viewport.height)}, ${theme} téma: CLI sorrend: felül a transcript, alatta az elválasztó, a jóváhagyás szövege, közvetlenül alatta a lapozó és a gombok, minden elválasztó állásban teljesen látszva; a Tab a szövegtől a gombokig nem megy át transcript soron; a gombok a régióban, a jóváhagyáshoz kötve`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript((mode) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await mockApprovalRunWithTranscript(page, manyApprovals(4));
      await page.goto(APPROVAL_RUN_URL);
      await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
      if (viewport.width < 768) {
        await page.getByRole('tab', { name: 'Transcript' }).click();
      }
      await expect(page.getByRole('list', { name: 'Futás eseményei' }).getByRole('listitem').first()).toBeVisible();
      const [shown] = manyApprovals(4);
      if (shown === undefined) {
        throw new Error('a fixtúra nem adott jóváhagyást');
      }

      // A régió a lapozót és a gombokat fogja össze, és a gombok csoportja a
      // látott jóváhagyáshoz kötött: a neve a címe, a leírása a szövege (W3C
      // WCAG ARIA17, APG "Providing Accessible Names and Descriptions").
      const region = approvalRegion(page);
      await expect(region.getByRole('navigation', { name: 'Jóváhagyások lapozása' })).toBeVisible();
      const group = region.getByRole('group', { name: shown.title, exact: true });
      await expect(group).toHaveAccessibleDescription(shown.body);
      await expect(group.getByRole('button', { name: 'Jóváhagyás', exact: true })).toBeVisible();
      await expect(group.getByRole('button', { name: 'Elutasítás', exact: true })).toBeVisible();

      // A Tab sorrend az elválasztótól (közvetlenül a szöveg fölött) a
      // "Jóváhagyás" gombig egyetlen transcript soron sem megy át (a
      // `1bcface` állapotban 1440x900-on 7 soron át, 8 lépésben).
      const walk = await tabFromSeparatorToApprove(page);
      expect(walk.inTranscript).toBe(0);

      const separator = approvalSeparator(page);
      for (const position of ['kezdő', 'Home', 'End'] as const) {
        if (position !== 'kezdő') {
          await separator.focus();
          await separator.press(position);
        }
        const boxes = await readSideBoxes(page);
        // Felülről lefelé: transcript, elválasztó, szöveg, lapozó, gombok;
        // a szöveg, a lapozó és a gombok között nincs rés (egy pixel tűrés a
        // százalékos panelméret tört képpontja miatt).
        expect(boxes.transcript.bottom).toBeLessThanOrEqual(boxes.separator.top + 1);
        expect(boxes.separator.bottom).toBeLessThanOrEqual(boxes.text.top + 1);
        expect(Math.abs(boxes.pagination.top - boxes.text.bottom)).toBeLessThanOrEqual(1);
        expect(Math.abs(boxes.buttons.top - boxes.pagination.bottom)).toBeLessThanOrEqual(1);
        await expect(pagination(page)).toBeInViewport({ ratio: 1 });
        await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
        await expect(decisionButton(page, 'Elutasítás')).toBeInViewport({ ratio: 1 });
      }
    });
  }
}

/**
 * A jóváhagyás és a transcript arányának `localStorage` kulcsa
 * (`run-view-approval-layout.ts`), a `run-view.spec.ts` azonos mintájú
 * tesztjeihez hasonlóan szó szerint: a teszt a tárolt ALAKOT is állítja.
 */
const APPROVAL_LAYOUT_STORAGE_KEY = 'eggRunViewTranscriptApprovalLayout';

test('hibás alakú tárolt arányra az elválasztó felén áll, és a helyes alak íródik vissza', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript((key: string) => {
    globalThis.localStorage.setItem(key, JSON.stringify({ approval: 30 }));
  }, APPROVAL_LAYOUT_STORAGE_KEY);
  await mockApprovalRun(page, [FIRST_APPROVAL]);
  await page.goto(APPROVAL_RUN_URL);

  await expect(approvalSeparator(page)).toHaveAttribute('aria-valuenow', '50');
  await expect
    .poll(async () => page.evaluate((key: string) => globalThis.localStorage.getItem(key), APPROVAL_LAYOUT_STORAGE_KEY))
    .toBe('[50,50]');
});

test('letiltott tárolás esetén az elválasztó felén áll, a felület nem tör el', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // KIZÁRÓLAG a jóváhagyás arányának kulcsa dob (privát ablak, letiltott
  // tárolás), a téma és a gráf arány kulcsa működik: a `try`/`catch` ág e2e
  // alatt csak így futtatható (a `run-view.spec.ts` azonos mintája).
  await page.addInitScript((key: string) => {
    const storage = globalThis.localStorage;
    const originalGetItem = storage.getItem.bind(storage);
    storage.getItem = (name: string): ReturnType<Storage['getItem']> => {
      if (name === key) {
        throw new Error('a tárolás le van tiltva');
      }
      return originalGetItem(name);
    };
  }, APPROVAL_LAYOUT_STORAGE_KEY);
  await mockApprovalRun(page, [FIRST_APPROVAL]);
  await page.goto(APPROVAL_RUN_URL);

  await expect(approvalSeparator(page)).toHaveAttribute('aria-valuenow', '50');
  await expect(decisionButton(page, 'Jóváhagyás')).toBeInViewport({ ratio: 1 });
});

test.describe('érintés', () => {
  test.use({ hasTouch: true });

  /**
   * Érintéses húzás a telefonos fül sávban: a `run-view.css` `touch-action:
   * none` szabálya nélkül a böngésző az érintést pásztázásnak veszi, és a
   * pointer folyamot `pointercancel` zárja (mérve: 100 pixeles húzásra 50-ről
   * csak 54-re mozdul; research 9. szekció). A Chrome DevTools Protocol
   * `Input.dispatchTouchEvent` hívása valódi érintés eseményt ad, nem egeret.
   */
  test('375x812: az elválasztó érintéssel is húzható', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApprovalRun(page, manyApprovals(1));
    await page.goto(APPROVAL_RUN_URL);
    await page.getByRole('tab', { name: 'Transcript' }).click();
    const separator = approvalSeparator(page);
    await expect(separator).toHaveAttribute('aria-valuenow', '50');
    const panelsHeight = await readApprovalPanelsHeight(page);
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
    await expect(separator).toHaveAttribute('aria-valuenow', String(Math.round(50 + (100 / panelsHeight) * 100)));
  });

  /**
   * MEGSZAKÍTOTT érintéses húzás (`pointercancel`), 900x1000-en, ahol mindkét
   * elválasztó áll (a függőleges sáv, SPEC-008 10. szekció). A KÜLSŐ
   * elválasztón egy valódi érintéses húzás: a design system eleme
   * `touch-action` nélkül a böngésző pásztázásának adja át a mozdulatot, és a
   * pointer folyamot `pointercancel` zárja (W3C Pointer Events, "suppress a
   * pointer event stream"). A BELSŐN (`touch-action: none`) egy `touchCancel`
   * CDP esemény zárja a folyamot ugyanígy. Utána egy puszta egérmozgás a
   * vásznon és egy görgetés a transcripten: ha a húzás állapota bent ragad,
   * ezek mozdítják az elválasztót (mérve a `decfa69` állapoton: 73-ról 5-re,
   * majd 85-re; research 10. szekció).
   */
  for (const which of ['külső', 'belső'] as const) {
    test(`900x1000: a ${which} elválasztón a megszakított érintéses húzás után nem ragad bent a húzás, és egy egérmozgás vagy görgetés nem mozdítja`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 900, height: 1000 });
      await mockApprovalRunWithTranscript(page, manyApprovals(1));
      await page.goto(APPROVAL_RUN_URL);
      await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
      const separator =
        which === 'külső'
          ? page.getByRole('separator', { name: 'A Gráf és a Transcript aránya' })
          : approvalSeparator(page);
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
      await session.send('Input.dispatchTouchEvent', {
        type: which === 'külső' ? 'touchEnd' : 'touchCancel',
        touchPoints: [],
      });
      // A húzás állapota (a forrás `.is-dragging` osztálya) nem marad bent.
      await expect(separator).not.toHaveClass(/is-dragging/);
      const afterTouch = await separator.getAttribute('aria-valuenow');

      const canvas = await page.locator('.run-graph-canvas').boundingBox();
      if (canvas === null) {
        throw new Error('a vászonnak nincs befoglaló doboza');
      }
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 20);
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + 60, { steps: 4 });
      await expect(separator).toHaveAttribute('aria-valuenow', afterTouch ?? '');
      const list = await page.getByRole('list', { name: 'Futás eseményei' }).boundingBox();
      if (list === null) {
        throw new Error('a transcript listának nincs befoglaló doboza');
      }
      await page.mouse.move(list.x + list.width / 2, list.y + list.height / 2);
      await page.mouse.wheel(0, -300);
      await expect(separator).toHaveAttribute('aria-valuenow', afterTouch ?? '');
      await expect(separator).not.toHaveClass(/is-dragging/);
    });
  }
});

test('fan_out ágak azonos címmel: lapozás után a döntés a LÁTOTT jóváhagyás azonosítójára megy, és az eredmény a saját lapján marad', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const approvals = fanOutApprovals(3);
  const decisions: { readonly path: string; readonly body: unknown }[] = [];
  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => route.fulfill(jsonBody(approvals))),
    mockRoute('decideApproval', async (route) => {
      const request = route.request();
      const body: unknown = request.postDataJSON();
      decisions.push({ path: new URL(request.url()).pathname, body });
      const decided = approvals.find((approval) => request.url().includes(`/${approval.id}/`)) ?? FIRST_APPROVAL;
      await route.fulfill(decidedResponse(decided));
    }),
  ]);

  await page.goto(APPROVAL_RUN_URL);
  await expect(approvalText(page).getByRole('heading', { name: FAN_OUT_APPROVAL_TITLE, exact: true })).toBeVisible();
  await expect(paginationPosition(page, '1 / 3')).toBeVisible();
  await expect(approvalText(page).getByText('"branch": 0')).toBeVisible();

  await pagination(page).getByRole('button', { name: 'Következő' }).click();
  await expect(paginationPosition(page, '2 / 3')).toBeVisible();
  await expect(approvalText(page).getByText('"branch": 1')).toBeVisible();
  await decisionButton(page, 'Jóváhagyás').click();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: jóváhagyva.');

  await pagination(page).getByRole('button', { name: '3', exact: true }).click();
  await expect(paginationPosition(page, '3 / 3')).toBeVisible();
  await expect(approvalText(page).getByText('"branch": 2')).toBeVisible();
  await expect(decisionButton(page, 'Elutasítás')).toBeEnabled();
  await decisionButton(page, 'Elutasítás').click();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: elutasítva.');

  expect(decisions).toEqual([
    { path: '/api/approvals/appr-branch-1/decision', body: { decision: 'approved' } },
    { path: '/api/approvals/appr-branch-2/decision', body: { decision: 'rejected' } },
  ]);

  // Az első ágra még nem ment döntés: a gombjai engedélyezettek, eredmény
  // nincs; a második ág eredménye a saját lapján a helyén maradt.
  await pagination(page).getByRole('button', { name: '1', exact: true }).click();
  await expect(approvalText(page).getByText('"branch": 0')).toBeVisible();
  await expect(decisionButton(page, 'Jóváhagyás')).toBeEnabled();
  await expect(decisionResult(page)).toHaveCount(0);
  await pagination(page).getByRole('button', { name: '2', exact: true }).click();
  await expect(approvalText(page).getByText('"branch": 1')).toBeVisible();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(decisionButton(page, 'Jóváhagyás')).toBeDisabled();
  expect(decisions).toHaveLength(2);
});

test('siker után a látott jóváhagyás megmarad: mindkét gomb letiltva marad, az eredmény görgetés nélkül látszik, nyugtázó gomb nincs, és a futás váltása viszi el', async ({
  page,
}) => {
  // 1440x600: a panel a transcript sáv felét kapja, a törzse görget; a
  // gomboknak és az eredménynek ekkor is görgetés nélkül kell látszaniuk.
  await page.setViewportSize({ width: 1440, height: 600 });
  let isDecided = false;
  const decisionRequested = Promise.withResolvers<undefined>();
  const releaseDecision = Promise.withResolvers<undefined>();

  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => route.fulfill(jsonBody(isDecided ? [] : [FIRST_APPROVAL]))),
    mockRoute('decideApproval', async (route) => {
      const body: unknown = route.request().postDataJSON();
      expect(body).toEqual({ decision: 'approved' } satisfies ApprovalDecisionRequest);
      decisionRequested.resolve(undefined);
      await releaseDecision.promise;
      isDecided = true;
      await route.fulfill(decidedResponse(FIRST_APPROVAL));
    }),
  ]);

  await page.goto(APPROVAL_RUN_URL);
  const heading = approvalText(page).getByRole('heading', { name: FIRST_APPROVAL.title, exact: true });
  const approveButton = decisionButton(page, 'Jóváhagyás');
  const rejectButton = decisionButton(page, 'Elutasítás');
  await expect(approveButton).toBeEnabled();
  await expect(approveButton).toBeInViewport({ ratio: 1 });

  await approveButton.click();
  await decisionRequested.promise;
  await expect(approveButton).toBeDisabled();
  await expect(rejectButton).toBeDisabled();
  await expect(approveButton).toHaveClass(/is-loading/);
  await expect(rejectButton).not.toHaveClass(/is-loading/);

  releaseDecision.resolve(undefined);

  // A friss lista már üres (a csomópont várakozás felirata eltűnik), a
  // jóváhagyás mégis a helyén marad, visszakapcsolás nélkül, az eredménnyel.
  await expect(page.getByTestId('rf__node-n-first').locator('.graph-node-card__summary')).toHaveCount(0);
  const result = decisionResult(page);
  await expect(result).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(result).toBeInViewport({ ratio: 1 });
  await expect(heading).toHaveCount(1);
  await expect(paginationPosition(page, '1 / 1')).toBeVisible();
  await expect(approveButton).toBeDisabled();
  await expect(rejectButton).toBeDisabled();
  await expect(page.locator('.run-control__bar').getByText('jóváhagyásra vár', { exact: true })).toHaveCount(0);
  // Nyugtázás nincs (user döntés 2026-09-24).
  await expect(page.getByRole('button', { name: 'Rendben' })).toHaveCount(0);

  // Egy másik futásra váltva az eredmény eltűnik.
  await openSubWorkflowRun(page);
  await expect(page).toHaveURL(/\/run\?runId=run-child$/);
  await expect(heading).toHaveCount(0);
  await expect(approvalRegion(page)).toHaveCount(0);
  await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toHaveCount(0);
});

test('az eredmény magától nem tűnik el: a döntés után egy perc lefuttatott idő (Clock API) után is látszik, a gombok letiltva', async ({
  page,
}) => {
  // A Clock API a lap betöltése ELŐTT települ (a dokumentáció szerint minden
  // más órával kapcsolatos hívás előtt,
  // <https://playwright.dev/docs/clock>), és a `runFor` az eltelt idő minden
  // időzítőjét lefuttatja (<https://playwright.dev/docs/api/class-clock#clock-run-for>).
  // Egy 3 másodperc után eltüntető időzítő így a teszt alatt biztosan
  // lefutna.
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 });
  let isDecided = false;
  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => route.fulfill(jsonBody(isDecided ? [] : [FIRST_APPROVAL]))),
    mockRoute('decideApproval', async (route) => {
      isDecided = true;
      await route.fulfill(decidedResponse(FIRST_APPROVAL));
    }),
  ]);

  await page.goto(APPROVAL_RUN_URL);
  await decisionButton(page, 'Jóváhagyás').click();
  const result = decisionResult(page);
  await expect(result).toHaveText('Döntés rögzítve: jóváhagyva.');

  await page.clock.runFor('01:00');

  await expect(result).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(result).toBeInViewport({ ratio: 1 });
  await expect(approvalText(page).getByRole('heading', { name: FIRST_APPROVAL.title, exact: true })).toBeVisible();
  await expect(decisionButton(page, 'Jóváhagyás')).toBeDisabled();
  await expect(decisionButton(page, 'Elutasítás')).toBeDisabled();
});

test('siker után, ha a lista újratöltése elbukik, a gombok akkor sem kapcsolnak vissza', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let isDecided = false;

  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) =>
      route.fulfill(
        isDecided ? jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500) : jsonBody([FIRST_APPROVAL]),
      ),
    ),
    mockRoute('decideApproval', async (route) => {
      isDecided = true;
      await route.fulfill(decidedResponse(FIRST_APPROVAL));
    }),
  ]);

  await page.goto(APPROVAL_RUN_URL);
  const approveButton = decisionButton(page, 'Jóváhagyás');
  await approveButton.click();

  // Az újratöltés hibája a panelen jelenik meg; a régi lista a helyén marad,
  // és a még mindig listázott, de már eldöntött jóváhagyás letiltva marad.
  await expect(page.locator('.approval-prompt-panel > [role="alert"]')).toBeVisible();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(approveButton).toBeDisabled();
  await expect(decisionButton(page, 'Elutasítás')).toBeDisabled();
});

test('az Elutasítás gombra kapott conflict után a gombok letiltva maradnak, a hibaüzenet görgetés nélkül látszik, és a lista újratöltődik', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  let approvalCallCount = 0;

  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => {
      approvalCallCount += 1;
      await route.fulfill(jsonBody([FIRST_APPROVAL]));
    }),
    mockRoute('decideApproval', async (route) => {
      const body: unknown = route.request().postDataJSON();
      expect(body).toEqual({ decision: 'rejected' } satisfies ApprovalDecisionRequest);
      await route.fulfill(jsonBody({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, 409));
    }),
  ]);

  await page.goto(APPROVAL_RUN_URL);
  const rejectButton = decisionButton(page, 'Elutasítás');
  await expect(rejectButton).toBeEnabled();
  await expect(rejectButton).toBeInViewport({ ratio: 1 });
  const callsBeforeDecision = approvalCallCount;

  await rejectButton.click();

  const alert = decisionBar(page).getByRole('alert');
  await expect(alert).toHaveText('Az elem állapota most nem engedi a műveletet.: a jóváhagyás már el lett döntve');
  await expect(alert).toBeInViewport({ ratio: 1 });
  await expect.poll(() => approvalCallCount).toBeGreaterThan(callsBeforeDecision);
  // A lista a conflict után is tartalmazza a jóváhagyást, a gombok mégsem
  // kapcsolnak vissza: a döntés a szerver szerint már lezárt.
  await expect(rejectButton).toBeDisabled();
  await expect(decisionButton(page, 'Jóváhagyás')).toBeDisabled();
});

test('a jóváhagyás lista betöltési hibájára figyelmeztetést mutat a panelen', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await mockIdleStream(page);
  await installApiMocks(
    page,
    approvalBaseMocks(async (route) =>
      route.fulfill(jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500)),
    ),
  );

  await page.goto(APPROVAL_RUN_URL);

  await expect(page.locator('.approval-prompt-panel').getByRole('alert')).toBeVisible();
});

test('átmeneti hibára (503) a gombok újrapróbálásra engedélyezettek, és az újrapróbálás rögzíti a döntést', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let decisionCallCount = 0;
  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => route.fulfill(jsonBody(decisionCallCount >= 2 ? [] : [FIRST_APPROVAL]))),
    mockRoute('decideApproval', async (route) => {
      decisionCallCount += 1;
      if (decisionCallCount === 1) {
        await route.fulfill({ status: 503, contentType: 'text/plain', body: '' });
        return;
      }
      await route.fulfill(decidedResponse(FIRST_APPROVAL));
    }),
  ]);

  await page.goto(APPROVAL_RUN_URL);
  const approveButton = decisionButton(page, 'Jóváhagyás');
  await approveButton.click();

  await expect(decisionBar(page).getByRole('alert')).toBeVisible();
  await expect(approveButton).toBeEnabled();

  await approveButton.click();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(decisionBar(page).getByRole('alert')).toHaveCount(0);
  await expect(approveButton).toBeDisabled();
});

test('az első betöltés alatt a panel betöltés jelzést mutat, és másik futásra váltva a régi futás késve érkező listája eldobódik', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  const firstListRequested = Promise.withResolvers<undefined>();
  const releaseFirstList = Promise.withResolvers<undefined>();
  let listCallCount = 0;
  await mockIdleStream(page);
  await installApiMocks(
    page,
    approvalBaseMocks(async (route) => {
      listCallCount += 1;
      if (listCallCount === 1) {
        firstListRequested.resolve(undefined);
        await releaseFirstList.promise;
        await route.fulfill(jsonBody([FIRST_APPROVAL]));
        return;
      }
      await route.fulfill(jsonBody([]));
    }),
  );
  await installApprovalListBodyReadCounter(page);

  await page.goto(APPROVAL_RUN_URL);
  await firstListRequested.promise;
  const loading = page.getByRole('progressbar', { name: 'a függő jóváhagyások betöltése folyamatban' });
  await expect(loading).toBeVisible();

  await openSubWorkflowRun(page);
  await expect(page).toHaveURL(/\/run\?runId=run-child$/);
  await expect(loading).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.e2eApprovalListBodyReads)).toBe(1);

  // A régi futás listája csak MOST érkezik meg: a jóváhagyása nem jelenhet
  // meg az új futás nézetében.
  releaseFirstList.resolve(undefined);
  await expect.poll(() => page.evaluate(() => globalThis.e2eApprovalListBodyReads)).toBe(2);
  await expect(page.locator('.approval-prompt-card')).toHaveCount(0);
});

test('másik futásra váltva a régi futás késve érkező döntés válasza nem hoz létre jóváhagyást az új nézetben', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  const decisionRequested = Promise.withResolvers<undefined>();
  const releaseDecision = Promise.withResolvers<undefined>();
  await mockIdleStream(page);
  await installApiMocks(page, [
    // A lista a nézett futás szerint: a gyerek futás nézetében üres.
    ...approvalBaseMocks(async (route) => {
      const isChildView = new URL(page.url()).search.includes('run-child');
      await route.fulfill(jsonBody(isChildView ? [] : [FIRST_APPROVAL]));
    }),
    mockRoute('decideApproval', async (route) => {
      decisionRequested.resolve(undefined);
      await releaseDecision.promise;
      await route.fulfill(decidedResponse(FIRST_APPROVAL));
    }),
  ]);
  await installApprovalListBodyReadCounter(page);

  await page.goto(APPROVAL_RUN_URL);
  await decisionButton(page, 'Jóváhagyás').click();
  await decisionRequested.promise;

  await openSubWorkflowRun(page);
  await expect(page).toHaveURL(/\/run\?runId=run-child$/);
  await expect(page.locator('.approval-prompt-card')).toHaveCount(0);
  const readsBeforeAnswer = await page.evaluate(() => globalThis.e2eApprovalListBodyReads ?? 0);

  // A döntés válasza után a lista újratöltődik (`onDecided`): a kiolvasott
  // lista törzsek számának növekedése jelzi, hogy a válasz feldolgozása lefutott.
  releaseDecision.resolve(undefined);
  await expect
    .poll(() => page.evaluate(() => globalThis.e2eApprovalListBodyReads ?? 0))
    .toBeGreaterThan(readsBeforeAnswer);
  await expect(page.locator('.approval-prompt-card')).toHaveCount(0);
  await expect(page.getByText('Döntés rögzítve', { exact: false })).toHaveCount(0);
});
