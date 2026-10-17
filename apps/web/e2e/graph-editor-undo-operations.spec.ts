// A visszavonás és az újra elvégzés a hét művelettípusra, valós Chromiumban
// (PLAN-009 T-009-53, SPEC-008 5.10, 101. és 103. kritérium): minden művelet
// után a `Ctrl+Z` és a Visszavonás gomb pontosan a művelet előtti, a
// `Ctrl+Shift+Z`, a `Ctrl+Y` és az Újra gomb pontosan a művelet utáni
// dokumentumot állítja vissza, a vászon (a csomópontok azonosítója és pozíciója,
// az élek azonosítója és végpontjai) és a mentés `PUT` törzse szerint. Itt áll a
// két gomb sorrendje, tiltott állapota és a tipp egérrel elérhetősége (WCAG 2.2
// 1.4.13) is. A mező menete és natív visszavonása a
// `graph-editor-undo-field.spec.ts`, az elvetés menüpontja és az elnavigálás a
// `graph-editor-discard-navigation.spec.ts` fájlban áll.
//
// A `PUT` törzs olvasása sikertelen mentéssel megy (a mock 500-at ad): a
// sikertelen mentés a két listát nem érinti (SPEC-008 5.10), tehát a történetben
// a mentés után is tovább lehet lépni. A felvett csomópont utáni állapot nem
// menthető, mert a kezdő konfig kötelező mezői üresek (81. kritérium), ezért ott a
// vászon a bizonyíték (docs/research/2026-10-14-csomopont-felvetel.md, T-009-53).
import {
  ReplaceGraphRequestSchema,
  type NodeConfig,
  type ReplaceGraphRequest,
  type SettingsRecord,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { API_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';
import { WINDOWS_CHROME_USER_AGENT } from './user-agent.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

/**
 * Érvényes (menthető) konfig: a kezeletlen hiba szabálya kitöltve (O-29).
 */
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

// Átlós elrendezés, a `graph-node-delete.spec.ts` fixtúrájával azonos: a vászon
// jobb felső negyede üres (a jobb klikk menü helye), és minden csomópontnak
// van éle, tehát a törlés az éleit is viszi.
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
      positionX: 500,
      positionY: 240,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n3',
      type: 'agent_step',
      label: 'Válasz elküldése',
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
    {
      id: 'e2',
      sourceNodeId: 'n2',
      targetNodeId: 'n3',
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

/**
 * A betöltött gráf a mentés kérés alakjában: a szerver időbélyegei nélkül.
 */
const LOADED_DOCUMENT: ReplaceGraphRequest = {
  nodes: GRAPH.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    label: node.label,
    positionX: node.positionX,
    positionY: node.positionY,
    config: node.config,
  })),
  edges: GRAPH.edges.map((edge) => ({
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    branchKey: edge.branchKey,
  })),
};

const EDITOR_URL = '/editor?workflowId=w-alfa';

// A fájl a `Ctrl` módosítót méri: az Automatikus beállítás a felhasználói
// ügynökből old fel (SPEC-008 5.10, O-31), ezért az ügynök nem macOS értékre
// van rögzítve.
test.use({ userAgent: WINDOWS_CHROME_USER_AGENT });

/**
 * A teszt mockjainak állapota: a mentés kérések törzse és az API origin minden
 * kérése a betöltéstől kezdve.
 */
interface EditorTraffic {
  readonly savedBodies: string[];
  readonly apiRequests: string[];
}

interface EditorMockOptions {
  /**
   * Ha meg van adva, a gráf betöltése erre vár (a betöltés alatti állapot).
   */
  readonly graphGate?: Promise<undefined>;
  /**
   * Ha meg van adva, a mentés erre várva SIKERES; különben a mentés 500-at ad,
   * és a két lista érintetlen marad (SPEC-008 5.10).
   */
  readonly putGate?: Promise<undefined>;
}

/**
 * A sikeres mentés válasza: a kérés törzse a szerver időbélyegeivel.
 */
function savedGraphResponse(body: string): WorkflowGraphDocument {
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(body));
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return {
    nodes: parsed.data.nodes.map((node) => ({ ...node, createdAtMs: 1, updatedAtMs: 1 })),
    edges: parsed.data.edges.map((edge) => ({ ...edge, createdAtMs: 1 })),
  };
}

async function installEditorMocks(page: Page, options: EditorMockOptions = {}): Promise<EditorTraffic> {
  const traffic: EditorTraffic = { savedBodies: [], apiRequests: [] };
  page.on('request', (request) => {
    if (request.url().startsWith(API_ORIGIN)) {
      traffic.apiRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => {
      await options.graphGate;
      await route.fulfill(jsonBody(GRAPH));
    }),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      const body = route.request().postData() ?? '';
      traffic.savedBodies.push(body);
      if (options.putGate === undefined) {
        await route.fulfill(
          jsonBody({ code: 'internal_error', message: 'a teszt mentése szándékosan sikertelen' }, 500),
        );
        return;
      }
      await options.putGate;
      await route.fulfill(jsonBody(savedGraphResponse(body)));
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  return traffic;
}

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

/**
 * A várakozás jelzés elemei (SPEC-008 9. szekció): a nem async pontok (AC94) után
 * egyik sem állhat a lapon.
 */
const BUSY_INDICATOR_SELECTOR = '[aria-busy="true"], .is-loading, .progress-bar, [role="progressbar"], .skel';

/**
 * A REST kérések (`/api/` alatt) száma a teszt saját mentés-olvasásai (`PUT`, lásd
 * `readSavedDocument`) nélkül. Az SSE csatorna (`/events`) újracsatlakozása nem
 * REST kérés, a `PUT` pedig a teszt eszköze: az alkalmazás saját, váratlan mentését
 * a `readSavedDocument` kérés számlálója (`requestsBefore + 1`) fogja meg.
 */
function restRequestCount(traffic: EditorTraffic): number {
  return traffic.apiRequests.filter((request) => request.includes(` ${API_ORIGIN}/api/`) && !request.startsWith('PUT '))
    .length;
}

/**
 * A nem async pont bizonyítéka (AC94): a betöltés óta nem indult REST kérés, és
 * nincs várakozás jelzés a lapon.
 */
async function expectNoAsyncActivity(page: Page, traffic: EditorTraffic, loadedRequestCount: number): Promise<void> {
  expect(restRequestCount(traffic)).toBe(loadedRequestCount);
  await expect(page.locator(BUSY_INDICATOR_SELECTOR)).toHaveCount(0);
}

function undoButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Visszavonás', exact: true });
}

function redoButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Újra', exact: true });
}

function unsavedIndicator(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' });
}

async function requireBoundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem talált mérhető dobozt a locatorhoz');
  }
  return box;
}

async function openEditor(page: Page): Promise<void> {
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__edge-e2')).toBeAttached();
}

/**
 * A vászon tartalma a DOM sorrendjében: a csomópont azonosítója és a React Flow
 * által írt pozíció (`transform`, folyam koordinátában, tehát a nagyítástól és a
 * pásztázástól független), az él azonosítója és a könyvtár hozzáférhető neve,
 * ami a két végpontot nevezi meg ("Edge from n1 to n2").
 */
interface CanvasSnapshot {
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
}

async function readCanvas(page: Page): Promise<CanvasSnapshot> {
  return page.getByTestId('rf__wrapper').evaluate((wrapper) => ({
    nodes: [...wrapper.querySelectorAll('.react-flow__node')].map((node) =>
      node instanceof HTMLElement ? `${node.dataset['id'] ?? ''} ${node.style.transform}` : '',
    ),
    edges: [...wrapper.querySelectorAll('.react-flow__edge')].map((edge) =>
      edge instanceof SVGElement ? `${edge.dataset['id'] ?? ''} ${edge.getAttribute('aria-label') ?? ''}` : '',
    ),
  }));
}

/**
 * A vászon tartalma, miután két egymás utáni olvasás egyezik: egy művelet utáni
 * köztes render (például a csomópont mérése utáni él) ne kerüljön a várt
 * állapotba.
 */
async function readSettledCanvas(page: Page): Promise<CanvasSnapshot> {
  let previous = '';
  let latest: CanvasSnapshot = { nodes: [], edges: [] };
  await expect
    .poll(async () => {
      latest = await readCanvas(page);
      const serialized = JSON.stringify(latest);
      const isSettled = serialized === previous;
      previous = serialized;
      return isSettled;
    })
    .toBe(true);
  return latest;
}

/**
 * A "Mentés" gomb megnyomása után a `PUT` törzs, a kérés sémája szerint. A mock
 * 500-at ad, tehát a két lista érintetlen; a hibát jelző értesítés bezárul, hogy
 * a lábléc gombjait ne takarja. A gomb kattintása a fókuszált mezőt elhagyja,
 * tehát a nyitott mező menet lezárul (SPEC-008 5.10).
 */
async function readSavedDocument(page: Page, traffic: EditorTraffic): Promise<ReplaceGraphRequest> {
  const requestsBefore = traffic.savedBodies.length;
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect.poll(() => traffic.savedBodies.length).toBe(requestsBefore + 1);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('A mentés sikertelen')).toHaveCount(0);
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(traffic.savedBodies[requestsBefore] ?? 'null'));
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

/**
 * Valódi egérhúzás egy React Flow fogódzóról egy másikra, a
 * `graph-editor-validation.spec.ts` mintájára: néhány közbenső `mousemove` a
 * könyvtár `connectionDragThreshold` küszöbe fölé.
 */
async function dragConnection(page: Page, sourceNodeId: string, targetNodeId: string): Promise<void> {
  const source = await requireBoundingBox(
    nodeLocator(page, sourceNodeId).locator('.react-flow__handle[aria-label="Kimenet"]'),
  );
  const target = await requireBoundingBox(
    nodeLocator(page, targetNodeId).locator('.react-flow__handle[aria-label="Bemenet"]'),
  );
  const from = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const to = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (to.x - from.x) / 2, from.y + (to.y - from.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

async function chooseFromMoreActions(page: Page, itemName: string): Promise<void> {
  await page.getByRole('button', { name: 'További műveletek' }).click();
  await page.getByRole('menuitem', { name: itemName }).click();
}

/**
 * Egy szerkesztési állapot: a vászon, a `PUT` törzs (ha menthető) és a mentetlen
 * jelző.
 */
interface DocumentState {
  readonly canvas: CanvasSnapshot;
  readonly saved: ReplaceGraphRequest | undefined;
  readonly isDirty: boolean;
}

interface OperationCase {
  readonly name: string;
  /**
   * A művelet előtti, már mentetlen változás (az elvetésnél).
   */
  readonly prepare?: (page: Page) => Promise<void>;
  readonly perform: (page: Page, traffic: EditorTraffic) => Promise<void>;
  /**
   * Menthető-e a művelet utáni dokumentum (a felvett csomópont kötelező mezői
   * üresek, 81. kritérium).
   */
  readonly isAfterSaveable: boolean;
  readonly isBeforeDirty: boolean;
  readonly isAfterDirty: boolean;
}

async function addScriptNodeFromMenu(page: Page): Promise<void> {
  await page.getByRole('menu', { name: 'Hozzáadás' }).getByRole('menuitem', { name: 'Szkript' }).click();
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
}

async function deleteNodeWithKeyboard(page: Page, nodeId: string): Promise<void> {
  await nodeLocator(page, nodeId).click();
  await page.keyboard.press('Delete');
  await expect(nodeLocator(page, nodeId)).toBeAttached({ attached: false });
}

const OPERATION_CASES: readonly OperationCase[] = [
  {
    name: 'felvétel a "Hozzáadás" gombbal',
    perform: async (page) => {
      await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
      await addScriptNodeFromMenu(page);
    },
    isAfterSaveable: false,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'felvétel a jobb klikk menüvel',
    perform: async (page) => {
      // A vászon jobb felső negyede üres: a fixtúra átlós.
      const wrapperBox = await requireBoundingBox(page.getByTestId('rf__wrapper'));
      await page.mouse.click(wrapperBox.x + wrapperBox.width * 0.8, wrapperBox.y + wrapperBox.height * 0.2, {
        button: 'right',
      });
      await addScriptNodeFromMenu(page);
    },
    isAfterSaveable: false,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'törlés billentyűvel (a csomópont az élével együtt egy lépés)',
    perform: async (page) => {
      await deleteNodeWithKeyboard(page, 'n3');
      await expect(page.getByTestId('rf__edge-e2')).toBeAttached({ attached: false });
    },
    isAfterSaveable: true,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'törlés a "Törlés" gombbal',
    perform: async (page) => {
      await nodeLocator(page, 'n2').click();
      await page
        .getByRole('complementary', { name: 'Agent lépés beállításai' })
        .getByRole('button', { name: 'Törlés' })
        .click();
      await expect(nodeLocator(page, 'n2')).toBeAttached({ attached: false });
    },
    isAfterSaveable: true,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'él létrehozás',
    perform: async (page) => {
      await dragConnection(page, 'n1', 'n3');
      await expect(page.locator('.react-flow__edge')).toHaveCount(3);
    },
    isAfterSaveable: true,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'mozgatás (egy húzás egy lépés)',
    perform: async (page) => {
      const box = await requireBoundingBox(nodeLocator(page, 'n3'));
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      // Tíz közbenső pozíció változás: egyik sem lépés, csak a húzás vége.
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x, start.y - 300, { steps: 10 });
      await page.mouse.up();
      await expect(unsavedIndicator(page)).toBeVisible();
    },
    isAfterSaveable: true,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'automatikus elrendezés',
    perform: async (page) => {
      await chooseFromMoreActions(page, 'Elrendezés');
      await expect(unsavedIndicator(page)).toBeVisible();
    },
    isAfterSaveable: true,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'a beállítás panel mező változása (a mező menete a mező elhagyásáig egy lépés)',
    perform: async (page) => {
      await nodeLocator(page, 'n2').click();
      const promptField = page
        .getByRole('complementary', { name: 'Agent lépés beállításai' })
        .getByLabel('Prompt sablon');
      await promptField.click();
      await page.keyboard.press('End');
      // Kilenc karakter, kilenc mező változás: a mező elhagyásáig egy lépés. A
      // mezőt a következő mentés gombjának kattintása hagyja el.
      await promptField.pressSequentially(' Röviden.');
      await expect(promptField).toHaveValue('Foglald össze a bemenetet. Röviden.');
    },
    isAfterSaveable: true,
    isBeforeDirty: false,
    isAfterDirty: true,
  },
  {
    name: 'a változtatások elvetése',
    prepare: async (page) => {
      await deleteNodeWithKeyboard(page, 'n3');
    },
    perform: async (page, traffic) => {
      const requestsBefore = traffic.apiRequests.length;
      await chooseFromMoreActions(page, 'Változtatások elvetése');
      await expect(nodeLocator(page, 'n3')).toBeVisible();
      // Megerősítés és hálózati kérés nélkül (104. kritérium).
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(traffic.apiRequests).toHaveLength(requestsBefore);
    },
    isAfterSaveable: true,
    isBeforeDirty: true,
    isAfterDirty: false,
  },
];

/**
 * A történet lépései egy művelet után: mind az öt út (két visszavonó billentyű
 * helyett egy, a `Ctrl+Z`; a Visszavonás gomb; a `Ctrl+Shift+Z`; a `Ctrl+Y`; az
 * Újra gomb) legalább egyszer, felváltva a művelet előtti és utáni állapotba.
 */
interface HistoryStep {
  readonly name: string;
  readonly run: (page: Page) => Promise<void>;
  readonly target: 'before' | 'after';
}

const HISTORY_STEPS: readonly HistoryStep[] = [
  { name: 'Ctrl+Z', run: async (page) => page.keyboard.press('Control+z'), target: 'before' },
  { name: 'Ctrl+Shift+Z', run: async (page) => page.keyboard.press('Control+Shift+Z'), target: 'after' },
  { name: 'a Visszavonás gomb', run: async (page) => undoButton(page).click(), target: 'before' },
  { name: 'Ctrl+Y', run: async (page) => page.keyboard.press('Control+y'), target: 'after' },
  { name: 'Ctrl+Z ismét', run: async (page) => page.keyboard.press('Control+z'), target: 'before' },
  { name: 'az Újra gomb', run: async (page) => redoButton(page).click(), target: 'after' },
];

async function expectDocumentState(page: Page, traffic: EditorTraffic, state: DocumentState): Promise<void> {
  await expect.poll(async () => readCanvas(page)).toEqual(state.canvas);
  await expect(unsavedIndicator(page)).toHaveCount(state.isDirty ? 1 : 0);
  if (state.saved !== undefined) {
    expect(await readSavedDocument(page, traffic)).toEqual(state.saved);
  }
}

for (const operation of OPERATION_CASES) {
  test(`${operation.name}: a Ctrl+Z és a Visszavonás gomb a művelet előtti, a Ctrl+Shift+Z, a Ctrl+Y és az Újra gomb a művelet utáni dokumentumot állítja vissza`, async ({
    page,
  }) => {
    const traffic = await installEditorMocks(page);
    await openEditor(page);
    // A betöltés utáni állapot a viszonyítási pont: nincs várakozás jelzés, és a
    // betöltés kérései a lap egyetlen REST kérései.
    const loadedRequestCount = restRequestCount(traffic);
    // A betöltés három kérése: gráf, workflow, beállítások.
    expect(loadedRequestCount).toBe(3);
    await expectNoAsyncActivity(page, traffic, loadedRequestCount);
    // Horgony: a mentés törzse a betöltött gráf, tehát a törzs olvasása pontos.
    expect(await readSavedDocument(page, traffic)).toEqual(LOADED_DOCUMENT);

    await operation.prepare?.(page);
    const before: DocumentState = {
      canvas: await readSettledCanvas(page),
      saved: await readSavedDocument(page, traffic),
      isDirty: operation.isBeforeDirty,
    };
    await operation.perform(page, traffic);
    await expectNoAsyncActivity(page, traffic, loadedRequestCount);
    const afterCanvas = await readSettledCanvas(page);
    const after: DocumentState = {
      canvas: afterCanvas,
      saved: operation.isAfterSaveable ? await readSavedDocument(page, traffic) : undefined,
      isDirty: operation.isAfterDirty,
    };
    // A művelet a dokumentumot ténylegesen megváltoztatta (a mező változás a
    // vásznon nem látszik, ott a mentés törzse tér el).
    expect([after.canvas, after.saved]).not.toEqual([before.canvas, before.saved]);
    await expect(unsavedIndicator(page)).toHaveCount(after.isDirty ? 1 : 0);

    for (const step of HISTORY_STEPS) {
      await test.step(step.name, async () => {
        await step.run(page);
        const isBefore = step.target === 'before';
        await expectDocumentState(page, traffic, isBefore ? before : after);
        await expectNoAsyncActivity(page, traffic, loadedRequestCount);
        // Egy művelet egy lépés: a művelet előtt csak az elvetés előkészítő
        // lépése áll a visszavonás listán, a művelet után az újra lista üres.
        if (isBefore) {
          await expect(undoButton(page)).toBeEnabled({ enabled: operation.prepare !== undefined });
          await expect(redoButton(page)).toBeEnabled();
        } else {
          await expect(undoButton(page)).toBeEnabled();
          await expect(redoButton(page)).toBeDisabled();
        }
      });
    }
  });
}

test('a lábléc akciósávjában a sorrend: Futás indítása, Visszavonás, Újra, Hozzáadás, a Mentés split button', async ({
  page,
}) => {
  await installEditorMocks(page);
  await openEditor(page);

  const buttonNames = await page
    .locator('.page-footer__actions')
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent.trim()));
  expect(buttonNames).toEqual(['Futás indítása', 'Visszavonás', 'Újra', 'Hozzáadás', 'Mentés', 'További műveletek']);
});

test('betöltés és mentés alatt mindkét gomb tiltott és a billentyű sem hat, sikeres mentés után mindkettő tiltott', async ({
  page,
}) => {
  const graphGate = Promise.withResolvers<undefined>();
  const putGate = Promise.withResolvers<undefined>();
  const traffic = await installEditorMocks(page, { graphGate: graphGate.promise, putGate: putGate.promise });
  await page.goto(EDITOR_URL);

  // Betöltés alatt: a vászon még nincs a lapon, a két gomb tiltott.
  await expect(page.getByRole('button', { name: 'Hozzáadás', exact: true })).toBeDisabled();
  await expect(page.getByTestId('rf__wrapper')).toHaveCount(0);
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();
  graphGate.resolve(undefined);
  await expect(page.getByTestId('rf__edge-e2')).toBeAttached();
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();

  // Két törlés és egy visszavonás: mindkét lista nem üres.
  await deleteNodeWithKeyboard(page, 'n3');
  await deleteNodeWithKeyboard(page, 'n2');
  await page.keyboard.press('Control+z');
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(undoButton(page)).toBeEnabled();
  await expect(redoButton(page)).toBeEnabled();

  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mentés...' })).toBeDisabled();
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();
  // A mentés alatt a billentyű sem von vissza, és az elvetés is tiltott (user
  // döntés 2026-10-16). Ha a billentyű hatna, a két `Ctrl+Z` az `n3`-at
  // visszahozná, és a sikeres mentés után a dokumentum ez maradna.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.getByRole('button', { name: 'További műveletek' }).click();
  await expect(page.getByRole('menuitem', { name: 'Változtatások elvetése' })).toBeDisabled();
  await page.keyboard.press('Escape');
  expect(traffic.savedBodies).toHaveLength(1);

  putGate.resolve(undefined);
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mentés', exact: true })).toBeEnabled();
  await expect(undoButton(page)).toBeDisabled();
  await expect(redoButton(page)).toBeDisabled();
  await expect(unsavedIndicator(page)).toHaveCount(0);
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(nodeLocator(page, 'n3')).toBeAttached({ attached: false });
});

// A tipp egérrel elérhető (WCAG 2.2 1.4.13 "Hoverable", user döntés 2026-10-14,
// `packages/ui/src/tooltip/tooltip-hover-bridge.css`): a gombról a tipp közepére
// húzott egér a 10 px-es résen át halad (két pixeles lépésekkel), és a tipp végig
// nyitva marad. A nyitott tipp a gombsor fölött áll, tehát a lábléc egyik gombját
// sem takarja (research T-009-50 14. szekció nyitott pontja).
const TOOLTIP_CASES = [
  { name: 'Visszavonás', shortcut: 'Ctrl+Z' },
  { name: 'Újra', shortcut: 'Ctrl+Shift+Z / Ctrl+Y' },
] as const;

test('a két gomb tippje egérrel nyílik, a tippre vitt egér alatt nyitva marad, és a lábléc gombjait nem takarja', async ({
  page,
}) => {
  await installEditorMocks(page);
  await openEditor(page);
  // Mindkét lista nem üres, billentyűvel, hogy a fókusz ne a két gombon álljon
  // (a tipp fókuszra is nyílik).
  await deleteNodeWithKeyboard(page, 'n3');
  await deleteNodeWithKeyboard(page, 'n2');
  await page.keyboard.press('Control+z');
  await expect(undoButton(page)).toBeEnabled();
  await expect(redoButton(page)).toBeEnabled();
  const wrapperBox = await requireBoundingBox(page.getByTestId('rf__wrapper'));
  const footerButtons = page.locator('.page-footer__actions').getByRole('button');

  for (const { name, shortcut } of TOOLTIP_CASES) {
    await test.step(name, async () => {
      const button = page.getByRole('button', { name, exact: true });
      const tooltip = page.getByRole('tooltip').filter({ hasText: name });
      await expect(button).not.toBeFocused();
      const buttonBox = await requireBoundingBox(button);
      await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
      await expect(tooltip).toBeVisible();
      await expect(tooltip.locator('kbd')).toHaveText(shortcut);

      // A lábléc minden gombjának közepén a gomb maga az egér célpontja.
      const hitButtons = await footerButtons.evaluateAll((buttons) =>
        buttons.map((footerButton) => {
          const box = footerButton.getBoundingClientRect();
          const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return hit !== null && footerButton.contains(hit);
        }),
      );
      expect(hitButtons).toEqual([true, true, true, true, true, true]);

      const tooltipBox = await requireBoundingBox(tooltip);
      await page.mouse.move(tooltipBox.x + tooltipBox.width / 2, tooltipBox.y + tooltipBox.height / 2, { steps: 20 });
      await expect(tooltip).toBeVisible();
      const pointerState = await tooltip.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        return { isHovered: element.matches(':hover'), isPointerOnTooltip: hit !== null && element.contains(hit) };
      });
      expect(pointerState).toEqual({ isHovered: true, isPointerOnTooltip: true });

      // Az egér kivitele a burkolóból zár.
      await page.mouse.move(wrapperBox.x + 10, wrapperBox.y + 10);
      await expect(tooltip).toBeHidden();
    });
  }
});
