// E2E a csomópont kártya állapotot jelölő KERETÉRE (SPEC-008 6.2, 21.
// kritérium, user döntés 2026-10-21), kifestett pixelekkel, mindkét témában.
//
// MIT VÉD.
//   1. `pending`: a keret szaggatott. A felső keret egy sorában a vonal és a
//      kártya háttere sokszor váltja egymást, a folytonos keretű (`succeeded`)
//      kártyán egyszer sem.
//   2. `running`: a keret vastagabb a folytonos (`succeeded`) keretnél.
//   3. `failed`: a keret két vonal, köztük a kártya hátterével. A rés pixele
//      eltér a vonal pixelétől (a szabálykönyv 11. szekciója: vizuális állítást
//      csak kifestett pixel bizonyít). A 3 pixel a legkisebb vastagság, amin a
//      Chromium két vonalat rajzol: 1, 2 és 2.4 pixelnél egy vonal, 3 és 4
//      pixelnél kettő (a határ teszt ugyanazon a kártyán, a vastagság
//      felülírásával).
//   4. A keret színe az állapot jelvényének variánsából jön: a vonal pixel a
//      design system tokenje, feloldva (nem a kártya számított keretszíne).
//
// A NAGYÍTÁS. A kártya egy képkockában csak akkor mérhető, ha a rajz nagyítása
// ismert: a vászon a `fitView` miatt a kártyát a nagyításhoz igazítja, a 3
// pixeles dupla keret pedig kicsinyítve (1.5 pixel) már nem bontható két
// vonalra. Az egyetlen kártyás gráf a `fitView` felső korlátjára (2) nagyít,
// ezt a teszt előfeltételként ellenőrzi; a pixel számok ezért a CSS pixelek
// kétszeresei. A mérés és a források:
// `docs/research/2026-10-21-kartya-keret-allapot.md`.
//
// A fixtúra a `run-view-stream.ts` egy csomópontos futása; minden REST hívás
// `page.route()` mockon megy, az SSE csatorna lezárt `page.route()` válasz
// (`.claude/CLAUDE.md` 11. szekció).
import type { StepRunStatus } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import {
  countLineRuns,
  countRunTransitions,
  firstLineRunLength,
  measureCardTopBorder,
  type BorderProfile,
} from './graph-node-card-border-measurement.ts';
import { mockRunView, stepRun } from './run-view-stream.ts';
import { mockSseFramesWithoutReconnect } from './sse-mock.ts';
import { replayFrames } from './transcript-fixture.ts';

const VIEWPORT = { width: 1440, height: 900 };
const NODE_ID = 'n1';
const RUN_ID = 'r-1';

/**
 * Az egyetlen kártyás gráf nagyítása a `fitView` felső korlátján (a React Flow
 * `maxZoom` alapértéke 2).
 */
const EXPECTED_ZOOM = 2;

/**
 * Az állapot jelvényének felirata (a kártya betöltődésének jele) és a keret
 * várt színének tokenje: a jelvény variánsának névrokon tokenje, az `outline`
 * esetén a jelvény gyűrűjének tokenje (`graph-node-card.css`).
 */
const STATUS_CASES = {
  pending: { label: 'várakozik', token: '--ep-border' },
  running: { label: 'fut', token: '--ep-info' },
  failed: { label: 'sikertelen', token: '--ep-danger' },
  succeeded: { label: 'sikeres', token: '--ep-success' },
} as const satisfies Partial<Record<StepRunStatus, { readonly label: string; readonly token: string }>>;

type CaseStatus = keyof typeof STATUS_CASES;

/**
 * A szaggatott keret alsó korlátja a felső keret egy sorában a futamváltásokra.
 * A folytonos keret nulla váltást ad.
 */
const DASHED_MINIMUM_TRANSITIONS = 10;

async function readViewportZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewport = globalThis.document.querySelector('.react-flow__viewport');
    if (viewport === null) {
      throw new Error('a mérés nem talált .react-flow__viewport elemet');
    }
    // A számított transzform `matrix(a, b, c, d, e, f)` alakú, az `a` a vízszintes nagyítás.
    const matrix = /^matrix\(([\d.]+),/u.exec(globalThis.getComputedStyle(viewport).transform);
    if (matrix === null) {
      throw new Error('a mérés nem tudta értelmezni a rajz transzformját');
    }
    return Number(matrix[1]);
  });
}

async function openCard(page: Page, status: CaseStatus): Promise<void> {
  await mockRunView(page, { runStatus: 'running', stepRuns: [stepRun(status)] });
  await mockSseFramesWithoutReconnect(page, replayFrames(RUN_ID, []));
  await page.goto(`/run?runId=${RUN_ID}`);
  await expect(
    page.getByTestId(`rf__node-${NODE_ID}`).getByText(STATUS_CASES[status].label, { exact: true }),
  ).toBeVisible();
  await expect.poll(async () => readViewportZoom(page)).toBe(EXPECTED_ZOOM);
}

const CARD_SELECTOR = `[data-testid="rf__node-${NODE_ID}"] .graph-node-card`;
const WIDTH_PROPERTY = '--graph-node-card-border-width';

/**
 * A kártya keret vastagságának felülírása a mérés idejére (a határ teszthez):
 * ugyanaz az egyetlen custom property, amit a stíluslap állapotonként állít.
 */
async function overrideBorderWidth(page: Page, width: string): Promise<void> {
  await page.evaluate(
    (input: { readonly selector: string; readonly property: string; readonly width: string }) => {
      const card = globalThis.document.querySelector<HTMLElement>(input.selector);
      if (card === null) {
        throw new Error(`a mérés nem találta a kártyát: ${input.selector}`);
      }
      card.style.setProperty(input.property, input.width);
    },
    { selector: CARD_SELECTOR, property: WIDTH_PROPERTY, width },
  );
  await expect
    .poll(async () =>
      page.evaluate(
        (input: { readonly selector: string; readonly property: string }) =>
          globalThis
            .getComputedStyle(globalThis.document.querySelector(input.selector) ?? globalThis.document.body)
            .getPropertyValue(input.property)
            .trim(),
        { selector: CARD_SELECTOR, property: WIDTH_PROPERTY },
      ),
    )
    .toBe(width);
}

/**
 * Egy állapotú kártya megnyitása és felső keretének mérése. A mérés eredménye
 * a naplóba is kiíródik, hogy a küszöbök a futásból utólag ellenőrizhetők
 * legyenek.
 */
async function measureStatus(page: Page, theme: string, status: CaseStatus): Promise<BorderProfile> {
  await openCard(page, status);
  const profile = await measureCardTopBorder(page, NODE_ID, STATUS_CASES[status].token);
  console.log(
    `keret ${theme} ${status}: vonal futamok ${String(countLineRuns(profile.column))}, első vonal ${String(firstLineRunLength(profile.column))} px, sor váltások ${String(countRunTransitions(profile.row))}, vonal-háttér távolság ${String(profile.lineToCardDistance)}, vonal szín eltérés ${String(profile.lineColorDistance)}, rés-vonal távolság ${String(profile.gapToLineDistance)}`,
  );
  // A besorolás a három szín közül a legközelebbit választja, ezért egy MÁS
  // szín is vonalnak számítana: a vonal pixel pontosan a token színe kell
  // legyen (egy teljesen lefedett pixel élsimítás nélkül adja a színt).
  expect(profile.lineColorDistance, `a ${status} keret színe a ${STATUS_CASES[status].token} token`).toBe(0);
  return profile;
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`a kártya állapot kerete, ${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT, deviceScaleFactor: 1 });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
    });

    test('a pending kártya kerete szaggatott: a felső keret sorában a vonal és a háttér sokszor váltja egymást', async ({
      page,
    }) => {
      const dashed = await measureStatus(page, theme, 'pending');
      expect(countRunTransitions(dashed.row)).toBeGreaterThanOrEqual(DASHED_MINIMUM_TRANSITIONS);
    });

    test('a succeeded kártya kerete folytonos: a felső keret sorában egyetlen vonal fut végig', async ({ page }) => {
      const solid = await measureStatus(page, theme, 'succeeded');
      expect(countRunTransitions(solid.row)).toBe(0);
      expect(countLineRuns(solid.column)).toBe(1);
    });

    test('a running kártya kerete vastagabb a folytonos (succeeded) keretnél', async ({ page }) => {
      const solid = await measureStatus(page, theme, 'succeeded');
      const thick = await measureStatus(page, theme, 'running');
      expect(countLineRuns(thick.column)).toBe(1);
      expect(firstLineRunLength(thick.column)).toBeGreaterThan(firstLineRunLength(solid.column));
    });

    test('a failed kártya kerete két vonal, a rés pixele eltér a vonal pixelétől', async ({ page }) => {
      const double = await measureStatus(page, theme, 'failed');
      expect(countLineRuns(double.column)).toBe(2);
      expect(double.gapToLineDistance).toBeGreaterThanOrEqual(double.lineToCardDistance / 2);
    });

    test('a dupla vonal határa 3 px: 1, 2 és 2.4 px mellett egy vonal, 3 és 4 px mellett kettő', async ({ page }) => {
      await openCard(page, 'failed');
      for (const [width, lineRuns] of [
        ['1px', 1],
        ['2px', 1],
        ['2.4px', 1],
        ['3px', 2],
        ['4px', 2],
      ] as const) {
        await overrideBorderWidth(page, width);
        const profile = await measureCardTopBorder(page, NODE_ID, STATUS_CASES.failed.token);
        console.log(`keret ${theme} failed ${width}: vonal futamok ${String(countLineRuns(profile.column))}`);
        expect(countLineRuns(profile.column), width).toBe(lineRuns);
      }
    });
  });
}
