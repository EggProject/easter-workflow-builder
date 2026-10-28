import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { readSkillManifest } from './read-skill-manifest.ts';

/**
 * Egy skill könyvtár listaeleme (SPEC-009 5.1, 5.3): a név, a `SKILL.md`
 * frontmatter `description` mezője, a fájlok összmérete és a könyvtár
 * módosítási ideje. A feltöltés ellenőrzött tartalmat ír ide; ha a könyvtárat
 * kívülről elrontották (nincs vagy hibás a `SKILL.md`), a leírás üres szöveg,
 * és a lista nem bukik el egyetlen hibás elem miatt.
 */
export async function summarizeSkillDirectory(directory: string, name: string): Promise<SkillSummary> {
  const manifestPath = path.join(directory, 'SKILL.md');
  const manifest = readSkillManifest(existsSync(manifestPath) ? await readFile(manifestPath, 'utf8') : '', name);
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const fileSizes = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const fileStat = await stat(path.join(entry.parentPath, entry.name));
        return fileStat.size;
      }),
  );
  const directoryStat = await stat(directory);
  return {
    name,
    description: manifest.kind === 'ok' ? manifest.value.description : '',
    sizeBytes: fileSizes.reduce((total, size) => total + size, 0),
    modifiedAtMs: directoryStat.mtimeMs,
  };
}
