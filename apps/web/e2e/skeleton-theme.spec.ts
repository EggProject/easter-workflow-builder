// Regressziós e2e: a betöltés csontváza (`Skeleton`) élőben, oldal
// újratöltés nélkül követi a téma váltást, a forrás meglévő `.skel--ink`
// változatára állva sötét témában (user döntés, 2026-09-23).
//
// A HIBA, AMIT ŐRIZ. A `.skel` szín a design system forrásában a nyers
// `--ep-paper-200`/`--ep-paper-100` tokenre épül, amit a `theme-dark.css`
// nem ír felül: sötét témában is a világos krémszín festett
// (`docs/research/2026-09-23-transcript-panel-meresek.md` 10. szekció). A
// döntés a forrás meglévő `.skel--ink` (`--ep-slate-700`/`--ep-slate-600`)
// változatát köti a témához, az `apps/web` `themed-skeleton` témájában
// (`ThemedSkeleton`, `useIsDarkTheme`): a döntés egyetlen helyen áll, minden
// `Skeleton` hívás ezen a burkolón megy.
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const GRAPH: WorkflowGraphDocument = { nodes: [], edges: [] };

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
const WORKFLOW: WorkflowDetail = {
  id: 'w-skel',
  name: 'Csontváz workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};
const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };
/* eslint-enable unicorn/no-null */

test('a betöltés csontváza sötét témában a "skel--ink" módosítót kapja, élő témaváltásnál is', async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.localStorage.setItem('eggTheme', 'light');
  });
  await mockIdleStream(page);

  // A `readWorkflowGraph` válasz szándékosan nyitva tartott, hogy a
  // szerkesztő betöltés csontváza a teszt teljes ideje alatt a képernyőn
  // maradjon (`graph-editor-validation.spec.ts` gate mintája).
  const { promise: graphGate, resolve: releaseGraph } = Promise.withResolvers<undefined>();
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => {
      await graphGate;
      await route.fulfill(jsonBody(GRAPH));
    }),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/editor?workflowId=w-skel');

  const skeleton = page.locator('.graph-editor-screen__loading .skel').first();
  await expect(skeleton).toBeVisible();
  await expect(skeleton).not.toHaveClass(/skel--ink/);

  // Élő váltás: világos -> sötét, oldal újratöltés nélkül.
  await page.getByRole('button', { name: 'Téma: világos' }).click();
  await expect(page.getByRole('button', { name: 'Téma: sötét' })).toBeVisible();
  await expect(skeleton).toHaveClass(/skel--ink/);

  // Élő váltás vissza: sötét -> rendszerkövető (világos OS preferencia
  // mellett ez is az attribútum hiányára oldódik fel), a módosító eltűnik.
  await page.getByRole('button', { name: 'Téma: sötét' }).click();
  await expect(page.getByRole('button', { name: 'Téma: rendszerkövető' })).toBeVisible();
  await expect(skeleton).not.toHaveClass(/skel--ink/);

  releaseGraph(undefined);
  await expect(page.locator('.graph-editor-screen__loading')).toHaveCount(0);
});
