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
  approvalBaseMocks,
  buildApprovalSnapshot,
  FAN_OUT_APPROVAL_TITLE,
  fanOutApprovals,
  FIRST_APPROVAL,
  FIRST_REQUESTED_AT_MS,
  manyApprovals,
  mockApprovalRun,
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
 * A jóváhagyás panel szakasza (`region` szerepkör a `<section>` nevével).
 */
function approvalRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Függő jóváhagyások' });
}

/**
 * A látott jóváhagyás egyik döntés gombja. A név pontos egyezéssel, mert a
 * lapozó gombjai is a szakaszban állnak.
 */
function decisionButton(page: Page, name: 'Jóváhagyás' | 'Elutasítás'): Locator {
  return approvalRegion(page).getByRole('button', { name, exact: true });
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
  return approvalRegion(page)
    .getByRole('status')
    .filter({ hasText: /^Döntés rögzítve/ });
}

/**
 * A rész a görgethető törzsben legalább görgetéssel olvasható: a törzs
 * görgetése után a lehető legnagyobb hányada látszik. Ha a rész magasabb a
 * törzs látható magasságánál (a `payload` 1440x600-on), a teljes rész
 * egyszerre nem férhet el, ezért ilyenkor a törzs látható magassága szabja a
 * várt arányt; a 0,99-es szorzó a képpont kerekítésé.
 */
async function expectReadableByScrolling(page: Page, part: Locator): Promise<void> {
  await part.scrollIntoViewIfNeeded();
  const partBox = await part.boundingBox();
  const partHeight = partBox?.height ?? 0;
  const scrollAreaHeight = await approvalRegion(page)
    .locator('.drawer__body')
    .evaluate((element) => element.clientHeight);
  expect(partHeight).toBeGreaterThan(0);
  await expect(part).toBeInViewport({ ratio: Math.min(1, scrollAreaHeight / partHeight) * 0.99 });
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

  // A panel a transcript sávban, a transcript fölött áll, nem a vászon
  // fölött, és egyszerre egy jóváhagyást mutat: a legrégebbit.
  const transcriptSide = page.locator('.run-view-screen__transcript');
  await expect(transcriptSide.getByRole('region', { name: 'Függő jóváhagyások' })).toBeVisible();
  await expect(page.locator('.run-view-screen > .approval-prompt-panel')).toHaveCount(0);
  await expect(approvalRegion(page).getByRole('heading')).toHaveText([FIRST_APPROVAL.title]);
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
        await expect(pagination(page)).toBeInViewport({ ratio: 1 });

        // A látott jóváhagyás minden része a törzsben legalább görgetve
        // teljesen olvasható, és a gombok a törzs görgetése után is a helyükön
        // maradnak (nem a törzs részei).
        const readableParts = [
          approvalRegion(page).getByText('A döntés visszavonhatatlan', { exact: true }),
          approvalRegion(page).getByRole('heading', { name: shown.title, exact: true }),
          approvalRegion(page).getByText(shown.body, { exact: true }),
          approvalRegion(page).getByText('"currency": "EUR"'),
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
  await expect(approvalRegion(page).getByRole('heading', { name: FAN_OUT_APPROVAL_TITLE, exact: true })).toBeVisible();
  await expect(paginationPosition(page, '1 / 3')).toBeVisible();
  await expect(approvalRegion(page).getByText('"branch": 0')).toBeVisible();

  await pagination(page).getByRole('button', { name: 'Következő' }).click();
  await expect(paginationPosition(page, '2 / 3')).toBeVisible();
  await expect(approvalRegion(page).getByText('"branch": 1')).toBeVisible();
  await decisionButton(page, 'Jóváhagyás').click();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: jóváhagyva.');

  await pagination(page).getByRole('button', { name: '3', exact: true }).click();
  await expect(paginationPosition(page, '3 / 3')).toBeVisible();
  await expect(approvalRegion(page).getByText('"branch": 2')).toBeVisible();
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
  await expect(approvalRegion(page).getByText('"branch": 0')).toBeVisible();
  await expect(decisionButton(page, 'Jóváhagyás')).toBeEnabled();
  await expect(decisionResult(page)).toHaveCount(0);
  await pagination(page).getByRole('button', { name: '2', exact: true }).click();
  await expect(approvalRegion(page).getByText('"branch": 1')).toBeVisible();
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
  const heading = approvalRegion(page).getByRole('heading', { name: FIRST_APPROVAL.title, exact: true });
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
  await expect(approvalRegion(page).getByRole('heading', { name: FIRST_APPROVAL.title, exact: true })).toBeVisible();
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

  const alert = approvalRegion(page).getByRole('alert');
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

  await expect(approvalRegion(page).getByRole('alert')).toBeVisible();
  await expect(approveButton).toBeEnabled();

  await approveButton.click();
  await expect(decisionResult(page)).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(approvalRegion(page).getByRole('alert')).toHaveCount(0);
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
