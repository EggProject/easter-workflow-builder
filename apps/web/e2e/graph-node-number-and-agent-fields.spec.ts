// E2E a szám mezők pozitív egész szabályára és az `agents` bejegyzés kötelező
// mezőire valós Chromiumban (PLAN-009 T-009-60, SPEC-008 5.4, O-37, O-38,
// 116. és 117. kritérium): a mentési kísérlet `PUT` kérés nélkül marad, a hiba
// a mező alatt jelenik meg (a 69. kritérium megjelenési szabálya szerint),
// érvényes érték után a mentés lefut. A mentés kérés törzse `page.route()`
// mockon rögzül, a `ReplaceGraphRequestSchema` szerint értelmezve. A mért
// tények: docs/research/2026-10-17-szam-es-agent-mezok.md.
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
  // A `regi` bejegyzés egy régi, `prompt` nélkül tárolt agent: az űrlap a
  // hiányzó értéket üres mezőként mutatja, tehát ugyanúgy nem menthető.
  agents: { kutato: { description: 'Kutat a weben.', prompt: 'Kutass alaposan.' }, regi: { description: 'Régi' } },
  skills: null,
  mcpServers: {},
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  sessionMode: 'isolated',
  structuredOutput: null,
  onUnhandledError: 'fail_run',
};

function storedNode(
  id: string,
  type: NodeConfig['type'],
  label: string,
  positionX: number,
  config: NodeConfig,
): WorkflowGraphDocument['nodes'][number] {
  return { id, type, label, positionX, positionY: 0, config, createdAtMs: 1, updatedAtMs: 1 };
}

// A `regi` bejegyzés nélküli változat: a szám mezők tesztjeiben a gráf minden
// más mezője mentésre kész.
const READY_AGENT_STEP_CONFIG: NodeConfig = {
  ...AGENT_STEP_CONFIG,
  agents: { kutato: { description: 'Kutat a weben.', prompt: 'Kutass alaposan.' } },
};

function graphWith(agentConfig: NodeConfig): WorkflowGraphDocument {
  return {
    nodes: [
      storedNode('n1', 'start', 'Indítás', 0, { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }),
      storedNode('n2', 'agent_step', 'Agent lépés', 500, agentConfig),
      storedNode('n3', 'loop', 'Ciklus', 1000, {
        type: 'loop',
        maxIterations: 3,
        continueExpression: 'iteration < 3',
        onUnhandledError: 'fail_run',
      }),
      storedNode('n4', 'error_handler', 'Hibakezelő', 1500, {
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [100, 200, 400],
        handledErrorKinds: [],
        onUnhandledError: 'fail_run',
      }),
    ],
    edges: [],
  };
}

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

const NOT_POSITIVE_INTEGER_MESSAGE = 'A mező értéke nem pozitív egész szám.';

/**
Lásd a `graph-node-required-fields.spec.ts` azonos nevű függvényét.
*/
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

/**
 * A mező alatti hiba: `aria-invalid`, és a hozzáférhető leírás a mező
 * `role="alert"` hibaüzenete (`aria-describedby`, `.claude/CLAUDE.md` 11.).
 */
async function expectFieldError(field: Locator, message: string): Promise<void> {
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

function validationMessage(paths: readonly string[]): string {
  return `A kérés törzse érvénytelen, hibás mező(k): ${paths.join(', ')} (invalid_request).`;
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

async function openEditor(page: Page, graph: WorkflowGraphDocument, putBodies: unknown[]): Promise<void> {
  await installEditorMocks(page, graph, putBodies);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n4')).toBeVisible();
}

async function openPanel(page: Page, nodeId: string, panelName: string): Promise<Locator> {
  await nodeLocator(page, nodeId).click();
  const panel = page.getByRole('complementary', { name: panelName });
  await expect(panel).toBeVisible();
  return panel;
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

interface NumberFieldCase {
  readonly field: string;
  readonly nodeId: string;
  readonly panelName: string;
  readonly role: 'spinbutton' | 'textbox';
  readonly label: string;
  /**
  A mezőbe gépelt szöveg a vizsgált értékkel.
  */
  readonly input: (value: string) => string;
  /**
  A hibás érték útvonala a mentés kérés törzsében.
  */
  readonly path: string;
  readonly savedConfig: Readonly<Record<string, unknown>>;
}

/**
 * A három szám mező (116. kritérium); a `backoffMs` lista soronkénti mező,
 * a hibás érték esetenként más helyre kerül, hogy a szabály a lista minden
 * elemén igazolt legyen.
 */
const NUMBER_FIELD_CASES: readonly NumberFieldCase[] = [
  {
    field: 'loop maxIterations',
    nodeId: 'n3',
    panelName: 'Ciklus beállításai',
    role: 'spinbutton',
    label: 'Max. iterációk száma',
    input: (value) => value,
    path: 'nodes.2.config.maxIterations',
    savedConfig: { maxIterations: 7 },
  },
  {
    field: 'error_handler maxAttempts',
    nodeId: 'n4',
    panelName: 'Hibakezelő beállításai',
    role: 'spinbutton',
    label: 'Max. próbálkozások száma',
    input: (value) => value,
    path: 'nodes.3.config.maxAttempts',
    savedConfig: { maxAttempts: 7 },
  },
  ...[0, 1, 2].map((index): NumberFieldCase => ({
    field: `error_handler backoffMs ${String(index + 1)}. sora`,
    nodeId: 'n4',
    panelName: 'Hibakezelő beállításai',
    role: 'textbox',
    label: 'Várakozás próbálkozásonként, ms (soronként egy szám)',
    input: (value) => ['100', '200', '400'].map((line, position) => (position === index ? value : line)).join('\n'),
    path: `nodes.3.config.backoffMs.${String(index)}`,
    savedConfig: { backoffMs: [100, 200, 400].map((delay, position) => (position === index ? 7 : delay)) },
  })),
];

for (const { field, nodeId, panelName, role, label, input, path, savedConfig } of NUMBER_FIELD_CASES) {
  test(`${field}: a 0, a -3 és az 1,5 mentési kísérlete PUT nélkül marad, a hiba a mező alatt áll; a pozitív egész után a mentés lefut (116. kritérium)`, async ({
    page,
  }) => {
    const putBodies: unknown[] = [];
    await openEditor(page, graphWith(READY_AGENT_STEP_CONFIG), putBodies);
    const panel = await openPanel(page, nodeId, panelName);
    const numberField = panel.getByRole(role, { name: label });

    for (const value of ['0', '-3', '1.5']) {
      await numberField.fill(input(value));
      await saveButton(page).click();
      await expectFieldError(numberField, NOT_POSITIVE_INTEGER_MESSAGE);
      await expect(page.getByText(validationMessage([path]), { exact: true })).toBeVisible();
      expect(putBodies).toHaveLength(0);
    }

    await numberField.fill(input('7'));
    await expectNoFieldError(numberField);
    await saveButton(page).click();
    await expect(page.getByText('Gráf mentve')).toBeVisible();
    expect(putBodies).toHaveLength(1);
    expect(parseSavedGraph(putBodies[0]).nodes.find((node) => node.id === nodeId)?.config).toMatchObject(savedConfig);
  });
}

test('a nem pozitív egész szám mentési kísérlet nélkül csak az érintett (elhagyott) mező alatt jelez (69. kritérium)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(READY_AGENT_STEP_CONFIG), putBodies);
  const panel = await openPanel(page, 'n4', 'Hibakezelő beállításai');
  const maxAttempts = panel.getByRole('spinbutton', { name: 'Max. próbálkozások száma' });
  const backoff = panel.getByRole('textbox', { name: 'Várakozás próbálkozásonként, ms (soronként egy szám)' });

  await maxAttempts.fill('0');
  await expectNoFieldError(maxAttempts);
  await maxAttempts.blur();
  await expectFieldError(maxAttempts, NOT_POSITIVE_INTEGER_MESSAGE);
  await expectNoFieldError(backoff);
  expect(putBodies).toHaveLength(0);
});

test('az "Agent hozzáadása" által felvett üres bejegyzés és a prompt nélküli régi bejegyzés mentése PUT nélkül marad, a hiba a mezők alatt áll; kitöltés után a mentés lefut (117. kritérium)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(AGENT_STEP_CONFIG), putBodies);
  const panel = await openPanel(page, 'n2', 'Agent lépés beállításai');
  await panel.getByRole('button', { name: 'Al-agentek (agents)', exact: true }).click();
  const agentsGroup = panel.getByRole('region', { name: 'Al-agentek (agents)', exact: true });
  await expect(agentsGroup).toBeVisible();

  await agentsGroup.getByLabel('Új agent neve').fill('uj');
  await agentsGroup.getByRole('button', { name: 'Agent hozzáadása' }).click();
  const newEntry = agentsGroup.getByRole('group', { name: 'uj', exact: true });
  await newEntry.getByRole('button', { name: 'Kibontás' }).click();
  const description = newEntry.getByRole('textbox', { name: 'Leírás' });
  const prompt = newEntry.getByRole('textbox', { name: 'Prompt' });
  // A mentési kísérlet előtt az érintetlen mező nem jelez (69. kritérium).
  await expectNoFieldError(description);
  await expectNoFieldError(prompt);

  await saveButton(page).click();
  await expectFieldError(description, BLANK_FIELD_MESSAGE);
  await expectFieldError(prompt, BLANK_FIELD_MESSAGE);
  await expect(
    page.getByText(
      validationMessage([
        'nodes.1.config.agents.regi.prompt',
        'nodes.1.config.agents.uj.description',
        'nodes.1.config.agents.uj.prompt',
      ]),
      { exact: true },
    ),
  ).toBeVisible();
  expect(putBodies).toHaveLength(0);

  // A csak szóközből álló érték ugyanúgy üres (SPEC-008 5.4).
  await description.fill(' '.repeat(3));
  await prompt.fill('Dolgozz.');
  await expectFieldError(description, BLANK_FIELD_MESSAGE);
  await expectNoFieldError(prompt);
  await saveButton(page).click();
  expect(putBodies).toHaveLength(0);

  await description.fill('Új agent');
  await expectNoFieldError(description);
  const oldEntry = agentsGroup.getByRole('group', { name: 'regi', exact: true });
  await oldEntry.getByRole('button', { name: 'Kibontás' }).click();
  const oldPrompt = oldEntry.getByRole('textbox', { name: 'Prompt' });
  await expectFieldError(oldPrompt, BLANK_FIELD_MESSAGE);
  await oldPrompt.fill('Régi prompt.');
  await expectNoFieldError(oldPrompt);

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(parseSavedGraph(putBodies[0]).nodes.find((node) => node.id === 'n2')?.config).toMatchObject({
    agents: {
      kutato: { description: 'Kutat a weben.', prompt: 'Kutass alaposan.' },
      regi: { description: 'Régi', prompt: 'Régi prompt.' },
      uj: { description: 'Új agent', prompt: 'Dolgozz.' },
    },
  });
});

test('az agent bejegyzés üres kötelező mezője mentési kísérlet nélkül csak elhagyás után jelez (69. kritérium)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(READY_AGENT_STEP_CONFIG), putBodies);
  const panel = await openPanel(page, 'n2', 'Agent lépés beállításai');
  await panel.getByRole('button', { name: 'Al-agentek (agents)', exact: true }).click();
  const agentsGroup = panel.getByRole('region', { name: 'Al-agentek (agents)', exact: true });
  await agentsGroup.getByLabel('Új agent neve').fill('uj');
  await agentsGroup.getByRole('button', { name: 'Agent hozzáadása' }).click();
  const newEntry = agentsGroup.getByRole('group', { name: 'uj', exact: true });
  await newEntry.getByRole('button', { name: 'Kibontás' }).click();
  const description = newEntry.getByRole('textbox', { name: 'Leírás' });
  const prompt = newEntry.getByRole('textbox', { name: 'Prompt' });

  await description.focus();
  await description.blur();
  await expectFieldError(description, BLANK_FIELD_MESSAGE);
  await expectNoFieldError(prompt);
  expect(putBodies).toHaveLength(0);
});
