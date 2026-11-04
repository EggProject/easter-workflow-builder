/**
 * A skill könyvtár pillanatnyi állapota a motor szemével (SPEC-009 5.1, 5.3):
 * a plugin gyökér útvonala (a `plugins` opció `path` mezője), a plugin neve (a
 * kimenő `<plugin>:<név>` skill nevek előtagja) és a feltöltött skillek puszta
 * nevei (a `<gyökér>/skills/<név>/` könyvtárnevek). Típus-only fájl.
 *
 * A plugin nevét a szerver adja, mert az a gyökér elrendezéséből következik:
 * manifeszt nélkül a gyökér könyvtárának neve (M-136 4a, 4b,
 * `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció 2. pont).
 */
export interface SkillLibrarySnapshot {
  readonly rootDirectory: string;
  readonly pluginName: string;
  readonly skillNames: readonly string[];
}
