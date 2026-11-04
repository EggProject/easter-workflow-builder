import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createSkillLibraryReader } from './create-skill-library-reader.ts';

const createdDirectories: string[] = [];

function temporaryRoot(): string {
  const parent = mkdtempSync(path.join(tmpdir(), 'skill-olvaso-'));
  createdDirectories.push(parent);
  const root = path.join(parent, 'easter-skillek');
  mkdirSync(root);
  return root;
}

afterEach(() => {
  for (const directory of createdDirectories) {
    rmSync(directory, { recursive: true, force: true });
  }
  createdDirectories.length = 0;
});

describe('createSkillLibraryReader', () => {
  it('a plugin neve a gyökér könyvtárneve, a skill nevek a skills mappa könyvtárai név szerint rendezve', () => {
    const root = temporaryRoot();
    for (const name of ['gamma', 'alfa', 'beta']) {
      mkdirSync(path.join(root, 'skills', name), { recursive: true });
    }
    writeFileSync(path.join(root, 'skills', '.DS_Store'), '');
    mkdirSync(path.join(root, '.staging-1'));

    expect(createSkillLibraryReader(root).readSkillLibrary()).toStrictEqual({
      rootDirectory: root,
      pluginName: 'easter-skillek',
      skillNames: ['alfa', 'beta', 'gamma'],
    });
  });

  it('a skills mappa hiányában üres listát ad', () => {
    const root = temporaryRoot();

    expect(createSkillLibraryReader(root).readSkillLibrary().skillNames).toStrictEqual([]);
  });

  it('minden hívás az aktuális állapotot olvassa', () => {
    const root = temporaryRoot();
    const reader = createSkillLibraryReader(root);
    const before = reader.readSkillLibrary().skillNames;
    mkdirSync(path.join(root, 'skills', 'uj'), { recursive: true });

    expect(before).toStrictEqual([]);
    expect(reader.readSkillLibrary().skillNames).toStrictEqual(['uj']);
  });
});
