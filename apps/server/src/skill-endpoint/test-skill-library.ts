import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SkillLibrary } from './skill-library.ts';

/**
 * Skill könyvtár azoknak a teszteknek, amelyek a teljes kezelő rekordot
 * felépítik (`buildRouteHandlers`), de skill végpontot nem hívnak: a gyökér
 * nem létező útvonal az ideiglenes könyvtárban, a korlátok a SPEC-009 5.4 6.
 * pont alapértékei. Kizárólag tesztek használják.
 */
export const TEST_SKILL_LIBRARY: SkillLibrary = {
  rootDirectory: path.join(tmpdir(), 'easter-skill-konyvtar-nem-hasznalt'),
  limits: { maxArchiveBytes: 30_000_000, maxUnpackedBytes: 30_000_000, maxEntryCount: 1024 },
};
