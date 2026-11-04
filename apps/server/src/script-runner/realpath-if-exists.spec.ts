import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { realpathIfExists } from './realpath-if-exists.ts';

// A teszt könyvtára; a `beforeEach` tölti ki, tesztenként újat.
const fixtureDirectory = { base: '' };

beforeEach(async () => {
  const created = await mkdtemp(path.join(os.tmpdir(), 'realpath-if-exists-'));
  fixtureDirectory.base = await realpath(created);
});

afterEach(async () => {
  await rm(fixtureDirectory.base, { recursive: true, force: true });
});

describe('realpathIfExists', () => {
  it('a létező útvonal feloldott alakját adja, a szimbolikus linket követve', async () => {
    await writeFile(path.join(fixtureDirectory.base, 'cel.txt'), 'x');
    await symlink(path.join(fixtureDirectory.base, 'cel.txt'), path.join(fixtureDirectory.base, 'link.txt'));
    await expect(realpathIfExists(path.join(fixtureDirectory.base, 'link.txt'))).resolves.toBe(
      path.join(fixtureDirectory.base, 'cel.txt'),
    );
  });

  it('a nem létező útvonalra és a függő linkre undefined', async () => {
    await expect(realpathIfExists(path.join(fixtureDirectory.base, 'nincs.txt'))).resolves.toBeUndefined();
    await symlink(path.join(fixtureDirectory.base, 'nincs.txt'), path.join(fixtureDirectory.base, 'fuggo.txt'));
    await expect(realpathIfExists(path.join(fixtureDirectory.base, 'fuggo.txt'))).resolves.toBeUndefined();
  });

  it('más hibát továbbad', async () => {
    await writeFile(path.join(fixtureDirectory.base, 'fajl.txt'), 'x');
    await expect(realpathIfExists(path.join(fixtureDirectory.base, 'fajl.txt', 'al'))).rejects.toHaveProperty(
      'code',
      'ENOTDIR',
    );
  });
});
