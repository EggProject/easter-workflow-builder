// E2E a REST hibák hibaosztály szerinti saját mondatára (user döntés
// 2026-09-26, "Ismert okokra saját mondat", SPEC-007 8.4, SPEC-005 8.5).
//
// A szerver a zárt szótárú hibaosztályt a törzs `errorClass` mezőjében adja;
// a felület ebből választ mondatot, a `message` szövegét nem elemzi és nem
// mutatja. Minden REST hívás `page.route()` mockon megy (`.claude/CLAUDE.md`
// 11. szekció). A mock törzsek `satisfies ProtocolErrorBody` kötéssel a
// protokoll sémájához igazodnak, tehát a teszt a valódi szerződést mockolja.
import type {
  NodeConfig,
  ProtocolErrorBody,
  SettingsRecord,
  WorkflowDetail,
  WorkflowGraphDocument,
} from '@easter-workflow-builder/protocol';
import type { Page } from '@playwright/test';
import { APPROVAL_RUN_URL, FIRST_APPROVAL, approvalBaseMocks } from './approval-fixture.ts';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */

const START_WITHOUT_FIELDS: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

const START_WITH_FIELDS: NodeConfig = {
  type: 'start',
  inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }],
  onUnhandledError: 'fail_run',
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

/* eslint-enable unicorn/no-null */

const EDITOR_URL = '/editor?workflowId=w-alfa';

/**
 * A szerver belső szövegének valósághű alakja (SPEC-005 8.3, 8.4): azonosító
 * és zárójeles hibaosztály. A felületre egyik sem juthat.
 */
const INTERNAL_ID = 'belso-azonosito-7f3a';

function internalMessage(errorClass: string): string {
  return `A(z) "${INTERNAL_ID}" belső részlet (${errorClass}).`;
}

/**
 * A szerkesztő mockjai: a gráf, a workflow és a beállítás, plusz a futás
 * indítás és a mentés, mindkettő ugyanazzal a hiba törzzsel (a teszt csak az
 * egyiket váltja ki).
 */
async function mockEditor(
  page: Page,
  startConfig: NodeConfig,
  errorBody: ProtocolErrorBody,
  status: number,
): Promise<void> {
  await mockIdleStream(page);
  const graph = graphWithStartConfig(startConfig);
  await installApiMocks(page, [
    mockRoute('readWorkflowGraph', async (route) => route.fulfill(jsonBody(graph))),
    mockRoute('getWorkflow', async (route) => route.fulfill(jsonBody(WORKFLOW))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('startRun', async (route) => route.fulfill(jsonBody(errorBody, status))),
    mockRoute('replaceWorkflowGraph', async (route) => route.fulfill(jsonBody(errorBody, status))),
  ]);
}

async function expectNoInternalText(page: Page, errorClass: string): Promise<void> {
  await expect(page.locator('body')).not.toContainText(INTERNAL_ID);
  await expect(page.locator('body')).not.toContainText(errorClass);
  await expect(page.locator('body')).not.toContainText('.:');
}

test('a futás indításának no_default_provider hibája a saját mondatával áll a lábléc danger Alert blokkjában', async ({
  page,
}) => {
  await mockEditor(
    page,
    START_WITHOUT_FIELDS,
    {
      code: 'unprocessable',
      message: internalMessage('no_default_provider'),
      errorClass: 'no_default_provider',
    } satisfies ProtocolErrorBody,
    422,
  );
  await page.goto(EDITOR_URL);

  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const alert = page.locator('.page-footer').getByRole('alert');
  await expect(alert).toHaveText('Nincs alapértelmezett provider beállítva.');
  await expect(alert).toHaveClass(/\balert--danger\b/);
  await expectNoInternalText(page, 'no_default_provider');
});

test('a futás indításának graph_cycle_detected hibája a modálisban a saját mondatával áll', async ({ page }) => {
  await mockEditor(
    page,
    START_WITH_FIELDS,
    {
      code: 'unprocessable',
      message: internalMessage('graph_cycle_detected'),
      errorClass: 'graph_cycle_detected',
    } satisfies ProtocolErrorBody,
    422,
  );
  await page.goto(EDITOR_URL);
  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Téma' }).fill('AI hírek');
  await dialog.getByRole('button', { name: 'Indítás', exact: true }).click();

  const alert = dialog.getByRole('alert');
  await expect(alert).toHaveText('A gráf olyan kört tartalmaz, amely nem egyetlen Ciklus csomóponton keresztül indul.');
  await expect(alert).toHaveClass(/\balert--danger\b/);
  await expectNoInternalText(page, 'graph_cycle_detected');
});

// A `malformed_node_config` hibaosztályt a szerver a futás indításakor adja (a
// motor validációja); a `PUT .../graph` végponton a mentési séma előbb
// utasít el `invalid_request` kóddal (SPEC-008 5.4, O-37), tehát a mentés
// válaszaként ezt az osztályt a valós szerver nem adhatja.
test('a futás indításának malformed_node_config hibája a lábléc danger Alert blokkjában a saját mondatával áll', async ({
  page,
}) => {
  await mockEditor(
    page,
    START_WITHOUT_FIELDS,
    {
      code: 'unprocessable',
      message: internalMessage('malformed_node_config'),
      errorClass: 'malformed_node_config',
    } satisfies ProtocolErrorBody,
    422,
  );
  await page.goto(EDITOR_URL);

  await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

  const alert = page.locator('.page-footer').getByRole('alert');
  await expect(alert).toHaveText('Egy csomópont beállításai hibásak.');
  await expect(alert).toHaveClass(/\balert--danger\b/);
  await expectNoInternalText(page, 'malformed_node_config');
});

// A sablon és a kifejezés fordítási hibáját a motor a futás indításakor adja
// (SPEC-010 9.2, 9.3); a lépés futás közbeni hibája a futás eseményein megy
// ki, nem REST válaszban, tehát a mondat "a futás nem indítható" tagja igaz
// (user döntés 2026-10-25).
const LANGUAGE_FIELD_CASES = [
  {
    errorClass: 'template_render_failed',
    sentence: 'A workflow egyik sablonja hibás, ezért a futás nem indítható.',
  },
  {
    errorClass: 'expression_evaluation_failed',
    sentence: 'A workflow egyik kifejezése hibás, ezért a futás nem indítható.',
  },
] as const satisfies readonly { readonly errorClass: ProtocolErrorBody['errorClass']; readonly sentence: string }[];

for (const { errorClass, sentence } of LANGUAGE_FIELD_CASES) {
  test(`a futás indításának ${errorClass} hibája a lábléc danger Alert blokkjában a saját mondatával áll`, async ({
    page,
  }) => {
    await mockEditor(
      page,
      START_WITHOUT_FIELDS,
      {
        code: 'unprocessable',
        message: internalMessage(errorClass),
        errorClass,
      } satisfies ProtocolErrorBody,
      422,
    );
    await page.goto(EDITOR_URL);

    await page.getByRole('button', { name: 'Futás indítása', exact: true }).click();

    const alert = page.locator('.page-footer').getByRole('alert');
    await expect(alert).toHaveText(sentence);
    await expect(alert).toHaveClass(/\balert--danger\b/);
    await expectNoInternalText(page, errorClass);
  });
}

// A mentés `invalid_request` hibájának mezője nem nevezhető meg a felület
// nyelvén (SPEC-007 8.4, O-10 lezárás): a szerver ugyanazzal a protokoll
// sémával ellenőriz, amivel a kliens a küldés előtt, tehát a mezőút csak
// szerződés sértésnél jönne, és nincs `errorClass` mezője. A felület a kód
// mondatát mutatja, a mezőutat nem.
test('a mentés invalid_request hibája errorClass nélkül a kód mondatát mutatja, a szerver mezőútja nélkül', async ({
  page,
}) => {
  await mockEditor(
    page,
    START_WITHOUT_FIELDS,
    {
      code: 'invalid_request',
      message: 'A kérés törzse érvénytelen, hibás mező(k): nodes.0.config.inputFields (invalid_request).',
    } satisfies ProtocolErrorBody,
    400,
  );
  await page.goto(EDITOR_URL);

  await page.getByRole('button', { name: /^Mentés/ }).click();

  await expect(page.getByText('A mentés sikertelen')).toBeVisible();
  await expect(page.getByText('A kérés nem volt érvényes.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('nodes.0.config.inputFields');
  await expect(page.locator('body')).not.toContainText('(invalid_request)');
});

test('a jóváhagyás already_decided hibája a saját mondatával áll a döntés danger Alert blokkjában', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockIdleStream(page);
  await installApiMocks(page, [
    ...approvalBaseMocks(async (route) => route.fulfill(jsonBody([FIRST_APPROVAL]))),
    mockRoute('decideApproval', async (route) =>
      route.fulfill(
        jsonBody(
          {
            code: 'conflict',
            message: internalMessage('already_decided'),
            errorClass: 'already_decided',
          } satisfies ProtocolErrorBody,
          409,
        ),
      ),
    ),
  ]);
  await page.goto(APPROVAL_RUN_URL);

  await page.getByRole('button', { name: 'Elutasítás', exact: true }).click();

  const alert = page.getByRole('alert').filter({ hasText: 'Ezt a jóváhagyást már eldöntötték.' });
  await expect(alert).toHaveText('Ezt a jóváhagyást már eldöntötték.');
  await expect(alert).toHaveClass(/\balert--danger\b/);
  await expectNoInternalText(page, 'already_decided');
});
