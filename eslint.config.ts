// Gyoker ESLint 10 flat config (SPEC-001 7. szekcio). A tenyleges
// szabalyreteget a `tooling/eslint-config` csomag adja, ez a fajl csak
// osszeallitja oket es beallitja a repo-specifikus (gyoker-relativ) reszeket:
// a `tsconfigRootDir`-t es a globalis ignore listat.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import prettierConfig from 'eslint-config-prettier/flat';
import { base, react, relaxed, testFiles } from '@easter-workflow-builder/eslint-config';
import type { Linter } from 'eslint';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

const config: Linter.Config[] = [
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.turbo/**',
      'tools/wire-probe/artifacts/**',
      'tools/wire-probe/node_modules/**',
    ],
  },
  ...base,
  ...react,
  ...relaxed,
  ...testFiles,
  {
    // A typescript-eslint `projectService` a legkozelebbi tsconfig.json-t
    // keresi minden linteit fajlhoz, ami tobb tsconfigos monoreponal a
    // ajanlott mod a statikus `project` tomb helyett.
    // Forras: https://typescript-eslint.io/packages/parser/#projectservice
    //
    // Az `allowDefaultProject` kell a `*.config.ts` fajloknak (pl.
    // vitest.config.ts, ez az eslint.config.ts) es a proba fajloknak: ezek a
    // csomag `src/**/*.ts` include mintajan kivul elnek, tehat semelyik
    // tsconfig.json nem fedi oket, es projectService nelkul parse hibat
    // adnanak ("was not found by the project service"). Ellenorizve:
    // sajat proba fajllal, live futtatassal.
    languageOptions: {
      parserOptions: {
        // A glob nem tartalmazhat `**`-ot, a typescript-eslint ezt tul
        // tagnak es teljesitmeny-kockazatnak tekinti (elo teszttel
        // igazolva). A `*.config.ts` a csomag GYOKERENEL levo config
        // fajlokat fedi, ami a bevett elhelyezes (vitest.config.ts,
        // playwright.config.ts stb.).
        projectService: {
          allowDefaultProject: ['*.config.ts', '*/*/*.config.ts'],
        },
        tsconfigRootDir: rootDirectory,
      },
    },
  },
  // Mindig utolso elem: kikapcsolja a Prettierrel utkozo formazasi
  // szabalyokat (SPEC-001 8. szekcio).
  prettierConfig,
];

export default config;
