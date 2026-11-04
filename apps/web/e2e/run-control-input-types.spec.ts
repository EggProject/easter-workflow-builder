// E2E a futás indító ablak típus szerinti mezőire (PLAN-017 T-017-8, SPEC-016
// 5.1, 5.4, 5.6, AC4): mind a hat `valueKind` saját beviteli elemet kap, a
// `POST /api/workflows/{id}/runs` törzse pontosan az 5.1 táblázat JSON alakja
// (szám szám, logikai logikai, lista tömb, JSON adat objektum), az üresen
// hagyott nem kötelező mező kulcsa hiányzik, az értelmezhetetlen JSON a mező
// alatt jelez, és kérés nem indul. Minden REST hívás `page.route()` mockon
// megy (`.claude/CLAUDE.md` 11. szekció).
import type {
  NodeConfig,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const START_CONFIG: NodeConfig = {
  type: 'start',
  inputFields: [
    { name: 'topic', label: 'Téma', valueKind: 'text', required: true },
    { name: 'count', label: 'Darab', valueKind: 'number', required: false },
    { name: 'urgent', label: 'Sürgős', valueKind: 'boolean', required: false },
    { name: 'color', label: 'Szín', valueKind: 'choice', options: ['piros', 'zöld'], required: false },
    { name: 'tags', label: 'Címkék', valueKind: 'list', required: false },
    { name: 'payload', label: 'Adat', valueKind: 'json', required: false },
  ],
  onUnhandledError: null,
};

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Kérés fogadása',
      positionX: 0,
      positionY: 0,
      config: START_CONFIG,
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
 * A `POST /api/workflows/{id}/runs` törzsei, kérésenként a nyers szöveg.
 */
async function mockEditor(page: Page, bodies: string[]): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('startRun', async (route) => {
      bodies.push(route.request().postData() ?? '');
      await route.fulfill(jsonBody({ runId: 'run-1', status: 'pending' }));
    }),
  ]);
}

async function openStartModal(page: Page): Promise<Locator> {
  await page.goto(EDITOR_URL);
  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

test('mind a hat típus saját beviteli elemet kap, a küldött törzs pontosan az 5.1 JSON alak', async ({ page }) => {
  const bodies: string[] = [];
  await mockEditor(page, bodies);
  const dialog = await openStartModal(page);

  await expect(dialog.getByRole('textbox', { name: 'Téma' })).toBeVisible();
  await expect(dialog.getByRole('spinbutton', { name: 'Darab' })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Sürgős' })).toBeAttached();
  await expect(dialog.getByRole('combobox', { name: 'Szín' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Címkék (soronként egy)' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Adat', exact: true })).toBeVisible();

  await dialog.getByRole('textbox', { name: 'Téma' }).fill('AI hírek');
  await dialog.getByRole('spinbutton', { name: 'Darab' }).fill('3.5');
  // A jelölőnégyzet saját `.ctrl__box` rétege fedi az inputot, ezért a hozzá
  // tartozó szövegre kattintunk (`graph-editor` e2e azonos indoklása).
  await dialog.getByText('Sürgős', { exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Sürgős' })).toBeChecked();
  await chooseSelectOption(page, dialog.getByRole('combobox', { name: 'Szín' }), 'zöld');
  await dialog.getByRole('textbox', { name: 'Címkék (soronként egy)' }).fill('egy\n\n kettő \n');
  await dialog.getByRole('textbox', { name: 'Adat', exact: true }).fill('{"k": [1, 2], "ok": true}');
  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  await expect(page).toHaveURL(/\/run\?runId=run-1$/);
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0] ?? '')).toEqual({
    input: {
      topic: 'AI hírek',
      count: 3.5,
      urgent: true,
      color: 'zöld',
      tags: ['egy', 'kettő'],
      payload: { k: [1, 2], ok: true },
    },
  });
});

test('az üresen hagyott nem kötelező mezők kulcsa hiányzik, a logikai mező hamis értékkel megy', async ({ page }) => {
  const bodies: string[] = [];
  await mockEditor(page, bodies);
  const dialog = await openStartModal(page);

  await dialog.getByRole('textbox', { name: 'Téma' }).fill('AI');
  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  await expect(page).toHaveURL(/\/run\?runId=run-1$/);
  expect(bodies).toEqual([JSON.stringify({ input: { topic: 'AI', urgent: false } })]);
});

test('az értelmezhetetlen JSON a mező alatt jelez, kérés nem indul, a javítás után a beküldés átmegy', async ({
  page,
}) => {
  const bodies: string[] = [];
  await mockEditor(page, bodies);
  const dialog = await openStartModal(page);
  // A hibaüzenet a mező `<label>` burkolóján belül áll, tehát a hozzáférhető
  // név a hiba megjelenése után bővül: a név előtagra illeszkedik.
  const payload = dialog.getByRole('textbox', { name: /^Adat/ });

  await dialog.getByRole('textbox', { name: 'Téma' }).fill('AI');
  await payload.fill('{"k": ');
  // Beküldési kísérlet előtt, érintetlen mezőn nincs hibaüzenet.
  await expect(payload).not.toHaveAttribute('aria-invalid', 'true');

  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  await expect(payload).toHaveAttribute('aria-invalid', 'true');
  await expect(payload).toHaveAccessibleDescription('Érvénytelen JSON adat.');
  await expect(dialog.locator('.field__error')).toHaveCount(1);
  await expect(dialog).toBeVisible();
  expect(bodies).toEqual([]);

  await payload.fill('[1, 2]');
  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();
  await expect(page).toHaveURL(/\/run\?runId=run-1$/);
  expect(bodies).toEqual([JSON.stringify({ input: { topic: 'AI', urgent: false, payload: [1, 2] } })]);
});
