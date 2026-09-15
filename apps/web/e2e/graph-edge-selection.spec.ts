// Regressziós e2e az él kiválasztására és törlésére (2026-09-06).
//
// A MÉRT HIBA, ami ezt a fájlt indokolja. A vezérelt vásznon egy élre
// kattintva az él NEM lett kiválasztott: a kattintás után az elem `class`
// attribútuma `selected` osztály nélkül maradt, ezért a React Flow
// dokumentált `deleteKeyCode` alapértelmezése (`Backspace`,
// `@xyflow/react@12.11.6`) sem tudott mit törölni - az él a `Backspace`
// után is a vásznon maradt, és a mentetlen jelző sem jelent meg. A gyökérok
// ugyanaz a minta, mint a mért csomópont méretnél: a kiválasztás NÉZETI
// állapot, amit a `WorkflowEdgeInput` nem hordoz, tehát a vezérelt
// oda-vissza leképezésen elveszett (`src/graph-editor/graph-selection.ts`).
//
// Ugyanezen mérés második fele: amíg a csomópont kiválasztás megszűnését
// jelző változás is elveszett, egy kiválasztott csomópont mellett az élre
// kattintva a `Backspace` a CSOMÓPONTOT törölte (és vele kaszkádban az
// élt is), nem a kiválasztott élt.
//
// A fixture átlós elrendezésű, a `graph-editor.spec.ts` mérésével azonos
// okból: egy tökéletesen vízszintes él befoglaló doboza 0 magas, amit a
// Playwright láthatóság definíciója rejtettnek lát
// (https://playwright.dev/docs/actionability#visible).
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

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Ügyfél kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
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
    // A harmadik csomópont és a második él azért kell, hogy a törlés után
    // MARADJON él: így az `onEdgesChange` domain ága a megmaradó élt
    // ténylegesen visszaképezi a `flowEdgeToWorkflowEdge` függvényen, nem
    // egy üres listát ad tovább.
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

const EDITOR_URL = '/editor?workflowId=w-alfa';

/**
 * A React Flow saját, dokumentált tesztelési fogódzója az élen és a
 * csomóponton (`data-testid="rf__edge-<id>"`, `rf__node-<id>`). A projekt
 * kötött locator sorrendje ezt a kivételt kimondottan megengedi
 * (SPEC-008 12.3): az él és a csomópont `role="group"` szerepe azonos és
 * szerző adta hozzáférhető név nélküli, tehát a `getByRole` nem
 * különbözteti meg őket.
 */
function edgeLocator(page: Page): Locator {
  return page.getByTestId('rf__edge-e1');
}

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(edgeLocator(page)).toBeVisible();
});

test('egy élre kattintva az él kiválasztott lesz, a vászonra kattintva pedig már nem', async ({ page }) => {
  const edge = edgeLocator(page);
  await edge.click();
  await expect(edge).toHaveClass(/selected/);

  // A vászon üres részére kattintva a React Flow `resetSelectedElements`
  // hívása `select: false` változást ad, aminek ugyanúgy vissza kell jutnia
  // a megjelenített állapotba.
  await page.getByTestId('rf__wrapper').click({ position: { x: 30, y: 30 } });
  await expect(edge).not.toHaveClass(/selected/);
});

test('a kiválasztott él a Backspace billentyűre törlődik, a másik él és a csomópontok maradnak', async ({ page }) => {
  const edge = edgeLocator(page);
  await edge.click();
  await expect(edge).toHaveClass(/selected/);

  await page.keyboard.press('Backspace');

  await expect(edge).toBeAttached({ attached: false });
  // A NEM kiválasztott él megmarad: a domain visszaképzés a megmaradó élen
  // ténylegesen lefut.
  await expect(page.getByTestId('rf__edge-e2')).toBeVisible();
  await expect(nodeLocator(page, 'n1')).toBeVisible();
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(nodeLocator(page, 'n3')).toBeVisible();
  // A törlés a szerkesztett gráfot módosítja, tehát a mentetlen jelző
  // megjelenik (SPEC-008 5.5).
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');
});

test('a kiválasztott csomópont a Backspace billentyűre törlődik, a rá kötött éllel együtt', async ({ page }) => {
  await nodeLocator(page, 'n3').click();
  await expect(nodeLocator(page, 'n3')).toHaveClass(/selected/);
  // A beállítás panel bezárul, mert a szerkesztett csomópont megszűnik.
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();

  await page.keyboard.press('Backspace');

  await expect(nodeLocator(page, 'n3')).toBeAttached({ attached: false });
  await expect(page.getByTestId('rf__edge-e2')).toBeAttached({ attached: false });
  await expect(nodeLocator(page, 'n1')).toBeVisible();
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(edgeLocator(page)).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');
});

test('kiválasztott csomópont mellett az élre kattintva a Backspace az ÉLT törli, nem a csomópontot', async ({
  page,
}) => {
  // A csomópont kiválasztása megnyitja a beállítás panelt.
  await nodeLocator(page, 'n2').click();
  await expect(nodeLocator(page, 'n2')).toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeVisible();

  // Az élre kattintva a React Flow a csomópont kiválasztását megszünteti; a
  // panelnek is be kell zárulnia.
  const edge = edgeLocator(page);
  await edge.click();
  await expect(edge).toHaveClass(/selected/);
  await expect(nodeLocator(page, 'n2')).not.toHaveClass(/selected/);
  await expect(page.getByRole('button', { name: 'Bezárás' })).toBeAttached({ attached: false });

  await page.keyboard.press('Backspace');

  await expect(edge).toBeAttached({ attached: false });
  await expect(nodeLocator(page, 'n1')).toBeVisible();
  await expect(nodeLocator(page, 'n2')).toBeVisible();
  await expect(nodeLocator(page, 'n3')).toBeVisible();
});
