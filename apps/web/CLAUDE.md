# apps/web

## Mi ez a mappa

React 19 és Vite 8 frontend. **Jelenleg üres váz**, csak egy placeholder export van benne,
hogy a csomag lefordulhasson. A tényleges alkalmazás egy későbbi specifikáció tárgya, a
`tooling/tsconfig/react.json`-t használja (JSX runtime).

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `web` a `core`, a `protocol` és az `ui` csomagtól függhet. **Tilos** a `db`, az
`engine`, az `agent` vagy a `server` csomagtól függenie.

## Szabályok

Nincs csomagra jellemző kiegészítő szabály a gyökér `CLAUDE.md`-hez képest.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
