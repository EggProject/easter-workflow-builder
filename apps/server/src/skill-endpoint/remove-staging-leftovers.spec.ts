import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { removeStagingLeftovers } from './remove-staging-leftovers.ts';

const workspace = { root: '' };

beforeEach(async () => {
  workspace.root = await mkdtemp(path.join(tmpdir(), 'skill-staging-'));
});

afterEach(async () => {
  await rm(workspace.root, { recursive: true, force: true });
});

describe('removeStagingLeftovers', () => {
  it('a gyökér .staging-* mappáit törli, a skills mappát és a más neveket nem', async () => {
    await mkdir(path.join(workspace.root, '.staging-abc', 'ref'), { recursive: true });
    await writeFile(path.join(workspace.root, '.staging-abc', 'ref', 'a.md'), 'x');
    await mkdir(path.join(workspace.root, '.staging-abc-0f6e', 'regi'), { recursive: true });
    await mkdir(path.join(workspace.root, 'skills', 'jelentes'), { recursive: true });
    await writeFile(path.join(workspace.root, 'jegyzet.txt'), 'x');

    await removeStagingLeftovers(workspace.root);

    expect(new Set(await readdir(workspace.root))).toStrictEqual(new Set(['jegyzet.txt', 'skills']));
    expect(existsSync(path.join(workspace.root, 'skills', 'jelentes'))).toBe(true);
  });

  it('nem létező gyökérre nincs teendő', async () => {
    const missing = path.join(workspace.root, 'nincs');
    await removeStagingLeftovers(missing);
    expect(existsSync(missing)).toBe(false);
  });
});
