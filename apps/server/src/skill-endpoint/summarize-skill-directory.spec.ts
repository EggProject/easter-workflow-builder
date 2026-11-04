import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { summarizeSkillDirectory } from './summarize-skill-directory.ts';

const workspace = { directory: '' };

beforeEach(async () => {
  workspace.directory = await mkdtemp(path.join(tmpdir(), 'skill-summary-'));
});

afterEach(async () => {
  await rm(workspace.directory, { recursive: true, force: true });
});

describe('summarizeSkillDirectory', () => {
  it('a description a frontmatterből, a méret az összes fájl összege, alkönyvtárakkal együtt', async () => {
    const manifest = '---\ndescription: PDF kezelés\n---\n';
    await writeFile(path.join(workspace.directory, 'SKILL.md'), manifest);
    await mkdir(path.join(workspace.directory, 'ref', 'mely'), { recursive: true });
    await writeFile(path.join(workspace.directory, 'ref', 'mely', 'a.md'), '12345');

    const summary = await summarizeSkillDirectory(workspace.directory, 'jelentes');

    expect(summary).toMatchObject({
      name: 'jelentes',
      description: 'PDF kezelés',
      sizeBytes: Buffer.byteLength(manifest) + 5,
    });
    expect(summary.modifiedAtMs).toBeGreaterThan(0);
  });

  it('kívülről elrontott könyvtárnál (nincs SKILL.md, vagy hibás) a leírás üres, a lista nem bukik', async () => {
    const withoutManifest = await summarizeSkillDirectory(workspace.directory, 'jelentes');
    await writeFile(path.join(workspace.directory, 'SKILL.md'), '# nincs fejléc');
    const withBrokenManifest = await summarizeSkillDirectory(workspace.directory, 'jelentes');
    expect(withoutManifest.description).toBe('');
    expect(withBrokenManifest.description).toBe('');
  });
});

// A `chmod` tesztek nem root futtatót feltételeznek (root alatt a jogosultság nem tiltana).
describe('summarizeSkillDirectory: kívülről elrontott könyvtár (ZIP 5. találat)', () => {
  const manifest = '---\ndescription: ok\n---\n';

  it('a SKILL.md helyén álló könyvtárra üres leírás, a méret a valódi fájloké', async () => {
    await mkdir(path.join(workspace.directory, 'SKILL.md'));
    await writeFile(path.join(workspace.directory, 'a.md'), '123');
    expect(await summarizeSkillDirectory(workspace.directory, 'jelentes')).toMatchObject({
      description: '',
      sizeBytes: 3,
    });
  });

  it('a nem olvasható SKILL.md üres leírás, a nem olvasható almappa nem számít a méretbe', async () => {
    const manifestPath = path.join(workspace.directory, 'SKILL.md');
    const hidden = path.join(workspace.directory, 'rejtett');
    await writeFile(manifestPath, manifest);
    await mkdir(hidden);
    await writeFile(path.join(hidden, 'b.md'), '12345');
    await chmod(manifestPath, 0o000);
    await chmod(hidden, 0o000);
    try {
      expect(await summarizeSkillDirectory(workspace.directory, 'jelentes')).toMatchObject({
        description: '',
        sizeBytes: Buffer.byteLength(manifest),
      });
    } finally {
      await chmod(hidden, 0o700);
      await chmod(manifestPath, 0o600);
    }
  });

  it('a stat-olhatatlan fájl (olvasható, de nem bejárható mappában) nem számít, a szimbolikus link sem', async () => {
    const listable = path.join(workspace.directory, 'csak-olvashato');
    await writeFile(path.join(workspace.directory, 'SKILL.md'), manifest);
    await mkdir(listable);
    await writeFile(path.join(listable, 'c.md'), '1234567');
    await symlink('..', path.join(workspace.directory, 'hurok'));
    await chmod(listable, 0o400);
    try {
      expect(await summarizeSkillDirectory(workspace.directory, 'jelentes')).toMatchObject({
        description: 'ok',
        sizeBytes: Buffer.byteLength(manifest),
      });
    } finally {
      await chmod(listable, 0o700);
    }
  });

  it('a tárolt alias bombára üres leírás, kivétel nélkül', async () => {
    const bomb =
      '---\na: &a [x, x, x, x, x, x, x, x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]\nd: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]\ndescription: ok\n---\n';
    await writeFile(path.join(workspace.directory, 'SKILL.md'), bomb);
    const summary = await summarizeSkillDirectory(workspace.directory, 'jelentes');
    expect(summary.description).toBe('');
  });
});
