# packages/engine

## Mi ez a mappa

DAG scheduler, node végrehajtók, retry policy. **Jelenleg üres váz**, csak egy placeholder
export van benne, hogy a csomag lefordulhasson. A tényleges motor egy későbbi
specifikáció tárgya.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

Az `engine` a `core`, a `db`, az `agent` és a `logger` csomagtól függhet.

## Szabályok

Nincs csomagra jellemző kiegészítő szabály a gyökér `CLAUDE.md`-hez képest.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
