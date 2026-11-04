// E2E a Start csomópont bemeneti mezőjének értéktípusára a szerkesztőben
// (PLAN-017 T-017-7, SPEC-016 5.1, 5.3, 5.6, AC3 felület rész): a hat típus
// felirata és az alapérték `text`, a `choice` típus opciók mezője, a típusváltás
// hatása a mentés `PUT` törzsére (az `options` kulcs csak a `choice` ágon áll,
// különben a szigorú zárt kulcslista elutasítaná), és az üres opciólista mentési
// hibája a mező alatt, `PUT` kérés nélkül. Minden REST hívás `page.route()`
// mockon megy (`.claude/CLAUDE.md` 11. szekció).
import {
  ReplaceGraphRequestSchema,
  type SettingsRecord,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
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
  builtinSkillsEnabled: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false, builtinSkillsEnabled: true };

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

/**
 * A `protocol` mentési sémájának egyetlen mondata a `choice` opciólista három
 * hibájára (`NodeConfigSaveSchema`).
 */
const INVALID_CHOICE_OPTIONS_MESSAGE = 'Legalább egy opció kell, az opciók nem lehetnek üresek és nem ismétlődhetnek.';

const VALUE_KIND_LABELS = ['Szöveg', 'Szám', 'Igen/nem', 'Választólista', 'Lista', 'JSON adat'] as const;

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

/**
 * Egy új bemeneti mező felvétele a Start panelen, a név és a címke kitöltésével
 * (mindkettő kötelező szöveg mező), és a sor visszaadása.
 */
async function addInputField(page: Page): Promise<{ readonly panel: Locator; readonly row: Locator }> {
  await page.getByTestId('rf__node-n1').click();
  const panel = page.getByRole('complementary', { name: 'Indítás beállításai' });
  await panel.getByRole('button', { name: 'Bemeneti mező hozzáadása' }).click();
  const row = panel.locator('.node-inspector__list-row');
  await expect(row).toHaveCount(1);
  await row.getByRole('textbox', { name: 'Név', exact: true }).fill('szin');
  await row.getByRole('textbox', { name: 'Címke', exact: true }).fill('Szín');
  return { panel, row };
}

function savedInputFields(body: unknown): unknown {
  const parsed = ReplaceGraphRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  const [node] = parsed.data.nodes;
  return node?.config.type === 'start' ? node.config.inputFields : undefined;
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('az új bemeneti mező típusa Szöveg, a választó a hat értéket magyar felirattal kínálja', async ({ page }) => {
  await installEditorMocks(page, []);
  await page.goto(EDITOR_URL);
  const { row } = await addInputField(page);

  const valueKind = row.getByRole('combobox', { name: 'Érték típusa' });
  await expect(valueKind).toHaveText('Szöveg');
  await valueKind.click();
  const options = page.getByRole('listbox').getByRole('option');
  await expect(options).toHaveText([...VALUE_KIND_LABELS]);
});

test('az opciók mező csak a Választólista típusnál látszik, és a típusváltás szerint tűnik el', async ({ page }) => {
  await installEditorMocks(page, []);
  await page.goto(EDITOR_URL);
  const { row } = await addInputField(page);
  const optionsField = row.getByRole('textbox', { name: 'Opciók (soronként egy)' });
  const valueKind = row.getByRole('combobox', { name: 'Érték típusa' });

  await expect(optionsField).toHaveCount(0);
  await chooseSelectOption(page, valueKind, 'Választólista');
  await expect(optionsField).toBeVisible();
  await optionsField.fill('piros\nzöld');
  await chooseSelectOption(page, valueKind, 'Lista');
  await expect(optionsField).toHaveCount(0);
  // Vissza a választólistára: az opciók a típusváltással elvesztek.
  await chooseSelectOption(page, valueKind, 'Választólista');
  await expect(optionsField).toHaveValue('');
});

test('üres opciólistával a mentés PUT nélkül a mező alatt jelez, az opciók kitöltése után a PUT törzs a choice alakot hordozza', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await installEditorMocks(page, putBodies);
  await page.goto(EDITOR_URL);
  const { row } = await addInputField(page);
  await chooseSelectOption(page, row.getByRole('combobox', { name: 'Érték típusa' }), 'Választólista');
  const optionsField = row.getByRole('textbox', { name: 'Opciók (soronként egy)' });

  // A mentési kísérlet előtt nincs hiba (a mező érintetlen, az űrlap nincs beküldve).
  await expect(optionsField).not.toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(optionsField).toHaveAttribute('aria-invalid', 'true');
  await expect(optionsField).toHaveAccessibleDescription(INVALID_CHOICE_OPTIONS_MESSAGE);
  expect(putBodies).toHaveLength(0);

  // Ismétlődő opciók ugyanazt a hibát adják.
  await optionsField.fill('piros\npiros');
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(optionsField).toHaveAccessibleDescription(INVALID_CHOICE_OPTIONS_MESSAGE);
  expect(putBodies).toHaveLength(0);

  await optionsField.fill('piros\nzöld');
  await expect(optionsField).not.toHaveAttribute('aria-invalid', 'true');
  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(savedInputFields(putBodies[0])).toEqual([
    { name: 'szin', label: 'Szín', valueKind: 'choice', options: ['piros', 'zöld'], required: false },
  ]);
});

test('a választólistáról másik típusra váltás után a PUT törzsben nincs options kulcs', async ({ page }) => {
  const putBodies: unknown[] = [];
  await installEditorMocks(page, putBodies);
  await page.goto(EDITOR_URL);
  const { row } = await addInputField(page);
  const valueKind = row.getByRole('combobox', { name: 'Érték típusa' });
  await chooseSelectOption(page, valueKind, 'Választólista');
  await row.getByRole('textbox', { name: 'Opciók (soronként egy)' }).fill('piros');
  await chooseSelectOption(page, valueKind, 'JSON adat');

  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(savedInputFields(putBodies[0])).toEqual([{ name: 'szin', label: 'Szín', valueKind: 'json', required: false }]);
});

test('az opciók mezőbe billentyűzetről gépelve az Enter és a szóköz megmarad, a PUT törzs a bontott listát hordozza', async ({
  page,
}) => {
  const putBodies: unknown[] = [];
  await installEditorMocks(page, putBodies);
  await page.goto(EDITOR_URL);
  const { row } = await addInputField(page);
  await chooseSelectOption(page, row.getByRole('combobox', { name: 'Érték típusa' }), 'Választólista');
  const optionsField = row.getByRole('textbox', { name: 'Opciók (soronként egy)' });

  // A `fill()` egy lépésben írja az értéket, ezért a köztes alakot (a sor végi
  // Enter-t, a szóközt) nem látja: a leütésenkénti bevitel a valódi gépelés.
  await optionsField.pressSequentially('piros');
  await optionsField.press('Enter');
  await expect(optionsField).toHaveValue('piros\n');
  await optionsField.pressSequentially('sötét kék');
  await expect(optionsField).toHaveValue('piros\nsötét kék');

  await page.getByRole('button', { name: 'Mentés', exact: true }).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();
  expect(putBodies).toHaveLength(1);
  expect(savedInputFields(putBodies[0])).toEqual([
    { name: 'szin', label: 'Szín', valueKind: 'choice', options: ['piros', 'sötét kék'], required: false },
  ]);
});
