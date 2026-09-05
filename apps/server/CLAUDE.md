# apps/server

## Mi ez a mappa

A `node:http` felett futó szerver alkalmazás (SPEC-006). Build lépés nélkül, a Node natív
TypeScript type strippingjével fut (`main.ts` a belépési pont). A SPEC-005 protokoll szerinti REST
API-t és SSE folyam végpontot szolgálja ki, a `@easter-workflow-builder/engine` motort és a
`@easter-workflow-builder/db` perzisztenciát köti be. A SPEC-006 9.1 tizennégy témája mind elkészült:
a 26 REST végpont mindegyike valódi kezelőre van kötve, a `GET /events` SSE végpont a "jelzés és
merítés" (signal and drain) mintát valósítja meg.

## Fájlok

| Mappa                           | Felelősség                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server-config/`                | env változó nevek, a `ServerConfig` alak, a `process.env` másolatából `Outcome` alakot adó olvasó, indulási log leíró                             |
| `engine-assembly/`              | a motor kilenc portjának valódi bekötése, a `createEngine` hívás, a valós `EventPublisherPort` és a publikált esemény osztályozása                |
| `startup-sequence/`             | az indulás 1 ... 7. lépése, lépésenkénti hibakezeléssel és kilépési kód beállítással                                                              |
| `shutdown-sequence/`            | a szabályos leállás 2 ... 6. lépése (SSE nyelők zárása is), és a két jelkezelő felvétele                                                          |
| `http-server/`                  | a `node:http` szerver, a `127.0.0.1` bind, a kérés törzs olvasás, a JSON válasz kiírás, CORS fejlécek, a `ServerResponse` SSE nyelővé csomagolása |
| `route-dispatch/`               | a `ROUTE_TABLE` alapú illesztő, paraméter kinyerés, a `404`/`405` ág, a `RouteHandler` típus                                                      |
| `route-registry/`               | a `Record<RouteId, RouteHandler>` kimerítő összeállítása, mind a 26 azonosító valódi kezelőre kötve                                               |
| `error-mapping/`                | a SPEC-005 8.3 táblázat: az `Outcome` üzenetéből a hibaosztály név kiolvasása, `ProtocolErrorCode` leképezés                                      |
| `workflow-endpoint/`            | a SPEC-005 4.2 A táblázat nyolc végpontjának kezelője                                                                                             |
| `run-endpoint/`                 | a SPEC-005 4.2 B táblázat nyolc futás végpontjának kezelője                                                                                       |
| `approval-endpoint/`            | a SPEC-005 4.2 C táblázat jóváhagyási végpontjai                                                                                                  |
| `provider-endpoint/`            | a SPEC-005 4.2 D táblázat provider lista és kapcsolat teszt végpontja                                                                             |
| `settings-endpoint/`            | a SPEC-005 4.2 E táblázat beállítás és párhuzamossági korlát végpontjai                                                                           |
| `stream-registry/`              | a streamId -> futás feliratkozások és az élő kapcsolatok nyilvántartása, a teljes csere végpont                                                   |
| `stream-connection/`            | a `GET /events` kapcsolat kiszolgálása: replay, "jelzés és merítés" élő kézbesítés, keep-alive                                                    |
| `enum-drift-protection/`        | a SPEC-005 7.6 megvalósítás nélküli regressziós tesztje                                                                                           |
| `node-config-drift-protection/` | a `NodeConfig` tíz ágú uniójának megvalósítás nélküli regressziós tesztje (PLAN-009 T-009-13, SPEC-005 7.7)                                       |

## Függőségi irány

L6 réteg, a legfelső (SPEC-002 4. szekció, `tooling/scripts/src/dependency-graph/package-layer.ts`).
Az `@easter-workflow-builder/agent`, `core`, `db`, `engine`, `logger`, `protocol`,
`provider-capability`, `provider-registry`, `typeguards` workspace csomagtól függ, plusz a saját,
közvetlen külső függősége az `@anthropic-ai/claude-agent-sdk` (pinelve), a `pino` és a `pino-roll`
(utóbbi kettő ugyanaz a verzió, mint a `packages/logger`-ben, mert a `pino.transport()` hívás itt
áll, lásd a `packages/logger/CLAUDE.md` fejlécét). A `typeguards`-ot az `engine-assembly`
`classify-published-event.ts`-je használja a publikált esemény alakjának szűkítésére.

A témák közötti irány egyirányú: a végpont témák (`workflow-endpoint`, `run-endpoint`,
`approval-endpoint`, `provider-endpoint`, `settings-endpoint`) az `error-mapping`-ra hivatkoznak,
fordítva nem; a `stream-connection` a `stream-registry`-re épül, fordítva nem; a `route-registry` a
`route-dispatch`, minden végpont téma, a `stream-registry` és az `engine-assembly` fölött áll; a
`startup-sequence` mindenre hivatkozik, rá semmi.

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
frissen megnyitott, migrált adatbázison valós OS szintű feltétellel nem idézhető elő. Ugyanitt
épül fel a megosztott `ClockPort` és `StreamRegistry` példány: mindkettőt az `engine-assembly` és a
`http-server` SSE rétege is ugyanazzal a példánnyal kapja, hogy az óra és a feliratkozás állapota
egy folyamaton belül egységes legyen.

**"Jelzés és merítés" (signal and drain), nem közvetlen továbbítás.** Az `EventPublisherPort.publish`
bemenete NEM hordozza a `run_event.id` mezőt (SPEC-006 6.5). A `create-real-event-publisher.ts` ezért
a publikált értéket sosem küldi tovább közvetlenül: a `stream-registry` csak jelez, hogy egy adott
`runId` változott, a tényleges `stream-connection/handle-stream-connection.ts` pedig a jelzés hatására
újra lekérdezi a `readEventsSince`-t az adatbázisból, lapozva, amíg egy lap tele van. A
`classify-published-event.ts` két alakot különböztet meg typeguarddal: az `EngineEvent`-hez (van
`kind`/`runId`/`stepRunId`/`payload` mezője) mindig tartozik perzisztált sor, az `AgentStreamMessage`-hez
(csak `runId`/`stepRunId`/`message`) a delta kapcsoló kikapcsolt állásában nem - ez utóbbi esetben a
kapcsolat `run_event_transient` kerettel, `sdk_stream_event` kinddel pótolja a hiányzó adatbázis sort.

**A `Last-Event-ID` fejléc nem szabványos egész értéke NEM kapcsolati hiba.** A
`handle-stream-connection.ts` ilyenkor `protocol_error` keretet küld (`runId: null`), és a
kapcsolat a `0` alapértékről folytatja - a kliens hibás fejléce nem szakíthatja meg a folyamot.

**A `route-handler.ts` és a `stream-sink.ts` típus-only fájl**, nincs hozzájuk `.spec.ts`
(`RouteHandler`/`RouteHandlerContext`/`RouteHandlerResult`, illetve `StreamSink` típusok,
futásidejű sor nélkül).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció), nincs `!` non-null assertion, valódi privát
mező `#` alakban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-006-szerver-alkalmazas.md`](../../docs/spec/SPEC-006-szerver-alkalmazas.md)
- [`../../docs/spec/SPEC-005-api-protokoll.md`](../../docs/spec/SPEC-005-api-protokoll.md): a REST és SSE szerződés
- [`../../docs/spec/SPEC-004-vegrehajto-motor.md`](../../docs/spec/SPEC-004-vegrehajto-motor.md): az `EngineDependencies` kilenc portja
- [`../../docs/plan/PLAN-007-szerver-alkalmazas.md`](../../docs/plan/PLAN-007-szerver-alkalmazas.md)
