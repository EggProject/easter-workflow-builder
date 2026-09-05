// Regressziós e2e a `graph-auto-layout` témára (T-009-19, SPEC-008 5.7): az
// "Elrendezés" gomb, a dagre LR elrendezés valódi böngészőben, és a
// mentetlen jelzővel való kölcsönhatás. A `layout-graph.ts` e2e lefedettsége
// korábban 0 százalék volt, mert a `graph-editor.spec.ts` egyetlen tesztje
// sem kattintott erre a gombra - a dagre hívás maga (`Graph`/`setNode`/
// `setEdge`/`layout`) unit teszttel (`layout-graph.spec.ts`) már fedett volt,
// de sosem futott le a tényleges böngészőben instrumentált build ellen.
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

/**
 * A kezdeti pozíciók SZÁNDÉKOSAN fordítottak: az `n-start` (az egyetlen
 * bejövő él nélküli csomópont, tehát a dagre gyökere) a legnagyobb X-en áll,
 * a lánc vége a legkisebbön. A `rankdir: 'LR'` elrendezés ettől garantáltan
 * MEGVÁLTOZTATJA a sorrendet - a teszt ezért nem csak azt ellenőrzi, hogy
 * "valami történt", hanem hogy a végeredmény ténylegesen az élek iránya
 * szerint balról jobbra halad.
 */
const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 800,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent-a',
      type: 'agent_step',
      label: 'Első lépés',
      positionX: 0,
      positionY: 300,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent-b',
      type: 'agent_step',
      label: 'Második lépés',
      positionX: 400,
      positionY: 600,
      config: AGENT_STEP_CONFIG,
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
    {
      id: 'e2',
      sourceNodeId: 'n-agent-a',
      targetNodeId: 'n-agent-b',
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
 * A React Flow saját, dokumentált `data-testid="rf__node-<id>"` fogódzója
 * (lásd `graph-editor.spec.ts` azonos nevű függvénye): a node kártya
 * `role="group"` szerepe azonos és szerző adta hozzáférhető név nélküli, a
 * `getByText` pedig csak nem interaktív elemre való - se a `getByRole`, se a
 * `getByText` nem alkalmazható, ezért a locator sorrend szerint indokolt
 * `getByTestId` a `rf__` előtagú kivétellel.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

async function requireBoundingBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (box === null) {
    throw new Error('a teszt nem talált mérhető dobozt a locatorhoz');
  }
  return box;
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
});

test('az "Elrendezés" gomb balról jobbra rendezi a csomópontokat, és mentés nélkül piszkos állapotba viszi a gráfot', async ({
  page,
}) => {
  let saveCallCount = 0;
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      saveCallCount += 1;
      await route.fulfill(jsonBody(GRAPH));
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);

  await expect(nodeLocator(page, 'n-start')).toBeVisible();
  await expect(nodeLocator(page, 'n-agent-a')).toBeVisible();
  await expect(nodeLocator(page, 'n-agent-b')).toBeVisible();

  // Betöltés után a gráf még nem piszkos: a jelző nincs a DOM-ban.
  await expect(page.getByRole('status')).toBeHidden();

  const beforeStart = await requireBoundingBox(nodeLocator(page, 'n-start'));

  await page.getByRole('button', { name: 'Elrendezés' }).click();

  // A jelző megjelenik: a `layoutGraph` hívása a `currentNodes` állapotot
  // írta át, ami az `isGraphDirty`-t igazra váltja - mentés nem történt.
  await expect(page.getByRole('status')).toHaveText('Mentetlen változtatások');
  expect(saveCallCount).toBe(0);

  const afterStart = await requireBoundingBox(nodeLocator(page, 'n-start'));
  const afterAgentA = await requireBoundingBox(nodeLocator(page, 'n-agent-a'));
  const afterAgentB = await requireBoundingBox(nodeLocator(page, 'n-agent-b'));

  // A kezdeti elrendezés fordított (`n-start` a jobb szélen); a dagre LR
  // elrendezés UTÁN az élek iránya szerinti, balról jobbra sorrendnek kell
  // állnia.
  expect(afterStart.x).toBeLessThan(afterAgentA.x);
  expect(afterAgentA.x).toBeLessThan(afterAgentB.x);
  // A pozíció ténylegesen megváltozott a kattintás hatására.
  expect(afterStart.x).not.toBe(beforeStart.x);
});
