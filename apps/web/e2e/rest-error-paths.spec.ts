/* eslint-disable unicorn/no-null -- a RunSummary és a WorkflowSummary nullable
   mezői a protokoll szerint ténylegesen `null` értéket hordoznak
   (packages/protocol/src/run/run-record.ts,
   .../workflow/workflow-record.ts). */
// A REST kliens hibaágai valódi böngészőben (SPEC-007 8.3). Az
// `apps/web/src/rest-client` réteg öt `Outcome` hibaágat és a lista séma
// két hibaágát adja, plusz a `protocol-error-message` öt magyar mondatát -
// ezek eddig kizárólag unit tesztben futottak le, a felületen keresztül nem.
// Ez a fájl mindegyiket a tényleges felhasználói úton, `page.route()`
// mockolt válaszokkal éri el, tehát azt is igazolja, hogy a hibaüzenet a
// képernyőre is KIÉR, nem csak a függvény adja vissza.
import type { ProtocolErrorCode, RunSummary, WorkflowSummary } from '@easter-workflow-builder/protocol';
import { expect, test } from './coverage-fixture.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const ALFA: WorkflowSummary = {
  id: 'w-alfa',
  name: 'Alfa workflow',
  description: null,
  providerId: null,
  createdAtMs: 1,
  updatedAtMs: 1,
};

const RUN_PENDING: RunSummary = {
  id: 'r-pending',
  workflowId: 'w-alfa',
  status: 'pending',
  providerId: 'claude-subscription',
  createdAtMs: 10,
  startedAtMs: null,
  finishedAtMs: null,
  errorKind: null,
  errorMessage: null,
};

test.beforeEach(async ({ page }) => {
  await mockIdleStream(page);
});

test('elérhetetlen szerverre a lista "A szerver nem érhető el." üzenetet ad', async ({ page }) => {
  // A `route.abort()` a dokumentált módja annak, hogy a kérés hálózati
  // hibával záruljon, tehát a böngésző `fetch`-e ténylegesen dobjon - pont
  // ezt az ágat kapja el a `performRouteRequest` try/catch-e.
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.abort())]);

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText('A szerver nem érhető el.');
});

test('nem érvényes JSON törzsre a kliens saját üzenetet ad, nem dob kivételt', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'ez nem json' }),
    ),
  ]);

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText('A szerver nem érvényes JSON választ adott.');
});

test('nem tömb válaszra a lista séma a gyökeret nevezi meg hibás útvonalként', async ({ page }) => {
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody({})))]);

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText('A szerver váratlan választ adott ((gyökér)).');
});

test('hibás alakú listaelemre az üzenet az elem indexével kezdődő útvonalat nevez meg', async ({ page }) => {
  await installApiMocks(page, [mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([{}])))]);

  await page.goto('/');

  // Az `arraySchema` az elem indexét fűzi az elem sémájának útvonala elé
  // (`[index, ...issue.path]`), tehát a nulladik elem hiányzó `id` mezője
  // "0.id" alakban jelenik meg.
  await expect(page.getByRole('alert')).toContainText('0.id');
});

test('hibás alakú protokoll hiba törzsre a HTTP státusz szerepel az üzenetben', async ({ page }) => {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody({ nem: 'protokoll hiba alak' }, 500))),
  ]);

  await page.goto('/');

  await expect(page.getByRole('alert')).toHaveText('A szerver hibás választ adott (HTTP 500).');
});

test('204-es, üres törzsű válasz a séma validáláson bukik el, a felület használható marad', async ({ page }) => {
  // A `decodeResponseBody` a 204-et `undefined` értékkel, sikeres ágon adja
  // tovább, és a `responseSchema` dönt róla. Egyetlen mai végpont sem ad
  // 204-et, tehát ez azt rögzíti, MI TÖRTÉNIK, ha egy szerver mégis: a hiba
  // a szokásos `Outcome` úton jön ki, nem kivételként.
  await installApiMocks(page, [
    mockRoute('listRuns', async (route) => route.fulfill(jsonBody([RUN_PENDING]))),
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([ALFA]))),
    mockRoute('replaceStreamSubscriptions', async (route) =>
      route.fulfill(jsonBody({ streamId: 'e2e-stream', subscriptions: [] })),
    ),
    mockRoute('interruptRun', async (route) => route.fulfill({ status: 204 })),
  ]);

  await page.goto('/runs');
  const row = page.getByRole('table', { name: 'Futások' }).getByRole('row', { name: /r-pending/ });
  await row.getByRole('button', { name: 'Megszakítás' }).click();

  await expect(page.getByText('A megszakítás sikertelen')).toBeVisible();
  await expect(page.getByText('A szerver váratlan választ adott ((gyökér)).')).toBeVisible();
});

/**
 * A `protocolErrorMessage` öt kódjából négy eddig egyetlen e2e úton sem
 * futott le (csak az `internal`). A HTTP státusz kódonként eltér, hogy az
 * eset a valóságos szerver viselkedést utánozza, de a felület kizárólag a
 * törzs `code` mezőjéből választja a mondatot.
 */
const PROTOCOL_ERROR_CASES = [
  { code: 'invalid_request', status: 400, sentence: 'A kérés nem volt érvényes.' },
  { code: 'not_found', status: 404, sentence: 'A keresett elem nem létezik, esetleg időközben törölték.' },
  { code: 'conflict', status: 409, sentence: 'Az elem állapota most nem engedi a műveletet.' },
  { code: 'unprocessable', status: 422, sentence: 'A kérés rendben volt, de a rendszer nem tudja végrehajtani.' },
] as const satisfies readonly { code: ProtocolErrorCode; status: number; sentence: string }[];

for (const errorCase of PROTOCOL_ERROR_CASES) {
  test(`a ${errorCase.code} protokoll hibakód magyar mondata jelenik meg`, async ({ page }) => {
    await installApiMocks(page, [
      mockRoute('listWorkflows', async (route) =>
        route.fulfill(jsonBody({ code: errorCase.code, message: 'szerver részlet' }, errorCase.status)),
      ),
    ]);

    await page.goto('/');

    await expect(page.getByRole('alert')).toHaveText(`${errorCase.sentence}: szerver részlet`);
  });
}
