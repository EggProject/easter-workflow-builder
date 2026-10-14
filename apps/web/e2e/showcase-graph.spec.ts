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
//
// A FUTÁS nézet bemutató transcriptjét is őrzi (SPEC-008 12.6, 93. kritérium):
// a fixtúra sorainak alakját és következetességét, a sorok teljes láthatóságát
// görgetés és jóváhagyás nélkül, és azt, hogy a sorok egyszer szerepelnek az
// SSE újracsatlakozás után is.
import type { RunEventKind } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { STREAM_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE, measureEdgePaintDifference } from './edge-paint-measurement.ts';
import {
  countNodesOutsideCanvas,
  expectShowcaseTranscript,
  fitShowcaseGraphIntoView,
  installShowcaseMocks,
  installShowcaseRunMocks,
  openShowcaseEditor,
  openShowcaseRunView,
  SHOWCASE_GRAPH,
  SHOWCASE_RUN_EVENTS,
  SHOWCASE_RUN_STEP_RUNS,
  SHOWCASE_RUN_STREAM_FRAMES,
  SHOWCASE_SELECTED_NODE_ID,
} from './showcase-graph.ts';
import { mockSseFrames } from './sse-mock.ts';

/**
 * A fixtúra alsó korlátja élekben. A szám a feladat kiírásából jön (legalább
 * öt él), nem mérésből: ez terméktermelési elvárás a bizonyíték
 * előállítására, nem a futásidejű viselkedés mért tulajdonsága.
 */
const MINIMUM_EDGE_COUNT = 5;

const VIEWPORT = { width: 1440, height: 900 };

/**
 * A bemutató transcript sorainak határai (SPEC-008 12.6, "3-6 jellemző esemény
 * sor"): user döntés, nem mért érték.
 */
const MINIMUM_TRANSCRIPT_ROW_COUNT = 3;
const MAXIMUM_TRANSCRIPT_ROW_COUNT = 6;

/**
 * A sorfajták és a lapon látszó címkéjük (SPEC-008 12.6): lépés indulás és
 * befejezés, agent válasz, eredmény.
 */
const TRANSCRIPT_KIND_LABELS: ReadonlyMap<RunEventKind, string> = new Map([
  ['step_started', 'Lépés elindult'],
  ['step_finished', 'Lépés befejeződött'],
  ['sdk_assistant', 'Asszisztens üzenet'],
  ['sdk_result', 'Eredmény'],
]);

/**
 * A lépés futás nem lezárt állapotai: ilyen lépéshez `step_finished` és
 * `sdk_result` sor nem tartozhat.
 */
const OPEN_STEP_RUN_STATUSES: readonly string[] = ['pending', 'running', 'waiting_approval'];

declare global {
  // Ambiens globális változó deklaráció, a `run-view-stream.ts` mintájára: a
  // TypeScript a `globalThis` kiegészítését csak `var` alakban engedi.
  /**
   * A lapra kézbesített `run_event` keretek száma (`countDeliveredRunEventFrames`).
   */
  var e2eDeliveredRunEventFrameCount: number | undefined;
}

/**
 * A böngésző valódi `EventSource` példányán kézbesített `run_event` keretek
 * számlálása: a számláló a hálózatról érkezett kereteket számolja, tehát a
 * felület szűrésétől (a kurzor eldobja az ismétlést) független.
 */
async function countDeliveredRunEventFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let deliveredCount = 0;
    const NativeEventSource = EventSource;
    class CountingEventSource extends NativeEventSource {
      constructor(...parameters: ConstructorParameters<typeof EventSource>) {
        super(...parameters);
        this.addEventListener('run_event', () => {
          deliveredCount += 1;
        });
      }
    }
    Object.defineProperties(globalThis, {
      e2eDeliveredRunEventFrameCount: { configurable: true, get: () => deliveredCount },
      EventSource: { configurable: true, writable: true, value: CountingEventSource },
    });
  });
}

function isStreamRequest(url: string): boolean {
  return url.startsWith(`${STREAM_ORIGIN}/events`);
}

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

  test('egyetlen elágazás csomópontból induló éle sem kulcs nélküli, a sourceHandle egyezik a branchKey-jel, és az e-branch-loop kulcsa az alapértelmezett ág (SPEC-008 5.1, 106.)', () => {
    const branchNodeIds = new Set(SHOWCASE_GRAPH.nodes.filter((node) => node.type === 'branch').map((node) => node.id));
    expect(branchNodeIds.size).toBeGreaterThan(0);
    expect(
      SHOWCASE_GRAPH.edges
        .filter((edge) => branchNodeIds.has(edge.sourceNodeId) && edge.branchKey === null)
        .map((edge) => edge.id),
    ).toEqual([]);
    expect(
      SHOWCASE_GRAPH.edges
        .filter((edge) => branchNodeIds.has(edge.sourceNodeId) && edge.sourceHandle !== edge.branchKey)
        .map((edge) => edge.id),
    ).toEqual([]);

    const loopEdge = SHOWCASE_GRAPH.edges.find((edge) => edge.id === 'e-branch-loop');
    const loopSource = SHOWCASE_GRAPH.nodes.find((node) => node.id === loopEdge?.sourceNodeId);
    if (loopSource?.config.type !== 'branch') {
      throw new Error('az e-branch-loop él forrása nem branch konfigurációjú csomópont');
    }
    expect(loopEdge?.branchKey).toBe(loopSource.config.defaultBranchKey);
    expect(loopSource.config.branches.map((branch) => branch.key)).toContain(loopSource.config.defaultBranchKey);
  });

  test('a transcript sorai 3-6 db, a négy sorfajtát mind tartalmazzák, és következetesek a lépés futásokkal (SPEC-008 12.6)', () => {
    expect(SHOWCASE_RUN_EVENTS.length).toBeGreaterThanOrEqual(MINIMUM_TRANSCRIPT_ROW_COUNT);
    expect(SHOWCASE_RUN_EVENTS.length).toBeLessThanOrEqual(MAXIMUM_TRANSCRIPT_ROW_COUNT);
    const kinds = new Set(SHOWCASE_RUN_EVENTS.map((record) => record.kind));
    for (const kind of TRANSCRIPT_KIND_LABELS.keys()) {
      expect(kinds.has(kind)).toBe(true);
    }
    expect(kinds.has('branch_taken')).toBe(false);

    for (const record of SHOWCASE_RUN_EVENTS) {
      const stepRun = SHOWCASE_RUN_STEP_RUNS.find((candidate) => candidate.id === record.stepRunId);
      if (stepRun === undefined) {
        throw new Error(`a(z) ${String(record.id)}. sor stepRunId értéke nem a lépés futások egyike`);
      }
      if (record.kind === 'step_finished' || record.kind === 'sdk_result') {
        expect(OPEN_STEP_RUN_STATUSES).not.toContain(stepRun.status);
      }
      if (record.kind === 'sdk_assistant' || record.kind === 'sdk_result') {
        expect(stepRun.nodeType).toBe('agent_step');
      }
    }
  });

  test('egyetlen lépés futás sem vár jóváhagyásra, és a keretek pótolt run_event sorozatot adnak replay_complete zárással', () => {
    expect(SHOWCASE_RUN_STEP_RUNS.filter((stepRun) => stepRun.status === 'waiting_approval')).toEqual([]);
    const events = SHOWCASE_RUN_STREAM_FRAMES.filter((frame) => frame.event === 'run_event');
    expect(events).toHaveLength(SHOWCASE_RUN_EVENTS.length);
    expect(events.every((frame) => frame.delivery === 'replayed')).toBe(true);
    expect(SHOWCASE_RUN_STREAM_FRAMES.at(-1)?.event).toBe('replay_complete');
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

for (const theme of ['light', 'dark'] as const) {
  test.describe(`futás nézet, ${theme} téma`, () => {
    test.use({ colorScheme: theme, viewport: VIEWPORT });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
      }, theme);
      await installShowcaseRunMocks(page);
    });

    test('a transcript teljesen látszik, görgetés és jóváhagyás nélkül, és a D2 kapcsoló a vezérlők között áll', async ({
      page,
    }) => {
      await openShowcaseRunView(page);
      await fitShowcaseGraphIntoView(page);

      await expectShowcaseTranscript(page);

      const rows = page.getByRole('list', { name: 'Futás eseményei' }).getByRole('listitem');
      for (const label of TRANSCRIPT_KIND_LABELS.values()) {
        await expect(rows.filter({ hasText: label }).first()).toBeVisible();
      }
      await expect(page.getByRole('button', { name: 'Minden bejárt ág kiemelése' })).toBeVisible();
    });
  });
}

test.describe('a transcript sorai egyszer szerepelnek az SSE újracsatlakozás után is', () => {
  test.use({ viewport: VIEWPORT });

  const sentFrameCount = SHOWCASE_RUN_STREAM_FRAMES.filter((frame) => frame.event === 'run_event').length;

  test('a fixtúra mockjával a második kérés függőben marad: a kézbesített keretek és a sorok száma a küldött keretekével egyenlő', async ({
    page,
  }) => {
    let streamRequestCount = 0;
    page.on('request', (request) => {
      if (isStreamRequest(request.url())) {
        streamRequestCount += 1;
      }
    });
    await countDeliveredRunEventFrames(page);
    await installShowcaseRunMocks(page);
    await openShowcaseRunView(page);
    await expectShowcaseTranscript(page);

    // A böngésző újracsatlakozik: a második kérés megérkezik, de a mock nem válaszol rá.
    await expect.poll(() => streamRequestCount).toBe(2);

    expect(await page.evaluate(() => globalThis.e2eDeliveredRunEventFrameCount)).toBe(sentFrameCount);
    await expect(page.getByRole('list', { name: 'Futás eseményei' }).getByRole('listitem')).toHaveCount(sentFrameCount);
  });

  test('az újrapótló mockkal a második pótlás is megérkezik, és a sorok száma a küldött keretekével marad egyenlő', async ({
    page,
  }) => {
    await countDeliveredRunEventFrames(page);
    await installShowcaseRunMocks(page);
    // A később regisztrált útvonalat a Playwright előbb próbálja: ez váltja le a fixtúra mockját.
    await mockSseFrames(page, SHOWCASE_RUN_STREAM_FRAMES);
    await openShowcaseRunView(page);
    await expectShowcaseTranscript(page);

    await page.waitForFunction(
      (expected) => globalThis.e2eDeliveredRunEventFrameCount === expected,
      2 * sentFrameCount,
    );

    await expect(page.getByRole('list', { name: 'Futás eseményei' }).getByRole('listitem')).toHaveCount(sentFrameCount);
  });
});
