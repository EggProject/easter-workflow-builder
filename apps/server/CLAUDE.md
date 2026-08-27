# apps/server

## Mi ez a mappa

HTTP és WebSocket szerver, workflow futás orchestráció. **Jelenleg üres váz**, csak egy
placeholder export van benne, hogy a csomag lefordulhasson. A tényleges szerver egy
későbbi specifikáció tárgya.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `server` a `core`, a `protocol`, a `db`, az `engine`, az `agent`, a `provider-registry` és a
`logger` csomagtól függhet.

## Szabályok

Nincs csomagra jellemző kiegészítő szabály a gyökér `CLAUDE.md`-hez képest.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
