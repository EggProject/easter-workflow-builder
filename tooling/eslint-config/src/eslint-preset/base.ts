/**
 * Alap ESLint szabalykeszlet minden konyvtarcsomagnak (SPEC-001 7. szekcio).
 *
 * A tseslint.configs.strictTypeChecked/stylisticTypeChecked tomb alaku
 * exportok, ezert szetterítve (`...`) kerulnek be. A unicorn, import-x es
 * sonarjs `recommended` exportjai egyetlen config objektumok (ellenorizve a
 * csomagok .d.ts fajljaiban), ezert szetteritas nelkul, kozvetlenul.
 *
 * A Prettier-tiltas (eslint-config-prettier/flat) NEM itt van: annak a
 * vegleges config tomb UTOLSO elemenek kell lennie, ezt a gyoker
 * eslint.config.ts adja hozza, a react/relaxed/test retegek utan.
 *
 * A `languageOptions.parserOptions.tsconfigRootDir` sem itt van, mert ez a
 * fajl nem a repo gyokeren el - a gyoker eslint.config.ts allitja be, ahol
 * az `import.meta.dirname` helyesen a repo gyokerere mutat.
 */
import { configs as tseslintConfigs } from 'typescript-eslint';
import unicorn from 'eslint-plugin-unicorn';
import { importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { configs as sonarjsConfigs } from 'eslint-plugin-sonarjs';

// Nincs explicit `Linter.Config[]` annotacio: a plugin exportok (tseslint,
// unicorn, import-x, sonarjs) sajat, egymastol elutero segedtipusokat
// hasznalnak (pl. `CompatibleConfig`), amik nem egyesithetok gond nelkul egy
// szigoru `Linter.Config` alaku tombbe - ellenorizve `tsc --noEmit`-tel.
// A kovetkeztetett tipus hasznalata pontosabb, mint egy nem illeszkedo
// explicit annotacio.
export const base = [
  ...tseslintConfigs.strictTypeChecked,
  ...tseslintConfigs.stylisticTypeChecked,
  unicorn.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  sonarjsConfigs.recommended,
  {
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
    },
    rules: {
      // --- CLAUDE.md: tilos az `any` ---
      // A strictTypeChecked preset mar hozza ezeket, de a CLAUDE.md konkret
      // elvarasa, hogy ne fuggjunk attol, hogy egy preset tartalma verzioval
      // valtozik - ezert explicit is felsoroljuk oket.
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: false, fixToUnknown: false }],
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-member-access': ['error', { allowOptionalChaining: false }],
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-function-type': 'error',
      '@typescript-eslint/no-unsafe-declaration-merging': 'error',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',

      // --- CLAUDE.md: tilos az `as` tipuskenyszerites, helyette `satisfies` ---
      // Az `as const` NEM tilos: a typescript-eslint doksi szerint a const
      // assertion mindig megengedett ez ala a szabaly ala, fuggetlenul az
      // assertionStyle ertektol.
      // Forras: https://typescript-eslint.io/rules/consistent-type-assertions/
      // ("const assertions are always allowed by this rule")
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/no-unsafe-type-assertion': 'error',

      // --- CLAUDE.md: valodi privat mezo a `private` kulcsszo helyett ---
      // A user altal megadott, szo szerint hasznalando konfiguracio
      // (SPEC-001 7. szekcio).
      'no-restricted-syntax': [
        'error',
        {
          selector: "PropertyDefinition[accessibility='private']",
          message: "Use native ECMAScript private fields (e.g., #field) instead of the TypeScript 'private' modifier.",
        },
        {
          selector: "MethodDefinition[accessibility='private']",
          message:
            "Use native ECMAScript private methods (e.g., #method) instead of the TypeScript 'private' modifier.",
        },
        {
          selector: "TSParameterProperty[accessibility='private']",
          message:
            "Do not use 'private' in constructor parameter properties. Define a native private field (#field) and assign the value manually.",
        },
      ],

      // --- egyeb, a CLAUDE.md-bol kovetkezo szabalyok ---
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-extraneous-dependencies': 'error',
      // A kuszobot a plugin dokumentalt alapertelmezesen hagyjuk. A CLAUDE.md
      // tiltja a forras nelkuli szamertek rogzitest, ezert sajat kuszobot
      // nem allitunk.
      'sonarjs/cognitive-complexity': 'error',
    },
  },
];
