import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { summarizeSkillDirectory } from './summarize-skill-directory.ts';

const workspace = { directory: '' };

beforeEach(async () => {
  workspace.directory = await mkdtemp(path.join(tmpdir(), 'skill-summary-'));
});

afterEach(async () => {
  await rm(workspace.directory, { recursive: true, force: true });
});

describe('summarizeSkillDirectory', () => {
  it('a description a frontmatterből, a méret az összes fájl összege, alkönyvtárakkal együtt', async () => {
    const manifest = '---\ndescription: PDF kezelés\n---\n';
    await writeFile(path.join(workspace.directory, 'SKILL.md'), manifest);
    await mkdir(path.join(workspace.directory, 'ref', 'mely'), { recursive: true });
    await writeFile(path.join(workspace.directory, 'ref', 'mely', 'a.md'), '12345');

    const summary = await summarizeSkillDirectory(workspace.directory, 'pdf');

    expect(summary).toMatchObject({
      name: 'pdf',
      description: 'PDF kezelés',
      sizeBytes: Buffer.byteLength(manifest) + 5,
    });
    expect(summary.modifiedAtMs).toBeGreaterThan(0);
  });

  it('kívülről elrontott könyvtárnál (nincs SKILL.md, vagy hibás) a leírás üres, a lista nem bukik', async () => {
    const withoutManifest = await summarizeSkillDirectory(workspace.directory, 'pdf');
    await writeFile(path.join(workspace.directory, 'SKILL.md'), '# nincs fejléc');
    const withBrokenManifest = await summarizeSkillDirectory(workspace.directory, 'pdf');
    expect(withoutManifest.description).toBe('');
    expect(withBrokenManifest.description).toBe('');
  });
});
