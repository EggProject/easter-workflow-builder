// A Hibakezelő csomópont kezelt hibafajtáinak zárt listája (SPEC-004 8.2, O-5,
// user döntés 2026-11-04, "Zárt lista"): a beállítás panelen a motor kezelőig
// eljutó hibafajtái jelölőnégyzetekkel, csoportokban választhatók, szabad
// szöveg mező nincs, és a mentés `PUT` törzse pontosan a választott értékeket
// viszi. Minden REST hívás `page.route()` mockon megy (rest-mock.ts), az SSE
// csatorna egyetlen `stream_ready` kerettel (sse-mock.ts).
import { HandledErrorKindSchema, ReplaceGraphRequestSchema } from '@easter-workflow-builder/protocol';
import type { SettingsRecord, WorkflowDetail, WorkflowGraphDocument } from '@easter-workflow-builder/protocol';
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
      id: 'n-error',
      type: 'error_handler',
      label: 'Hibakezelő',
      positionX: 500,
      positionY: 240,
      config: {
        type: 'error_handler',
        maxAttempts: 3,
        backoffMs: [100, 200],
        handledErrorKinds: ['provider_call_failed'],
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
  builtinSkillsEnabled: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = {
  defaultProviderId: 'minimax',
  persistStreamDeltas: false,
  builtinSkillsEnabled: true,
};

/* eslint-enable unicorn/no-null */

const AGENT_CALL_LABEL = 'Az agent hívás nem indult el, vagy az üzenetfolyam eredmény nélkül megszakadt.';

/**
 * A React Flow saját, dokumentált `data-testid="rf__node-<id>"` fogódzója (a
 * szabálykönyv 11. szekciójának kimondott kivétele).
 */
function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

async function toggle(region: Locator, label: string): Promise<void> {
  await region.getByText(label, { exact: true }).click();
}

test('a kezelt hibafajták zárt listából választhatók, szabad szöveg mező nélkül, és a mentés a választott értékeket küldi', async ({
  page,
}) => {
  const captured: { body: unknown } = { body: undefined };
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('replaceWorkflowGraph', async (route) => {
      captured.body = route.request().postDataJSON();
      const parsed = ReplaceGraphRequestSchema.safeParse(captured.body);
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
  await page.goto('/editor?workflowId=w-alfa');
  await nodeLocator(page, 'n-error').click();
  const kinds = page.getByRole('group', { name: 'Kezelt hibafajták', exact: true });
  await expect(kinds).toBeVisible();

  await expect(kinds.getByRole('textbox')).toHaveCount(0);
  await expect(kinds.getByRole('checkbox')).toHaveCount(HandledErrorKindSchema.options.length);
  for (const groupName of [
    'Agent lépés',
    'Sablon, kifejezés és kimenet',
    'Vezérlő csomópontok',
    'Al-workflow',
    'Szkript',
  ]) {
    await expect(kinds.getByRole('group', { name: groupName, exact: true })).toBeVisible();
  }
  await expect(kinds.getByRole('checkbox', { name: AGENT_CALL_LABEL })).toBeChecked();
  await expect(kinds.getByText('Csak a bejelölt hibafajtákat kezeli, a többit nem.')).toBeVisible();

  // A design system `Checkbox` natív bemenete vizuálisan rejtett, a látható
  // felirat kapja a kattintást (ugyanúgy, mint a `graph-node-mcp-references.spec.ts`
  // `toggle` segédjében).
  await toggle(kinds, AGENT_CALL_LABEL);
  await expect(kinds.getByRole('checkbox', { name: AGENT_CALL_LABEL })).not.toBeChecked();
  await expect(kinds.getByText('Egyik sincs bejelölve, ezért a csomópont minden hibafajtát kezel.')).toBeVisible();
  await toggle(kinds, 'Az Emberi jóváhagyás várakozása döntés nélkül lejárt.');
  await toggle(kinds, 'Egy sablon nem renderelhető.');
  await expect(kinds.getByRole('checkbox', { name: 'Egy sablon nem renderelhető.' })).toBeChecked();

  await page.getByRole('button', { name: /^Mentés/ }).click();
  await expect(page.getByText('Gráf mentve')).toBeVisible();

  const parsedBody = ReplaceGraphRequestSchema.safeParse(captured.body);
  if (!parsedBody.success) {
    throw new Error('a teszt PUT törzse nem felel meg a ReplaceGraphRequestSchema-nak');
  }
  const savedConfig = parsedBody.data.nodes.find((node) => node.id === 'n-error')?.config;
  expect(savedConfig?.type === 'error_handler' ? savedConfig.handledErrorKinds : undefined).toStrictEqual([
    'approval_timed_out',
    'template_render_failed',
  ]);
});
