# packages/protocol

## Mi ez a mappa

A REST és WebSocket kontraktus egyetlen forrása. `apps/server` és `apps/web` ugyanebből
a csomagból veszi a típusokat, nem duplikálja őket. **Jelenleg üres váz**, csak egy
placeholder export van benne, hogy a csomag lefordulhasson.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `protocol` a `core` csomagtól függhet, mástól nem, L1 réteg (SPEC-002 4. szekció: "a
`protocol` L1, mert csak a `core` csomagtól függhet").

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_PROTOCOL_PLACEHOLDER` konstansát
törölni kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a
lenti SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
