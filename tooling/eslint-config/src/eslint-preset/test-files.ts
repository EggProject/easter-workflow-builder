/**
 * Tesztfajlokra vonatkozo lazitas (SPEC-001 7. szekcio, "Fajlmintak" tablazat).
 *
 * A `sonarjs/no-duplicate-string` a teszt adatok szandekos ismetleset
 * (pl. ugyanaz a bemeneti string tobb `it()` blokkban) helytelenul jelezne,
 * ezert tesztfajlokban kikapcsolt.
 */
import type { Linter } from 'eslint';

export const testFiles: Linter.Config[] = [
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
    },
  },
];
