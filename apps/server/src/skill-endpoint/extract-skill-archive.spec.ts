import { chmod, mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import { buildTestZipArchive, type TestZipEntry } from './build-test-zip-archive.ts';
import { extractSkillArchive } from './extract-skill-archive.ts';
import type { SkillManifest } from './read-skill-manifest.ts';
import type { SkillArchiveLimits } from './skill-archive-limits.ts';
import { testZipDirectoryEntry } from './test-zip-directory-entry.ts';
import { testZipFileEntry } from './test-zip-file-entry.ts';
import { withZip64EndRecord } from './with-zip64-end-record.ts';

// A SPEC-009 5.4 6. pont alapértékei (O-34), hogy a határ tesztek a valódi számokon fussanak.
const LIMITS: SkillArchiveLimits = { maxArchiveBytes: 30_000_000, maxUnpackedBytes: 30_000_000, maxEntryCount: 1024 };
const SKILL_NAME = 'pdf-tools';
const MANIFEST = '---\nname: pdf-tools\ndescription: PDF fájlok kezelése\n---\n# PDF\n';
const UNIX_MODE_FACTOR = 0x1_00_00;
const createdDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(createdDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
  createdDirectories.length = 0;
});

// Minden kicsomagolás friss, üres cél könyvtárat kap (a kicsomagoló ezt várja el).
async function extractInto(
  archive: Buffer,
): Promise<{ readonly outcome: Outcome<SkillManifest>; readonly directory: string }> {
  const directory = await mkdtemp(path.join(tmpdir(), 'skill-extract-'));
  createdDirectories.push(directory);
  return { outcome: await extractSkillArchive(archive, directory, SKILL_NAME, LIMITS), directory };
}

function errorClassOf(outcome: Outcome<SkillManifest>): string | undefined {
  return outcome.kind === 'error'
    ? /\((?<errorClass>[a-z_]+)\)\.$/u.exec(outcome.message)?.groups?.['errorClass']
    : 'ok';
}

async function rejectionOf(entries: readonly TestZipEntry[]): Promise<string | undefined> {
  const { outcome } = await extractInto(buildTestZipArchive(entries));
  return errorClassOf(outcome);
}

function manifestEntry(prefix = ''): TestZipEntry {
  return testZipFileEntry(`${prefix}SKILL.md`, MANIFEST);
}

function entriesOfCount(count: number): TestZipEntry[] {
  return [
    manifestEntry(),
    ...Array.from({ length: count - 1 }, (_, index) => testZipFileEntry(`f/${String(index)}.txt`, '')),
  ];
}

function padding(size: number): TestZipEntry {
  return testZipFileEntry('padding.bin', Buffer.alloc(size));
}

describe('extractSkillArchive: sikeres kicsomagolás', () => {
  it('a gyökérben álló SKILL.md mellett mindent a cél könyvtárba bont, a description értékét adja', async () => {
    const { outcome, directory } = await extractInto(
      buildTestZipArchive([
        manifestEntry(),
        testZipDirectoryEntry('scripts/'),
        testZipFileEntry('scripts/run.sh', 'echo hi', { compressionMethod: 0 }),
        testZipFileEntry('references/deep/a.md', 'mélyen'),
      ]),
    );

    expect(outcome).toStrictEqual({ kind: 'ok', value: { description: 'PDF fájlok kezelése' } });
    expect(await readFile(path.join(directory, 'SKILL.md'), 'utf8')).toBe(MANIFEST);
    expect(await readFile(path.join(directory, 'scripts', 'run.sh'), 'utf8')).toBe('echo hi');
    expect(await readFile(path.join(directory, 'references', 'deep', 'a.md'), 'utf8')).toBe('mélyen');
  });

  it('egyetlen legfelső mappát (a mappa bejegyzésével) lecsíp, a tartalom a cél gyökerébe kerül', async () => {
    const { outcome, directory } = await extractInto(
      buildTestZipArchive([
        testZipDirectoryEntry('valami-mas-nev/'),
        manifestEntry('valami-mas-nev/'),
        testZipFileEntry('valami-mas-nev/ref/b.md', 'b'),
      ]),
    );

    expect(outcome.kind).toBe('ok');
    const names = await readdir(directory);
    expect(new Set(names)).toStrictEqual(new Set(['SKILL.md', 'ref']));
    expect(await readFile(path.join(directory, 'ref', 'b.md'), 'utf8')).toBe('b');
  });

  it('a zip Unix módja nem érvényesül: a futtatható bitekkel csomagolt fájl sem futtatható (5.4 8. pont)', async () => {
    const executable = testZipFileEntry('x.sh', 'x', { externalFileAttributes: 0o10_0777 * UNIX_MODE_FACTOR });
    const { directory } = await extractInto(buildTestZipArchive([manifestEntry(), executable]));
    const { mode } = await stat(path.join(directory, 'x.sh'));
    expect((mode % 0o1000) & 0o111).toBe(0);
  });

  it('nem Unix gazdán készült csomagot a nevek alapján bont ki', async () => {
    const dosEntry = { versionMadeBy: 0x14, externalFileAttributes: 0x20 };
    expect(await rejectionOf([testZipFileEntry('SKILL.md', MANIFEST, dosEntry)])).toBe('ok');
  });
});

describe('extractSkillArchive: elutasítások (SPEC-009 5.4 tábla)', () => {
  it('a nem zip törzs nem olvasható csomag', async () => {
    const { outcome } = await extractInto(Buffer.from('nem zip'));
    expect(errorClassOf(outcome)).toBe('skill_archive_unreadable');
  });

  it.each([['../kint.txt'], ['/abszolut.txt'], ['C:/meghajto.txt'], ['a/../b.txt'], ['a\0b.txt'], ['./a.txt']])(
    'a(z) %j útvonal tiltott',
    async (entryPath) => {
      expect(await rejectionOf([manifestEntry(), testZipFileEntry(entryPath, 'x')])).toBe('skill_archive_unsafe_path');
    },
  );

  it('a visszaper tiltott (a strictFileNames megfelelője: nem cserélődik /-re)', async () => {
    const backslash = testZipFileEntry('x', 'x', { name: Buffer.from(String.raw`a\b.txt`, 'latin1') });
    expect(await rejectionOf([manifestEntry(), backslash])).toBe('skill_archive_unsafe_path');
  });

  it('a szimbolikus link nem támogatott bejegyzés', async () => {
    const link = testZipFileEntry('link', '/etc/passwd', { externalFileAttributes: 0o12_0777 * UNIX_MODE_FACTOR });
    expect(await rejectionOf([manifestEntry(), link])).toBe('skill_archive_entry_type_unsupported');
  });

  it('a titkosított (hagyományos) bejegyzés elutasítva', async () => {
    // A hagyományos titkosítás 12 bájtos fejlécet tesz az adat elé (a yauzl tárolt méret ellenőrzése).
    const encrypted = testZipFileEntry('titok.txt', Buffer.alloc(13), {
      compressionMethod: 0,
      generalPurposeBitFlag: 0x1,
      declaredUncompressedSize: 1,
    });
    expect(await rejectionOf([manifestEntry(), encrypted])).toBe('skill_archive_entry_encrypted');
  });

  it('az erős titkosítás jelzője is titkosított bejegyzés', async () => {
    const strong = testZipFileEntry('titok.txt', 'x', { generalPurposeBitFlag: 0x41 });
    expect(await rejectionOf([manifestEntry(), strong])).toBe('skill_archive_entry_encrypted');
  });

  it('a nem támogatott tömörítési módszer (bzip2, 12) elutasítva', async () => {
    expect(await rejectionOf([manifestEntry(), testZipFileEntry('a.bz2', 'x', { compressionMethod: 12 })])).toBe(
      'skill_archive_compression_unsupported',
    );
  });

  it('két legfelső mappa SKILL.md nélkül: hibás elrendezés', async () => {
    expect(await rejectionOf([manifestEntry('a/'), testZipFileEntry('b/x.md', 'x')])).toBe(
      'skill_archive_layout_invalid',
    );
  });

  it('egy mappa SKILL.md nélkül: hiányzó SKILL.md', async () => {
    expect(await rejectionOf([testZipFileEntry('a/readme.md', 'x')])).toBe('skill_manifest_missing');
  });

  it('két SKILL.md a gyökérben: többszörös SKILL.md', async () => {
    expect(await rejectionOf([manifestEntry(), manifestEntry()])).toBe('skill_manifest_duplicate');
  });

  it('két, csak kis-nagybetűben eltérő útvonal ütközik', async () => {
    expect(await rejectionOf([manifestEntry(), testZipFileEntry('a.md', 'x'), testZipFileEntry('A.md', 'y')])).toBe(
      'skill_archive_path_collision',
    );
  });

  it('a tárolt bejegyzés hazudó mérete a központi könyvtár olvasásakor bukik', async () => {
    const lying = testZipFileEntry('a.txt', 'abc', { compressionMethod: 0, declaredUncompressedSize: 2 });
    expect(await rejectionOf([manifestEntry(), lying])).toBe('skill_archive_entry_size_mismatch');
  });

  it.each([
    ['kevesebbet', 2],
    ['többet', 9],
  ])('a deflate bejegyzés a ténylegesnél %s deklarál: sérült bejegyzés', async (_label, declared) => {
    const lying = testZipFileEntry('a.txt', 'abcde', { declaredUncompressedSize: declared });
    expect(await rejectionOf([manifestEntry(), lying])).toBe('skill_archive_entry_size_mismatch');
  });

  it('a sérült helyi fejléc nem olvasható csomag', async () => {
    const archive = buildTestZipArchive([manifestEntry()]);
    archive.writeUInt32LE(0, 0);
    const { outcome } = await extractInto(archive);
    expect(errorClassOf(outcome)).toBe('skill_archive_unreadable');
  });

  it('a hibás fejlécű SKILL.md a kibontás után dől el', async () => {
    expect(await rejectionOf([testZipFileEntry('SKILL.md', '# nincs fejléc\n')])).toBe('skill_manifest_invalid');
  });

  it('a megadottól eltérő frontmatter name a kibontás után dől el (O-37)', async () => {
    expect(await rejectionOf([testZipFileEntry('SKILL.md', '---\nname: mas\ndescription: x\n---\n')])).toBe(
      'skill_name_mismatch',
    );
  });
});

describe('extractSkillArchive: korlátok a határon és eggyel fölötte (O-34)', () => {
  it('1024 bejegyzés elfogadott, 1025 elutasítva', async () => {
    expect(await rejectionOf(entriesOfCount(1024))).toBe('ok');
    expect(await rejectionOf(entriesOfCount(1025))).toBe('skill_archive_too_many_entries');
  });

  it('a pontosan 30 000 000 bájt kicsomagolt összméret elfogadott, eggyel több elutasítva', async () => {
    const atLimit = LIMITS.maxUnpackedBytes - Buffer.byteLength(MANIFEST);

    expect(await rejectionOf([manifestEntry(), padding(atLimit)])).toBe('ok');
    expect(await rejectionOf([manifestEntry(), padding(atLimit + 1)])).toBe('skill_archive_too_large');
  });
});

// A záró rekord (APPNOTE 4.3.16) két bejegyzésszám mezőjének felülírása: a csomag kevesebbet deklarál, mint amennyi áll benne.
function withDeclaredEntryCount(archive: Buffer, count: number): Buffer {
  const patched = Buffer.from(archive);
  patched.writeUInt16LE(count, patched.length - 22 + 8);
  patched.writeUInt16LE(count, patched.length - 22 + 10);
  return patched;
}

// A `index`-edik helyi fejléc (APPNOTE 4.3.7) általános célú jelzőjének 0. bitje, a központi könyvtár érintése nélkül.
function withLocalHeaderEncryptionBit(archive: Buffer, index: number): Buffer {
  const patched = Buffer.from(archive);
  const signature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  let offset = -1;
  for (let seen = 0; seen <= index; seen += 1) {
    offset = patched.indexOf(signature, offset + 1);
  }
  patched.writeUInt16LE(patched.readUInt16LE(offset + 6) | 0x1, offset + 6);
  return patched;
}

const LONG_SEGMENT_LENGTH = 300;

describe('extractSkillArchive: az adverzariális átvizsgálás ZIP találatai (PLAN-012 T-012-27)', () => {
  it('2. két, csak Unicode normalizálásban eltérő útvonal skill_archive_path_collision', async () => {
    const composed = testZipFileEntry('caf\u{E9}.md', 'a');
    const decomposed = testZipFileEntry('cafe\u{301}.md', 'b');
    expect(await rejectionOf([manifestEntry(), composed, decomposed])).toBe('skill_archive_path_collision');
  });

  it('3. a túl hosszú nevű könyvtár bejegyzés nem kezeletlen kivétel, hanem skill_archive_unreadable (O-50 addig)', async () => {
    const longDirectory = testZipDirectoryEntry(`${'k'.repeat(LONG_SEGMENT_LENGTH)}/`);
    expect(await rejectionOf([manifestEntry(), longDirectory])).toBe('skill_archive_unreadable');
  });

  it('3. a túl hosszú nevű fájl és a túl hosszú nevű szülő könyvtár skill_archive_unreadable (O-50 addig)', async () => {
    const longFile = testZipFileEntry(`${'f'.repeat(LONG_SEGMENT_LENGTH)}.md`, 'x');
    const longParent = testZipFileEntry(`${'s'.repeat(LONG_SEGMENT_LENGTH)}/a.md`, 'x');
    expect(await rejectionOf([manifestEntry(), longFile])).toBe('skill_archive_unreadable');
    expect(await rejectionOf([manifestEntry(), longParent])).toBe('skill_archive_unreadable');
  });

  // A futtató nem root felhasználó (a `chmod` root alatt nem tiltana).
  it('3. a szerver oldali fájlrendszer hiba (EACCES) nem álcázódik kliens hibának, hanem továbbmegy', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'skill-extract-'));
    createdDirectories.push(directory);
    const fileFirst = buildTestZipArchive([manifestEntry()]);
    const directoryFirst = buildTestZipArchive([testZipDirectoryEntry('d/'), manifestEntry()]);
    await chmod(directory, 0o500);
    try {
      await expect(extractSkillArchive(fileFirst, directory, SKILL_NAME, LIMITS)).rejects.toMatchObject({
        code: 'EACCES',
      });
      await expect(extractSkillArchive(directoryFirst, directory, SKILL_NAME, LIMITS)).rejects.toMatchObject({
        code: 'EACCES',
        syscall: 'mkdir',
      });
    } finally {
      await chmod(directory, 0o700);
    }
  });

  it('6. a záró rekordban alulhazudott bejegyzésszám skill_archive_unreadable, nem csendes kihagyás', async () => {
    const archive = buildTestZipArchive([manifestEntry(), testZipFileEntry('rejtett.md', 'x')]);
    const { outcome, directory } = await extractInto(withDeclaredEntryCount(archive, 1));
    expect(errorClassOf(outcome)).toBe('skill_archive_unreadable');
    expect(await readdir(directory)).toStrictEqual([]);
  });

  it('6. a ZIP64 záró rekordos csomag kicsomagolódik, a ZIP64 rekord hazudott méretére skill_archive_unreadable', async () => {
    const archive = buildTestZipArchive([manifestEntry(), testZipFileEntry('a.md', 'a')]);
    const honest = await extractInto(withZip64EndRecord(archive));
    const lying = await extractInto(withZip64EndRecord(archive, 46));
    expect(errorClassOf(honest.outcome)).toBe('ok');
    expect(errorClassOf(lying.outcome)).toBe('skill_archive_unreadable');
  });

  it('7. az adatot hordozó könyvtár bejegyzés skill_archive_entry_type_unsupported', async () => {
    const directoryWithData: TestZipEntry = {
      ...testZipDirectoryEntry('d/'),
      data: Buffer.from('payload'),
      declaredUncompressedSize: 7,
    };
    expect(await rejectionOf([manifestEntry(), directoryWithData])).toBe('skill_archive_entry_type_unsupported');
  });

  it('7. a csak a helyi fejlécben titkosítottat jelző fájl skill_archive_entry_encrypted', async () => {
    const archive = buildTestZipArchive([
      testZipFileEntry('SKILL.md', MANIFEST, { compressionMethod: 0 }),
      testZipFileEntry('titok.bin', 'x', { compressionMethod: 0 }),
    ]);
    const { outcome } = await extractInto(withLocalHeaderEncryptionBit(archive, 1));
    expect(errorClassOf(outcome)).toBe('skill_archive_entry_encrypted');
  });
});
