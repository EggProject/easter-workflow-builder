import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeTextInRoot } from './write-text-in-root.ts';

// A teszt könyvtárai; a `beforeEach` tölti ki, tesztenként újat.
const fixtureDirectory = { base: '', root: '' };

beforeEach(async () => {
  fixtureDirectory.base = await mkdtemp(path.join(os.tmpdir(), 'write-text-in-root-'));
  fixtureDirectory.root = path.join(fixtureDirectory.base, 'gyoker');
  await mkdir(path.join(fixtureDirectory.root, 'al'), { recursive: true });
  await mkdir(path.join(fixtureDirectory.base, 'kint'));
  await writeFile(path.join(fixtureDirectory.base, 'kint', 'meglevo.txt'), 'eredeti');
});

afterEach(async () => {
  await rm(fixtureDirectory.base, { recursive: true, force: true });
});

describe('writeTextInRoot', () => {
  it('új fájlt ír a gyökér alá, és létezőt felülír', async () => {
    await expect(writeTextInRoot(fixtureDirectory.root, 'al/uj.txt', 'első')).resolves.toStrictEqual({
      kind: 'resolved',
      json: undefined,
    });
    await expect(readFile(path.join(fixtureDirectory.root, 'al', 'uj.txt'), 'utf8')).resolves.toBe('első');
    await expect(writeTextInRoot(fixtureDirectory.root, 'al/uj.txt', 'második')).resolves.toMatchObject({
      kind: 'resolved',
    });
    await expect(readFile(path.join(fixtureDirectory.root, 'al', 'uj.txt'), 'utf8')).resolves.toBe('második');
  });

  it('a .. kivezetést elutasítja, és nem ír', async () => {
    await expect(writeTextInRoot(fixtureDirectory.root, '../kint/uj.txt', 'x')).resolves.toMatchObject({
      kind: 'rejected',
    });
    await expect(readFile(path.join(fixtureDirectory.base, 'kint', 'uj.txt'), 'utf8')).rejects.toHaveProperty(
      'code',
      'ENOENT',
    );
  });

  it('a gyökéren kívülre mutató szülő könyvtár linken át nem ír', async () => {
    await symlink(path.join(fixtureDirectory.base, 'kint'), path.join(fixtureDirectory.root, 'kint-link'));
    await expect(writeTextInRoot(fixtureDirectory.root, 'kint-link/uj.txt', 'x')).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'az útvonal a hozzáférés gyökerén kívülre mutat: kint-link/uj.txt',
    });
    await expect(readFile(path.join(fixtureDirectory.base, 'kint', 'uj.txt'), 'utf8')).rejects.toHaveProperty(
      'code',
      'ENOENT',
    );
  });

  it('a gyökéren kívüli létező fájlra mutató linken át nem ír', async () => {
    await symlink(
      path.join(fixtureDirectory.base, 'kint', 'meglevo.txt'),
      path.join(fixtureDirectory.root, 'link.txt'),
    );
    await expect(writeTextInRoot(fixtureDirectory.root, 'link.txt', 'x')).resolves.toMatchObject({
      kind: 'rejected',
      name: 'Error',
    });
    await expect(readFile(path.join(fixtureDirectory.base, 'kint', 'meglevo.txt'), 'utf8')).resolves.toBe('eredeti');
  });

  it('a gyökéren kívüli nem létező célra mutató (függő) linken át nem hoz létre fájlt', async () => {
    await symlink(path.join(fixtureDirectory.base, 'kint', 'uj.txt'), path.join(fixtureDirectory.root, 'fuggo.txt'));
    await expect(writeTextInRoot(fixtureDirectory.root, 'fuggo.txt', 'x')).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl művelet nem sikerült (EEXIST): fuggo.txt',
    });
    await expect(readFile(path.join(fixtureDirectory.base, 'kint', 'uj.txt'), 'utf8')).rejects.toHaveProperty(
      'code',
      'ENOENT',
    );
  });

  it('a nem könyvtár szülő hibája a kódot mondja', async () => {
    await writeFile(path.join(fixtureDirectory.root, 'fajl.txt'), 'x');
    await expect(writeTextInRoot(fixtureDirectory.root, 'fajl.txt/al.txt', 'x')).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'Error',
      message: 'a fájl művelet nem sikerült (ENOTDIR): fajl.txt/al.txt',
    });
  });

  it('a nem szöveg tartalmat és a nem szöveg útvonalat TypeError-ral utasítja el', async () => {
    await expect(writeTextInRoot(fixtureDirectory.root, 'a.txt', 1)).resolves.toStrictEqual({
      kind: 'rejected',
      name: 'TypeError',
      message: 'a beírandó tartalom szöveg kell legyen',
    });
    await expect(writeTextInRoot(fixtureDirectory.root, undefined, 'x')).resolves.toMatchObject({
      kind: 'rejected',
      name: 'TypeError',
    });
  });

  describe('a /proc és a /dev tiltása (user döntés 2026-11-04)', () => {
    it('a / gyökér alatt a dev/null lexikálisan elutasított, írás nélkül', async () => {
      await expect(writeTextInRoot('/', 'dev/null', 'x')).resolves.toStrictEqual({
        kind: 'rejected',
        name: 'Error',
        message: 'az útvonal a tiltott /proc vagy /dev könyvtárba mutat: dev/null',
      });
    });

    it('a /dev alatti létező célra és a /dev alatti új fájlra feloldódó link is elutasított', async () => {
      const base = await mkdtemp(path.join(os.tmpdir(), 'write-text-in-root-tiltott-'));
      try {
        await symlink('/dev', path.join(base, 'eszkozok'));
        const existing = `${path.relative('/', base)}/eszkozok/null`;
        const created = `${path.relative('/', base)}/eszkozok/nem-letezo-uj-fajl`;
        await expect(writeTextInRoot('/', existing, 'x')).resolves.toStrictEqual({
          kind: 'rejected',
          name: 'Error',
          message: `az útvonal a tiltott /proc vagy /dev könyvtárba mutat: ${existing}`,
        });
        await expect(writeTextInRoot('/', created, 'x')).resolves.toStrictEqual({
          kind: 'rejected',
          name: 'Error',
          message: `az útvonal a tiltott /proc vagy /dev könyvtárba mutat: ${created}`,
        });
      } finally {
        await rm(base, { recursive: true, force: true });
      }
    });
  });
});
