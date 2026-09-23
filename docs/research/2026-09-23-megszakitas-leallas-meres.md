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
