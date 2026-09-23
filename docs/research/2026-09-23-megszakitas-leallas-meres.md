# A futás megszakításának és a szerver leállásának mérése (2026-09-23)

Egy független ellenőrzés kódolvasással három szerver oldali hibát állított: (1) a REST megszakítás
lezáró eseménye nem megy ki élőben, (2) a szabályos leállás `run_interrupted` eseménye sem, (3) a
`human_approval` csomópont a valódi szerveren azonnal `template_render_failed` hibával bukik. Ez a
fájl a három állítás mérését, a javítás utáni újramérést és a `human_approval` verdiktjét rögzíti.

## 1. Mérési felállás

| Tétel              | Érték                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Futtató            | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `d6e3be7` commitja                                                                                                                                                                                                                                                                                                                          |
| Adatbázis          | fájl alapú SQLite a sandbox helyi `/tmp` alatt (a csatolt `/private/tmp` kötet WAL módban `SQLITE_IOERR_DELETE` hibát adott)                                                                                                                                                                                                                                                               |
| Kliens             | `curl -s -N "http://127.0.0.1:<port>/events?streamId=<id>"`, a feliratkozás `PUT /api/streams/<id>/subscriptions` hívással, `fromEventId: 0`                                                                                                                                                                                                                                               |
| Workflow           | `start -> human_approval`, `bodyTemplate: "Szöveg"`, `timeoutMs: null`, a workflow `providerId` értéke `claude-subscription`                                                                                                                                                                                                                                                               |
| A 3. állításhoz    | a szállított `apps/server/src/main.ts`, változtatás nélkül                                                                                                                                                                                                                                                                                                                                 |
| Az 1-2. állításhoz | a valódi `apps/server` modulok (`createHttpServer`, `buildRouteHandlers`, `createStreamRegistry`, `registerShutdownSignalHandlers`, `buildEngineDependencies`) és a valódi motor; **egyetlen eltérés:** a sablon renderelő port átengedő, mert a szállított, elutasító port mellett várakozó lépés nem létezhet (4. szekció). Valódi API hívás nincs: a `human_approval` nem hív providert |

## 2. A javítás előtti állapot

| Állítás                                    | Mért eredmény                                                                                                                                                                                                                                                   | Igaz? |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1. a megszakítás lezáró kerete nem megy ki | `POST /api/runs/<id>/interrupt` után a futás `cancelled`, a naplóban a 6. sor `run_finished`, az SSE kapcsolaton viszont az utolsó keret a `replay_complete` maradt: élő `run_event` keret nem jött                                                             | igaz  |
| 2. a `run_interrupted` kerete nem megy ki  | a hiba súlyosabb az állítottnál: nyitott SSE kapcsolat mellett `SIGTERM` után a folyamat **30 másodperc alatt sem lépett ki**, a motor leállása el sem indult, a futás `running` maradt, `run_interrupted` sor sem íródott; a folyamatot `SIGKILL` állította le | igaz  |
| 3. a `human_approval` azonnal elbukik      | a lépés `failed`, `errorKind: template_render_failed`, a futás `failed`, a hibaüzenet: "A szerver nem ismer sablon nyelvet ..." (4. szekció)                                                                                                                    | igaz  |

## 3. A gyökérokok

1. **Megszakítás.** A `cancelRunTree` a `run_finished` sort a saját tranzakciójában írja, a `db`
   réteg nem publikál, az `interruptRun` pedig a tranzakció után nem hívta az
   `eventPublisher.publish`-t. A léptető hurok `finishRun` függvénye a `stopRequested` ágon
   szándékosan nem ír és nem ad ki semmit, tehát a keretet senki sem adta ki.
2. **Leállás, első ok.** Ugyanez a hiány a `shutdownActiveRuns` és a `recoverInterruptedRuns`
   között; a `recoverInterruptedRuns` ráadásul csak darabszámot adott vissza, azonosítót nem.
3. **Leállás, második ok (az elakadás).** A `runShutdownSequence` a `server.close()` visszahívását
   **megvárta**, mielőtt az SSE nyelőket lezárta volna. A Node dokumentációja szerint a `close()`
   csak a tétlen kapcsolatokat zárja, és a visszahívás csak akkor fut, amikor minden kapcsolat
   véget ért (`https://nodejs.org/api/http.html#serverclosecallback`,
   `https://nodejs.org/api/net.html#serverclosecallback`); a telepített Node v26.7.0
   `_http_server.js` forrása (674 ... 710. sor) ugyanezt mutatja. Egy nyitott SSE válasz nem
   tétlen, tehát a várakozás sosem ért véget. Ha nem akadt volna el, az SSE nyelők akkor is a motor
   előtt zárultak volna, tehát a `run_interrupted` keret élőben akkor sem mehetett volna ki.

## 4. A `human_approval` verdiktje: sem próba hiba, sem új termékhiba

A lépés a **sablon tartalmától függetlenül** bukik: a mérés hivatkozás nélküli, sima szöveges
`bodyTemplate` értékkel (`"Sima szöveg, hivatkozás nélkül"`) is ugyanazt adta. Az ok az
`apps/server/src/engine-assembly/build-engine-dependencies.ts`: a szerver a
`createRejectingTemplateRenderer()` portot köti be, ami MINDEN `render` hívásra hibát ad. Ez a
SPEC-004 O-1 nyitott kérdés (a sablon nyelv megválasztása) dokumentált, szándékos következménye, és
a SPEC-006 1. szekciója ki is mondja ("A szerver ezeket nem találja ki, hanem ... kimondottan
elutasító port implementációt adja"). A próba workflow tehát nem volt hibás, és **nincs olyan
helyes alak**, amivel a szállított szerveren egy `human_approval` (vagy egy `promptTemplate`-et
renderelő `agent_step`) lépés várakozó vagy futó állapotba kerülhetne. A javítás egy sablon nyelv
kiválasztása, ami az O-1 szerint külön termékdöntés; ez a mérés nem dönti el.

Mellékmegfigyelés, nem javítva: a motor a futás indításakor nem hívja a `templateRenderer.compile`
metódust, ezért a hiba nem az indításkor (ahogy az O-1 a kifejezés kiértékelőre leírja), hanem a
lépés futásakor jelentkezik.

## 5. A javítás utáni állapot

| Mérés            | Mért eredmény                                                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| REST megszakítás | az interrupt válasz `cancelledRunIds` listája a futást tartalmazza; a futás `cancelled`; az SSE kapcsolaton `event: run_event`, `delivery: live`, `runEvent.kind: run_finished`, `payload.status: cancelled` (a 6. sor)         |
| `SIGTERM`        | az SSE kapcsolaton `delivery: live`, `runEvent.kind: run_interrupted`, `payload.reason: graceful_shutdown`; utána a kapcsolat lezárul; a napló "A szerver leállt." sora után a folyamat `0` kóddal kilép; a futás `interrupted` |

A három javítás regresszióját a `packages/engine` `interrupt-run.spec.ts`,
`shutdown-active-runs.spec.ts`, `create-run-supervisor.spec.ts` és az `apps/server`
`run-shutdown-sequence.spec.ts` tesztje őrzi; az utóbbi valódi HTTP SSE kapcsolaton ellenőrzi a
leállási sorrendet.

## 6. Leállás közben induló futás (2026-09-23, második kör)

Egy független ellenőrzés azt állította, hogy a jel előtt fejléccel megkezdett, de csak a leállás
alatt befejezett indító kérés új futást indít, és a SPEC-004 10.2 1. pontja ("A szabályozó nem
enged több lépést indulni") nincs megvalósítva. A mérés megerősítette.

| Tétel       | Érték                                                                                                                                                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Futtató     | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `808c854` commitja (előtte), illetve a javítás munkapéldánya (utána)                                                                                                                                                                                                                  |
| Szerver     | a valódi `apps/server` modulok (`createHttpServer`, `buildRouteHandlers`, `createStreamRegistry`, `registerShutdownSignalHandlers`, `buildEngineDependencies`) és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő (4. szekció) |
| Workflow    | `start -> agent_step`, `claude-subscription`, `claude-sonnet-5`                                                                                                                                                                                                                                                                      |
| Hamis lépés | megszakítás nélkül 8000 ms után sikeres `result`, `interrupt()` után 3000 ms alatt ér véget                                                                                                                                                                                                                                          |
| Menet       | 1. indító `POST`, a lépés elindul; 2. nyers TCP kapcsolaton egy második indító `POST` fejléce (`Content-Length: 12`), törzs nélkül; 3. 100 ms múlva `SIGTERM`; 4. 500 ms múlva a törzs; 5. a kilépésig eltelt idő a `SIGTERM`-től mérve, utána az adatbázis újranyitása                                                              |

| Eset                           | Válasz a második kérésre                  | Futások          | Agent futtató hívás                                                                                        | Kilépés       |
| ------------------------------ | ----------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- | ------------- |
| előtte, második kérés nélkül   | nincs                                     | 1, `interrupted` | 1                                                                                                          | 3050 ms       |
| előtte, félbe küldött kéréssel | `200`, új futás                           | 2, `interrupted` | 2, a második a jel után (a szerver naplójában 509 ms-mal az első `interrupt()` után), `interrupt()` nélkül | 8536 ms       |
| utána, félbe küldött kéréssel  | `500`, `internal`, `engine_shutting_down` | 1, `interrupted` | 1                                                                                                          | 3031, 3031 ms |
| utána, második kérés nélkül    | nincs                                     | 1, `interrupted` | 1                                                                                                          | 3039 ms       |

**A gyökérok.** A `shutdownActiveRuns` az aktív futások listáját a leállás elején egyszer kérdezte
le, a `startRun` viszont semmilyen leállási jelzést nem nézett, tehát a lekérdezés után induló
futás kimaradt a `requestStop` és az `interrupt()` hívásból. Ugyanez a rés a szabályozóban is
megvolt: egy sorban álló agent lépés a leállás alatt felszabaduló helyet megkapta, és `interrupt()`
nélkül végigfutott (a `packages/engine` `create-engine.spec.ts` regressziós tesztje ezt
korlátozott szabályozóval reprodukálja).

**A javítás.** A leállás a lekérdezés ELŐTT, szinkron letiltja az új futást
(`RunSupervisor.stopAcceptingRuns`, utána minden indítás `engine_shutting_down` hibát ad) és
lezárja a szabályozót (`ConcurrencyGate.close`, utána minden sorban álló és új kérés elutasítást
kap, a lépés `interrupted` eredménnyel, `pending` sorral tér vissza, amit a
`recoverInterruptedRuns` zár). A regressziót a `packages/engine` `create-engine.spec.ts` két
tesztje és az `apps/server` `run-shutdown-sequence.spec.ts` félbe küldött kéréses tesztje őrzi;
mindhárom a javítás visszavonására bukik (mérve: `expected '' to contain '(engine_shutting_down)'`,
`expected 2 to be 1`, `expected 200 to be 500`).

## 7. A megszakítás és a sorban álló lépések (2026-09-23, harmadik kör)

Egy független mérés azt állította, hogy a REST megszakítás nem veszi ki a sorból a futás
várakozó agent lépéseit: ezek a megszakítás után elindulnak, `interrupt()` nélkül végigfutnak, és
a megszakító kérés a végükig nem válaszol. A mérés megerősítette.

| Tétel       | Érték                                                                                                                                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató     | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `cc9e761` commitja (előtte), illetve a javítás munkapéldánya (utána)                                                                                                                                                       |
| Szerver     | a 6. szekció felállása: a valódi `apps/server` modulok és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő                                                           |
| Hamis lépés | megszakítás nélkül 8000 ms után sikeres `result`, `interrupt()` után 1000 ms alatt zár (szintén sikeres `result`-tal, ezért a megszakított, futó lépés `succeeded`)                                                                                                       |
| A eset      | `start` után három párhuzamos `agent_step`, `claude-subscription`, a párhuzamossági korlát 1 (`PUT /api/settings/concurrency-limits/claude-subscription`); egy lépés fut, kettő `pending`; `POST /api/runs/<id>/interrupt`; SSE feliratkozás a futásra (`fromEventId: 0`) |
| B eset      | `start -> agent_step`, korlát 1; az A futás lépése foglalja a helyet, a B futás lépése sorban áll; a B futás megszakítása                                                                                                                                                 |

| Eset      | A megszakító kérés válasza | Agent hívás | A sorban álló lépések végállapota                                 | Élő lezáró keret                                              |
| --------- | -------------------------- | ----------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| A, előtte | 17043 ms                   | 3           | elindultak (+1013 és +9023 ms), `succeeded`, `cancelled` futásban | SSE-n nem mérve; a `run_finished` sor a 17041. ms-ban íródott |
| A, utána  | 1012 ms, illetve 1015 ms   | 1           | `cancelled`, `step_started` esemény nélkül                        | `delivery: live`, `run_finished`, `status: cancelled`         |
| B, előtte | 15030 ms                   | 2           | a B lépése a helyet megkapta, lefutott, `succeeded`               | SSE-n nem mérve                                               |
| B, utána  | 2 ms, illetve 3 ms         | 1 (az A-é)  | `cancelled`; az A futás ettől függetlenül `succeeded`             | `delivery: live`, `run_finished`, `status: cancelled`         |

A két "utána" szám két független mérő futás eredménye (a korábbi ellenőrző mérő scriptje, illetve
egy SSE kapcsolatot is figyelő változat).

**A gyökérok.** A SPEC-004 9. szekció 2. pontjának két fele ("a szabályozó ebből a futásból többé
nem enged induló lépést, és a sorban álló lépései kiesnek") közül csak az első volt megvalósítva:
a `requestStop()` a léptető hurok új példányainak indítását tartja vissza, a már elindított, de
párhuzamossági helyre váró agent lépést viszont nem éri el. A szabályozónak nem volt olyan
művelete, ami egy várakozót visszahívással zárt volna; a `releaseSlot` sorból való eltávolítása
visszahívás nélküli, és a motor nem is hívta. A `packages/engine/CLAUDE.md` állítása, hogy a 2.
pontot a `requestStop()` pontosan lefedi, hamis volt.

**A javítás.** A `ConcurrencyGate.requestSlot` átveszi a kérő lépés futásának `runId`-ját, és az
új `denyWaitingForRunIds` a megnevezett futások minden várakozóját érkezési sorrendben kiveszi a
sorból és `onDenied` visszahívással zárja. A megszakítás és a szabályos leállás közös menete
(`stopAndAwaitRunTree`) a `requestStop()` után, a `completion` megvárása előtt hívja, a fa minden
futására. Az elutasított lépés a meglévő úton `interrupted` eredménnyel tér vissza (ugyanaz, mint
a lezárt szabályozónál, 6. szekció), a sora `pending` marad, és a `cancelRunTree` tranzakciója
`cancelled` állapotba viszi.

**A megszakító kérés válasza.** A SPEC-005 15. végpontja az `InterruptSummaryResponse` alakot adja,
aminek a `cancelledRunIds` mezője a DB oldali zárás eredménye, és a SPEC-004 9. szekció 4. és 5.
pontja szerint a zárás a megszakított lépések folyamának kimerülése után fut. A spec tehát nem
azonnali elfogadást és aszinkron lezárást ír elő, hanem szinkron összegzést. A javítás ezt nem
változtatta meg: a válasz a megszakított, futó lépés leállásáig vár (a mérésben a hamis lépés
1000 ms-a), a sorban állókéig nem.

**A regresszió.** A `packages/engine` `create-engine.spec.ts` két tesztje (korlát 1, három
párhuzamos lépés; illetve egy csak sorban álló futás), a `stop-and-await-run-tree.spec.ts` és az
`interrupt-run.spec.ts` egy-egy tesztje, valamint a `create-concurrency-gate.spec.ts` új
`denyWaitingForRunIds` esetei. A javítás visszavonására (a `denyWaitingForRunIds` hívás törlése a
`stopAndAwaitRunTree`-ből) mérve mind a négy menet teszt bukik; a két motor szintű teszt üzenete:
`expected 3 to be 1` (agent hívásszám), illetve `expected false to be true` (a megszakítás a másik
futás lépésére várva nem ért véget).

**A `fail_run` ág: mérve, javítva (2026-09-23, negyedik kör).** Ugyanez a rés a `fail_run`
hibapolitikánál is megvolt, és a fenti javítás nem terjedt ki rá. Az első mérés (`create-engine`
szintű próba, korlát 1, a `fail_run` politikájú első agent lépés az első hívásban bukik): a két
sorban álló testvér lefutott, a futás `failed`, az agent hívás 3. Egy független ellenőrzés a
`b75960d` commiton ugyanezt mérte: az a2 2 ms-mal a bukás után elindult, az a3 megszakítás nélkül
végigfutott, a futás kb. 10 s-nál lett `failed`; korlát 2 mellett az a3 4 ms-mal a bukás után
indult.

| Tétel       | Érték                                                                                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató     | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `634bb9d` commitja (előtte: a három érintett motor fájl a commit szerinti alakjában), illetve a javítás munkapéldánya (utána)                                     |
| Felállás    | a valódi motor (`createEngine`) `:memory:` adatbázissal, a munkamenet eldobható mérő scriptjéből; valós API hívás nincs, a sablon renderelő átengedő                                                             |
| Hamis lépés | a helyet elsőként kapó agent lépés 300 ms után nem sikeres `result`-tal bukik; minden további hívás megszakítás nélkül 8000 ms után sikeres, `interrupt()` után 1000 ms alatt zár (szintén sikeres `result`-tal) |
| Workflow    | `start` után három párhuzamos `agent_step` (`a1`, `a2`, `a3`), mind `onUnhandledError: 'fail_run'`, a párhuzamossági korlát 1, illetve 2                                                                         |

| Eset             | Agent hívás | `interrupt()` | Sorban álló testvér                                    | A futás `failed`, a bukástól |
| ---------------- | ----------- | ------------- | ------------------------------------------------------ | ---------------------------- |
| korlát 1, előtte | 3           | 1             | `a2` +4 ms-nál, `a3` +1008 ms-nál indult, `succeeded`  | 9013 ms                      |
| korlát 1, utána  | 1           | 0             | `a2`, `a3` `cancelled`, `step_started` nélkül          | 6 ms                         |
| korlát 2, előtte | 3           | 2             | `a3` +4 ms-nál indult, megszakítva, `succeeded`        | 1010 ms                      |
| korlát 2, utána  | 2           | 1             | `a3` `cancelled`; a futó `a2` megszakítva, `succeeded` | 1009 ms                      |

A korlát 2 melletti 1009 ms a futó, megszakított testvér folyamának kimerülése (a hamis lépés
`interrupt()` utáni 1000 ms-a), nem a természetes 8000 ms-os vége: a 9. szekció 4. pontja szerint a
megszakított lépés üzenetei a folyam végéig beíródnak.

**A gyökérok.** Két rés. (1) A hurok a `fail_run` után csak `interrupt()`-ot hívott, a szabályozó
sorában álló testvéreket nem vette ki. (2) Ha a bukott lépés maga foglalt helyet, a hurok erről
későn értesül: a lépés `finally` ága a `releaseSlot` hívással a felszabaduló helyet szinkron a sor
következő elemének adja, és annak folytatása a hurok előtt jut szóhoz (a +4 ms-os indulás).

**A javítás.** A `fail_run` ugyanazt a mechanizmust használja, mint a külső megszakítás, új
szabályozó művelet nélkül: `denyWaitingForRunIds` a futás `runId`-jára, a futó testvéren
`interrupt()`. A kivételt két hely végzi: a bukott, helyet foglaló lépés a helye felszabadítása
ELŐTT (a hurok a futtatás előtt a `resolveErrorRoute` döntéséből megmondja neki, hogy a `failed`
kimenete `fail_run`), és a léptető hurok az `interrupt()` előtt (a helyet nem foglaló lépés, például
elutasított jóváhagyás bukására). A kivett lépés `pending` sorát a futás záró menete a
`markRunFailed` előtt `cancelled` állapotba viszi. A végállapot indoka: a SPEC-004 8.3 nem nevezi
meg, a SPEC-003 7.2 állapotgépében a `pending` sorból a `running` mellett csak a `cancelled` ("a
futás megszakadt, mielőtt a lépés elindult") és az indulási helyreállításnak fenntartott
`interrupted` vezet ki, `skipped` állapot nincs. A futó, megszakított testvér a saját eredménye
szerint zár, ugyanúgy, mint a külső megszakításnál; a záró menet terminális sort nem ír át.

**A regresszió.** A `packages/engine` `create-engine.spec.ts` öt tesztje (korlát 1; korlát 2; egy
másik futás sorban álló lépése; helyet nem foglaló lépés bukása; `fail_branch` határ), plusz az
`agent-node-lifecycle.spec.ts` és az `advance-run.spec.ts` új esetei. A javítás előtt a négy
`fail_run` regressziós teszt bukott (`expected 3 to be 1`, `expected 3 to be 2`, `expected 3 to be
2`, `expected 2 to be 1`). Részenként visszavonva: a lépés oldali kivétel nélkül a három agent
bukásos teszt bukik, a hurok oldali nélkül a jóváhagyásos, a záró menet nélkül mind a négy (a sor
`pending` marad).

**A `fail_run` és a döntésre váró jóváhagyás testvér: mérve, javítva (2026-09-23, ötödik kör).** Egy
független ellenőrzés a `8ce9d5d` commiton azt mérte, hogy a `fail_run` a döntésre váró
`human_approval` testvért nem zárja le: a futás a döntésig `running`, jóváhagyáskor a lépés
`succeeded` egy `fail_run` futásban, `timeoutMs: null` mellett a futás korlátlanul nyitva marad. A
SPEC-004 8.3 ezt tévesen nyitott kérdésnek jelölte, holott a táblázat szerint a `fail_run` "minden
nem terminális lépést lezár", és a SPEC-003 7.2-ben a `waiting_approval -> cancelled` átmenet
létezik.

| Tétel    | Érték                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató  | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `e26da34` commitja (előtte), illetve a javítás munkapéldánya (utána)                                                                                               |
| Szerver  | a 6. szekció felállása: a valódi `apps/server` modulok és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő   |
| Workflow | `start` után egy `agent_step` (`a1`, `fail_run`, 300 ms után nem sikeres `result`) és egy `human_approval` (`jov`, `timeoutMs: null`); egy másik workflow `start -> human_approval` (`jov-b`) párhuzamos futással |
| Kliens   | 10 ms-onként `GET /api/runs/<id>` legfeljebb 3000 ms-ig, utána `GET /api/approvals`, majd döntés `POST /api/approvals/<id>/decision` (`approved`)                                                                 |

| Eset   | A futás a bukás után                                                         | `jov` lépés             | Utólagos döntés                                                      | A másik futás                         |
| ------ | ---------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------- | ------------------------------------- |
| előtte | 3000 ms-nál `running`; `failed` csak a döntés után, 2716 ms-mal a bukás után | döntés után `succeeded` | HTTP 200, a döntés átment                                            | nem mérve                             |
| utána  | `failed` 4, 6, illetve 2 ms-mal a bukás után (három futás)                   | `cancelled`             | HTTP 409 `conflict`, `illegal_status_transition`; semmi nem változik | `running`, `jov-b` `waiting_approval` |

**A javítás.** A léptető hurok a `fail_run` után, a sorból kivétel és az `interrupt()` között
`ApprovalWaitRegistry.cancelWaitingForRunIds`-t hív a futás `runId`-jára, ugyanazt, amit a
megszakítás (`stopAndAwaitRunTree` 3. pont). A végrehajtó a meglévő úton `interrupted`
eredménnyel, állapotváltás és esemény nélkül tér vissza, a `waiting_approval` sort a záró menet a
`markRunFailed` előtt `cancelled` állapotba viszi, a `pending` sorral együtt. A `human_approval`
sornak nincs állapot oszlopa: a `decision` NULL marad, ugyanúgy, mint a megszakítás után.

**A regresszió.** A `create-engine.spec.ts` három új tesztje (a jóváhagyás `cancelled`, a futás
döntés nélkül `failed`, az utólagos döntés `illegal_status_transition`; egy másik futás
jóváhagyása érintetlen; `fail_branch` határ: a jóváhagyás a bukás feldolgozása után is vár), valamint
az `advance-run.spec.ts` záró menet tesztje. A javítás előtt a két `fail_run` teszt bukott (a futás
nem ért terminális állapotba) és a záró menet tesztje (`expected 'waiting_approval' to be
'cancelled'`). Részenként visszavonva: a várakozás lezárása nélkül a két `create-engine` teszt, a
záró menet `waiting_approval` ága nélkül a záró menet tesztje és az első `create-engine` teszt
bukik. Ha a lezárás minden kezeletlen hibára lefutna, nem csak `fail_run`-ra, a `fail_branch`
határteszt bukik (`approval_decided` esemény nincs).

**A sorrend kérdés.** A hurok kommentje azt állította, hogy fordított sorrendben (előbb
`interrupt()`, utána a sorból kivétel) a megszakított lépés felszabaduló helyét a sorban álló
testvér kapná meg, de a sorrend felcserélésére egyetlen teszt sem bukott (mérve, a javítás előtti
tesztkészlettel). Az ok kódolvasásból: minden meglévő hamis agent az `interrupt()` nyugtáját
azonnal, `Promise.resolve()`-val adja, a megszakított lépés pedig csak a folyama kimerítése és a
sora lezárása után szabadítja fel a helyét, tehát a kivétel a nyugta után is időben jön. Az `AgentQuery`
szerződése a nyugta időzítését nem köti ki. Az `advance-run.spec.ts` új sorrend tesztje olyan hamis
agenttel fut, ami a nyugtát a megszakított lépés helyének felszabadítása után adja (a szabályozó
`releaseSlot` hívását figyelve): a mostani sorrenddel 1 agent hívás, felcserélt sorrenddel 2
(`expected 2 to be 1`). A sorrend tehát ilyen nyugta mellett számít; hogy a valódi SDK nyugtája a
folyam vége előtt vagy után érkezik, nem mért.

**Ami nyitva marad, mérve.** (1) A `GET /api/approvals` a lezárt jóváhagyást továbbra is
visszaadja (`decision IS NULL`), a döntése 409-et ad; a felhasználói megszakítás után ugyanez
mérve (`start -> human_approval`, `POST /api/runs/<id>/interrupt`: a lista 1 elemű, a döntés 409).
Lezárva, 2026-09-23, a `c849d2c` commit user döntésével: a lista a lépés `waiting_approval`
állapotából szűr, nem a `decision IS NULL` feltételből, tehát a lezárt jóváhagyás kikerül belőle
(SPEC-004 8.3, a 15. szekció O-9 tétele). (2) A várakozás lezárása és a záró írás közti ablakban (egy futó, megszakított testvér folyamának
kimerülése alatt) érkező döntés átment: lezárva, lásd a hatodik kört lent. (3) A `fail_run` a testvér `sub_workflow`
gyerek futását nem állítja le: motor szintű próba, a gyerek `start -> human_approval`, a szülő a
bukás után sem terminális. Lezárva, lásd a hetedik kört lent.

**A leállási ablakban érkező jóváhagyási döntés: mérve, javítva (2026-09-23, hatodik kör).** Egy
független ellenőrzés a `7229769` commiton azt mérte, hogy a fenti (2) pont a valódi szerveren is
előáll: a `fail_run` (vagy a felhasználói megszakítás) a döntésre váró jóváhagyás várakozását
lezárja, de egy futó testvér `interrupt()` utáni kimerülése alatt beküldött döntés HTTP 200-at
kap. A SPEC-004 8.3 és a 43. kritérium szerint a lezárt jóváhagyásra érkező döntés
`illegal_status_transition`, és semmit nem módosít, tehát ez hiba volt, nem nyitott kérdés.

| Tétel     | Érték                                                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató   | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `f3ac259` commitja (előtte; a motor kódja azonos a `7229769`-ével), illetve a javítás munkapéldánya (utána)                                                             |
| Szerver   | a 6. szekció felállása: a valódi `apps/server` modulok és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő        |
| Hamis     | az `a1` 300 ms után nem sikeres `result`-tal bukik (`fail_run`); az `a2` megszakítás nélkül 8000 ms, `interrupt()` után 1000 ms alatt zár, sikeres `result`-tal                                                        |
| A eset    | `start` után `a1`, `a2` és `jov` (`human_approval`, `timeoutMs: null`); az `a1` bukása után a kliens a szerver naplójában megvárja az `a2` `interrupt()`-ját, és azonnal döntést küld (`approved`)                     |
| B eset    | `start` után `a2` és `jov`; `POST /api/runs/<id>/interrupt` (a válaszát nem várva), a kliens megvárja az `a2` `interrupt()`-ját, és azonnal döntést küld                                                               |
| Kiolvasás | a döntés válasza és a futás állapota a döntés után, a lépések végállapota, a `jov` lépés eseményei (`GET /api/runs/<id>/events`), és a `human_approval.decision` oszlop közvetlenül a fájlból, a szerver leállása után |

| Eset      | A döntés válasza                  | A futás a döntéskor | A futás vége | `jov` lépés | `decision` | A `jov` eseményei                    |
| --------- | --------------------------------- | ------------------- | ------------ | ----------- | ---------- | ------------------------------------ |
| A, előtte | HTTP 200, háromból háromszor      | `running`           | `failed`     | `succeeded` | `approved` | `step_started`, `approval_requested` |
| A, utána  | HTTP 409 `conflict`, ötből ötször | `running`           | `failed`     | `cancelled` | NULL       | `step_started`, `approval_requested` |
| B, előtte | HTTP 200, kettőből kétszer        | `running`           | `cancelled`  | `succeeded` | `approved` | `step_started`, `approval_requested` |
| B, utána  | HTTP 409 `conflict`, ötből ötször | `running`           | `cancelled`  | `cancelled` | NULL       | `step_started`, `approval_requested` |

A 409 törzsében a hibaosztály `illegal_status_transition` (a `markStepSucceeded` üzenete). A
döntés válasza minden mérésben legfeljebb 196 ms-mal az `interrupt()` után megjött, a futó lépés
1000 ms-os kimerülésén belül, és a futás a döntéskor `running` volt; a megszakító kérés válasza a B
esetben 1009 ... 1021 ms. Az A esetben a szerver eseményhurka a bukás után egy nem vizsgált okból
kb. 180 ms-ig foglalt, a javítás előtt és után is (egy az `interrupt()` után közbeiktatott `GET`
177, 182 és 188 ms-ig tartott), ezért ott a döntés válasza 182 ... 196 ms, egy mérésben 10 ms; ez
nem a javítás hatása.

**A gyökérok.** A compare and set feltételek épek: a `db` `decideApproval` a `decision IS NULL`
feltétellel, a `markStepSucceeded` a `status IN (...)` feltétellel ír. A hiba az, hogy a lezárás a
leállási ablakban csak memóriában létezett: az `ApprovalWaitRegistry.cancelWaitingForRunIds` a
várakozót törölte, a lépés sora viszont a futás záró írásáig (`fail_run`: `finishRun`,
megszakítás: `cancelRunTree`) `waiting_approval` maradt, `decision` NULL-lal, a futás sora pedig
`running`. A döntés tehát egy érvényes, de elavult állapotot látott: a `db` elfogadta, a
`notifyDecided` nem talált várakozót, így esemény sem íródott, és a záró írás a már terminális
sort nem írta át. Futás állapot ellenőrzés sem segített volna, mert a futás az ablakban `running`.

**A javítás.** A döntésre váró jóváhagyás sora a várakozás lezárásával egy szinkron menetben,
egyetlen `await` nélkül megy `cancelled` állapotba (`cancelWaitingApprovalStepRuns`, a
`run-interrupt` témában): a `fail_run` hurok a `cancelWaitingForRunIds` után, az `interrupt()`
előtt, az `interruptRun` a `stopAndAwaitRunTree` előtt, a fa aktív futásaira. Az ablakban érkező
döntés így a `cancelled` soron bukik (`illegal_status_transition`), és a tranzakciója a
`human_approval` sor írását is visszagörgeti. A `fail_run` záró menete ezután csak a `pending`
sorokat zárja: azokat a hurok menete szándékosan nem, mert a szabályozó a helyet egy `Promise`
feloldásával adja át, és a `markStepRunning` csak egy későbbi folytatásban fut. A szabályos leállás
útját ez a kör nem mérte és nem változtatta; a nyolcadik kör mérte és javította (lent).

**A regresszió.** A `create-engine.spec.ts` két új tesztje (`fail_run`, illetve felhasználói
megszakítás, mindkettőben egy `interrupt()` után csak a teszt jelére kimerülő testvér tartja nyitva
az ablakot): a javítás előtt mindkettő bukott (`expected '' to contain
'(illegal_status_transition)'`). Részenként visszavonva: a hurok oldali írás nélkül öt teszt bukik
(a két `create-engine` jóváhagyásos `fail_run` teszt és három `advance-run` teszt), az
`interruptRun` oldali nélkül három (a `create-engine` megszakításos teszt és két `interrupt-run`
teszt). Plusz a `cancel-waiting-approval-step-runs.spec.ts` öt esete.

**Mellékes lelet, mérve: a már eldöntött jóváhagyás második döntése 404.** Ugyanezen a szerveren
(`start -> human_approval`, jóváhagyás, majd egy második döntés ugyanarra az `approvalId`-ra): az
első HTTP 200, a második HTTP 404 `not_found` ("függőben lévő jóváhagyás nem található"), a
javítás előtt és után is. Az ok a `decide-approval.ts` kezelő: az `approvalId`-t a függő lista
(`decision IS NULL`) elemei között keresi, mert a `HumanApprovalRepository`-nak nincs `approvalId`
szerinti olvasása. Nem javítva, a két forrás ellentmond egymásnak: a SPEC-005 8.2 szerint a
`conflict` az "erőforrás létezik, de az állapota nem engedi a műveletet" esete, és a SPEC-008 8.
szekciója kimondja, hogy egy második hívás `conflict` hibát ad; a SPEC-006 1. szekciója ("Amit NEM
dönt el") viszont kimondja, hogy a szerver új repository metódus nélkül képez le, és ahol a
leképezés nem teljes, az nyitott kérdés, nem a felület csendes bővítése. A `conflict` válaszhoz új
`db` olvasó metódus kellene, tehát ez user döntés. Lezárva, 2026-09-23, a `c849d2c` commit user
döntésével: a `HumanApprovalRepository` új `getApproval(approvalId)` olvasót kapott, a
`decide-approval.ts` ezzel olvas a függő lista helyett; a második döntés HTTP 409 `conflict`
(`already_decided`), a nem létező azonosító HTTP 404 `not_found` (SPEC-005 4.2, SPEC-004 8.3).

**Leállás közben a 503.** Ugyanezen a szerveren a 6. szekció félbe küldött indító kérése a javítás
után `503 Service Unavailable` választ kap, a törzsben `service_unavailable` kóddal és
`engine_shutting_down` hibaosztállyal; futás nem jön létre, a kilépés 3035 ms. A kód forrása az
RFC 9110 15.6.4 (<https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable>),
megerősítve az IANA HTTP státusz regiszterrel
(<https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml>) és az MDN
leírásával (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503>). A
`Retry-After` fejléc az RFC szerint elhagyható ("MAY"), és nincs forrásunk az újraindulás idejére,
ezért nem küldjük.

**A `fail_run` és a futó `sub_workflow` testvér gyerek futása: mérve, javítva (2026-09-23, hetedik
kör).** Egy független ellenőrzés a `7229769` commiton azt mérte, hogy ha a futás `fail_run` miatt
bukik, miközben egy testvér `sub_workflow` lépés gyerek futása jóváhagyásra vár, a szülő és a
`sub` lépés 3000 ms-mal a bukás után is `running`, a gyerek jóváhagyása után pedig a `sub` lépés
`succeeded` egy `failed` futásban. A user döntése (2026-09-23): a gyerek futás `cancelled`, ugyanazzal
a fa mechanizmussal, mint a felhasználói megszakításnál, a szülő azonnal `failed`.

| Tétel    | Érték                                                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató  | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `fce40c1` commitja külön munkafában (előtte), illetve a javítás munkapéldánya (utána)                                                                                               |
| Szerver  | a 6. szekció felállása: a valódi `apps/server` modulok és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő                    |
| Workflow | szülő: `start` után `a1` (`agent_step`, `fail_run`, 300 ms után nem sikeres `result`) és `sub` (`sub_workflow`); gyerek: `start` után `c-jov` (`human_approval`, `timeoutMs: null`) és `c-sub` az unokára; unoka: `start -> u-jov` |
| Másik fa | egy másik workflow `start -> o-sub` ugyanerre a gyerek workflow-ra, a szülő előtt indítva; a gyereke és az unokája szintén jóváhagyásra vár                                                                                        |
| Kliens   | a bukás (a szerver napló `STEP_END`) után legfeljebb 3000 ms-ig `GET /api/runs/<id>`, majd döntés (`approved`) a gyerek és az unoka jóváhagyására, végül a másik fa két jóváhagyására                                              |

| Eset             | A szülő futás a bukás után                                              | `sub` lépés                     | Gyerek, unoka                                          | Döntés a gyerek és az unoka jóváhagyására | A másik fa                                                         |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------ | ----------------------------------------- | ------------------------------------------------------------------ |
| előtte (3 futás) | 3000 ms-nál `running`; `failed` csak a döntések után (3200 ... 3211 ms) | döntés után `succeeded`         | döntés után `succeeded`                                | HTTP 200, 200                             | `running`, a döntései után `succeeded`                             |
| utána (5 futás)  | `failed` 6, 5, 12, 12, illetve 11 ms-mal a bukás után                   | `failed`, `sub_workflow_failed` | `cancelled`, a `c-jov` és az `u-jov` lépés `cancelled` | HTTP 409 `conflict`, 409 `conflict`       | `running`, `c-jov` `waiting_approval`; a döntései után `succeeded` |

**A fa mechanizmus, és miért nem a `cancelRunTree`.** A felhasználói megszakítás a fa aktív
futásaira három dolgot hív: a jóváhagyás sorok lezárását (`cancelWaitingApprovalStepRuns`), a
`stopAndAwaitRunTree` menetet (`requestStop()`, a sorból kivétel, a várakozások lezárása,
`interrupt()`, a `completion` megvárása), majd a `db` `cancelRunTree` tranzakcióját és a
`run_finished` élő kiadását. Ez a sorozat most egy közös függvény (`run-interrupt/cancel-active-run-tree.ts`),
amit az `interruptRun` és a `fail_run` is hív, és csak a hatókörben térnek el. A `cancelRunTree` a
`root_run_id` szerint szűr, tehát a bukott futást (és beágyazott esetben az őseit) is `cancelled`
állapotba vinné, holott a bukott futás `failed`; ezért a `db` kapott egy `cancelRuns(runIds)`
műveletet, ugyanazzal a tranzakcióval (közös belső menet), a megnevezett futásokra szűkítve. A
leszármazottakat a motor a memóriából választja ki: a futás kézikönyve (`ActiveRunHandle`) a
`parentRunId` mezőben hordozza a szülőt, és a nyilvántartás `listDescendants` bejárása adja az
alfát. Nem az adatbázisból, mert a `step_run.sub_workflow_run_id` a gyerek futás indítása után egy
`await`-tel később íródik. A leszármazottak lezárását a léptető hurok a bukott futás
`interrupt()` hívása ELŐTT indítja (a szinkron része a sorból kivétel), a lezárulásukat utána várja.

**A `sub` lépés végállapota.** `failed`, `sub_workflow_failed` osztállyal: a SPEC-004 5.9 6. pontja
szerint a nem `succeeded` gyerek után a szülő lépés `failed`, és a 8.3 szerint a futó, megszakított
lépés a saját útján zár, a motor terminális sort nem ír át. A SPEC-003 7.2 a `running -> cancelled`
átmenetet is megengedné, az állapotgép tehát egyedül nem dönt. A felhasználói megszakításnál
ugyanez a végállapot (mérve, lent).

**A regresszió.** A `create-engine.spec.ts` négy új tesztje: a gyerek `cancelled`, a jóváhagyása
lezárul, a szülő a döntés nélkül `failed`, az utólagos döntés `illegal_status_transition`; az unoka
is `cancelled`; egy másik futás gyerek fája érintetlen; `fail_branch` határ (a gyerek a döntésig
vár). A javítás előtti kódon a három `fail_run` teszt bukott (`a futás nem érte el a várt
állapotot`), a határteszt zöld volt. Az `advance-run.spec.ts` két új esete: a lezárás pontosan
egyszer, a saját `runId`-ra, az `interrupt()` előtt; a lezárás hibája `run_execution_failed`. A
hurok hívását visszavonva öt teszt bukik (a három `create-engine` és a két `advance-run`), a
sorrendet felcserélve a sorrend teszt (`expected [ 'interrupt', …(1) ] to strictly equal [ …(2) ]`).
Plusz a `run-recovery.spec.ts` három `cancelRuns` esete, az `active-run-registry.spec.ts`
`listDescendants` esete és a `cancel-active-run-tree.spec.ts` három esete.

**Mellékes lelet, mérve, a kilencedik körben javítva (lent): a `sub_workflow_finished` esemény `status` mezője `running`.**
Mindkét úton (a `fail_run` és a felhasználói megszakítás, a javítás előtt és után is) a szülő
`sub` lépésének `sub_workflow_finished` eseménye `status: "running"` értéket hordoz, a lépés
hibaüzenete pedig "`running` állapotban zárt". Mérve a valódi szerveren: `POST
/api/runs/<id>/interrupt` a másik fára, előtte és utána is `o-sub` `failed`/`sub_workflow_failed`,
`sub_workflow_finished.status = "running"`, a gyökér `cancelled`. Az ok kódolvasásból: a
`sub_workflow` végrehajtó a gyerek `completion`-jének teljesülésekor olvassa a gyerek sorát
(`create-run-supervisor.ts` `awaitChildCompletion`), a leállított gyerek léptető hurka viszont nem ír
záró állapotot, a fa tranzakciója (`cancelRunTree`, illetve `cancelRuns`) pedig csak az összes
`completion` után fut. A lépés végállapota ettől helyes, az esemény és az üzenet nem a tényleges
terminális állapotot mondja; a javítás a megszakítás közös menetét is érintené, ezért külön döntés.

**A szabályos leállás (`SIGTERM`) ablakában érkező jóváhagyási döntés: mérve, javítva (2026-09-23,
nyolcadik kör).** Egy független ellenőrzés a `fce40c1` commiton azt mérte, hogy a hatodik kör
hibája a szabályos leállás útján megmaradt: a `shutdownActiveRuns` a döntésre váró jóváhagyás
várakozását lezárja, de a sorát nem, tehát egy futó testvér `interrupt()` utáni kimerülése alatt
beküldött döntést a `db` elfogadja. A mérés megerősítette.

| Tétel     | Érték                                                                                                                                                                                                                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Futtató   | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `62a4c9b` commitja `git archive` munkafában (előtte), illetve ugyanez a fa a javítás `packages/engine/src` mappájával (utána); a két fa kizárólag a motor forrásában tér el                                                                            |
| Szerver   | a 6. szekció felállása: a valódi `apps/server` modulok (a `registerShutdownSignalHandlers` leállási sorrendjével) és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő                            |
| Hamis     | az `a2` megszakítás nélkül 8000 ms, `interrupt()` után 1500 ms alatt zár, sikeres `result`-tal                                                                                                                                                                                                        |
| Workflow  | `start` után `a2` és `jov` (`human_approval`, `timeoutMs: null`)                                                                                                                                                                                                                                      |
| Menet     | a `jov` várakozása után nyers TCP kapcsolaton a döntési kérés (`POST /api/approvals/<id>/decision`) fejléce, törzs nélkül; 50 ms múlva `SIGTERM`; a kliens a szerver naplójában megvárja az `a2` `interrupt()`-ját, majd 200 ms múlva elküldi a törzset (`approved`)                                  |
| Kiolvasás | a döntés válasza, a kilépés után közvetlenül a fájlból a futás, a lépések, a `human_approval.decision` oszlop és a `jov` lépés eseményei; utána újraindítás ugyanazon a fájlon (`runStartupRecovery`, majd `GET /api/runs/<id>` és egy új döntés ugyanarra a jóváhagyásra), végül a fájl újraolvasása |

| Eset             | A törzs az `interrupt()` után | Az `a2` kimerülése | A döntés válasza                    | A futás vége  | `jov` lépés   | `decision` | A `jov` eseményei                    |
| ---------------- | ----------------------------- | ------------------ | ----------------------------------- | ------------- | ------------- | ---------- | ------------------------------------ |
| előtte (6 futás) | 206 ... 209 ms                | 1502 ... 1506 ms   | HTTP 200, hatból hatszor            | `interrupted` | `succeeded`   | `approved` | `step_started`, `approval_requested` |
| utána (6 futás)  | 204 ... 208 ms                | 1503 ... 1507 ms   | HTTP 409 `conflict`, hatból hatszor | `interrupted` | `interrupted` | NULL       | `step_started`, `approval_requested` |

A 409 törzsében a hibaosztály `illegal_status_transition` (a `markStepSucceeded` üzenete). A
kilépési kód mindkét esetben `0`.

| Újraindítás után | A helyreállítás   | A futás       | `jov` lépés   | `decision` | Új döntés ugyanarra a jóváhagyásra |
| ---------------- | ----------------- | ------------- | ------------- | ---------- | ---------------------------------- |
| előtte (1 futás) | 0 futást érintett | `interrupted` | `succeeded`   | `approved` | HTTP 404 `not_found`               |
| utána (5 futás)  | 0 futást érintett | `interrupted` | `interrupted` | NULL       | HTTP 409 `conflict`                |

**A végállapot: `interrupted`, nem `cancelled`.** A SPEC-004 10.2 3. pontja szerint a szabályos
leállásnál minden érintett futás és nem terminális lépése `interrupted`, a 8.3 szerint az
`interrupted` "az indulási helyreállításnak és a szabályos leállásnak fenntartott", a 10.2
"Miért `interrupted` és nem `cancelled`" bekezdése szerint a `cancelled` a felhasználó döntése. A
SPEC-003 7.2 a `waiting_approval -> interrupted` átmenetet ismeri. A kemény leállás utáni
helyreállítás is `interrupted`-et ír erre a sorra, tehát a két út a jóváhagyás lépésén azonos
végállapotra jut (10.2 "A szabályos és a durva leállás ugyanoda érkezik").

**A javítás.** Ugyanaz a mechanizmus, mint a hatodik körben, a célállapotra paraméterezve: a
`cancelWaitingApprovalStepRuns` neve `closeWaitingApprovalStepRuns` lett
(`run-interrupt/close-waiting-approval-step-runs.ts`), és egy `'cancelled' | 'interrupted'`
paramétert kapott. A felhasználói megszakítás és a `fail_run` `cancelled`-del, a
`shutdownActiveRuns` `interrupted`-del hívja, az aktív futások lekérdezése után, a
`stopAndAwaitRunTree` előtt, egyetlen `await` nélkül: a várakozás lezárása (a
`stopAndAwaitRunTree` szinkron része) és a sor lezárása ugyanabban a szinkron menetben fut. A
hatókör a kézikönyvvel bíró futások köre; egy kézikönyv nélküli futás jóváhagyására nem vár
végrehajtó, azt a `recoverInterruptedRuns` tranzakciója zárja, ugyanúgy, mint eddig. Ha az írás
hibázik, a `shutdownActiveRuns` a futások leállítása és a helyreállítás nélkül adja vissza a
hibát (a `cancelActiveRunTree` mintája); a szerver ekkor `1` kóddal lép ki, és a következő indulás
helyreállítása zár.

**A regresszió.** A `create-engine.spec.ts` új tesztje (a `shutdown()` alatt egy `interrupt()`
után csak a teszt jelére kimerülő testvér tartja nyitva az ablakot): a javítás előtt bukott
(`expected '' to contain '(illegal_status_transition)'`), utána zöld. A `shutdown-active-runs.spec.ts`
két új esete (a jóváhagyás sora már a `completion` megvárása előtt `interrupted`, a kézikönyv
nélküli futásé csak a helyreállítás után; a lezárás hibája leállítás és helyreállítás nélkül megy
vissza) a javítás előtt szintén bukott. A `close-waiting-approval-step-runs.spec.ts` a két
célállapotra paraméterezett. A leállás utáni újraindítást egy új `create-engine` teszt őrzi: a
`shutdown()` után a `runStartupRecovery` nulla futást érint, a jóváhagyás lépése `interrupted`
marad, és egy új motor példányon érkező döntés `illegal_status_transition`. Ez a teszt a javítás
előtt is zöld, mert a helyreállítás a `waiting_approval` sort is `interrupted`-be viszi; a feladata a
helyreállítás őrzése, nem az ablaké.

**A `sub_workflow_finished` esemény `status` mezője: mérve mindhárom úton, a kilencedik körben javítva (lent).** Motor
szintű próba a valódi szerveren, a hetedik kör workflow-jával (gyerek és unoka jóváhagyásra vár),
a javítás előtt és után is azonos eredménnyel:

| Út                       | A gyökér      | Gyerek, unoka | A szülő `sub` lépése            | `sub_workflow_finished.status` | A lépés üzenete             |
| ------------------------ | ------------- | ------------- | ------------------------------- | ------------------------------ | --------------------------- |
| felhasználói megszakítás | `cancelled`   | `cancelled`   | `failed`, `sub_workflow_failed` | `running`                      | "`running` állapotban zárt" |
| `fail_run` (`a1` bukik)  | `failed`      | `cancelled`   | `failed`, `sub_workflow_failed` | `running`                      | "`running` állapotban zárt" |
| szabályos leállás        | `interrupted` | `interrupted` | `failed`, `sub_workflow_failed` | `running`                      | "`running` állapotban zárt" |

Ugyanez áll a gyerek `c-sub` lépésére (az unoka futására) is. A SPEC-004 13. szekciójának
táblázata szerint az esemény "gyerek futás terminális" állapotában íródik, a payload `status`
mezővel, az 5.9 6. pont a gyerek `failed`, `cancelled` vagy `interrupted` végállapotát sorolja fel,
a motor `SubWorkflowFinishedPayload` doksija pedig "a gyerek futás terminális állapotba
lépésekor" íródó eseményt ír le: a `running` érték tehát a spec szerint hibás. A javítás módját
viszont a spec nem dönti el, mert a három szabály a leállított gyerekre egyszerre nem teljesíthető:
a fa DB zárása egy tranzakció a fa összes `completion`-je után (9. szekció 5. pont, 10.2 3. pont),
a szülő `completion`-je a `sub` lépés saját zárására vár (8.3: "a saját útján zár"), a `sub` lépés
pedig a gyerek sorát a gyerek `completion`-jekor olvassa. A megszakítás és a leállás útján a
szülő is a lezárt fában áll, tehát a végrehajtó a gyerek tényleges terminális sorát nem
várhatja meg holtpont nélkül. Ez termékdöntés. Lehetséges irányok (javaslat, nem döntés): (a) a
leállítás célállapota (`cancelled` vagy `interrupted`) a kézikönyvre kerül a `requestStop`
hívásakor, és a leállított, még nem terminális gyerekre a végrehajtó ezt adja az eseményben és az
üzenetben, a fa DB zárása előtt; (b) a leállított gyerekre a `sub` lépés nem zár és eseményt sem
ír, a sorát a fa zárása viszi `cancelled`, illetve `interrupted` állapotba, ami a 8.3 "a saját útján
zár" mondatának felülírása; (c) a fa DB zárása alulról felfelé, futásonként, ami a 9. szekció 5.
pontjának egy tranzakciós szabályát írná felül. A lépés végállapota ettől helyes a spec szerint,
csak az esemény és az üzenet mond elavult állapotot. A user az (a) irányt választotta
(2026-09-23), lásd a kilencedik kört.
Mellékmegfigyelés a szabályos leállás útjáról: a `sub` lépés itt is a saját útján zár
(`failed`), míg egy kemény leállás utáni helyreállítás ugyanezt a sort `interrupted`-be vinné; a
futó agent lépés ugyanígy a saját `result` üzenete szerint zár (a mérésben az `a2` `succeeded`). Ez
a 10.2 2. pontjából következik ("ugyanúgy, mint a 9. szekcióban"), nem ennek a körnek a tárgya.

**A `sub_workflow_finished` esemény `status` mezője: mérve, javítva (2026-09-24, kilencedik kör).**
A user döntése (2026-09-23): a leállítás pillanatában ismert célállapot (`cancelled` vagy
`interrupted`) a `requestStop` hívásakor a leállított futás kézikönyvére kerül, és a leállított,
még nem terminális gyerekre a `sub_workflow` végrehajtó ezt adja az eseményben és a lépés
üzenetében, a fa DB zárása előtt. Spec szabályt nem ír felül: a fa zárása egy tranzakció marad (9.
szekció 5. pont, 10.2 3. pont), és a `sub` lépés a saját útján zár (8.3).

**A célállapot egyezik a fa zárásával.** Kódolvasás a `packages/db` `run-recovery.ts` fájlban: a
`cancelRunTree` és a `cancelRuns` a nem terminális (`pending`, `running`) futásokat `cancelled`, a
`recoverInterruptedRuns` `interrupted` állapotba viszi, a terminálisakat nem írja át. A három út
célállapota tehát: felhasználói megszakítás `cancelled` (`cancelRunTree`), `fail_run` `cancelled`
(`cancelRuns`, user döntés 2026-09-23, `62a4c9b`), szabályos leállás `interrupted`
(`recoverInterruptedRuns`). Ha a gyerek sora a léptetése lezárulásakor már terminális (a leállítás
a saját záró írása után érte), a sor állapota dönt, mert azt a fa zárása sem írja át.

| Tétel     | Érték                                                                                                                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Futtató   | Node v26.7.0, a `feat/spec-008-futas-nezet` ág `c2639ef` commitja a munkapéldányban (előtte), illetve ugyanez a javítással (utána); a két állapot kizárólag a `packages/engine/src` mappában tér el                                                                                  |
| Szerver   | a 6. szekció felállása: a valódi `apps/server` modulok (a `registerShutdownSignalHandlers` leállási sorrendjével) és a valódi motor, fájl alapú SQLite a sandbox helyi `/tmp` alatt; **eltérés:** hamis agent futtató (valós API hívás nincs) és átengedő sablon renderelő           |
| Workflow  | a hetedik kör workflow-ja: szülő `start` után `a1` (300 ms után nem sikeres `result`) és `sub`; másik fa `start -> o-sub`; gyerek `c-jov` és `c-sub`; unoka `start -> u-jov`, minden jóváhagyás `timeoutMs: null`                                                                    |
| Menet     | a gyerek és az unoka jóváhagyásának megvárása után a megszakítás úton `POST /api/runs/<id>/interrupt` a másik fára, a `fail_run` úton a szülő terminális állapotának megvárása, a leállás úton `SIGTERM`; az első két úton utána szintén `SIGTERM`, a kilépés után a fájl kiolvasása |
| Kiolvasás | a gyökér, a gyerek és az unoka sora, a `sub` (illetve `o-sub`) és a `c-sub` lépés `sub_workflow_finished` eseményének `status` mezője, a lépés hibaüzenetében megnevezett állapot, és hogy ez a kettő egyezik-e a gyerek sorával                                                     |

| Út (5 futás útonként)    | A gyökér      | Gyerek, unoka sora | `sub`, `c-sub` lépés            | Esemény és üzenet, előtte | Esemény és üzenet, utána | Egyezik a sorral, előtte / utána |
| ------------------------ | ------------- | ------------------ | ------------------------------- | ------------------------- | ------------------------ | -------------------------------- |
| felhasználói megszakítás | `cancelled`   | `cancelled`        | `failed`, `sub_workflow_failed` | `running`                 | `cancelled`              | 0/10 / 10/10                     |
| `fail_run` (`a1` bukik)  | `failed`      | `cancelled`        | `failed`, `sub_workflow_failed` | `running`                 | `cancelled`              | 0/10 / 10/10                     |
| szabályos leállás        | `interrupted` | `interrupted`      | `failed`, `sub_workflow_failed` | `running`                 | `interrupted`            | 0/10 / 10/10                     |

Az egyezés számlálója futásonként két lépés (a gyerek és az unoka futásáé). A gyökér, a sorok és
a lépések végállapota előtte és utána azonos: a javítás csak az eseményt és az üzenetet érinti.

**A javítás.** Az `ActiveRunHandle.requestStop` a célállapotot kapja paraméterül, és a kézikönyv
`stopTargetStatus()` metódusa adja vissza; az első hívás értéke marad meg. A `stopAndAwaitRunTree`
a hívó célállapotával hívja: a `cancelActiveRunTree` (megszakítás és `fail_run`) `cancelled`-del, a
`shutdownActiveRuns` `interrupted`-del. A `run-supervisor` a gyerek léptetésének lezárulása után a
kézikönyv célállapotát a `ChildWorkflowRunResult.stopTargetStatus` mezőjébe teszi, a `sub_workflow`
végrehajtó pedig a még `running` sorú gyereknél ezt adja az eseményben és az üzenetben.

**A regresszió.** A `create-engine.spec.ts` három új tesztje (megszakítás, `fail_run`, szabályos
leállás, egy háromszintű fán) a gyerek és az unoka szintjén egyetlen állításban vizsgálja a `sub`
lépés végállapotát, a `sub_workflow_finished` események `status` mezőjét a `db` naplójából, a
lépés üzenetében megnevezett állapotot és a gyerek sorát a fa zárása után. A javítás előtt mindhárom
bukott, mindkét szinten `running` eseménnyel és üzenettel; utána zöld. Egy negyedik, határ teszt (a
nem leállított, elutasított jóváhagyás miatt `failed` gyerek) előtte és utána is zöld. Plusz az
`execute-sub-workflow.spec.ts` három új esete (a két célállapot a még `running` sorú gyereknél, és
a már terminális sorú, leállított gyerek, ahol a sor állapota dönt), a `build-child-result.spec.ts`
célállapot esete, és a `create-run-supervisor.spec.ts` bővítése: egy második `requestStop` a
célállapotot nem írja felül.
