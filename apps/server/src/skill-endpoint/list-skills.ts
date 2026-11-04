import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import type { SkillLibrary } from './skill-library.ts';
import { SKILLS_SUBDIRECTORY } from './skills-subdirectory.ts';
import { summarizeSkillDirectory } from './summarize-skill-directory.ts';

/**
 * `GET /api/skills` (SPEC-009 5.1): a skill könyvtár elemei név szerint
 * rendezve (UTF-16 kódegység sorrend, mert a nevek a névszabály miatt ASCII
 * karakterek). A `skills` mappán belül csak a könyvtárak számítanak skillnek,
 * a más fájlok (például egy operációs rendszer által írt rejtett fájl) nem.
 * Amíg nincs feltöltött skill (a mappa nem létezik), a lista üres. Az elemek
 * hibatűrők (PLAN-012 T-012-27, ZIP 5. találat): egy kívülről elrontott skill
 * könyvtár üres leírással jelenik meg, a meg sem nyitható (`stat` hiba) kimarad,
 * és egyik sem buktatja a teljes listát.
 */
export function createListSkillsHandler(library: SkillLibrary): RouteHandler {
  return async () => {
    const skillsDirectory = path.join(library.rootDirectory, SKILLS_SUBDIRECTORY);
    const entries = existsSync(skillsDirectory) ? await readdir(skillsDirectory, { withFileTypes: true }) : [];
    const settled = await Promise.allSettled(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => summarizeSkillDirectory(path.join(skillsDirectory, entry.name), entry.name)),
    );
    const summaries = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    const sorted = summaries.toSorted((left, right) => Number(left.name > right.name) - Number(left.name < right.name));
    return { kind: 'ok', value: { status: 200, body: sorted } };
  };
}
