import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { listInRoot } from './list-in-root.ts';

// A teszt könyvtárai; a `beforeEach` tölti ki, tesztenként újat.
const fixtureDirectory = { base: '', root: '' };

beforeEach(async () => {
  fixtureDirectory.base = await mkdtemp(path.join(os.tmpdir(), 'list-in-root-'));
  fixtureDirectory.root = path.join(fixtureDirectory.base, 'gyoker');
  await mkdir(path.join(fixtureDirectory.root, 'al'), { recursive: true });
  await writeFile(path.join(fixtureDirectory.root, 'a.txt'), 'a');
  await mkdir(path.join(fixtureDirectory.base, 'kint'));
});

afterEach(async () => {
  await rm(fixtureDirectory.base, { recursive: true, force: true });
});

function names(outcome: Awaited<ReturnType<typeof listInRoot>>): unknown {
  if (outcome.kind !== 'resolved' || outcome.json === undefined) {
    throw new Error(`a lista nem teljesült: ${JSON.stringify(outcome)}`);
  }
  const value: unknown = JSON.parse(outcome.json);
  return value;
}

describe('listInRoot', () => {
  it('a gyökér és egy alkönyvtár bejegyzéseinek nevét adja', async () => {
    // A `readdir` sorrendje nem rögzített, ezért a tartalom és a darabszám a vizsgált.
    const rootNames = names(await listInRoot(fixtureDirectory.root, '.'));
    expect(rootNames).toStrictEqual(expect.arrayContaining(['a.txt', 'al']));
    expect(rootNames).toHaveLength(2);
    expect(names(await listInRoot(fixtureDirectory.root, 'al'))).toStrictEqual([]);
  });

  it('a .. kivezetést elutasítja', async () => {
    await expect(listInRoot(fixtureDirectory.root, '..')).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a hozzáférés gyökerén kívülre mutat: ..',
    });
  });

  it('a gyökéren kívülre mutató könyvtár linket elutasítja', async () => {
    await symlink(path.join(fixtureDirectory.base, 'kint'), path.join(fixtureDirectory.root, 'kint-link'));
    await expect(listInRoot(fixtureDirectory.root, 'kint-link')).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a hozzáférés gyökerén kívülre mutat: kint-link',
    });
  });

  it('a nem könyvtár hibája a kódot mondja', async () => {
    await expect(listInRoot(fixtureDirectory.root, 'a.txt')).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl művelet nem sikerült (ENOTDIR): a.txt',
    });
  });
});
