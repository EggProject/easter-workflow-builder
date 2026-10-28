// E2E a Beállítások "Skill könyvtár" kártyájára valós Chromiumban (PLAN-012
// T-012-25, SPEC-009 3.1 4. pont, 5.1, 5.4, 12. szekció AC10, AC11, O-9 ...
// O-16, O-41): a lista, a ZIP feltöltés nyers bájtokkal, a felülírás és a
// törlés megerősítő modálisa, az üres állapot és a tizenöt feltöltési
// hibaosztály magyar mondata. A feltöltés `PUT` kérésének törzsét és
// `Content-Type` fejlécét `page.route()` mock rögzíti; a REST hívások mind
// mockoltak (`.claude/CLAUDE.md` 11. szekció).
/* eslint-disable unicorn/no-null -- a protokoll nullázható mezői a dróton ténylegesen `null` értéket hordoznak (packages/protocol) */
import type { ProtocolErrorBody, SettingsRecord, SkillSummary } from '@easter-workflow-builder/protocol';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './coverage-fixture.ts';
import { createRequestGate } from './request-gate.ts';
import { installApiMocks, jsonBody, mockRoute } from './rest-mock.ts';
import { mockIdleStream } from './sse-mock.ts';

const SETTINGS: SettingsRecord = { defaultProviderId: null, persistStreamDeltas: false };

const ALFA: SkillSummary = { name: 'alfa', description: 'Alfa leírás', sizeBytes: 2048, modifiedAtMs: 1 };
const BETA: SkillSummary = { name: 'beta', description: '', sizeBytes: 100, modifiedAtMs: 2 };

/**
 * A feltöltött fájl bájtjai: a ZIP helyi fejléc aláírása (`PK\x03\x04`) plusz
 * néhány bájt. A mock nem csomagol ki semmit, a teszt azt állítja, hogy a
 * törzs bájtról bájtra ez, nem JSON és nem többrészes űrlap.
 */
const ZIP_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x0a, 0x00, 0xff, 0x00, 0x7f]);

const INTERNAL_ID = 'belso-azonosito-4c1d';

interface UploadRecord {
  readonly name: string;
  readonly contentType: string | undefined;
  readonly bytes: Buffer | null;
}

interface MockState {
  skills: readonly SkillSummary[];
  listCalls: number;
  readonly uploads: UploadRecord[];
  readonly deletes: string[];
  uploadFailureClass: ProtocolErrorBody['errorClass'];
  isDeleteFailing: boolean;
}

const mockState: MockState = {
  skills: [],
  listCalls: 0,
  uploads: [],
  deletes: [],
  uploadFailureClass: undefined,
  isDeleteFailing: false,
};

function lastPathSegment(url: URL): string {
  return url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
}

function withSkill(skills: readonly SkillSummary[], skill: SkillSummary): readonly SkillSummary[] {
  return [...skills.filter((existing) => existing.name !== skill.name), skill].toSorted((left, right) =>
    left.name.localeCompare(right.name),
  );
}

async function installMocks(page: Page, listSkills?: Parameters<typeof mockRoute>[1]): Promise<void> {
  await installApiMocks(page, [
    mockRoute('listWorkflows', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('readSettings', async (route) => route.fulfill(jsonBody(SETTINGS))),
    mockRoute('listProviders', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listConcurrencyLimits', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listMcpServerDefinitions', async (route) => route.fulfill(jsonBody([]))),
    mockRoute('listServerEnvironmentNames', async (route) => route.fulfill(jsonBody([]))),
    mockRoute(
      'listSkills',
      listSkills ??
        (async (route) => {
          mockState.listCalls += 1;
          await route.fulfill(jsonBody(mockState.skills));
        }),
    ),
    mockRoute('uploadSkill', async (route, url) => {
      const request = route.request();
      mockState.uploads.push({
        name: lastPathSegment(url),
        contentType: request.headers()['content-type'],
        bytes: request.postDataBuffer(),
      });
      const { uploadFailureClass } = mockState;
      if (uploadFailureClass !== undefined) {
        await route.fulfill(
          jsonBody(
            {
              code: 'unprocessable',
              message: `A(z) "${INTERNAL_ID}" belső részlet (${uploadFailureClass}).`,
              errorClass: uploadFailureClass,
            } satisfies ProtocolErrorBody,
            422,
          ),
        );
        return;
      }
      const uploaded: SkillSummary = {
        name: lastPathSegment(url),
        description: 'Feltöltött leírás',
        sizeBytes: ZIP_BYTES.length,
        modifiedAtMs: 3,
      };
      mockState.skills = withSkill(mockState.skills, uploaded);
      await route.fulfill(jsonBody(uploaded));
    }),
    mockRoute('deleteSkill', async (route, url) => {
      mockState.deletes.push(lastPathSegment(url));
      if (mockState.isDeleteFailing) {
        await route.fulfill(
          jsonBody(
            { code: 'not_found', message: `A(z) "${INTERNAL_ID}" belső részlet.` } satisfies ProtocolErrorBody,
            404,
          ),
        );
        return;
      }
      mockState.skills = mockState.skills.filter((skill) => skill.name !== lastPathSegment(url));
      await route.fulfill({ status: 204 });
    }),
  ]);
}

test.beforeEach(async ({ page }) => {
  mockState.skills = [ALFA, BETA];
  mockState.listCalls = 0;
  mockState.uploads.length = 0;
  mockState.deletes.length = 0;
  mockState.uploadFailureClass = undefined;
  mockState.isDeleteFailing = false;
  await mockIdleStream(page);
  await page.setViewportSize({ width: 1440, height: 900 });
});

function card(page: Page): Locator {
  return page.getByRole('region', { name: 'Skill könyvtár', exact: true });
}

function row(page: Page, name: string): Locator {
  return card(page).getByRole('group', { name, exact: true });
}

function dialog(page: Page, name: string): Locator {
  return page.getByRole('dialog', { name, exact: true });
}

async function openSettings(page: Page): Promise<void> {
  await installMocks(page);
  await page.goto('/settings');
  await expect(card(page)).toBeVisible();
}

async function chooseArchive(page: Page, fileName = 'csomag.zip'): Promise<void> {
  await card(page)
    .getByLabel(/tallózz/u)
    .setInputFiles({ name: fileName, mimeType: 'application/zip', buffer: ZIP_BYTES });
  await expect(card(page).getByText(fileName, { exact: true })).toBeVisible();
}

async function fillName(page: Page, name: string): Promise<void> {
  await card(page)
    .getByRole('textbox', { name: /^Skill neve/u })
    .fill(name);
}

async function submit(page: Page): Promise<void> {
  await card(page).getByRole('button', { name: 'Feltöltés', exact: true }).click();
}

test('a kártya a feltöltött skilleket név szerint mutatja leírással, mérettel, üres leírásnál saját mondattal, és kimondja a két kockázatot', async ({
  page,
}) => {
  await openSettings(page);

  await expect(card(page).getByRole('group')).toHaveText([/alfa/u, /beta/u]);
  await expect(row(page, 'alfa')).toContainText('Alfa leírás');
  await expect(row(page, 'alfa')).toContainText('2.0 KB');
  await expect(row(page, 'beta')).toContainText('Nincs leírás.');
  await expect(row(page, 'beta')).toContainText('100 B');
  await expect(card(page)).toContainText('nem tartalmazhat titkot');
  await expect(card(page)).toContainText('a skill nem sandbox');
});

test('a betöltés alatt csontváz áll, a betöltés hibája danger Alert', async ({ page }) => {
  const gate = createRequestGate();
  await installMocks(page, async (route) => {
    await gate.passed;
    await route.fulfill(jsonBody({ code: 'internal', message: 'belső hiba' }, 500));
  });
  await page.goto('/settings');

  await expect(card(page).locator('[aria-busy="true"]')).toBeVisible();
  gate.open();
  await expect(card(page).getByRole('alert').first()).toHaveClass(/\balert--danger\b/u);
  await expect(card(page).locator('[aria-busy="true"]')).toBeAttached({ attached: false });
});

test('új skill feltöltése: a PUT a névre megy, a törzs a nyers ZIP bájtjai application/zip fejléccel, siker után a lista újratöltődik és az űrlap kiürül (AC10)', async ({
  page,
}) => {
  await openSettings(page);
  expect(mockState.listCalls).toBe(1);

  await fillName(page, 'gamma');
  await chooseArchive(page);
  await submit(page);

  await expect(row(page, 'gamma')).toBeVisible();
  expect(mockState.uploads).toHaveLength(1);
  expect(mockState.uploads[0]?.name).toBe('gamma');
  expect(mockState.uploads[0]?.contentType).toBe('application/zip');
  expect(mockState.uploads[0]?.bytes?.equals(ZIP_BYTES)).toBe(true);
  expect(mockState.listCalls).toBe(2);
  await expect(card(page).getByRole('group')).toHaveText([/alfa/u, /beta/u, /gamma/u]);
  await expect(card(page).getByRole('textbox', { name: /^Skill neve/u })).toHaveValue('');
  await expect(card(page).getByText('csomag.zip', { exact: true })).toHaveCount(0);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
});

test('üres űrlapon a Feltöltés a név és a fájl hibáját a mező alatt jelzi, érvénytelen névnél a hiba marad, érvényes értékeknél eltűnik, és a PUT nem megy ki', async ({
  page,
}) => {
  await openSettings(page);

  await expect(card(page).getByRole('alert')).toHaveCount(0);
  await submit(page);
  await expect(card(page).getByRole('alert')).toHaveText([
    /^A név 1-64 karakter lehet/u,
    'Válassz ki egy ZIP csomagot.',
  ]);
  await expect(card(page).getByRole('textbox', { name: /^Skill neve/u })).toHaveAttribute('aria-invalid', 'true');

  await fillName(page, 'Rossz Név');
  await expect(card(page).getByRole('alert')).toHaveText([
    /^A név 1-64 karakter lehet/u,
    'Válassz ki egy ZIP csomagot.',
  ]);

  await fillName(page, 'jo-nev');
  await expect(card(page).getByRole('alert')).toHaveText('Válassz ki egy ZIP csomagot.');
  await chooseArchive(page);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
  expect(mockState.uploads).toHaveLength(0);
});

test('a kiválasztott fájl eltávolítható, utána a feltöltés a hiányzó fájlt jelzi', async ({ page }) => {
  await openSettings(page);

  await fillName(page, 'jo-nev');
  await chooseArchive(page);
  await card(page).getByRole('button', { name: 'Eltávolítás: csomag.zip', exact: true }).click();
  await expect(card(page).getByText('csomag.zip', { exact: true })).toHaveCount(0);
  await submit(page);

  await expect(card(page).getByRole('alert')).toHaveText('Válassz ki egy ZIP csomagot.');
  expect(mockState.uploads).toHaveLength(0);
});

test('azonos nevű skill feltöltése megerősítést kér: a Mégse nem küld semmit, a Felülírás igen, és a lista a cserélt sorral töltődik újra', async ({
  page,
}) => {
  await openSettings(page);

  await fillName(page, 'alfa');
  await chooseArchive(page);
  await submit(page);

  const modal = dialog(page, 'Skill felülírása');
  await expect(modal).toContainText('Már van alfa nevű skill');
  await expect(modal).toContainText('a régi skill érintetlen marad');
  await modal.getByRole('button', { name: 'Mégse', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(mockState.uploads).toHaveLength(0);

  await submit(page);
  await modal.getByRole('button', { name: 'Felülírás', exact: true }).click();
  await expect(modal).toBeHidden();

  await expect(row(page, 'alfa')).toContainText('Feltöltött leírás');
  expect(mockState.uploads).toHaveLength(1);
  expect(mockState.uploads[0]?.name).toBe('alfa');
  expect(mockState.listCalls).toBe(2);
  await expect(card(page).getByRole('group')).toHaveCount(2);
});

test('a feltöltés utáni újratöltés hibája danger Alert, az új skill a PUT válaszából a listában marad, és az azonos nevű következő feltöltés megerősítést kér', async ({
  page,
}) => {
  await installMocks(page, async (route) => {
    mockState.listCalls += 1;
    await (mockState.listCalls === 1
      ? route.fulfill(jsonBody(mockState.skills))
      : route.fulfill(jsonBody({ code: 'internal', message: 'belső hiba' }, 500)));
  });
  await page.goto('/settings');
  await expect(card(page)).toBeVisible();

  await fillName(page, 'gamma');
  await chooseArchive(page);
  await submit(page);

  await expect(row(page, 'gamma')).toBeVisible();
  await expect(card(page).getByRole('group')).toHaveText([/alfa/u, /beta/u, /gamma/u]);
  await expect(card(page).getByRole('alert')).toHaveClass(/\balert--danger\b/u);
  expect(mockState.listCalls).toBe(2);

  await fillName(page, 'gamma');
  await chooseArchive(page);
  await submit(page);

  await expect(dialog(page, 'Skill felülírása')).toContainText('Már van gamma nevű skill');
  expect(mockState.uploads).toHaveLength(1);
});

test('a szerver elutasítása "A csomag túl nagy." és "Hiányzik a SKILL.md." mondattal áll az űrlap alatti danger Alert blokkban, a lista változatlan, belső szöveg nélkül (AC11)', async ({
  page,
}) => {
  await openSettings(page);
  await fillName(page, 'gamma');
  await chooseArchive(page);

  mockState.uploadFailureClass = 'skill_archive_too_large';
  await submit(page);
  const alert = card(page).getByRole('alert');
  await expect(alert).toHaveText('A csomag túl nagy.');
  await expect(alert).toHaveClass(/\balert--danger\b/u);

  mockState.uploadFailureClass = 'skill_manifest_missing';
  await submit(page);
  await expect(alert).toHaveText('Hiányzik a SKILL.md.');

  await expect(page.locator('body')).not.toContainText(INTERNAL_ID);
  await expect(page.locator('body')).not.toContainText('skill_manifest_missing');
  await expect(card(page).getByRole('group')).toHaveCount(2);
  expect(mockState.listCalls).toBe(1);
  await expect(card(page).getByRole('textbox', { name: /^Skill neve/u })).toHaveValue('gamma');
});

const UPLOAD_ERROR_SENTENCES = [
  ['skill_archive_unreadable', 'A feltöltött fájl nem érvényes ZIP csomag.'],
  ['skill_archive_entry_type_unsupported', 'A csomag nem támogatott bejegyzést tartalmaz, például szimbolikus linket.'],
  ['skill_archive_unsafe_path', 'A csomag egyik bejegyzésének útvonala tiltott.'],
  ['skill_archive_path_collision', 'A csomag két bejegyzésének útvonala azonos, vagy csak kis- és nagybetűben tér el.'],
  ['skill_archive_layout_invalid', 'A csomag gyökerében nincs SKILL.md, és nem pontosan egy mappát tartalmaz.'],
  ['skill_manifest_missing', 'Hiányzik a SKILL.md.'],
  ['skill_manifest_duplicate', 'A skill gyökerében több SKILL.md áll.'],
  ['skill_manifest_invalid', 'A SKILL.md fejléce hibás.'],
  ['skill_name_invalid', 'A megadott skill név nem felel meg a névszabálynak.'],
  ['skill_name_mismatch', 'A SKILL.md fejlécében álló név eltér a megadott névtől.'],
  ['skill_archive_too_large', 'A csomag túl nagy.'],
  ['skill_archive_too_many_entries', 'A csomag túl sok fájlt tartalmaz.'],
  ['skill_archive_entry_size_mismatch', 'A csomag egyik bejegyzése sérült.'],
  ['skill_archive_entry_encrypted', 'A csomag titkosított bejegyzést tartalmaz.'],
  ['skill_archive_compression_unsupported', 'A csomag nem támogatott tömörítést használ.'],
] as const satisfies readonly (readonly [NonNullable<ProtocolErrorBody['errorClass']>, string])[];

test('mind a tizenöt feltöltési hibaosztály a saját magyar mondatával áll az Alert blokkban (O-41, AC11)', async ({
  page,
}) => {
  await openSettings(page);
  await fillName(page, 'gamma');
  await chooseArchive(page);
  const alert = card(page).getByRole('alert');

  for (const [errorClass, sentence] of UPLOAD_ERROR_SENTENCES) {
    mockState.uploadFailureClass = errorClass;
    await submit(page);
    await expect(alert).toHaveText(sentence);
    await expect(page.locator('body')).not.toContainText(errorClass);
  }
  expect(mockState.uploads).toHaveLength(UPLOAD_ERROR_SENTENCES.length);
});

test('a feltöltés alatt a Feltöltés gomb tiltott és betöltést jelez', async ({ page }) => {
  const gate = createRequestGate();
  await openSettings(page);
  await page.route(/\/api\/skills\/gamma$/u, async (route) => {
    await gate.passed;
    await route.fallback();
  });
  await fillName(page, 'gamma');
  await chooseArchive(page);
  await submit(page);

  await expect(card(page).getByRole('button', { name: 'Feltöltés', exact: true })).toBeDisabled();
  await expect(card(page).getByRole('button', { name: 'Feltöltés', exact: true })).toHaveAttribute('aria-busy', 'true');
  gate.open();
  await expect(row(page, 'gamma')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Feltöltés', exact: true })).toBeEnabled();
});

test('a törlés megerősítő modálist kér, kimondja a hivatkozás következményét, a Mégse nem töröl, a Törlés DELETE-et küld és a sor eltűnik', async ({
  page,
}) => {
  await openSettings(page);

  await row(page, 'alfa').getByRole('button', { name: 'Törlés: alfa', exact: true }).click();
  const modal = dialog(page, 'Skill törlése');
  await expect(modal).toContainText('minden fájljával véglegesen törlődik');
  await expect(modal).toContainText('a workflow futása hibával nem indul el');
  await modal.getByRole('button', { name: 'Mégse', exact: true }).click();
  await expect(modal).toBeHidden();
  expect(mockState.deletes).toHaveLength(0);

  await row(page, 'alfa').getByRole('button', { name: 'Törlés: alfa', exact: true }).click();
  await modal.getByRole('button', { name: 'Törlés', exact: true }).click();
  await expect(modal).toBeHidden();

  expect(mockState.deletes).toEqual(['alfa']);
  await expect(row(page, 'alfa')).toHaveCount(0);
  await expect(row(page, 'beta')).toBeVisible();
});

test('a törlés hibája danger Alert a modálisban, a modális nyitva marad, a sor megmarad', async ({ page }) => {
  mockState.isDeleteFailing = true;
  await openSettings(page);

  await row(page, 'alfa').getByRole('button', { name: 'Törlés: alfa', exact: true }).click();
  const modal = dialog(page, 'Skill törlése');
  await modal.getByRole('button', { name: 'Törlés', exact: true }).click();

  await expect(modal.getByRole('alert')).toHaveClass(/\balert--danger\b/u);
  await expect(modal.getByRole('alert')).not.toContainText(INTERNAL_ID);
  await expect(modal).toBeVisible();
  await expect(row(page, 'alfa')).toBeVisible();
});

test('az utolsó skill törlése után az üres állapot áll, a feltöltő űrlap megmarad', async ({ page }) => {
  mockState.skills = [ALFA];
  await openSettings(page);

  await row(page, 'alfa').getByRole('button', { name: 'Törlés: alfa', exact: true }).click();
  await dialog(page, 'Skill törlése').getByRole('button', { name: 'Törlés', exact: true }).click();

  await expect(card(page).getByText('Még nincs feltöltött skill.')).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Feltöltés', exact: true })).toBeVisible();
});
