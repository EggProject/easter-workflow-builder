import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDeleteSkillHandler } from './delete-skill.ts';
import { createSkillNameLock } from './skill-name-lock.ts';
import { TEST_SKILL_LIBRARY } from './test-skill-library.ts';

const workspace = { root: '' };

beforeEach(async () => {
  workspace.root = await mkdtemp(path.join(tmpdir(), 'skill-delete-'));
});

afterEach(async () => {
  await rm(workspace.root, { recursive: true, force: true });
});

function remove(parameters: Readonly<Record<string, string>>) {
  const handler = createDeleteSkillHandler(
    { ...TEST_SKILL_LIBRARY, rootDirectory: workspace.root },
    createSkillNameLock(),
  );
  return handler({ parameters, query: new URLSearchParams(), body: undefined });
}

describe('createDeleteSkillHandler', () => {
  it('a skill könyvtárát teljesen eltávolítja, 204 üres törzzsel', async () => {
    const directory = path.join(workspace.root, 'skills', 'jelentes');
    await mkdir(path.join(directory, 'ref'), { recursive: true });
    await writeFile(path.join(directory, 'ref', 'a.md'), 'x');

    expect(await remove({ name: 'jelentes' })).toStrictEqual({ kind: 'ok', value: { status: 204, body: undefined } });
    expect(existsSync(directory)).toBe(false);
  });

  it('nem létező skillre not_found', async () => {
    expect(await remove({ name: 'nincs' })).toStrictEqual({
      kind: 'error',
      message: 'A(z) "nincs" skill nem létezik (not_found).',
    });
  });

  it.each([{ name: 'Rossz_Nev' }, {}])(
    'a névszabálynak meg nem felelő névre (%j) skill_name_invalid, törlés nélkül',
    async (parameters) => {
      const outcome = await remove(parameters);
      expect(outcome.kind === 'error' && outcome.message).toMatch(/\(skill_name_invalid\)\.$/u);
    },
  );
});
