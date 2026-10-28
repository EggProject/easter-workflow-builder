import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fromBufferPromise, getFileNameLowLevel, type Entry, type ZipFile } from 'yauzl';
import type { Outcome } from '@easter-workflow-builder/core';
import { classifyFileSystemWriteError } from './classify-file-system-write-error.ts';
import { classifyZipReadError } from './classify-zip-read-error.ts';
import { findPathCollision } from './find-path-collision.ts';
import { isFileSystemError } from './is-file-system-error.ts';
import { isUnsafeEntryPath } from './is-unsafe-entry-path.ts';
import type { PlannedZipEntry } from './planned-zip-entry.ts';
import { readDeclaredCentralDirectorySize } from './read-declared-central-directory-size.ts';
import { readSkillManifest, type SkillManifest } from './read-skill-manifest.ts';
import { resolveSkillLayout } from './resolve-skill-layout.ts';
import { resolveZipEntryKind } from './resolve-zip-entry-kind.ts';
import type { SkillArchiveLimits } from './skill-archive-limits.ts';
import { skillUploadFailure } from './skill-upload-failure.ts';

// APPNOTE 4.4.5: 0 tárolt, 8 deflate; a `yauzl` `canDecodeFileData()` is csak ezt a kettőt bontja ki.
const SUPPORTED_COMPRESSION_METHODS: ReadonlySet<number> = new Set([0, 8]);
// APPNOTE 4.4.4: az általános célú jelző 0. bitje a titkosítás.
const ENCRYPTED_FLAG = 0x1;
// APPNOTE 4.3.12: a központi könyvtár rekord rögzített része; utána a név, az extra mező és a megjegyzés.
const CENTRAL_DIRECTORY_RECORD_FIXED_SIZE = 46;
const WRITTEN: Outcome<undefined> = { kind: 'ok', value: undefined };

interface ArchiveEntry extends PlannedZipEntry {
  readonly entry: Entry;
}

/**
 * Egy bejegyzés elutasítási oka (SPEC-009 5.4 1., 2. és 7. pont), vagy az
 * elfogadott, kanonikus (záró `/` nélküli) alakja.
 */
function planEntry(entry: Entry, entryPath: string, targetDirectory: string): Outcome<ArchiveEntry> {
  if (isUnsafeEntryPath(entryPath, targetDirectory)) {
    return skillUploadFailure(
      'skill_archive_unsafe_path',
      `A(z) ${JSON.stringify(entryPath)} bejegyzés útvonala tiltott`,
    );
  }
  if (entry.isEncrypted()) {
    return skillUploadFailure('skill_archive_entry_encrypted', `A(z) "${entryPath}" bejegyzés titkosított`);
  }
  if (!SUPPORTED_COMPRESSION_METHODS.has(entry.compressionMethod)) {
    return skillUploadFailure(
      'skill_archive_compression_unsupported',
      `A(z) "${entryPath}" bejegyzés tömörítési módszere (${String(entry.compressionMethod)}) nem támogatott`,
    );
  }
  const kind = resolveZipEntryKind(entry.versionMadeBy, entry.externalFileAttributes, entryPath);
  if (kind === 'unsupported') {
    return skillUploadFailure(
      'skill_archive_entry_type_unsupported',
      `A(z) "${entryPath}" bejegyzés se nem könyvtár, se nem szabályos fájl`,
    );
  }
  // Adatot hordozó könyvtár bejegyzés: a tartalma a kicsomagoláskor csendben
  // kimaradna (PLAN-012 T-012-27, ZIP 7. találat), tehát a típusa ellentmondásos.
  if (kind === 'directory' && entry.uncompressedSize > 0) {
    return skillUploadFailure(
      'skill_archive_entry_type_unsupported',
      `A(z) "${entryPath}" könyvtár bejegyzés adatot hordoz (${String(entry.uncompressedSize)} bájt)`,
    );
  }
  return { kind: 'ok', value: { entry, kind, path: entryPath.replace(/\/$/u, '') } };
}

/**
 * Az első menet: a központi könyvtár minden bejegyzése, fájl írás nélkül. A
 * nevet a `decodeStrings: false` miatt itt dekódoljuk, a `strictFileNames`
 * megfelelőjével (a visszaper nem cserélődik `/`-re, tehát a saját
 * útvonal ellenőrzés elutasítja). A beolvasott rekordok összhossza a záró
 * rekord deklarált központi könyvtár méretével egyezik, különben a záró rekord
 * bejegyzésszáma kevesebbet mond, mint amennyi bejegyzés áll a könyvtárban, és
 * a többi csendben kimaradna (SPEC-009 5.4: "nem hagy ki csendben
 * bejegyzést"; PLAN-012 T-012-27, ZIP 6. találat).
 */
async function planEntries(
  zipFile: ZipFile,
  targetDirectory: string,
  declaredCentralDirectorySize: number,
): Promise<Outcome<readonly ArchiveEntry[]>> {
  const planned: ArchiveEntry[] = [];
  let centralDirectoryBytes = 0;
  try {
    for await (const entry of zipFile.eachEntry()) {
      const entryPath = getFileNameLowLevel(entry.generalPurposeBitFlag, entry.fileNameRaw, entry.extraFields, true);
      const outcome = planEntry(entry, entryPath, targetDirectory);
      if (outcome.kind === 'error') {
        return outcome;
      }
      planned.push(outcome.value);
      centralDirectoryBytes +=
        CENTRAL_DIRECTORY_RECORD_FIXED_SIZE + entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength;
    }
  } catch (error) {
    return skillUploadFailure(classifyZipReadError(error), 'A csomag központi könyvtára nem olvasható');
  }
  if (centralDirectoryBytes !== declaredCentralDirectorySize) {
    return skillUploadFailure(
      'skill_archive_unreadable',
      `A záró rekord ${String(zipFile.entryCount)} bejegyzése ${String(centralDirectoryBytes)} bájt, a deklarált központi könyvtár ${String(declaredCentralDirectorySize)} bájt`,
    );
  }
  return { kind: 'ok', value: planned };
}

/**
 * Egy bejegyzés kiírása. A fájl bejegyzés helyi fejlécének titkosítási bitje is
 * számít (PLAN-012 T-012-27, ZIP 7. találat): a `yauzl` a központi könyvtár
 * bitjét nézi, a helyi fejlécét nem, és egy csak ott titkosítottat jelző
 * bejegyzés titkosított bájtjait nyers adatként bontaná ki. A helyi fejléc a
 * kicsomagoláshoz amúgy is beolvasott 30 bájt plusz a név (`readLocalFileHeader`).
 */
async function writeEntry(
  zipFile: ZipFile,
  archiveEntry: ArchiveEntry,
  destination: string,
  countBytes: () => Transform,
): Promise<Outcome<undefined>> {
  if (archiveEntry.kind === 'directory') {
    await mkdir(destination, { recursive: true });
    return WRITTEN;
  }
  const localHeader = await zipFile.readLocalFileHeaderPromise(archiveEntry.entry);
  if ((localHeader.generalPurposeBitFlag & ENCRYPTED_FLAG) !== 0) {
    return skillUploadFailure(
      'skill_archive_entry_encrypted',
      `A(z) "${archiveEntry.path}" bejegyzés helyi fejléce titkosítottat jelez`,
    );
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const source = await zipFile.openReadStreamPromise(archiveEntry.entry);
  await pipeline(source, countBytes(), createWriteStream(destination, { flags: 'wx' }));
  return WRITTEN;
}

/**
 * A második menet: a fájlok kiírása a cél könyvtárba, a skill gyökerének
 * előtagja nélkül. A kicsomagolt bájtokat a ténylegesen kiírt adaton számolja,
 * nem a fejléc deklarált méretén (SPEC-009 5.4 6. pont, CERT IDS04-J), és a
 * korlát átlépésekor megszakít. A fájl a szerver alapértelmezett
 * jogosultságával jön létre, a zip Unix módja nem érvényesül (8. pont).
 *
 * A hiba besorolása (PLAN-012 T-012-27, ZIP 3. találat): a `yauzl` és a `zlib`
 * hibája a csomag hibája (`classifyZipReadError`); a fájlrendszer hibájából
 * csak az a kliens hibája, amit a csomag tartalma okoz
 * (`classifyFileSystemWriteError`), minden más (`ENOSPC`, `EACCES`, `EIO`)
 * továbbmegy, és a szerver belső hiba útján `500 internal` lesz, naplózva.
 */
async function writeEntries(
  zipFile: ZipFile,
  entries: readonly ArchiveEntry[],
  prefix: string,
  targetDirectory: string,
  maxUnpackedBytes: number,
): Promise<Outcome<undefined>> {
  // Objektum mező, mert a számlálást a stream visszahívása írja: egy helyi
  // `let` változót a fordító a hívás helyén szűkítené, a lezárásban történt
  // írást nem látná.
  const unpacked = { bytes: 0, isLimitExceeded: false };
  const countBytes = (): Transform =>
    new Transform({
      transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
        unpacked.bytes += chunk.length;
        if (unpacked.bytes > maxUnpackedBytes) {
          unpacked.isLimitExceeded = true;
          callback(new Error('a kicsomagolt összméret túllépte a korlátot'));
          return;
        }
        callback(undefined, chunk);
      },
    });

  for (const archiveEntry of entries) {
    const destination = path.join(targetDirectory, archiveEntry.path.slice(prefix.length));
    try {
      const written = await writeEntry(zipFile, archiveEntry, destination, countBytes);
      if (written.kind === 'error') {
        return written;
      }
    } catch (error) {
      if (unpacked.isLimitExceeded) {
        return skillUploadFailure(
          'skill_archive_too_large',
          `A kicsomagolt tartalom meghaladja a(z) ${String(maxUnpackedBytes)} bájtos korlátot`,
        );
      }
      if (!isFileSystemError(error)) {
        return skillUploadFailure(classifyZipReadError(error), `A(z) "${archiveEntry.path}" bejegyzés nem bontható ki`);
      }
      const errorClass = classifyFileSystemWriteError(error.code);
      if (errorClass === undefined) {
        throw error;
      }
      return skillUploadFailure(errorClass, `A(z) "${archiveEntry.path}" bejegyzés nem írható ki: ${error.code}`);
    }
  }
  return WRITTEN;
}

async function extractOpenedArchive(
  zipFile: ZipFile,
  declaredCentralDirectorySize: number,
  targetDirectory: string,
  skillName: string,
  limits: SkillArchiveLimits,
): Promise<Outcome<SkillManifest>> {
  if (zipFile.entryCount > limits.maxEntryCount) {
    return skillUploadFailure(
      'skill_archive_too_many_entries',
      `A csomag ${String(zipFile.entryCount)} bejegyzést tartalmaz, a korlát ${String(limits.maxEntryCount)}`,
    );
  }

  const planned = await planEntries(zipFile, targetDirectory, declaredCentralDirectorySize);
  if (planned.kind === 'error') {
    return planned;
  }
  const prefix = resolveSkillLayout(planned.value);
  if (prefix.kind === 'error') {
    return prefix;
  }
  const collision = findPathCollision(planned.value);
  if (collision !== undefined) {
    return skillUploadFailure(
      'skill_archive_path_collision',
      `A(z) "${collision}" útvonal többször, vagy csak kis-nagybetűben eltérve szerepel`,
    );
  }

  const written = await writeEntries(zipFile, planned.value, prefix.value, targetDirectory, limits.maxUnpackedBytes);
  if (written.kind === 'error') {
    return written;
  }
  return readSkillManifest(await readFile(path.join(targetDirectory, 'SKILL.md'), 'utf8'), skillName);
}

/**
 * A feltöltött ZIP csomag kicsomagolása egy MÁR LÉTEZŐ, üres cél könyvtárba
 * (SPEC-009 5.4), a `yauzl` 3.4.0-val (O-33): `fromBufferPromise` (a törzs
 * pufferből), lusta bejegyzés olvasás (a Promise API mindig `lazyEntries:
 * true`), `validateEntrySizes: true`, és `decodeStrings: false`, hogy a
 * fájlnév ellenőrzést a saját szabály végezze (a beépített nem váltja ki, 2.
 * pont). Minden elutasítás az egész feltöltést utasítja el, megnevezett
 * osztállyal; a félig kiírt cél könyvtár eltakarítása és az atomi csere a
 * hívó dolga (9. pont). Siker esetén a `SKILL.md` fejlécének adata.
 */
export async function extractSkillArchive(
  archive: Buffer,
  targetDirectory: string,
  skillName: string,
  limits: SkillArchiveLimits,
): Promise<Outcome<SkillManifest>> {
  let zipFile: ZipFile;
  try {
    zipFile = await fromBufferPromise(archive, { decodeStrings: false, validateEntrySizes: true });
  } catch {
    return skillUploadFailure('skill_archive_unreadable', 'A törzs nem nyitható meg ZIP csomagként');
  }
  try {
    return await extractOpenedArchive(
      zipFile,
      readDeclaredCentralDirectorySize(archive),
      targetDirectory,
      skillName,
      limits,
    );
  } finally {
    zipFile.close();
  }
}
