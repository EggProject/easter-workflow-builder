// E2E a szerkesztő betöltésének normalizálására (PLAN-009 T-009-55, SPEC-008
// 5.1, 5.5, 5.8, 5.10, O-27, O-28; a 108. kritérium szerkesztő része és a
// 109. kritérium).
//
// Amit véd: (1) a `branch` forrású, kulcs nélküli élt a szerkesztő nem
// rajzolja, és az elhagyás a betöltéssel azonnal mentetlen változás; (2) a
// Start nélküli gráfba a betöltés egy Startot vesz fel, szintén azonnal
// mentetlen változásként. Mindkettő a kiinduló dokumentum része: a Visszavonás
// gomb a betöltés után tiltott, a visszavonás billentyűje és egy további
// változtatás utáni "Változtatások elvetése" sem veszi ki, és a mentés `PUT`
// törzse a normalizált alakot viszi. Minden REST hívás `page.route()` mockon
// megy, az SSE csatorna egyetlen `stream_ready` kereten (`.claude/CLAUDE.md`
// 11. szekció).
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
  sessionMode: 'isolated',
  structuredOutput: null,
  onUnhandledError: 'fail_run',
};

/**
 * Egy régi gráf: az elágazás kulcsos éle mellett egy kulcs nélküli éle is
 * van (`e-regi`), amit a korábbi szerkesztő kötött. A Start kulcs nélküli éle
 * (`e-start`) más típusú forrásból indul, tehát megmarad. Átlós elrendezés,
 * hogy az automatikus elrendezés biztosan új pozíciót adjon.
 */
const KEYLESS_EDGE_GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-branch',
      type: 'branch',
      label: 'Döntés',
      positionX: 450,
      positionY: 150,
      config: {
        type: 'branch',
        expression: 'input.kind',
        branches: [
          { key: 'igen', label: 'Igen' },
          { key: 'nem', label: 'Nem' },
        ],
        defaultBranchKey: 'nem',
        onUnhandledError: 'fail_run',
      },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent',
      type: 'agent_step',
      label: 'Összegzés',
      positionX: 900,
      positionY: 300,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [
    {
      id: 'e-start',
      sourceNodeId: 'n-start',
      targetNodeId: 'n-branch',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-regi',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-agent',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-igen',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-agent',
      sourceHandle: 'igen',
      targetHandle: null,
      branchKey: 'igen',
      createdAtMs: 1,
    },
  ],
};

/**
 * Egy régi, Start nélküli gráf: egyetlen agent lépés, az origótól távol, hogy
 * a felvett Start kártyája ne fedje.
 */
const STARTLESS_GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-agent',
      type: 'agent_step',
      label: 'Összegzés',
      positionX: 600,
      positionY: 300,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-regi',
  name: 'Régi workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-regi';

const BLANK_FIELD_MESSAGE = 'A mező nem lehet üres.';

/**
 * A 4. verziós UUID szöveges alakja (RFC 9562 4., 4.2. és 5.4. szakasz), a
 * `graph-node-required-fields.spec.ts` mintája szerint.
 */
const UUID_V4_PATTERN = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i;

/**
 * A mentés kérés törzsei, a teszt mockja gyűjti.
 */
const savedBodies: string[] = [];

// A fájl a `Ctrl` módosítót méri: az Automatikus beállítás a felhasználói
// ügynökből old fel (SPEC-008 5.10, O-31), ezért az ügynök nem macOS értékre
// van rögzítve.
test.use({ userAgent: WINDOWS_CHROME_USER_AGENT });

/**
 * A mentés törzse a kérés sémája szerint értelmezve.
 */
function parseSavedGraph(body: string | undefined): ReplaceGraphRequest {
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(body ?? 'null'));
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

async function openEditor(page: Page, graph: WorkflowGraphDocument): Promise<void> {
  savedBodies.length = 0;
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graph))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      const body = route.request().postData() ?? '';
      savedBodies.push(body);
      const saved = parseSavedGraph(body);
      await route.fulfill(
        jsonBody({
          nodes: saved.nodes.map((node) => ({ ...node, createdAtMs: 2, updatedAtMs: 2 })),
          edges: saved.edges.map((edge) => ({ ...edge, createdAtMs: 2 })),
        }),
      );
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
}

function unsavedIndicator(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: 'Mentetlen változtatások' });
}

function undoButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Visszavonás', exact: true });
}

async function chooseMoreAction(page: Page, name: 'Elrendezés' | 'Változtatások elvetése'): Promise<void> {
  await page.getByRole('button', { name: 'További műveletek' }).click();
  await page.getByRole('menuitem', { name }).click();
}

async function expectDiscardDisabled(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'További műveletek' }).click();
  await expect(page.getByRole('menuitem', { name: 'Változtatások elvetése' })).toBeDisabled();
  await page.keyboard.press('Escape');
}

async function saveAndReadGraph(page: Page): Promise<ReplaceGraphRequest> {
  const requestsBefore = savedBodies.length;
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect.poll(() => savedBodies.length).toBe(requestsBefore + 1);
  return parseSavedGraph(savedBodies[requestsBefore]);
}

test('a kulcs nélküli elágazás élt a szerkesztő nem rajzolja, az elhagyás azonnal mentetlen változás, és sem a visszavonás, sem az elvetés nem hozza vissza (AC108)', async ({
  page,
}) => {
  await openEditor(page, KEYLESS_EDGE_GRAPH);
  const edges = page.locator('.react-flow__edge');

  // A válasz három élt hoz, a vászon kettőt rajzol: a kulcs nélküli elágazás él
  // hiányzik, a Start kulcs nélküli éle megmarad.
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(edges).toHaveCount(KEYLESS_EDGE_GRAPH.edges.length - 1);
  await expect(page.getByTestId('rf__edge-e-start')).toBeAttached();
  await expect(page.getByTestId('rf__edge-e-igen')).toBeAttached();
  await expect(page.getByTestId('rf__edge-e-regi')).toHaveCount(0);
  await expect(unsavedIndicator(page)).toBeVisible();
  await expect(undoButton(page)).toBeDisabled();
  await expectDiscardDisabled(page);

  await page.keyboard.press('Control+z');
  await expect(edges).toHaveCount(2);
  await expect(page.getByTestId('rf__edge-e-regi')).toHaveCount(0);

  // Egy további változtatás, majd az elvetés: a kiinduló dokumentum az él
  // nélküli alak, tehát az elvetés után a menüpont ismét tiltott.
  await chooseMoreAction(page, 'Elrendezés');
  await expect(undoButton(page)).toBeEnabled();
  await chooseMoreAction(page, 'Változtatások elvetése');
  await expectDiscardDisabled(page);
  await expect(edges).toHaveCount(2);
  await expect(page.getByTestId('rf__edge-e-regi')).toHaveCount(0);
  await expect(unsavedIndicator(page)).toBeVisible();

  // Egy másik változtatás utáni mentés törzsében az él nincs, és a mentés
  // után a jelző eltűnik.
  await chooseMoreAction(page, 'Elrendezés');
  const saved = await saveAndReadGraph(page);
  expect(saved.edges.map((edge) => edge.id)).toEqual(['e-start', 'e-igen']);
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  await expect(unsavedIndicator(page)).toBeHidden();
});

test('a Start nélküli gráfba a betöltés egy Startot vesz fel, azonnal mentetlen változásként; a visszavonás és az elvetés megtartja, a navigáció megerősítést kér, a mentés a Startot viszi (AC109)', async ({
  page,
}) => {
  await openEditor(page, STARTLESS_GRAPH);
  // A felvett Start azonosítója a böngészőben keletkezik, ezért a kártyát a
  // típus felirata találja meg, az azonosítót a React Flow `data-id`
  // attribútuma adja (a `graph-node-required-fields.spec.ts` mintája).
  const nodes = page.locator('.react-flow__node');
  const startNode = nodes.filter({ hasText: 'Indítás' });

  await expect(nodes).toHaveCount(2);
  await expect(startNode).toBeVisible();
  await expect(page.getByRole('complementary', { name: /beállításai$/ })).toHaveCount(0);
  await expect(unsavedIndicator(page)).toBeVisible();
  await expect(undoButton(page)).toBeDisabled();
  await expectDiscardDisabled(page);
  const startNodeId = await startNode.getAttribute('data-id');
  expect(startNodeId).toMatch(UUID_V4_PATTERN);

  await page.keyboard.press('Control+z');
  await expect(nodes).toHaveCount(2);
  await expect(startNode).toBeVisible();

  await chooseMoreAction(page, 'Elrendezés');
  await expect(undoButton(page)).toBeEnabled();
  await chooseMoreAction(page, 'Változtatások elvetése');
  await expectDiscardDisabled(page);
  await expect(nodes).toHaveCount(2);
  await expect(startNode).toBeVisible();
  await expect(unsavedIndicator(page)).toBeVisible();

  const dialog = page.getByRole('dialog', { name: 'Kilépés mentés nélkül?' });
  await page.locator('.app-tn__navigation').getByRole('link', { name: 'Futás előzmények' }).click();
  await expect(dialog).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/editor');
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(startNode).toBeVisible();

  // A Start kezeletlen hiba szabálya üres: a mentés kérés nélkül jelez, a
  // kitöltés után a törzs a felvett Startot viszi.
  await startNode.click();
  const panel = page.getByRole('complementary', { name: 'Indítás beállításai' });
  await expect(panel).toBeVisible();
  const policySelect = panel.getByRole('combobox', { name: 'Kezeletlen hiba szabálya' });
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(policySelect).toHaveAttribute('aria-invalid', 'true');
  await expect(policySelect).toHaveAccessibleDescription(BLANK_FIELD_MESSAGE);
  expect(savedBodies).toHaveLength(0);

  await chooseSelectOption(page, policySelect, 'fail_run');
  const saved = await saveAndReadGraph(page);
  expect(saved.nodes.map((node) => node.id)).toEqual(['n-agent', startNodeId]);
  expect(saved.nodes.find((node) => node.id === startNodeId)).toEqual({
    id: startNodeId,
    type: 'start',
    label: '',
    positionX: 0,
    positionY: 0,
    config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
  });
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  await expect(unsavedIndicator(page)).toBeHidden();
});
