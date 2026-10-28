import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

  // A futtató nem root felhasználó (root alatt a jogosultság nem tiltana).
  it('egy kívülről elrontott elem nem buktatja a listát (ZIP 5. találat): olvashatatlan SKILL.md, SKILL.md könyvtár, olvashatatlan almappa, alias bomba', async () => {
    await addSkill('jo', 'J');
    await addSkill('olvashatatlan', 'O');
    await addSkill('almappa', 'A');
    await mkdir(path.join(workspace.root, 'skills', 'konyvtar-manifeszt', 'SKILL.md'), { recursive: true });
    await mkdir(path.join(workspace.root, 'skills', 'bomba'), { recursive: true });
    await writeFile(
      path.join(workspace.root, 'skills', 'bomba', 'SKILL.md'),
      '---\na: &a [x, x, x, x, x, x, x, x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b]\nd: &d [*c, *c, *c, *c, *c, *c, *c, *c, *c]\ndescription: B\n---\n',
    );
    const unreadableManifest = path.join(workspace.root, 'skills', 'olvashatatlan', 'SKILL.md');
    const unreadableDirectory = path.join(workspace.root, 'skills', 'almappa', 'zart');
    await mkdir(unreadableDirectory);
    await chmod(unreadableManifest, 0o000);
    await chmod(unreadableDirectory, 0o000);
    try {
      expect(await list()).toMatchObject({
        status: 200,
        body: [
          { name: 'almappa', description: 'A' },
          { name: 'bomba', description: '' },
          { name: 'jo', description: 'J' },
          { name: 'konyvtar-manifeszt', description: '' },
          { name: 'olvashatatlan', description: '' },
        ],
      });
    } finally {
      await chmod(unreadableDirectory, 0o700);
      await chmod(unreadableManifest, 0o600);
    }
  });

  it('a meg sem nyitható elem (a skills mappa nem bejárható) kimarad, a lista nem bukik', async () => {
    await addSkill('jo', 'J');
    const skillsDirectory = path.join(workspace.root, 'skills');
    await chmod(skillsDirectory, 0o400);
    try {
      expect(await list()).toStrictEqual({ status: 200, body: [] });
    } finally {
      await chmod(skillsDirectory, 0o700);
    }
  });
});
