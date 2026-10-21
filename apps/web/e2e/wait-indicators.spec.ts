// E2E a várakozás jelzéseire (SPEC-008 9. szekció, 35. kritérium, user döntés
// 2026-10-21).
//
// A betöltés alatti állapotot KÉSLELTETETT `page.route()` válasz teszi
// megfigyelhetővé: a kérés kapuja (`Promise.withResolvers`) a teszt kezében
// van, tehát a jelzés állapot alapú várakozással figyelhető meg, időzítő
// nélkül (`skeleton-theme.spec.ts` mintája). A "nincs jelzés" állítások a
// válasz felszabadítása UTÁN futnak, és az ellenpróba a nyitva tartott
// kapu: ha a jelzés kódja kikerülne, a nyitott kapu alatti tesztek buknának.
import {
  encodeStreamFrame,
  type NodeConfig,
  type RunEventRecord,
  type SettingsRecord,
  type StreamFrame,
  type WorkflowDetail,
  type WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { STREAM_ORIGIN } from './api-origin.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute, type MockRoute } from './rest-mock.ts';
import { chooseSelectOption } from './select-field.ts';
import { mockIdleStream } from './sse-mock.ts';
import { makeRunEventRecord } from './transcript-fixture.ts';
import { RUN_SNAPSHOT, runDetailWithStatus, stepRun } from './run-view-stream.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

// A mentés ellenőrzése nem null `onUnhandledError` mezőt kíván (SPEC-008 5.4).
const START_CONFIG: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
  promptTemplate: 'Összegezd a bemenetet.',
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
      label: 'Összegzés',
      positionX: 300,
      positionY: 0,
      config: AGENT_STEP_CONFIG,
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
const RUN_URL = '/run?runId=r-1';

/**
 * A várakozás jelzésének minden alakja a lapon: a design system jelző
 * komponensei (`Skeleton`, `ProgressBar`, a `Button` betöltő állapota) és a
 * szerepük. A "nincs jelzés" állítások ezzel a számlálóval futnak.
 */
const WAIT_INDICATORS = '[aria-busy="true"], .is-loading, .progress-bar, [role="progressbar"], .skel';

/**
 * Egy nyitva tartott kérés kapuja: a `Promise<undefined>` illeszkedik a
 * `route.fulfill` előtti `await` szerződésre (`graph-editor-validation.spec.ts`
 * azonos mintája).
 */
function createGate(): { readonly open: () => void; readonly passed: Promise<undefined> } {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  return {
    open: () => {
      resolve(undefined);
    },
    passed: promise,
  };
}

function nodeLocator(page: Page, nodeId: string): Locator {
  return page.getByTestId(`rf__node-${nodeId}`);
}

async function heightOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  return box === null ? 0 : box.height;
}

async function sizeOf(locator: Locator): Promise<string> {
  const box = await locator.boundingBox();
  return box === null ? 'nincs doboz' : `${String(Math.round(box.width))}x${String(Math.round(box.height))}`;
}

function editorRoutes(overrides: readonly MockRoute[]): readonly MockRoute[] {
  // A `find` az ELSŐ illeszkedő bejegyzést használja, ezért a felülírások
  // állnak elöl.
  return [
    ...overrides,
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(GRAPH))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
  ];
}

test.describe('szerkesztő', () => {
  test.beforeEach(async ({ page }) => {
    await mockIdleStream(page);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('a gráf és a workflow neve a betöltés alatt csontvázat mutat, a betöltés után a rajz és a név áll a helyén', async ({
    page,
  }) => {
    const graphGate = createGate();
    const workflowGate = createGate();
    await installApiMocks(
      page,
      editorRoutes([
        mockRoute('readWorkflowGraph', async (route) => {
          await graphGate.passed;
          await route.fulfill(jsonBody(GRAPH));
        }),
        mockRoute('getWorkflow', async (route) => {
          await workflowGate.passed;
          await route.fulfill(jsonBody(WORKFLOW));
        }),
      ]),
    );
    await page.goto(EDITOR_URL);

    // 1. pont: a rajz helyén teljes területű csontváz áll.
    await expect(page.locator('.graph-editor-screen__loading .skel')).toBeVisible();

    // 2. pont: a morzsasor utolsó eleme a név helyén csontvázat mutat, a
    // képernyőolvasónak pedig az útvonal felirata marad.
    const breadcrumb = page.getByRole('navigation', { name: 'Morzsamenü' });
    const current = breadcrumb.locator('[aria-current="page"]');
    await expect(current.locator('.skel')).toBeVisible();
    await expect(current).toHaveText('Szerkesztő');

    graphGate.open();
    workflowGate.open();
    await expect(nodeLocator(page, 'n-start')).toBeVisible();
    await expect(page.locator('.graph-editor-screen__loading')).toHaveCount(0);
    await expect(current).toHaveText('Alfa workflow');
    await expect(current.locator('.skel')).toHaveCount(0);
  });

  test('a mentés közben a Mentés gomb betöltő állapotú, a válasz után visszaáll', async ({ page }) => {
    const putGate = createGate();
    await installApiMocks(
      page,
      editorRoutes([
        mockRoute('replaceWorkflowGraph', async (route) => {
          await putGate.passed;
          await route.fulfill(jsonBody(GRAPH));
        }),
      ]),
    );
    await page.goto(EDITOR_URL);
    await expect(nodeLocator(page, 'n-start')).toBeVisible();

    const saveButton = page.getByRole('button', { name: /^Mentés/ });
    await expect(saveButton).not.toHaveAttribute('aria-busy', 'true');
    await saveButton.click();
    await expect(saveButton).toHaveAttribute('aria-busy', 'true');
    await expect(saveButton).toHaveClass(/is-loading/);
    await expect(saveButton.locator('.btn__loader')).toBeAttached();

    putGate.open();
    await expect(page.getByText('Gráf mentve')).toBeVisible();
    await expect(saveButton).not.toHaveAttribute('aria-busy', 'true');
    await expect(saveButton).not.toHaveClass(/is-loading/);
  });

  test('a provider lista betöltése alatt a Provider felülírás mező letiltva "Betöltés…" feliratot mutat, utána a szerver listája áll', async ({
    page,
  }) => {
    const providersGate = createGate();
    await installApiMocks(
      page,
      editorRoutes([
        mockRoute('listProviders', async (route) => {
          await providersGate.passed;
          await route.fulfill(jsonBody([{ id: 'minimax', displayName: 'MiniMax', models: [], requiredEnvNames: [] }]));
        }),
      ]),
    );
    await page.goto(EDITOR_URL);
    await nodeLocator(page, 'n-agent').click();

    const combobox = page.getByRole('combobox', { name: 'Provider felülírás' });
    await expect(combobox).toBeDisabled();
    await expect(combobox).toHaveText('Betöltés…');

    providersGate.open();
    await expect(combobox).toBeEnabled();
    await chooseSelectOption(page, combobox, 'minimax');
    await expect(combobox).toHaveText('minimax');
  });

  test('a provider lista hibája után a mező a beépített listával használható marad', async ({ page }) => {
    await installApiMocks(
      page,
      editorRoutes([mockRoute('listProviders', async (route) => route.fulfill(jsonBody({ code: 'x' }, 500)))]),
    );
    await page.goto(EDITOR_URL);
    await nodeLocator(page, 'n-agent').click();

    const combobox = page.getByRole('combobox', { name: 'Provider felülírás' });
    await expect(combobox).toBeEnabled();
    await combobox.click();
    const options = page.getByRole('listbox').getByRole('option');
    await expect(options.filter({ hasText: 'claude-subscription' })).toHaveCount(1);
    await expect(options.filter({ hasText: 'minimax' })).toHaveCount(1);
  });

  test('betöltés után a szerkesztőn nincs várakozás jelzés', async ({ page }) => {
    await installApiMocks(page, editorRoutes([]));
    await page.goto(EDITOR_URL);
    await expect(nodeLocator(page, 'n-start')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Morzsamenü' }).locator('[aria-current="page"]')).toHaveText(
      'Alfa workflow',
    );
    await expect(page.locator(WAIT_INDICATORS)).toHaveCount(0);
  });
});

test.describe('futás nézet', () => {
  interface RunViewGates {
    readonly snapshot?: Promise<undefined>;
    readonly run?: Promise<undefined>;
    readonly steps?: Promise<undefined>;
  }

  async function mockRunViewWithGates(page: Page, gates: RunViewGates): Promise<void> {
    await installApiMocks(page, [
      mockRoute('getRun', async (route) => {
        await gates.run;
        await route.fulfill(jsonBody(runDetailWithStatus('running')));
      }),
      mockRoute('readRunSnapshot', async (route) => {
        await gates.snapshot;
        await route.fulfill(jsonBody(RUN_SNAPSHOT));
      }),
      mockRoute('listStepRuns', async (route) => {
        await gates.steps;
        await route.fulfill(jsonBody([stepRun('running')]));
      }),
      mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
      mockRoute('replaceStreamSubscriptions', async (route) =>
        route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
      ),
    ]);
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('a pillanatkép betöltése alatt a rajz és a fejléc csontvázat mutat, a gráf panel mérete a betöltés után nem ugrik', async ({
    page,
  }) => {
    const snapshotGate = createGate();
    await mockIdleStream(page);
    await mockRunViewWithGates(page, { snapshot: snapshotGate.passed });
    await page.goto(RUN_URL);

    const graphSkeleton = page.locator('.run-view-screen__graph-loading');
    await expect(graphSkeleton.locator('.skel')).toBeVisible();
    await expect(page.locator('header.run-view-screen__header[aria-busy="true"]')).toBeVisible();
    const skeletonSize = await sizeOf(graphSkeleton);

    snapshotGate.open();
    await expect(nodeLocator(page, 'n1')).toBeVisible();
    await expect(graphSkeleton).toHaveCount(0);
    await expect(page.locator('header.run-view-screen__header[aria-busy="true"]')).toHaveCount(0);
    expect(await sizeOf(page.getByTestId('rf__wrapper'))).toBe(skeletonSize);
  });

  test('a futás rekordjának betöltése alatt a fejléc és a transcript csontvázat mutat, a rajz a helyén van', async ({
    page,
  }) => {
    const runGate = createGate();
    await mockIdleStream(page);
    await mockRunViewWithGates(page, { run: runGate.passed });
    await page.goto(RUN_URL);

    await expect(page.locator('header.run-view-screen__header[aria-busy="true"] .skel').first()).toBeVisible();
    await expect(page.locator('.transcript-panel__loading .skel').first()).toBeVisible();
    await expect(nodeLocator(page, 'n1')).toBeVisible();
    await expect(page.locator('.run-view-screen__graph-loading')).toHaveCount(0);

    runGate.open();
    await expect(page.locator('header.run-view-screen__header[aria-busy="true"]')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: /Alfa workflow/ }).or(page.getByText('Alfa workflow')),
    ).toBeVisible();
  });

  test('a lépés futások betöltése alatt a csomópont állapota csontváz, kiolvasható szöveggel, és a kártya magassága nem ugrik', async ({
    page,
  }) => {
    const stepsGate = createGate();
    await mockIdleStream(page);
    await mockRunViewWithGates(page, { steps: stepsGate.passed });
    await page.goto(RUN_URL);

    const card = nodeLocator(page, 'n1');
    await expect(card).toBeVisible();
    await expect(card.locator('.skel')).toBeVisible();
    await expect(card.getByText('állapot betöltése')).toBeAttached();
    const loadingHeight = await heightOf(card);

    stepsGate.open();
    await expect(card.locator('.skel')).toHaveCount(0);
    await expect(card.getByText('állapot betöltése')).toHaveCount(0);
    expect(await heightOf(card)).toBe(loadingHeight);
  });

  /**
   * Egy futás pótlása egyetlen, lezárt SSE válaszban. A `replay_complete`
   * keret nélküli változat a "pótlás folyamatban" állapot: a sorok már
   * megvannak, de a szerver még nem jelezte a pótlás végét.
   */
  async function mockReplay(page: Page, records: readonly RunEventRecord[], isComplete: boolean): Promise<void> {
    const lastEventId = records.at(-1)?.id;
    // eslint-disable-next-line unicorn/no-null -- a `replay_complete` keret `throughEventId` mezője a dróton `null`, ha a futásnak nincs eseménye
    const replayComplete: StreamFrame = { event: 'replay_complete', runId: 'r-1', throughEventId: lastEventId ?? null };
    const frames: readonly StreamFrame[] = [
      { event: 'stream_ready', streamId: 'e2e-stream', serverInstanceId: 'e2e-server', subscriptions: [] },
      ...records.map((runEvent): StreamFrame => ({ event: 'run_event', delivery: 'replayed', runEvent })),
      ...(isComplete ? [replayComplete] : []),
    ];
    let isServed = false;
    await page.route(`${STREAM_ORIGIN}/events**`, async (route) => {
      // Csak az első kapcsolat kap választ: az újracsatlakozás ugyanazt a
      // pótlást adná, a `replay_complete` kerete pedig újratöltést váltana
      // (`sse-mock.ts`, `mockSseFramesWithoutReconnect`).
      if (isServed) {
        return;
      }
      isServed = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: frames.map((frame) => encodeStreamFrame(frame)).join(''),
      });
    });
  }

  const RECORDS: readonly RunEventRecord[] = [1, 2, 3].map((id) =>
    makeRunEventRecord(id, 'r-1', { stepRunId: 's-1', kind: 'step_started' }),
  );

  test('a pótlás alatt (sorok vannak, a pótlás vége még nem jött) a transcript tetején folyamatjelző áll, a sorok megmaradnak', async ({
    page,
  }) => {
    await mockReplay(page, RECORDS, false);
    await mockRunViewWithGates(page, {});
    await page.goto(RUN_URL);

    const list = page.getByRole('list', { name: 'Futás eseményei' });
    await expect(list).toBeVisible();
    await expect(page.getByRole('progressbar', { name: 'az előzmények betöltése folyamatban' })).toBeVisible();
    await expect(list.getByRole('listitem').first()).toBeVisible();
  });

  test('a pótlás végét jelző keret után a folyamatjelző eltűnik, és a külső elválasztó húzása nem hoz létre várakozás jelzést', async ({
    page,
  }) => {
    await mockReplay(page, RECORDS, true);
    await mockRunViewWithGates(page, {});
    await page.goto(RUN_URL);

    const list = page.getByRole('list', { name: 'Futás eseményei' });
    await expect(list).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
    await expect(page.locator(WAIT_INDICATORS)).toHaveCount(0);

    // Az elválasztó húzása nem kérés: nem szabad várakozás jelzést mutatnia.
    const separator = page.getByRole('separator', { name: 'A Gráf és a Transcript aránya' });
    const box = await separator.boundingBox();
    expect(box).not.toBeNull();
    if (box === null) {
      return;
    }
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX - 100, centerY, { steps: 5 });
    await expect(page.locator(WAIT_INDICATORS)).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator(WAIT_INDICATORS)).toHaveCount(0);
  });
});
