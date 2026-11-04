import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';

/**
 * A tárolt skill hivatkozás (SPEC-009 5.3) kimenő `<plugin>:<név>` listája,
 * a lépés és az agent definíció `skills` mezőjének közös szabálya: a tárolt
 * puszta név a plugin névvel minősítve, mert a puszta név egy azonos nevű CLI
 * beépített skillt is engedélyezne (M-136 6a), illetve az agent definícióban
 * a beépítettet tölti be (M-147 A8); a tárolt `'all'` a könyvtár aktuális
 * neveinek explicit listája, mert az SDK `'all'` értéke a beépítetteket is
 * engedélyezné (M-136 2c, 4a; research
 * `2026-10-28-spec-009-blokkolo-meresek.md` 2. és 5. szekció).
 */
export function qualifySkillNames(skills: readonly string[] | 'all', library: SkillLibrarySnapshot): readonly string[] {
  const names = skills === 'all' ? library.skillNames : skills;
  return names.map((name) => `${library.pluginName}:${name}`);
}
