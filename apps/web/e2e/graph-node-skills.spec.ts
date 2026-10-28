// E2E a lépés és az agent definíció `skills` mezőjének szerkesztésére valós
// Chromiumban (PLAN-012 T-012-22, SPEC-009 5.2, 12. szekció AC15, O-14 (a)):
// módválasztó (nincs beállítva / minden / lista) és a skill könyvtár
// neveiből épülő `Checkbox` lista. A mentés `PUT` törzse `page.route()`
// mockon rögzül, a `ReplaceGraphRequestSchema` szerint értelmezve; a skill
// könyvtár `GET /api/skills` válasza mockolt.
/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import {
  ReplaceGraphRequestSchema,
  type NodeConfig,
  type ReplaceGraphRequest,
  type SettingsRecord,
  type SkillSummary,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { createRequestGate } from './request-gate.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';

const SKILLS: readonly SkillSummary[] = [
  { name: 'alfa', description: 'Alfa leírás', sizeBytes: 10, modifiedAtMs: 1 },
  { name: 'beta', description: 'Beta leírás', sizeBytes: 20, modifiedAtMs: 2 },
];

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

function agentStepConfig(
  skills: Extract<NodeConfig, { type: 'agent_step' }>['skills'],
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
    skills,
    mcpServers: {},
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

function savedConfig(putBodies: readonly unknown[], index: number): unknown {
  return parseSavedGraph(putBodies[index]).nodes.find((node) => node.id === 'n2')?.config;
}

async function openEditor(
  page: Page,
  graph: WorkflowGraphDocument,
  putBodies: unknown[],
  listSkills: MockRoute['handle'] = async (route) => route.fulfill(jsonBody(SKILLS)),
): Promise<void> {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graph))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('listSkills', listSkills),
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

async function openStepSkills(page: Page): Promise<Locator> {
  await nodeLocator(page, 'n2').click();
  const panel = page.getByRole('complementary', { name: 'Agent lépés beállításai' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Skillek', exact: true }).click();
  const region = panel.getByRole('region', { name: 'Skillek', exact: true });
  await expect(region).toBeVisible();
  return region;
}

/**
 * Az `kutato` agent definíció `Skillek` paneljének kinyitása.
 */
async function openDefinitionSkills(page: Page): Promise<Locator> {
  await nodeLocator(page, 'n2').click();
  const panel = page.getByRole('complementary', { name: 'Agent lépés beállításai' });
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Al-agentek (agents)', exact: true }).click();
  const agentsRegion = panel.getByRole('region', { name: 'Al-agentek (agents)', exact: true });
  const entry = agentsRegion.getByRole('group', { name: 'kutato', exact: true });
  await entry.getByRole('button', { name: 'Kibontás' }).click();
  await entry.getByRole('button', { name: 'Skillek', exact: true }).click();
  const region = entry.getByRole('region', { name: 'Skillek', exact: true });
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

function modeSelect(region: Locator): Locator {
  return region.getByRole('combobox', { name: 'Skillek használata' });
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a lépés módválasztója: nincs beállítva -> minden -> lista; a jelölések a mentés PUT törzsében nevekként jelennek meg (AC15)', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(null, {})), putBodies);
  const region = await openStepSkills(page);

  await expect(modeSelect(region)).toHaveText('nincs beállítva');
  await expect(region.getByText('Nem használ feltöltött skillt.')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);

  await chooseSelectOption(page, modeSelect(region), 'minden feltöltött skill');
  await expect(region.getByText('A futás indításakor a könyvtár minden skilljét használja.')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);

  await chooseSelectOption(page, modeSelect(region), 'kiválasztott skillek');
  const alfa = region.getByRole('checkbox', { name: 'alfa', exact: true });
  const beta = region.getByRole('checkbox', { name: 'beta', exact: true });
  await expect(alfa).not.toBeChecked();
  await expect(beta).not.toBeChecked();
  await toggle(region, 'alfa');
  await toggle(region, 'beta');
  // A listás opció újraválasztása a jelöléseket megtartja.
  await chooseSelectOption(page, modeSelect(region), 'kiválasztott skillek');
  await expect(alfa).toBeChecked();
  await expect(beta).toBeChecked();
  await toggle(region, 'alfa');

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(savedConfig(putBodies, 0)).toMatchObject({ skills: ['beta'] });

  await chooseSelectOption(page, modeSelect(region), 'minden feltöltött skill');
  await saveButton(page).click();
  await expect.poll(() => putBodies.length).toBe(2);
  expect(savedConfig(putBodies, 1)).toMatchObject({ skills: 'all' });

  await chooseSelectOption(page, modeSelect(region), 'nincs beállítva');
  await saveButton(page).click();
  await expect.poll(() => putBodies.length).toBe(3);
  expect(savedConfig(putBodies, 2)).toMatchObject({ skills: null });
});

test('a könyvtárból törölt, de hivatkozott skill "hiányzik" jelzéssel bejelölve marad, a mentés megtartja, a jelölés levétele kiveszi', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(['alfa', 'torolt'], {})), putBodies);
  const region = await openStepSkills(page);

  await expect(modeSelect(region)).toHaveText('kiválasztott skillek');
  await expect(region.getByRole('checkbox', { name: 'alfa', exact: true })).toBeChecked();
  const missing = region.getByRole('checkbox', { name: 'torolt (hiányzik a könyvtárból)', exact: true });
  await expect(missing).toBeChecked();
  await expect(region.getByText('A könyvtárból hiányzó skillre a futás indítása hibával áll meg')).toBeVisible();

  await toggle(region, 'torolt (hiányzik a könyvtárból)');
  await expect(missing).toBeAttached({ attached: false });
  await expect(region.getByText('A könyvtárból hiányzó skillre a futás indítása hibával áll meg')).toBeAttached({
    attached: false,
  });
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedConfig(putBodies, 0)).toMatchObject({ skills: ['alfa'] });
});

test('érintetlenül hagyott hiányzó név a mentés PUT törzsében megmarad, csendben nem tűnik el', async ({ page }) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(['torolt'], {})), putBodies);
  const region = await openStepSkills(page);
  await expect(region.getByRole('checkbox', { name: 'torolt (hiányzik a könyvtárból)', exact: true })).toBeChecked();
  await toggle(region, 'beta');
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedConfig(putBodies, 0)).toMatchObject({ skills: ['torolt', 'beta'] });
});

test('az agent definíció `skills` mezője ugyanígy szerkeszthető, a hiányzó kulcs "nincs beállítva", és a többi mező megmarad', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(null, { kutato: KUTATO })), putBodies);
  const region = await openDefinitionSkills(page);

  await expect(modeSelect(region)).toHaveText('nincs beállítva');
  await chooseSelectOption(page, modeSelect(region), 'kiválasztott skillek');
  await toggle(region, 'alfa');

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedConfig(putBodies, 0)).toMatchObject({
    skills: null,
    agents: { kutato: { ...KUTATO, skills: ['alfa'] } },
  });
});

test('az agent definíció érvénytelen alakú `skills` értéke megnevezve jelenik meg, és bármelyik mód kiválasztása felülírja', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await openEditor(page, graphWith(agentStepConfig(null, { kutato: { ...KUTATO, skills: 5 } })), putBodies);
  const region = await openDefinitionSkills(page);

  await expect(modeSelect(region)).toHaveText('ismeretlen alak');
  await expect(region.getByText('A tárolt érték alakja érvénytelen (5)')).toBeVisible();

  await chooseSelectOption(page, modeSelect(region), 'minden feltöltött skill');
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(savedConfig(putBodies, 0)).toMatchObject({ agents: { kutato: { ...KUTATO, skills: 'all' } } });
});

test('a könyvtár betöltése alatt csontváz áll, utána megjelennek a jelölőnégyzetek; a mód választó közben is használható', async ({
  page,
}) => {
  const gate = createRequestGate();
  await openEditor(page, graphWith(agentStepConfig(['alfa'], {})), [], async (route) => {
    await gate.passed;
    await route.fulfill(jsonBody(SKILLS));
  });
  const region = await openStepSkills(page);

  await expect(region.locator('[aria-busy="true"]')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);
  await expect(modeSelect(region)).toBeEnabled();

  gate.open();
  await expect(region.getByRole('checkbox', { name: 'alfa', exact: true })).toBeChecked();
  await expect(region.locator('[aria-busy="true"]')).toBeAttached({ attached: false });
});

test('a könyvtár betöltési hibája danger Alert, jelölőnégyzetek nélkül', async ({ page }) => {
  await openEditor(page, graphWith(agentStepConfig(['alfa'], {})), [], async (route) =>
    route.fulfill(jsonBody({ code: 'internal_error', message: 'hiba' }, 500)),
  );
  const region = await openStepSkills(page);

  await expect(region.getByRole('alert')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);
});

test('üres könyvtárnál az üres állapot áll a jelölőnégyzetek helyén', async ({ page }) => {
  await openEditor(page, graphWith(agentStepConfig([], {})), [], async (route) => route.fulfill(jsonBody([])));
  const region = await openStepSkills(page);

  await expect(region.getByText('Még nincs feltöltött skill.')).toBeVisible();
  await expect(region.getByRole('checkbox')).toHaveCount(0);
});
