// A `node-inspector` téma e2e lefedettsége (a téma e2e híján 19,38%
// soronkénti lefedettséggel indult, lásd a koordinátor jelentését). A tíz
// csomópont típus mindegyikéhez tartozó szerkesztő mezőcsoportot fedi: a
// mezők megjelenését, a kitöltést, az állapotba való visszaírást (a
// `GraphEditorScreen` `currentNodes` állapotán át, ZÁRÁS + ÚJRANYITÁS
// próbával igazolva, hogy a vezérelt oda-vissza leképezés ténylegesen
// működik, nem csak a mező saját, helyi állapota tartja meg az értéket) és a
// hibaágakat (JSON parse hiba, séma szerint érvénytelen, de szintaktikusan
// helyes JSON, üres kötelező mező védelem, nem objektum alakú `agents`
// bejegyzés).
//
// Minden REST hívás `page.route()` mockon megy (rest-mock.ts), az SSE
// csatorna egyetlen `stream_ready` kerettel (sse-mock.ts).
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { chooseSelectOption, expectSelectedLabel } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const START_CONFIG: NodeConfig = {
  type: 'start',
  inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }],
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
  agents: {
    kutato: { description: 'Kutat a weben.', prompt: 'Kutass alaposan.', skills: 'all' },
    legacy: 'régi, nem objektum alakú bejegyzés',
  },
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

const BRANCH_CONFIG: NodeConfig = {
  type: 'branch',
  expression: 'input.kind',
  branches: [{ key: 'a', label: 'A ág' }],
  defaultBranchKey: null,
  onUnhandledError: null,
};

const FAN_OUT_CONFIG: NodeConfig = {
  type: 'fan_out',
  itemsExpression: 'input.items',
  branchLabelTemplate: 'Elem #{{index}}',
  onUnhandledError: null,
};

const JOIN_CONFIG: NodeConfig = { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null };

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

const ERROR_HANDLER_CONFIG: NodeConfig = {
  type: 'error_handler',
  maxAttempts: 3,
  backoffMs: [100, 200],
  handledErrorKinds: ['timeout'],
  onUnhandledError: null,
};

const SUB_WORKFLOW_CONFIG: NodeConfig = {
  type: 'sub_workflow',
  targetWorkflowId: 'w-child',
  inputMapping: { topic: 'input.topic' },
  onUnhandledError: null,
};

const SCRIPT_CONFIG: NodeConfig = {
  type: 'script',
  source: 'return 1;',
  runtime: 'expression',
  onUnhandledError: null,
};

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: START_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-agent',
      type: 'agent_step',
      label: 'Agent lépés',
      positionX: 500,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-branch',
      type: 'branch',
      label: 'Elágazás',
      positionX: 1000,
      positionY: 0,
      config: BRANCH_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-fanout',
      type: 'fan_out',
      label: 'Szétosztás',
      positionX: 1500,
      positionY: 0,
      config: FAN_OUT_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-join',
      type: 'join',
      label: 'Összefésülés',
      positionX: 2000,
      positionY: 0,
      config: JOIN_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-loop',
      type: 'loop',
      label: 'Ciklus',
      positionX: 0,
      positionY: 260,
      config: LOOP_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-human',
      type: 'human_approval',
      label: 'Emberi jóváhagyás',
      positionX: 500,
      positionY: 260,
      config: HUMAN_APPROVAL_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-error',
      type: 'error_handler',
      label: 'Hibakezelő',
      positionX: 1000,
      positionY: 260,
      config: ERROR_HANDLER_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-subworkflow',
      type: 'sub_workflow',
      label: 'Al-workflow',
      positionX: 1500,
      positionY: 260,
      config: SUB_WORKFLOW_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-script',
      type: 'script',
      label: 'Szkript',
      positionX: 2000,
      positionY: 260,
      config: SCRIPT_CONFIG,
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: 'minimax', persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
  ]);
  await page.goto(EDITOR_URL);
  await expect(nodeLocator(page, 'n-start')).toBeVisible();
});

/**
 * Lásd a `graph-editor.spec.ts` azonos nevű függvényének indoklását: a React
 * Flow saját, dokumentált `data-testid="rf__node-<id>"` tesztelési fogódzója
 * az egyetlen alkalmazható locator, a csomópont `role="group"` szerepe
 * azonos és szerző adta hozzáférhető név nélküli.
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

function inspectorPanel(page: Page): Locator {
  return page.locator('.node-inspector');
}

async function openNode(page: Page, nodeId: string): Promise<Locator> {
  await nodeLocator(page, nodeId).click();
  const panel = inspectorPanel(page);
  await expect(panel).toBeVisible();
  return panel;
}

/**
 * Egy elem mért szélessége, hiányzó doboz esetén nulla. Külön függvény, mert
 * a `unicorn/no-await-expression-member` nem engedi a `(await
 * locator.boundingBox())?.width` alakot.
 */
async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return box === null ? 0 : box.width;
}

async function closePanel(page: Page): Promise<void> {
  // A gomb ikon gomb, tehát nincs látható szövege: a hozzáférhető nevét az
  // `aria-label` adja, és a `getByRole` név szerinti keresés ezt találja meg.
  await page.getByRole('button', { name: 'Bezárás' }).click();
  await expect(inspectorPanel(page)).toBeAttached({ attached: false });
}

/**
 * Egy összecsukható panel kinyitása a fejléc gombjára kattintva
 * (`packages/ui` `accordion` téma). A ritkán szerkesztett mezők zárva
 * indulnak, tehát az őket vizsgáló teszteknek előbb ki kell nyitniuk a
 * panelt. A várakozás állapot alapú: a törzs `role="region"` eleme akkor
 * válik láthatóvá, amikor a natív `hidden` lekerül róla.
 */
async function openAccordion(scope: Locator, title: string): Promise<Locator> {
  await scope.getByRole('button', { name: title, exact: true }).click();
  const region = scope.getByRole('region', { name: title, exact: true });
  await expect(region).toBeVisible();
  return region;
}

test.describe('a panel fejléce és a bezárás', () => {
  test('a fejléc a katalógus címkéjét és a node azonosítót mutatja, a Bezárás gomb elrejti a panelt', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-start');
    await expect(panel.getByText('Indítás')).toBeVisible();
    await expect(panel.getByText('n-start')).toBeVisible();
    await closePanel(page);
  });
});

test.describe('a panel dokkolt sáv alakja és a mezőnkénti hibajelzés', () => {
  test('a panel a vászon jobb szélére dokkolt, húzható elválasztóval, és a vászon mellette szűkül', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const canvas = page.locator('.graph-editor-canvas');

    const canvasWidthBefore = await widthOf(canvas);
    expect(canvasWidthBefore).toBeGreaterThan(0);

    const panel = await openNode(page, 'n-agent');

    // Az elválasztó a W3C WAI Window Splitter minta szerinti `separator`
    // szerepű elem (packages/ui `resizable` téma), tehát valódi, húzható
    // elválasztó, nem díszítés.
    const separator = page.getByRole('separator', { name: 'A beállítás panel szélessége' });
    await expect(separator).toBeVisible();

    const canvasBox = await canvas.boundingBox();
    const panelBox = await panel.boundingBox();
    const separatorBox = await separator.boundingBox();
    if (canvasBox === null || panelBox === null || separatorBox === null) {
      throw new Error('a teszt nem tudta megmérni a vászon, a panel vagy az elválasztó dobozát');
    }

    // Dokkolt, nem lebegő: az elválasztó a vászon UTÁN, a panel az
    // elválasztó UTÁN kezdődik, tehát a három terület nem fedi egymást.
    expect(separatorBox.x).toBeGreaterThanOrEqual(canvasBox.x + canvasBox.width - 1);
    expect(panelBox.x).toBeGreaterThanOrEqual(separatorBox.x + separatorBox.width - 1);
    // A vászon mellette SZŰKÜLT, nem takarva lett.
    expect(canvasBox.width).toBeLessThan(canvasWidthBefore);

    // A billentyűzetes átméretezés (nyilak) ténylegesen szélesíti a sávot.
    const panelWidthBefore = panelBox.width;
    await separator.focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => widthOf(panel)).toBeGreaterThan(panelWidthBefore);

    // Bezárás után a vászon visszakapja a teljes szélességet.
    await closePanel(page);
    await expect.poll(async () => widthOf(canvas)).toBe(canvasWidthBefore);
  });

  test('a mezőcsoportok fieldset és kártya doboz nélkül is megnevezettek', async ({ page }) => {
    const panel = await openNode(page, 'n-agent');
    // A ritkán szerkesztett csoportok összecsukható panelek: a fejlécük
    // natív gomb `aria-expanded` jelzéssel, a törzsük `role="region"` a
    // fejlécre mutató névvel (`packages/ui` `accordion` téma).
    for (const title of [
      'Modell és futási korlátok',
      'Eszközök és környezet',
      'Al-agentek (agents)',
      'Skillek és MCP szerverek (csak olvasható)',
    ]) {
      await expect(panel.getByRole('button', { name: title, exact: true })).toHaveAttribute('aria-expanded', 'false');
    }
    // A `fieldset`/`legend` pár helyére `role="group"` plusz
    // `aria-labelledby` lépett (W3C WAI ARIA17) ott, ahol nem panel, hanem
    // egyszerű megnevezett csoport kell (jelölőnégyzet lista).
    await expect(panel.locator('fieldset')).toHaveCount(0);
    // NINCS CARD IN CARD: a korábbi, kitalált kártya osztály eltűnt.
    await expect(panel.locator('.inspector-section')).toHaveCount(0);
    await expect(panel.locator('.card')).toHaveCount(0);
  });

  test('a panel TETEJÉN nincs hibaösszesítő, és érintetlen mezőn nincs hibaüzenet', async ({ page }) => {
    const panel = await openNode(page, 'n-error');
    // Séma szerint érvénytelen érték úgy, hogy a mezőhöz nem nyúlunk:
    // a `backoffMs` NaN-t kap, tehát a `NodeConfigSchema` elutasítja.
    await panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)').fill('50\nabc\n150');
    // A hibaüzenet még NEM látszik, mert a mezőt nem hagytuk el.
    await expect(panel.locator('.field__error')).toHaveCount(0);
    // És a panel tetején sincs semmilyen összesítő.
    await expect(panel.locator('.node-inspector__errors')).toHaveCount(0);
    await expect(panel.getByText('Érvénytelen mezők')).toHaveCount(0);
  });

  test('a többsoros mezők a design system .textarea osztályát viselik, nem az egysoros .input osztályt', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-agent');
    const promptField = panel.getByRole('textbox', { name: 'Prompt sablon' });
    await expect(promptField).toHaveClass(/(^|\s)textarea(\s|$)/);
    await expect(promptField).not.toHaveClass(/(^|\s)input(\s|$)/);
    // A panelen egyetlen `<textarea>` sem viseli az egysoros mező osztályát.
    await expect(panel.locator('textarea.input')).toHaveCount(0);
  });

  test('az összecsukható panel billentyűzetről is nyitható és zárható', async ({ page }) => {
    const panel = await openNode(page, 'n-agent');
    const header = panel.getByRole('button', { name: 'Modell és futási korlátok', exact: true });
    const region = panel.getByRole('region', { name: 'Modell és futási korlátok', exact: true });

    await expect(region).toBeAttached({ attached: false });
    await header.focus();
    await page.keyboard.press('Enter');
    await expect(region).toBeVisible();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Space');
    await expect(region).toBeAttached({ attached: false });
    await expect(header).toHaveAttribute('aria-expanded', 'false');
  });

  test('egyetlen mező sem lóg ki a panelből', async ({ page }) => {
    const panel = await openNode(page, 'n-agent');
    await expect(panel.getByRole('textbox', { name: 'Prompt sablon' })).toBeVisible();
    await openAccordion(panel, 'Eszközök és környezet');

    const overflowing = await page.evaluate(() => {
      const element = globalThis.document.querySelector('.node-inspector__body');
      if (element === null) {
        throw new Error('a teszt nem talált .node-inspector__body elemet');
      }
      const panelRight = element.getBoundingClientRect().right;
      return [...element.querySelectorAll('.input, .select, .textarea')]
        .filter((control) => control.getBoundingClientRect().right > panelRight + 1)
        .map((control) => control.className);
    });
    expect(overflowing).toEqual([]);
  });

  test('a hibaüzenet a HIBÁS MEZŐ ALATT jelenik meg, aria-invalid és aria-describedby kötéssel', async ({ page }) => {
    const panel = await openNode(page, 'n-error');
    const backoffField = panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)');
    await expect(backoffField).not.toHaveAttribute('aria-invalid', 'true');

    await backoffField.fill('50\nabc\n150');
    // A mező ELHAGYÁSA teszi láthatóvá a hibaüzenetet (érintett + érvénytelen).
    await backoffField.blur();

    await expect(backoffField).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await backoffField.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = panel.locator(`#${String(describedBy)}`);
    await expect(message).toBeVisible();
    await expect(message).toHaveClass(/field__error/);

    // A hibaüzenet a mező ALATT áll, nem fölötte és nem mellette.
    const fieldBox = await backoffField.boundingBox();
    const messageBox = await message.boundingBox();
    if (fieldBox === null || messageBox === null) {
      throw new Error('a teszt nem tudta megmérni a mező vagy a hibaüzenet dobozát');
    }
    expect(messageBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height - 1);
  });

  test('a hibaüzenet megjelenése nem tolja el a szomszédos mezőt', async ({ page }) => {
    const panel = await openNode(page, 'n-error');
    const backoffField = panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)');
    const nextField = panel.getByLabel('Kezelt hibafajták (soronként egy)');

    async function gapBetweenFields(): Promise<number> {
      const backoffBox = await backoffField.boundingBox();
      const nextBox = await nextField.boundingBox();
      if (backoffBox === null || nextBox === null) {
        throw new Error('a teszt nem tudta megmérni a két mező dobozát');
      }
      return nextBox.y - (backoffBox.y + backoffBox.height);
    }

    const gapBefore = await gapBetweenFields();
    await backoffField.fill('50\nabc\n150');
    await backoffField.blur();
    await expect(backoffField).toHaveAttribute('aria-invalid', 'true');

    // A hibaüzenet helye MINDIG fenn van tartva (a `.field` harmadik,
    // legalább egy sornyi grid sora), tehát a hibás mező és a következő
    // mező KÖZÖTTI távolság nem változik: a hibaüzenet a már meglévő
    // helyre írja ki magát, nem told el semmit. Összesítő blokk ma nincs a
    // panel tetején, tehát az abszolút hely sem mozdul.
    expect(await gapBetweenFields()).toBe(gapBefore);
  });
});

test.describe('start node', () => {
  test('a bemeneti mezők listája szerkeszthető, bővíthető, törölhető, és a változás megmarad újranyitás után', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-start');
    const rows = panel.locator('.node-inspector__list-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).getByLabel('Név')).toHaveValue('topic');
    await expect(rows.nth(0).getByLabel('Kötelező')).toBeChecked();

    await panel.getByRole('button', { name: 'Bemeneti mező hozzáadása' }).click();
    await expect(rows).toHaveCount(2);
    await rows.nth(1).getByLabel('Név').fill('count');
    await rows.nth(1).getByLabel('Címke').fill('Darabszám');
    await rows.nth(1).getByLabel('Érték típusa').fill('number');
    // A checkbox saját .ctrl__box rétege fedi az inputot (workflow-list.spec.ts
    // azonos indoklása), ezért a hozzá tartozó SZÖVEGRE kattintunk.
    await rows.nth(1).getByText('Kötelező').click();
    await expect(rows.nth(1).getByLabel('Kötelező')).toBeChecked();

    // Az eredeti sor törlése: csak a szerkesztett második sor marad.
    await rows.nth(0).getByRole('button', { name: 'Törlés' }).click();
    await expect(rows).toHaveCount(1);

    await closePanel(page);
    const reopened = await openNode(page, 'n-start');
    const reopenedRows = reopened.locator('.node-inspector__list-row');
    await expect(reopenedRows).toHaveCount(1);
    await expect(reopenedRows.nth(0).getByLabel('Név')).toHaveValue('count');
    await expect(reopenedRows.nth(0).getByLabel('Címke')).toHaveValue('Darabszám');
    await expect(reopenedRows.nth(0).getByLabel('Érték típusa')).toHaveValue('number');
    await expect(reopenedRows.nth(0).getByLabel('Kötelező')).toBeChecked();
  });
});

test.describe('agent_step node: prompt, provider öröklés, rendszer prompt', () => {
  test('a prompt sablon, a provider felülírás és a rendszer prompt három módja szerkeszthető és megmarad', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-agent');
    const promptField = panel.getByLabel('Prompt sablon');
    await expect(promptField).toHaveValue('Összegezd a bemenetet.');
    await promptField.fill('Foglald össze röviden.');

    // A `providerId` kezdetben `null`: az örökölt leírás látszik.
    await expect(panel.getByText('a globális alapértelmezést örökli: minimax')).toBeVisible();
    await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Provider felülírás' }), 'minimax');
    // Felülírás esetén az örökölt leírás eltűnik.
    await expect(panel.getByText('a globális alapértelmezést örökli: minimax')).toBeAttached({ attached: false });
    // Vissza a "nincs felülírás (öröklés)" placeholder opcióra: az értéke
    // (üres sztring) egyetlen `ProviderIdSchema` opcióval sem egyezik, tehát
    // a `.find` hívás `undefined`-et ad, és a `matched ?? null` mentő ág fut.
    await chooseSelectOption(
      page,
      panel.getByRole('combobox', { name: 'Provider felülírás' }),
      'nincs felülírás (öröklés)',
    );
    await expect(panel.getByText('a globális alapértelmezést örökli: minimax')).toBeVisible();
    // Ismét felülírás, hogy a lenti megmaradás-ellenőrzés `minimax`-ot lásson.
    await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Provider felülírás' }), 'minimax');

    // Rendszer prompt: nincs megadva -> szabad szöveg -> preset, mindhárom ág.
    const modeSelect = panel.getByRole('combobox', { name: 'Rendszer prompt módja' });
    await expectSelectedLabel(modeSelect, 'nincs megadva');
    await chooseSelectOption(page, modeSelect, 'szabad szöveg');
    await panel.getByLabel('Rendszer prompt szövege').fill('Legyél tömör.');
    await chooseSelectOption(page, modeSelect, 'Claude Code preset');
    await panel.getByLabel('Preset kiegészítés (append)').fill('Válaszolj magyarul.');
    await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }), 'igen');
    // Mindhárom ág: igen -> nem -> nincs megadva (`null`).
    await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }), 'nem');
    await expectSelectedLabel(panel.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }), 'nem');
    await chooseSelectOption(
      page,
      panel.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }),
      'nincs megadva',
    );
    await expectSelectedLabel(panel.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }), 'nincs megadva');
    await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }), 'igen');

    await closePanel(page);
    const reopened = await openNode(page, 'n-agent');
    await expect(reopened.getByLabel('Prompt sablon')).toHaveValue('Foglald össze röviden.');
    await expectSelectedLabel(reopened.getByRole('combobox', { name: 'Provider felülírás' }), 'minimax');
    await expectSelectedLabel(reopened.getByRole('combobox', { name: 'Rendszer prompt módja' }), 'Claude Code preset');
    await expect(reopened.getByLabel('Preset kiegészítés (append)')).toHaveValue('Válaszolj magyarul.');
    await expectSelectedLabel(reopened.getByRole('combobox', { name: 'Dinamikus szekciók kizárása' }), 'igen');

    // Preset -> nincs megadva ág: a mező visszaáll `null`-ra.
    await chooseSelectOption(page, reopened.getByRole('combobox', { name: 'Rendszer prompt módja' }), 'nincs megadva');
    await expectSelectedLabel(reopened.getByRole('combobox', { name: 'Rendszer prompt módja' }), 'nincs megadva');
  });
});

test.describe('agent_step node: futási korlátok és motor hookok', () => {
  test('a modell, a session mód, a számláló mezők és a motor hook checkbox szerkeszthető és megmarad', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-agent');
    const limits = await openAccordion(panel, 'Modell és futási korlátok');
    await limits.getByLabel('Modell azonosító').fill('claude-opus-4');
    await chooseSelectOption(page, limits.getByRole('combobox', { name: 'Session mód' }), 'continued');

    await limits.getByLabel('Max. körök száma').fill('12');
    await limits.getByLabel('Max. büdzsé (USD)').fill('2.5');
    await limits.getByLabel('Effort').fill('high');
    await chooseSelectOption(page, limits.getByRole('combobox', { name: 'Thinking mód' }), 'adaptive');
    // Vissza a "nincs megadva" placeholder opcióra, majd újra `adaptive`: az
    // üres érték egyetlen `ThinkingModeSchema` opcióval sem egyezik, tehát a
    // `.find` hívás `undefined`-et ad, és a `matched ?? null` mentő ág fut.
    await chooseSelectOption(page, limits.getByRole('combobox', { name: 'Thinking mód' }), 'nincs megadva');
    await expectSelectedLabel(limits.getByRole('combobox', { name: 'Thinking mód' }), 'nincs megadva');
    await chooseSelectOption(page, limits.getByRole('combobox', { name: 'Thinking mód' }), 'adaptive');
    await limits.getByLabel('Jogosultsági mód').fill('acceptEdits');

    const hooks = limits.getByRole('group', { name: 'Bekapcsolt motor hookok' });
    await hooks.getByText('emit_output_tool_stop').click();
    await expect(hooks.getByRole('checkbox')).toBeChecked();
    // Ki is kapcsolható (a `filter` ág).
    await hooks.getByText('emit_output_tool_stop').click();
    await expect(hooks.getByRole('checkbox')).not.toBeChecked();
    await hooks.getByText('emit_output_tool_stop').click();

    await closePanel(page);
    const reopened = await openNode(page, 'n-agent');
    // Az összecsukható panel újranyitáskor ZÁRVA indul (alapértelmezés).
    const reopenedLimits = await openAccordion(reopened, 'Modell és futási korlátok');
    await expect(reopenedLimits.getByLabel('Modell azonosító')).toHaveValue('claude-opus-4');
    await expectSelectedLabel(reopenedLimits.getByRole('combobox', { name: 'Session mód' }), 'continued');
    await expect(reopenedLimits.getByLabel('Max. körök száma')).toHaveValue('12');
    await expect(reopenedLimits.getByLabel('Max. büdzsé (USD)')).toHaveValue('2.5');
    await expect(reopenedLimits.getByLabel('Effort')).toHaveValue('high');
    await expectSelectedLabel(reopenedLimits.getByRole('combobox', { name: 'Thinking mód' }), 'adaptive');
    await expect(reopenedLimits.getByLabel('Jogosultsági mód')).toHaveValue('acceptEdits');
    await expect(
      reopenedLimits.getByRole('group', { name: 'Bekapcsolt motor hookok' }).getByRole('checkbox'),
    ).toBeChecked();
  });
});

test.describe('agent_step node: eszközök, környezet, sandbox, strukturált kimenet', () => {
  test('az eszköz listák, a munkakönyvtár, a sandbox és a strukturált kimenet mező szerkeszthető és megmarad', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-agent');
    const group = await openAccordion(panel, 'Eszközök és környezet');
    await group.getByLabel('Engedélyezett eszközök').fill('Read\nWrite');
    await group.getByLabel('Tiltott eszközök').fill('Bash');

    const agentTools = group.getByRole('group', { name: 'Beépített agent eszközök' });
    await agentTools.getByText('web_search').click();
    await expect(agentTools.getByRole('checkbox', { name: 'web_search' })).toBeChecked();
    // A `agentTools.filter` ág: ki is kapcsolható.
    await agentTools.getByText('web_fetch').click();
    await agentTools.getByText('web_fetch').click();
    await expect(agentTools.getByRole('checkbox', { name: 'web_fetch' })).not.toBeChecked();

    await group.getByLabel('Munkakönyvtár (cwd)').fill('/workspace/repo');
    await group.getByLabel('További engedélyezett könyvtárak').fill('/tmp\n/var/data');

    // Sandbox: bekapcsolás, alapérték JSON, majd séma szerint érvénytelen
    // (de szintaktikusan helyes) JSON - ez NÉMÁN elutasítódik, lásd a
    // koordinátornak írt jelentés megjegyzését.
    await group.getByText('Sandbox felülírás megadva').click();
    const sandboxJson = group.getByLabel('Sandbox beállítás (nyers JSON - öt mezője dokumentálatlan, unknown alakú)');
    await expect(sandboxJson).toHaveValue(/"enabled": true/);
    await sandboxJson.fill('{}');
    // Séma szerint érvényes, MÓDOSÍTOTT JSON: ez sikeresen visszaíródik (a
    // `SandboxConfigSchema.safeParse` sikeres ága).
    await sandboxJson.fill(
      JSON.stringify(
        {
          enabled: true,
          failIfUnavailable: true,
          autoAllowBashIfSandboxed: false,
          excludedCommands: ['rm'],
          enableWeakerNestedSandbox: false,
        },
        undefined,
        2,
      ),
    );

    // Strukturált kimenet: bekapcsolás, stratégia váltás, séma JSON szerkesztés.
    await group.getByText('Strukturált kimenet felülírás megadva').click();
    await chooseSelectOption(
      page,
      group.getByRole('combobox', { name: 'Strukturált kimenet stratégiája' }),
      'sdk_output_format',
    );
    await group.getByLabel('Kimenet séma (nyers JSON)').fill('{"type": "object"}');

    await closePanel(page);
    const reopened = await openNode(page, 'n-agent');
    const reopenedGroup = await openAccordion(reopened, 'Eszközök és környezet');
    await expect(reopenedGroup.getByLabel('Engedélyezett eszközök')).toHaveValue('Read\nWrite');
    await expect(reopenedGroup.getByLabel('Tiltott eszközök')).toHaveValue('Bash');
    await expect(reopenedGroup.getByRole('checkbox', { name: 'web_search' })).toBeChecked();
    await expect(reopenedGroup.getByRole('checkbox', { name: 'web_fetch' })).not.toBeChecked();
    await expect(reopenedGroup.getByLabel('Munkakönyvtár (cwd)')).toHaveValue('/workspace/repo');
    await expect(reopenedGroup.getByLabel('További engedélyezett könyvtárak')).toHaveValue('/tmp\n/var/data');
    // A séma szerint érvényes, módosított JSON íródott vissza (a korábbi,
    // séma szerint ÉRVÉNYTELEN `{}` kísérlet nyomtalanul elveszett).
    await expect(reopenedGroup.getByText('Sandbox felülírás megadva')).toBeVisible();
    await expect(
      reopenedGroup.getByLabel('Sandbox beállítás (nyers JSON - öt mezője dokumentálatlan, unknown alakú)'),
    ).toHaveValue(/"failIfUnavailable": true/);
    await expectSelectedLabel(
      reopenedGroup.getByRole('combobox', { name: 'Strukturált kimenet stratégiája' }),
      'sdk_output_format',
    );
    await expect(reopenedGroup.getByLabel('Kimenet séma (nyers JSON)')).toHaveValue('{\n  "type": "object"\n}');

    // Mindkét felülírás kikapcsolható: a JSON szerkesztő eltűnik.
    await reopenedGroup.getByText('Sandbox felülírás megadva').click();
    await expect(
      reopenedGroup.getByLabel('Sandbox beállítás (nyers JSON - öt mezője dokumentálatlan, unknown alakú)'),
    ).toBeAttached({ attached: false });
    await reopenedGroup.getByText('Strukturált kimenet felülírás megadva').click();
    await expect(reopenedGroup.getByLabel('Kimenet séma (nyers JSON)')).toBeAttached({ attached: false });
  });
});

test.describe('agent_step node: SPEC-009 hatókörű, csak olvasható mezők', () => {
  test('a skillek és az MCP szerverek mező olvashatóan, ok megnevezéssel jelenik meg', async ({ page }) => {
    const panel = await openNode(page, 'n-agent');
    const group = await openAccordion(panel, 'Skillek és MCP szerverek (csak olvasható)');
    // A `skills` mező `null`, a `describeUnknownValue` a JSON.stringify ágon
    // fut le (nem a `(nincs megadva)` ágon, mert `null !== undefined`).
    await expect(group.getByText('null', { exact: true })).toBeVisible();
    await expect(group.getByText('{}', { exact: true })).toBeVisible();
    await expect(
      group.getByText('a SPEC-009 hatóköre (skill feltöltés / MCP konfiguráció), itt csak olvasható'),
    ).toHaveCount(2);
  });
});

test.describe('agents mező szerkesztő (AgentsFieldEditor + AgentDefinitionEntryFields)', () => {
  test('a nem objektum alakú bejegyzés riasztást mutat, a szabályos bejegyzés mezői kitölthetők', async ({ page }) => {
    const panel = await openNode(page, 'n-agent');
    const agentsGroup = await openAccordion(panel, 'Al-agentek (agents)');

    // A "legacy" bejegyzés egy sztring, nem objektum: kibontva riasztást ad.
    const legacyGroup = agentsGroup.getByRole('group', { name: 'legacy' });
    await legacyGroup.getByRole('button', { name: 'Kibontás' }).click();
    await expect(legacyGroup.getByRole('alert')).toHaveText(
      'Ez a bejegyzés nem objektum alakú, itt nem szerkeszthető.',
    );

    // A "kutato" bejegyzés szabályos objektum: minden mezőcsoport megjelenik.
    const kutatoGroup = agentsGroup.getByRole('group', { name: 'kutato', exact: true });
    await kutatoGroup.getByRole('button', { name: 'Kibontás' }).click();
    await expect(kutatoGroup.getByLabel('Leírás')).toHaveValue('Kutat a weben.');
    await expect(kutatoGroup.getByLabel('Prompt')).toHaveValue('Kutass alaposan.');

    // Össze- és kibontás: mindkét `toggleExpanded` ág lefut.
    await kutatoGroup.getByRole('button', { name: 'Összecsukás' }).click();
    await expect(kutatoGroup.getByLabel('Leírás')).toBeAttached({ attached: false });
    await kutatoGroup.getByRole('button', { name: 'Kibontás' }).click();
    await expect(kutatoGroup.getByLabel('Leírás')).toBeVisible();

    // A bejegyzés ritkán szerkesztett mezői is összecsukható panelekben
    // állnak (a kötelező leírás és prompt marad elöl).
    const kutatoLimits = await openAccordion(kutatoGroup, 'Modell és korlátok');
    await kutatoLimits.getByLabel('Modell', { exact: true }).fill('claude-sonnet-4');
    await kutatoLimits.getByLabel('Max. körök száma').fill('4');
    await kutatoLimits.getByLabel('Effort (szint neve vagy szám)').fill('medium');
    await kutatoLimits.getByLabel('Jogosultsági mód').fill('plan');
    await kutatoLimits.getByText('Háttérben fut').click();
    await expect(kutatoLimits.getByRole('checkbox', { name: 'Háttérben fut' })).toBeChecked();

    const kutatoTools = await openAccordion(kutatoGroup, 'Eszközök és környezet');
    await kutatoTools.getByLabel('Engedélyezett eszközök').fill('Read');
    await kutatoTools.getByLabel('Tiltott eszközök').fill('Bash');
    await chooseSelectOption(page, kutatoTools.getByRole('combobox', { name: 'Memória hatóköre' }), 'project');
    await kutatoTools.getByLabel('Kezdő üzenet').fill('Szia!');

    const kutatoReadOnly = await openAccordion(kutatoGroup, 'Skillek és MCP szerverek (csak olvasható)');
    // A `skills` mező sztring (`'all'`) -> a `describeUnknownValue` sztring ága.
    await expect(kutatoReadOnly.getByText('all', { exact: true })).toBeVisible();
    await expect(
      kutatoReadOnly.getByText(
        'nem megerősített mező: csak a telepített .d.ts fájlban szerepel, hivatalos dokumentáció nem fedi (M-90)',
      ),
    ).toBeVisible();
    await expect(kutatoReadOnly.getByText('criticalSystemReminder_EXPERIMENTAL')).toBeVisible();

    await closePanel(page);
    const reopened = await openNode(page, 'n-agent');
    const reopenedAgentsGroup = await openAccordion(reopened, 'Al-agentek (agents)');
    const reopenedKutato = reopenedAgentsGroup.getByRole('group', { name: 'kutato', exact: true });
    await reopenedKutato.getByRole('button', { name: 'Kibontás' }).click();
    const reopenedLimits = await openAccordion(reopenedKutato, 'Modell és korlátok');
    await expect(reopenedLimits.getByLabel('Modell', { exact: true })).toHaveValue('claude-sonnet-4');
    await expect(reopenedLimits.getByLabel('Max. körök száma')).toHaveValue('4');
    await expect(reopenedLimits.getByRole('checkbox', { name: 'Háttérben fut' })).toBeChecked();
    const reopenedTools = await openAccordion(reopenedKutato, 'Eszközök és környezet');
    await expectSelectedLabel(reopenedTools.getByRole('combobox', { name: 'Memória hatóköre' }), 'project');
    await expect(reopenedTools.getByLabel('Kezdő üzenet')).toHaveValue('Szia!');
  });

  test('agent hozzáadása üres vagy ütköző névvel tiltott, érvényes névvel felvehető; átnevezés és törlés', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-agent');
    const agentsGroup = await openAccordion(panel, 'Al-agentek (agents)');

    const agentAddButton = agentsGroup.getByRole('button', { name: 'Agent hozzáadása' });
    // Üres név: a gomb tiltott (üres kötelező mező védelem).
    await expect(agentAddButton).toBeDisabled();
    // Már létező kulcs: szintén tiltott.
    await agentsGroup.getByLabel('Új agent neve').fill('kutato');
    await expect(agentAddButton).toBeDisabled();

    await agentsGroup.getByLabel('Új agent neve').fill('masodik');
    await expect(agentAddButton).toBeEnabled();
    await agentAddButton.click();
    const newGroup = agentsGroup.getByRole('group', { name: 'masodik', exact: true });
    await expect(newGroup).toBeVisible();
    await newGroup.getByRole('button', { name: 'Kibontás' }).click();
    await expect(newGroup.getByLabel('Leírás')).toHaveValue('');
    await expect(newGroup.getByLabel('Prompt')).toHaveValue('');

    // Átnevezés: változatlan névvel tiltott, új, egyedi névvel engedélyezett.
    const renameButton = newGroup.getByRole('button', { name: 'Átnevezés' });
    await expect(renameButton).toBeDisabled();
    const renameField = newGroup.getByLabel('"masodik" agent új neve');
    await renameField.fill('harmadik');
    await expect(renameButton).toBeEnabled();
    await renameButton.click();
    await expect(agentsGroup.getByRole('group', { name: 'harmadik', exact: true })).toBeVisible();
    await expect(agentsGroup.getByRole('group', { name: 'masodik', exact: true })).toBeAttached({ attached: false });

    // Törlés: a "legacy" bejegyzés eltávolítható.
    await agentsGroup.getByRole('group', { name: 'legacy' }).getByRole('button', { name: 'Törlés' }).click();
    await expect(agentsGroup.getByRole('group', { name: 'legacy' })).toBeAttached({ attached: false });

    await closePanel(page);
    const reopened = await openNode(page, 'n-agent');
    const reopenedAgents = await openAccordion(reopened, 'Al-agentek (agents)');
    await expect(reopenedAgents.getByRole('group', { name: 'harmadik', exact: true })).toBeVisible();
    await expect(reopenedAgents.getByRole('group', { name: 'legacy' })).toBeAttached({ attached: false });
    await expect(reopenedAgents.getByRole('group', { name: 'kutato', exact: true })).toBeVisible();
  });
});

test.describe('branch node', () => {
  test('a feltétel, az ágak listája és az alapértelmezett ág szerkeszthető és megmarad', async ({ page }) => {
    const panel = await openNode(page, 'n-branch');
    await panel.getByLabel('Feltétel kifejezés').fill('input.category');

    const rows = panel.locator('.node-inspector__list-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0).getByLabel('Ág kulcsa')).toHaveValue('a');
    await panel.getByRole('button', { name: 'Ág hozzáadása' }).click();
    await expect(rows).toHaveCount(2);
    await rows.nth(1).getByLabel('Ág kulcsa').fill('b');
    await rows.nth(1).getByLabel('Ág címkéje').fill('B ág');

    await rows.nth(0).getByRole('button', { name: 'Törlés' }).click();
    await expect(rows).toHaveCount(1);

    await panel.getByLabel('Alapértelmezett ág kulcsa (ha egyik feltétel sem talál)').fill('b');

    await closePanel(page);
    const reopened = await openNode(page, 'n-branch');
    await expect(reopened.getByLabel('Feltétel kifejezés')).toHaveValue('input.category');
    const reopenedRows = reopened.locator('.node-inspector__list-row');
    await expect(reopenedRows).toHaveCount(1);
    await expect(reopenedRows.nth(0).getByLabel('Ág kulcsa')).toHaveValue('b');
    await expect(reopenedRows.nth(0).getByLabel('Ág címkéje')).toHaveValue('B ág');
    await expect(reopened.getByLabel('Alapértelmezett ág kulcsa (ha egyik feltétel sem talál)')).toHaveValue('b');

    // A mező kiürítése `null`-ra képződik vissza.
    await reopened.getByLabel('Alapértelmezett ág kulcsa (ha egyik feltétel sem talál)').fill('');
    await closePanel(page);
    const reopenedAgain = await openNode(page, 'n-branch');
    await expect(reopenedAgain.getByLabel('Alapértelmezett ág kulcsa (ha egyik feltétel sem talál)')).toHaveValue('');
  });
});

test.describe('fan_out node', () => {
  test('az elemek kifejezés és az ág címke sablon szerkeszthető és megmarad', async ({ page }) => {
    const panel = await openNode(page, 'n-fanout');
    await expect(panel.getByLabel('Elemek kifejezés (itemsExpression)')).toHaveValue('input.items');
    await panel.getByLabel('Elemek kifejezés (itemsExpression)').fill('input.list');
    await panel.getByLabel('Ág címke sablon (branchLabelTemplate)').fill('Ág {{key}}');

    await closePanel(page);
    const reopened = await openNode(page, 'n-fanout');
    await expect(reopened.getByLabel('Elemek kifejezés (itemsExpression)')).toHaveValue('input.list');
    await expect(reopened.getByLabel('Ág címke sablon (branchLabelTemplate)')).toHaveValue('Ág {{key}}');
  });
});

test.describe('join node', () => {
  test('a három mód (merge/script/ai_synthesis) között váltva a megfelelő mezők jelennek meg', async ({ page }) => {
    const panel = await openNode(page, 'n-join');
    const modeSelect = panel.getByRole('combobox', { name: 'Összefésülés módja' });
    await expectSelectedLabel(modeSelect, 'összefésülés');
    const jsonField = panel.getByLabel('Összefésülési beállítás (nyers JSON - nincs sémája a mezőin)');
    await expect(jsonField).toHaveValue('{}');

    // Szintaktikai JSON hiba: a szerkesztő saját hibaüzenete jelenik meg,
    // de csak a mező ELHAGYÁSA után (érintett + érvénytelen szabály).
    await jsonField.fill('{ez nem json');
    await jsonField.blur();
    await expect(panel.getByText('Érvénytelen JSON - a változtatás egyelőre nem kerül mentésre.')).toBeVisible();

    // Szemantikailag érvénytelen (de szintaktikusan helyes) JSON: a
    // `JoinMergeSettingsSchema.safeParse` elutasítja, az `onChange` nem fut le.
    await jsonField.fill('42');
    await expect(panel.getByText('Érvénytelen JSON - a változtatás egyelőre nem kerül mentésre.')).toBeAttached({
      attached: false,
    });

    // Séma szerint érvényes JSON: ez sikeresen visszaíródik (a `Locator` a
    // panel bezárása/újranyitása után is ugyanarra a `.node-inspector`
    // szelektorra kérdez rá újra, tehát a `panel`/`jsonField` továbbra is
    // érvényes marad).
    await jsonField.fill('{"strategy": "concat"}');
    await closePanel(page);
    await openNode(page, 'n-join');
    await expect(jsonField).toHaveValue('{\n  "strategy": "concat"\n}');

    await chooseSelectOption(page, modeSelect, 'szkript');
    await expect(panel.getByLabel('Forrás (source)')).toHaveValue('');
    await panel.getByLabel('Forrás (source)').fill('return input;');

    await chooseSelectOption(page, modeSelect, 'AI szintézis');
    await expect(panel.getByLabel('Prompt sablon')).toHaveValue('');
    // Az `ai_synthesis` alapértelmezett `agents` mezője üres - az al-agentek
    // panel zárva indul, tehát ki kell nyitni hozzá.
    const joinAgents = await openAccordion(panel, 'Al-agentek (agents)');
    await expect(joinAgents.getByText('Nincs felvett agent.')).toBeVisible();
    await panel.getByLabel('Prompt sablon').fill('Szintetizáld az ágak kimenetét.');

    await chooseSelectOption(page, modeSelect, 'összefésülés');
    // Mód váltáskor a `settings` mindig visszaáll az alapértelmezettre.
    await expect(panel.getByLabel('Összefésülési beállítás (nyers JSON - nincs sémája a mezőin)')).toHaveValue('{}');

    await closePanel(page);
    const reopened = await openNode(page, 'n-join');
    await expectSelectedLabel(reopened.getByRole('combobox', { name: 'Összefésülés módja' }), 'összefésülés');
  });
});

test.describe('loop node', () => {
  test('a max. iterációszám és a folytatás feltétel szerkeszthető és megmarad', async ({ page }) => {
    const panel = await openNode(page, 'n-loop');
    await expect(panel.getByLabel('Max. iterációk száma')).toHaveValue('3');
    await panel.getByLabel('Max. iterációk száma').fill('7');
    await panel.getByLabel('Folytatás feltétel (continueExpression)').fill('input.done === false');

    await closePanel(page);
    const reopened = await openNode(page, 'n-loop');
    await expect(reopened.getByLabel('Max. iterációk száma')).toHaveValue('7');
    await expect(reopened.getByLabel('Folytatás feltétel (continueExpression)')).toHaveValue('input.done === false');
  });
});

test.describe('human_approval node', () => {
  test('a cím, a törzs sablon és az időkorlát szerkeszthető, az üres időkorlát null-ra képződik', async ({ page }) => {
    const panel = await openNode(page, 'n-human');
    await panel.getByLabel('Cím').fill('Kérlek erősítsd meg');
    await panel.getByLabel('Törzs sablon (bodyTemplate)').fill('A lépés kimenete: {{output}}');
    await panel.getByLabel('Időkorlát ms-ben (üres = korlátlan)').fill('5000');

    await closePanel(page);
    const reopened = await openNode(page, 'n-human');
    await expect(reopened.getByLabel('Cím')).toHaveValue('Kérlek erősítsd meg');
    await expect(reopened.getByLabel('Törzs sablon (bodyTemplate)')).toHaveValue('A lépés kimenete: {{output}}');
    await expect(reopened.getByLabel('Időkorlát ms-ben (üres = korlátlan)')).toHaveValue('5000');

    await reopened.getByLabel('Időkorlát ms-ben (üres = korlátlan)').fill('');
    await closePanel(page);
    const reopenedAgain = await openNode(page, 'n-human');
    await expect(reopenedAgain.getByLabel('Időkorlát ms-ben (üres = korlátlan)')).toHaveValue('');
  });
});

test.describe('error_handler node', () => {
  test('a próbálkozásszám, a várakozás lista és a hibafajták listája szerkeszthető és megmarad', async ({ page }) => {
    const panel = await openNode(page, 'n-error');
    await expect(panel.getByLabel('Max. próbálkozások száma')).toHaveValue('3');
    await panel.getByLabel('Max. próbálkozások száma').fill('5');
    await expect(panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)')).toHaveValue('100\n200');
    await panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)').fill('50\n\n150');
    await panel.getByLabel('Kezelt hibafajták (soronként egy)').fill('timeout\nrate_limit');

    await closePanel(page);
    const reopened = await openNode(page, 'n-error');
    await expect(reopened.getByLabel('Max. próbálkozások száma')).toHaveValue('5');
    // Az üres sorok kiszűrve.
    await expect(reopened.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)')).toHaveValue('50\n150');
    await expect(reopened.getByLabel('Kezelt hibafajták (soronként egy)')).toHaveValue('timeout\nrate_limit');
  });

  test('nem numerikus backoffMs sor a NodeConfigSchema szerint érvénytelen állapotot hoz létre, a hibaüzenet a mező alatt jelenik meg', async ({
    page,
  }) => {
    // A `backoffMs` textarea (number-list-field-value.ts) NEM natív
    // `type="number"` input, tehát a böngésző nem szűri ki a nem numerikus
    // sort: a `fromNumberListFieldValue` a `Number('abc')` NaN eredményét
    // válogatás nélkül a tömbbe teszi. A `NodeConfigSchema.safeParse` a
    // `z.number()` miatt a NaN-t elutasítja (mérve: `z.number().safeParse(NaN)`
    // `invalid_type` hibát ad), tehát ez a mezőnkénti hibajelzést
    // (`fieldErrorsFromZodError`) TÉNYLEGESEN felhasználói úton eléri.
    const panel = await openNode(page, 'n-error');
    await expect(panel.getByRole('alert')).toBeAttached({ attached: false });

    const backoffField = panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)');
    await backoffField.fill('50\nabc\n150');
    await backoffField.blur();

    // A hibaüzenet `role="alert"` szerepű, és a HIBÁS MEZŐ alatt áll, nem a
    // panel tetején: a `backoffMs.1` útvonal a mező saját üzenetévé válik,
    // mert a `findFieldError` az elem szintű útvonalat is a mezőhöz köti.
    const alert = panel.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toHaveClass(/field__error/);
    // A pontos zod üzenetszöveg NEM stabil ellenőrzési pont: a `VITE_COVERAGE`
    // instrumentált buildben az Istanbul által eltolt `/* @__PURE__ */`
    // annotáció miatt a Rolldown a zod alapértelmezett locale regisztrációját
    // tree-shake-eli (a `webServer` build log ugyanerre a jelenségre figyelmeztet
    // több fájlban, INVALID_ANNOTATION), ezért a mért, ténylegesen megjelenő
    // szöveg a rövidebb "Invalid input".
    await expect(alert).toContainText('Invalid input');
    await expect(backoffField).toHaveAttribute('aria-describedby', /-error$/);
  });

  test('a mentés a séma ellenőrzésen elbukik, ha a panelen érvénytelen érték maradt', async ({ page }) => {
    // A `graph-editor-validation.spec.ts` fejléc kommentje szerint a
    // `validateGraphForSave` HIBA ága felhasználói úton elérhetetlen, mert a
    // `node-config` sémákban nincs `regex`/`min`/`max` korlátozás, a natív
    // `<input type="number">` pedig kitisztítja a nem numerikus bevitelt. Ez
    // a `backoffMs` mezőre MÉRTEN NEM IGAZ: a mező textarea (soronként egy
    // szám), tehát a böngésző nem szűr, a `Number('abc')` NaN-t ad, és a
    // `z.number()` a NaN-t elutasítja. A mentés így ténylegesen elbukik a
    // séma ellenőrzésen, hálózati hívás nélkül.
    const panel = await openNode(page, 'n-error');
    await panel.getByLabel('Várakozás próbálkozásonként, ms (soronként egy szám)').fill('50\nabc\n150');

    await page.getByRole('button', { name: 'Mentés', exact: true }).click();

    // A lábléc `role="alert"` üzenete megnevezi a hibás mező ÚTVONALÁT is,
    // a `zodErrorToProtocolErrorBody` jóvoltából.
    const footerAlert = page.locator('.page-footer').getByRole('alert');
    await expect(footerAlert).toBeVisible();
    await expect(footerAlert).toContainText('backoffMs');
  });
});

test.describe('sub_workflow node', () => {
  test('a célzott workflow azonosító és a bemenet leképezés szerkeszthető, az érvénytelen sor kiszűrve marad', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-subworkflow');
    await expect(panel.getByLabel('Célzott workflow azonosítója')).toHaveValue('w-child');
    await panel.getByLabel('Célzott workflow azonosítója').fill('w-masik');
    await expect(panel.getByLabel('Bemenet leképezés (soronként kulcs=érték)')).toHaveValue('topic=input.topic');
    // A `=nincskulcs` sornak nincs kulcsa (separatorIndex === 0): kiszűrődik.
    await panel
      .getByLabel('Bemenet leképezés (soronként kulcs=érték)')
      .fill('topic=input.topic\ncount=input.count\n=nincskulcs');

    await closePanel(page);
    const reopened = await openNode(page, 'n-subworkflow');
    await expect(reopened.getByLabel('Célzott workflow azonosítója')).toHaveValue('w-masik');
    await expect(reopened.getByLabel('Bemenet leképezés (soronként kulcs=érték)')).toHaveValue(
      'topic=input.topic\ncount=input.count',
    );
  });
});

test.describe('script node', () => {
  test('a motor elutasítás figyelmeztetés látszik, a forrás szerkeszthető, a runtime csak olvasható', async ({
    page,
  }) => {
    const panel = await openNode(page, 'n-script');
    await expect(panel.getByRole('alert')).toContainText('unimplemented_node_type');
    await expect(panel.getByText('expression', { exact: true })).toBeVisible();
    await expect(panel.getByLabel('Forrás (source)')).toHaveValue('return 1;');
    await panel.getByLabel('Forrás (source)').fill('return input.value * 2;');

    await closePanel(page);
    const reopened = await openNode(page, 'n-script');
    await expect(reopened.getByLabel('Forrás (source)')).toHaveValue('return input.value * 2;');
  });
});
