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

| Fájl                              | Tartalom                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                    | barrel, csak újraexport                                                                                                                                                                           |
| `src/eslint-preset/base.ts`       | minden könyvtárcsomagra érvényes alap: típusinformációt használó typescript-eslint, unicorn, import-x, sonarjs presetek, plusz a `CLAUDE.md` kódolási elvárásait kikényszerítő explicit szabályok |
| `src/eslint-preset/react.ts`      | `apps/web` és `packages/ui` réteg: a `unicorn/filename-case` lazítása kebab-case és PascalCase egyidejű engedélyezésére                                                                           |
| `src/eslint-preset/relaxed.ts`    | `tooling/**` és `tools/wire-probe/**` réteg (devDependencies import engedélyezve), plusz a `*.config.ts` fájlok típusinformáció nélküli linteléséhez a `disableTypeChecked` beillesztése          |
| `src/eslint-preset/test-files.ts` | `*.test.ts`/`*.spec.ts` réteg: `sonarjs/no-duplicate-string` kikapcsolva                                                                                                                          |

A négy fájl egyetlen témát alkot (`eslint-preset/`): mind a négy ugyanannak a flat confignak
a rétege, a `test-files.ts` pedig a másik három által használt fájlmintákat adja. A `src/`
alatt a téma mappa a `docs/spec/SPEC-002-csomag-architektura.md` 6.7 pontja szerint nem kap
saját `CLAUDE.md`-t.

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
