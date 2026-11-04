import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readTextInRoot } from './read-text-in-root.ts';

// A tesztek olvasási korlátja: bőven a teszt fájlok fölött.
const MAX_BYTES = 2 ** 20;

// A teszt könyvtárai; a `beforeEach` tölti ki, tesztenként újat.
const fixtureDirectory = { base: '', root: '' };

beforeEach(async () => {
  fixtureDirectory.base = await mkdtemp(path.join(os.tmpdir(), 'read-text-in-root-'));
  fixtureDirectory.root = path.join(fixtureDirectory.base, 'gyoker');
  await mkdir(path.join(fixtureDirectory.root, 'al'), { recursive: true });
  await writeFile(path.join(fixtureDirectory.root, 'al', 'a.txt'), 'árvíztűrő');
  await writeFile(path.join(fixtureDirectory.base, 'kint.txt'), 'titok');
});

afterEach(async () => {
  await rm(fixtureDirectory.base, { recursive: true, force: true });
});

describe('readTextInRoot', () => {
  it('a korlátnál nagyobb fájl elutasított, a pontosan határnyi átmegy (T-015-12)', async () => {
    // Az "árvíztűrő" UTF-8 alakja 13 bájt.
    await expect(readTextInRoot(fixtureDirectory.root, 'al/a.txt', 13)).resolves.toMatchObject({ kind: 'resolved' });
    await expect(readTextInRoot(fixtureDirectory.root, 'al/a.txt', 12)).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl nagyobb, mint a lépés memória korlátja: al/a.txt',
    });
  });

  it('a gyökér alatti fájlt UTF-8 szövegként olvassa', async () => {
    await expect(readTextInRoot(fixtureDirectory.root, 'al/a.txt', MAX_BYTES)).resolves.toStrictEqual({
      kind: 'resolved',
      json: JSON.stringify('árvíztűrő'),
    });
  });

  it('a gyökéren belül maradó szimbolikus linket követi', async () => {
    await symlink(path.join(fixtureDirectory.root, 'al', 'a.txt'), path.join(fixtureDirectory.root, 'belso-link.txt'));
    await expect(readTextInRoot(fixtureDirectory.root, 'belso-link.txt', MAX_BYTES)).resolves.toMatchObject({
      kind: 'resolved',
    });
  });

  it('a .. kivezetést és az abszolút útvonalat elutasítja', async () => {
    await expect(readTextInRoot(fixtureDirectory.root, '../kint.txt', MAX_BYTES)).resolves.toMatchObject({
      kind: 'rejected',
      name: 'Error',
    });
    await expect(
      readTextInRoot(fixtureDirectory.root, path.join(fixtureDirectory.base, 'kint.txt'), MAX_BYTES),
    ).resolves.toMatchObject({
      kind: 'rejected',
      name: 'Error',
    });
  });

  it('a gyökéren kívülre mutató szimbolikus linket elutasítja', async () => {
    await symlink(path.join(fixtureDirectory.base, 'kint.txt'), path.join(fixtureDirectory.root, 'link.txt'));
    await expect(readTextInRoot(fixtureDirectory.root, 'link.txt', MAX_BYTES)).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a hozzáférés gyökerén kívülre mutat: link.txt',
    });
  });

  it('a gyökérre mutató linket (a gyökér mint fájl) elutasítja', async () => {
    await symlink(fixtureDirectory.root, path.join(fixtureDirectory.root, 'onmaga'));
    await expect(readTextInRoot(fixtureDirectory.root, 'onmaga', MAX_BYTES)).resolves.toMatchObject({
      kind: 'rejected',
      name: 'Error',
    });
  });

  it('a hiányzó fájl hibája a kódot és a relatív útvonalat mondja, a gazda gyökerét nem', async () => {
    const outcome = await readTextInRoot(fixtureDirectory.root, 'nincs.txt', MAX_BYTES);
    expect(outcome).toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl művelet nem sikerült (ENOENT): nincs.txt',
    });
  });

  describe('a /proc és a /dev tiltása (user döntés 2026-11-04)', () => {
    it('a / gyökér alatt a dev/zero lexikálisan elutasított, olvasás nélkül', async () => {
      await expect(readTextInRoot('/', 'dev/zero', MAX_BYTES)).resolves.toStrictEqual({
        kind: 'rejected',
        name: 'Error',
        message: 'az útvonal a tiltott /proc vagy /dev könyvtárba mutat: dev/zero',
      });
    });

    it('a /dev könyvtárba feloldódó szimbolikus link útvonala is elutasított', async () => {
      await symlink('/dev', path.join(fixtureDirectory.base, 'eszkozok'));
      const requested = `${path.relative('/', fixtureDirectory.base)}/eszkozok/null`;
      await expect(readTextInRoot('/', requested, MAX_BYTES)).resolves.toStrictEqual({
        kind: 'rejected',
        name: 'Error',
        message: `az útvonal a tiltott /proc vagy /dev könyvtárba mutat: ${requested}`,
      });
    });
  });
});
