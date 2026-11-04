import type { SkillArchiveLimits } from './skill-archive-limits.ts';

/**
 * A skill könyvtár szerver oldali leírása (SPEC-009 5.1): a gyökér abszolút
 * útvonala (egy plugin gyökér, a skillek a `<gyökér>/skills/<név>/` alatt) és
 * a feltöltés korlátai. Az `EASTER_SKILL_LIBRARY_DIRECTORY` és a három korlát
 * env változóból áll elő (`server-config`). Típus-only fájl.
 */
export interface SkillLibrary {
  readonly rootDirectory: string;
  readonly limits: SkillArchiveLimits;
}
