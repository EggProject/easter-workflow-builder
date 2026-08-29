# apps/server

## Mi ez a mappa

HTTP és WebSocket szerver, workflow futás orchestráció. **A tényleges szerver tartalma
egy későbbi specifikáció tárgya**, a `src/index.ts` továbbra is placeholder export. Az
`src/enum-drift-protection/` mappa kivétel: ez a `packages/protocol` (SPEC-005 7.6
szekció) sodródás védelmi regressziós tesztje, ami már most, a `protocol` csomag
elkészültekor felkerül, mert csak itt látszik egyszerre a `protocol` és a `db`.

## Fájlok

| Fájl/mappa                   | Tartalom                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/index.ts`               | placeholder export, csak hogy a csomag lefordulhasson                                                                                                                                                                                                                                                                                                                          |
| `src/enum-drift-protection/` | megvalósítás nélküli regressziós teszt: a hat drótszintű felsorolás (`RunStatus`, `StepRunStatus`, `NodeType`, `RunEventKind`, `ApprovalDecision`, `RunInterruptedReason`) kétirányú típusszintű egyezése a `protocol` és a `db` csomag között, plusz a két exportált futásidejű guard (`isRunEventKind`, `isApprovalDecision`) lefedettsége (SPEC-005 7.6, PLAN-006 T-006-12) |

## Függőségi irány

A `server` a `core`, a `protocol`, a `db`, az `engine`, az `agent`, a `provider-registry` és a
`logger` csomagtól függ, L6 réteg (SPEC-002 4. szekció, "A frissített SPEC-001 függőségi
tábla"). Ez megegyezik a `package.json` tényleges tartalmával. Az `engine` L5 rétegre, a `server`
L6 rétegre a 2026-08-27-i user döntés emelte, ami a szigorúan csökkenő rétegszám szabályt zárta
le az `engine -> agent` élen. Az `enum-drift-protection` téma az egyetlen hely a repóban, ahol a
`protocol` (L1) és a `db` (L2) egyszerre importálódik (SPEC-005 7.6: "az `apps/server` az
egyetlen hely, ahol a `protocol` és a `db` egyszerre látszik").

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_SERVER_PLACEHOLDER` konstansát törölni
kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti
SPEC-002 hivatkozásban. Az `enum-drift-protection` mappában szándékosan nincs futásidejű
forrásfájl, csak a `.spec.ts` (ugyanaz a minta, mint a `tooling/scripts/src/turbo-e2e-coverage-outputs/`
és a `packages/db/src/sqlite-connection/barrel-exports.spec.ts`), ezért a lefedettségi
mérleget nem érinti.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-005-api-protokoll.md`](../../docs/spec/SPEC-005-api-protokoll.md), 7.6 szekció
