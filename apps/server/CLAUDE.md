# apps/server

## Mi ez a mappa

A `node:http` felett futó szerver alkalmazás (SPEC-006). Build lépés nélkül, a Node natív
TypeScript type strippingjével fut (`main.ts` a belépési pont). A SPEC-005 protokoll szerinti REST
API-t szolgálja ki, a `@easter-workflow-builder/engine` motort és a `@easter-workflow-builder/db`
perzisztenciát köti be.

**Hatókör ebben a lépésben: nem teljes.** A SPEC-006 9.1 file fája tizennégy témát ír le; ebből a
nyolc workflow végpont (`workflow-endpoint`), a generikus `route-dispatch`/`http-server` réteg, az
`engine-assembly`, a `startup-sequence` és a `shutdown-sequence` készült el. **Négy végpont téma
(`run-endpoint`, `approval-endpoint`, `provider-endpoint`, `settings-endpoint`) és a stream réteg
(`stream-registry`, `stream-connection`, a `GET /events` SSE végpont) NEM készült el** - a
`ROUTE_TABLE` tizennyolc, ide tartozó azonosítója a `route-registry` témában
`createNotImplementedHandler` stubot kap, ami `internal` kódra képződő, őszinte hibaüzenetet ad,
nem hamis 200-as választ. Ez dokumentált, nyitott hiány, nem elfogadott végállapot.

## Fájlok

| Mappa                    | Felelősség                                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `server-config/`         | env változó nevek, a `ServerConfig` alak, a `process.env` másolatából `Outcome` alakot adó olvasó              |
| `engine-assembly/`       | a motor kilenc portjának valódi bekötése és a `createEngine` hívás                                             |
| `startup-sequence/`      | az indulás 1 ... 7. lépése, lépésenkénti hibakezeléssel és kilépési kód beállítással                           |
| `shutdown-sequence/`     | a szabályos leállás 2 ... 6. lépése és a két jelkezelő felvétele                                               |
| `http-server/`           | a `node:http` szerver, a `127.0.0.1` bind, a kérés törzs olvasás, a JSON válasz kiírás, CORS fejlécek          |
| `route-dispatch/`        | a `ROUTE_TABLE` alapú illesztő, paraméter kinyerés, a `404`/`405` ág, a `RouteHandler` típus                   |
| `route-registry/`        | a `Record<RouteId, RouteHandler>` kimerítő összeállítása - valódi kezelő és `createNotImplementedHandler` stub |
| `error-mapping/`         | a SPEC-005 8.3 táblázat: az `Outcome` üzenetéből a hibaosztály név kiolvasása, `ProtocolErrorCode` leképezés   |
| `workflow-endpoint/`     | a SPEC-005 4.2 A táblázat nyolc végpontjának kezelője                                                          |
| `enum-drift-protection/` | a SPEC-005 7.6 megvalósítás nélküli regressziós tesztje                                                        |

**Nem létező témák** (SPEC-006 9.1 szerint kellene, de ebben a lépésben nem készült el):
`run-endpoint`, `approval-endpoint`, `provider-endpoint`, `settings-endpoint`, `stream-registry`,
`stream-connection`.

## Függőségi irány

L6 réteg, a legfelső (SPEC-002 4. szekció, `tooling/scripts/src/dependency-graph/package-layer.ts`).
Az `@easter-workflow-builder/agent`, `core`, `db`, `engine`, `logger`, `protocol`,
`provider-capability`, `provider-registry` workspace csomagtól függ, plusz a saját, közvetlen külső
függősége az `@anthropic-ai/claude-agent-sdk` (pinelve), a `pino` és a `pino-roll` (utóbbi kettő
ugyanaz a verzió, mint a `packages/logger`-ben, mert a `pino.transport()` hívás itt áll, lásd a
`packages/logger/CLAUDE.md` fejlécét).

A témák közötti irány egyirányú: a végpont témák (`workflow-endpoint`) az `error-mapping`-ra
hivatkoznak, fordítva nem; a `route-registry` a `route-dispatch`, a `workflow-endpoint` és az
`engine-assembly` fölött áll; a `startup-sequence` mindenre hivatkozik, rá semmi.

## Szabályok

**A valódi Agent SDK `query()` függvénye lazán van bekötve.** Az `engine-assembly`
`buildAgentQueryRunner()` a bekötést hozza létre, de a hívás maga (`query(...)`) csak a motor
tényleges `startRun`/`testProviderConnection` hívásakor fut - egyetlen teszt sem hív valós API-t
(SPEC-006 10.1).

**A `127.0.0.1` bind cím a kódban áll, nem konfigurálható** (SPEC-006 3.5, `http-server` téma) - env
változóból jönne, egy elgépelt érték kinyitná a szervert a hálózatra.

**A `process.exit()` hívás tilos**, mindenhol `process.exitCode` beállítás, `process.exit()` nélkül
(SPEC-006 4.4, 8.2). Az indulás minden lépésének hibája végleges: nincs újrapróbálkozás, nincs
részleges indulás.

**A `main.ts` és az `index.ts` az `src/` alatti egyetlen két fájl**, ami nem téma mappában áll -
ez a SPEC-002 6. szekció "az `index.ts` barrelen kívül egyetlen fájl sem állhat közvetlenül a
`src/` alatt" szabályának kivétele, ugyanaz, mint az `apps/web/src/main.ts`-nél (SPEC-002 6.8). A
`main.ts` egyetlen sora sem hoz be feltételt, tehát nincs a lefedettségi kizárás listáján (eltérően
az `apps/web/src/main.ts`-től) - a `main.spec.ts` a fájlt dinamikus importtal futtatja végig, mert
a v8 lefedettség a nem importált fájlokat csak statikusan instrumentálja, nem futtatja, tehát az
egyetlen sor lefedettsége teszt nélkül 0 százalék maradna.

**A helyreállítás hibaágának tesztelhetősége miatt a `startup-sequence` két fájlra oszlik.**
A `run-startup-sequence.ts` (1 ... 3. lépés) fájl útvonalból nyitja meg az adatbázist, a
`continue-startup-with-database.ts` (4 ... 7. lépés) MÁR MEGNYITOTT `DatabaseContext` paramétert
kap - ez teszi lehetővé, hogy a `runStartupRecovery` hibaágát egy valódi, dekorált
`DatabaseContext`-tel közvetlenül lehessen tesztelni (ugyanaz a minta, mint a
`packages/engine/src/engine-port/create-engine.spec.ts` `racyDatabase` tesztje), mert a hibaág egy
frissen megnyitott, migrált adatbázison valós OS szintű feltétellel nem idézhető elő.

**A `route-handler.ts` típus-only fájl**, nincs hozzá `.spec.ts` (`RouteHandler`,
`RouteHandlerContext`, `RouteHandlerResult` típusok, futásidejű sor nélkül).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció), nincs `!` non-null assertion, valódi privát
mező `#` alakban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-006-szerver-alkalmazas.md`](../../docs/spec/SPEC-006-szerver-alkalmazas.md)
- [`../../docs/spec/SPEC-005-api-protokoll.md`](../../docs/spec/SPEC-005-api-protokoll.md): a REST szerződés
- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md): az `EngineDependencies` kilenc portja
- [`../../docs/plan/PLAN-007-szerver-alkalmazas.md`](../../docs/plan/PLAN-007-szerver-alkalmazas.md)
