# packages/agent

## Mi ez a mappa

Agent SDK adapter, event normalizálás. **Jelenleg üres váz**, csak egy placeholder export
van benne, hogy a csomag lefordulhasson. A tényleges adapter réteg egy későbbi
specifikáció tárgya.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

Az `agent` a `core`, a `logger`, a `provider-registry` és az `agent-tool-bundle` csomagtól
függhet (SPEC-002 4. szekció, "A frissített SPEC-001 függőségi tábla"), L4 réteg. A
`package.json` ma csak a `core`, a `logger` és a `provider-registry` csomagot listázza
ténylegesen: az `agent-tool-bundle` a placeholder tartalom miatt még nincs használatban, a
felvétele a tényleges adapter réteg specifikációjának a feladata.

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_AGENT_PLACEHOLDER` konstansát törölni
kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti
SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
