// E2E az `approval-prompt` témára (T-009-27, SPEC-008 8. szekció, AC35).
//
// MIÉRT KELL E2E A HAPPY-DOM UNIT TESZTEK MELLETT. A `describeWaitingApprovalDuration`
// mindhárom sávja (másodperc, perc, óra) és a negatív eltérés nullára szorítása
// unit szinten már 100 százalékon fedett, de a `run-graph`/`run-view`/`approval-prompt`
// TÉMÁK ÖSSZEKAPCSOLÁSÁT (a `GET /api/approvals` válaszból a csomóponton megjelenő
// felirat, és a panel gombjának VALÓS böngésző `disabled` attribútuma a válaszig)
// csak a valódi DOM-on lehet megfigyelni. A SPEC-008 12.5 ratchet szabálya szerint egy
// új képernyő-részlet nem hagyhat hátra fedetlen sort. Minden REST hívás `page.route()`
// mockon megy, valós backend szervert egyetlen teszt sem szólít meg
// (`.claude/CLAUDE.md` 11. szekció).
import type {
  ApprovalDecisionRequest,
  NodeConfig,
  PendingApproval,
  RunDetail,
  RunSnapshotResponse,
  StepRunRecord,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

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

const BASE_APPROVAL: PendingApproval = {
  id: 'appr-1',
  runId: RUN_DETAIL.id,
  stepRunId: 'sr-1',
  title: 'Engedélyezed a fizetést?',
  body: 'Kérlek erősítsd meg a tranzakciót',
  payload: { amount: 100, currency: 'EUR' },
  decision: null,
  requestedAtMs: Date.now(),
  decidedAtMs: null,
};

const RUN_URL = `/run?runId=${RUN_DETAIL.id}`;

/**
 * Négy `human_approval` csomópont, mindegyik a `describeWaitingApprovalDuration`
 * egy-egy ágát üti meg: másodperc, perc, óra és a jövőbeli (óra eltolású
 * óraeltérés szimulációja) kérés nulla másodpercre szorítva. Az ötödik
 * csomópont már ELDÖNTÖTT (`succeeded`), tehát nem szerepel a
 * `GET /api/approvals` válaszában (a végpont csak `waiting_approval` lépést
 * listáz, user döntés 2026-09-23/24), és a kártyán sincs várakozás felirat.
 */
function buildSnapshot(): RunSnapshotResponse {
  return {
    version: 1,
    sdkVersionPin: '0.1.13',
    workflow: { id: RUN_DETAIL.workflowId, name: 'Jóváhagyás teszt workflow', description: null },
    nodes: [
      {
        id: 'n-seconds',
        type: 'human_approval',
        label: 'Másodperces jóváhagyás',
        position: { x: 0, y: 0 },
        config: approvalConfig('Másodperces jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-minutes',
        type: 'human_approval',
        label: 'Perces jóváhagyás',
        position: { x: 300, y: 0 },
        config: approvalConfig('Perces jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-hours',
        type: 'human_approval',
        label: 'Órás jóváhagyás',
        position: { x: 600, y: 0 },
        config: approvalConfig('Órás jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-future',
        type: 'human_approval',
        label: 'Óraeltéréses jóváhagyás',
        position: { x: 900, y: 0 },
        config: approvalConfig('Óraeltéréses jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
      {
        id: 'n-done',
        type: 'human_approval',
        label: 'Már eldöntött jóváhagyás',
        position: { x: 1200, y: 0 },
        config: approvalConfig('Már eldöntött jóváhagyás'),
        effectiveProviderId: 'claude-subscription',
      },
    ],
    edges: [],
  };
}

const STEP_RUNS: readonly StepRunRecord[] = [
  { ...BASE_STEP_RUN, id: 'sr-seconds', nodeId: 'n-seconds' },
  { ...BASE_STEP_RUN, id: 'sr-minutes', nodeId: 'n-minutes' },
  { ...BASE_STEP_RUN, id: 'sr-hours', nodeId: 'n-hours' },
  { ...BASE_STEP_RUN, id: 'sr-future', nodeId: 'n-future' },
  { ...BASE_STEP_RUN, id: 'sr-done', nodeId: 'n-done', status: 'succeeded', finishedAtMs: 3 },
];

const SECONDS_APPROVAL: PendingApproval = {
  ...BASE_APPROVAL,
  id: 'appr-seconds',
  stepRunId: 'sr-seconds',
  requestedAtMs: Date.now() - 3000,
};
const MINUTES_APPROVAL: PendingApproval = {
  ...BASE_APPROVAL,
  id: 'appr-minutes',
  stepRunId: 'sr-minutes',
  requestedAtMs: Date.now() - 5 * 60 * 1000,
};
const HOURS_APPROVAL: PendingApproval = {
  ...BASE_APPROVAL,
  id: 'appr-hours',
  stepRunId: 'sr-hours',
  requestedAtMs: Date.now() - 3 * 60 * 60 * 1000,
};
// Kis, jövőbeli eltolás (óraeltérés szimulációja): a `Math.max(0, ...)`
// szorítás ágát üti meg, mindig "0 másodperce vár" eredménnyel, a teszt
// futási idejétől függetlenül (research nélküli, egyszerű üzleti adat, nem
// valódi várakozás).
const FUTURE_APPROVAL: PendingApproval = {
  ...BASE_APPROVAL,
  id: 'appr-future',
  stepRunId: 'sr-future',
  requestedAtMs: Date.now() + 10 * 60 * 1000,
};

const APPROVALS: readonly PendingApproval[] = [SECONDS_APPROVAL, MINUTES_APPROVAL, HOURS_APPROVAL, FUTURE_APPROVAL];

async function mockApprovalRun(page: Page, approvals: readonly PendingApproval[]): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(buildSnapshot()))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody(approvals))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
}

test('a csomópontok a várakozási idő három sávját mutatják, a jövőbeli kérés nullára szorítva, az eldöntött jóváhagyásnak nincs felirata', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await mockApprovalRun(page, APPROVALS);
  await page.goto(RUN_URL);

  // A `.graph-node-card__summary` a `waiting_approval` várakozás felirat
  // saját osztálya (`GraphNodeCard.tsx`): a `waiting_approval` ÁLLAPOT
  // jelvényének felirata ("jóváhagyásra vár", `step-run-status-badge.ts`) is
  // "vár" végű, tehát a locatornak az összesítésre kell szűkülnie, nem
  // bármely "vár" szövegre a csomóponton belül.
  const secondsSummary = page.getByTestId('rf__node-n-seconds').locator('.graph-node-card__summary');
  const minutesSummary = page.getByTestId('rf__node-n-minutes').locator('.graph-node-card__summary');
  const hoursSummary = page.getByTestId('rf__node-n-hours').locator('.graph-node-card__summary');
  const futureSummary = page.getByTestId('rf__node-n-future').locator('.graph-node-card__summary');
  const doneSummary = page.getByTestId('rf__node-n-done').locator('.graph-node-card__summary');

  await expect(secondsSummary).toHaveText(/^\d+ másodperce vár$/);
  await expect(minutesSummary).toHaveText(/^\d+ perce vár$/);
  await expect(hoursSummary).toHaveText('3 órája vár');
  await expect(futureSummary).toHaveText('0 másodperce vár');
  await expect(doneSummary).toHaveCount(0);

  // A panel mind a négy függő jóváhagyást felsorolja, saját cím szerint.
  await expect(page.getByRole('heading', { name: 'Engedélyezed a fizetést?' })).toHaveCount(4);
  await expect(page.getByText('A futás legalább egy lépése jóváhagyásra vár.')).toBeVisible();
});

test('a Jóváhagyás gomb megnyomásától a válaszig mindkét gomb letiltva, siker után a lista kiürül és a csomópont jelzése eltűnik', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  const singleApproval: readonly PendingApproval[] = [SECONDS_APPROVAL];
  let isDecided = false;
  const decisionRequested = Promise.withResolvers<undefined>();
  const releaseDecision = Promise.withResolvers<undefined>();

  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(buildSnapshot()))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody(isDecided ? [] : singleApproval))),
    mockRoute('decideApproval', async (route) => {
      const body: unknown = route.request().postDataJSON();
      expect(body).toEqual({ decision: 'approved' } satisfies ApprovalDecisionRequest);
      decisionRequested.resolve(undefined);
      await releaseDecision.promise;
      isDecided = true;
      await route.fulfill(
        jsonBody({ ...SECONDS_APPROVAL, decision: 'approved', decidedAtMs: Date.now() } satisfies PendingApproval),
      );
    }),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto(RUN_URL);
  const approveButton = page.getByRole('button', { name: 'Jóváhagyás' });
  const rejectButton = page.getByRole('button', { name: 'Elutasítás' });
  await expect(approveButton).toBeVisible();

  await approveButton.click();
  await decisionRequested.promise;
  await expect(approveButton).toBeDisabled();
  await expect(rejectButton).toBeDisabled();
  await expect(approveButton).toHaveClass(/is-loading/);
  await expect(rejectButton).not.toHaveClass(/is-loading/);

  releaseDecision.resolve(undefined);

  await expect(page.getByRole('heading', { name: 'Engedélyezed a fizetést?' })).toHaveCount(0);
  await expect(page.getByTestId('rf__node-n-seconds').locator('.graph-node-card__summary')).toHaveCount(0);
});

test('az Elutasítás gombra kapott conflict hibaüzenetet mutat, és a lista újratöltődik', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  const singleApproval: readonly PendingApproval[] = [SECONDS_APPROVAL];
  let approvalCallCount = 0;

  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(buildSnapshot()))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => {
      approvalCallCount += 1;
      await route.fulfill(jsonBody(singleApproval));
    }),
    mockRoute('decideApproval', async (route) => {
      const body: unknown = route.request().postDataJSON();
      expect(body).toEqual({ decision: 'rejected' } satisfies ApprovalDecisionRequest);
      await route.fulfill(jsonBody({ code: 'conflict', message: 'a jóváhagyás már el lett döntve' }, 409));
    }),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto(RUN_URL);
  const rejectButton = page.getByRole('button', { name: 'Elutasítás' });
  await expect(rejectButton).toBeVisible();
  const callsBeforeDecision = approvalCallCount;

  await rejectButton.click();

  await expect(page.locator('.approval-prompt-card').getByRole('alert')).toHaveText(
    'Az elem állapota most nem engedi a műveletet.: a jóváhagyás már el lett döntve',
  );
  await expect(rejectButton).toBeEnabled();
  await expect.poll(() => approvalCallCount).toBeGreaterThan(callsBeforeDecision);
});

test('a jóváhagyás lista betöltési hibájára figyelmeztetést mutat a panelen', async ({ page }) => {
  await page.setViewportSize({ width: 1800, height: 1000 });
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(buildSnapshot()))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) =>
      route.fulfill(jsonBody({ code: 'internal', message: 'A szerver hibát adott.' }, 500)),
    ),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto(RUN_URL);

  await expect(page.locator('.approval-prompt-panel').getByRole('alert')).toBeVisible();
});

/* eslint-enable unicorn/no-null */
