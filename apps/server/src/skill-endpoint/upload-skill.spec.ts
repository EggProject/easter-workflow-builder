import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import { createServerLogger } from '@easter-workflow-builder/logger';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildTestZipArchive, type TestZipEntry } from './build-test-zip-archive.ts';
import type { SkillUploadErrorClass } from './skill-upload-error-class.ts';
import { TEST_SKILL_LIBRARY } from './test-skill-library.ts';
import { createUploadSkillHandler } from './upload-skill.ts';
import { testZipDirectoryEntry } from './test-zip-directory-entry.ts';
import { testZipFileEntry } from './test-zip-file-entry.ts';

const MANIFEST = '---\nname: pdf-tools\ndescription: PDF fájlok kezelése\n---\n# PDF\n';
const UNIX_MODE_FACTOR = 0x1_00_00;

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function unused<TValue>(): Promise<TValue> {
  return Promise.reject(new Error('nem várt hívás'));
}

function buildFakeEngine(): Engine {
  return {
    startRun: () => unused(),
    interruptRun: () => unused(),
    decideApproval: () => unused(),
    restartRun: () => unused(),
    suggestedConcurrencyLimit: () => ({ suggestedLimit: undefined, note: 'teszt' }),
    testProviderConnection: () => unused(),
    shutdown: () => unused(),
  };
}

// A napló kimenete ebben a tesztben nem tárgy: a sorokat eldobjuk.
function discardLogLine(): void {
  // szándékosan üres: a teszt nem a naplót vizsgálja
}

const server = { baseUrl: '', root: '', close: (): Promise<void> => Promise.resolve() };

beforeEach(async () => {
  server.root = await mkdtemp(path.join(tmpdir(), 'skill-upload-'));
  const database: DatabaseContext = okOrThrow(openDatabase(':memory:'));
  const registry = createStreamRegistry(createRandomUuidIdGenerator());
  const httpServer = createHttpServer({
    handlers: buildRouteHandlers(database, buildFakeEngine(), registry, {
      ...TEST_SKILL_LIBRARY,
      rootDirectory: server.root,
    }),
    devOrigin: undefined,
    streamDependencies: { database, registry, clock: createSystemClock(), keepAliveIntervalMs: 60_000 },
    logger: createServerLogger({ secretValues: [] }, { write: discardLogLine }),
    idGenerator: createRandomUuidIdGenerator(),
  });
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', resolve);
  });
  const address = httpServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('A teszt szerver nem kapott portot.');
  }
  server.baseUrl = `http://127.0.0.1:${String(address.port)}`;
  server.close = () =>
    new Promise<void>((resolve) => {
      httpServer.closeAllConnections();
      httpServer.close(() => {
        resolve();
      });
    });
});

afterEach(async () => {
  await server.close();
  await rm(server.root, { recursive: true, force: true });
});

// A másolat `ArrayBuffer` hátterű, ezt várja a `fetch` törzs típusa (a `Buffer.concat` eredménye nem az).
function upload(name: string, body: Buffer): Promise<Response> {
  return fetch(`${server.baseUrl}/api/skills/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/zip' },
    body: new Uint8Array(body),
  });
}

function manifestEntry(prefix = ''): TestZipEntry {
  return testZipFileEntry(`${prefix}SKILL.md`, MANIFEST);
}

async function readSkill(name: string): Promise<readonly string[]> {
  return readdir(path.join(server.root, 'skills', name));
}

async function stagingLeftovers(): Promise<readonly string[]> {
  const entries = await readdir(server.root);
  return entries.filter((entry) => entry !== 'skills');
}

// Tárolt (tömörítetlen) zip, pontosan `totalBytes` hosszú: a kitöltő fájl mérete a fejlécek után marad.
function storedArchiveOfLength(totalBytes: number): Buffer {
  const manifest = testZipFileEntry('SKILL.md', MANIFEST, { compressionMethod: 0 });
  const overhead = buildTestZipArchive([
    manifest,
    testZipFileEntry('p.bin', Buffer.alloc(0), { compressionMethod: 0 }),
  ]).length;
  return buildTestZipArchive([
    manifest,
    testZipFileEntry('p.bin', Buffer.alloc(totalBytes - overhead), { compressionMethod: 0 }),
  ]);
}

describe('PUT /api/skills/:name: sikeres feltöltés, lista és törlés (AC10, AC11)', () => {
  it('a skill a skills/<név> alá kerül, a válasz a listaelem, a lista mutatja, a törlés eltávolítja', async () => {
    const response = await upload(
      'pdf-tools',
      buildTestZipArchive([manifestEntry(), testZipFileEntry('scripts/run.sh', 'echo hi')]),
    );

    expect(response.status).toBe(200);
    const summary: unknown = await response.json();
    expect(summary).toMatchObject({
      name: 'pdf-tools',
      description: 'PDF fájlok kezelése',
      sizeBytes: Buffer.byteLength(MANIFEST) + 7,
    });
    expect(await readFile(path.join(server.root, 'skills', 'pdf-tools', 'scripts', 'run.sh'), 'utf8')).toBe('echo hi');
    expect(await stagingLeftovers()).toStrictEqual([]);

    const listed = await fetch(`${server.baseUrl}/api/skills`);
    expect(await listed.json()).toStrictEqual([summary]);

    const deleted = await fetch(`${server.baseUrl}/api/skills/pdf-tools`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);
    const listedAfterDelete = await fetch(`${server.baseUrl}/api/skills`);
    expect(await listedAfterDelete.json()).toStrictEqual([]);
  });

  it('az egy mappába zárt csomag is elfogadott, a mappa neve lecsípve (O-35)', async () => {
    const response = await upload(
      'pdf-tools',
      buildTestZipArchive([testZipDirectoryEntry('bármi/'), manifestEntry('bármi/')]),
    );

    expect(response.status).toBe(200);
    expect(await readdir(path.join(server.root, 'skills', 'pdf-tools'))).toStrictEqual(['SKILL.md']);
  });

  it('a frontmatter name hiánya elfogadott, a tartalom nem módosul (O-37)', async () => {
    const withoutName = '---\ndescription: x\n---\n';
    const response = await upload('pdf-tools', buildTestZipArchive([testZipFileEntry('SKILL.md', withoutName)]));
    expect(response.status).toBe(200);
    expect(await readFile(path.join(server.root, 'skills', 'pdf-tools', 'SKILL.md'), 'utf8')).toBe(withoutName);
  });

  it('az azonos nevű feltöltés a régi skillt teljesen lecseréli', async () => {
    await upload('pdf-tools', buildTestZipArchive([manifestEntry(), testZipFileEntry('regi.txt', 'r')]));
    const response = await upload('pdf-tools', buildTestZipArchive([manifestEntry(), testZipFileEntry('uj.txt', 'u')]));

    expect(response.status).toBe(200);
    expect(new Set(await readSkill('pdf-tools'))).toStrictEqual(new Set(['SKILL.md', 'uj.txt']));
  });

  it('a kicsomagolás közben elbukó felülírás a régi skillt érintetlenül hagyja, és nem marad félig kibontott könyvtár (5.4 9. pont)', async () => {
    await upload('pdf-tools', buildTestZipArchive([manifestEntry(), testZipFileEntry('regi.txt', 'r')]));
    const brokenSecondEntry = testZipFileEntry('uj.txt', 'abcde', { declaredUncompressedSize: 9 });

    const response = await upload('pdf-tools', buildTestZipArchive([manifestEntry(), brokenSecondEntry]));

    expect(response.status).toBe(422);
    expect(new Set(await readSkill('pdf-tools'))).toStrictEqual(new Set(['SKILL.md', 'regi.txt']));
    expect(await stagingLeftovers()).toStrictEqual([]);
  });
});

describe('PUT /api/skills/:name: a törzs korlátja a határon és eggyel fölötte (O-34)', () => {
  it('a pontosan 30 000 000 bájtos törzs elfogadott, a 30 000 001 bájtos túl nagy', async () => {
    const atLimit = storedArchiveOfLength(TEST_SKILL_LIBRARY.limits.maxArchiveBytes);
    expect(atLimit).toHaveLength(30_000_000);
    const accepted = await upload('pdf-tools', atLimit);
    expect(accepted.status).toBe(200);

    const overLimit = Buffer.concat([atLimit, Buffer.alloc(1)]);
    const response = await upload('pdf-tools', overLimit);
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'unprocessable', errorClass: 'skill_archive_too_large' });
  });
});

const REJECTIONS: readonly (readonly [SkillUploadErrorClass, string, () => Buffer])[] = [
  ['skill_archive_unreadable', 'pdf-tools', () => Buffer.from('nem zip')],
  [
    'skill_archive_entry_type_unsupported',
    'pdf-tools',
    () =>
      buildTestZipArchive([
        manifestEntry(),
        testZipFileEntry('link', '/etc/passwd', { externalFileAttributes: 0o12_0777 * UNIX_MODE_FACTOR }),
      ]),
  ],
  [
    'skill_archive_unsafe_path',
    'pdf-tools',
    () => buildTestZipArchive([manifestEntry(), testZipFileEntry('../kint', 'x')]),
  ],
  [
    'skill_archive_path_collision',
    'pdf-tools',
    () => buildTestZipArchive([manifestEntry(), testZipFileEntry('a.md', 'x'), testZipFileEntry('A.md', 'y')]),
  ],
  [
    'skill_archive_layout_invalid',
    'pdf-tools',
    () => buildTestZipArchive([manifestEntry('a/'), testZipFileEntry('b/c', 'x')]),
  ],
  ['skill_manifest_missing', 'pdf-tools', () => buildTestZipArchive([testZipFileEntry('a/readme.md', 'x')])],
  ['skill_manifest_duplicate', 'pdf-tools', () => buildTestZipArchive([manifestEntry(), manifestEntry()])],
  ['skill_manifest_invalid', 'pdf-tools', () => buildTestZipArchive([testZipFileEntry('SKILL.md', '# fejléc nélkül')])],
  ['skill_name_invalid', 'Rossz_Nev', () => buildTestZipArchive([manifestEntry()])],
  ['skill_name_mismatch', 'mas-nev', () => buildTestZipArchive([manifestEntry()])],
  ['skill_archive_too_large', 'pdf-tools', () => storedArchiveOfLength(30_000_001)],
  [
    'skill_archive_too_many_entries',
    'pdf-tools',
    () =>
      buildTestZipArchive([
        manifestEntry(),
        ...Array.from({ length: 1024 }, (_, index) => testZipFileEntry(`f/${String(index)}`, '')),
      ]),
  ],
  [
    'skill_archive_entry_size_mismatch',
    'pdf-tools',
    () =>
      buildTestZipArchive([
        manifestEntry(),
        testZipFileEntry('a', 'abc', { compressionMethod: 0, declaredUncompressedSize: 2 }),
      ]),
  ],
  [
    'skill_archive_entry_encrypted',
    'pdf-tools',
    () => buildTestZipArchive([manifestEntry(), testZipFileEntry('t', 'x', { generalPurposeBitFlag: 0x41 })]),
  ],
  [
    'skill_archive_compression_unsupported',
    'pdf-tools',
    () => buildTestZipArchive([manifestEntry(), testZipFileEntry('a.bz2', 'x', { compressionMethod: 12 })]),
  ],
];

describe('PUT /api/skills/:name: minden elutasítás a saját hibaosztályával, 422 unprocessable (AC11, O-41)', () => {
  it('a táblázat a tizenöt osztály mindegyikét pontosan egyszer fedi', async () => {
    const { SKILL_UPLOAD_ERROR_CLASSES } = await import('./skill-upload-error-class.ts');
    expect(new Set(REJECTIONS.map(([errorClass]) => errorClass))).toStrictEqual(new Set(SKILL_UPLOAD_ERROR_CLASSES));
    expect(REJECTIONS).toHaveLength(SKILL_UPLOAD_ERROR_CLASSES.length);
  });

  it.each(REJECTIONS)('%s', async (errorClass, name, buildBody) => {
    const response = await upload(name, buildBody());

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'unprocessable', errorClass });
    expect(existsSync(path.join(server.root, 'skills', name))).toBe(false);
    expect(await stagingLeftovers()).toStrictEqual([]);
  });
});

describe('createUploadSkillHandler: a kezelő közvetlen hívása', () => {
  it('hiányzó név paraméterre skill_name_invalid, fájlrendszer érintése nélkül', async () => {
    const handler = createUploadSkillHandler({ ...TEST_SKILL_LIBRARY, rootDirectory: server.root });
    const outcome = await handler.handle({ parameters: {}, body: { kind: 'complete', bytes: Buffer.alloc(0) } });
    expect(outcome.kind === 'error' && outcome.message).toMatch(/\(skill_name_invalid\)\.$/u);
    expect(await readdir(server.root)).toStrictEqual([]);
  });

  it('a korlátot az archívum korlátjából veszi', () => {
    expect(createUploadSkillHandler(TEST_SKILL_LIBRARY).maxBodyBytes).toBe(30_000_000);
  });
});
