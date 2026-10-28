import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { SkillLibraryPort } from '@easter-workflow-builder/engine';
import { SKILLS_SUBDIRECTORY } from '../skill-endpoint/skills-subdirectory.ts';

/**
 * A motor `skillLibrary` portjának valódi implementációja (SPEC-009 5.1) a
 * skill könyvtár abszolút gyökere felett.
 *
 * **A plugin neve a gyökér könyvtárának neve**, mert a szerver nem ír
 * `.claude-plugin/plugin.json` manifesztet, és manifeszt nélkül a CLI a plugin
 * gyökér könyvtárnevét használja (M-136 4a, 4b,
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció 2. pont).
 * Ez az egyetlen hely, ahol a név előáll.
 *
 * A skillek a `<gyökér>/skills/` mappa könyvtárai (a más fájlok nem), név
 * szerint rendezve, ugyanazzal a szabállyal, mint a `GET /api/skills`. Amíg
 * nincs feltöltött skill (a mappa nem létezik), a lista üres. A könyvtárat
 * minden hívás újraolvassa, mert a feltöltés és a törlés a szerver futása
 * közben változtatja.
 */
export function createSkillLibraryReader(rootDirectory: string): SkillLibraryPort {
  const pluginName = path.basename(rootDirectory);
  const skillsDirectory = path.join(rootDirectory, SKILLS_SUBDIRECTORY);
  return {
    readSkillLibrary: () => {
      const entries = existsSync(skillsDirectory) ? readdirSync(skillsDirectory, { withFileTypes: true }) : [];
      const skillNames = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .toSorted((left, right) => Number(left > right) - Number(left < right));
      return { rootDirectory, pluginName, skillNames };
    },
  };
}
