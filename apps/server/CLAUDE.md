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
`logger` csomagtól függ, L6 réteg (SPEC-002 4. szekció, "A frissített SPEC-001 függőségi
tábla"). Ez megegyezik a `package.json` tényleges tartalmával. Az `engine` L5 rétegre, a `server`
L6 rétegre a 2026-08-27-i user döntés emelte, ami a szigorúan csökkenő rétegszám szabályt zárta
le az `engine -> agent` élen.

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_SERVER_PLACEHOLDER` konstansát törölni
kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti
SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
