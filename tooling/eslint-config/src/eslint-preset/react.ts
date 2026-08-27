/**
 * React reteg az `apps/web` es a `packages/ui` csomagoknak (SPEC-001 7. szekcio).
 *
 * Egyetlen lazitas: a unicorn `filename-case` szabaly alapertelmezese
 * kebab-case fajlneveket var, a React komponens fajlok viszont PascalCase
 * konvenciot kovetik. A plugin dokumentacioja pontosan erre az esetre ad
 * mintat ("For React projects, allow both kebab-case and PascalCase").
 * Forras: https://github.com/sindresorhus/eslint-plugin-unicorn/blob/v73.0.0/docs/rules/filename-case.md
 */
import type { Linter } from 'eslint';

export const react: Linter.Config[] = [
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    rules: {
      'unicorn/filename-case': ['error', { cases: { kebabCase: true, pascalCase: true } }],
    },
  },
];
