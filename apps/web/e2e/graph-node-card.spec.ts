// Regressziós e2e a `graph-node-card` témára (T-009-27). A vászon addig csak
// két node típussal (`start`, `agent_step`) volt e2e szinten kipróbálva
// (`graph-editor.spec.ts`) - ez a fájl a fennmaradó nyolc típust, a hosszú
// címke kezelését és a kiválasztott állapotot fedi le, VALÓS böngészőben,
// hogy a `resolveOutputHandles` `branch` ága (`GraphNodeCard.tsx` 29-36. sor)
// és a `script` figyelmeztető ág (85. sor) e2e szinten is lefusson, nem csak
// happy-dom unit teszttel (`GraphNodeCard.spec.tsx`).
//
// A node konfigurációk a `GraphNodeCard.spec.tsx` már bizonyítottan érvényes
// (`NodeConfigSchema` ellen validált) fixture-jeinek mintáját követik - nem
// találgatott alak, mert a mockolt `readWorkflowGraph` válasz a kliens oldali
// `WorkflowGraphDocumentSchema.safeParse()`-on megy át (`GraphEditorScreen.tsx`
// `requestRouteWithoutBody`), egy érvénytelen fixture tehát séma hibaágra
// futna, nem a vászon renderelésére.
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
  WorkflowNode,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol), ugyanaz a minta, mint a `graph-editor.spec.ts`-ben */

const START_CONFIG: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

const FAN_OUT_CONFIG: NodeConfig = {
  type: 'fan_out',
  itemsExpression: 'items',
  branchLabelTemplate: '{{item}}',
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
 * Egy csomópont a katalógus mind a tíz típusából, egy-egy egyedi, a
 * típuscímkétől és egymástól is megkülönböztethető magyar felirattal, hogy a
 * `getByText` kétértelműség nélkül találjon rájuk. A pozíciók rácsban állnak,
 * hogy a `fitView` ne fedje át őket.
 */
function buildTenTypeNodes(): WorkflowNode[] {
  const base = { createdAtMs: 1, updatedAtMs: 1 };
  return [
    {
      ...base,
      id: 't-start',
      type: 'start',
      label: 'Kezdő lépés',
      positionX: 0,
      positionY: 0,
      config: START_CONFIG,
    },
    {
      ...base,
      id: 't-agent',
      type: 'agent_step',
      label: 'Összegzés készítése',
      positionX: 500,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
    },
    {
      ...base,
      id: 't-branch',
      type: 'branch',
      label: 'Pozitív vagy negatív döntés',
      positionX: 1000,
      positionY: 0,
      config: {
        type: 'branch',
        expression: 'x > 0',
        branches: [
          { key: 'pos', label: 'Pozitív' },
          { key: 'neg', label: 'Negatív' },
        ],
        defaultBranchKey: null,
        onUnhandledError: null,
      },
    },
    {
      ...base,
      id: 't-fan-out',
      type: 'fan_out',
      label: 'Elemek szétosztása',
      positionX: 1500,
      positionY: 0,
      config: FAN_OUT_CONFIG,
    },
    {
      ...base,
      id: 't-join',
      type: 'join',
      label: 'Válaszok egyesítése',
      positionX: 0,
      positionY: 300,
      config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null },
    },
    {
      ...base,
      id: 't-loop',
      type: 'loop',
      label: 'Ismétlés amíg van elem',
      positionX: 500,
      positionY: 300,
      config: { type: 'loop', maxIterations: 5, continueExpression: 'i < 5', onUnhandledError: null },
    },
    {
      ...base,
      id: 't-approval',
      type: 'human_approval',
      label: 'Vezetői jóváhagyás',
      positionX: 1000,
      positionY: 300,
      config: {
        type: 'human_approval',
        title: 'Engedélyezed?',
        bodyTemplate: 'Kérlek erősítsd meg',
        timeoutMs: null,
        onUnhandledError: null,
      },
    },
    {
      ...base,
      id: 't-error-handler',
      type: 'error_handler',
      label: 'Hiba utáni újrapróbálás',
      positionX: 1500,
      positionY: 300,
      config: {
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [1000, 2000],
        handledErrorKinds: ['timeout'],
        onUnhandledError: null,
      },
    },
    {
      ...base,
      id: 't-sub-workflow',
      type: 'sub_workflow',
      label: 'Al-workflow meghívása',
      positionX: 0,
      positionY: 600,
      config: { type: 'sub_workflow', targetWorkflowId: 'wf-1', inputMapping: {}, onUnhandledError: null },
    },
    {
      ...base,
      id: 't-script',
      type: 'script',
      label: 'Egyedi kifejezés futtatása',
      positionX: 500,
      positionY: 600,
      config: { type: 'script', source: 'x + 1', runtime: 'expression', onUnhandledError: null },
    },
  ];
}

const WORKFLOW: WorkflowDetail = {
  id: 'w-node-card',
  name: 'Node kártya teszt workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-node-card';

async function mockGraph(page: Page, nodes: WorkflowNode[]): Promise<void> {
  const graph: WorkflowGraphDocument = { nodes, edges: [] };
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graph))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
}

/**
 * Lásd a `graph-editor.spec.ts` `nodeLocator` doksiját: a `getByTestId` itt a
 * React Flow saját, dokumentált `rf__` előtagú tesztelési fogódzója, nem
 * kitalált azonosító - a kártya `role="group"` szerepe azonos és névtelen
 * minden node típuson, a `getByText` pedig nem alkalmazható, mert a node
 * fókuszálható és húzható (interaktív).
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

/**
 * A kimenő ("source") handle-ök száma egy node-on belül. A `Handle` elem sem
 * szerepet, sem tesztelési azonosítót nem hordoz - a `.react-flow__handle`
 * és a `.source`/`.target` osztály a könyvtár saját, dokumentálatlan, de
 * stabil DOM kimenete (ugyanezt a mintát használja a happy-dom unit teszt is,
 * `GraphNodeCard.spec.tsx` `handleElements`), ezért ez a legrövidebb,
 * CSS-nél jobb alternatíva nélküli lehetőség (locator sorrend utolsó eset).
 */
function outputHandles(page: Page, nodeId: string): Locator {
  return nodeLocator(page, nodeId).locator('.react-flow__handle.source');
}

function inputHandles(page: Page, nodeId: string): Locator {
  return nodeLocator(page, nodeId).locator('.react-flow__handle.target');
}

test('mind a tíz csomópont típus a saját típuscímkéjével és egyedi feliratával jelenik meg', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockGraph(page, buildTenTypeNodes());
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 't-start')).toBeVisible();

  // A típuscímke `{ exact: true }`-val: két típuscímke ("Szétosztás",
  // "Al-workflow") a saját, hosszabb egyedi feliratának RÉSZSTRINGJE is
  // (`getByText` alapból kis- és nagybetű érzéketlen részstring illesztést
  // végez) - `exact` nélkül a `getByText('Szétosztás')` a "Elemek
  // szétosztása" feliratra is illeszkedne, és "strict mode violation"-t adna.
  const typeLabels = [
    'Indítás',
    'Agent lépés',
    'Elágazás',
    'Szétosztás',
    'Összefésülés',
    'Ciklus',
    'Emberi jóváhagyás',
    'Hibakezelő',
    'Al-workflow',
    'Szkript',
  ];
  for (const typeLabel of typeLabels) {
    await expect(page.getByText(typeLabel, { exact: true })).toBeVisible();
  }

  const customLabels = [
    'Kezdő lépés',
    'Összegzés készítése',
    'Pozitív vagy negatív döntés',
    'Elemek szétosztása',
    'Válaszok egyesítése',
    'Ismétlés amíg van elem',
    'Vezetői jóváhagyás',
    'Hiba utáni újrapróbálás',
    'Al-workflow meghívása',
    'Egyedi kifejezés futtatása',
  ];
  for (const customLabel of customLabels) {
    await expect(page.getByText(customLabel)).toBeVisible();
  }
});

test('a start típusnak nincs bemenő handle-je, a többi kilencnek van', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockGraph(page, buildTenTypeNodes());
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 't-start')).toBeVisible();

  await expect(inputHandles(page, 't-start')).toHaveCount(0);
  await expect(inputHandles(page, 't-agent')).toHaveCount(1);
  await expect(inputHandles(page, 't-branch')).toHaveCount(1);
});

test('az elágazás node a config.branches listája szerint, plusz egy alapértelmezett kimenő handle-t rajzol', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockGraph(page, buildTenTypeNodes());
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 't-branch')).toBeVisible();

  // Két konfigurált ág (pos, neg) plusz egy névtelen alapértelmezett - a
  // `GraphNodeCard.tsx` `resolveOutputHandles` `branch` ága
  // (`config.branches.map(...)` plusz a fix alapértelmezett bejegyzés).
  await expect(outputHandles(page, 't-branch')).toHaveCount(3);
  // Összehasonlításul: egy fix, egykimenetű típus egyetlen handle-t rajzol.
  await expect(outputHandles(page, 't-agent')).toHaveCount(1);
  // A két fenntartott azonosítójú típus a katalógus szerinti darabszámot adja.
  await expect(outputHandles(page, 't-loop')).toHaveCount(2);
  await expect(outputHandles(page, 't-approval')).toHaveCount(2);
  await expect(outputHandles(page, 't-error-handler')).toHaveCount(2);
});

test('ha a szerver a node.type-tól eltérő config.type-ot ad vissza, a kártya nulla kimenő handle-t rajzol összeomlás helyett', async ({
  page,
}) => {
  // A `WorkflowNodeInputSchema` (packages/protocol) a `type` és a
  // `config.type` mezőt NEM kapcsolja össze kereszt-mező ellenőrzéssel
  // (`GraphNodeCard.tsx` doksija, SPEC-005), tehát a dróton ténylegesen
  // érkezhet ilyen, önmagában érvényes, de belsőleg inkonzisztens node - a
  // `branch` katalógus bejegyzés `dynamic-branch` kimenete, de a config
  // ténylegesen `fan_out`. Ugyanezt az esetet a happy-dom unit teszt is
  // lefedi (`GraphNodeCard.spec.tsx`), ez itt a valós böngészős megfelelője.
  const nodes: WorkflowNode[] = [
    {
      id: 'mismatched',
      type: 'branch',
      label: 'Belsőleg inkonzisztens node',
      positionX: 0,
      positionY: 0,
      config: FAN_OUT_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ];
  await mockGraph(page, nodes);
  await page.goto(EDITOR_URL);

  await expect(nodeLocator(page, 'mismatched')).toBeVisible();
  // A `branch` katalógus bejegyzés bemenő handle-t ad, ez a `config.type`-tól
  // független, mert az `hasInputHandle` a KATALÓGUSBÓL jön, nem a configból.
  await expect(inputHandles(page, 'mismatched')).toHaveCount(1);
  // A kimenő handle viszont nulla: a `resolveOutputHandles` sem a `fixed`,
  // sem a `config.type === 'branch'` ágat nem találja, tehát az utolsó,
  // üres lista ágra esik vissza - összeomlás helyett.
  await expect(outputHandles(page, 'mismatched')).toHaveCount(0);
});

test('a script figyelmeztető szövege KIZÁRÓLAG a script típusú kártyán jelenik meg', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockGraph(page, buildTenTypeNodes());
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 't-script')).toBeVisible();

  const warningText = 'A motor a futtatáskor elutasítja: nincs implementálva.';
  await expect(nodeLocator(page, 't-script').getByText(warningText)).toBeVisible();
  // A másik kilenc kártya egyikén sem jelenik meg - pontosan egy előfordulás
  // a teljes vásznon.
  await expect(page.getByText(warningText)).toHaveCount(1);
});

test('a hosszú node címke teljes tartalommal jelenik meg, és a kártya szélessége ehhez igazodik', async ({ page }) => {
  const shortLabel = 'Rövid lépés';
  const longLabel =
    'Ez egy szándékosan nagyon hosszú, több sornyi node felirat, ami a rögzített minimum kártya méretnél lényegesen több helyet igényel, hogy a kártya ne vágja le a tartalmát.';
  const nodes: WorkflowNode[] = [
    {
      id: 'short',
      type: 'agent_step',
      label: shortLabel,
      positionX: 0,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'long',
      type: 'agent_step',
      label: longLabel,
      positionX: 600,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ];
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockGraph(page, nodes);
  await page.goto(EDITOR_URL);

  // A teljes, csonkolatlan szöveg megjelenik - nincs `text-overflow: ellipsis`
  // vagy hasonló vágás a `graph-node-card.css`-ben (`.graph-node-card__label`
  // sem `overflow`, sem `white-space` szabályt nem ad).
  await expect(page.getByText(longLabel)).toBeVisible();

  const shortBox = await nodeLocator(page, 'short').boundingBox();
  const longBox = await nodeLocator(page, 'long').boundingBox();
  // SAJÁT MÉRÉSSEL IGAZOLVA (valós Chromium ellen): a `.graph-node-card__label`
  // nem tördel sortörést, mert a `.graph-node-card` flex oszlopnak nincs
  // explicit `width`/`max-width`-je, csak `min-width`-je - egy `width: auto`
  // flex konténer "shrink-to-fit" szélessége a tartalom EGYETLEN sorra eső
  // szélessége. A hosszú felirat ezért a kártyát SZÉLESSÉGBEN növeli, nem
  // magasságban (a magasság mindkét kártyán azonos marad), pontosan úgy,
  // ahogy a `graph-node-catalog.ts` GRAPH_NODE_CARD_HEIGHT doksija leírja:
  // "a kártya ekkor a mértnél NAGYOBBRA nő, ahelyett hogy a tartalom
  // levágódna" - nem a tartalom, hanem a doboz szélessége igazodik.
  expect(longBox?.width ?? 0).toBeGreaterThan(shortBox?.width ?? 0);
});

test('kattintásra a csomópont React Flow "selected" osztályt kap, a vászon üres területére kattintva pedig elveszti', async ({
  page,
}) => {
  const nodes: WorkflowNode[] = [
    {
      id: 'sel-1',
      type: 'start',
      label: 'Első csomópont',
      positionX: 0,
      positionY: 0,
      config: START_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'sel-2',
      type: 'agent_step',
      label: 'Második csomópont',
      positionX: 500,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ];
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockGraph(page, nodes);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'sel-1')).toBeVisible();

  await expect(nodeLocator(page, 'sel-1')).not.toHaveClass(/\bselected\b/);
  await nodeLocator(page, 'sel-1').click();
  await expect(nodeLocator(page, 'sel-1')).toHaveClass(/\bselected\b/);

  // A `GraphEditorCanvas` `onPaneClick`-je a `.react-flow__pane` (a vászon
  // háttér rétege, a könyvtár saját, dokumentálatlan, de stabil DOM
  // kimenete) kattintására törli a kiválasztást - a `fitView` paddingja miatt
  // a bal felső sarok üresen marad mindkét node-tól.
  await page.locator('.react-flow__pane').click({ position: { x: 5, y: 5 } });
  await expect(nodeLocator(page, 'sel-1')).not.toHaveClass(/\bselected\b/);
});
