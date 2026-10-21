// E2E a csomópont felvétel két pozíció szabályára, a felvett csomópont
// kijelölésére és a vászon jobb klikk menüjének viselkedésére valós
// Chromiumban (PLAN-009 T-009-45, SPEC-008 5.8, 75 ... 78. kritérium). A
// "Hozzáadás" gomb útján az új kártya KÖZEPE a látható vászon középpontja, a
// jobb klikk útján a kártya BAL FELSŐ SARKA a kattintás pontja. A gomb útja a
// React Flow store `width`, `height` és `transform` mezőjéből számol (M-99,
// egy forrású tény), ezért a teszt ugyanezt a három értéket a DOM-ból is
// kiolvassa, és a felvett csomópont helyét a kettő egyezésén méri. A mért
// számok és a szándékos rontások bukó tesztjei:
// docs/research/2026-10-14-csomopont-felvetel.md, T-009-45 szekció.
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { API_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

declare global {
  // A lapra kitett jelentő függvény (`page.exposeFunction`): a `window`
  // buborékoló `contextmenu` figyelője hívja, tehát a React kezelője UTÁN, az
  // esemény `defaultPrevented` értékével. Ambiens globális deklaráció, a
  // `coverage-fixture.ts` `__coverage__` mintájára (`var` alakban, mert a
  // TypeScript csak így engedi).
  var reportContextMenuDefaultPrevented: ((wasDefaultPrevented: boolean) => Promise<void>) | undefined;
}

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
  onUnhandledError: 'fail_run',
};

// Két csomópont átlósan, egy éllel: a `fitView` a kettőt a vászonba illeszti,
// tehát a nagyítás nem 1 (a középpont számítás osztása mérhető), a vászon
// közepe és a jobb felső negyede pedig üres terület. Az él a jobb klikk
// tesztjéhez kell; átlós, mert a vízszintes él befoglaló doboza 0 magas, amit
// a Playwright rejtettnek lát (`graph-edge-selection.spec.ts` fejléce).
const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Ügyfél kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n2',
      type: 'agent_step',
      label: 'Összefoglaló készítése',
      positionX: 1000,
      positionY: 480,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [
    {
      id: 'e1',
      sourceNodeId: 'n1',
      targetNodeId: 'n2',
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

const ADDABLE_NODE_LABELS = [
  'Agent lépés',
  'Elágazás',
  'Szétosztás',
  'Összefésülés',
  'Ciklus',
  'Emberi jóváhagyás',
  'Hibakezelő',
  'Al-workflow',
  'Szkript',
];

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Box extends Point {
  readonly width: number;
  readonly height: number;
}

/**
 * A vászon DOM-ból olvasott geometriája, a React Flow store három mezőjének
 * (M-99) megfelelője: a `width` és a `height` a `.react-flow__renderer` elem
 * `offsetWidth`/`offsetHeight` értéke (a telepített `@xyflow/react`
 * `useResizeHandler` ebből írja a store-t, `getDimensions`), a `transform` a
 * `.react-flow__viewport` inline `transform` stílusa (a könyvtár a store
 * `transform` mezőjét írja bele, `toTransformString`). A `left`/`top` a
 * `rf__wrapper` (a store `domNode` eleme) bal felső sarka, a
 * `screenToFlowPosition` ebből számol (M-98). A kártya mérete a `:root`
 * custom propertyje, amit a `GraphNodeCardSizeStyle` a méret konstansból ír
 * (SPEC-008 5.7), így a szám nem duplikálódik a tesztben.
 */
interface CanvasGeometry {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly translateX: number;
  readonly translateY: number;
  readonly zoom: number;
  readonly cardWidth: number;
  readonly cardHeight: number;
}

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

function edgeLocator(page: Page, edgeId: string): Locator {
  return page.getByTestId(`rf__edge-${edgeId}`);
}

function addNodeMenu(page: Page): Locator {
  return page.getByRole('menu', { name: 'Hozzáadás' });
}

function unsavedIndicator(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' });
}

async function requireBoundingBox(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem talált mérhető dobozt a locatorhoz');
  }
  return box;
}

async function readCanvasGeometry(page: Page): Promise<CanvasGeometry> {
  return page.getByTestId('rf__wrapper').evaluate((wrapper) => {
    const renderer = wrapper.querySelector('.react-flow__renderer');
    const viewport = wrapper.querySelector('.react-flow__viewport');
    if (!(renderer instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
      throw new TypeError('a vászon nem tartalmazza a React Flow renderer és viewport elemét');
    }
    const matrix = new DOMMatrixReadOnly(viewport.style.transform);
    const rootStyle = getComputedStyle(document.documentElement);
    const wrapperRectangle = wrapper.getBoundingClientRect();
    return {
      left: wrapperRectangle.left,
      top: wrapperRectangle.top,
      width: renderer.offsetWidth,
      height: renderer.offsetHeight,
      translateX: matrix.e,
      translateY: matrix.f,
      zoom: matrix.a,
      cardWidth: Number(rootStyle.getPropertyValue('--graph-node-card-width').trim().replace(/px$/, '')),
      cardHeight: Number(rootStyle.getPropertyValue('--graph-node-card-height').trim().replace(/px$/, '')),
    };
  });
}

/**
 * A csomópont flow koordinátás helye: a React Flow a node elem inline
 * `transform` stílusába írja (`translate(<x>px,<y>px)`, a `positionAbsolute`).
 */
async function readNodeFlowPosition(node: Locator): Promise<Point> {
  return node.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new TypeError('a csomópont eleme nem HTML elem');
    }
    const matrix = new DOMMatrixReadOnly(element.style.transform);
    return { x: matrix.e, y: matrix.f };
  });
}

/**
 * A vásznon álló csomópontok azonosítója a React Flow `data-id`
 * attribútumából. A felvett csomópont azonosítója a böngészőben keletkezik
 * (`crypto.randomUUID()`), tehát a teszt csak a DOM-ból tudja meg.
 */
async function readNodeIds(page: Page): Promise<readonly string[]> {
  return page
    .locator('.react-flow__node')
    .evaluateAll((elements) => elements.map((element) => element.dataset['id'] ?? ''));
}

async function locateAddedNode(page: Page, knownIds: readonly string[]): Promise<Locator> {
  await expect
    .poll(async () => {
      const ids = await readNodeIds(page);
      return ids.length;
    })
    .toBe(knownIds.length + 1);
  const ids = await readNodeIds(page);
  const addedIds = ids.filter((id) => !knownIds.includes(id));
  const [addedId] = addedIds;
  if (addedId === undefined || addedIds.length !== 1) {
    throw new Error('a teszt nem pontosan egy új csomópontot talált');
  }
  return nodeLocator(page, addedId);
}

function expectPointInsideBox(point: Point, box: Box): void {
  expect(point.x).toBeGreaterThanOrEqual(box.x);
  expect(point.x).toBeLessThanOrEqual(box.x + box.width);
  expect(point.y).toBeGreaterThanOrEqual(box.y);
  expect(point.y).toBeLessThanOrEqual(box.y + box.height);
}

function expectBoxInsideBox(inner: Box, outer: Box): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
}

/**
 * Az API origin kérései: a felvétel helyi művelet, tehát a betöltés három
 * kérése után egy sem jöhet (SPEC-008 78. kritérium).
 */
function recordApiRequests(page: Page): readonly string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().startsWith(`${API_ORIGIN}/api/`)) {
      requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return requests;
}

/**
 * Egy üres vászon pont a jobb felső negyedben, egész pixelre kerekítve, hogy a
 * `contextmenu` esemény `clientX`/`clientY` értéke pontosan ez a pont legyen.
 */
function emptyPanePoint(canvasBox: Box): Point {
  return {
    x: Math.round(canvasBox.x + canvasBox.width * 0.75),
    y: Math.round(canvasBox.y + canvasBox.height * 0.2),
  };
}

/**
 * A teszt lapján lefutott `contextmenu` események `defaultPrevented` értéke,
 * sorrendben (a `reportContextMenuDefaultPrevented` gyűjti, tesztenként ürítve).
 */
const contextMenuDefaultPrevented: boolean[] = [];

function readDefaultPrevented(): readonly boolean[] {
  return [...contextMenuDefaultPrevented];
}

async function openEditor(page: Page): Promise<void> {
  await page.goto(EDITOR_URL);
  await expect(edgeLocator(page, 'e1')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a "Hozzáadás" gomb útján az új kártya közepe a látható vászon középpontja a store width, height és transform mezőjéből (M-99), a panel megnyílása után is a vásznon belül, kiválasztva, kérés nélkül', async ({
  page,
}) => {
  const apiRequests = recordApiRequests(page);
  await openEditor(page);
  await expect.poll(() => apiRequests.length).toBe(3);
  const knownIds = await readNodeIds(page);

  await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
  await expect(addNodeMenu(page)).toBeVisible();
  const canvasBox = await requireBoundingBox(page.getByTestId('rf__wrapper'));
  const geometry = await readCanvasGeometry(page);
  // A `fitView` két csomópontot illeszt be, tehát a nagyítás nem 1: a
  // középpont képletének osztása ezen a futáson ténylegesen hat.
  expect(geometry.zoom).not.toBe(1);
  await addNodeMenu(page).getByRole('menuitem', { name: 'Agent lépés', exact: true }).click();

  const node = await locateAddedNode(page, knownIds);
  await expect(node).toHaveClass(/selected/);
  await expect(page.getByRole('complementary', { name: 'Agent lépés beállításai' })).toBeVisible();
  await expect(unsavedIndicator(page)).toBeVisible();

  // M-99: a gomb a store három mezőjéből számolt; ha a mezők nem a vászon
  // méretét és a nézet `[x, y, zoom]` alakját hordoznák, a hely eltérne a
  // DOM-ból olvasott értékeken futtatott képlettől (SPEC-008 5.8, M-98).
  const position = await readNodeFlowPosition(node);
  expect(position.x).toBeCloseTo(
    (geometry.width / 2 - geometry.translateX) / geometry.zoom - geometry.cardWidth / 2,
    1,
  );
  expect(position.y).toBeCloseTo(
    (geometry.height / 2 - geometry.translateY) / geometry.zoom - geometry.cardHeight / 2,
    1,
  );

  // 77. kritérium: a választáskor látható vászon középpontja az új kártya
  // befoglaló dobozán belül esik.
  const cardBox = await requireBoundingBox(node);
  expectPointInsideBox({ x: canvasBox.x + canvasBox.width / 2, y: canvasBox.y + canvasBox.height / 2 }, cardBox);

  // A beállítás panel megnyílása után a vászon keskenyebb, a kártya teljes
  // doboza mégis a vászon látható dobozán belül marad.
  await expect
    .poll(async () => {
      const narrowedCanvasBox = await requireBoundingBox(page.getByTestId('rf__wrapper'));
      return narrowedCanvasBox.width;
    })
    .toBeLessThan(canvasBox.width);
  expectBoxInsideBox(await requireBoundingBox(node), await requireBoundingBox(page.getByTestId('rf__wrapper')));
  expect(apiRequests).toHaveLength(3);
});

test('a jobb klikk útján az új kártya bal felső sarka a kattintás pontja (screenToFlowPosition a valós vásznon), a menü a választás után bezárul, a csomópont kiválasztva, kérés nélkül', async ({
  page,
}) => {
  const apiRequests = recordApiRequests(page);
  await openEditor(page);
  await expect.poll(() => apiRequests.length).toBe(3);
  const knownIds = await readNodeIds(page);
  const canvasBox = await requireBoundingBox(page.getByTestId('rf__wrapper'));
  const geometry = await readCanvasGeometry(page);
  const clickPoint = emptyPanePoint(canvasBox);

  await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
  await expect(addNodeMenu(page).getByRole('menuitem')).toHaveText(ADDABLE_NODE_LABELS);
  await addNodeMenu(page).getByRole('menuitem', { name: 'Agent lépés', exact: true }).click();
  await expect(addNodeMenu(page)).toBeHidden();

  const node = await locateAddedNode(page, knownIds);
  await expect(node).toHaveClass(/selected/);
  await expect(page.getByRole('complementary', { name: 'Agent lépés beállításai' })).toBeVisible();
  await expect(unsavedIndicator(page)).toBeVisible();

  // A flow koordináta a könyvtár saját átváltása a kattintás kliens pontján
  // (M-98): `(pont - a vászon bal felső sarka - eltolás) / nagyítás`.
  const position = await readNodeFlowPosition(node);
  expect(position.x).toBeCloseTo((clickPoint.x - geometry.left - geometry.translateX) / geometry.zoom, 1);
  expect(position.y).toBeCloseTo((clickPoint.y - geometry.top - geometry.translateY) / geometry.zoom, 1);

  // 76. kritérium: a kártya bal felső sarka a kattintás pontja, tehát a pont
  // a kártya dobozának sarkán, a dobozon belül áll.
  const cardBox = await requireBoundingBox(node);
  expect(cardBox.x).toBeCloseTo(clickPoint.x, 0);
  expect(cardBox.y).toBeCloseTo(clickPoint.y, 0);
  expect(clickPoint.x).toBeLessThan(cardBox.x + cardBox.width);
  expect(clickPoint.y).toBeLessThan(cardBox.y + cardBox.height);
  expect(apiRequests).toHaveLength(3);
});

// 75. kritérium, mindkét témában: a böngésző saját menüje helyett a felvételi
// menü (a vászon kezelője `preventDefault()`-ot hív), csomóponton és élen nem
// nyílik, és az `Escape`, illetve a kívülre kattintás felvétel nélkül zárja.
for (const theme of ['light', 'dark'] as const) {
  test.describe(`a jobb klikk menü, ${theme} téma`, () => {
    test.use({ colorScheme: theme });

    test.beforeEach(async ({ page }) => {
      contextMenuDefaultPrevented.length = 0;
      await page.exposeFunction('reportContextMenuDefaultPrevented', (wasDefaultPrevented: boolean) => {
        contextMenuDefaultPrevented.push(wasDefaultPrevented);
      });
      await page.addInitScript((mode: string) => {
        globalThis.localStorage.setItem('eggTheme', mode);
        globalThis.addEventListener('contextmenu', (event) => {
          void globalThis.reportContextMenuDefaultPrevented?.(event.defaultPrevented);
        });
      }, theme);
      await openEditor(page);
      if (theme === 'dark') {
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      } else {
        await expect(page.locator('html')).not.toHaveAttribute('data-theme');
      }
    });

    test('a vászon üres területén a böngésző menüje helyett a felvételi menü nyílik, az Escape és a kívülre kattintás felvétel nélkül zárja', async ({
      page,
    }) => {
      const knownIds = await readNodeIds(page);
      const canvasBox = await requireBoundingBox(page.getByTestId('rf__wrapper'));
      const clickPoint = emptyPanePoint(canvasBox);
      const menu = addNodeMenu(page);

      await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
      await expect.poll(readDefaultPrevented).toEqual([true]);
      await expect(menu).toBeInViewport({ ratio: 1 });
      await expect(menu.getByRole('menuitem')).toHaveText(ADDABLE_NODE_LABELS);
      await expect(menu.getByRole('menuitem', { name: 'Agent lépés', exact: true })).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();

      await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
      await expect.poll(readDefaultPrevented).toEqual([true, true]);
      await expect(menu).toBeVisible();
      // A menün kívüli bal klikk a vászon egy másik üres pontján.
      await page.mouse.click(clickPoint.x, Math.round(canvasBox.y + canvasBox.height * 0.1));
      await expect(menu).toBeHidden();

      expect(await readNodeIds(page)).toEqual(knownIds);
      await expect(unsavedIndicator(page)).toBeHidden();
    });

    test('egy menüpont választása után a menü bezárul, és a választott csomópont felkerül a vászonra (AC75)', async ({
      page,
    }) => {
      const knownIds = await readNodeIds(page);
      const clickPoint = emptyPanePoint(await requireBoundingBox(page.getByTestId('rf__wrapper')));
      const menu = addNodeMenu(page);

      await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name: 'Elágazás', exact: true }).click();

      await expect(menu).toBeHidden();
      const node = await locateAddedNode(page, knownIds);
      await expect(node).toHaveClass(/selected/);
    });

    test('csomóponton és élen a jobb klikk nem nyit menüt és nem tiltja a böngésző menüjét, a vászon üres területén ugyanabban a futásban igen', async ({
      page,
    }) => {
      const menu = addNodeMenu(page);

      await nodeLocator(page, 'n2').click({ button: 'right' });
      await expect.poll(readDefaultPrevented).toEqual([false]);
      await expect(menu).toBeHidden();

      await edgeLocator(page, 'e1').click({ button: 'right' });
      await expect.poll(readDefaultPrevented).toEqual([false, false]);
      await expect(menu).toBeHidden();

      // Kontroll: ugyanaz a figyelő a vászon üres területén a tiltást és a
      // menüt is látja, tehát a fenti két `false` nem a mérés vaksága.
      const clickPoint = emptyPanePoint(await requireBoundingBox(page.getByTestId('rf__wrapper')));
      await page.mouse.click(clickPoint.x, clickPoint.y, { button: 'right' });
      await expect.poll(readDefaultPrevented).toEqual([false, false, true]);
      await expect(menu).toBeVisible();
    });
  });
}
