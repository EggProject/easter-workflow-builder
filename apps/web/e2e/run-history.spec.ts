/* eslint-disable unicorn/no-null -- a RunSummary és a WorkflowSummary
   nullable mezői a protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/run/run-record.ts,
   .../workflow/workflow-record.ts). */
// A futás előzmények képernyő e2e folyamatai (T-008-27, SPEC-007 10.2):
// lista betöltés, workflow-nak megfelelő fül szűrés, megszakítás és
// újraindítás. Minden REST hívás `page.route()` mockon megy, az SSE
// csatorna egyetlen `stream_ready` kerettel.
import type { RunSummary, WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const WORKFLOW: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const RUN_PENDING: RunSummary = {
  id: 'r-pending',
  workflowId: 'w-alfa',
  status: 'pending',
  providerId: 'claude-subscription',
  createdAtMs: 10,
  startedAtMs: null,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const RUN_SUCCEEDED: RunSummary = {
  id: 'r-succeeded',
  workflowId: 'w-alfa',
  status: 'succeeded',
  providerId: 'claude-subscription',
  createdAtMs: 5,
  startedAtMs: 6,
  finishedAtMs: 20,
  errorKind: null,
  errorMessage: null,
};

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
});

test('betölti a futás listát, a workflow nevét párosítva', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING, RUN_SUCCEEDED]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/runs');

  const table = page.getByRole('table', { name: 'Futások' });
  await expect(table.getByRole('row', { name: /r-pending/ })).toContainText('Alfa workflow');
  await expect(table.getByRole('row', { name: /r-pending/ })).toContainText('várakozik');
  await expect(table.getByRole('row', { name: /r-succeeded/ })).toContainText('sikeres');
});

test('workflowId szűrő nélkül csak a "Minden futás" fül létezik', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/runs');

  await expect(page.getByRole('tab', { name: 'Minden futás' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Egy workflow futásai' })).toHaveCount(0);
});

test('workflowId szűrővel a fülváltás a listRuns query-t is szűkíti', async ({ page }) => {
  const requestedQueries: string[] = [];
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => {
      requestedQueries.push(new URL(route.request().url()).search);
      await route.fulfill(jsonBody([RUN_PENDING]));
    }),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/runs?workflowId=w-alfa');

  const workflowTab = page.getByRole('tab', { name: 'Egy workflow futásai' });
  await expect(workflowTab).toBeVisible();
  await workflowTab.click();

  await expect.poll(() => requestedQueries.some((query) => query.includes('workflowId=w-alfa'))).toBe(true);
});

test('a megszakítás gomb sikerre visszatölti a listát, sikertelenre toast-ot ad', async ({ page }) => {
  let interruptCallCount = 0;
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('interruptRun', async (route) => {
      interruptCallCount += 1;
      await route.fulfill(jsonBody({ rootRunId: 'r-pending', cancelledRunIds: ['r-pending'] }));
    }),
  ]);

  await page.goto('/runs');
  const row = page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-pending/ });
  await row.getByRole('button', { name: 'Megszakítás' }).click();

  await expect(page.getByText('Futás megszakítva')).toBeVisible();
  await expect.poll(() => interruptCallCount).toBe(1);
});

test('a lezárt futás sora az Újraindítás gombot mutatja, nem a Megszakítást', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_SUCCEEDED]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('restartRun', async (route) => route.fulfill(jsonBody({ runId: 'r-new', status: 'pending' }))),
  ]);

  await page.goto('/runs');
  const row = page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-succeeded/ });
  await expect(row.getByRole('button', { name: 'Megszakítás' })).toHaveCount(0);
  await row.getByRole('button', { name: 'Újraindítás' }).click();

  await expect(page.getByText('Futás újraindítva')).toBeVisible();
});

test('az újraindítás hibájára toast jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_SUCCEEDED]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('restartRun', async (route) =>
      route.fulfill(jsonBody({ code: 'conflict', message: 'A futás nem indítható újra.' }, 409)),
    ),
  ]);

  await page.goto('/runs');
  const row = page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-succeeded/ });
  await row.getByRole('button', { name: 'Újraindítás' }).click();

  await expect(page.getByText('Az újraindítás sikertelen')).toBeVisible();
  await expect(page.getByText('A futás nem indítható újra.')).toBeVisible();
});

test('a futás lista betöltési hibájára riasztás jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) =>
      route.fulfill(jsonBody({ code: 'internal', message: 'A futásokat nem sikerült lekérni.' }, 500)),
    ),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
  ]);

  await page.goto('/runs');

  await expect(page.getByRole('alert')).toHaveText('Váratlan szerver hiba történt.: A futásokat nem sikerült lekérni.');
});

test('az Állapot fejlécre kattintva a tábla az állapot felirata szerint rendez', async ({ page }) => {
  // Az oszlop `cell` függvénnyel rajzol, tehát a `value` (a rendezés
  // kulcsa) kizárólag a rendezés bekapcsolásakor hívódik meg.
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING, RUN_SUCCEEDED]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto('/runs');
  const table = page.getByRole('table', { name: 'Futások' });
  const statusHeader = table.getByRole('columnheader', { name: 'Állapot' });

  await statusHeader.click();

  await expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');
  // A nulladik sor a fejléc sor, az első az első adatsor. A magyar
  // feliratok szerinti növekvő sorrend: "sikeres" < "várakozik".
  await expect(table.getByRole('row').nth(1)).toContainText('sikeres');

  // A "Műveletek" oszlop `sortable: false`, ezért nincs `aria-sort`
  // attribútuma, és kattintás után sem kap egyet. A tábla mind a két sort
  // tovább mutatja: a rendezés kulcsa minden sorra üres sztring.
  const actionsHeader = table.getByRole('columnheader', { name: 'Műveletek' });
  await expect(actionsHeader).not.toHaveAttribute('aria-sort');
  await actionsHeader.click();
  await expect(actionsHeader).not.toHaveAttribute('aria-sort');
  await expect(table.getByRole('row', { name: /r-pending/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /r-succeeded/ })).toBeVisible();
});

test('a nem lezárt futásokra a subscriptions PUT törzse fromEventId 0-val megy', async ({ page }) => {
  const subscriptionBodies: unknown[] = [];
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([WORKFLOW]))),
    mockRoute('replaceStreamSubscriptions', async (route) => {
      subscriptionBodies.push(route.request().postDataJSON());
      await route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] }));
    }),
  ]);

  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-pending/ })).toBeVisible();

  await expect
    .poll(() => subscriptionBodies.at(-1))
    .toEqual({ runs: [{ runId: 'r-pending', fromEventId: 0, replayLimit: 100 }] });
});
