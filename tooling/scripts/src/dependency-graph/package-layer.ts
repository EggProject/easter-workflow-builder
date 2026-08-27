/**
 * A workspace csomagok réteg-hozzárendelése, a SPEC-002 4. szekció
 * "Rétegbesorolás, mind a 32 csomagra" táblázata szerint
 * (`docs/spec/SPEC-002-csomag-architektura.md`). A számok nem sorszámok: egy
 * csomag csak nála szigorúan KISEBB számú rétegből függhet, azonos rétegen
 * belüli él tilos. Az "eszköz" csomagoknak (`'tool'`) nincs rétegszámuk, ők
 * kizárólag `devDependencies` helyen jelenhetnek meg bármely termékcsomagban.
 *
 * Egy újonnan felvett workspace csomagnak KÖTELEZŐ itt szerepelnie: ha a
 * `readWorkspacePackages` talál egy `package.json`-t, aminek a neve nincs
 * ebben a térképben, a `findDependencyGraphViolations` "hiányzó
 * réteg-hozzárendelés" hibát ad, nem hagyja csendben át - ez a mechanizmus
 * zárja ki, hogy egy új csomag felvétele elfelejtődjön (T-002-24).
 */
export type PackageLayer = 0 | 1 | 2 | 3 | 4 | 5 | 'tool';

export const PACKAGE_LAYER: Readonly<Record<string, PackageLayer>> = {
  // L0
  typeguards: 0,
  'mcp-tool-kit': 0,
  core: 0,
  logger: 0,
  // L1
  'provider-capability': 1,
  protocol: 1,
  // L2
  'minimax-client': 2,
  'firecrawl-client': 2,
  'provider-minimax': 2,
  'provider-claude-subscription': 2,
  db: 2,
  ui: 2,
  // L3
  'tool-minimax-web-search': 3,
  'tool-firecrawl-web-fetch': 3,
  'tool-minimax-understand-image': 3,
  'provider-registry': 3,
  // L4
  'agent-tool-bundle': 4,
  agent: 4,
  engine: 4,
  // L5
  server: 5,
  web: 5,
  // eszköz csomagok, réteg nélkül
  'eslint-config': 'tool',
  tsconfig: 'tool',
  scripts: 'tool',
  'wire-probe': 'tool',
};
