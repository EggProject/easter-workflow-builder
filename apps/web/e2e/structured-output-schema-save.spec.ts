// E2E a strukturált kimenet sémájának mentéskori, szerver oldali
// elutasítására (SPEC-015 5.7, AC3, O-2 user döntés: "Mentéskor és
// indításkor"). A szerver a sémát az agent csomag fordítójával ellenőrzi, és
// `invalid_request` hibát ad a mező útvonalával; a kliens a mezőutat a séma
// mező alatti hibára képezi le, az `agent_step` és a `join` `ai_synthesis`
// alobjektumán is. Minden REST hívás `page.route()` mockon megy
// (`.claude/CLAUDE.md` 11. szekció); a mock törzs `satisfies ProtocolErrorBody`
// kötéssel a protokoll sémájához igazodik.
import type {
  AgentStepConfig,
  ProtocolErrorBody,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

function agentSettings(schema: unknown): AgentStepConfig {
  return {
    promptTemplate: 'Foglald össze.',
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
    structuredOutput: { strategy: 'sdk_output_format', schema },
  };
}

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
      id: 'n-agent',
      type: 'agent_step',
      label: 'Lépés',
      positionX: 260,
      positionY: 0,
      config: { type: 'agent_step', onUnhandledError: 'fail_run', ...agentSettings({ type: 'strin' }) },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
    {
      id: 'n-join',
      type: 'join',
      label: 'Összefésülés',
      positionX: 520,
      positionY: 0,
      config: {
        type: 'join',
        mode: 'ai_synthesis',
        onUnhandledError: 'fail_run',
        settings: agentSettings({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object' }),
      },
      createdAtMs: 1,
      updatedAtMs: 1,
    },
  ],
  edges: [],
};

const WORKFLOW: WorkflowDetail = {
  id: 'w-sema',
  name: 'Séma workflow',
  description: null,
  providerId: null,
  builtinSkillsEnabled: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false, builtinSkillsEnabled: true };

/* eslint-enable unicorn/no-null */

const REJECTED_BODY = {
  code: 'invalid_request',
  message:
    'A kérés törzse érvénytelen, hibás mező(k): nodes.1.config.structuredOutput.schema, nodes.2.config.settings.structuredOutput.schema (invalid_request).',
} satisfies ProtocolErrorBody;

const SCHEMA_ERROR =
  'A séma érvénytelen: nem draft-07 szerinti JSON Schema, ismeretlen kulcsszót vagy formátumot tartalmaz, vagy draft-07-nél újabb $schema értéket deklarál.';

async function mockEditor(page: Page): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => route.fulfill(jsonBody(REJECTED_BODY, 400))),
  ]);
}

/**
 * A React Flow saját `data-testid="rf__node-<id>"` fogódzója: a csomópont
 * `role="group"` szerepe azonos és név nélküli (`.claude/CLAUDE.md` 11.
 * szekció, a locator sorrend kivétele).
 */
async function openSchemaField(page: Page, nodeId: string): Promise<Locator> {
  await page.getByTestId(`rf__node-${nodeId}`).click();
  const panel = page.locator('.node-inspector');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Eszközök és környezet', exact: true }).click();
  const region = panel.getByRole('region', { name: 'Eszközök és környezet', exact: true });
  await expect(region).toBeVisible();
  return region.getByLabel('Kimenet séma (nyers JSON)');
}

test('a szerver által elutasított séma a Lépés és az Összefésülés séma mezője alatt jelez, a szerver mezőútja nélkül', async ({
  page,
}) => {
  await mockEditor(page);
  await page.goto('/editor?workflowId=w-sema');

  const putRequest = page.waitForRequest((request) => request.method() === 'PUT');
  await page.getByRole('button', { name: /^Mentés/ }).click();
  await putRequest;
  await expect(page.getByText('A mentés sikertelen')).toBeVisible();

  const agentSchema = await openSchemaField(page, 'n-agent');
  await expect(agentSchema).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.node-inspector').getByRole('alert')).toHaveText(SCHEMA_ERROR);

  const joinSchema = await openSchemaField(page, 'n-join');
  await expect(joinSchema).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.node-inspector').getByRole('alert')).toHaveText(SCHEMA_ERROR);

  await expect(page.locator('body')).not.toContainText('nodes.1.config');
  await expect(page.locator('body')).not.toContainText('(invalid_request)');
});

test('a séma szerkesztése után a szerver elutasítása a mező alatt már nem áll', async ({ page }) => {
  await mockEditor(page);
  await page.goto('/editor?workflowId=w-sema');

  await page.getByRole('button', { name: /^Mentés/ }).click();
  await expect(page.getByText('A mentés sikertelen')).toBeVisible();

  const agentSchema = await openSchemaField(page, 'n-agent');
  await expect(agentSchema).toHaveAttribute('aria-invalid', 'true');

  await agentSchema.fill('{"type": "object"}');

  await expect(agentSchema).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('.node-inspector').getByText(SCHEMA_ERROR)).toBeAttached({ attached: false });
});

test('a strukturált kimenet kikapcsolása után az elutasítás a Lépés és az Összefésülés mezőjén sem áll', async ({
  page,
}) => {
  await mockEditor(page);
  await page.goto('/editor?workflowId=w-sema');

  await page.getByRole('button', { name: /^Mentés/ }).click();
  await expect(page.getByText('A mentés sikertelen')).toBeVisible();

  for (const nodeId of ['n-agent', 'n-join']) {
    const schemaField = await openSchemaField(page, nodeId);
    await expect(schemaField).toHaveAttribute('aria-invalid', 'true');
    await page.locator('.node-inspector').getByText('Strukturált kimenet felülírás megadva').click();
    await expect(schemaField).toBeAttached({ attached: false });
    await expect(page.locator('.node-inspector').getByText(SCHEMA_ERROR)).toBeAttached({ attached: false });
  }
});

test('a séma mezőre nem illeszkedő csomópontra mutató szerver mezőút egyik panelen sem ad séma hibát', async ({
  page,
}) => {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) =>
      route.fulfill(
        jsonBody(
          {
            code: 'invalid_request',
            message:
              'A kérés törzse érvénytelen, hibás mező(k): nodes.0.config.structuredOutput.schema, nodes.0.config.settings.structuredOutput.schema, nodes.1.config.settings.structuredOutput.schema, nodes.2.config.structuredOutput.schema (invalid_request).',
          } satisfies ProtocolErrorBody,
          400,
        ),
      ),
    ),
  ]);
  await page.goto('/editor?workflowId=w-sema');

  await page.getByRole('button', { name: /^Mentés/ }).click();
  await expect(page.getByText('A mentés sikertelen')).toBeVisible();

  const agentSchema = await openSchemaField(page, 'n-agent');
  await expect(agentSchema).not.toHaveAttribute('aria-invalid', 'true');
  const joinSchema = await openSchemaField(page, 'n-join');
  await expect(joinSchema).not.toHaveAttribute('aria-invalid', 'true');
});
