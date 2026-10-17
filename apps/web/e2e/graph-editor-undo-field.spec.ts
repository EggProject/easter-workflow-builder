// A beállítás panel mezőjének visszavonása valós Chromiumban (PLAN-009 T-009-53,
// SPEC-008 5.10, 102. kritérium): a szöveg mezőben lenyomott visszavonás és újra
// elvégzés billentyű a gráf történetét nem érinti (a szűrő a beviteli célpontot
// kihagyja, a mező natív visszavonása marad), és a mező elhagyása után egyetlen
// Visszavonás a mező teljes szerkesztési menetét vonja vissza.
//
// A három "mérés" teszt a vezérelt React mezőn a böngésző natív visszavonásának
// tényleges viselkedése (SPEC-008 5.10, a nem ellenőrzött pont): a Chromium a
// natív történetet a dokumentum összes szöveg mezőjére közösen vezeti, tehát egy
// mezőben lenyomott `Ctrl+Z` egy másik mező gépelését is visszavonhatja. A mért
// értékek a docs/research/2026-10-14-csomopont-felvetel.md T-009-53 szekciójában
// állnak; ha a telepített Chromium viselkedése változik, ezek a tesztek jelzik,
// hogy a mérés elavult.
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
import { chooseSelectOption, expectSelectedLabel } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';
import { WINDOWS_CHROME_USER_AGENT } from './user-agent.ts';

declare global {
  // A lapra kitett jelentő függvény (`page.exposeFunction`): a dokumentum
  // `beforeinput` figyelője hívja a natív történet műveleteivel
  // (`historyUndo`, `historyRedo`), és azzal, hogy az esemény célpontja a
  // fókuszált elem-e. Ambiens globális deklaráció, a
  // `graph-node-add-placement.spec.ts` mintájára.
  var reportHistoryInputType: ((inputType: string, isTargetFocused: boolean) => Promise<void>) | undefined;
}

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const PROMPT_TEMPLATE = 'Foglald össze a bemenetet.';

/**
 * Érvényes (menthető) konfig: a kezeletlen hiba szabálya kitöltve (O-29).
 */
const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
  promptTemplate: PROMPT_TEMPLATE,
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
  onUnhandledError: 'fail_run',
};

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

// A fájl a `Ctrl` módosítót méri: az Automatikus beállítás a felhasználói
// ügynökből old fel (SPEC-008 5.10, O-31), ezért az ügynök nem macOS értékre
// van rögzítve.
test.use({ userAgent: WINDOWS_CHROME_USER_AGENT });

/**
 * A mentés kérések törzse. A mentés 500-at ad: a sikertelen mentés a két listát
 * nem érinti (SPEC-008 5.10), tehát a törzs olvasása után a történet változatlan.
 */
interface SaveTraffic {
  readonly savedBodies: string[];
}

async function openEditorPanel(page: Page): Promise<SaveTraffic> {
  const traffic: SaveTraffic = { savedBodies: [] };
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      traffic.savedBodies.push(route.request().postData() ?? '');
      await route.fulfill(jsonBody({ code: 'internal_error', message: 'a teszt mentése szándékosan sikertelen' }, 500));
    }),
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(EDITOR_URL);
  await expect(page.getByTestId('rf__edge-e1')).toBeAttached();
  await page.getByTestId('rf__node-n2').click();
  await expect(inspectorPanel(page)).toBeVisible();
  return traffic;
}

function inspectorPanel(page: Page): Locator {
  return page.getByRole('complementary', { name: 'Agent lépés beállításai' });
}

function promptField(page: Page): Locator {
  return inspectorPanel(page).getByLabel('Prompt sablon');
}

function undoButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Visszavonás', exact: true });
}

function redoButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Újra', exact: true });
}

async function openPromptField(page: Page): Promise<Locator> {
  const field = promptField(page);
  await expect(field).toBeVisible();
  return field;
}

/**
 * A "Modell azonosító" szöveges `input` mező a "Modell és futási korlátok"
 * összecsukott csoportban áll; a csoport kinyitása a fókuszt a panelen belül
 * a csoport fejlécére viszi, tehát egy előtte fókuszált mezőt elhagy.
 */
async function openModelIdField(page: Page): Promise<Locator> {
  await inspectorPanel(page).getByRole('button', { name: 'Modell és futási korlátok' }).click();
  const field = inspectorPanel(page).getByLabel('Modell azonosító');
  await expect(field).toBeVisible();
  return field;
}

/**
 * A kurzor a mező végére, majd karakterenkénti gépelés: minden karakter egy
 * mező változás.
 */
async function typeAtEnd(page: Page, field: Locator, text: string): Promise<void> {
  await field.click();
  await page.keyboard.press('End');
  await field.pressSequentially(text);
}

/**
 * A "Mentés" gomb megnyomása után a `PUT` törzs; a hibát jelző értesítés
 * bezárul, hogy a láblécet ne takarja.
 */
async function readSavedDocument(page: Page, traffic: SaveTraffic): Promise<ReplaceGraphRequest> {
  const requestsBefore = traffic.savedBodies.length;
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect.poll(() => traffic.savedBodies.length).toBe(requestsBefore + 1);
  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByText('A mentés sikertelen')).toHaveCount(0);
  const parsed = ReplaceGraphRequestSchema.safeParse(JSON.parse(traffic.savedBodies[requestsBefore] ?? 'null'));
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

function agentConfigOf(document: ReplaceGraphRequest): NodeConfig | undefined {
  return document.nodes.find((node) => node.id === 'n2')?.config;
}

// A korábbi, lezárt szerkesztés a "Kezeletlen hiba szabálya" választón áll: a
// választó nem natív szerkesztés, tehát a böngésző natív visszavonása nem éri
// el. Egy szöveg mezőben végzett korábbi szerkesztést a natív visszavonás egy
// másik szöveg mezőből is visszavonja, mert a Chromium története a dokumentum
// közös története (a lenti mérés), így az a szűrőt nem különítené el.
const TEXT_TARGETS = [
  { name: 'szöveg terület (textarea, "Prompt sablon")', open: openPromptField },
  { name: 'szöveges beviteli mező (input, "Modell azonosító")', open: openModelIdField },
] as const;

for (const target of TEXT_TARGETS) {
  test(`${target.name}: a mezőben lenyomott Ctrl+Z, Ctrl+Shift+Z és Ctrl+Y a gráf történetét nem érinti, a másik mező lezárt szerkesztése megmarad`, async ({
    page,
  }) => {
    const traffic = await openEditorPanel(page);
    const policySelect = inspectorPanel(page).getByRole('combobox', { name: 'Kezeletlen hiba szabálya' });
    await chooseSelectOption(page, policySelect, 'fail_branch');
    const targetField = await target.open(page);
    // A szöveg mezőre kattintás elhagyja a választót: a menete lezárul, a
    // visszavonás listán egy lépés áll.
    await targetField.click();

    // Visszavonás a szöveg mezőben: a gráf visszavonása nem fut, a választó
    // lezárt szerkesztése megmarad, a lista érintetlen.
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expectSelectedLabel(policySelect, 'fail_branch');
    await expect(undoButton(page)).toBeEnabled();
    await expect(redoButton(page)).toBeDisabled();

    // Újra elvégzés a mezőben: egy gombos visszavonás után az újra lista nem
    // üres, a két billentyű mégsem végzi el újra.
    await undoButton(page).click();
    await expectSelectedLabel(policySelect, 'fail_run');
    await targetField.click();
    await page.keyboard.press('Control+Shift+Z');
    await page.keyboard.press('Control+y');
    await expectSelectedLabel(policySelect, 'fail_run');
    await expect(redoButton(page)).toBeEnabled();
    await expect(undoButton(page)).toBeDisabled();

    // A mentés törzse is a gráf történetének állapota: a visszavont szerkesztés.
    expect(agentConfigOf(await readSavedDocument(page, traffic))).toEqual(AGENT_STEP_CONFIG);
  });
}

test('a mező elhagyása után egyetlen Visszavonás a mező teljes szerkesztési menetét visszavonja, gombbal és billentyűvel', async ({
  page,
}) => {
  const traffic = await openEditorPanel(page);

  // Gomb: a kattintás előbb elhagyja a mezőt (a menet lezárul), utána von vissza.
  await typeAtEnd(page, promptField(page), ' Röviden.');
  await undoButton(page).click();
  await expect(promptField(page)).toHaveValue(PROMPT_TEMPLATE);
  await expect(undoButton(page)).toBeDisabled();
  await redoButton(page).click();
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE} Röviden.`);

  // Billentyű: a mező elhagyása a vászon üres területére kattintással (a panel
  // bezárul), a `Ctrl+Z` a második menetet egy lépésben vonja vissza.
  await typeAtEnd(page, promptField(page), ' Igen.');
  const wrapperBox = await page.getByTestId('rf__wrapper').boundingBox();
  if (wrapperBox === null) {
    throw new Error('a teszt nem talált mérhető dobozt a vászonhoz');
  }
  await page.mouse.click(wrapperBox.x + wrapperBox.width * 0.8, wrapperBox.y + wrapperBox.height * 0.2);
  await expect(inspectorPanel(page)).toBeHidden();
  await page.keyboard.press('Control+z');
  await expect(undoButton(page)).toBeEnabled();
  await page.getByTestId('rf__node-n2').click();
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE} Röviden.`);
  expect(agentConfigOf(await readSavedDocument(page, traffic))).toEqual({
    ...AGENT_STEP_CONFIG,
    promptTemplate: `${PROMPT_TEMPLATE} Röviden.`,
  });
  await undoButton(page).click();
  await expect(promptField(page)).toHaveValue(PROMPT_TEMPLATE);
  await expect(undoButton(page)).toBeDisabled();
});

/**
 * A natív történet műveleteinek (`historyUndo`, `historyRedo`) rögzítése a
 * dokumentum `beforeinput` eseményén (W3C Input Events Level 2), a célpont és a
 * fókuszált elem egyezésével: a Chromium az eseményt a visszavont lépés elemén
 * váltja ki, ami nem feltétlenül a fókuszált elem (chromium `debff86`).
 */
async function recordHistoryInputTypes(page: Page): Promise<readonly string[]> {
  const inputTypes: string[] = [];
  await page.exposeFunction('reportHistoryInputType', (inputType: string, isTargetFocused: boolean) => {
    inputTypes.push(isTargetFocused ? inputType : `${inputType} (nem a fókuszált mezőn)`);
  });
  await page.evaluate(() => {
    globalThis.document.addEventListener(
      'beforeinput',
      (event) => {
        if (event.inputType.startsWith('history')) {
          void globalThis.reportHistoryInputType?.(event.inputType, event.target === globalThis.document.activeElement);
        }
      },
      { capture: true },
    );
  });
  return inputTypes;
}

test('mérés: a natív visszavonás a dokumentum közös történetén áll, egy másik szöveg mezőben lenyomott Ctrl+Z a korábbi mező gépelését vonja vissza, és ez külön gráf lépés', async ({
  page,
}) => {
  await openEditorPanel(page);
  const inputTypes = await recordHistoryInputTypes(page);
  await typeAtEnd(page, promptField(page), ' Röviden.');
  const modelIdField = await openModelIdField(page);
  await modelIdField.click();

  // A "Modell azonosító" mezőben lenyomott Ctrl+Z a "Prompt sablon" utolsó
  // karakterét vonja vissza; a gráf visszavonása nem fut (a lista nem fogy).
  await page.keyboard.press('Control+z');
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE} Röviden`);
  await expect(modelIdField).toHaveValue('');
  await expect.poll(() => [...inputTypes]).toEqual(['historyUndo (nem a fókuszált mezőn)']);

  // A natív visszavonás értékváltozása a lezárt menet után érkezett, tehát új
  // gráf lépés: az első Visszavonás a teljes gépelést hozza vissza, a második a
  // kiinduló értéket.
  await undoButton(page).click();
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE} Röviden.`);
  await undoButton(page).click();
  await expect(promptField(page)).toHaveValue(PROMPT_TEMPLATE);
  await expect(undoButton(page)).toBeDisabled();
});

test('mérés: a vezérelt szöveg területen (textarea) a natív visszavonás karakterenként lép, az értéket visszaállítja, és a mező menetébe vonódik', async ({
  page,
}) => {
  const traffic = await openEditorPanel(page);
  const inputTypes = await recordHistoryInputTypes(page);
  await typeAtEnd(page, promptField(page), 'XYZ');

  await page.keyboard.press('Control+z');
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE}XY`);
  await page.keyboard.press('Control+z');
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE}X`);
  await page.keyboard.press('Control+Shift+Z');
  await expect(promptField(page)).toHaveValue(`${PROMPT_TEMPLATE}XY`);
  await expect.poll(() => [...inputTypes]).toEqual(['historyUndo', 'historyUndo', 'historyRedo']);

  // A natív visszavonás értékváltozása a mező menetébe vonódott: a gráf
  // történetén egy lépés áll, az újra lista üres, a mentés törzse a mező értéke.
  await expect(undoButton(page)).toBeEnabled();
  await expect(redoButton(page)).toBeDisabled();
  expect(agentConfigOf(await readSavedDocument(page, traffic))).toEqual({
    ...AGENT_STEP_CONFIG,
    promptTemplate: `${PROMPT_TEMPLATE}XY`,
  });
  // A mező elhagyása után egyetlen Visszavonás a teljes menetet visszavonja.
  await undoButton(page).click();
  await expect(promptField(page)).toHaveValue(PROMPT_TEMPLATE);
  await expect(undoButton(page)).toBeDisabled();
});

test('mérés: a vezérelt szöveges beviteli mezőn (input) a natív visszavonás a gépelést egy lépésben vonja vissza, és üres natív történetnél nem hat', async ({
  page,
}) => {
  const traffic = await openEditorPanel(page);
  const modelIdField = await openModelIdField(page);
  const inputTypes = await recordHistoryInputTypes(page);
  await typeAtEnd(page, modelIdField, 'XYZ');

  await page.keyboard.press('Control+z');
  await expect(modelIdField).toHaveValue('');
  await page.keyboard.press('Control+y');
  await expect(modelIdField).toHaveValue('XYZ');
  await page.keyboard.press('Control+z');
  await expect(modelIdField).toHaveValue('');
  // A natív történet üres: a második `Ctrl+Z` nem ad `beforeinput` eseményt, és
  // a gráf visszavonása sem fut.
  await page.keyboard.press('Control+z');
  await expect.poll(() => [...inputTypes]).toEqual(['historyUndo', 'historyRedo', 'historyUndo']);
  await expect(modelIdField).toHaveValue('');
  await expect(undoButton(page)).toBeEnabled();
  expect(agentConfigOf(await readSavedDocument(page, traffic))).toEqual(AGENT_STEP_CONFIG);
});
