// E2E a transcript panelre (`transcript-panel` téma, PLAN-009 T-009-25).
//
// Miért e2e: a virtualizáció, a sormagasság és a jelölő oszlop GEOMETRIÁJA
// kizárólag valódi layouttal figyelhető meg. A happy-dom nem végez layoutot,
// a `react-window` konténer mérete ott nulla, tehát a DOM-ban álló sorok
// száma és a renderelt szélességek unit tesztben nem mondanak semmit
// (SPEC-008 12. szekció, "hogy a transcript virtualizált ... e2e").
//
// Minden REST hívás `page.route()` mockon megy; a pótlás egyetlen, lezárt SSE
// válasz (`mockSseFrames`), a szabálykönyv 11. szekciójának HASZNÁLANDÓ útja,
// mert egyik teszt sem igényli a kapcsolat nyitva maradását. A lezárt válasz
// után az `EventSource` újracsatlakozik és UGYANAZT a pótlást kapja: a panel
// kurzora ezeket ismétlésként eldobja, ami egyben azt is igazolja, hogy a
// sorok száma nem duplázódik.
import {
  encodeStreamFrame,
  type RunDetail,
  type RunEventRecord,
  type RunSnapshotResponse,
  type StepRunRecord,
  type StreamFrame,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STREAM_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockSseFrames } from './sse-mock.ts';
import { longUrlToolResultRecord, makeRunEventRecord, replayFrames, sdkResultRecord } from './transcript-fixture.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const RUN_ID = 'run-tp';

const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-tp', name: 'Transcript workflow', description: null },
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

const RUN_DETAIL: RunDetail = {
  id: RUN_ID,
  workflowId: 'w-tp',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: RUN_ID,
  depth: 0,
  workflowAncestry: ['w-tp'],
  graphSnapshotHash: 'd'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

const BASE_STEP_RUN: StepRunRecord = {
  id: 'sr-claude',
  runId: RUN_ID,
  nodeId: 'n-start',
  nodeType: 'agent_step',
  parentStepRunId: null,
  iteration: 0,
  attempt: 1,
  status: 'succeeded',
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
  finishedAtMs: 3,
  createdAtMs: 2,
};

const STEP_RUNS: readonly StepRunRecord[] = [
  BASE_STEP_RUN,
  { ...BASE_STEP_RUN, id: 'sr-minimax', providerId: 'minimax' },
];

/* eslint-enable unicorn/no-null */

const RUN_URL = `/run?runId=${RUN_ID}`;
const RUN_VIEW_LAYOUT_STORAGE_KEY = 'eggRunViewLayout';

/**
 * A jelölő oszlop és a sormagasság méréséhez használt, egymástól eltérő
 * sorok: motor eredetű sor, költség metát hordozó `claude-subscription` sor,
 * költség nélküli MiniMax sor, a 400 karakteres URL-t hordozó eszköz eredmény
 * és egy eszközhívás.
 */
const MIXED_RECORDS: readonly RunEventRecord[] = [
  makeRunEventRecord(1, RUN_ID),
  sdkResultRecord(2, RUN_ID, 'sr-claude'),
  sdkResultRecord(3, RUN_ID, 'sr-minimax'),
  longUrlToolResultRecord(4, RUN_ID, 'sr-claude'),
  makeRunEventRecord(5, RUN_ID, {
    stepRunId: 'sr-claude',
    origin: 'sdk',
    kind: 'sdk_assistant',
    toolName: 'web_search',
    toolUseId: 'toolu_e2e',
  }),
];

/**
 * A futás nézet REST mockjai; a workflow lista mockja az elnavigáló teszt
 * célképernyőjéhez kell.
 */
async function mockRunViewRoutes(page: Page, runDetail: RunDetail = RUN_DETAIL): Promise<void> {
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(runDetail))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
  ]);
}

async function mockTranscript(
  page: Page,
  records: readonly RunEventRecord[],
  runDetail: RunDetail = RUN_DETAIL,
): Promise<void> {
  await mockSseFrames(page, replayFrames(RUN_ID, records));
  await mockRunViewRoutes(page, runDetail);
}

function transcriptList(page: Page): Locator {
  return page.getByRole('list', { name: 'Futás eseményei' });
}

const BREAKPOINTS_CSS_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'packages',
  'ui',
  'src',
  'design-token',
  'breakpoints.css',
);

/**
 * A `--ep-screen-md` token értéke a design system forrásából, nem beírva
 * (ugyanaz a módszer, mint a `run-view.spec.ts` fájlban): ez alatt a futás
 * nézet fül sávra vált, és a transcript a második fülön áll.
 */
function mediumScreenWidth(): number {
  const match = /--ep-screen-md:\s*(\d+)px/.exec(readFileSync(BREAKPOINTS_CSS_PATH, 'utf8'));
  if (match?.[1] === undefined) {
    throw new Error('A --ep-screen-md token nem található a breakpoints.css fájlban.');
  }
  return Number(match[1]);
}

/**
 * A futás nézet megnyitása és a transcript láthatóvá tétele.
 */
async function openTranscript(page: Page, rowCount: number): Promise<Locator> {
  await page.goto(RUN_URL);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  if (viewportWidth < mediumScreenWidth()) {
    await page.getByRole('tab', { name: 'Transcript' }).click();
  }
  const list = transcriptList(page);
  // A panel a csatoláskor az aljára görget: az utolsó sor kirajzolódása
  // jelzi, hogy a teljes pótlás feldolgozódott.
  await expect(list.getByRole('listitem').last()).toHaveAttribute('aria-posinset', String(rowCount));
  await expect(page.getByText('Előzmények betöltése', { exact: true })).toBeHidden();
  return list;
}

/**
 * Egy számított, pixelben megadott CSS érték (`"22.4px"`) száma.
 */
function pixelValue(value: string): number {
  const match = /^([\d.]+)px$/.exec(value);
  if (match?.[1] === undefined) {
    throw new Error(`nem pixel érték: ${value}`);
  }
  return Number(match[1]);
}

interface MarkerGeometry {
  readonly iconX: number;
  readonly iconWidth: number;
  readonly iconHeight: number;
  readonly titleX: number;
  readonly columnGap: number;
}

/**
 * Minden kirajzolt sor jelölő ikonjának és címének RENDERELT geometriája,
 * valamint a fejléc számított oszlopköze (a design system `gap` értéke, nem
 * beírt szám).
 */
async function markerGeometry(list: Locator): Promise<readonly MarkerGeometry[]> {
  return list.locator('.accordion__header').evaluateAll((headers) =>
    headers.map((header) => {
      const icon = header.querySelector('.accordion__icon');
      const title = header.querySelector('.accordion__title');
      if (icon === null || title === null) {
        throw new Error('hiányzó jelölő vagy cím a sor fejlécében');
      }
      const iconBox = icon.getBoundingClientRect();
      const columnGap = /^([\d.]+)px$/.exec(globalThis.getComputedStyle(header).columnGap)?.[1];
      return {
        iconX: iconBox.x,
        iconWidth: iconBox.width,
        iconHeight: iconBox.height,
        titleX: title.getBoundingClientRect().x,
        columnGap: Number(columnGap),
      };
    }),
  );
}

test('a virtualizáció: a DOM-ban álló sorok száma a sorok számától független (3000 és 6000 sor)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Regresszió: egy korábbi változatban az átméretezésre adott azonnali
  // `scrollToRow` a lista előző sorszámával ellenőrzött, és egy nagy pótlásnál
  // `RangeError` ("Invalid index specified") bontotta le a teljes fát, lista
  // nélkül (`use-transcript-auto-scroll.ts`, `onResize`). Minden laphiba
  // bukást okoz.
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  const measured: { rowCount: number; atBottom: number; atTop: number }[] = [];

  for (const rowCount of [3000, 6000]) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mockTranscript(
      page,
      Array.from({ length: rowCount }, (_, index) => makeRunEventRecord(index + 1, RUN_ID)),
    );
    const list = await openTranscript(page, rowCount);
    const atBottom = await list.getByRole('listitem').count();

    await list.evaluate((element) => {
      element.scrollTo({ top: 0 });
    });
    await expect(list.getByRole('listitem').first()).toHaveAttribute('aria-posinset', '1');
    const atTop = await list.getByRole('listitem').count();

    measured.push({ rowCount, atBottom, atTop });
  }

  // A mért számok a futás riportjába kerülnek (Playwright annotáció), hogy a
  // research fájl bejegyzése ellenőrizhető forrásból származzon.
  test.info().annotations.push({ type: 'dom-row-counts', description: JSON.stringify(measured) });
  const [smaller, larger] = measured;
  if (smaller === undefined || larger === undefined) {
    throw new Error('hiányzó mérés');
  }
  expect(pageErrors).toEqual([]);
  expect(larger.atBottom).toBe(smaller.atBottom);
  expect(larger.atTop).toBe(smaller.atTop);
  expect(smaller.atBottom).toBeLessThan(smaller.rowCount);
  expect(smaller.atTop).toBeLessThan(smaller.rowCount);
});

test('az összecsukott sor magassága egy szövegsor: tartalomtól független, és a fejléc számított méreteiből adódik', async ({
  page,
}) => {
  await mockTranscript(page, MIXED_RECORDS);
  for (const width of [375, 1440]) {
    await test.step(`viewport szélesség: ${String(width)}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const list = await openTranscript(page, MIXED_RECORDS.length);

      const rows = await list.getByRole('listitem').evaluateAll((items) =>
        items.map((item) => {
          const header = item.querySelector('.accordion__header');
          if (header === null) {
            throw new Error('hiányzó fejléc');
          }
          const style = globalThis.getComputedStyle(header);
          return {
            height: item.getBoundingClientRect().height,
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom,
            lineHeight: style.lineHeight,
          };
        }),
      );
      expect(rows).toHaveLength(MIXED_RECORDS.length);
      for (const row of rows) {
        // A layout egységnyi kerekítése (1/64 px) miatt egy tizedesjegy
        // pontossággal: a Playwright `toBeCloseTo` dokumentált szemantikája
        // szerint az eltérés 0,05 alatt marad.
        const expected = pixelValue(row.paddingTop) + pixelValue(row.paddingBottom) + pixelValue(row.lineHeight);
        expect(row.height).toBeCloseTo(expected, 1);
      }
    });
  }
});

test('a jelölő oszlop: a renderelt ikon 18x18, és a cím minden sorban ugyanonnan indul, több szélességen és panel méreten', async ({
  page,
}) => {
  await mockTranscript(page, MIXED_RECORDS);
  // Az utolsó eset a húzható elválasztóval szűkre állított transcript panel
  // (a gráf 85, a transcript 15 százalék): itt a költség metát hordozó sor
  // fejléce nem fér ki, a flex elemek zsugorodnak, és csak a jelölő
  // `flex-shrink: 0` szabálya tartja meg az oszlop szélességét.
  const cases: readonly { readonly width: number; readonly sizes?: readonly number[] }[] = [
    { width: 375 },
    { width: 768 },
    { width: 1440 },
    { width: 1440, sizes: [85, 15] },
  ];
  for (const { width, sizes } of cases) {
    await test.step(`viewport ${String(width)}px, panel arány ${JSON.stringify(sizes ?? 'alap')}`, async () => {
      await page.setViewportSize({ width, height: 900 });
      // A `localStorage` csak egy betöltött, azonos originű lapon írható: az
      // első `goto` után áll be az arány, a második (`openTranscript`) olvassa.
      await page.goto(RUN_URL);
      await page.evaluate(
        ({ key, value }) => {
          if (value === undefined) {
            globalThis.localStorage.removeItem(key);
          } else {
            globalThis.localStorage.setItem(key, JSON.stringify(value));
          }
        },
        { key: RUN_VIEW_LAYOUT_STORAGE_KEY, value: sizes },
      );
      const list = await openTranscript(page, MIXED_RECORDS.length);
      const geometry = await markerGeometry(list);

      expect(geometry).toHaveLength(MIXED_RECORDS.length);
      const [first] = geometry;
      if (first === undefined) {
        throw new Error('hiányzó sor');
      }
      for (const row of geometry) {
        expect(row.iconWidth).toBe(18);
        expect(row.iconHeight).toBe(18);
        expect(row.iconX).toBe(first.iconX);
        expect(row.titleX).toBeCloseTo(row.iconX + row.iconWidth + row.columnGap, 1);
        expect(row.titleX).toBe(first.titleX);
      }
    });
  }
});

for (const { persistedStreamDeltas, expectedNoteCount } of [
  { persistedStreamDeltas: false, expectedNoteCount: 1 },
  { persistedStreamDeltas: true, expectedNoteCount: 0 },
]) {
  test(`a fejléc delta mondata a futás persistedStreamDeltas értékét követi: ${String(persistedStreamDeltas)} mellett ${String(expectedNoteCount)} mondat (AC43)`, async ({
    page,
  }) => {
    await mockTranscript(page, MIXED_RECORDS, { ...RUN_DETAIL, persistedStreamDeltas });
    // Az utolsó sor kirajzolódása után a panel a teljes pótlást feldolgozta,
    // tehát a hiány nem a betöltés pillanatnyi állapota.
    await openTranscript(page, MIXED_RECORDS.length);

    await expect(page.getByText(/részleges szöveg csak élőben látszik/)).toHaveCount(expectedNoteCount);
  });
}

test('a kinyitott sor magassága a tartalomból számítódik, és a következő sor alatta kezdődik, takarás nélkül', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockTranscript(page, MIXED_RECORDS);
  const list = await openTranscript(page, MIXED_RECORDS.length);
  const rows = list.getByRole('listitem');

  const collapsedBox = await rows.nth(0).boundingBox();
  const collapsedHeight = collapsedBox?.height ?? 0;
  const firstHeader = rows.nth(0).getByRole('button');
  await firstHeader.click();
  await expect(firstHeader).toHaveAttribute('aria-expanded', 'true');

  await expect
    .poll(async () => {
      const firstBox = await rows.nth(0).boundingBox();
      const secondBox = await rows.nth(1).boundingBox();
      if (firstBox === null || secondBox === null) {
        return NaN;
      }
      return secondBox.y - (firstBox.y + firstBox.height);
    })
    .toBeCloseTo(0, 1);
  const expandedBox = await rows.nth(0).boundingBox();
  expect(expandedBox?.height ?? 0).toBeGreaterThan(collapsedHeight);
});

// ============================================================
// A huszonöt esemény típus és a payload változatok a valódi böngészőben.
//
// A `run-event-row` téma a T-009-24 óta létezik, de a T-009-25 előtt semmi
// nem csatolta fel, tehát az e2e lefedettségi riport nem is látta. A panel
// most a böngészőbe hozza, és a szabálykönyv 8. szekciójának ratchet
// szabálya szerint egyetlen új fedetlen tétel sem maradhat: ez a teszt a
// leképezés MINDEN ágát kirajzolja, a unit teszt esetkészletének
// megfelelőjével (`run-event-row-summary.spec.ts`).
// ============================================================

const UNKNOWN_STEP_RUN_ID = 'sr-ismeretlen';

/**
 * A leképezés minden ága egy-egy sorral: mind a huszonöt `kind`, a payload
 * alakváltozatai, és az `sdk_result` mindhárom provider állapota (ismert
 * `claude-subscription`, ismert `minimax`, fel nem oldott).
 */
const ALL_BRANCH_OVERRIDES: readonly Partial<RunEventRecord>[] = [
  {
    origin: 'sdk',
    kind: 'sdk_assistant',
    toolName: 'web_search',
    toolUseId: 'toolu_a',
    inputTokens: 10,
    outputTokens: 20,
    cacheReadInputTokens: 30,
    cacheCreationInputTokens: 40,
  },
  { origin: 'sdk', kind: 'sdk_assistant' },
  { origin: 'sdk', kind: 'sdk_assistant', toolName: 'web_search' },
  { origin: 'sdk', kind: 'sdk_user', parentToolUseId: 'toolu_b' },
  { origin: 'sdk', kind: 'sdk_user' },
  { origin: 'sdk', kind: 'sdk_user', payload: { message: { role: 'user', content: 'Foglald össze a cikket' } } },
  {
    origin: 'sdk',
    kind: 'sdk_user',
    payload: {
      message: {
        content: [
          { type: 'text', text: 'Első' },
          { type: 'text', text: 'Második' },
        ],
      },
    },
  },
  {
    origin: 'sdk',
    kind: 'sdk_user',
    parentToolUseId: 'toolu_c',
    payload: {
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'call-1', content: 'kész' },
          { type: 'tool_result', tool_use_id: 'call-2', content: [{ type: 'text', text: 'teszt' }] },
          42,
        ],
      },
    },
  },
  {
    origin: 'sdk',
    kind: 'sdk_stream_event',
    payload: { event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Szia' } } },
  },
  {
    origin: 'sdk',
    kind: 'sdk_stream_event',
    payload: { event: { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'gondolkodom' } } },
  },
  {
    origin: 'sdk',
    kind: 'sdk_stream_event',
    payload: { event: { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{"q":' } } },
  },
  { origin: 'sdk', kind: 'sdk_stream_event', payload: { event: { type: 'message_start' } } },
  { origin: 'sdk', kind: 'sdk_stream_event' },
  {
    origin: 'sdk',
    kind: 'sdk_result',
    stepRunId: 'sr-claude',
    inputTokens: 1,
    outputTokens: 2,
    cacheReadInputTokens: 3,
    cacheCreationInputTokens: 4,
    numTurns: 5,
    payload: { type: 'result', total_cost_usd: 0.213108 },
  },
  { origin: 'sdk', kind: 'sdk_result', stepRunId: 'sr-claude', payload: { type: 'result' } },
  { origin: 'sdk', kind: 'sdk_result', stepRunId: 'sr-claude', payload: { type: 'result', total_cost_usd: 1.23456 } },
  { origin: 'sdk', kind: 'sdk_result', stepRunId: 'sr-claude', payload: { type: 'result', total_cost_usd: '0.21' } },
  { origin: 'sdk', kind: 'sdk_result', stepRunId: 'sr-claude', payload: 'nem objektum' },
  { origin: 'sdk', kind: 'sdk_result', stepRunId: 'sr-minimax', payload: { type: 'result', total_cost_usd: 0.213108 } },
  {
    origin: 'sdk',
    kind: 'sdk_result',
    stepRunId: UNKNOWN_STEP_RUN_ID,
    payload: { type: 'result', total_cost_usd: 0.213108 },
  },
  { origin: 'sdk', kind: 'sdk_system' },
  { origin: 'sdk', kind: 'sdk_system', sdkMessageSubtype: 'init' },
  { origin: 'sdk', kind: 'sdk_hook_started', payload: { hook_name: 'pre-commit' } },
  { origin: 'sdk', kind: 'sdk_hook_progress', payload: { hook_name: 'pre-commit' } },
  { origin: 'sdk', kind: 'sdk_hook_response', payload: { hook_name: 'pre-commit' } },
  { origin: 'sdk', kind: 'sdk_hook_started', payload: 'nem objektum' },
  { origin: 'sdk', kind: 'sdk_hook_response', payload: {} },
  { origin: 'sdk', kind: 'sdk_informational', payload: { content: 'Slash parancs lefutott' } },
  { origin: 'sdk', kind: 'sdk_informational', payload: {} },
  { origin: 'sdk', kind: 'sdk_commands_changed', payload: { commands: [{}, {}, {}] } },
  { origin: 'sdk', kind: 'sdk_commands_changed', payload: { commands: 'nem tömb' } },
  { origin: 'sdk', kind: 'sdk_rate_limit', payload: { rate_limit_info: { status: 'allowed_warning' } } },
  { origin: 'sdk', kind: 'sdk_rate_limit', payload: 'nem objektum' },
  { origin: 'sdk', kind: 'sdk_rate_limit', payload: { rate_limit_info: 'nem objektum' } },
  { origin: 'sdk', kind: 'sdk_context_usage' },
  { kind: 'run_started' },
  { kind: 'run_finished' },
  { kind: 'run_interrupted' },
  { kind: 'step_started' },
  { kind: 'step_finished' },
  { kind: 'branch_taken' },
  { kind: 'fan_out_expanded' },
  { kind: 'join_resolved' },
  { kind: 'loop_iteration_started' },
  { kind: 'approval_requested' },
  { kind: 'approval_decided' },
  { kind: 'sub_workflow_started' },
  { kind: 'sub_workflow_finished' },
];

const ALL_BRANCH_RECORDS: readonly RunEventRecord[] = ALL_BRANCH_OVERRIDES.map((overrides, index) =>
  makeRunEventRecord(index + 1, RUN_ID, overrides),
);

test('mind a huszonöt esemény típus és minden payload változat sort kap, a költség a lépés providere szerint', async ({
  page,
}) => {
  // Elég magas ablak, hogy a virtualizált lista minden sort egyszerre
  // kirajzoljon: így mind a 48 sor leképezése a böngészőben fut le.
  await page.setViewportSize({ width: 1440, height: 3600 });
  await mockTranscript(page, ALL_BRANCH_RECORDS);
  const list = await openTranscript(page, ALL_BRANCH_RECORDS.length);
  await expect(list.getByRole('listitem')).toHaveCount(ALL_BRANCH_RECORDS.length);

  // A három `sdk_result` provider állapot: csak a `claude-subscription`
  // lépés sorában áll költség meta.
  const resultRow = (position: number): Locator =>
    list.getByRole('listitem').and(list.locator(`[aria-posinset="${String(position)}"]`));
  const claudePosition = ALL_BRANCH_OVERRIDES.findIndex((overrides) => overrides.numTurns === 5) + 1;
  const minimaxPosition = ALL_BRANCH_OVERRIDES.findIndex((overrides) => overrides.stepRunId === 'sr-minimax') + 1;
  const unknownPosition =
    ALL_BRANCH_OVERRIDES.findIndex((overrides) => overrides.stepRunId === UNKNOWN_STEP_RUN_ID) + 1;
  // A meta szlotnak nincs szerepe és hozzáférhető neve, ezért CSS
  // szelektor (a locator sorrend utolsó eleme, szabálykönyv 11. szekció).
  await expect(resultRow(claudePosition).locator('.accordion__meta')).toHaveText('Költség (SDK becslés): $0.2131');
  await expect(resultRow(minimaxPosition).locator('.accordion__meta')).toHaveCount(0);
  await expect(resultRow(unknownPosition).locator('.accordion__meta')).toHaveCount(0);

  await resultRow(unknownPosition).getByRole('button').click();
  await expect(
    resultRow(unknownPosition).getByText('A lépés providere ebben a nézetben nem ismert', { exact: false }),
  ).toBeVisible();
});

// ============================================================
// Az automatikus görgetés mindkét ága, két egymást követő, lezárt SSE
// válasszal.
//
// A `route.fulfill()` egyszeri, lezárt válasz (szabálykönyv 11. szekció),
// amire az `EventSource` újracsatlakozik: a MÁSODIK kapcsolat egy ÚJ,
// ugyancsak lezárt válasz, tehát nem egy nyitott kapcsolatba menet közben
// beszúrt keret. A második válasz addig vár, amíg a teszt el nem engedi;
// így a felhasználó görgetése és az új események érkezése közötti sorrend
// determinisztikus, idő alapú várakozás nélkül. A második válasz a korábbi
// két utolsó sort is megismétli: a kurzor ezeket eldobja.
// ============================================================

const FIRST_BATCH_SIZE = 40;
const NEW_EVENT_COUNT = 3;

interface TwoPhaseStream {
  readonly release: () => void;
}

async function mockTwoPhaseStream(page: Page): Promise<TwoPhaseStream> {
  const firstBatch = Array.from({ length: FIRST_BATCH_SIZE }, (_, index) => makeRunEventRecord(index + 1, RUN_ID));
  const secondBatch = Array.from({ length: FIRST_BATCH_SIZE + NEW_EVENT_COUNT }, (_, index) =>
    makeRunEventRecord(index + 1, RUN_ID),
  ).slice(FIRST_BATCH_SIZE - 2);
  // Egy MÁSIK futás kerete, pótlás zárása és átmeneti (delta) kerete: a
  // panel mindhármat figyelmen kívül hagyja, tehát az első válasz után
  // pontosan `FIRST_BATCH_SIZE` sor áll. A NÉZETT futás átmeneti kerete a
  // T-009-26 óta saját, megjelölt sort ad; a tesztje a
  // `sse-real-server.spec.ts` fájlban áll, nyitva maradó kapcsolaton.
  const ignoredFrames: readonly StreamFrame[] = [
    { event: 'run_event', delivery: 'replayed', runEvent: makeRunEventRecord(999, 'run-masik') },
    { event: 'replay_complete', runId: 'run-masik', throughEventId: 999 },
    {
      event: 'run_event_transient',
      runId: 'run-masik',
      // eslint-disable-next-line unicorn/no-null -- a keret nullázható mezője a dróton ténylegesen `null`
      stepRunId: null,
      kind: 'sdk_stream_event',
      occurredAtMs: 1,
      payload: { event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Sz' } } },
    },
  ];
  const { promise: secondReleased, resolve: releaseSecond } = Promise.withResolvers<undefined>();
  let connectionCount = 0;
  await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
    connectionCount += 1;
    const frames =
      connectionCount === 1
        ? [...ignoredFrames, ...replayFrames(RUN_ID, firstBatch)]
        : replayFrames(RUN_ID, secondBatch);
    if (connectionCount > 1) {
      await secondReleased;
    }
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: frames.map((frame) => encodeStreamFrame(frame)).join(''),
    });
  });
  await mockRunViewRoutes(page);
  return {
    release: () => {
      releaseSecond(undefined);
    },
  };
}

test('az alján állva az új események érkezésekor a lista az utolsó sorra görget, gomb nélkül', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const stream = await mockTwoPhaseStream(page);
  const list = await openTranscript(page, FIRST_BATCH_SIZE);

  stream.release();
  const totalCount = FIRST_BATCH_SIZE + NEW_EVENT_COUNT;
  await expect(list.getByRole('listitem').last()).toHaveAttribute('aria-posinset', String(totalCount));
  await expect(list.getByRole('listitem').last()).toBeInViewport();
  await expect(page.getByRole('button', { name: /^Ugrás az aljára/ })).toHaveCount(0);
});

test('felgörgetve az új események nem görgetnek, az ugrás az aljára gomb a számukat mutatja, és visszaállítja a követést', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const stream = await mockTwoPhaseStream(page);
  const list = await openTranscript(page, FIRST_BATCH_SIZE);

  await list.evaluate((element) => {
    element.scrollTo({ top: 0 });
  });
  await expect(list.getByRole('listitem').first()).toHaveAttribute('aria-posinset', '1');
  stream.release();

  const jumpButton = page.getByRole('button', { name: `Ugrás az aljára (${String(NEW_EVENT_COUNT)} új esemény)` });
  await expect(jumpButton).toBeVisible();
  // Nem görgetett: a lista teteje továbbra is az első sor.
  await expect(list.getByRole('listitem').first()).toHaveAttribute('aria-posinset', '1');
  await expect(list.getByRole('listitem').first()).toBeInViewport();

  await jumpButton.click();
  const totalCount = FIRST_BATCH_SIZE + NEW_EVENT_COUNT;
  await expect(list.getByRole('listitem').last()).toHaveAttribute('aria-posinset', String(totalCount));
  await expect(list.getByRole('listitem').last()).toBeInViewport();
  await expect(jumpButton).toHaveCount(0);
});

test('a fül sávban a transcript fül megnyitásakor és egy fülváltás után is az utolsó sor látszik', async ({ page }) => {
  // A --ep-screen-md alatt a transcript fül a csatoláskor rejtett, tehát a
  // csatoláskori görgetés nem hathat: az aljára tapadást a lista `onResize`
  // jelzése állítja helyre, amikor a fül előtűnik.
  await page.setViewportSize({ width: 375, height: 812 });
  const records = Array.from({ length: FIRST_BATCH_SIZE }, (_, index) => makeRunEventRecord(index + 1, RUN_ID));
  await mockTranscript(page, records);
  const list = await openTranscript(page, FIRST_BATCH_SIZE);
  await expect(list.getByRole('listitem').last()).toBeInViewport();

  await page.getByRole('tab', { name: 'Gráf' }).click();
  await expect(list).toBeHidden();
  await page.getByRole('tab', { name: 'Transcript' }).click();
  await expect(list.getByRole('listitem').last()).toHaveAttribute('aria-posinset', String(FIRST_BATCH_SIZE));
  await expect(list.getByRole('listitem').last()).toBeInViewport();
});

const FIRST_EVENT_WAIT_TEXT = 'Várakozás az első eseményre';

// A futó, még esemény nélküli futás a betöltéstől (csontváz) és a lezárt,
// üres futástól is különböző állapot (SPEC-008 9. szekció 16. pont): a
// lezárult pótlás után a panel státusz szöveggel mondja ki, hogy az agent
// első eseményére vár. Mindkét témában, mert a jelzés színe téma token.
for (const theme of ['light', 'dark'] as const) {
  test(`futó, esemény nélküli futás: lezárult pótlás után látható várakozás jelzés (${theme} téma)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript((mode: string) => {
      globalThis.localStorage.setItem('eggTheme', mode);
    }, theme);
    await mockTranscript(page, []);
    await page.goto(RUN_URL);

    const waitStatus = page.getByRole('status').filter({ hasText: FIRST_EVENT_WAIT_TEXT });
    await expect(waitStatus).toBeVisible();
    await expect(page.getByText('Előzmények betöltése', { exact: true })).toBeHidden();
    await expect(page.getByText('A futásnak nincs eseménye.')).toBeHidden();
    await expect(page.locator('.transcript-panel__loading')).toHaveCount(0);
  });
}

test('esemény nélküli, lezárt pótlás után a lezárt futás kimondja, hogy nincs esemény, és elnavigálva leiratkozik', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockTranscript(page, [], { ...RUN_DETAIL, status: 'succeeded', finishedAtMs: 3 });
  await page.goto(RUN_URL);

  await expect(page.getByText('A futásnak nincs eseménye.')).toBeVisible();
  await expect(page.getByText('Előzmények betöltése', { exact: true })).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: FIRST_EVENT_WAIT_TEXT })).toHaveCount(0);

  // A képernyő leszerelése a keret feliratkozás lezárását is lefuttatja.
  await page.getByRole('link', { name: 'Workflow-k' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(transcriptList(page)).toHaveCount(0);
});
