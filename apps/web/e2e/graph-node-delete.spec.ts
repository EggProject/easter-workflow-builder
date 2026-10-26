// E2E a csomópont törlésére (SPEC-008 5.9, T-009-44): a billentyűs törlés
// (`deleteKeyCode`) és a beállítás panel "Törlés" gombja valós Chromiumban.
//
// A MÉRT HIBA, ami a PUT törzs vizsgálatát indokolja. A könyvtár a billentyűs
// törlést két külön változáslistában jelzi (előbb az élek, utána a
// csomópontok); a két kezelő a saját propjaiból építette a gráfot, ezért a
// második hívás visszaírta az elsőét: a törölt csomópont élei a szerkesztett
// állapotban maradtak, miközben a vásznon már nem rajzolódtak ki (az élt a
// könyvtár a hiányzó csomópont miatt nem rajzolja). A hibát ezért kizárólag a
// mentés kérés törzse mutatja (docs/research/2026-10-14-csomopont-felvetel.md,
// T-009-44 szekció).
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

const UNSAVED_CHANGES_TEXT = 'Mentetlen változtatások';

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
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  sessionMode: 'isolated',
  structuredOutput: null,
  onUnhandledError: 'fail_run',
};

// Átlós elrendezés, a `graph-edge-selection.spec.ts` mérésével azonos okból:
// egy vízszintes él befoglaló doboza 0 magas, amit a Playwright rejtettnek lát.
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
 * A mentés kérés törzsei, a teszt mockja gyűjti.
 */
const savedBodies: string[] = [];

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

function edgeLocator(page: Page, edgeId: string): Locator {
  return page.getByTestId(`rf__edge-${edgeId}`);
}

function unsavedIndicator(page: Page): Locator {
  return page.getByRole('status').filter({ hasText: UNSAVED_CHANGES_TEXT });
}

/**
 * A "Mentés" gomb megnyomása után a PUT törzs, a kérés sémája szerint értelmezve.
 */
async function saveAndReadGraph(page: Page): Promise<ReplaceGraphRequest> {
  const requestsBefore = savedBodies.length;
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect.poll(() => savedBodies.length).toBe(requestsBefore + 1);
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(savedBodies[requestsBefore] ?? 'null'));
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

/**
 * A PUT törzs csomópont és él azonosítói.
 */
async function saveAndReadGraphIds(page: Page): Promise<{ nodeIds: string[]; edgeIds: string[] }> {
  const graph = await saveAndReadGraph(page);
  return { nodeIds: graph.nodes.map((node) => node.id), edgeIds: graph.edges.map((edge) => edge.id) };
}

test.beforeEach(async ({ page }) => {
  savedBodies.length = 0;
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      savedBodies.push(route.request().postData() ?? '');
      await route.fulfill(jsonBody(GRAPH));
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/editor?workflowId=w-alfa');
  await expect(edgeLocator(page, 'e1')).toBeVisible();
});

for (const key of ['Backspace', 'Delete']) {
  test(`a(z) ${key} billentyű a kiválasztott csomópontot a rá kötött éllel együtt törli, a mentett gráfban nem marad árva él`, async ({
    page,
  }) => {
    await nodeLocator(page, 'n3').click();
    await expect(nodeLocator(page, 'n3')).toHaveClass(/selected/);

    await page.keyboard.press(key);

    await expect(nodeLocator(page, 'n3')).toBeAttached({ attached: false });
    await expect(edgeLocator(page, 'e2')).toBeAttached({ attached: false });
    await expect(nodeLocator(page, 'n2')).toBeVisible();
    await expect(edgeLocator(page, 'e1')).toBeVisible();
    await expect(page.getByRole('complementary')).toBeHidden();
    await expect(unsavedIndicator(page)).toHaveText('Mentetlen változtatások');

    expect(await saveAndReadGraphIds(page)).toEqual({ nodeIds: ['n1', 'n2'], edgeIds: ['e1'] });
  });
}

// Az él billentyűs törlése a `Delete` billentyűvel is (SPEC-008 82. kritérium);
// a `Backspace` útját a `graph-edge-selection.spec.ts` fedi.
test('a Delete billentyű a kiválasztott élt törli, a csomópontok és a másik él maradnak, a mentett gráfban sincs meg', async ({
  page,
}) => {
  await edgeLocator(page, 'e2').click();
  await expect(edgeLocator(page, 'e2')).toHaveClass(/selected/);

  await page.keyboard.press('Delete');

  await expect(edgeLocator(page, 'e2')).toBeAttached({ attached: false });
  await expect(edgeLocator(page, 'e1')).toBeVisible();
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(nodeLocator(page, 'n3')).toBeVisible();
  await expect(unsavedIndicator(page)).toHaveText('Mentetlen változtatások');

  expect(await saveAndReadGraphIds(page)).toEqual({ nodeIds: ['n1', 'n2', 'n3'], edgeIds: ['e1'] });
});

test('a panel Törlés gombja megerősítés nélkül törli a csomópontot és a rá kötött éleket, a panel bezárul, kérés nem indul', async ({
  page,
}) => {
  await nodeLocator(page, 'n2').click();
  const dangerButton = page.getByRole('button', { name: 'Törlés' });
  await expect(dangerButton).toBeInViewport({ ratio: 1 });

  await dangerButton.click();

  await expect(nodeLocator(page, 'n2')).toBeAttached({ attached: false });
  await expect(edgeLocator(page, 'e1')).toBeAttached({ attached: false });
  await expect(edgeLocator(page, 'e2')).toBeAttached({ attached: false });
  await expect(page.getByRole('complementary')).toBeHidden();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(unsavedIndicator(page)).toHaveText('Mentetlen változtatások');
  expect(savedBodies).toEqual([]);

  expect(await saveAndReadGraphIds(page)).toEqual({ nodeIds: ['n1', 'n3'], edgeIds: [] });
});

test('a Start nem törölhető: a billentyűk után a vásznon marad a rá kötött éllel, a panelén nincs Törlés gomb', async ({
  page,
}) => {
  await nodeLocator(page, 'n1').click();
  await expect(nodeLocator(page, 'n1')).toHaveClass(/selected/);
  await expect(page.getByRole('complementary')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Törlés' })).toHaveCount(0);

  await page.keyboard.press('Backspace');
  await page.keyboard.press('Delete');

  await expect(nodeLocator(page, 'n1')).toBeVisible();
  await expect(edgeLocator(page, 'e1')).toBeVisible();
  await expect(unsavedIndicator(page)).toBeHidden();
});

test('beviteli mezőben a Backspace és a Delete a mezőt szerkeszti, a kiválasztott csomópontot nem törli', async ({
  page,
}) => {
  await nodeLocator(page, 'n2').click();
  const promptField = page.getByRole('textbox', { name: 'Prompt sablon' });
  await promptField.click();
  await promptField.press('End');

  await promptField.press('Backspace');
  await promptField.press('Backspace');

  await expect(promptField).toHaveValue('Foglald össze a bemenete');
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(edgeLocator(page, 'e1')).toBeVisible();

  await promptField.press('Home');
  await promptField.press('Delete');

  await expect(promptField).toHaveValue('oglald össze a bemenete');
  await expect(nodeLocator(page, 'n2')).toBeVisible();
});

// A beállítás panel teljes területén a billentyű nem töröl csomópontot (user
// döntés 2026-10-14, SPEC-008 5.9): a panel gyökerén a React Flow `nokey`
// osztálya áll. A vizsgált vezérlők nem beviteli elemek, tehát a könyvtár saját
// beviteli elem szűrője őket nem védi (research T-009-44, 44.6). Ugyanaz a
// kiválasztott csomópont és ugyanaz a billentyű: kizárólag a fókusz helye dönt.
for (const key of ['Backspace', 'Delete']) {
  test(`a panel gombján és a választó triggerén lenyomott ${key} nem töröl, a vásznon kiválasztott csomópontra viszont igen`, async ({
    page,
  }) => {
    await nodeLocator(page, 'n2').click();
    await expect(nodeLocator(page, 'n2')).toHaveClass(/selected/);
    const panel = page.getByRole('complementary');
    const policySelect = panel.getByRole('combobox', { name: 'Kezeletlen hiba szabálya' });
    const panelControls = [
      panel.getByRole('button', { name: 'Bezárás' }),
      panel.getByRole('button', { name: 'Törlés' }),
      policySelect,
    ];

    for (const control of panelControls) {
      await control.focus();
      await expect(control).toBeFocused();
      await page.keyboard.press(key);
      await expect(nodeLocator(page, 'n2')).toBeVisible();
      await expect(edgeLocator(page, 'e1')).toBeVisible();
      await expect(edgeLocator(page, 'e2')).toBeVisible();
    }
    // A nyitott lista a panelen kívül, a `document.body`-ban áll, a DOM fókusz
    // viszont a triggeren marad.
    await policySelect.click();
    await expect(policySelect).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press(key);
    await expect(nodeLocator(page, 'n2')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(policySelect).toHaveAttribute('aria-expanded', 'false');
    await expect(unsavedIndicator(page)).toBeHidden();

    await nodeLocator(page, 'n2').click();
    await page.keyboard.press(key);

    await expect(nodeLocator(page, 'n2')).toBeAttached({ attached: false });
    await expect(edgeLocator(page, 'e1')).toBeAttached({ attached: false });
    await expect(edgeLocator(page, 'e2')).toBeAttached({ attached: false });
    expect(await saveAndReadGraphIds(page)).toEqual({ nodeIds: ['n1', 'n3'], edgeIds: [] });
  });
}

test('a csomópont húzása a szerkesztett gráfba írja az új pozíciót, a többi csomópont és az élek nem változnak', async ({
  page,
}) => {
  const box = await nodeLocator(page, 'n2').boundingBox();
  if (box === null) {
    throw new Error('az n2 csomópontnak nincs befoglaló doboza');
  }
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;

  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 40, centerY + 30, { steps: 5 });
  await page.mouse.move(centerX + 80, centerY + 60, { steps: 5 });
  await page.mouse.up();

  await expect(unsavedIndicator(page)).toHaveText('Mentetlen változtatások');
  const saved = await saveAndReadGraph(page);
  const positions = new Map(saved.nodes.map((node) => [node.id, { x: node.positionX, y: node.positionY }]));
  expect(positions.get('n1')).toEqual({ x: 0, y: 0 });
  expect(positions.get('n3')).toEqual({ x: 1000, y: 480 });
  expect(positions.get('n2')?.x).toBeGreaterThan(500);
  expect(positions.get('n2')?.y).toBeGreaterThan(240);
  expect(saved.edges.map((edge) => edge.id)).toEqual(['e1', 'e2']);
});
