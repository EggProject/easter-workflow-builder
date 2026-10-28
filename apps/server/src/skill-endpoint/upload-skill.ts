import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { SkillNameSchema } from '@easter-workflow-builder/protocol';
import type { BinaryRouteHandler } from '../route-dispatch/binary-route-handler.ts';
import { extractSkillArchive } from './extract-skill-archive.ts';
import { replaceSkillDirectory } from './replace-skill-directory.ts';
import type { SkillLibrary } from './skill-library.ts';
import { SKILLS_SUBDIRECTORY } from './skills-subdirectory.ts';
import { skillUploadFailure } from './skill-upload-failure.ts';
import { summarizeSkillDirectory } from './summarize-skill-directory.ts';

// A kicsomagolás ideiglenes mappáinak előtagja a gyökérben, a `skills` mappán kívül, hogy a lista ne lássa őket.
const STAGING_PREFIX = '.staging-';

/**
 * `PUT /api/skills/:name` (SPEC-009 5.1, 5.4, O-36): nyers `application/zip`
 * törzs, a skill neve az útvonal paramétere (O-12). A törzset a `http-server`
 * legfeljebb `maxArchiveBytes` bájtig olvassa (5.4 6. pont). A kicsomagolás a
 * gyökér egy ideiglenes mappájába megy, és csak minden ellenőrzés után kerül a
 * `skills/<név>` helyre, felülíráskor a régi teljes cseréjével (9. pont); az
 * ideiglenes mappa minden kimenetel után törlődik. Sikerre `200` a skill
 * listaelemével (`SkillSummary`); az azonos nevű skill felülírása a felület
 * megerősítése után ugyanez a hívás (O-16).
 */
export function createUploadSkillHandler(library: SkillLibrary): BinaryRouteHandler {
  return {
    maxBodyBytes: library.limits.maxArchiveBytes,
    handle: async ({ parameters, body }) => {
      const name = parameters['name'] ?? '';
      if (!SkillNameSchema.safeParse(name).success) {
        return skillUploadFailure('skill_name_invalid', `A(z) "${name}" skill név nem felel meg a névszabálynak`);
      }
      if (body.kind === 'too_large') {
        return skillUploadFailure(
          'skill_archive_too_large',
          `A feltöltött csomag meghaladja a(z) ${String(library.limits.maxArchiveBytes)} bájtos korlátot`,
        );
      }

      await mkdir(path.join(library.rootDirectory, SKILLS_SUBDIRECTORY), { recursive: true });
      const staging = await mkdtemp(path.join(library.rootDirectory, STAGING_PREFIX));
      try {
        const extracted = await extractSkillArchive(body.bytes, staging, name, library.limits);
        if (extracted.kind === 'error') {
          return extracted;
        }
        const destination = path.join(library.rootDirectory, SKILLS_SUBDIRECTORY, name);
        await replaceSkillDirectory(staging, destination, `${staging}-${randomUUID()}`);
        return { kind: 'ok', value: { status: 200, body: await summarizeSkillDirectory(destination, name) } };
      } finally {
        await rm(staging, { recursive: true, force: true });
      }
    },
  };
}
