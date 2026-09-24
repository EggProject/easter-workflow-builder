// E2E a futás vezérlésére (`run-control` téma, T-009-23, SPEC-008 6.4, 6.5).
//
// MIÉRT KELL E2E A HAPPY-DOM UNIT TESZTEK MELLETT. A modális megnyitása és a
// vezérlő gombok tiltása a VALÓS böngésző DOM-ján figyelhető meg úgy, ahogy a
// felhasználó találkozik vele (a natív űrlap ellenőrzés kikapcsolása, a
// `disabled` attribútum kihatása a kattintásra, és a navigáció tényleges URL
// változása); ezen felül a SPEC-008 12.5 ratchet szabálya szerint egy új
// képernyő-részlet nem hagyhat hátra fedetlen sort. Minden REST hívás
// `page.route()` mockon megy, valós backend szervert egyetlen teszt sem
// szólít meg (`.claude/CLAUDE.md` 11. szekció).
//
// AMI NEM IDE TARTOZIK: az az állítás, hogy a "megszakítás folyamatban"
// állapotot a MENET KÖZBEN érkező `run_finished` keret zárja le. Egy már
// megnyitott, mockolt kapcsolatba a `route.fulfill()` nem tud új keretet
// beszúrni (`docs/research/2026-08-30-sse-mockolas-meres.md` 3. szekció 2.
// pontja), ezért az a mérés a `sse-real-server.spec.ts` fájlban, a dokumentált
// `node:http` teszt szerveren áll. Itt az igazolható rész áll: a keret
// MEGÉRKEZÉSÉIG az állapot fennmarad, és a gomb letiltva marad.
import type {
  NodeConfig,
  RunDetail,
  RunSnapshotResponse,
  SettingsRecord,
  StepRunRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const START_WITHOUT_FIELDS: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

const START_WITH_FIELDS: NodeConfig = {
  type: 'start',
  inputFields: [
    { name: 'topic', label: 'Téma', valueKind: 'string', required: true },
    { name: 'note', label: 'Megjegyzés', valueKind: 'string', required: false },
  ],
  onUnhandledError: null,
};

function graphWithStartConfig(startConfig: NodeConfig): WorkflowGraphDocument {
  return {
    nodes: [
      {
        id: 'n1',
        type: 'start',
        label: 'Kérés fogadása',
        positionX: 0,
        positionY: 0,
        config: startConfig,
        createdAtMs: 1,
        updatedAtMs: 1,
      },
    ],
    edges: [],
  };
}

const WORKFLOW: WorkflowDetail = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

const SNAPSHOT: RunSnapshotResponse = {
  version: 1,
  sdkVersionPin: '0.1.13',
  workflow: { id: 'w-alfa', name: 'Alfa workflow', description: null },
  nodes: [
    {
      id: 'n1',
      type: 'start',
      label: 'Kérés fogadása',
      position: { x: 0, y: 0 },
      config: START_WITHOUT_FIELDS,
      effectiveProviderId: 'claude-subscription',
    },
  ],
  edges: [],
};

const STEP_RUNS: readonly StepRunRecord[] = [];

function runDetail(overrides: Partial<RunDetail>): RunDetail {
  return {
    id: 'run-1',
    workflowId: 'w-alfa',
    status: 'running',
    input: null,
    providerId: 'claude-subscription',
    rootRunId: 'run-1',
    depth: 0,
    workflowAncestry: ['w-alfa'],
    graphSnapshotHash: 'c'.repeat(64),
    persistedStreamDeltas: false,
    restartedFromRunId: null,
    createdAtMs: 1,
    startedAtMs: 2,
    finishedAtMs: null,
    errorKind: null,
    errorMessage: null,
    ...overrides,
  };
}

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';
const RUN_URL = '/run?runId=run-1';

interface StartRunRecording {
  readonly bodies: string[];
}

/**
 * A szerkesztő mockjai, a megadott `start` node config-gal. A
 * `POST /api/workflows/{id}/runs` törzse naplózva, hogy a teszt a
 * `StartRunRequest.input` alakját is mérhesse.
 */
async function mockEditor(page: Page, startConfig: NodeConfig, recording: StartRunRecording): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graphWithStartConfig(startConfig)))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('startRun', async (route) => {
      recording.bodies.push(route.request().postData() ?? '');
      await route.fulfill(jsonBody({ runId: 'run-1', status: 'pending' }));
    }),
  ]);
}

interface RunViewMockOptions {
  readonly detail: RunDetail;
  readonly cancelledRunIds?: readonly string[];
  readonly restartedRunId?: string;
  /**
   * Hibás választ adjon-e a megszakítás, illetve az újraindítás végpont: a
   * hibaágak felületi jelzése enélkül fedetlen maradna.
   */
  readonly failingAction?: 'interrupt' | 'restart';
}

const CONFLICT_ERROR_BODY = { code: 'conflict', message: 'A futás állapota közben megváltozott.' };

async function mockRunView(page: Page, options: RunViewMockOptions): Promise<void> {
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('getRun', async (route) => route.fulfill(jsonBody(options.detail))),
    mockRoute('readRunSnapshot', async (route) => route.fulfill(jsonBody(SNAPSHOT))),
    mockRoute('listStepRuns', async (route) => route.fulfill(jsonBody(STEP_RUNS))),
    mockRoute('listPendingApprovals', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('interruptRun', async (route) =>
      options.failingAction === 'interrupt'
        ? route.fulfill(jsonBody(CONFLICT_ERROR_BODY, 409))
        : route.fulfill(
            jsonBody({ rootRunId: options.detail.id, cancelledRunIds: options.cancelledRunIds ?? ['run-1'] }),
          ),
    ),
    mockRoute('restartRun', async (route) =>
      options.failingAction === 'restart'
        ? route.fulfill(jsonBody(CONFLICT_ERROR_BODY, 409))
        : route.fulfill(jsonBody({ runId: options.restartedRunId ?? 'run-2', status: 'pending' })),
    ),
  ]);
}

// ============================================================
// AZ INDÍTÁS A SZERKESZTŐBŐL (AC28).
// ============================================================

test('üres inputFields lista esetén a modális nem nyílik meg, a futás közvetlenül indul', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockEditor(page, START_WITHOUT_FIELDS, recording);
  await page.goto(EDITOR_URL);

  const startButton = page.getByRole('button', { name: 'Futás indítása', exact: true });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  // A navigáció a futás nézetre a siker egyetlen, kívülről megfigyelhető
  // bizonyítéka; a modális pedig egyetlen pillanatra sem jelent meg.
  await expect(page).toHaveURL(/\/run\?runId=run-1$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(recording.bodies).toEqual([JSON.stringify({ input: {} })]);
});

test('nem üres inputFields lista esetén a modális nyílik meg, és a mezők a lista alapján épülnek', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockEditor(page, START_WITH_FIELDS, recording);
  await page.goto(EDITOR_URL);

  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Téma' })).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Megjegyzés' })).toBeVisible();
  expect(recording.bodies).toEqual([]);
});

test('a kötelező mező hibája KIZÁRÓLAG a mező alatt jelenik meg, összesítő nélkül', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockEditor(page, START_WITH_FIELDS, recording);
  await page.goto(EDITOR_URL);
  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const topicField = dialog.getByRole('textbox', { name: 'Téma' });
  // Beküldési kísérlet ELŐTT, érintetlen mezőn nincs hibaüzenet és nincs
  // `aria-invalid` (W3C WAI ARIA21: az attribútum nem kerülhet ki az
  // ellenőrzés előtt).
  await expect(dialog.locator('.field__error')).toHaveCount(0);
  await expect(topicField).not.toHaveAttribute('aria-invalid', 'true');

  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  // A hiba a MEZŐ ALATT áll, a mezőhöz `aria-describedby`-val kötve, és
  // `role="alert"` szerepben; a modális törzsében NINCS másik hibaüzenet,
  // tehát összesítő sem.
  await expect(topicField).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await topicField.getAttribute('aria-describedby');
  expect(describedBy).not.toBeNull();
  const errorMessage = dialog.locator(`#${String(describedBy)}`);
  await expect(errorMessage).toBeVisible();
  await expect(errorMessage).toHaveAttribute('role', 'alert');
  await expect(dialog.locator('.field__error')).toHaveCount(1);
  // A mező alatt: az üzenet teteje a mező alja alatt van.
  const fieldBox = await topicField.boundingBox();
  const errorBox = await errorMessage.boundingBox();
  if (fieldBox === null || errorBox === null) {
    throw new Error('hiányzó befoglaló doboz a mezőn vagy a hibaüzeneten');
  }
  expect(errorBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
  // És NEM indult kérés.
  expect(recording.bodies).toEqual([]);
});

test('a modálison kitöltött értékek a StartRunRequest input mezőjébe kerülnek', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockEditor(page, START_WITH_FIELDS, recording);
  await page.goto(EDITOR_URL);
  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Téma' }).fill('AI hírek');
  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  await expect(page).toHaveURL(/\/run\?runId=run-1$/);
  // Az üresen hagyott, nem kötelező mező KIMARAD a törzsből.
  expect(recording.bodies).toEqual([JSON.stringify({ input: { topic: 'AI hírek' } })]);
});

// ============================================================
// A MEGSZAKÍTÁS ÉS AZ ÚJRAINDÍTÁS A FUTÁS NÉZETBEN (AC25, AC26, AC27).
// ============================================================

test('a megszakítás után "megszakítás folyamatban" áll, és a gomb letiltva marad', async ({ page }) => {
  await mockRunView(page, { detail: runDetail({ status: 'running' }) });
  await page.goto(RUN_URL);

  const interruptButton = page.getByRole('button', { name: 'Megszakítás' });
  await expect(interruptButton).toBeEnabled();
  await interruptButton.click();

  // A `run_finished` keret SOSEM érkezik meg (üresen álló stream), tehát az
  // állapot fennmarad: pontosan ez a mérés tárgya.
  await expect(page.getByText('Megszakítás folyamatban')).toBeVisible();
  await expect(interruptButton).toBeDisabled();
  await expect(interruptButton).toHaveAttribute('aria-busy', 'true');
  // A futás állapota a szerver szerint még nem terminális, tehát az
  // újraindítás gombja nem jelenik meg.
  await expect(page.getByRole('button', { name: 'Újraindítás' })).toHaveCount(0);
});

test('a cancelledRunIds lista megjelenik, ha nem csak a gyökér futás szerepel benne', async ({ page }) => {
  await mockRunView(page, {
    detail: runDetail({ status: 'running' }),
    cancelledRunIds: ['run-1', 'run-7', 'run-8'],
  });
  await page.goto(RUN_URL);

  await page.getByRole('button', { name: 'Megszakítás' }).click();

  const section = page.getByRole('region', { name: 'Megszakított al-workflow futások' });
  await expect(section.getByRole('listitem')).toHaveCount(2);
  await expect(section.getByText('run-7')).toBeVisible();
  await expect(section.getByText('run-8')).toBeVisible();
});

test('csak a gyökér futást tartalmazó cancelledRunIds listát nem írja ki', async ({ page }) => {
  await mockRunView(page, { detail: runDetail({ status: 'running' }), cancelledRunIds: ['run-1'] });
  await page.goto(RUN_URL);

  await page.getByRole('button', { name: 'Megszakítás' }).click();
  await expect(page.getByText('Megszakítás folyamatban')).toBeVisible();

  await expect(page.getByRole('region', { name: 'Megszakított al-workflow futások' })).toHaveCount(0);
});

test('az interrupted állapot a cancelled állapottól ELTÉRŐ szóval jelenik meg', async ({ page }) => {
  await mockRunView(page, { detail: runDetail({ status: 'cancelled', finishedAtMs: 9 }) });
  await page.goto(RUN_URL);
  const cancelledBadge = page.locator('.run-control .badge');
  await expect(cancelledBadge).toHaveText('megszakítva');

  await mockRunView(page, { detail: runDetail({ status: 'interrupted', finishedAtMs: 9 }) });
  await page.goto(RUN_URL);
  await expect(page.locator('.run-control .badge')).toHaveText('félbeszakítva');
});

test('terminális futáson az újraindítás gomb áll, és az ÚJ futás nézetére navigál', async ({ page }) => {
  await mockRunView(page, {
    detail: runDetail({ status: 'failed', finishedAtMs: 9, errorKind: 'agent_step_failed', errorMessage: 'elbukott' }),
    restartedRunId: 'run-42',
  });
  await page.goto(RUN_URL);

  // A futás hibája a fejléc alatt látszik (SPEC-008 6.4).
  await expect(page.getByText('agent_step_failed')).toBeVisible();
  await expect(page.getByText('elbukott')).toBeVisible();

  await page.getByRole('button', { name: 'Újraindítás' }).click();

  await expect(page).toHaveURL(/\/run\?runId=run-42$/);
});

test('a megszakítás hibáját riasztásként írja ki, és a gomb újra használható', async ({ page }) => {
  await mockRunView(page, { detail: runDetail({ status: 'running' }), failingAction: 'interrupt' });
  await page.goto(RUN_URL);

  const interruptButton = page.getByRole('button', { name: 'Megszakítás' });
  await interruptButton.click();

  await expect(page.getByRole('alert')).toContainText('megváltozott');
  await expect(interruptButton).toBeEnabled();
  await expect(page.getByText('Megszakítás folyamatban')).toHaveCount(0);
});

test('az újraindítás hibáját riasztásként írja ki, navigáció nélkül', async ({ page }) => {
  await mockRunView(page, { detail: runDetail({ status: 'succeeded', finishedAtMs: 9 }), failingAction: 'restart' });
  await page.goto(RUN_URL);

  await page.getByRole('button', { name: 'Újraindítás' }).click();

  await expect(page.getByRole('alert')).toContainText('megváltozott');
  await expect(page).toHaveURL(/\/run\?runId=run-1$/);
});

test('a modális indítás hibáját az űrlapban írja ki, a modális nyitva marad', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graphWithStartConfig(START_WITH_FIELDS)))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('startRun', async (route) => {
      recording.bodies.push(route.request().postData() ?? '');
      await route.fulfill(jsonBody(CONFLICT_ERROR_BODY, 409));
    }),
  ]);
  await page.goto(EDITOR_URL);
  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Téma' }).fill('AI hírek');
  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  await expect(dialog.getByRole('alert')).toContainText('megváltozott');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(String.raw`/editor\?workflowId=w-alfa$`));
  expect(recording.bodies).toHaveLength(1);
});

test('modális nélküli indítás hibáját a lábléc státusza írja ki', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockIdleStream(page);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) =>
      route.fulfill(jsonBody(graphWithStartConfig(START_WITHOUT_FIELDS))),
    ),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('startRun', async (route) => {
      recording.bodies.push(route.request().postData() ?? '');
      await route.fulfill(jsonBody(CONFLICT_ERROR_BODY, 409));
    }),
  ]);
  await page.goto(EDITOR_URL);

  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  // Modális nincs, tehát az üzenetnek a láblécben kell megjelennie, különben a
  // felhasználó néma hibát látna.
  await expect(page.locator('.page-footer').getByRole('alert')).toContainText('megváltozott');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(String.raw`/editor\?workflowId=w-alfa$`));
});

test('a modális Mégse gombja bezárja a modálist, indítás nélkül', async ({ page }) => {
  const recording: StartRunRecording = { bodies: [] };
  await mockEditor(page, START_WITH_FIELDS, recording);
  await page.goto(EDITOR_URL);
  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Mégse' }).click();

  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(recording.bodies).toEqual([]);
});
