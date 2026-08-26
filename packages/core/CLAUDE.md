# packages/core

## Mi ez a mappa

Domain típusok, typeguardok, `Result` és branded típusok könyvtára. **Jelenleg üres váz**,
csak egy placeholder export van benne, hogy a csomag lefordulhasson. A tényleges domain
modellt egy későbbi specifikáció adja, ide nem tartozik adatbázis séma, HTTP réteg vagy UI.

## Fájlok

| Fájl | Tartalom |
|---|---|
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `core` a workspace futásidejű függőségei közül semmitől nem függhet. Ez a legalsó
csomag a függőségi gráfban, minden más csomag ebből építkezhet.

## Szabályok

Nincs csomagra jellemző kiegészítő szabály a gyökér `CLAUDE.md`-hez képest.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
