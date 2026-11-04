// E2E a `script` csomópont beállítás paneljére valós Chromiumban (PLAN-015
// T-015-10, SPEC-014 5.9, AC9): a `runtime` választó, a JavaScript ág három
// mezője, az időkorlát másodpercben szerkesztett és ezredmásodpercben tárolt
// értéke a mentés `PUT` törzsében, valamint a `source` és a memória korlát
// mentési hibája a mező alatt, `PUT` kérés nélkül. A mentés kérés törzse
// `page.route()` mockon rögzül, a `ReplaceGraphRequestSchema` szerint
// értelmezve; valós backend szervert a teszt nem szólít meg.
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

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

function storedNode(
  id: string,
  type: NodeConfig['type'],
  label: string,
  positionX: number,
  config: NodeConfig,
): WorkflowGraphDocument['nodes'][number] {
  return { id, type, label, positionX, positionY: 0, config, createdAtMs: 1, updatedAtMs: 1 };
}

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    storedNode('n1', 'start', 'Indítás', 0, { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }),
    storedNode('n2', 'script', 'Szkript lépés', 500, {
      type: 'script',
      source: 'input.x + 1',
      runtime: 'expression',
      onUnhandledError: 'fail_run',
    }),
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  builtinSkillsEnabled: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false, builtinSkillsEnabled: true };

const EDITOR_URL = '/editor?workflowId=w-alfa';

const BLANK_FIELD_MESSAGE = 'A mező nem lehet üres.';
// Az időkorlát mező a séma ezredmásodperces mondata helyett a saját, másodperces mondatát mutatja (T-015-12).
const TIMEOUT_SECONDS_MESSAGE =
  'Az időkorlát pozitív szám legyen másodpercben, legfeljebb három tizedesjeggyel, és legfeljebb 2 147 483,647 másodperc.';
const MEMORY_OUT_OF_RANGE_MESSAGE = 'A mező értéke 16 és 2048 közötti egész szám lehet.';

/**
 * A mező alatti hiba: `aria-invalid`, és a hozzáférhető leírás a mező
 * `role="alert"` hibaüzenete (`aria-describedby`, `.claude/CLAUDE.md` 11.).
 */
async function expectFieldError(field: Locator, message: string): Promise<void> {
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription(message);
}

async function expectNoFieldError(field: Locator): Promise<void> {
  await expect(field).not.toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAccessibleDescription('');
}

function saveButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Mentés', exact: true });
}

/**
 * A szerkesztő mockjai: a `PUT` törzseit a `putBodies` gyűjti, a válasz a
 * kérés gráfja a szerver időbélyegeivel.
 */
async function installEditorMocks(page: Page, putBodies: unknown[]): Promise<void> {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      const body: unknown = route.request().postDataJSON();
      putBodies.push(body);
      const parsed = ReplaceGraphRequestSchema.safeParse(body);
      if (!parsed.success) {
        throw new Error('a teszt PUT törzse nem felel meg a ReplaceGraphRequestSchema-nak');
      }
      await route.fulfill(
        jsonBody({
          nodes: parsed.data.nodes.map((node) => ({ ...node, createdAtMs: 1, updatedAtMs: 1 })),
          edges: parsed.data.edges.map((edge) => ({ ...edge, createdAtMs: 1 })),
        }),
      );
    }),
  ]);
}

function parseSavedGraph(body: unknown): ReplaceGraphRequest {
  const parsed = ReplaceGraphRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

/**
 * Megnyitja a szerkesztőt, kiválasztja a szkript csomópontot, és átvált
 * JavaScript runtime-ra. A panel a három JavaScript mezővel tér vissza.
 */
async function openScriptPanel(page: Page, putBodies: unknown[]): Promise<Locator> {
  await installEditorMocks(page, putBodies);
  await page.goto(EDITOR_URL);
  await page.getByTestId('rf__node-n2').click();
  const panel = page.getByRole('complementary', { name: 'Szkript beállításai' });
  await expect(panel).toBeVisible();
  return panel;
}

async function switchToJavaScript(page: Page, panel: Locator): Promise<void> {
  await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Futásidő (runtime)' }), 'JavaScript');
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('a runtime választó CEL kifejezésen áll és három JavaScript mező nincs; JavaScriptre váltva megjelenik az időkorlát, a munkakönyvtár és a memória korlát az alapérték feliratokkal, a forrás megmarad', async ({
  page,
}) => {
  const panel = await openScriptPanel(page, []);
  const runtime = panel.getByRole('combobox', { name: 'Futásidő (runtime)' });
  await expectSelectedLabel(runtime, 'CEL kifejezés');
  await expect(panel.getByLabel('Időkorlát (másodperc)')).toHaveCount(0);
  await expect(panel.getByLabel('Munkakönyvtár (cwd)')).toHaveCount(0);
  await expect(panel.getByLabel('Memória korlát (MB)')).toHaveCount(0);

  await switchToJavaScript(page, panel);
  await expectSelectedLabel(runtime, 'JavaScript');
  await expect(panel.getByLabel('Forrás (source)')).toHaveValue('input.x + 1');
  const timeout = panel.getByLabel('Időkorlát (másodperc)');
  await expect(timeout).toHaveValue('');
  await expect(timeout).toHaveAttribute('placeholder', 'Üresen 60 másodperc');
  const cwd = panel.getByLabel('Munkakönyvtár (cwd)');
  await expect(cwd).toHaveValue('');
  await expect(cwd).toHaveAttribute('placeholder', 'Üresen a szerver munkakönyvtára');
  const memory = panel.getByLabel('Memória korlát (MB)');
  await expect(memory).toHaveValue('');
  await expect(memory).toHaveAttribute('placeholder', 'Üresen a rendszermemória, legfeljebb 2048 MB');
});

test('az időkorlát másodpercben beírva ezredmásodpercként kerül a mentés PUT törzsébe, a munkakönyvtár és a memória korláttal együtt; a CEL-re visszaváltás eldobja a JavaScript mezőket', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  const panel = await openScriptPanel(page, putBodies);
  await switchToJavaScript(page, panel);
  await panel.getByLabel('Forrás (source)').fill('return input.x * 2;');
  await panel.getByLabel('Időkorlát (másodperc)').fill('1.5');
  await panel.getByLabel('Munkakönyvtár (cwd)').fill('/munka');
  await panel.getByLabel('Memória korlát (MB)').fill('512');

  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(parseSavedGraph(putBodies[0]).nodes.find((node) => node.id === 'n2')?.config).toEqual({
    type: 'script',
    runtime: 'javascript',
    source: 'return input.x * 2;',
    timeoutMs: 1500,
    cwd: '/munka',
    memoryLimitMb: 512,
    onUnhandledError: 'fail_run',
  });

  // Újranyitás: a mentett értékek a mezőkben másodpercként és MB-ban állnak.
  await page.getByTestId('rf__node-n1').click();
  await page.getByTestId('rf__node-n2').click();
  await expect(panel.getByLabel('Időkorlát (másodperc)')).toHaveValue('1.5');
  await expect(panel.getByLabel('Munkakönyvtár (cwd)')).toHaveValue('/munka');
  await expect(panel.getByLabel('Memória korlát (MB)')).toHaveValue('512');

  // Az üres mező visszaáll az alapértékre (`null`).
  await panel.getByLabel('Időkorlát (másodperc)').fill('');
  await panel.getByLabel('Munkakönyvtár (cwd)').fill('');
  await panel.getByLabel('Memória korlát (MB)').fill('');
  await saveButton(page).click();
  await expect.poll(() => putBodies.length).toBe(2);
  expect(parseSavedGraph(putBodies[1]).nodes.find((node) => node.id === 'n2')?.config).toMatchObject({
    runtime: 'javascript',
    timeoutMs: null,
    cwd: null,
    memoryLimitMb: null,
  });

  await chooseSelectOption(page, panel.getByRole('combobox', { name: 'Futásidő (runtime)' }), 'CEL kifejezés');
  await expect(panel.getByLabel('Időkorlát (másodperc)')).toHaveCount(0);
  await saveButton(page).click();
  await expect.poll(() => putBodies.length).toBe(3);
  expect(parseSavedGraph(putBodies[2]).nodes.find((node) => node.id === 'n2')?.config).toEqual({
    type: 'script',
    runtime: 'expression',
    source: 'return input.x * 2;',
    onUnhandledError: 'fail_run',
  });
});

test('az üres source mentéskor a mező alatt jelez, PUT nélkül; kitöltés után a mentés lefut', async ({ page }) => {
  const putBodies: unknown[] = [];
  const panel = await openScriptPanel(page, putBodies);
  const source = panel.getByLabel('Forrás (source)');
  await source.fill('');
  await saveButton(page).click();
  await expectFieldError(source, BLANK_FIELD_MESSAGE);
  expect(putBodies).toHaveLength(0);

  await source.fill('input.x');
  await expectNoFieldError(source);
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
});

test('a JavaScript ágon is kötelező a source: üresen a mező alatt jelez, PUT nélkül', async ({ page }) => {
  const putBodies: unknown[] = [];
  const panel = await openScriptPanel(page, putBodies);
  await switchToJavaScript(page, panel);
  const source = panel.getByLabel('Forrás (source)');
  await source.fill('');
  await saveButton(page).click();
  await expectFieldError(source, BLANK_FIELD_MESSAGE);
  expect(putBodies).toHaveLength(0);
});

for (const invalid of ['8', '4096', '16.5', '0']) {
  test(`a tartományon kívüli vagy nem egész memória korlát (${invalid}) a mező alatt jelez, PUT nélkül; 16 ... 2048 között a mentés lefut`, async ({
    page,
  }) => {
    const putBodies: unknown[] = [];
    const panel = await openScriptPanel(page, putBodies);
    await switchToJavaScript(page, panel);
    const memory = panel.getByLabel('Memória korlát (MB)');
    await memory.fill(invalid);
    await saveButton(page).click();
    await expectFieldError(memory, MEMORY_OUT_OF_RANGE_MESSAGE);
    expect(putBodies).toHaveLength(0);

    await memory.fill('2048');
    await expectNoFieldError(memory);
    await saveButton(page).click();
    await expect(page.getByText('Gráf mentve')).toBeVisible();
    expect(putBodies).toHaveLength(1);
  });
}

test('az időkorlát mentési hibái a mező alatt állnak: az ezredmásodpercnél finomabb, a nulla és a felső határ fölötti másodperc érték elutasított, nem kerekített', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  const panel = await openScriptPanel(page, putBodies);
  await switchToJavaScript(page, panel);
  const timeout = panel.getByLabel('Időkorlát (másodperc)');

  await timeout.fill('1.0004');
  await saveButton(page).click();
  await expectFieldError(timeout, TIMEOUT_SECONDS_MESSAGE);
  await timeout.fill('0');
  await expectFieldError(timeout, TIMEOUT_SECONDS_MESSAGE);
  await timeout.fill('3000000');
  await expectFieldError(timeout, TIMEOUT_SECONDS_MESSAGE);
  expect(putBodies).toHaveLength(0);

  // A tizedes másodperc, aminek az ezerszerese egész, hibátlan.
  await timeout.fill('1.1');
  await expectNoFieldError(timeout);
  await saveButton(page).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(parseSavedGraph(putBodies[0]).nodes.find((node) => node.id === 'n2')?.config).toMatchObject({
    timeoutMs: 1100,
  });
});
