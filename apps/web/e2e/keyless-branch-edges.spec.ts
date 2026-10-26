// E2E a kulcs nélküli elágazás kimenet megszüntetésére és a régi, kulcs
// nélküli elágazás élek elhagyására (PLAN-009 T-009-54, SPEC-008 5.1, O-23,
// O-27, 106., a 108. futás nézet része).
//
// Amit véd: (1) a `branch` kártya a szerkesztőben és a futás nézetben is
// pontosan a `config.branches` lista szerint rajzol kimenő handle-t, a saját
// kulcsával és címkéjével, és "Alapértelmezett" nevű handle egyik képernyőn
// sincs; (2) egy `branch` forrású, `null` kulcsú élt tartalmazó pillanatképre a
// futás nézet ezt az élt nem rajzolja, a többit (köztük más típusú csomópontok
// `null` kulcsú éleit) igen. A szűrő nélkül a React Flow a `null` handle
// azonosítójú élt az első handle-hez kötve rajzolná (SPEC-008 M-111), tehát a
// (2) állítás a szűrő bekötését bizonyítja.
//
// Amit NEM bizonyít: a szerkesztő betöltésének elhagyását és a mentetlen
// jelzőt (a 108. szerkesztő része, T-009-55), és az élek kifestett vonalát (a
// `showcase-graph.spec.ts` és a `run-graph-paint.spec.ts` dolga). Minden REST
// hívás `page.route()` mockon megy, az SSE csatorna egyetlen `stream_ready`
// kereten (`.claude/CLAUDE.md` 11. szekció).
import type { NodeConfig, RunDetail, RunSnapshotResponse } from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import {
  installShowcaseMocks,
  installShowcaseRunMocks,
  openShowcaseEditor,
  openShowcaseRunView,
  SHOWCASE_GRAPH,
} from './showcase-graph.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), ugyanaz a minta, mint a `run-view.spec.ts`-ben */

const SHOWCASE_BRANCH_NODE_ID = 'n-branch';

/**
 * A kimenő ("source") handle-ök egy csomóponton belül. A `Handle` elem sem
 * szerepet, sem tesztelési azonosítót nem hordoz, ezért a könyvtár saját
 * `.react-flow__handle` és `.source` osztálya a fogódzó, ugyanúgy, mint a
 * `graph-node-card.spec.ts` `outputHandles` segédjében (locator sorrend utolsó
 * eset); a csomópont maga a React Flow `rf__node-` fogódzójával (SPEC-008 12.3).
 */
async function expectShowcaseBranchHandles(page: Page): Promise<void> {
  const branchNode = SHOWCASE_GRAPH.nodes.find((node) => node.id === SHOWCASE_BRANCH_NODE_ID);
  if (branchNode?.config.type !== 'branch') {
    throw new Error('a bemutató fixtúrában nincs branch konfigurációjú n-branch csomópont');
  }
  const handles = page.getByTestId(`rf__node-${SHOWCASE_BRANCH_NODE_ID}`).locator('.react-flow__handle.source');
  await expect(handles).toHaveCount(branchNode.config.branches.length);
  for (const [index, branch] of branchNode.config.branches.entries()) {
    await expect(handles.nth(index)).toHaveAttribute('data-handleid', branch.key);
    await expect(handles.nth(index)).toHaveAccessibleName(branch.label);
  }
  await expect(page.locator('.react-flow__handle[aria-label="Alapértelmezett"]')).toHaveCount(0);
}

test('a szerkesztőben az elágazás kártyája ágankénti egy, kulcsos kimenetet rajzol, "Alapértelmezett" handle nélkül', async ({
  page,
}) => {
  await installShowcaseMocks(page);
  await openShowcaseEditor(page);

  await expectShowcaseBranchHandles(page);
});

test('a futás nézetben az elágazás kártyája ágankénti egy, kulcsos kimenetet rajzol, "Alapértelmezett" handle nélkül', async ({
  page,
}) => {
  await installShowcaseRunMocks(page);
  await openShowcaseRunView(page);

  await expectShowcaseBranchHandles(page);
});

const BRANCH_CONFIG: NodeConfig = {
  type: 'branch',
  expression: 'input.kind',
  branches: [
    { key: 'igen', label: 'Igen' },
    { key: 'nem', label: 'Nem' },
  ],
  defaultBranchKey: 'nem',
  onUnhandledError: null,
};

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
  onUnhandledError: null,
};

const ERROR_HANDLER_CONFIG: NodeConfig = {
  type: 'error_handler',
  maxAttempts: 3,
  backoffMs: [1000],
  handledErrorKinds: ['timeout'],
  onUnhandledError: null,
};

const LEGACY_RUN_ID = 'run-regi-el';

const LEGACY_EDGE_ID = 'k-e-regi';

/**
 * Egy régi pillanatkép: az elágazásnak a két kulcsos éle mellett egy kulcs
 * nélküli éle is van (`k-e-regi`), amit a korábbi szerkesztő kötött. Mellette
 * három MÁS típusú csomópont `null` kulcsú éle áll (`start`, `agent_step`,
 * `error_handler`), plusz az `error_handler` kulcsos `on_error` éle.
 */
const LEGACY_SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-regi-el', name: 'Régi élű workflow', description: null },
  nodes: [
    {
      id: 'k-start',
      type: 'start',
      label: 'Indítás',
      position: { x: 0, y: 0 },
      config: { type: 'start', inputFields: [], onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'k-branch',
      type: 'branch',
      label: 'Döntés',
      position: { x: 450, y: 0 },
      config: BRANCH_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'k-agent',
      type: 'agent_step',
      label: 'Összegzés',
      position: { x: 900, y: -200 },
      config: AGENT_STEP_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'k-handler',
      type: 'error_handler',
      label: 'Újrapróbálás',
      position: { x: 900, y: 200 },
      config: ERROR_HANDLER_CONFIG,
      effectiveProviderId: 'claude-subscription',
    },
    {
      id: 'k-join',
      type: 'join',
      label: 'Összefésülés',
      position: { x: 1350, y: 0 },
      config: { type: 'join', mode: 'merge', onUnhandledError: null },
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [
    {
      id: 'k-e-start',
      sourceNodeId: 'k-start',
      targetNodeId: 'k-branch',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: 'k-e-igen',
      sourceNodeId: 'k-branch',
      targetNodeId: 'k-agent',
      sourceHandle: 'igen',
      targetHandle: null,
      branchKey: 'igen',
    },
    {
      id: 'k-e-nem',
      sourceNodeId: 'k-branch',
      targetNodeId: 'k-handler',
      sourceHandle: 'nem',
      targetHandle: null,
      branchKey: 'nem',
    },
    {
      id: LEGACY_EDGE_ID,
      sourceNodeId: 'k-branch',
      targetNodeId: 'k-join',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: 'k-e-agent',
      sourceNodeId: 'k-agent',
      targetNodeId: 'k-join',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: 'k-e-handler',
      sourceNodeId: 'k-handler',
      targetNodeId: 'k-join',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    },
    {
      id: 'k-e-hiba',
      sourceNodeId: 'k-handler',
      targetNodeId: 'k-join',
      sourceHandle: 'on_error',
      targetHandle: null,
      branchKey: 'on_error',
    },
  ],
};

const LEGACY_RUN_DETAIL: RunDetail = {
  id: LEGACY_RUN_ID,
  workflowId: 'w-regi-el',
  status: 'running',
  input: null,
  providerId: 'claude-subscription',
  rootRunId: LEGACY_RUN_ID,
  depth: 0,
  workflowAncestry: ['w-regi-el'],
  graphSnapshotHash: 'd'.repeat(64),
  persistedStreamDeltas: false,
  restartedFromRunId: null,
  createdAtMs: 1,
  startedAtMs: 2,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

/* eslint-enable unicorn/no-null */

test('egy kulcs nélküli elágazás élt tartalmazó pillanatképre a futás nézet ezt az élt nem rajzolja, a többit igen', async ({
  page,
}) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(LEGACY_RUN_DETAIL))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(LEGACY_SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
  ]);

  await page.goto(`/run?runId=${LEGACY_RUN_ID}`);

  for (const node of LEGACY_SNAPSHOT.nodes) {
    await expect(page.getByTestId(`rf__node-${node.id}`)).toBeVisible();
  }
  // Az élekre `toBeAttached` jár, nem `toBeVisible`: egy vízszintes él doboza
  // 0 magas (a `showcase-graph.ts` `waitForShowcaseGraph` doksija). Az összes
  // megtartott él a DOM-ban van, mielőtt az elhagyott él hiányát állítjuk, tehát
  // a hiány nem a még be nem fejezett rajzolásból jön.
  const keptEdges = LEGACY_SNAPSHOT.edges.filter((edge) => edge.id !== LEGACY_EDGE_ID);
  for (const edge of keptEdges) {
    await expect(page.getByTestId(`rf__edge-${edge.id}`)).toBeAttached();
  }
  await expect(page.locator('.react-flow__edge')).toHaveCount(keptEdges.length);
  await expect(page.getByTestId(`rf__edge-${LEGACY_EDGE_ID}`)).toHaveCount(0);
});
