import type { SkillLibrarySnapshot } from './skill-library-snapshot.ts';

/**
 * A skill könyvtár port (SPEC-009 5.1): a motor a skill könyvtár tartalmát
 * ezen át kapja, mert a portjain kívül nem érhet a fájlrendszerhez (ugyanaz
 * az elv, mint a `processEnvironment` portnál). Kizárólag olvasásra; az
 * `apps/server` köti be az `EASTER_SKILL_LIBRARY_DIRECTORY` könyvtárra.
 *
 * Minden hívás az aktuális állapotot adja: a futás indítási ellenőrzése
 * (`validateSkillReferences`) és a lépés `Options` összeállítása
 * (`buildAgentStepOptions`) egyaránt hívja, mert a könyvtár a szerver
 * futása közben változhat (feltöltés, törlés).
 */
export interface SkillLibraryPort {
  readSkillLibrary(): SkillLibrarySnapshot;
}
