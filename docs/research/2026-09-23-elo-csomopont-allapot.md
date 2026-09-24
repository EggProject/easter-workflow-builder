# A csomópontok élő állapota és a löketben érkező keretek (PLAN-009 T-009-25a)

Dátum: 2026-09-23. Minden szám saját, most futtatott mérés a pinelt `react@19.2.8` és
`@playwright/test@1.62.1` (chromium) ellen, hacsak a sor mást nem mond. A kódhelyekre tett
állítások a repó `eede38b` állapotának olvasásából származnak, fájlnévvel megnevezve.

## 1. A hiba, mérve

Egy független ellenőrzés valódi böngészőben két hibát talált; mindkettőt újra lemértem az új e2e
tesztekkel (`apps/web/e2e/sse-real-server.spec.ts`, a hibrid SSE út: `node:http` teszt szerver,
nyitva maradó kapcsolat, menet közben beszúrt keretek) a `eede38b` commit termékkódja ellen. A
löket teszteknél a keretek EGYETLEN `write` hívással mennek ki (`pushBatch`), ahogy a szerver a
pótlást és a végén szinkron a `replay_complete` keretet írja (`apps/server`
`handle-stream-connection.ts` `replayRun`).

| Teszt                                                                 | `eede38b` termékkód                                                        | T-009-25a után |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| élő `step_started` után "fut" jelvény a csomóponton                   | bukik: a `rf__node-n1` alatt a "fut" felirat 5000 ms alatt sem jelenik meg | zöld           |
| ugyanez, `step_finished` után "sikertelen"                            | bukik, ugyanott                                                            | zöld           |
| ezer keretes pótlás egy löketben, utána "sikeres"                     | bukik: a "sikeres" felirat nem jelenik meg                                 | zöld           |
| `run_finished` plusz `replay_complete` egy löketben, a fejléc lezárul | bukik: az "Újraindítás" gomb nem jelenik meg                               | zöld           |
| futás előzmények: `run_event` plusz `protocol_error` egy löketben     | bukik: a `listRuns` hívások száma 1 marad, várt 2                          | zöld           |

**Az első hiba oka**: a futás nézet a `listStepRuns` választ csak megnyitáskor töltötte be, élő
frissítés a tervben sem volt (PLAN-009 T-009-25a bevezetője). **A második oka**: a `lastFrame`
állapot egy löketből csak az utolsó keretet adja át (`2026-09-23-transcript-panel-meresek.md` 1.
szekció), és ez az újratöltést kiváltó jelzéseket is elnyeli, mert a jelzés szűrője is csak az
utolsó keretet látja.

## 2. A két út: keretből közvetlenül, vagy újratöltés

**(a) A keretből közvetlenül frissített állapot** nem helyes, három okból, mindhárom kódhelyen
ellenőrizve:

1. A `run_event.payload` a dróton `unknown` (`packages/protocol`
   `transcript/run-event-record.ts`), tehát a klienshez a motor payload alakja nem érkezik
   típusosan; a kliens oldalon újra kellene írni a motor payload sémáit.
2. A `step_started` payloadja (`packages/engine` `engine-event/step-started-payload.ts`) nem
   hordozza a `parentStepRunId` mezőt (a `fan_out` összesítés alapja) és a `subWorkflowRunId`
   értéket, tehát a keretből épített sor hiányos.
3. A megszakítás (`packages/db` `run-recovery.ts` `cancelRunTree`) és a helyreállítás
   (`recoverInterruptedRuns`) a nem terminális lépéseket lépés szintű esemény NÉLKÜL zárja le,
   futásonként egyetlen `run_finished`, illetve `run_interrupted` eseménnyel. A keretből frissített
   állapot a megszakított lépést futónak mutatná.

**(b) Az újratöltés** helyes pótláskor és élő fázisban is, mert a sorrend a szerver oldalon kötött:
a motor az adatbázist módosítja, UTÁNA írja az eseményt (`packages/engine`
`node-executor/emit-engine-event.ts`, `begin-step-run.ts`, `finish-step-run-succeeded.ts`), a
szerver pedig az adatbázisból olvasott sort küldi ki (`handle-stream-connection.ts`
`handleSignal`). Egy keret megérkezésekor tehát a `GET /api/runs/{runId}/steps` válasza már a
megváltozott sort adja.

**A választott út: (b)**, két kiegészítéssel a kérés vihar ellen:

- **A pótolt keret nem jelez, a pótlás végi `replay_complete` igen.** A szerver a pótlás minden
  keretét egy menetben írja, a végén szinkron a `replay_complete` keretet, tehát az erre indított
  egyetlen újratöltés a pótlásban szereplő minden változást tartalmazza.
- **Az újratöltések összevonva futnak** (`apps/web/src/request-state/create-coalesced-reload.ts`):
  egyszerre legfeljebb egy kérés áll folyamatban, a futása alatt érkező bármennyi jelzés egyetlen
  utólagos kérést ad. Ez a löketben érkező élő keretekre (például egy `fan_out` sok egyszerre
  induló ágára) ad felső korlátot.

A jelző `kind` értékek és a forráshelyük: `apps/web/src/run-view/is-step-run-list-change-frame.ts`
fejléce.

## 3. A kérés vihar mérése

**Módszer.** A lapon belüli számláló a `fetch` hívásba kötve, a betöltés előtt (`addInitScript`):
a kérés KIADÁSAKOR nő, nem a Playwright route kezelőjében, ami aszinkron fut, és egy késve
meghívott kezelő miatt lemaradhatna a felület állapotától. A löket 1000 pótolt `run_event` keret
(`step_started`, `sdk_assistant`, `sdk_user`, `step_finished` váltakozva), a végén a futás
`replay_complete` kerete, egyetlen `write` hívással.

| Eset                                               | `listStepRuns` kérések száma                      |
| -------------------------------------------------- | ------------------------------------------------- |
| megnyitás, a pótlás előtt                          | 1                                                 |
| ezer keretes pótlás egy löketben, a "sikeres" után | 2 (a megnyitás és a `replay_complete` újratöltés) |
| utána egy élő `step_finished` keret                | 3                                                 |

Unit szinten (`use-live-step-runs.spec.tsx`), egy render kötegben: 1000 pótolt keret plusz
`replay_complete` összesen 2 kérést ad, 1000 élő `step_started` keret összesen 3 kérést (a
megnyitás, egy futó és egy utólagos). A futás előzmények képernyőn 1000 `run_event` keret egy
kötegben 2 további `listRuns` kérést ad (`run-history-screen.spec.tsx`).

## 4. Szándékos rontások, mindegyik a hozzá tartozó teszttel

Minden rontás után a hozzá tartozó teszt elbukott, a visszaállítás után zöld lett.

| Rontás                                                             | Bukó teszt és üzenet                                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a teljes termékkód visszaállítása `eede38b`-re                     | mind az öt új e2e teszt, lásd az 1. szekció táblázatát                                                                                                                       |
| a pótolt keret is jelez (a `delivery === 'live'` feltétel törölve) | e2e ezer keretes pótlás: `Expected: 2, Received: 3`; unit: `expected true to be false`, illetve `to have a length of 2 but got 3`                                            |
| összevonás nélküli újratöltés                                      | `createCoalescedReload`: `expected 1001 to be 1`; `useLiveStepRuns`: `to have a length of 3 but got 1001`; futás előzmények: `expected 1001 to be 3`                         |
| a hook nem tölt újra jelző keretre                                 | e2e: a "fut" felirat nem jelenik meg; unit: hat teszt, például `to have a length of 2 but got 1`                                                                             |
| a futás váltáskor késve érkező régi válasz nincs eldobva           | `useLiveStepRuns`: `expected [ { … runId: 'r-1', … } ] to deeply equal [ { … runId: 'r-2', … } ]`; e2e (`run-view.spec.ts`): a `run-2` nézetében a "sikeres" felirat eltűnik |
| a futás vége felismerése "legutolsó keret" állapoton               | e2e: az "Újraindítás" gomb nem jelenik meg; unit: `expected [ '/api/runs/r-3' ] to have a length of 2 but got 1`                                                             |
| a futás előzmények frissítése "legutolsó keret" állapoton          | e2e: `Expected: 2, Received: 1`; unit: `expected 1 to be 2`                                                                                                                  |

## 5. Ami NEM ELLENŐRZÖTT

- **Firefox és WebKit** ellen nem futott mérés: az `apps/web/playwright.config.ts` ma kizárólag
  chromiumot definiál.
- **A valódi `apps/server` elleni végpontok közötti mérés.** A teszt szerver a pótlást egyetlen
  `write` hívással küldi; a valódi `replayRun` keretenként ír, egy szinkron menetben. A mérés
  eredménye (két kérés) a jelző szabályból következik, nem a hálózati darabolásból, de a valódi
  szerver elleni mérés nem futott.
- **A párhuzamossági helyre váró ügynök lépés `pending` állapota** esemény nélkül jön létre
  (`packages/engine` `agent-node-lifecycle.ts`), tehát a rajz a következő jelző keretig nem mutatja.
  Kódolvasásból származik, nem mérésből; a SPEC-008 6.2 kimondott korlátként rögzíti.
- **Megfigyelés, a lépés hatókörén kívül, nem mérve.** A szerver a feliratkozásokat memóriában
  tartja (`apps/server` `stream-registry/create-stream-registry.ts`), a futás nézet pedig a
  feliratkozását csak a futás, a `streamId` vagy a konfiguráció változására küldi újra
  (`RunViewScreen.tsx`), a `serverRestartCount` változására nem. Kódolvasás szerint egy szerver
  újraindulás után a futás nézet nem kap több keretet; ezt mérés nem igazolta.
