import type { EvidenceList } from '../evidence/evidence-reference/evidence-list.ts';

/**
 * Minden env követelmény közös mezői. Nem exportált: a csomag felülete az
 * `EnvironmentRequirement` unió, a két ág külön-külön nem használható.
 */
interface EnvironmentRequirementBase {
  readonly name: string;
  readonly secret: boolean;
  readonly purpose: string;
  readonly evidence: EvidenceList;
}

/**
 * Rögzített értékű env követelmény: az érték magában a leíróban áll, ezért a
 * `literalValue` **kötelező**. A DB soha nem tárol titkot, de itt nincs is
 * mit: a literál érték a leíró része, nem a felhasználó környezetéé.
 */
interface LiteralEnvironmentRequirement extends EnvironmentRequirementBase {
  readonly source: 'literal';
  readonly literalValue: string;
}

/**
 * A process env változójából átvezetett követelmény: a leíró csak a **nevet**
 * ismeri, az értéket futásidőben a process env adja. `secret: true` esetén ez
 * az egyetlen megengedett forrás, mert a titok sosem kerül a leíróba.
 */
interface PassthroughEnvironmentRequirement extends EnvironmentRequirementBase {
  readonly source: 'process_env_passthrough';
}

/**
 * Env követelmény, a `source` mezőn diszkriminálva. A két ág **nem ugyanazokat
 * a mezőket** hordozza: a `literalValue` kizárólag a `literal` ágon létezik, és
 * ott kötelező. Így a feloldó oldalon (`packages/engine`
 * `resolveRequiredEnvironmentValue`) nem keletkezik olyan ág, ami hiányzó
 * literál értéket kezelne - az a `.claude/CLAUDE.md` 5. szekciója szerint
 * tiltott, mert típusilag sosem futna, és a 100 százalékos lefedettségi
 * küszöböt sem lehetne teljesíteni rá.
 */
export type EnvironmentRequirement = LiteralEnvironmentRequirement | PassthroughEnvironmentRequirement;
