// Regressziós e2e: a FUTÁS NÉZET vásznán az élek és a háttér pontmintája
// ténylegesen, a mért erősséggel ki van festve, mindkét témában (2026-09-23).
//
// A HIBA, AMIT ŐRIZ. A vezérlő gombok és az attribúció sötét témás javítása
// (`7229769`) a szerkesztő teljes `--xy-*` blokkját a futás nézetre is
// ráhúzta, amit senki nem kért: a futás nézet éle sötét témában a harmadára
// gyengült, a pontmintája pedig mindkét témában gyakorlatilag eltűnt. Egyetlen
// kapu sem vette észre, mert a `react-flow-theme.spec.ts` csak a gombot és az
// attribúciót méri, a `showcase-graph.spec.ts` csak a szerkesztő élét, a
// `bun run screenshots` pedig nem kapu, és a 8-as közös küszöbe a gyengült élt
// is kifestettnek fogadta el.
//
// A MÓDSZER a szabálykönyv 11. szekciója szerint: két képernyőkép UGYANARRÓL a
// kivágatról, egyszer az elemmel, egyszer elrejtve, és a két kép legnagyobb
// csatorna eltérése, a VALÓS futás nézet alakján (a `showcase-graph.ts`
// bemutató futása, tizenegy éllel, a transcript panellel együtt). Az él
// mérése a közös `edge-paint-measurement.ts` szondájával megy; a pontminta
// mérése ugyanezt a mintát követi, csak fordított szereposztásban: a
// csomópont, az él és a panel MINDKÉT képről eltűnik, és kizárólag a
// pontminta van az egyiken és nincs a másikon. A képernyőkép memóriában marad,
// lemezre nem íródik.
//
// A KÜSZÖBÖK MÉRT SZÁMOK, nem becslések; a teljes táblázat és a származtatás:
// `docs/research/2026-09-23-react-flow-sotet-tema.md` 6. szekció.
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import {
  maximumChannelDifference,
  measureEdgePaintDifference,
  measureEdgeReferenceDifference,
  type EdgeReferencePaint,
} from './edge-paint-measurement.ts';
import {
  fitShowcaseGraphIntoView,
  installShowcaseRunMocks,
  openShowcaseRunView,
  SHOWCASE_GRAPH,
} from './showcase-graph.ts';

const VIEWPORT = { width: 1440, height: 900 };

/**
 * Témánként külön alsó korlát az él legnagyobb csatorna eltérésére, mert a
 * két témában más a mért ép tartomány. Világosban a hibás (háttérszínnel
 * festő) állapot legnagyobb értéke 3, az ép állapoté legalább 21: a 12 a kettő
 * egész felezőpontja. Sötétben a `7229769` gyengült állapota legfeljebb 31, az
 * ép állapot legalább 47: a 39 a kettő felezőpontja, tehát a gyengülést is
 * elkapja, nem csak az eltűnést.
 */
const EDGE_MINIMUM_CHANNEL_DIFFERENCE = { light: 12, dark: 39 } as const;

/**
 * A futás nézet élének VÁRT festése, mindkét témában: a React Flow szállított
 * alapértelmezése, mert a vászon `colorMode` nélkül a `react-flow light`
 * osztályt viseli, és a `--xy-edge-*` változókat a futás nézeten semmi nem
 * írja felül (`--xy-edge-stroke-default: #b1b1b7`,
 * `--xy-edge-stroke-width-default: 1`; `@xyflow/react@12.11.6`
 * `dist/style.css` 6. és 7. sor, https://reactflow.dev/learn/customization/theming).
 *
 * MIÉRT REFERENCIA, ÉS NEM FELSŐ KORLÁT. Az alsó korlát csak az eltűnést
 * fogja: világosban az erősebb (`7229769`, 69..136) és a felére gyengített
 * (12..21) él is átment rajta, és a gyengített él tartománya az ép 21..40-es
 * tartományával átfed, tehát egy közös alsó-felső sáv sem választaná el. A
 * referencia összevetés az élt UGYANAZON a geometrián a várt festéssel
 * rajzolja újra, így élenként mér, nem tartományt hasonlít.
 */
const RUN_VIEW_EDGE_REFERENCE_PAINT: EdgeReferencePaint = { stroke: '#b1b1b7', strokeWidth: '1px' };

/**
 * Az eltérés felső korlátja a referencia festéstől, mindkét témában. Ép
 * állapotban a mért legnagyobb érték 2 (a raszterezés zaja a végpontok
 * körül), a legenyhébb mért rontás (a felére gyengített él, világos téma)
 * legkisebb értéke 10: a 6 a kettő egész felezőpontja. A `7229769` erősebb
 * festése világosban 48..98, sötétben 33..65, a gyengített él sötétben
 * 24..49 (`docs/research/2026-09-23-react-flow-sotet-tema.md` 7. szekció).
 */
const EDGE_REFERENCE_MAXIMUM_CHANNEL_DIFFERENCE = 6;

/**
 * A pontminta alsó korlátja, mindkét témában. A `7229769` állapotában a mért
 * legnagyobb érték 6 (sötét), az ép állapotban a legkisebb 21 (világos): a 13
 * a kettő egész felezőpontja.
 */
const PATTERN_MINIMUM_CHANNEL_DIFFERENCE = 13;

const PATTERN_PROBE_STYLE_ID = 'run-graph-pattern-probe';

const BACKGROUND_SELECTOR = '.react-flow__background';

/**
 * A pontminta mérésének szondája: minden, ami a pontmintát eltakarná vagy
 * mellette eltérést adna (csomópont, él, vezérlő panel, attribúció), MINDKÉT
 * képről eltűnik. `visibility` és nem `display`, hogy a React Flow méret
 * figyelője ne induljon el két felvétel között (`edge-paint-measurement.ts`).
 */
const PATTERN_PROBE_BASE_RULES =
  '.react-flow__node, .react-flow__edge, .react-flow__panel { visibility: hidden !important; }';

async function readComputedStyle(page: Page, selector: string, property: 'display' | 'visibility'): Promise<string> {
  return page.evaluate(
    (input: { readonly selector: string; readonly property: 'display' | 'visibility' }) => {
      const element = globalThis.document.querySelector(input.selector);
      return element === null ? 'missing' : globalThis.getComputedStyle(element)[input.property];
    },
    { selector, property },
  );
}

/**
 * A szonda szabályainak beírása egyetlen, a mérés idejére beszúrt
 * stíluslapba. A várakozás állapot alapú: a számított stílust figyeli, nem
 * időzítőt (`.claude/CLAUDE.md` 11. szekció).
 */
async function applyPatternProbe(page: Page, isPatternHidden: boolean): Promise<void> {
  const patternRule = isPatternHidden ? `${BACKGROUND_SELECTOR} { display: none !important; }` : '';
  await page.evaluate(
    (input: { readonly styleId: string; readonly rule: string }) => {
      const document_ = globalThis.document;
      const existing = document_.querySelector(`#${input.styleId}`);
      if (existing === null) {
        const created = document_.createElement('style');
        created.id = input.styleId;
        created.textContent = input.rule;
        document_.head.append(created);
        return;
      }
      existing.textContent = input.rule;
    },
    { styleId: PATTERN_PROBE_STYLE_ID, rule: `${PATTERN_PROBE_BASE_RULES} ${patternRule}` },
  );

  await expect.poll(async () => readComputedStyle(page, '.react-flow__node', 'visibility')).toBe('hidden');
  if (isPatternHidden) {
    await expect.poll(async () => readComputedStyle(page, BACKGROUND_SELECTOR, 'display')).toBe('none');
    return;
  }
  await expect.poll(async () => readComputedStyle(page, BACKGROUND_SELECTOR, 'display')).not.toBe('none');
}

async function clearPatternProbe(page: Page): Promise<void> {
  await page.evaluate((styleId: string) => {
    globalThis.document.querySelector(`#${styleId}`)?.remove();
  }, PATTERN_PROBE_STYLE_ID);
  await expect.poll(async () => readComputedStyle(page, '.react-flow__node', 'visibility')).toBe('visible');
}

/**
 * A pontminta kifestett pixeleinek legnagyobb csatorna eltérése a teljes
 * vászon kivágatán, a látható területre vágva.
 */
async function measurePatternPaintDifference(page: Page): Promise<number> {
  const clip = await page.evaluate(() => {
    const canvas = globalThis.document.querySelector('.react-flow');
    if (canvas === null) {
      throw new Error('a mérés nem talált .react-flow elemet');
    }
    const rect = canvas.getBoundingClientRect();
    const left = Math.max(0, Math.floor(rect.left));
    const top = Math.max(0, Math.floor(rect.top));
    const right = Math.min(globalThis.innerWidth, Math.ceil(rect.right));
    const bottom = Math.min(globalThis.innerHeight, Math.ceil(rect.bottom));
    return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  });
  await applyPatternProbe(page, false);
  const paintedShot = await page.screenshot({ clip });
  await applyPatternProbe(page, true);
  const blankShot = await page.screenshot({ clip });
  await clearPatternProbe(page);
  return maximumChannelDifference(page, paintedShot.toString('base64'), blankShot.toString('base64'));
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`futás nézet, ${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await installShowcaseRunMocks(page);
      await openShowcaseRunView(page);
      await fitShowcaseGraphIntoView(page);
    });

    test('MINDEN él vonala a mért erősséggel ki van festve', async ({ page }) => {
      const minimum = EDGE_MINIMUM_CHANNEL_DIFFERENCE[theme];
      for (const edge of SHOWCASE_GRAPH.edges) {
        const difference = await measureEdgePaintDifference(page, edge.id);
        console.log(`futás nézet ${theme} ${edge.id}: legnagyobb csatorna eltérés ${String(difference)}`);
        expect(difference).toBeGreaterThanOrEqual(minimum);
      }
    });

    test('MINDEN él a React Flow alapértelmezett festésével fest, se erősebben, se gyengébben', async ({ page }) => {
      for (const edge of SHOWCASE_GRAPH.edges) {
        const difference = await measureEdgeReferenceDifference(page, edge.id, RUN_VIEW_EDGE_REFERENCE_PAINT);
        console.log(`futás nézet ${theme} ${edge.id}: eltérés a referencia festéstől ${String(difference)}`);
        expect(difference).toBeLessThanOrEqual(EDGE_REFERENCE_MAXIMUM_CHANNEL_DIFFERENCE);
      }
    });

    test('a háttér pontmintája ki van festve', async ({ page }) => {
      const difference = await measurePatternPaintDifference(page);
      console.log(`futás nézet ${theme} pontminta: legnagyobb csatorna eltérés ${String(difference)}`);
      expect(difference).toBeGreaterThanOrEqual(PATTERN_MINIMUM_CHANNEL_DIFFERENCE);
    });
  });
}
