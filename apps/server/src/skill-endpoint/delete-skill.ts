import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { SkillNameSchema } from '@easter-workflow-builder/protocol';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import type { SkillLibrary } from './skill-library.ts';
import type { SkillNameLock } from './skill-name-lock.ts';
import { SKILLS_SUBDIRECTORY } from './skills-subdirectory.ts';
import { skillUploadFailure } from './skill-upload-failure.ts';

/**
 * `DELETE /api/skills/:name` (SPEC-009 5.1, 5.4 10. pont): a skill
 * könyvtárát teljesen eltávolítja, sikerre `204`, üres törzzsel. A név a
 * feltöltés névszabályán megy át, tehát útvonal elemet nem tartalmazhat, és a
 * törlés nem léphet ki a gyökérből. A törlés a feltöltés cseréjével azonos
 * név záron fut (PLAN-012 T-012-27, ZIP 1. találat). Hivatkozott skill
 * törlése is megengedett (O-13): a futás indítása a hiányzó skillre
 * `skill_not_found` hibát ad (T-012-9).
 */
export function createDeleteSkillHandler(library: SkillLibrary, lock: SkillNameLock): RouteHandler {
  return async (context) => {
    const name = context.parameters['name'] ?? '';
    if (!SkillNameSchema.safeParse(name).success) {
      return skillUploadFailure('skill_name_invalid', `A(z) "${name}" skill név nem felel meg a névszabálynak`);
    }
    const directory = path.join(library.rootDirectory, SKILLS_SUBDIRECTORY, name);
    return lock.run(name, async () => {
      if (!existsSync(directory)) {
        return { kind: 'error', message: `A(z) "${name}" skill nem létezik (not_found).` };
      }
      await rm(directory, { recursive: true, force: true });
      return { kind: 'ok', value: { status: 204, body: undefined } };
    });
  };
}
