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
(2) A várakozás lezárása és a záró írás közti ablakban (egy futó, megszakított testvér folyamának
kimerülése alatt) érkező döntés átmegy: motor szintű próba, a testvér folyamát a próba tartja
nyitva; `fail_run` mellett a döntés sikeres, a jóváhagyás `succeeded`, a futás `failed`; a
felhasználói megszakításnál ugyanígy, a futás `cancelled`. (3) A `fail_run` a testvér `sub_workflow`
gyerek futását nem állítja le: motor szintű próba, a gyerek `start -> human_approval`, a szülő a
bukás után sem terminális.

**Leállás közben a 503.** Ugyanezen a szerveren a 6. szekció félbe küldött indító kérése a javítás
után `503 Service Unavailable` választ kap, a törzsben `service_unavailable` kóddal és
`engine_shutting_down` hibaosztállyal; futás nem jön létre, a kilépés 3035 ms. A kód forrása az
RFC 9110 15.6.4 (<https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable>),
megerősítve az IANA HTTP státusz regiszterrel
(<https://www.iana.org/assignments/http-status-codes/http-status-codes.xhtml>) és az MDN
leírásával (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/503>). A
`Retry-After` fejléc az RFC szerint elhagyható ("MAY"), és nincs forrásunk az újraindulás idejére,
ezért nem küldjük.
