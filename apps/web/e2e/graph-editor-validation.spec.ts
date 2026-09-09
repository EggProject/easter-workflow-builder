// Regressziós e2e a mentés előtti validáció, a kapcsolat húzás szabályai és
// az él leképezés témáira (SPEC-008 5.4, 5.5, T-009-17): `is-valid-
// connection.ts` és `validate-graph-for-save.ts` e2e lefedettsége korábban 0
// százalék, a `graph-editor-edge-mapping.ts`-é 33,33 százalék volt, mert a
// `graph-editor.spec.ts` egyetlen tesztje sem húzott új élt és nem kattintott
// a "Mentés" gombra.
//
// A `validateGraphForSave` HIBA ágát (a `ReplaceGraphRequestSchema` elutasít)
// szándékosan NEM próbálja ez a fájl valódi felhasználói úton előidézni: a
// `node-config` sémák egyikében sincs `regex`/`min`/`max`/`positive`
// korlátozás (saját grep-pel igazolva), az egyetlen elméleti forrás (egy
// `NaN` a `maxIterations` számmezőn) pedig a natív `<input type="number">`
// böngésző szintű bemenet-tisztítása miatt sosem jut el a React állapotig -
// ezt maga a kódbázis is dokumentálja (`LoopNodeFields.tsx` és
// `nullable-number-field-value.ts` fejléc komment). Ez az ág ezért marad
// unit teszt only (`validate-graph-for-save.spec.ts`).
import { ReplaceGraphRequestSchema } from '@easter-workflow-builder/protocol';
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

const LOOP_CONFIG: NodeConfig = {
  type: 'loop',
  maxIterations: 3,
  continueExpression: 'i < 3',
  onUnhandledError: null,
};

/**
 * Négy csomópont, átlós elrendezésben (a vízszintes él nulla magas
 * befoglaló doboza miatt, lásd `graph-editor.spec.ts` fejléc komment):
 * `n-start` (nincs bemenő handle-je), két `agent_step` és egy `loop` (két
 * elnevezett kimenő handle-lel, "Folytatás"/"Kilépés") - ez utóbbi kell a
 * `flowEdgeToWorkflowEdge` `sourceHandle ?? null` NEM null ágának eléréséhez.
 */
const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent-a',
      type: 'agent_step',
      label: 'Első lépés',
      positionX: 500,
      positionY: 240,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent-b',
      type: 'agent_step',
      label: 'Második lépés',
      positionX: 1000,
      positionY: 480,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-loop',
      type: 'loop',
      label: 'Ciklus',
      positionX: 500,
      positionY: 720,
      config: LOOP_CONFIG,
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
 * Lásd `graph-editor.spec.ts` azonos nevű függvénye.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

/**
 * A React Flow `Handle` egy sima `<div>`: nincs `role`-ja (a szerző adta
 * `aria-label`-t leszámítva) és nincs `rf__` előtagú testid-je sem - a
 * telepített `@xyflow/react@12.11.6` forrásában csak a node/edge/controls/
 * minimap/background/wrapper elemek kapnak ilyet, saját olvasással igazolva.
 * A `getByRole` és a `getByTestId` ezért egyaránt kizárt; a locator sorrend
 * szerint indokolt CSS a maradék lehetőség, a legfelhasználó-közelibb
 * formában: a saját `aria-label` propunk értékén, a node kártyára szűkítve.
 */
function handleLocator(page: Page, nodeId: string, ariaLabel: string): Locator {
  return nodeLocator(page, nodeId).locator(`.react-flow__handle[aria-label="${ariaLabel}"]`);
}

async function requireBoundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem talált mérhető dobozt a locatorhoz');
  }
  return box;
}

async function handleCenter(page: Page, nodeId: string, ariaLabel: string): Promise<{ x: number; y: number }> {
  const locator = handleLocator(page, nodeId, ariaLabel);
  await expect(locator).toBeVisible();
  const box = await requireBoundingBox(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Valódi egérhúzás egy React Flow handle-ről egy célpontra: `mousedown` a
 * forráson, néhány közbenső `mousemove` (a könyvtár 1px-es
 * `connectionDragThreshold`-ja fölé), majd `mouseup` a célon. A handle
 * `className`-je tartalmazza a `nodrag` osztályt (saját olvasással igazolva
 * a telepített csomag forrásában), tehát ez sosem indít node mozgatást.
 */
async function dragConnection(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + (to.x - from.x) / 2, from.y + (to.y - from.y) / 2, { steps: 5 });
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
});

test('érvényes kapcsolat bemenő handle-lel rendelkező célra új élt hoz létre, az ismételt húzás pedig nem duplikál', async ({
  page,
}) => {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-agent-b')).toBeVisible();

  const edges = page.locator('.react-flow__edge');
  await expect(edges).toHaveCount(1);

  const source = await handleCenter(page, 'n-agent-a', 'Kimenet');
  const target = await handleCenter(page, 'n-agent-b', 'Bemenet');

  await dragConnection(page, source, target);
  await expect(edges).toHaveCount(2);

  // Ugyanaz a forrás, handle és cél - az `isValidGraphConnection` a
  // duplikációt utasítja el, nem jön létre harmadik él.
  await dragConnection(page, source, target);
  await expect(edges).toHaveCount(2);
});

// MÉRÉSSEL IGAZOLT TERMÉKKÓD HIÁNYOSSÁG (nem javítjuk, csak jelezzük - lásd a
// feladat jelentése): egy él kattintással NEM válaszható ki ebben a
// vezérelt vásznon, tehát `Backspace`-szel sem törölhető. Saját méréssel
// igazolva: kattintás UTÁN a `rf__edge-e1` `class` attribútuma változatlanul
// `"react-flow__edge react-flow__edge-default nopan selectable"` marad, a
// könyvtár SOSEM adja hozzá a `selected` osztályt. Az ok a `GraphEditorCanvas`
// domain kör-útjában van: a node kiválasztás (`selectedNodeId`) explicit
// vissza van írva a `displayedNodes`-ba (`node.id === selectedNodeId`), az
// ÉL kiválasztásához viszont nincs `onEdgeClick` és nincs hasonló
// visszaírás - a `flowEdgeToWorkflowEdge`/`workflowEdgeToFlowEdge` kör-út
// (`graph-editor-edge-mapping.ts`) nem hordozza tovább a React Flow saját
// `selected` mezőjét, tehát egy esetleges belső kiválasztás azonnal
// elveszne a következő renderen. Emiatt a `GraphEditorCanvas.tsx`
// `onEdgesChange` callback törzse (a `remove`/`select` típusú változásokat
// ténylegesen alkalmazó ág) jelenleg NINCS bekötve semmilyen felületi úthoz,
// tehát e2e-vel nem elérhető - ez nem tesztírási hiányosság, hanem a
// termékkód hiányzó funkciója.

test('a bemenő handle nélküli (start) csomópontra irányuló húzás nem hoz létre élt', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-start')).toBeVisible();

  const edges = page.locator('.react-flow__edge');
  await expect(edges).toHaveCount(1);

  const source = await handleCenter(page, 'n-agent-a', 'Kimenet');
  // A `start` node nem rajzol bemenő handle-t (`hasInputHandle: false`),
  // tehát a kártya TESTÉRE húzunk - a React Flow alapértelmezett `strict`
  // `connectionMode`-ja mellett ide nincs mire csatlakozni.
  const startBox = await requireBoundingBox(nodeLocator(page, 'n-start'));
  const target = { x: startBox.x + startBox.width / 2, y: startBox.y + startBox.height / 2 };

  await dragConnection(page, source, target);
  await expect(edges).toHaveCount(1);
});

test('a "Bezárás" gomb bezárja a csomópont beállítás panelt', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);

  await nodeLocator(page, 'n-agent-a').click();
  const closeButton = page.getByRole('button', { name: 'Bezárás' });
  await expect(closeButton).toBeVisible();

  await closeButton.click();
  await expect(closeButton).toBeHidden();

  // Az üres vászonra (`react-flow__pane`) kattintás is bezárja a panelt
  // (`onPaneClick` -> `onSelectNode(undefined)`, `GraphEditorCanvas.tsx`).
  // A `fitView` a csomópontok köré térközt hagy, a bal felső sarok ezért
  // üres pane terület.
  await nodeLocator(page, 'n-agent-a').click();
  await expect(closeButton).toBeVisible();
  const paneBox = await requireBoundingBox(page.locator('.react-flow__pane'));
  await page.mouse.click(paneBox.x + 10, paneBox.y + 10);
  await expect(closeButton).toBeHidden();
});

test('a ciklus csomópont elnevezett kimenetéről induló kapcsolat mentéskor a branchKey mezőt is helyesen tölti ki', async ({
  page,
}) => {
  const captured: { body: unknown } = { body: undefined };
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      captured.body = route.request().postDataJSON();
      const parsed = ReplaceGraphRequestSchema.safeParse(captured.body);
      if (!parsed.success) {
        throw new Error('a teszt PUT törzse nem felel meg a ReplaceGraphRequestSchema-nak');
      }
      await route.fulfill(
        jsonBody({
          nodes: parsed.data.nodes.map((node) => ({ ...node, createdAtMs: 1, updatedAtMs: 1 })),
          edges: parsed.data.edges.map((edge) => ({ ...edge, createdAtMs: 1 })),
        }),
      );
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-loop')).toBeVisible();

  const source = await handleCenter(page, 'n-loop', 'Folytatás');
  const target = await handleCenter(page, 'n-agent-b', 'Bemenet');
  await dragConnection(page, source, target);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  await page.getByRole('button', { name: /^Mentés/ }).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();

  const parsedBody = ReplaceGraphRequestSchema.safeParse(captured.body);
  if (!parsedBody.success) {
    throw new Error('a teszt PUT törzse nem felel meg a ReplaceGraphRequestSchema-nak');
  }
  const newEdge = parsedBody.data.edges.find(
    (edge) => edge.sourceNodeId === 'n-loop' && edge.targetNodeId === 'n-agent-b',
  );
  expect(newEdge?.sourceHandle).toBe('continue');
  expect(newEdge?.branchKey).toBe('continue');

  // Sikeres mentés után a baseline frissül, a gráf már nem piszkos.
  await expect(page.getByRole('status')).toBeHidden();
});

test('mentés közben a gomb "Mentés..." feliratot mutat, amíg a válasz nem érkezik meg', async ({ page }) => {
  // A `Promise<undefined>` illeszkedik a `route.fulfill` előtti `await`
  // szerződésre, és elkerüli a `no-invalid-void-type` szabályt (lásd
  // `packages/engine/src/run-interrupt/interrupt-live-agent-queries.spec.ts`
  // azonos mintája).
  const { promise: putGate, resolve: resolvePut } = Promise.withResolvers<undefined>();
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      await putGate;
      await route.fulfill(jsonBody(GRAPH));
    }),
  ]);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-start')).toBeVisible();

  const saveButton = page.getByRole('button', { name: /^Mentés/ });
  await saveButton.click();
  await expect(saveButton).toHaveText('Mentés...');

  resolvePut(undefined);
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  await expect(saveButton).toHaveText('Mentés');
});

test('sikertelen mentésre hibaüzenet jelenik meg, és a gráf piszkos marad', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => route.fulfill(jsonBody({ nem: 'protokoll hiba alak' }, 500))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-agent-b')).toBeVisible();

  // A gráfot egy valódi kapcsolat húzásával piszkítjuk be, nem az
  // "Elrendezés" gombbal - az a `graph-auto-layout` téma tesztje.
  const source = await handleCenter(page, 'n-agent-a', 'Kimenet');
  const target = await handleCenter(page, 'n-agent-b', 'Bemenet');
  await dragConnection(page, source, target);
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');

  await page.getByRole('button', { name: /^Mentés/ }).click();
  await expect(page.getByText('A mentés sikertelen')).toBeVisible();
  await expect(page.getByText('A szerver hibás választ adott (HTTP 500).')).toBeVisible();
  // A baseline nem frissült, a jelző mentés után is látszik.
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');
});

test('a gráf betöltési hibája a képernyőn jelenik meg', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody({ nem: 'protokoll hiba alak' }, 500))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.goto(EDITOR_URL);

  await expect(page.getByRole('alert')).toHaveText('A szerver hibás választ adott (HTTP 500).');
});

test('hiányzó "workflowId" query paraméterre a képernyő figyelmeztet, REST hívás nélkül', async ({ page }) => {
  // Sem a `readWorkflowGraph`, sem a `getWorkflow`, sem a `readSettings` nem
  // mockolt: a `workflowId === undefined` korai kilépés (`GraphEditorScreen`
  // effektus ÉS render ág) miatt egyiket sem szabad meghívnia - ha mégis,
  // az `installApiMocks` alapértelmezett 404 hibaválasza egy MÁSODIK
  // `role="alert"` elemet adna, és a lenti `getByRole('alert')` "strict
  // mode violation" hibával bukna.
  await installApiMocks(page, []);
  await page.goto('/editor');

  await expect(page.getByRole('alert')).toHaveText(
    'Nincs megadva szerkesztendő workflow (hiányzó "workflowId" query paraméter).',
  );
});
