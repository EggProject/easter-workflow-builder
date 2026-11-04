import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Outcome } from '@easter-workflow-builder/core';
import { SkillNameSchema } from '@easter-workflow-builder/protocol';
import type { BinaryRouteHandler } from '../route-dispatch/binary-route-handler.ts';
import type { RouteHandlerResult } from '../route-dispatch/route-handler.ts';
import { extractSkillArchive } from './extract-skill-archive.ts';
import { replaceSkillDirectory } from './replace-skill-directory.ts';
import type { SkillLibrary } from './skill-library.ts';
import type { SkillNameLock } from './skill-name-lock.ts';
import { SKILLS_SUBDIRECTORY } from './skills-subdirectory.ts';
import { skillUploadFailure } from './skill-upload-failure.ts';
import { STAGING_PREFIX } from './staging-prefix.ts';
import { summarizeSkillDirectory } from './summarize-skill-directory.ts';

/**
 * A kicsomagolás egy saját ideiglenes mappába megy (párhuzamosan is, mert a
 * mappák függetlenek), a csere és a listaelem összeállítása viszont a név
 * zárján fut, hogy két feltöltés vagy egy feltöltés és egy törlés ugyanarra a
 * névre ne mozgassa el egymás könyvtárát (PLAN-012 T-012-27, ZIP 1. találat).
 * Az ideiglenes mappa és a csere `previous` mappája minden kimenetel után
 * törlődik; a folyamat leállása után maradt példányokat az indulási takarítás
 * viszi el (`removeStagingLeftovers`).
 */
async function installSkill(
  library: SkillLibrary,
  lock: SkillNameLock,
  name: string,
  archive: Buffer,
): Promise<Outcome<RouteHandlerResult>> {
  await mkdir(path.join(library.rootDirectory, SKILLS_SUBDIRECTORY), { recursive: true });
  const staging = await mkdtemp(path.join(library.rootDirectory, STAGING_PREFIX));
  const previous = `${staging}-${randomUUID()}`;
  try {
    const extracted = await extractSkillArchive(archive, staging, name, library.limits);
    if (extracted.kind === 'error') {
      return extracted;
    }
    const destination = path.join(library.rootDirectory, SKILLS_SUBDIRECTORY, name);
    return await lock.run(name, async () => {
      await replaceSkillDirectory(staging, destination, previous);
      return { kind: 'ok', value: { status: 200, body: await summarizeSkillDirectory(destination, name) } };
    });
  } finally {
    await rm(staging, { recursive: true, force: true });
    await rm(previous, { recursive: true, force: true });
  }
}

/**
 * `PUT /api/skills/:name` (SPEC-009 5.1, 5.4, O-36): nyers `application/zip`
 * törzs, a skill neve az útvonal paramétere (O-12). A név a törzs olvasása
 * előtt dől el (`accept`); a törzset a `http-server` legfeljebb
 * `maxArchiveBytes` bájtig olvassa (5.4 6. pont). A kicsomagolás a gyökér egy
 * ideiglenes mappájába megy, és csak minden ellenőrzés után kerül a
 * `skills/<név>` helyre, felülíráskor a régi teljes cseréjével (9. pont).
 * Sikerre `200` a skill listaelemével (`SkillSummary`); az azonos nevű skill
 * felülírása a felület megerősítése után ugyanez a hívás (O-16).
 */
export function createUploadSkillHandler(library: SkillLibrary, lock: SkillNameLock): BinaryRouteHandler {
  return {
    maxBodyBytes: library.limits.maxArchiveBytes,
    accept: (parameters) => {
      const name = parameters['name'] ?? '';
      if (!SkillNameSchema.safeParse(name).success) {
        return skillUploadFailure('skill_name_invalid', `A(z) "${name}" skill név nem felel meg a névszabálynak`);
      }
      return {
        kind: 'ok',
        value: (body) =>
          body.kind === 'too_large'
            ? Promise.resolve(
                skillUploadFailure(
                  'skill_archive_too_large',
                  `A feltöltött csomag meghaladja a(z) ${String(library.limits.maxArchiveBytes)} bájtos korlátot`,
                ),
              )
            : installSkill(library, lock, name, body.bytes),
      };
    },
  };
}
