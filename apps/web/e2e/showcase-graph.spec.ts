// Regressziós e2e a repóban élő BEMUTATÓ gráf fixtúrára (2026-09-09).
//
// A MÉRT HIBA, ami ezt a fájlt indokolja. A képernyőkép készítő script a
// repón kívül élt, és két külön munkamenetben is hibás fixtúrát adott a
// `readWorkflowGraph` mockon: egyszer ÜRES `edges` tömböt, egyszer két
// csomópontra szűkített gráfot él nélkül. A szállított képernyőképeken így
// nem volt vonal, holott a termékkód végig hibátlan volt (bisect és pixel
// mérés, `docs/research/2026-09-09-graf-el-vonal-meres.md` 3. szekció).
//
// EZ A FÁJL EZÉRT KÉT DOLGOT ŐRIZ EGYSZERRE:
//
//   1. a fixtúra ALAKJÁT (legalább öt él, és minden csomópont be van kötve),
//      hogy az élek ne tudjanak csendben eltűnni belőle;
//   2. a fixtúra minden élének TÉNYLEGESEN KIFESTETT vonalát, pixel
//      méréssel, mindkét témában - a `toBeVisible()` ugyanis zöld marad
//      akkor is, ha a vonal a háttér színével fest
//      (`edge-paint-measurement.ts` fejléce).
//
// Ráadásként azt is állítja, hogy a TELJES gráf a vásznon belül van (nem két
// csomópont ránagyítva), pontosan abban az állapotban, amiben a szállított
// `editor-panel-*.png` képernyőképek készülnek: nyitott beállítás panel
// mellett, a "Fit View" vezérlő gomb megnyomása után.
import { expect, test } from './coverage-fixture.ts';
import { EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE, measureEdgePaintDifference } from './edge-paint-measurement.ts';
import {
  countNodesOutsideCanvas,
  fitShowcaseGraphIntoView,
  installShowcaseMocks,
  openShowcaseEditor,
  SHOWCASE_GRAPH,
  SHOWCASE_SELECTED_NODE_ID,
} from './showcase-graph.ts';

/**
 * A fixtúra alsó korlátja élekben. A szám a feladat kiírásából jön (legalább
 * öt él), nem mérésből: ez terméktermelési elvárás a bizonyíték
 * előállítására, nem a futásidejű viselkedés mért tulajdonsága.
 */
const MINIMUM_EDGE_COUNT = 5;

const VIEWPORT = { width: 1440, height: 900 };

test.describe('a bemutató gráf fixtúra alakja', () => {
  test('legalább öt élt tartalmaz', () => {
    expect(SHOWCASE_GRAPH.edges.length).toBeGreaterThanOrEqual(MINIMUM_EDGE_COUNT);
  });

  test('minden csomópontja be van kötve, és minden él létező csomópontokra mutat', () => {
    const nodeIds = new Set(SHOWCASE_GRAPH.nodes.map((node) => node.id));
    const connectedIds = new Set<string>();
    for (const edge of SHOWCASE_GRAPH.edges) {
      expect(nodeIds.has(edge.sourceNodeId)).toBe(true);
      expect(nodeIds.has(edge.targetNodeId)).toBe(true);
      connectedIds.add(edge.sourceNodeId);
      connectedIds.add(edge.targetNodeId);
    }
    expect([...nodeIds].filter((id) => !connectedIds.has(id))).toEqual([]);
  });
});

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await installShowcaseMocks(page);
    });

    test('a teljes gráf a vásznon belül van, nyitott beállítás panel mellett', async ({ page }) => {
      await openShowcaseEditor(page);
      await page.getByTestId(`rf__node-${SHOWCASE_SELECTED_NODE_ID}`).click();
      await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();

      await fitShowcaseGraphIntoView(page);

      expect(await countNodesOutsideCanvas(page)).toBe(0);
    });

    test('a fixtúra MINDEN élének vonala ténylegesen ki van festve', async ({ page }) => {
      await openShowcaseEditor(page);
      await page.getByTestId(`rf__node-${SHOWCASE_SELECTED_NODE_ID}`).click();
      await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();
      await fitShowcaseGraphIntoView(page);

      const differences: number[] = [];
      for (const edge of SHOWCASE_GRAPH.edges) {
        const difference = await measureEdgePaintDifference(page, edge.id);
        // eslint-disable-next-line no-console -- a mért szám a bizonyíték, a riportban látszania kell
        console.log(`${theme} ${edge.id}: legnagyobb csatorna eltérés ${String(difference)}`);
        expect(difference).toBeGreaterThanOrEqual(EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE);
        differences.push(difference);
      }

      // A kifestett vonalak SZÁMA is állítás, nem csak az egyes éleké: a
      // szállított képernyőképen legalább öt vonalnak látszania kell.
      expect(
        differences.filter((value) => value >= EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE).length,
      ).toBeGreaterThanOrEqual(MINIMUM_EDGE_COUNT);
    });
  });
}
