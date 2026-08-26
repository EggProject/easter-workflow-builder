# tooling/scripts/src/casing

## Mi ez a mappa

Regressziós ellenőrzés egy valós CI hibára: a git indexben tárolt fájlnevek betűzése és a
rájuk hivatkozó relatív import specifikátorok betűzése megegyezik-e. Case-insensitive
fejlesztői fájlrendszeren (`git config core.ignorecase` = `true`) egy hibás átnevezés a git
indexet a régi betűzésen hagyhatja, miközben a lemez már a helyeset mutatja - ilyenkor sem a
`git status`, sem az `eslint import-x/no-unresolved`, sem a `tsc forceConsistentCasingInFileNames`
nem jelez semmit, mert mindegyik a lemezt nézi, nem a git indexet. Csak egy valódi,
kis-nagybetű-érzékeny checkoutnál (CI) derül ki `TS2307`-tel. A részletes indoklás és az élő
mérés, ami ezt igazolja: `find-casing-mismatches.ts` fejléce.

## Fájlok

| Fájl                                 | Tartalom                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `find-relative-import-specifiers.ts` | egy forrásfájl relatív `import`/`export ... from` specifikátorai, TS compiler API-val   |
| `find-casing-mismatches.ts`          | a tényleges ellenőrzés: `git ls-files` vs. a talált specifikátorok, betűre pontosan     |
| `check-casing.ts`                    | CLI belépési pont, a `tooling/scripts/casing.sh` hívja                                  |
| `check-casing.test.ts`               | Vitest regressziós teszt, lásd a gyökér `vitest.config.ts` `tooling-scripts` projektjét |

## Függőségi irány

Semmilyen workspace csomagtól nem függ. Csak a `typescript` compiler API-tól (`node_modules`,
`typescript: catalog:` a `tooling/scripts/package.json`-ban) és Node beépített moduloktól
(`node:child_process`, `node:fs`, `node:path`).

## Szabályok

- A `find-casing-mismatches.ts` kizárólag a `git ls-files` kimenetére épül, sosem a lemezen
  lévő fájlnevekre - ez a modul egész létjogosultsága, lásd a fejlécét.
- Csak a modul szintű `import`/`export ... from` deklarációkat nézi, mélyebb AST bejárás
  nélkül - a repóban nincs dinamikus relatív `import()` és nincs `require()`, ellenőrizve
  élő `git grep`-pel (lásd `find-relative-import-specifiers.ts` fejléce).
- Egy import specifikátor csak akkor számít eltérésnek, ha a git ls-files kis-nagybetűtől
  eltekintve ismeri a célfájlt, de betűre pontosan nem - ha a git egyáltalán nem ismeri
  (törött import), az más hiba, azt az `eslint`/`tsc` amúgy is elkapja.

## Kapcsolódó dokumentumok

- [`../../CLAUDE.md`](../../CLAUDE.md)
