# packages/logger

## Mi ez a mappa

`pino` és `pino-roll` alapú naplózás, rotációval. **Jelenleg üres váz**, csak egy
placeholder export van benne, hogy a csomag lefordulhasson. A tényleges logger
konfiguráció egy későbbi specifikáció tárgya.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `logger` a workspace csomagok közül semmitől nem függhet, L0 réteg (SPEC-002 4. szekció).

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_LOGGER_PLACEHOLDER` konstansát törölni
kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti
SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
