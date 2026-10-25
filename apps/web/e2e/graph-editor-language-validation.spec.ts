// E2E a mentés előtti fordítási ellenőrzésre valós Chromiumban (PLAN-010
// T-010-19, SPEC-010 10., AC45): egy hibás CEL kifejezés és egy hibás
// Mustache sablon a beállítás panelen a mező elhagyása után a mező alatt jelez
// (a `workflow-language` csomag mondata a szerkesztő írásmódjában, nagy
// kezdőbetűvel és ponttal zárva, `aria-invalid`), a mentés gomb `PUT` kérés
// nélkül áll meg, és a javítás után a mentés lefut. A `PUT` számlálója a
// `page.route()` kezelőben gyűlik; a mentés előtti ellenőrzés szinkron, tehát
// a lábléc üzenetének megjelenése után a számláló végleges, kézi várakozás
// nélkül.
import {
  ReplaceGraphRequestSchema,
  type ReplaceGraphRequest,
  type SettingsRecord,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const GRAPH: WorkflowGraphDocument = {
  nodes: [
    {
      id: 'n-start',
      type: 'start',
      label: 'Indítás',
      positionX: 0,
      positionY: 0,
      config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-branch',
      type: 'branch',
      label: 'Döntés',
      positionX: 500,
      positionY: 240,
      config: {
        type: 'branch',
        expression: 'input.x > 0',
        branches: [],
        defaultBranchKey: null,
        onUnhandledError: 'fail_run',
      },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-approval',
      type: 'human_approval',
      label: 'Jóváhagyás',
      positionX: 1000,
      positionY: 480,
      config: {
        type: 'human_approval',
        title: 'Rendben?',
        bodyTemplate: 'Kérlek erősítsd meg.',
        timeoutMs: null,
        onUnhandledError: 'fail_run',
      },
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

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

/**
 * A két nyelv egy-egy mezője: a `branch` feltétele (CEL, `cel-expression`) és
 * a `human_approval` törzs sablonja (Mustache, `mustache-template`). A mondat a
 * csomag saját leírása a szerkesztő írásmódjában (SPEC-010 10., O-19).
 */
const LANGUAGE_CASES = [
  {
    language: 'CEL kifejezés',
    nodeId: 'n-branch',
    nodeIndex: 1,
    panelName: 'Elágazás beállításai',
    fieldName: 'Feltétel kifejezés',
    configKey: 'expression',
    invalid: 'titokNeve > 1',
    message: 'Nem deklarált változó a kifejezésben (pozíció: 0).',
    valid: 'input.x > 1',
  },
  {
    language: 'Mustache sablon',
    nodeId: 'n-approval',
    nodeIndex: 2,
    panelName: 'Emberi jóváhagyás beállításai',
    fieldName: 'Törzs sablon (bodyTemplate)',
    configKey: 'bodyTemplate',
    invalid: '{{#titok}}',
    message: 'Le nem zárt szakasz a sablonban (pozíció: 10).',
    valid: '{{#input}}Rendben{{/input}}',
  },
] as const;

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

function saveButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Mentés', exact: true });
}

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

function parseSavedGraph(body: unknown): ReplaceGraphRequest {
  const parsed = ReplaceGraphRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('a mentés kérés törzse nem érvényes ReplaceGraphRequest');
  }
  return parsed.data;
}

async function installEditorMocks(page: Page, putBodies: unknown[]): Promise<void> {
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      const body: unknown = route.request().postDataJSON();
      putBodies.push(body);
      const saved = parseSavedGraph(body);
      await route.fulfill(
        jsonBody({
          nodes: saved.nodes.map((node) => ({ ...node, createdAtMs: 1, updatedAtMs: 1 })),
          edges: [],
        }),
      );
    }),
  ]);
}

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

for (const testCase of LANGUAGE_CASES) {
  test(`hibás ${testCase.language}: a mező elhagyása után a hiba a mező alatt áll, a mentés PUT nélkül marad, javítás után a mentés lefut (SPEC-010 10., AC45)`, async ({
    page,
  }) => {
    const putBodies: unknown[] = [];
    await installEditorMocks(page, putBodies);
    await page.goto(EDITOR_URL);

    await nodeLocator(page, testCase.nodeId).click();
    const panel = page.getByRole('complementary', { name: testCase.panelName });
    const field = panel.getByRole('textbox', { name: testCase.fieldName });
    await expectNoFieldError(field);

    // A beírás közben a mező még nem érintett, tehát nem jelez (SPEC-008 5.4,
    // `.claude/CLAUDE.md` 11. "Az űrlap hibaüzenete").
    await field.fill(testCase.invalid);
    await expectNoFieldError(field);
    await field.press('Tab');
    await expectFieldError(field, testCase.message);

    await saveButton(page).click();
    await expect(
      page.getByText(
        `A kérés törzse érvénytelen, hibás mező(k): nodes.${String(testCase.nodeIndex)}.config.${testCase.configKey} (invalid_request).`,
        { exact: true },
      ),
    ).toBeVisible();
    await expectFieldError(field, testCase.message);
    expect(putBodies).toHaveLength(0);

    await field.fill(testCase.valid);
    await expectNoFieldError(field);
    await saveButton(page).click();
    await expect(page.getByText('Gráf mentve')).toBeVisible();
    expect(putBodies).toHaveLength(1);
    expect(parseSavedGraph(putBodies[0]).nodes[testCase.nodeIndex]?.config).toMatchObject({
      [testCase.configKey]: testCase.valid,
    });
  });
}
