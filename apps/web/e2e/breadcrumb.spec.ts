/* eslint-disable unicorn/no-null -- a `NodeConfig`/`WorkflowSummary` nullable mezői a
   protokoll szerint ténylegesen `null` értéket hordoznak (packages/protocol). */
// Regressziós e2e a morzsamenüre (2026-09-06, felhasználói kérés: a nagy
// oldalcím túl sok függőleges helyet foglalt, helyette a menüsáv alatti
// morzsamenü jelzi, hol jár a felhasználó). A `<nav aria-label="Morzsamenü">`
// plusz `<ol>`/`<li>` lista szerkezet a WAI-ARIA APG Breadcrumb Pattern
// szerint (https://www.w3.org/WAI/ARIA/apg/patterns/breadcrumb/), az
// `aria-current="page"` az aktuális elemen ugyanoda hivatkozva.
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const START_CONFIG: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: START_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};
const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};
const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
});

/**
 * Öt képernyő öt elvárt morzsamenü végállapottal: a lista utolsó eleme az
 * ős darabszám (0 vagy 1) és az aktuális felirat. A `workflowList` az
 * egyetlen, ahol nincs ős (WAI-ARIA APG minta: a gyökérnek nincs előde).
 */
const SCREENS: readonly { readonly url: string; readonly ancestorCount: number; readonly current: string }[] = [
  { url: '/', ancestorCount: 0, current: 'Workflow-k' },
  { url: '/runs', ancestorCount: 1, current: 'Futás előzmények' },
  { url: '/editor?workflowId=w-alfa', ancestorCount: 1, current: 'Szerkesztő' },
  { url: '/run', ancestorCount: 1, current: 'Futás nézet' },
  { url: '/nincs-ilyen-utvonal', ancestorCount: 1, current: 'Ismeretlen oldal' },
];

test('a morzsamenü minden képernyőn megjelenik, a helyes útvonalat mutatja, és az aktuális elem aria-current="page" jelölést kap', async ({
  page,
}) => {
  for (const { url, ancestorCount, current } of SCREENS) {
    await test.step(url, async () => {
      await page.goto(url);
      const breadcrumb = page.getByRole('navigation', { name: 'Morzsamenü' });
      await expect(breadcrumb).toBeVisible();

      const links = breadcrumb.getByRole('link');
      await expect(links).toHaveCount(ancestorCount);

      const currentItem = breadcrumb.locator('[aria-current="page"]');
      await expect(currentItem).toHaveText(current);
      // Az aktuális elem NEM link (WAI-ARIA APG minta): a `<span>` nem hoz
      // létre "link" szerepet, tehát a fenti `links` darabszáma pontosan az
      // ŐSÖKET fedi, az aktuális elemet nem.
      const currentTagName = await currentItem.evaluate((element) => element.tagName);
      expect(currentTagName).toBe('SPAN');
    });
  }
});

test('a morzsamenü "Workflow-k" ős linkje a futás előzményekről visszanavigál a gyökérre', async ({ page }) => {
  await page.goto('/runs');
  const breadcrumb = page.getByRole('navigation', { name: 'Morzsamenü' });
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Futás előzmények');

  await breadcrumb.getByRole('link', { name: 'Workflow-k' }).click();

  await expect(page.getByRole('table', { name: 'Workflow-k' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(breadcrumb.getByRole('link')).toHaveCount(0);
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText('Workflow-k');
});

/**
 * A nagy oldalcím (`<h1 class="app-pagehead__title">`, 36px betűméret) helyén
 * ma a jóval alacsonyabb morzsamenü áll. Saját, izolált Playwright méréssel
 * igazolt érték (2026-09-06, chromium, a valódi átemelt CSS és design tokenek
 * ellen): a `.app-pagehead` teljes magassága a régi cím mellett 139.8px, az
 * új morzsamenü mellett 47px (`docs/spec/SPEC-007-frontend-alkalmazas.md`
 * 5.1 szekció). A 80px küszöb a kettő között felezi a különbséget bőséges
 * tartalékkal, tehát a régi, nagy fejléc visszatérése ezt a tesztet
 * megbuktatná, egy betűtípus-metrika okozta pár pixeles ingadozás viszont
 * nem.
 */
test('a page-head (a morzsamenü sávja) jelentősen alacsonyabb, mint a korábbi nagy oldalcím volt', async ({ page }) => {
  await page.goto('/');
  const pagehead = page.locator('.app-pagehead');
  await expect(pagehead).toBeVisible();

  const height = await pagehead.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(80);

  // A tartalom (`.app-content`) ugyanennyivel feljebb kezdődik: a topnav bar
  // (60px, `.app-tn__bar`, SPEC-007 5.1) plusz a fenti, 80px alatti
  // page-head együtt 140px alatt marad, szemben a korábbi kb. 200px-es
  // értékkel (60px bar + 139.8px page-head).
  const contentTop = await page.locator('.app-content').evaluate((element) => element.getBoundingClientRect().top);
  expect(contentTop).toBeLessThan(140);
});
