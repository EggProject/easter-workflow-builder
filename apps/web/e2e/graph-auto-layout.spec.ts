// Regressziós e2e a `graph-auto-layout` témára (T-009-19, SPEC-008 5.7): az
// "Elrendezés" gomb, a dagre LR elrendezés valódi böngészőben, és a
// mentetlen jelzővel való kölcsönhatás. A `layout-graph.ts` e2e lefedettsége
// korábban 0 százalék volt, mert a `graph-editor.spec.ts` egyetlen tesztje
// sem kattintott erre a gombra - a dagre hívás maga (`Graph`/`setNode`/
// `setEdge`/`layout`) unit teszttel (`layout-graph.spec.ts`) már fedett volt,
// de sosem futott le a tényleges böngészőben instrumentált build ellen.
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
  promptTemplate: 'Foglald össze a bemenetet.',
  providerId: null,
  modelId: null,
  effort: null,
  thinking: null,
  allowedTools: [],
  disallowedTools: [],
  permissionMode: null,
  maxTurns: null,
  maxBudgetUsd: null,
  systemPrompt: null,
  agents: {},
  skills: null,
  mcpServers: {},
  enabledEngineHooks: [],
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  agentTools: [],
  sessionMode: 'isolated',
  structuredOutput: null,
  onUnhandledError: null,
};

/**
 * A `@dagrejs/dagre` dokumentált alapértelmezett távolságai, amiket a
 * `layoutGraph` szándékosan NEM ír felül. Két független forrás adja
 * ugyanezt a két számot (`docs/research/2026-09-05-grafszerkeszto-es-transcript.md`
 * 6.3 szekció): a hivatalos wiki
 * (<https://github.com/dagrejs/dagre/wiki#configuring-the-layout>) és a
 * publikált `3.1.1` csomag forráskódjának alapértelmezés objektuma. A
 * `ranksep` a rangok (LR mellett: oszlopok) közti, a `nodesep` az azonos
 * rangba eső csomópontok közti hézag.
 */
const DAGRE_DEFAULT_RANKSEP = 50;
const DAGRE_DEFAULT_NODESEP = 50;

/**
 * A kezdeti pozíciók SZÁNDÉKOSAN fordítottak: az `n-start` (az egyetlen
 * bejövő él nélküli csomópont, tehát a dagre gyökere) a legnagyobb X-en áll,
 * a lánc vége a legkisebbön. A `rankdir: 'LR'` elrendezés ettől garantáltan
 * MEGVÁLTOZTATJA a sorrendet - a teszt ezért nem csak azt ellenőrzi, hogy
 * "valami történt", hanem hogy a végeredmény ténylegesen az élek iránya
 * szerint balról jobbra halad.
 *
 * Az `n-par-a` és az `n-par-b` ugyanannak a csomópontnak a két utódja, tehát
 * az elrendezés után garantáltan AZONOS rangba (LR mellett: azonos oszlopba)
 * esnek - ez teszi mérhetővé a `nodesep` szerinti függőleges hézagot.
 *
 * A kezdeti pozíciók SZÁNDÉKOSAN egy nagyon szűk, néhány tíz egységes dobozba
 * esnek (a csomópontok egymást is átfedik), jóval szűkebbe, mint amekkorát az
 * elrendezés eredménye elfoglal. A betöltéskori `fitView` emiatt erősen
 * RÁnagyít, és ha az elrendezés után a nézet nem illesztődne újra, az
 * elrendezett gráf szélső csomópontjai a vászon látható területén kívülre
 * esnének - ezt méri a lenti harmadik teszt (mérve: a jobb szélső csomópont
 * 434 pixellel lógna ki).
 */
const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 60,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent-a',
      type: 'agent_step',
      label: 'Első lépés',
      positionX: 0,
      positionY: 15,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent-b',
      type: 'agent_step',
      label: 'Második lépés',
      positionX: 30,
      positionY: 30,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-par-a',
      type: 'agent_step',
      label: 'Párhuzamos ág A',
      positionX: 15,
      positionY: 45,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-par-b',
      type: 'agent_step',
      label: 'Párhuzamos ág B',
      positionX: 15,
      positionY: 60,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [
    {
      id: 'e1',
      sourceNodeId: 'n-start',
      targetNodeId: 'n-agent-a',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e2',
      sourceNodeId: 'n-agent-a',
      targetNodeId: 'n-agent-b',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e3',
      sourceNodeId: 'n-agent-b',
      targetNodeId: 'n-par-a',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e4',
      sourceNodeId: 'n-agent-b',
      targetNodeId: 'n-par-b',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
  ],
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

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

/**
 * A React Flow saját, dokumentált `data-testid="rf__node-<id>"` fogódzója
 * (lásd `graph-editor.spec.ts` azonos nevű függvénye): a node kártya
 * `role="group"` szerepe azonos és szerző adta hozzáférhető név nélküli, a
 * `getByText` pedig csak nem interaktív elemre való - se a `getByRole`, se a
 * `getByText` nem alkalmazható, ezért a locator sorrend szerint indokolt
 * `getByTestId` a `rf__` előtagú kivétellel.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

async function requireBoundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem talált mérhető dobozt a locatorhoz');
  }
  return box;
}

interface GraphLayoutBox {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * A csomópont dobozai a GRÁF saját koordinátarendszerében, nem képernyő
 * pixelben. Ez azért kell, mert a `nodesep`/`ranksep` gráf egységben van
 * megadva, a `boundingBox()` viszont a vászon nagyításával (`transform:
 * scale()`) megszorzott képernyő pixelt ad - a kettő közvetlenül nem
 * vethető össze. A React Flow minden csomópont wrapperét a saját
 * `transform: translate(Xpx, Ypx)` értékével helyezi el, ami MÁR gráf
 * koordináta, az `offsetWidth`/`offsetHeight` pedig definíció szerint a CSS
 * transzformációtól független layout (border-box) méret - tehát a kettő
 * ugyanabban a rendszerben áll, mint a dagre bemenete. Erre a leolvasásra
 * nincs Playwright locator, ezért megy `page.evaluate()`-tel.
 */
async function readGraphLayoutBoxes(page: Page): Promise<readonly GraphLayoutBox[]> {
  return page.evaluate(() =>
    [...globalThis.document.querySelectorAll<HTMLElement>('.react-flow__node')].map((wrapper) => {
      const translate = /translate\((?<x>-?[\d.]+)px,\s*(?<y>-?[\d.]+)px\)/.exec(wrapper.style.transform);
      return {
        id: wrapper.dataset['id'] ?? '',
        x: Number(translate?.groups?.['x']),
        y: Number(translate?.groups?.['y']),
        width: wrapper.offsetWidth,
        height: wrapper.offsetHeight,
      };
    }),
  );
}

function requireLayoutBox(boxes: readonly GraphLayoutBox[], nodeId: string): GraphLayoutBox {
  const box = boxes.find((entry) => entry.id === nodeId);
  if (box === undefined) {
    throw new Error(`a teszt nem találta a(z) "${nodeId}" csomópont gráf koordinátás dobozát`);
  }
  return box;
}

async function loadEditor(page: Page): Promise<void> {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-par-a')).toBeVisible();
  await expect(nodeLocator(page, 'n-par-b')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
});

test('az "Elrendezés" gomb balról jobbra rendezi a csomópontokat, és mentés nélkül piszkos állapotba viszi a gráfot', async ({
  page,
}) => {
  let saveCallCount = 0;
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      saveCallCount += 1;
      await route.fulfill(jsonBody(GRAPH));
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);

  await expect(nodeLocator(page, 'n-start')).toBeVisible();
  await expect(nodeLocator(page, 'n-agent-a')).toBeVisible();
  await expect(nodeLocator(page, 'n-agent-b')).toBeVisible();

  // Betöltés után a gráf még nem piszkos: a jelző nincs a DOM-ban.
  await expect(page.getByRole('status')).toBeHidden();

  const beforeStart = await requireBoundingBox(nodeLocator(page, 'n-start'));

  await page.getByRole('button', { name: 'Elrendezés' }).click();

  // A jelző megjelenik: a `layoutGraph` hívása a `currentNodes` állapotot
  // írta át, ami az `isGraphDirty`-t igazra váltja - mentés nem történt.
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');
  expect(saveCallCount).toBe(0);

  const afterStart = await requireBoundingBox(nodeLocator(page, 'n-start'));
  const afterAgentA = await requireBoundingBox(nodeLocator(page, 'n-agent-a'));
  const afterAgentB = await requireBoundingBox(nodeLocator(page, 'n-agent-b'));

  // A kezdeti elrendezés fordított (`n-start` a jobb szélen); a dagre LR
  // elrendezés UTÁN az élek iránya szerinti, balról jobbra sorrendnek kell
  // állnia.
  expect(afterStart.x).toBeLessThan(afterAgentA.x);
  expect(afterAgentA.x).toBeLessThan(afterAgentB.x);
  // A pozíció ténylegesen megváltozott a kattintás hatására.
  expect(afterStart.x).not.toBe(beforeStart.x);
});

/**
 * A MÉRT HIBA, ami ezt a tesztet indokolja (2026-09-06). A `.graph-node-card`
 * a mért `358x106`-os konstanst `min-width`/`min-height` alakban, a böngésző
 * alapértelmezett `content-box` doboz modelljében kapta, ezért a TÉNYLEGESEN
 * kirajzolt kártya `392x132` lett (a belső margó és a keret hozzáadódott),
 * miközben a dagre ugyanezt a csomópontot `358x106`-osnak hitte. A különbség
 * a hézagra ült rá: az 50 egységes `ranksep`-ből 16, az 50 egységes
 * `nodesep`-ből 24 maradt, tehát a csomópontok gyakorlatilag egymáshoz
 * tapadtak, és az élek eltűntek közöttük. A javítás a kártya
 * `box-sizing: border-box` beállítása, amitől a kirajzolt méret pontosan a
 * mért konstans lesz. Ez a teszt ezt a hézagot állítja, mert ez az a
 * mérhető tulajdonság, ami a hibás állapotban BUKIK, a helyesben átmegy.
 */
test('az elrendezés után az azonos rangú csomópontok között legalább `nodesep`, a rangok között legalább `ranksep` hézag marad', async ({
  page,
}) => {
  await loadEditor(page);

  await page.getByRole('button', { name: 'Elrendezés' }).click();
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');

  const boxes = await readGraphLayoutBoxes(page);
  const agentB = requireLayoutBox(boxes, 'n-agent-b');
  const parallelA = requireLayoutBox(boxes, 'n-par-a');
  const parallelB = requireLayoutBox(boxes, 'n-par-b');

  // A két párhuzamos ág ugyanabba a rangba esik, tehát az X-ük azonos: enélkül
  // a lenti függőleges hézag állítás más rangok közt mérne.
  expect(parallelA.x).toBe(parallelB.x);

  // A rangok közti vízszintes hézag: az `n-agent-b` jobb széle és a rákövetkező
  // rang bal széle között legalább a dagre dokumentált `ranksep` értékének kell
  // maradnia.
  expect(parallelA.x - (agentB.x + agentB.width)).toBeGreaterThanOrEqual(DAGRE_DEFAULT_RANKSEP);

  // Az azonos rangon belüli függőleges hézag: legalább a dokumentált `nodesep`.
  const [upper, lower] = parallelA.y < parallelB.y ? [parallelA, parallelB] : [parallelB, parallelA];
  expect(lower.y - (upper.y + upper.height)).toBeGreaterThanOrEqual(DAGRE_DEFAULT_NODESEP);
});

/**
 * A második mért hiba (2026-09-06): a `fitView` prop dokumentált jelentése
 * kizárólag a KEZDETI nézetre szól, ezért az "Elrendezés" kattintás után a
 * vászon a betöltéskori nagyításon és eltolásán maradt, és az új elrendezés a
 * vászon egy sarkába csúszott, nagy üres területtel maga körül. A javítás a
 * `GraphEditorCanvas.autoLayoutRevision` propra kötött, `onInit`-ből kapott
 * példányon hívott `fitView()`. A fixture kezdeti pozíciói szűk dobozba
 * esnek, tehát a betöltéskori illesztés erősen ránagyít - újraillesztés
 * nélkül az elrendezett gráf szélső csomópontjai a vászon látható területén
 * kívülre esnének.
 */
test('az elrendezés után a nézet újra a teljes gráfra illeszkedik, egyetlen csomópont sem lóg ki a vászonból', async ({
  page,
}) => {
  await loadEditor(page);

  await page.getByRole('button', { name: 'Elrendezés' }).click();
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');

  // A React Flow saját, dokumentált `data-testid="rf__wrapper"` fogódzója a
  // vászon gyökerén - ugyanaz a `rf__` előtagú kivétel, mint a node testid-nél.
  const canvas = await requireBoundingBox(page.getByTestId('rf__wrapper'));
  for (const nodeId of ['n-start', 'n-agent-a', 'n-agent-b', 'n-par-a', 'n-par-b']) {
    const box = await requireBoundingBox(nodeLocator(page, nodeId));
    expect(box.x).toBeGreaterThanOrEqual(canvas.x);
    expect(box.y).toBeGreaterThanOrEqual(canvas.y);
    expect(box.x + box.width).toBeLessThanOrEqual(canvas.x + canvas.width);
    expect(box.y + box.height).toBeLessThanOrEqual(canvas.y + canvas.height);
  }
});
