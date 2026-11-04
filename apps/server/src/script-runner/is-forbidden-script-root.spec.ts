import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isForbiddenScriptRoot } from './is-forbidden-script-root.ts';

describe('isForbiddenScriptRoot', () => {
  let directory = '';

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'tiltott-gyoker-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('a /dev és alatta álló gyökér lexikálisan tiltott', async () => {
    await expect(isForbiddenScriptRoot('/dev')).resolves.toBe(true);
    await expect(isForbiddenScriptRoot('/dev/nem-letezik')).resolves.toBe(true);
  });

  it('a /dev könyvtárra mutató szimbolikus link gyökér is tiltott', async () => {
    const link = path.join(directory, 'eszkozok');
    await symlink('/dev', link);
    await expect(isForbiddenScriptRoot(link)).resolves.toBe(true);
  });

  it('a közönséges könyvtár nem tiltott', async () => {
    await expect(isForbiddenScriptRoot(directory)).resolves.toBe(false);
  });

  it('a nem feloldható gyökér (nem létezik, fájl) nem tiltott: a fájl művelet adja a hibát', async () => {
    const file = path.join(directory, 'fajl.txt');
    await writeFile(file, 'x');
    await expect(isForbiddenScriptRoot(path.join(directory, 'nincs'))).resolves.toBe(false);
    await expect(isForbiddenScriptRoot(path.join(file, 'alatta'))).resolves.toBe(false);
  });
});
