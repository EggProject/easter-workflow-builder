// E2E a lépés és az agent definíció MCP hivatkozásának (`mcpServerReferences`)
// szerkesztésére valós Chromiumban (PLAN-012 T-012-23, SPEC-009 6.2, 12.
// szekció AC16, O-32, O-42, O-43): a központi lista neveiből épülő `Checkbox`
// lista, a hozzárendelés felülírása a szerver oldali nevek listájából. A
// mentés `PUT` törzse `page.route()` mockon rögzül, a `ReplaceGraphRequestSchema`
// szerint értelmezve: a hivatkozás neveket hordoz, értéket soha, a régi
// `mcpServers` érték pedig változatlanul visszamegy.
/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import {
  ReplaceGraphRequestSchema,
  type McpServerDefinitionRecord,
  type NodeConfig,
  type ReplaceGraphRequest,
  type SettingsRecord,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { createRequestGate } from './request-gate.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';

const SERVERS: readonly McpServerDefinitionRecord[] = [
  {
    name: 'github',
    definition: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@mcp/github'],
      envNames: ['GITHUB_TOKEN'],
      envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
    },
  },
  {
    name: 'tavoli',
    definition: { type: 'http', url: 'https://mcp.example.test', authEnvName: 'TAVOLI_AUTH' },
  },
];
const SZELEVENY_SERVERS: readonly McpServerDefinitionRecord[] = [
  { name: 'esemeny', definition: { type: 'sse', url: 'https://sse.example.test', authEnvName: null } },
  {
    name: 'egyszeru',
    definition: { type: 'stdio', command: 'npx', args: [], envNames: ['SAJAT_VALTOZO'], envBindings: {} },
  },
];
const ENVIRONMENT_NAMES: readonly string[] = ['GITHUB_TOKEN_CEG', 'GITHUB_TOKEN_SAJAT', 'TAVOLI_AUTH'];

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

const LEGACY_MCP_SERVERS = { regi: { type: 'stdio', command: 'regi-parancs', args: [], envNames: [] } } as const;

function agentStepConfig(
  mcpServerReferences: Extract<NodeConfig, { type: 'agent_step' }>['mcpServerReferences'],
  agents: Readonly<Record<string, unknown>>,
): NodeConfig {
  return {
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
    agents,
    skills: null,
    mcpServers: LEGACY_MCP_SERVERS,
    ...(mcpServerReferences !== undefined && { mcpServerReferences }),
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
    onUnhandledError: 'fail_run',
  };
}

function graphWith(config: NodeConfig): WorkflowGraphDocument {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'start',
        label: 'Indítás',
        positionX: 0,
        positionY: 0,
        config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
        createdAtMs: 1,
        updatedAtMs: 1,
      },
      {
        id: 'n2',
        type: 'agent_step',
        label: 'Agent lépés',
        positionX: 500,
        positionY: 0,
        config,
        createdAtMs: 1,
        updatedAtMs: 1,
      },
    ],
    edges: [],
  };
}

const EDITOR_URL = '/editor?workflowId=w-alfa';

const KUTATO = { description: 'Kutat a weben.', prompt: 'Kutass alaposan.' };

/**
 * Lásd a `graph-editor.spec.ts` azonos nevű függvényének indoklását: a React
 * Flow saját, dokumentált `data-testid` fogódzója a csomópont egyetlen
 * alkalmazható locatorja.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

function saveButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Mentés', exact: true });
}

function parseSavedGraph(body: unknown): ReplaceGraphRequest {
  const parsed = ReplaceGraphRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

/**
 * A mentett agent lépés konfigurációja. A hivatkozásokra pontos egyenlőséget
 * (`toEqual`) állító tesztek használják: a részhalmaz illesztés (`toMatchObject`)
 * az `envBindings: {}` állításnál egy üres szöveggel tárolt bejegyzést
 * (`{ GITHUB_TOKEN: '' }`) is átengedne.
 */
function savedStepConfig(putBodies: readonly unknown[], index: number): Extract<NodeConfig, { type: 'agent_step' }> {
  const config = parseSavedGraph(putBodies[index]).nodes.find((node) => node.id === 'n2')?.config;
  if (config?.type !== 'agent_step') {
    throw new Error('a mentett n2 csomópont nem agent lépés');
  }
  return config;
}

interface EditorMocks {
  readonly listServers?: MockRoute['handle'];
  readonly listEnvironmentNames?: MockRoute['handle'];
}

async function openEditor(page: Page, graph: WorkflowGraphDocument, putBodies: unknown[], mocks: EditorMocks = {}) {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graph))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('listSkills', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listMcpServerDefinitions', mocks.listServers ?? (async (route) => route.fulfill(jsonBody(SERVERS)))),
    mockRoute(
      'listServerEnvironmentNames',
      mocks.listEnvironmentNames ?? (async (route) => route.fulfill(jsonBody(ENVIRONMENT_NAMES))),
    ),
    mockRoute('replaceWorkflowGraph', async (route) => {
      const body: unknown = route.request().postDataJSON();
      putBodies.push(body);
      const parsed = parseSavedGraph(body);
      await route.fulfill(
        jsonBody({
          nodes: parsed.nodes.map((node) => ({ ...node, createdAtMs: 1, updatedAtMs: 1 })),
          edges: parsed.edges.map((edge) => ({ ...edge, createdAtMs: 1 })),
        }),
      );
    }),
  ]);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n2')).toBeVisible();
}

async function openStepMcp(page: Page): Promise<Locator> {
  await nodeLocator(page, 'n2').click();
  const panel = page.getByRole('complementary', { name: 'Agent lépés beállításai' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'MCP szerverek', exact: true }).click();
  const region = panel.getByRole('region', { name: 'MCP szerverek', exact: true });
  await expect(region).toBeVisible();
  return region;
}

/**
 * Az `kutato` agent definíció `MCP szerverek` paneljének kinyitása.
 */
async function openDefinitionMcp(page: Page): Promise<Locator> {
  await nodeLocator(page, 'n2').click();
  const panel = page.getByRole('complementary', { name: 'Agent lépés beállításai' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Al-agentek (agents)', exact: true }).click();
  const agentsRegion = panel.getByRole('region', { name: 'Al-agentek (agents)', exact: true });
  const entry = agentsRegion.getByRole('group', { name: 'kutato', exact: true });
  await entry.getByRole('button', { name: 'Kibontás' }).click();
  await entry.getByRole('button', { name: 'MCP szerverek', exact: true }).click();
  const region = entry.getByRole('region', { name: 'MCP szerverek', exact: true });
  await expect(region).toBeVisible();
  return region;
}

/**
 * A `Checkbox` natív bemenete vizuálisan rejtett (`.ctrl__input`), ezért a
 * jelölés a címke szövegére kattintással változik, ahogy a többi spec is
 * teszi; az állapotot a `checkbox` szerepű elem `toBeChecked` állítása méri.
 */
async function toggle(region: Locator, label: string): Promise<void> {
  await region.getByText(label, { exact: true }).click();
}

function githubSelect(region: Locator): Locator {
  return region.getByRole('combobox', { name: 'github: GITHUB_TOKEN szerver oldali változója' });
}

function authorizationSelect(region: Locator): Locator {
  return region.getByRole('combobox', { name: 'tavoli: Authorization fejléc szerver oldali változója' });
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a lépés a központi listából választ, a felülírások a szerver oldali nevek listájából jönnek; a PUT törzse neveket hordoz, a régi `mcpServers` változatlan (AC16)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(undefined, {})), putBodies);
  const region = await openStepMcp(page);

  const github = region.getByRole('checkbox', { name: 'github', exact: true });
  const tavoli = region.getByRole('checkbox', { name: 'tavoli', exact: true });
  await expect(github).not.toBeChecked();
  await expect(tavoli).not.toBeChecked();
  await expect(region.getByRole('combobox')).toHaveCount(0);

  await toggle(region, 'github');
  await toggle(region, 'tavoli');
  await expect(githubSelect(region)).toHaveText('központi alapértelmezés (GITHUB_TOKEN_CEG)');
  await expect(authorizationSelect(region)).toHaveText('központi alapértelmezés (TAVOLI_AUTH)');

  await chooseSelectOption(page, githubSelect(region), 'GITHUB_TOKEN_SAJAT');
  await chooseSelectOption(page, authorizationSelect(region), 'GITHUB_TOKEN_SAJAT');
  await expect(githubSelect(region)).toHaveText('GITHUB_TOKEN_SAJAT');

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(savedStepConfig(putBodies, 0).mcpServers).toEqual(LEGACY_MCP_SERVERS);
  expect(savedStepConfig(putBodies, 0).mcpServerReferences).toEqual({
    github: { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_SAJAT' }, authEnvName: null },
    tavoli: { envBindings: {}, authEnvName: 'GITHUB_TOKEN_SAJAT' },
  });

  // A központi alapértelmezés opció törli a felülírást, a jelölés levétele a hivatkozást.
  await chooseSelectOption(page, githubSelect(region), 'központi alapértelmezés (GITHUB_TOKEN_CEG)');
  await chooseSelectOption(page, authorizationSelect(region), 'központi alapértelmezés (TAVOLI_AUTH)');
  await toggle(region, 'tavoli');
  await saveButton(page).click();
  await expect.poll(() => putBodies.length).toBe(2);
  expect(savedStepConfig(putBodies, 1).mcpServers).toEqual(LEGACY_MCP_SERVERS);
  expect(savedStepConfig(putBodies, 1).mcpServerReferences).toEqual({
    github: { envBindings: {}, authEnvName: null },
  });
});

test('a régi `mcpServers` mező olvasható marad, a régi alakot megnevező szöveggel', async ({ page }) => {
  await openEditor(page, graphWith(agentStepConfig(undefined, {})), []);
  const region = await openStepMcp(page);

  await expect(region.getByText('Régi mcpServers mező')).toBeVisible();
  await expect(region.getByText('a régi, lépésenkénti alak', { exact: false })).toBeVisible();
  await expect(region.getByText('regi-parancs', { exact: false })).toBeVisible();
});

test('a központi listából törölt, de hivatkozott szerver "hiányzik" jelzéssel bejelölve marad, a mentés megtartja, a jelölés levétele kiveszi (O-43)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(
    page,
    graphWith(
      agentStepConfig(
        {
          github: { envBindings: {}, authEnvName: null },
          torolt: { envBindings: {}, authEnvName: null },
        },
        {},
      ),
    ),
    putBodies,
  );
  const region = await openStepMcp(page);

  await expect(region.getByRole('checkbox', { name: 'github', exact: true })).toBeChecked();
  const missing = region.getByRole('checkbox', { name: 'torolt (hiányzik a központi listából)', exact: true });
  await expect(missing).toBeChecked();
  await expect(
    region.getByText('A központi listából hiányzó MCP szerverre a futás indítása hibával áll meg'),
  ).toBeVisible();

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedStepConfig(putBodies, 0).mcpServerReferences).toEqual({
    github: { envBindings: {}, authEnvName: null },
    torolt: { envBindings: {}, authEnvName: null },
  });

  await toggle(region, 'torolt (hiányzik a központi listából)');
  await expect(missing).toBeAttached({ attached: false });
  await saveButton(page).click();
  await expect.poll(() => putBodies.length).toBe(2);
  expect(savedStepConfig(putBodies, 1).mcpServerReferences).toEqual({
    github: { envBindings: {}, authEnvName: null },
  });
});

test('az agent definíció `mcpServerReferences` mezője ugyanígy szerkeszthető, és a többi mező megmarad', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(undefined, { kutato: KUTATO })), putBodies);
  const region = await openDefinitionMcp(page);

  await toggle(region, 'tavoli');
  await chooseSelectOption(page, authorizationSelect(region), 'GITHUB_TOKEN_CEG');

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedStepConfig(putBodies, 0).mcpServers).toEqual(LEGACY_MCP_SERVERS);
  expect(savedStepConfig(putBodies, 0).agents).toEqual({
    kutato: { ...KUTATO, mcpServerReferences: { tavoli: { envBindings: {}, authEnvName: 'GITHUB_TOKEN_CEG' } } },
  });
});

test('az agent definíció érvénytelen alakú `mcpServerReferences` értéke megnevezve jelenik meg, és a módosítás felülírja', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(
    page,
    graphWith(agentStepConfig(undefined, { kutato: { ...KUTATO, mcpServerReferences: 5 } })),
    putBodies,
  );
  const region = await openDefinitionMcp(page);

  await expect(region.getByText('A tárolt érték alakja érvénytelen (5)')).toBeVisible();
  await toggle(region, 'github');
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedStepConfig(putBodies, 0).agents).toEqual({
    kutato: { ...KUTATO, mcpServerReferences: { github: { envBindings: {}, authEnvName: null } } },
  });
});

test('a lista betöltése alatt csontváz áll, utána megjelennek a jelölőnégyzetek', async ({ page }) => {
  const gate = createRequestGate();
  await openEditor(page, graphWith(agentStepConfig({ github: { envBindings: {}, authEnvName: null } }, {})), [], {
    listServers: async (route) => {
      await gate.passed;
      await route.fulfill(jsonBody(SERVERS));
    },
  });
  const region = await openStepMcp(page);

  await expect(region.locator('[aria-busy="true"]')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);

  gate.open();
  await expect(region.getByRole('checkbox', { name: 'github', exact: true })).toBeChecked();
  await expect(region.locator('[aria-busy="true"]')).toBeAttached({ attached: false });
});

test('a központi lista betöltési hibája danger Alert, jelölőnégyzetek nélkül', async ({ page }) => {
  await openEditor(page, graphWith(agentStepConfig(undefined, {})), [], {
    listServers: async (route) => route.fulfill(jsonBody({ code: 'internal_error', message: 'hiba' }, 500)),
  });
  const region = await openStepMcp(page);

  await expect(region.getByRole('alert')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);
});

test('üres központi listánál az üres állapot áll a jelölőnégyzetek helyén', async ({ page }) => {
  await openEditor(page, graphWith(agentStepConfig(undefined, {})), [], {
    listServers: async (route) => route.fulfill(jsonBody([])),
  });
  const region = await openStepMcp(page);

  await expect(region.getByText('Még nincs MCP szerver.')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);
});

test('a szerver környezeti nevek betöltési hibája danger Alert a bejelölt szervernél', async ({ page }) => {
  await openEditor(page, graphWith(agentStepConfig({ tavoli: { envBindings: {}, authEnvName: null } }, {})), [], {
    listEnvironmentNames: async (route) => route.fulfill(jsonBody({ code: 'internal_error', message: 'hiba' }, 500)),
  });
  const region = await openStepMcp(page);

  await expect(region.getByRole('alert')).toBeVisible();
  await expect(region.getByRole('checkbox', { name: 'tavoli', exact: true })).toBeChecked();
});

test('az sse szerver és a hozzárendelés nélküli deklarált változó alapértelmezés feliratai: "nincs", illetve a deklarált név', async ({
  page,
}) => {
  await openEditor(page, graphWith(agentStepConfig(undefined, {})), [], {
    listServers: async (route) => route.fulfill(jsonBody(SZELEVENY_SERVERS)),
  });
  const region = await openStepMcp(page);

  await toggle(region, 'esemeny');
  await toggle(region, 'egyszeru');

  await expect(
    region.getByRole('combobox', { name: 'esemeny: Authorization fejléc szerver oldali változója' }),
  ).toHaveText('központi alapértelmezés (nincs)');
  await expect(region.getByRole('combobox', { name: 'egyszeru: SAJAT_VALTOZO szerver oldali változója' })).toHaveText(
    'központi alapértelmezés (SAJAT_VALTOZO)',
  );
});

test('az sse szerver Authorization felülírása a szerver oldali nevek listájából választható, és a PUT törzsben authEnvName névként áll (AC16, sse ág)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(undefined, {})), putBodies, {
    listServers: async (route) => route.fulfill(jsonBody(SZELEVENY_SERVERS)),
  });
  const region = await openStepMcp(page);

  await toggle(region, 'esemeny');
  const sseAuthorization = region.getByRole('combobox', {
    name: 'esemeny: Authorization fejléc szerver oldali változója',
  });
  await chooseSelectOption(page, sseAuthorization, 'TAVOLI_AUTH');
  await expect(sseAuthorization).toHaveText('TAVOLI_AUTH');

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(savedStepConfig(putBodies, 0).mcpServers).toEqual(LEGACY_MCP_SERVERS);
  expect(savedStepConfig(putBodies, 0).mcpServerReferences).toEqual({
    esemeny: { envBindings: {}, authEnvName: 'TAVOLI_AUTH' },
  });
});

test('a felülírásban tárolt, de a szerver környezetéből eltávolított név megmarad opcióként, jelzéssel', async ({
  page,
}) => {
  await openEditor(
    page,
    graphWith(agentStepConfig({ github: { envBindings: { GITHUB_TOKEN: 'ELTAVOLITOTT' }, authEnvName: null } }, {})),
    [],
  );
  const region = await openStepMcp(page);

  await expect(githubSelect(region)).toHaveText('ELTAVOLITOTT (nincs a szerver környezetében)');
});

test('az agent definíció olyan `mcpServerReferences` értéke, amelynek egyik bejegyzése érvénytelen, megnevezve jelenik meg', async ({
  page,
}) => {
  await openEditor(
    page,
    graphWith(agentStepConfig(undefined, { kutato: { ...KUTATO, mcpServerReferences: { github: 'rossz' } } })),
    [],
  );
  const region = await openDefinitionMcp(page);

  await expect(region.getByText('A tárolt érték alakja érvénytelen')).toBeVisible();
});
