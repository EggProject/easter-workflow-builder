import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { replaceSkillDirectory, type DirectoryReplaceOperations } from './replace-skill-directory.ts';

const workspace = { root: '' };

beforeEach(async () => {
  workspace.root = await mkdtemp(path.join(tmpdir(), 'skill-replace-'));
});

afterEach(async () => {
  await rm(workspace.root, { recursive: true, force: true });
});

async function directoryWith(name: string, content: string): Promise<string> {
  const directory = path.join(workspace.root, name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), content);
  return directory;
}

// A második átnevezés (az új a helyére) hibázik; minden más a valódi fájlrendszeren fut.
function failingSecondRename(): DirectoryReplaceOperations {
  let calls = 0;
  return {
    rename: async (from, to) => {
      calls += 1;
      if (calls === 2) {
        throw new Error('szimulált átnevezési hiba');
      }
      const { rename } = await import('node:fs/promises');
      await rename(from, to);
    },
    remove: (target) => rm(target, { recursive: true, force: true }),
  };
}

describe('replaceSkillDirectory', () => {
  it('új skillnél az ideiglenes könyvtár a helyére kerül', async () => {
    const source = await directoryWith('staging', 'új');
    const destination = path.join(workspace.root, 'skills', 'pdf');
    await mkdir(path.dirname(destination), { recursive: true });

    await replaceSkillDirectory(source, destination, path.join(workspace.root, 'previous'));

    expect(await readFile(path.join(destination, 'SKILL.md'), 'utf8')).toBe('új');
    expect(new Set(await readdir(workspace.root))).toStrictEqual(new Set(['skills']));
  });

  it('felülíráskor a régi teljesen kicserélődik, a félrerakott régi törlődik', async () => {
    const destination = await directoryWith('skills/pdf', 'régi');
    await writeFile(path.join(destination, 'csak-a-reginel.txt'), 'x');
    const source = await directoryWith('staging', 'új');

    await replaceSkillDirectory(source, destination, path.join(workspace.root, 'previous'));

    expect(await readdir(destination)).toStrictEqual(['SKILL.md']);
    expect(await readFile(path.join(destination, 'SKILL.md'), 'utf8')).toBe('új');
    expect(new Set(await readdir(workspace.root))).toStrictEqual(new Set(['skills']));
  });

  it('ha az új nem kerülhet a helyére, a régi skill érintetlenül visszakerül, és a hiba továbbmegy (5.4 9. pont)', async () => {
    const destination = await directoryWith('skills/pdf', 'régi');
    const source = await directoryWith('staging', 'új');

    await expect(
      replaceSkillDirectory(source, destination, path.join(workspace.root, 'previous'), failingSecondRename()),
    ).rejects.toThrow('szimulált átnevezési hiba');

    expect(await readFile(path.join(destination, 'SKILL.md'), 'utf8')).toBe('régi');
  });

  it('új skillnél a sikertelen átnevezés hibája továbbmegy, régi nincs, amit visszaállítana', async () => {
    const source = await directoryWith('staging', 'új');
    const operations: DirectoryReplaceOperations = {
      rename: () => Promise.reject(new Error('első hiba')),
      remove: () => Promise.resolve(),
    };

    await expect(
      replaceSkillDirectory(source, path.join(workspace.root, 'skills', 'pdf'), 'nem-hasznalt', operations),
    ).rejects.toThrow('első hiba');
  });
});
