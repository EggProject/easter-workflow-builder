// A repóban élő, verziókövetett BEMUTATÓ gráf fixtúra és a hozzá tartozó
// mockolás (2026-09-09).
//
// MIÉRT LÉTEZIK EZ A FÁJL. A képernyőkép készítő script korábban a repón
// KÍVÜL, eldobható helyen élt, és minden munkamenet újraírta. Két
// alkalommal ÜRES `edges` tömbbel adta vissza a gráfot a
// `readWorkflowGraph` mockon, egyszer pedig két csomópontra szűkítve -
// ahol nincs él, ott nincs mit kirajzolni, tehát a szállított
// képernyőképeken nem volt vonal, és a felhasználó jogosan hitte, hogy a
// termék vesztette el az éleket. A bisect és a pixel mérés szerint a
// termékkód végig hibátlan volt
// (`docs/research/2026-09-09-graf-el-vonal-meres.md` 3. szekció).
//
// A VÉDELEM, amit ez a fájl ad: egyetlen, verziókövetett fixtúra, amit
// EGYSZERRE használ a képernyőkép készítés (`capture-screenshots.ts`) és a
// regressziós teszt (`showcase-graph.spec.ts`). Ha az élek eltűnnek innen,
// a `bun run test:e2e` kapu bukik, tehát a hiba nem tud csendben
// visszatérni.
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import { expect, type Page } from '@playwright/test';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const START_CONFIG: NodeConfig = {
  type: 'start',
  inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }],
  onUnhandledError: null,
};

const BRANCH_CONFIG: NodeConfig = {
  type: 'branch',
  expression: 'input.kind',
  branches: [
    { key: 'kutatas', label: 'Kutatás' },
    { key: 'osszegzes', label: 'Összegzés' },
    { key: 'metaadat', label: 'Metaadat' },
    { key: 'jovahagyas', label: 'Jóváhagyás' },
  ],
  defaultBranchKey: null,
  onUnhandledError: null,
};

const FAN_OUT_CONFIG: NodeConfig = {
  type: 'fan_out',
  itemsExpression: 'input.sources',
  branchLabelTemplate: 'Forrás #{{index}}',
  onUnhandledError: null,
};

const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
  promptTemplate: 'Összegezd a bemenetet.',
  providerId: null,
  modelId: null,
  effort: null,
  thinking: null,
  allowedTools: ['Read'],
  disallowedTools: [],
  permissionMode: null,
  maxTurns: null,
  maxBudgetUsd: null,
  systemPrompt: null,
  agents: { kutato: { description: 'Kutat a weben.', prompt: 'Kutass alaposan.', skills: 'all' } },
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

const SCRIPT_CONFIG: NodeConfig = {
  type: 'script',
  source: 'return input.metadata;',
  runtime: 'expression',
  onUnhandledError: null,
};

const LOOP_CONFIG: NodeConfig = {
  type: 'loop',
  maxIterations: 3,
  continueExpression: 'input.hasMore',
  onUnhandledError: null,
};

const HUMAN_APPROVAL_CONFIG: NodeConfig = {
  type: 'human_approval',
  title: 'Jóváhagyás szükséges',
  bodyTemplate: 'Kérlek hagyd jóvá a lépést.',
  timeoutMs: null,
  onUnhandledError: null,
};

const JOIN_CONFIG: NodeConfig = {
  type: 'join',
  mode: 'merge',
  settings: {},
  onUnhandledError: null,
};

/**
 * Az oszlop (rang) és a sor koordináták. A vízszintes osztás a kártya mért
 * szélessége (`GRAPH_NODE_CARD_WIDTH`, 358) plusz a dagre dokumentált
 * alapértelmezett `ranksep` értéke (50), a függőleges a mért kártya magasság
 * (106) plusz ugyanaz az 50 - tehát a fixtúra UGYANOLYAN alakú, mint amit a
 * felület saját "Elrendezés" gombja (`graph-auto-layout`, `rankdir: 'LR'`)
 * készítene, csak kézzel rögzítve, hogy a képernyőkép determinisztikus
 * legyen. A számokat nem itt találjuk ki: a kártya méret az
 * `apps/web/src/graph-node-catalog/graph-node-catalog.ts` mért konstansa, a
 * `ranksep`/`nodesep` a `@dagrejs/dagre` szállított alapértelmezése.
 *
 * A NÉGY OSZLOP FELSŐ KORLÁT, nem esztétikai döntés: a React Flow
 * `minZoom` alapértelmezése `0.5` (a szállított forrásban, `minZoom = 0.5`),
 * a `fitView` pedig `zoom = szélesség / (tartalom * (1 + padding))` alakban
 * számol. Egy 1440x900-as ablakban, nyitott beállítás panel mellett a vászon
 * kb. 1013 pixel széles, tehát a tartalom nem lehet szélesebb
 * 1013 / (0.5 * 1.1) = 1842 pixelnél, különben a `fitView` a `minZoom`-on
 * megáll és a gráf jobb széle levágódik. Négy oszlop 1582 pixel, tehát elfér
 * (a mért illesztési nagyítás 0.58).
 */
const COLUMN_X = [0, 408, 816, 1224] as const;
const ROW_Y = [0, 156, 312, 468, 624] as const;

/**
 * A bemutató workflow: nyolc csomópont típus, egy ötfelé ágazó elágazás, öt
 * párhuzamos ág és egy ötfelől összefésülő `join`. **Minden csomópont be van
 * kötve**, és tizenegy él van - ez a fixtúra invariánsa, amit a
 * `showcase-graph.spec.ts` regressziós tesztje őriz.
 *
 * Minden él SZIGORÚAN balról jobbra, a szomszédos oszlopok között halad.
 * Ez nem esztétikai szeszély: a React Flow alapértelmezett él típusa a
 * forrás JOBB és a cél BAL oldali handle-jét köti össze, tehát egy oszlopon
 * belüli (vagy visszafelé mutató) él a forrás jobb oldalán kifelé kanyarodik,
 * és ez a kanyar a vászon szélén levágódik - mérve, az előző fixtúra
 * elrendezésén.
 */
export const SHOWCASE_GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Kérés fogadása',
      positionX: COLUMN_X[0],
      positionY: ROW_Y[2],
      config: START_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-branch',
      type: 'branch',
      label: 'Kérés típusa',
      positionX: COLUMN_X[1],
      positionY: ROW_Y[2],
      config: BRANCH_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-fanout',
      type: 'fan_out',
      label: 'Források szétosztása',
      positionX: COLUMN_X[2],
      positionY: ROW_Y[0],
      config: FAN_OUT_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent',
      type: 'agent_step',
      label: 'Összegzés készítése',
      positionX: COLUMN_X[2],
      positionY: ROW_Y[1],
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-script',
      type: 'script',
      label: 'Metaadat kinyerés',
      positionX: COLUMN_X[2],
      positionY: ROW_Y[2],
      config: SCRIPT_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-approval',
      type: 'human_approval',
      label: 'Emberi jóváhagyás',
      positionX: COLUMN_X[2],
      positionY: ROW_Y[3],
      config: HUMAN_APPROVAL_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-loop',
      type: 'loop',
      label: 'Forrásonkénti feldolgozás',
      positionX: COLUMN_X[2],
      positionY: ROW_Y[4],
      config: LOOP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-join',
      type: 'join',
      label: 'Eredmények összefésülése',
      positionX: COLUMN_X[3],
      positionY: ROW_Y[2],
      config: JOIN_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [
    // A `sourceHandle` a kimenő handle azonosítója, ami egyben a `branchKey`
    // is (SPEC-008 5.1): a `branch` node ágai a saját `config.branches`
    // kulcsai, a `loop` és a `human_approval` fenntartott kulcsokat használ.
    {
      id: 'e-start-branch',
      sourceNodeId: 'n-start',
      targetNodeId: 'n-branch',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-branch-fanout',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-fanout',
      sourceHandle: 'kutatas',
      targetHandle: null,
      branchKey: 'kutatas',
      createdAtMs: 1,
    },
    {
      id: 'e-branch-agent',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-agent',
      sourceHandle: 'osszegzes',
      targetHandle: null,
      branchKey: 'osszegzes',
      createdAtMs: 1,
    },
    {
      id: 'e-branch-script',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-script',
      sourceHandle: 'metaadat',
      targetHandle: null,
      branchKey: 'metaadat',
      createdAtMs: 1,
    },
    {
      id: 'e-branch-approval',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-approval',
      sourceHandle: 'jovahagyas',
      targetHandle: null,
      branchKey: 'jovahagyas',
      createdAtMs: 1,
    },
    {
      id: 'e-branch-loop',
      sourceNodeId: 'n-branch',
      targetNodeId: 'n-loop',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-fanout-join',
      sourceNodeId: 'n-fanout',
      targetNodeId: 'n-join',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-agent-join',
      sourceNodeId: 'n-agent',
      targetNodeId: 'n-join',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-script-join',
      sourceNodeId: 'n-script',
      targetNodeId: 'n-join',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      createdAtMs: 1,
    },
    {
      id: 'e-approval-join',
      sourceNodeId: 'n-approval',
      targetNodeId: 'n-join',
      sourceHandle: 'approved',
      targetHandle: null,
      branchKey: 'approved',
      createdAtMs: 1,
    },
    {
      id: 'e-loop-join',
      sourceNodeId: 'n-loop',
      targetNodeId: 'n-join',
      sourceHandle: 'exit',
      targetHandle: null,
      branchKey: 'exit',
      createdAtMs: 1,
    },
  ],
};

const SHOWCASE_WORKFLOW: WorkflowDetail = {
  id: 'w-bemutato',
  name: 'Bemutató workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SHOWCASE_SETTINGS: SettingsRecord = { defaultProviderId: 'minimax', persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

export const SHOWCASE_EDITOR_URL = `/editor?workflowId=${SHOWCASE_WORKFLOW.id}`;

/**
 * A kiválasztott csomópont a beállítás panelt nyitó képernyőképeken. Az
 * `agent_step` a leggazdagabb panel, tehát ez mutatja meg a legtöbbet.
 */
export const SHOWCASE_SELECTED_NODE_ID = 'n-agent';

/**
 * Minden külső hívás mockolva, ugyanúgy, mint egy unit tesztben
 * (`.claude/CLAUDE.md` 11. szekció): a REST végpontok `page.route()`-on
 * mennek, az SSE csatorna egyetlen `stream_ready` kereten.
 */
export async function installShowcaseMocks(page: Page): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(SHOWCASE_GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(SHOWCASE_WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SHOWCASE_SETTINGS))),
  ]);
}

/**
 * A szerkesztő megnyitása, majd várakozás arra, hogy MINDEN csomópont
 * látható és MINDEN él a DOM-ban legyen. Állapot alapú várakozás, nincs
 * időzítő (`.claude/CLAUDE.md` 11. szekció).
 *
 * Az élekre `toBeAttached` és nem `toBeVisible` jár: a Playwright láthatóság
 * definíciója nem üres befoglaló dobozt kíván, egy vízszintes él doboza
 * viszont 0 magas (mérve 2026-09-05). A vonal tényleges láthatóságát a
 * pixel mérés állítja (`edge-paint-measurement.ts`), nem ez.
 */
export async function openShowcaseEditor(page: Page): Promise<void> {
  await page.goto(SHOWCASE_EDITOR_URL);
  for (const node of SHOWCASE_GRAPH.nodes) {
    await expect(page.getByTestId(`rf__node-${node.id}`)).toBeVisible();
  }
  for (const edge of SHOWCASE_GRAPH.edges) {
    await expect(page.getByTestId(`rf__edge-${edge.id}`)).toBeAttached();
  }
}

/**
 * A TELJES gráf beillesztése a látható vászonba, a React Flow saját, a
 * felületen is ott levő "Fit View" vezérlő gombjával. Azért kell külön
 * lépésként, mert a `fitView` prop dokumentált jelentése kizárólag a KEZDETI
 * nézetre szól: a beállítás panel megnyitása után a vászon keskenyebb lesz,
 * és a régi nagításon maradt nézet jobb széle levágódna - pontosan ez
 * történt a korábbi, hibás képernyőképeken.
 *
 * A záró állítás nem esztétikai, hanem mérhető: minden csomópont befoglaló
 * doboza a vászon befoglaló dobozán BELÜL van.
 */
export async function fitShowcaseGraphIntoView(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Fit View' }).click();
  await expect.poll(async () => countNodesOutsideCanvas(page)).toBe(0);
}

/**
 * Hány csomópont lóg ki a vászon látható területéből. Nulla azt jelenti,
 * hogy a teljes gráf látszik.
 */
export async function countNodesOutsideCanvas(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = globalThis.document.querySelector('.react-flow');
    if (canvas === null) {
      throw new Error('a mérés nem talált .react-flow elemet');
    }
    const bounds = canvas.getBoundingClientRect();
    const nodes = [...globalThis.document.querySelectorAll('.react-flow__node')];
    if (nodes.length === 0) {
      throw new Error('a mérés egyetlen .react-flow__node elemet sem talált');
    }
    return nodes.filter((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.left < bounds.left || rect.right > bounds.right || rect.top < bounds.top || rect.bottom > bounds.bottom
      );
    }).length;
  });
}
