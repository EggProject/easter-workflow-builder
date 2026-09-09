/* eslint-disable unicorn/no-null -- a WorkflowSummary nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/workflow/workflow-record.ts). */
// A kliens oldali útválasztás e2e folyamatai (SPEC-007 7.2, 10.3): az
// ismeretlen útvonal képernyője, a topnav linkjeivel való navigáció, és a
// böngésző vissza gombja (`popstate`). Ezt a három utat eddig kizárólag unit
// teszt fedte; itt valódi böngésző `history` API-jával futnak.
import type { RunSummary, WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
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

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);
});

test('ismeretlen útvonalon a "nem található" képernyő jelenik meg, és a gombja visszavisz a listára', async ({
  page,
}) => {
  await page.goto('/ilyen-utvonal-nincs');

  await expect(page.getByRole('heading', { name: 'Az oldal nem található' })).toBeVisible();

  await page.getByRole('button', { name: 'Vissza a workflow listára' }).click();

  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('a topnav "Workflow-k" linkje a futás előzményekről visszavisz a listára', async ({ page }) => {
  await page.goto('/runs');
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();

  // A morzsamenü "Workflow-k" őse óta (2026-09-06) KÉT "Workflow-k" feliratú
  // link is a lapon van; a topnav linkje a `.app-tn__navigation` konténerre
  // szűkítve egyértelmű, a morzsamenü linkjét a `breadcrumb.spec.ts` fedi.
  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Workflow-k' }).click();

  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('a böngésző vissza gombja (popstate) visszaállítja az előző útvonalat', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(page.getByRole('table', { name: 'Futások' })).toBeVisible();

  await page.goBack();

  // A `pushState` nem vált ki `popstate` eseményt, a vissza gomb viszont
  // igen: ez az egyetlen út, ami a `useClientRoute` feliratkozását
  // ténylegesen lefuttatja (SPEC-007 M-13).
  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
});

test('a "/run" útvonalon a futás nézet helyőrzője jelenik meg, "Futás nézet" morzsamenüvel', async ({ page }) => {
  // A `runView` ág (SPEC-008 T-009-20 ... T-009-27 helyőrzője) a
  // `renderRouteContent` switch ötödik ága; a `resolveBreadcrumbCurrent`
  // pedig a topnav alatti morzsamenü aktuális elemét adja (2026-09-06, a
  // nagy oldalcím felváltása).
  await page.goto('/run');

  await expect(page.getByRole('navigation', { name: 'Morzsamenü' }).getByText('Futás nézet')).toBeVisible();
  await expect(page.getByText('Futás nézet (folyamatban).')).toBeVisible();
});
