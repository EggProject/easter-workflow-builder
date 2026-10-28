import type { Dirent } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { readSkillManifest } from './read-skill-manifest.ts';

// A `SKILL.md` leírása, vagy üres szöveg, ha a fájl hiányzik, nem olvasható (például könyvtár) vagy hibás.
async function readDescription(directory: string, name: string): Promise<string> {
  let content: string;
  try {
    content = await readFile(path.join(directory, 'SKILL.md'), 'utf8');
  } catch {
    return '';
  }
  const manifest = readSkillManifest(content, name);
  return manifest.kind === 'ok' ? manifest.value.description : '';
}

// A szabályos fájlok összmérete; a nem olvasható almappa és a nem stat-olható fájl nem számít.
async function sumFileSizes(directory: string): Promise<number> {
  let entries: readonly Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return 0;
  }
  const sizes = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return sumFileSizes(entryPath);
      }
      if (!entry.isFile()) {
        return 0;
      }
      try {
        const fileStat = await stat(entryPath);
        return fileStat.size;
      } catch {
        return 0;
      }
    }),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

/**
 * Egy skill könyvtár listaeleme (SPEC-009 5.1, 5.3): a név, a `SKILL.md`
 * frontmatter `description` mezője, a fájlok összmérete és a könyvtár
 * módosítási ideje. A feltöltés ellenőrzött tartalmat ír ide; ha a könyvtárat
 * kívülről elrontották (nincs, nem olvasható, könyvtár vagy hibás a
 * `SKILL.md`, nem olvasható almappa), a leírás üres szöveg, a méret az
 * olvasható fájloké, és a lista nem bukik el (PLAN-012 T-012-27, ZIP 5.
 * találat). A szimbolikus link nem számít fájlnak, és nem követett. Csak a
 * könyvtár saját `stat` hívása dob: arra a lista az elemet kihagyja.
 */
export async function summarizeSkillDirectory(directory: string, name: string): Promise<SkillSummary> {
  const directoryStat = await stat(directory);
  const [description, sizeBytes] = await Promise.all([readDescription(directory, name), sumFileSizes(directory)]);
  return { name, description, sizeBytes, modifiedAtMs: directoryStat.mtimeMs };
}
