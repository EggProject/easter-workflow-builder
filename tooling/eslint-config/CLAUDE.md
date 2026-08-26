# tooling/eslint-config

## Mi ez a mappa

A megosztott ESLint flat config szabálykészlete (SPEC-001 7. szekció, verzió: lásd
`docs/research/2026-08-26-toolchain.md`). Négy réteget
exportál (`base`, `react`, `relaxed`, `testFiles`), ezeket a gyökér `eslint.config.ts`
állítja össze egyetlen konfigurációvá. Ide **nem** tartozik a Prettier-tiltás
(`eslint-config-prettier/flat`) beillesztése: annak a végleges tömb utolsó elemének kell
lennie, ezt a gyökér `eslint.config.ts` adja hozzá, mert a react/relaxed/test rétegek
ez után jönnek a tömbben.

## Fájlok

| Fájl                | Tartalom                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`      | barrel, csak újraexport                                                                                                                                                                           |
| `src/base.ts`       | minden könyvtárcsomagra érvényes alap: típusinformációt használó typescript-eslint, unicorn, import-x, sonarjs presetek, plusz a `CLAUDE.md` kódolási elvárásait kikényszerítő explicit szabályok |
| `src/react.ts`      | `apps/web` és `packages/ui` réteg: a `unicorn/filename-case` lazítása kebab-case és PascalCase egyidejű engedélyezésére                                                                           |
| `src/relaxed.ts`    | `tooling/**` és `tools/wire-probe/**` réteg (devDependencies import engedélyezve), plusz a `*.config.ts` fájlok típusinformáció nélküli linteléséhez a `disableTypeChecked` beillesztése          |
| `src/test-files.ts` | `*.test.ts`/`*.spec.ts` réteg: `sonarjs/no-duplicate-string` kikapcsolva                                                                                                                          |

## Függőségi irány

Csak fejlesztői eszköz, a workspace futásidejű csomagjai közül semelyiktől nem függ, és
semelyik sem függhet tőle futásidőben (csak `devDependencies`-ként, `eslint.config.ts`-en
keresztül).

## Szabályok

- A plugin preset exportok (`unicorn.configs.recommended`, `importX.flatConfigs.*`,
  `sonarjs` `configs.recommended`) saját segédtípusokat használnak, amik nem illeszkednek
  szigorúan az `eslint` csomag `Linter.Config` típusához (élő `tsc --noEmit` teszttel
  igazolva) - ezért a rétegek export típusa a következtetett típus, nincs explicit
  `Linter.Config[]` annotáció.
- A `typescript-eslint` és a `eslint-plugin-sonarjs` csomagoknál a névvel importált
  `configs` exportot használjuk (`import { configs } from '...'`), nem a default plugin
  exporton keresztüli `.configs` elérést, mert az utóbbi az `ESLint.Plugin` generikus,
  index-szignatúrás típusán megy át, ami `possibly undefined` típushibát ad.
- Minden lazítás (`react.ts`, `relaxed.ts`) kommentben indokolt, élő teszttel ellenőrizve.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 7. szekció
