import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createListSkillsHandler } from './list-skills.ts';
import { TEST_SKILL_LIBRARY } from './test-skill-library.ts';

const workspace = { root: '' };

beforeEach(async () => {
  workspace.root = await mkdtemp(path.join(tmpdir(), 'skill-list-'));
});

afterEach(async () => {
  await rm(workspace.root, { recursive: true, force: true });
});

async function list(): Promise<unknown> {
  const handler = createListSkillsHandler({ ...TEST_SKILL_LIBRARY, rootDirectory: workspace.root });
  const result = await handler({ parameters: {}, query: new URLSearchParams(), body: undefined });
  return result.kind === 'ok' ? result.value : result;
}

async function addSkill(name: string, description: string): Promise<void> {
  const directory = path.join(workspace.root, 'skills', name);
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'SKILL.md'), `---\ndescription: ${description}\n---\n`);
}

describe('createListSkillsHandler', () => {
  it('amíg nincs skills mappa, üres listát ad', async () => {
    expect(await list()).toStrictEqual({ status: 200, body: [] });
  });

  it('a könyvtárakat név szerint rendezve listázza, a nem könyvtár bejegyzést kihagyja', async () => {
    await addSkill('zeta', 'Z');
    await addSkill('alfa', 'A');
    await addSkill('mid', 'M');
    await writeFile(path.join(workspace.root, 'skills', '.DS_Store'), 'x');

    const result = await list();

    expect(result).toMatchObject({
      status: 200,
      body: [
        { name: 'alfa', description: 'A' },
        { name: 'mid', description: 'M' },
        { name: 'zeta', description: 'Z' },
      ],
    });
  });
});
