/**
 * Lazitott reteg a `tools/wire-probe` meroeszkoznek, a `tooling/**`
 * eszkozcsomagoknak es a `*.config.ts` fajloknak (SPEC-001 7. szekcio,
 * "Fajlmintak" tablazat). Csak ott lazit, ahol a szigoru szabaly
 * indokolatlanul akadalyozna - minden lazitas kommentben indokolt.
 *
 * A CLAUDE.md kritikus szabalyai (`no-explicit-any`, `consistent-type-assertions`,
 * a `private` tiltas stb.) itt NEM lazulnak, azok a `base` reteg reszekent
 * mindenhol ervenyben maradnak.
 */
import { configs as tseslintConfigs } from 'typescript-eslint';

// Nincs explicit `Linter.Config[]` annotacio, ugyanazert az okert mint a
// base.ts-ben: a tseslint `disableTypeChecked` sajat segedtipusa nem
// illeszkedik szigoruan az `eslint` csomag `Linter.Config` tipusahoz.
export const relaxed = [
  {
    // A tooling/** eszkozcsomagok es a tools/wire-probe meroeszkoz sajat
    // devDependencies-kent hasznalt csomagokat (pl. typescript) importalnak
    // futasidoben is (pl. `tsc --noEmit` inditasa), ez szandekos, nem
    // termek fuggoseg felcserelese.
    files: ['tooling/**/*.ts', 'tools/wire-probe/**/*.ts'],
    rules: {
      'import-x/no-extraneous-dependencies': ['error', { devDependencies: true }],
    },
  },
  {
    // A *.config.ts fajlok (vitest.config.ts, eslint.config.ts stb.) a
    // csomag sajat `src/**/*.ts` tsconfig include-jan kivul elnek, ezert a
    // projectService a typescript-eslint dokumentalt `allowDefaultProject`
    // tartalek projektjevel futtatja oket (gyoker eslint.config.ts). Ennek
    // nincs valodi tipusinformacioja, ezert a tipus-fuggo szabalyok (pl.
    // no-unsafe-assignment) hamis pozitivat adnanak barmilyen Node beepitett
    // modul hasznalataert. A hivatalos megoldas a `disableTypeChecked`
    // config, elo teszttel igazolva (ellenorzes nelkul: 6 hamis hiba).
    // Forras: https://typescript-eslint.io/users/configs/#disabletypechecked
    // (a `disableTypeChecked` a `rules` es a `languageOptions` mezoket adja,
    // ide szettoritve, mert az `extends` kulcsot csak a `defineConfig`
    // segedfuggveny ertelmezi, mi viszont sima tombot exportalunk).
    files: ['*.config.ts', '*/*/*.config.ts'],
    ...tseslintConfigs.disableTypeChecked,
  },
];
