# packages/core

## Mi ez a mappa

Domain típusok, typeguardok, `Result` és branded típusok könyvtára. **Jelenleg üres váz**,
csak egy placeholder export van benne, hogy a csomag lefordulhasson. A tényleges domain
modellt egy későbbi specifikáció adja, ide nem tartozik adatbázis séma, HTTP réteg vagy UI.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `core` a workspace futásidejű függőségei közül semmitől nem függhet, L0 réteg (SPEC-002 4.
szekció). Ez a legalsó csomag a függőségi gráfban, minden más csomag ebből építkezhet.

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_CORE_PLACEHOLDER` konstansát törölni
kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti
SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
