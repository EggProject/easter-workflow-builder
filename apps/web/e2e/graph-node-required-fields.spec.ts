// E2E a felvett csomópont és a régi, üres kötelező mezőt hordozó gráf
// mentésére valós Chromiumban (PLAN-009 T-009-45, SPEC-008 5.4, 5.8): a
// mentési séma (`NodeConfigSaveSchema`) a kötelező szöveg mezőt, a két
// kötelező szám mezőt és a `null` kezeletlen hiba szabályt a mező alatt jelzi,
// egy mentési kísérletben mindet, mind a kilenc felvehető típusnál, és `PUT`
// kérés nem indul (79., 81., 100. és 111. kritérium). A mentés kérés
// törzse `page.route()` mockon rögzül, a `ReplaceGraphRequestSchema` szerint
// értelmezve. A mért tények: docs/research/2026-10-14-csomopont-felvetel.md,
// T-009-45 szekció.
import {
  ReplaceGraphRequestSchema,
  type NodeConfig,
  type ReplaceGraphRequest,
  type SettingsRecord,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
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
  onUnhandledError: 'fail_run',
};

const START_NODE: WorkflowGraphDocument['nodes'][number] = {
  id: 'n1',
  type: 'start',
  label: 'Ügyfél kérés fogadása',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
  createdAtMs: 1,
  updatedAtMs: 1,
};

const AGENT_NODE: WorkflowGraphDocument['nodes'][number] = {
  id: 'n2',
  type: 'agent_step',
  label: 'Összefoglaló készítése',
  positionX: 1000,
  positionY: 480,
  config: AGENT_STEP_CONFIG,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const EDGE: WorkflowGraphDocument['edges'][number] = {
  id: 'e1',
  sourceNodeId: 'n1',
  targetNodeId: 'n2',
  sourceHandle: null,
  targetHandle: null,
  branchKey: null,
  createdAtMs: 1,
};

// Két csomópont átlósan: a felvett kártya a látható vászon közepére, a kettő
// közé kerül (SPEC-008 5.8), tehát a Start kimenetéről élt lehet rá húzni.
const GRAPH: WorkflowGraphDocument = { nodes: [START_NODE, AGENT_NODE], edges: [EDGE] };

// A régi gráf: a T-009-48 előtt mentett, üres kötelező szöveg mezőt hordozó
// csomópont (az olvasó séma elfogadja, a mentési nem, SPEC-008 5.4).
const BLANK_PROMPT_GRAPH: WorkflowGraphDocument = {
  nodes: [START_NODE, { ...AGENT_NODE, config: { ...AGENT_STEP_CONFIG, promptTemplate: '' } }],
  edges: [EDGE],
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

const BLANK_FIELD_MESSAGE = 'A mező nem lehet üres.';

/**
 * A 4. verziós UUID szöveges alakja (RFC 9562 4., 4.2. és 5.4. szakasz): öt,
 * kötőjellel elválasztott hexadecimális csoport, a harmadik `4`-gyel kezdődik
 * (a verzió mező), a negyedik `8`, `9`, `a` vagy `b` értékkel (a `10` variáns
 * bitek); a betűk kis- és nagybetűsek is lehetnek.
 */
const UUID_V4_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

/**
 * A React Flow `Handle` egy `<div>` saját `role` és `rf__` testid nélkül, a
 * `graph-editor-validation.spec.ts` `handleLocator` indoka szerint: a saját
 * `aria-label` propunkon, a kártyára szűkítve.
 */
function handleLocator(node: Locator, ariaLabel: string): Locator {
  return node.locator(`.react-flow__handle[aria-label="${ariaLabel}"]`);
}

async function boxCenter(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem talált mérhető dobozt a locatorhoz');
  }
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Valódi egérhúzás egy kimenő handle-ről egy bemenő handle-re, a
 * `graph-editor-validation.spec.ts` `dragConnection` mintájára.
 */
async function dragConnection(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await boxCenter(from);
  const end = await boxCenter(to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + (end.x - start.x) / 2, start.y + (end.y - start.y) / 2, { steps: 5 });
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
}

/**
 * Lásd `graph-node-add-placement.spec.ts` azonos nevű függvénye: a felvett
 * csomópont azonosítója a böngészőben keletkezik, a React Flow `data-id`
 * attribútumából olvasható.
 */
async function readNodeIds(page: Page): Promise<readonly string[]> {
  return page
    .locator('.react-flow__node')
    .evaluateAll((elements) => elements.map((element) => element.dataset['id'] ?? ''));
}

async function addNodeWithButton(page: Page, menuItemLabel: string): Promise<string> {
  const knownIds = await readNodeIds(page);
  await page.getByRole('button', { name: 'Hozzáadás', exact: true }).click();
  await page
    .getByRole('menu', { name: 'Hozzáadás' })
    .getByRole('menuitem', { name: menuItemLabel, exact: true })
    .click();
  await expect
    .poll(async () => {
      const ids = await readNodeIds(page);
      return ids.length;
    })
    .toBe(knownIds.length + 1);
  const ids = await readNodeIds(page);
  const addedId = ids.find((id) => !knownIds.includes(id));
  if (addedId === undefined) {
    throw new Error('a teszt nem találta a felvett csomópontot');
  }
  return addedId;
}

/**
 * A mező alatti hiba: `aria-invalid`, és a hozzáférhető leírás a mező
 * `role="alert"` hibaüzenete (`aria-describedby`, `.claude/CLAUDE.md` 11.).
 */
async function expectFieldError(field: Locator, message: string | RegExp): Promise<void> {
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription(message);
}

async function expectNoFieldError(field: Locator): Promise<void> {
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription('');
}

function saveButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Mentés', exact: true });
}

/**
 * A szerkesztő mockjai: a `PUT` törzseit a `putBodies` gyűjti, a válasz a
 * kérés gráfja a szerver időbélyegeivel.
 */
async function installEditorMocks(page: Page, graph: WorkflowGraphDocument, putBodies: unknown[]): Promise<void> {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graph))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      const body: unknown = route.request().postDataJSON();
      putBodies.push(body);
      const parsed = ReplaceGraphRequestSchema.safeParse(body);
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
}

function parseSavedGraph(body: unknown): ReplaceGraphRequest {
  const parsed = ReplaceGraphRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a felvett agent lépés minden más kötelező mezővel is PUT nélkül marad, amíg a kezeletlen hiba szabálya üres; választás után a PUT törzsben a csomópont és az új él azonosítója v4 UUID, xy-edge__ előtag nélkül', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await installEditorMocks(page, GRAPH, putBodies);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n2')).toBeVisible();

  const addedId = await addNodeWithButton(page, 'Agent lépés');
  const panel = page.getByRole('complementary', { name: 'Agent lépés beállításai' });
  await panel.getByRole('textbox', { name: 'Prompt sablon' }).fill('Írd át a választ udvariasra.');
  await dragConnection(
    page,
    handleLocator(nodeLocator(page, 'n1'), 'Kimenet'),
    handleLocator(nodeLocator(page, addedId), 'Bemenet'),
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);

  // 111. kritérium: egyetlen üres kötelező érték a `null` kezeletlen hiba
  // szabály, és a mentés emiatt kérés nélkül áll meg.
  await saveButton(page).click();
  const policySelect = panel.getByRole('combobox', { name: 'Kezeletlen hiba szabálya' });
  await expectFieldError(policySelect, BLANK_FIELD_MESSAGE);
  await expectNoFieldError(panel.getByRole('textbox', { name: 'Prompt sablon' }));
  expect(putBodies).toHaveLength(0);

  await chooseSelectOption(page, policySelect, 'fail_run');
  await expectNoFieldError(policySelect);
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);

  // 79. kritérium: a felvett csomópont és az új él azonosítója a
  // `crypto.randomUUID()` porton át jön, a React Flow `xy-edge__` előtagú
  // alapértelmezett azonosítója nem keletkezik (M-101, M-103).
  const saved = parseSavedGraph(putBodies[0]);
  const addedNode = saved.nodes.find((node) => node.id === addedId);
  expect(addedId).toMatch(UUID_V4_PATTERN);
  expect(addedNode?.config).toMatchObject({
    type: 'agent_step',
    promptTemplate: 'Írd át a választ udvariasra.',
    onUnhandledError: 'fail_run',
  });
  const newEdges = saved.edges.filter((edge) => edge.id !== 'e1');
  expect(newEdges).toHaveLength(1);
  expect(newEdges[0]).toMatchObject({ sourceNodeId: 'n1', targetNodeId: addedId });
  expect(newEdges[0]?.id).toMatch(UUID_V4_PATTERN);
  expect(saved.edges.filter((edge) => edge.id.startsWith('xy-edge__'))).toEqual([]);
  expect(saved.nodes.map((node) => node.id)).toEqual(['n1', 'n2', addedId]);
});

test('a felvett ciklus kezdő NaN értéke a szám mezőben üresen látszik, és egyetlen mentési kísérlet PUT nélkül a szám mező, a folytatás feltétel és a kezeletlen hiba szabálya alatt is jelez', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await installEditorMocks(page, GRAPH, putBodies);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n2')).toBeVisible();

  await addNodeWithButton(page, 'Ciklus');
  const panel = page.getByRole('complementary', { name: 'Ciklus beállításai' });
  const maxIterations = panel.getByRole('spinbutton', { name: 'Max. iterációk száma' });
  const continueExpression = panel.getByRole('textbox', { name: 'Folytatás feltétel (continueExpression)' });
  const policySelect = panel.getByRole('combobox', { name: 'Kezeletlen hiba szabálya' });

  // A kezdő `maxIterations` `NaN` (SPEC-008 5.8): a mező `String(NaN)` értéket
  // kap, amit a natív szám mező értéktisztítása üres szövegre állít. Mérve,
  // nem feltételezve (81. kritérium): a mező értéke üres.
  await expect(maxIterations).toHaveValue('');
  // A mentési kísérlet előtt egyik mező sem jelez (a 69. kritérium szabálya).
  await expectNoFieldError(maxIterations);
  await expectNoFieldError(continueExpression);
  await expectNoFieldError(policySelect);

  // 81. kritérium (user döntés 2026-10-16, "Egyszerre látsszon mind"): egy
  // kísérlet után a szám mező típushibája MELLETT a két üres kötelező mező is
  // jelez, és a lábléc üzenete mindhárom útvonalat megnevezi.
  await saveButton(page).click();
  // A `NaN` a szám séma típus hibája (M-104), az üzenete a zod saját szövege,
  // ezért itt csak a meglétét állítjuk.
  await expectFieldError(maxIterations, /\S/);
  await expectFieldError(continueExpression, BLANK_FIELD_MESSAGE);
  await expectFieldError(policySelect, BLANK_FIELD_MESSAGE);
  await expect(
    page.getByText(
      'A kérés törzse érvénytelen, hibás mező(k): nodes.2.config.maxIterations, ' +
        'nodes.2.config.continueExpression, nodes.2.config.onUnhandledError (invalid_request).',
      { exact: true },
    ),
  ).toBeVisible();
  expect(putBodies).toHaveLength(0);

  // A szám kitöltése csak a saját hibáját szünteti meg, a mentés kérés nélkül marad.
  await maxIterations.fill('3');
  await expectNoFieldError(maxIterations);
  await expectFieldError(continueExpression, BLANK_FIELD_MESSAGE);
  await expectFieldError(policySelect, BLANK_FIELD_MESSAGE);
  await saveButton(page).click();
  expect(putBodies).toHaveLength(0);

  await continueExpression.fill('i < 3');
  await chooseSelectOption(page, policySelect, 'fail_run');
  await expectNoFieldError(continueExpression);
  await expectNoFieldError(policySelect);
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(parseSavedGraph(putBodies[0]).nodes[2]?.config).toEqual({
    type: 'loop',
    maxIterations: 3,
    continueExpression: 'i < 3',
    onUnhandledError: 'fail_run',
  });
});

interface RequiredFieldLocator {
  readonly role: 'textbox' | 'spinbutton' | 'combobox';
  readonly name: string;
  // A szám mező `NaN` értéke típushiba, az üzenete a zod saját szövege (M-104).
  readonly message: string | RegExp;
}

const POLICY_FIELD: RequiredFieldLocator = {
  role: 'combobox',
  name: 'Kezeletlen hiba szabálya',
  message: BLANK_FIELD_MESSAGE,
};

function blankTextField(name: string): RequiredFieldLocator {
  return { role: 'textbox', name, message: BLANK_FIELD_MESSAGE };
}

/**
 * A kilenc felvehető típus (SPEC-008 5.8) menüpontja és a kezdő konfig minden
 * üresen induló kötelező mezője (5.4 táblázata, O-29, O-33): a `branch` üres
 * ág listájának nincs elem mezője, az `error_handler` egyetlen kötelező
 * mezője a szám mező.
 */
const ADDED_NODE_CASES: readonly { readonly menuItem: string; readonly fields: readonly RequiredFieldLocator[] }[] = [
  { menuItem: 'Agent lépés', fields: [blankTextField('Prompt sablon'), POLICY_FIELD] },
  { menuItem: 'Elágazás', fields: [blankTextField('Feltétel kifejezés'), POLICY_FIELD] },
  {
    menuItem: 'Szétosztás',
    fields: [
      blankTextField('Elemek kifejezés (itemsExpression)'),
      blankTextField('Ág címke sablon (branchLabelTemplate)'),
      POLICY_FIELD,
    ],
  },
  {
    menuItem: 'Összefésülés',
    fields: [{ role: 'combobox', name: 'Összefésülés módja', message: BLANK_FIELD_MESSAGE }, POLICY_FIELD],
  },
  {
    menuItem: 'Ciklus',
    fields: [
      { role: 'spinbutton', name: 'Max. iterációk száma', message: /\S/ },
      blankTextField('Folytatás feltétel (continueExpression)'),
      POLICY_FIELD,
    ],
  },
  {
    menuItem: 'Emberi jóváhagyás',
    fields: [blankTextField('Cím'), blankTextField('Törzs sablon (bodyTemplate)'), POLICY_FIELD],
  },
  {
    menuItem: 'Hibakezelő',
    fields: [{ role: 'spinbutton', name: 'Max. próbálkozások száma', message: /\S/ }, POLICY_FIELD],
  },
  { menuItem: 'Al-workflow', fields: [blankTextField('Célzott workflow azonosítója'), POLICY_FIELD] },
  { menuItem: 'Szkript', fields: [blankTextField('Forrás (source)'), POLICY_FIELD] },
];

test('a kilenc felvehető típus mindegyike szerepel az esetek között', () => {
  expect(ADDED_NODE_CASES).toHaveLength(9);
});

for (const { menuItem, fields } of ADDED_NODE_CASES) {
  test(`a felvett ${menuItem} egyetlen mentési kísérlet után PUT nélkül minden üres kötelező mezője alatt jelez (81. kritérium)`, async ({
    page,
  }) => {
    const putBodies: unknown[] = [];
    await installEditorMocks(page, GRAPH, putBodies);
    await page.goto(EDITOR_URL);
    await expect(nodeLocator(page, 'n2')).toBeVisible();

    await addNodeWithButton(page, menuItem);
    const panel = page.getByRole('complementary', { name: `${menuItem} beállításai` });
    const locators = fields.map((field) => ({ ...field, locator: panel.getByRole(field.role, { name: field.name }) }));
    for (const { locator } of locators) {
      await expectNoFieldError(locator);
    }

    await saveButton(page).click();
    for (const { locator, message } of locators) {
      await expectFieldError(locator, message);
    }
    // A panelen pontosan ennyi mező érvénytelen: a felsorolás teljes. Az
    // `aria-invalid` állapotra nincs `getByRole` opció, és a `role="alert"`
    // számlálása a panel nem mezőhöz tartozó figyelmeztetését (a `script`
    // típusé) is beszámolná, ezért itt attribútum szelektor áll.
    await expect(panel.locator('[aria-invalid="true"]')).toHaveCount(fields.length);
    expect(putBodies).toHaveLength(0);
  });
}

test('a régi, üres kötelező szöveg mezőt hordozó gráf betölt, a mentési kísérlet PUT nélkül a mező alatt jelez, kitöltés után a mentés lefut', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await installEditorMocks(page, BLANK_PROMPT_GRAPH, putBodies);
  await page.goto(EDITOR_URL);

  // 100. kritérium: a szerkesztő az olvasó sémán tölt be, a mentési szabály nélkül.
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await nodeLocator(page, 'n2').click();
  const panel = page.getByRole('complementary', { name: 'Agent lépés beállításai' });
  const promptField = panel.getByRole('textbox', { name: 'Prompt sablon' });
  await expect(promptField).toHaveValue('');
  await expectNoFieldError(promptField);

  await saveButton(page).click();
  await expectFieldError(promptField, BLANK_FIELD_MESSAGE);
  expect(putBodies).toHaveLength(0);

  // A csak szóközből álló érték ugyanúgy üres (SPEC-008 5.4).
  await promptField.fill(' '.repeat(3));
  await expectFieldError(promptField, BLANK_FIELD_MESSAGE);

  await promptField.fill('Foglald össze a bemenetet.');
  await expectNoFieldError(promptField);
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  const saved = parseSavedGraph(putBodies[0]);
  expect(saved.nodes.find((node) => node.id === 'n2')?.config).toMatchObject({
    type: 'agent_step',
    promptTemplate: 'Foglald össze a bemenetet.',
  });
});
