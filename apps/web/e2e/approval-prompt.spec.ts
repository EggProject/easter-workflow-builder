// E2E az `approval-prompt` témára (T-009-27, SPEC-008 8. szekció, AC35).
//
// MIÉRT KELL E2E A HAPPY-DOM UNIT TESZTEK MELLETT. A panel HELYE (a
// transcript sávban, nem a vászon fölött) és az, hogy a vászon magassága nem
// függ a jóváhagyások számától, csak valódi layouttal mérhető: happy-dom nem
// számol elrendezést. Ugyanígy csak valódi böngészőben igazolható, hogy a
// döntés eredménye a görgetett, felezett panelben is LÁTHATÓ marad, és hogy a
// gombok valódi `disabled` attribútuma a siker, a conflict és az újratöltési
// hiba után sem kapcsol vissza. Minden REST hívás `page.route()` mockon megy,
// valós backend szervert egyetlen teszt sem szólít meg (`.claude/CLAUDE.md` 11.
// szekció). Az élő (SSE keretre történő) frissítés e2e tesztje a nyitott
// kapcsolatot igényli, ezért a `sse-real-server.spec.ts` fájlban áll.
import type {
  ApprovalDecisionRequest,
  NodeConfig,
  PendingApproval,
  RunDetail,
  RunSnapshotResponse,
  StepRunRecord,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
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

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), lásd `run-view.spec.ts` azonos megjegyzését */

function approvalConfig(title: string): NodeConfig {
  return {
    type: 'human_approval',
    title,
    bodyTemplate: 'Kérlek erősítsd meg',
    timeoutMs: null,
    onUnhandledError: null,
  };
}

const RUN_DETAIL: RunDetail = {
  id: 'run-approval',
  workflowId: 'w-approval',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: 'run-approval',
  depth: 1,
  workflowAncestry: ['w-approval'],
  graphSnapshotHash: 'c'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const BASE_STEP_RUN: StepRunRecord = {
  id: 'sr-1',
  runId: RUN_DETAIL.id,
  nodeId: 'n-1',
  nodeType: 'human_approval',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'waiting_approval',
  providerId: 'claude-subscription',
  modelId: null,
  sessionMode: null,
  sdkSessionId: null,
  resumedFromSessionId: null,
  forkedSession: false,
  structuredOutputStrategy: null,
  output: null,
  resultSubtype: null,
  numTurns: null,
  inputTokens: null,
  outputTokens: null,
  cacheReadInputTokens: null,
  cacheCreationInputTokens: null,
  subWorkflowRunId: null,
  errorKind: null,
  errorMessage: null,
  startedAtMs: 2,
  finishedAtMs: null,
  createdAtMs: 2,
};

const RUN_URL = `/run?runId=${RUN_DETAIL.id}`;

/**
 * Két függő `human_approval` csomópont, és egy harmadik, már ELDÖNTÖTT
 * (`succeeded`), ami nem szerepel a `GET /api/approvals` válaszában (a végpont
 * csak `waiting_approval` lépést listáz, user döntés 2026-09-23/24), tehát a
 * kártyáján sincs várakozás felirat. A `sub_workflow` csomópont gombja
 * UGYANERRE a képernyőre navigál, másik `?runId=` értékkel: ezen át mérhető,
 * hogy a futás váltása előtt indított kérés késve érkező válasza eldobódik.
 */
function buildSnapshot(): RunSnapshotResponse {
  return {
    version: 1,
    sdkVersionPin: '0.1.13',
    workflow: { id: RUN_DETAIL.workflowId, name: 'Jóváhagyás teszt workflow', description: null },
    nodes: [
      {
        id: 'n-first',
        type: 'human_approval',
        label: 'Első jóváhagyás',
        position: { x: 0, y: 0 },
        config: approvalConfig('Első jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-second',
        type: 'human_approval',
        label: 'Második jóváhagyás',
        position: { x: 300, y: 0 },
        config: approvalConfig('Második jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-done',
        type: 'human_approval',
        label: 'Már eldöntött jóváhagyás',
        position: { x: 600, y: 0 },
        config: approvalConfig('Már eldöntött jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-sub',
        type: 'sub_workflow',
        label: 'Al-workflow',
        position: { x: 900, y: 0 },
        config: { type: 'sub_workflow', targetWorkflowId: 'w-child', inputMapping: {}, onUnhandledError: null },
        effectiveProviderId: 'claude-subscription',
      },
    ],
    edges: [],
  };
}

const STEP_RUNS: readonly StepRunRecord[] = [
  { ...BASE_STEP_RUN, id: 'sr-first', nodeId: 'n-first' },
  { ...BASE_STEP_RUN, id: 'sr-second', nodeId: 'n-second' },
  { ...BASE_STEP_RUN, id: 'sr-done', nodeId: 'n-done', status: 'succeeded', finishedAtMs: 3 },
  {
    ...BASE_STEP_RUN,
    id: 'sr-sub',
    nodeId: 'n-sub',
    nodeType: 'sub_workflow',
    status: 'running',
    subWorkflowRunId: 'run-child',
  },
];

// Két rögzített, eltérő kérés időpont (helyi idő szerint 10:32:05 és
// 11:47:30): a felirat abszolút időpont, tehát a futás pillanatától nem függ.
const FIRST_REQUESTED_AT_MS = new Date(2026, 8, 24, 10, 32, 5).getTime();
const SECOND_REQUESTED_AT_MS = new Date(2026, 8, 24, 11, 47, 30).getTime();

const FIRST_APPROVAL: PendingApproval = {
  id: 'appr-first',
  runId: RUN_DETAIL.id,
  stepRunId: 'sr-first',
  title: 'Engedélyezed a fizetést?',
  body: 'Kérlek erősítsd meg a tranzakciót',
  payload: { amount: 100, currency: 'EUR' },
  decision: null,
  requestedAtMs: FIRST_REQUESTED_AT_MS,
  decidedAtMs: null,
};

const SECOND_APPROVAL: PendingApproval = {
  ...FIRST_APPROVAL,
  id: 'appr-second',
  stepRunId: 'sr-second',
  title: 'Engedélyezed a szállítást?',
  requestedAtMs: SECOND_REQUESTED_AT_MS,
};

/**
 * `n` darab függő jóváhagyás, eltérő címmel és kérés időponttal, a vászon
 * magasság méréséhez. A lépés futás azonosítók a rajzon nem szereplő
 * lépésekre mutatnak, tehát a csomópontok dekorációja minden `n` mellett
 * azonos: a mérés kizárólag a panel hatását látja.
 */
function manyApprovals(count: number): readonly PendingApproval[] {
  return Array.from({ length: count }, (_, index) => ({
    ...FIRST_APPROVAL,
    id: `appr-many-${String(index)}`,
    stepRunId: `sr-many-${String(index)}`,
    title: `Tömeges jóváhagyás ${String(index + 1)}`,
    requestedAtMs: FIRST_REQUESTED_AT_MS + index * 60_000,
  }));
}

function baseMocks(listPendingApprovals: MockRoute['handle']): readonly MockRoute[] {
  return [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(buildSnapshot()))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('listPendingApprovals', listPendingApprovals),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ];
}

async function mockApprovalRun(page: Page, approvals: readonly PendingApproval[]): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(
    page,
    baseMocks(async (route) => route.fulfill(jsonBody(approvals))),
  );
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

function approvalCard(page: Page, title: string): Locator {
  return page.locator('.approval-prompt-card').filter({ has: page.getByRole('heading', { name: title }) });
}

test('a csomópont a kérés abszolút időpontját mutatja, a fejlécben jelvény, a panel a transcript sávban kimondja a visszavonhatatlanságot', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await mockApprovalRun(page, [FIRST_APPROVAL, SECOND_APPROVAL]);
  await page.goto(RUN_URL);

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

  // A panel a transcript sávban, a transcript fölött áll, nem a vászon fölött.
  const transcriptSide = page.locator('.run-view-screen__transcript');
  await expect(transcriptSide.locator('.approval-prompt-card')).toHaveCount(2);
  await expect(page.locator('.run-view-screen > .approval-prompt-panel')).toHaveCount(0);
  await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toBeVisible();
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1440, height: 600 },
  { width: 375, height: 812 },
] as const) {
  test(`${String(viewport.width)}x${String(viewport.height)}: a vászon magassága 0, 1 és 4 függő jóváhagyással azonos, és a tartalom terület nem görget`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const approvalsHolder: { current: readonly PendingApproval[] } = { current: [] };
    await mockIdleStream(page);
    await installApiMocks(
      page,
      baseMocks(async (route) => route.fulfill(jsonBody(approvalsHolder.current))),
    );

    const canvasHeights: number[] = [];
    for (const count of [0, 1, 4]) {
      approvalsHolder.current = manyApprovals(count);
      await page.goto(RUN_URL);
      await expect(page.getByTestId('rf__node-n-first')).toBeVisible();
      // A kártyák a 375 pixeles fül sávban a (rejtett) Transcript fülön
      // állnak: a DOM-ban vannak, de nem látszanak, ezért a darabszám a mérce.
      await expect(page.locator('.approval-prompt-card')).toHaveCount(count);
      const canvasBox = await page.locator('.run-graph-canvas').boundingBox();
      canvasHeights.push(canvasBox?.height ?? -1);
      expect(
        await page.locator('.app-content').evaluate((element) => element.scrollHeight - element.clientHeight),
      ).toBe(0);
    }

    expect(canvasHeights[0]).toBeGreaterThan(0);
    expect(canvasHeights).toEqual([canvasHeights[0], canvasHeights[0], canvasHeights[0]]);
  });
}

test('siker után a kártya megmarad: mindkét gomb letiltva marad, az eredmény látszik, a Rendben viszi el', async ({
  page,
}) => {
  // 1440x600: a panel a transcript sáv felét kapja, és maga görget; az
  // eredménynek ekkor is a látható területen belül kell megjelennie.
  await page.setViewportSize({ width: 1440, height: 600 });
  let isDecided = false;
  const decisionRequested = Promise.withResolvers<undefined>();
  const releaseDecision = Promise.withResolvers<undefined>();

  await mockIdleStream(page);
  await installApiMocks(page, [
    ...baseMocks(async (route) => route.fulfill(jsonBody(isDecided ? [] : [FIRST_APPROVAL]))),
    mockRoute('decideApproval', async (route) => {
      const body: unknown = route.request().postDataJSON();
      expect(body).toEqual({ decision: 'approved' } satisfies ApprovalDecisionRequest);
      decisionRequested.resolve(undefined);
      await releaseDecision.promise;
      isDecided = true;
      await route.fulfill(
        jsonBody({ ...FIRST_APPROVAL, decision: 'approved', decidedAtMs: Date.now() } satisfies PendingApproval),
      );
    }),
  ]);

  await page.goto(RUN_URL);
  const card = approvalCard(page, FIRST_APPROVAL.title);
  const approveButton = card.getByRole('button', { name: 'Jóváhagyás' });
  const rejectButton = card.getByRole('button', { name: 'Elutasítás' });
  await approveButton.scrollIntoViewIfNeeded();
  await expect(approveButton).toBeEnabled();

  await approveButton.click();
  await decisionRequested.promise;
  await expect(approveButton).toBeDisabled();
  await expect(rejectButton).toBeDisabled();
  await expect(approveButton).toHaveClass(/is-loading/);
  await expect(rejectButton).not.toHaveClass(/is-loading/);

  releaseDecision.resolve(undefined);

  // A friss lista már üres (a csomópont várakozás felirata eltűnik), a kártya
  // mégis a helyén marad, visszakapcsolás nélkül, az eredménnyel.
  await expect(page.getByTestId('rf__node-n-first').locator('.graph-node-card__summary')).toHaveCount(0);
  const result = card.getByRole('status');
  await expect(result).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(result).toBeInViewport({ ratio: 1 });
  await expect(approveButton).toBeDisabled();
  await expect(rejectButton).toBeDisabled();
  await expect(page.locator('.run-control__bar').getByText('jóváhagyásra vár', { exact: true })).toHaveCount(0);

  await card.getByRole('button', { name: 'Rendben' }).click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText('A döntés visszavonhatatlan', { exact: true })).toHaveCount(0);
});

test('siker után, ha a lista újratöltése elbukik, a kártya gombjai akkor sem kapcsolnak vissza', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let isDecided = false;

  await mockIdleStream(page);
  await installApiMocks(page, [
    ...baseMocks(async (route) =>
      route.fulfill(
        isDecided ? jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500) : jsonBody([FIRST_APPROVAL]),
      ),
    ),
    mockRoute('decideApproval', async (route) => {
      isDecided = true;
      await route.fulfill(
        jsonBody({ ...FIRST_APPROVAL, decision: 'approved', decidedAtMs: Date.now() } satisfies PendingApproval),
      );
    }),
  ]);

  await page.goto(RUN_URL);
  const card = approvalCard(page, FIRST_APPROVAL.title);
  const approveButton = card.getByRole('button', { name: 'Jóváhagyás' });
  await approveButton.click();

  // Az újratöltés hibája a panelen jelenik meg; a régi lista a helyén marad,
  // és a még mindig listázott, de már eldöntött kártya letiltva marad.
  await expect(page.locator('.approval-prompt-panel > [role="alert"]')).toBeVisible();
  await expect(card.getByRole('status')).toHaveText('Döntés rögzítve: jóváhagyva.');
  await expect(approveButton).toBeDisabled();
  await expect(card.getByRole('button', { name: 'Elutasítás' })).toBeDisabled();
});

test('az Elutasítás gombra kapott conflict után a gombok letiltva maradnak, a hibaüzenet látszik, és a lista újratöltődik', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  let approvalCallCount = 0;

  await mockIdleStream(page);
  await installApiMocks(page, [
    ...baseMocks(async (route) => {
      approvalCallCount += 1;
      await route.fulfill(jsonBody([FIRST_APPROVAL]));
    }),
    mockRoute('decideApproval', async (route) => {
      const body: unknown = route.request().postDataJSON();
      expect(body).toEqual({ decision: 'rejected' } satisfies ApprovalDecisionRequest);
      await route.fulfill(jsonBody({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, 409));
    }),
  ]);

  await page.goto(RUN_URL);
  const card = approvalCard(page, FIRST_APPROVAL.title);
  const rejectButton = card.getByRole('button', { name: 'Elutasítás' });
  await rejectButton.scrollIntoViewIfNeeded();
  await expect(rejectButton).toBeEnabled();
  const callsBeforeDecision = approvalCallCount;

  await rejectButton.click();

  const alert = card.getByRole('alert');
  await expect(alert).toHaveText('Az elem állapota most nem engedi a műveletet.: a jóváhagyás már el lett döntve');
  await expect(alert).toBeInViewport({ ratio: 1 });
  await expect.poll(() => approvalCallCount).toBeGreaterThan(callsBeforeDecision);
  // A lista a conflict után is tartalmazza a jóváhagyást, a gombok mégsem
  // kapcsolnak vissza: a döntés a szerver szerint már lezárt.
  await expect(rejectButton).toBeDisabled();
  await expect(card.getByRole('button', { name: 'Jóváhagyás' })).toBeDisabled();
});

test('a jóváhagyás lista betöltési hibájára figyelmeztetést mutat a panelen', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await mockIdleStream(page);
  await installApiMocks(
    page,
    baseMocks(async (route) => route.fulfill(jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500))),
  );

  await page.goto(RUN_URL);

  await expect(page.locator('.approval-prompt-panel').getByRole('alert')).toBeVisible();
});

test('átmeneti hibára (503) a gombok újrapróbálásra engedélyezettek, a Rendben csak az üzenetet törli, és az újrapróbálás rögzíti a döntést', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let decisionCallCount = 0;
  await mockIdleStream(page);
  await installApiMocks(page, [
    ...baseMocks(async (route) => route.fulfill(jsonBody(decisionCallCount >= 2 ? [] : [FIRST_APPROVAL]))),
    mockRoute('decideApproval', async (route) => {
      decisionCallCount += 1;
      if (decisionCallCount === 1) {
        await route.fulfill({ status: 503, contentType: 'text/plain', body: '' });
        return;
      }
      await route.fulfill(
        jsonBody({ ...FIRST_APPROVAL, decision: 'approved', decidedAtMs: Date.now() } satisfies PendingApproval),
      );
    }),
  ]);

  await page.goto(RUN_URL);
  const card = approvalCard(page, FIRST_APPROVAL.title);
  const approveButton = card.getByRole('button', { name: 'Jóváhagyás' });
  await approveButton.click();

  await expect(card.getByRole('alert')).toBeVisible();
  await expect(approveButton).toBeEnabled();
  await card.getByRole('button', { name: 'Rendben' }).click();
  await expect(card.getByRole('alert')).toHaveCount(0);
  await expect(card).toHaveCount(1);
  await expect(approveButton).toBeEnabled();

  await approveButton.click();
  await expect(card.getByRole('status')).toHaveText('Döntés rögzítve: jóváhagyva.');
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
    baseMocks(async (route) => {
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

  await page.goto(RUN_URL);
  await firstListRequested.promise;
  const loading = page.getByRole('progressbar', { name: 'a függő jóváhagyások betöltése folyamatban' });
  await expect(loading).toBeVisible();

  await openSubWorkflowRun(page);
  await expect(page).toHaveURL(/\/run\?runId=run-child$/);
  await expect(loading).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => globalThis.e2eApprovalListBodyReads)).toBe(1);

  // A régi futás listája csak MOST érkezik meg: a kártyája nem jelenhet meg
  // az új futás nézetében.
  releaseFirstList.resolve(undefined);
  await expect.poll(() => page.evaluate(() => globalThis.e2eApprovalListBodyReads)).toBe(2);
  await expect(page.locator('.approval-prompt-card')).toHaveCount(0);
});

test('másik futásra váltva a régi futás késve érkező döntés válasza nem hoz létre kártyát az új nézetben', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  const decisionRequested = Promise.withResolvers<undefined>();
  const releaseDecision = Promise.withResolvers<undefined>();
  await mockIdleStream(page);
  await installApiMocks(page, [
    // A lista a nézett futás szerint: a gyerek futás nézetében üres.
    ...baseMocks(async (route) => {
      const isChildView = new URL(page.url()).search.includes('run-child');
      await route.fulfill(jsonBody(isChildView ? [] : [FIRST_APPROVAL]));
    }),
    mockRoute('decideApproval', async (route) => {
      decisionRequested.resolve(undefined);
      await releaseDecision.promise;
      await route.fulfill(
        jsonBody({ ...FIRST_APPROVAL, decision: 'approved', decidedAtMs: Date.now() } satisfies PendingApproval),
      );
    }),
  ]);
  await installApprovalListBodyReadCounter(page);

  await page.goto(RUN_URL);
  const card = approvalCard(page, FIRST_APPROVAL.title);
  await card.getByRole('button', { name: 'Jóváhagyás' }).click();
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

/* eslint-enable unicorn/no-null */
