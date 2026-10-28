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
 * A process env változójából átvezetett követelmény, több elfogadott bemeneti névvel (SPEC-013
 * 4.4): a `name` a kimenő név és az első helyen olvasott bemeneti név, utána az
 * `alternativeNames` csökkenő elsőbbséggel. A feloldás az első beállított nevet veszi, a kimenő
 * környezetbe mindig a `name` kerül.
 */
interface AlternativePassthroughEnvironmentRequirement extends EnvironmentRequirementBase {
  readonly source: 'process_env_alternatives';
  readonly alternativeNames: readonly [string, ...string[]];
}

/**
 * Env követelmény, a `source` mezőn diszkriminálva. Az ágak **nem ugyanazokat
 * a mezőket** hordozza: a `literalValue` kizárólag a `literal` ágon létezik, és
 * ott kötelező. Így a feloldó oldalon (`packages/engine`
 * `resolveRequiredEnvironmentValue`) nem keletkezik olyan ág, ami hiányzó
 * literál értéket kezelne - az a `.claude/CLAUDE.md` 5. szekciója szerint
 * tiltott, mert típusilag sosem futna, és a 100 százalékos lefedettségi
 * küszöböt sem lehetne teljesíteni rá.
 */
export type EnvironmentRequirement =
  LiteralEnvironmentRequirement | PassthroughEnvironmentRequirement | AlternativePassthroughEnvironmentRequirement;
