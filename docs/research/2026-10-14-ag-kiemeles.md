# A futás nézet ág kiemelése és jelvényei (PLAN-009 D2 munkacsomag)

**Dátum:** 2026-10-14
**Ág:** `feat/spec-008-d2-futas-nezet`, az `origin/main` `8413882` állapotáról
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `@playwright/test@1.62.1` (chromium), a sandbox
rootless konténere (`.claude/CLAUDE.md` 12. szekció, `LD_LIBRARY_PATH` kerülő).

A D2 munkacsomag (PLAN-009 F9: T-009-38, T-009-39, T-009-40, T-009-54) mért tényeinek és e2e
lefedettségi darabszámainak tárolója. Minden lépés a saját szekciójába ír.

## T-009-38

Az adat réteg: a `branch_taken` keret olvasója, a döntés gyűjtő hook, a döntések csomóponthoz
kötése, a kiemelés tiszta függvénye és a két jelvény adata a kártyán (SPEC-008 6.6, 87., 88.).

### 1. A felhasznált tények, forrással

| Tény                                                                                                                           | Forrás                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| A motor a `branch_taken` payloadot `{ branchKey, usedDefault }` alakban írja, és alapértelmezett ágnál a `branchKey` `null`    | `packages/engine/src/node-executor/execute-branch.ts` (`executeBranch`), `engine-event/branch-taken-payload.ts`              |
| A `branch_taken` lépés szintű esemény, a `stepRunId` mindig szöveg; a drót sémában a mező nullázható                           | `packages/engine/src/engine-event/engine-event.ts` (az unió doksija), `packages/protocol/src/transcript/run-event-record.ts` |
| A `run_event.payload` a dróton `z.unknown()`                                                                                   | `packages/protocol/src/transcript/run-event-record.ts`                                                                       |
| A `BranchNodeConfig.defaultBranchKey` `string \| null`; a `WorkflowEdgeInput.branchKey` `string \| null`                       | `packages/protocol/src/node-config/node-config.ts`, `workflow/workflow-graph-document.ts`                                    |
| A `branch_taken` nem jelző keret a lépés futás lista újratöltéséhez, tehát a döntések gyűjtése nem indít `listStepRuns` kérést | `apps/web/src/run-view/is-step-run-list-change-frame.ts` (`STEP_RUN_CHANGING_KINDS`)                                         |
| Egy "legutóbbi érték" alakú React állapot löketben érkező keretnél keretet veszít; a függvény alakú frissítés mindet megkapja  | `docs/research/2026-09-23-transcript-panel-meresek.md` 1. szekció, `.claude/CLAUDE.md` 12. szekció                           |

### 2. A tervezés, röviden

- `read-branch-decision.ts`: a nézett futás `run_event` keretéből `BranchDecision` vagy
  `undefined`; a payload mezőit a `typeguards` `isRecord`, `isString` és `isBoolean` guardja
  olvassa. Nem döntés: más futás kerete, más `kind`, lépés futás nélküli keret, hibás payload.
- `use-branch-decisions.ts`: a `subscribeToFrames` úton, keretenként, függvény alakú
  állapotfrissítéssel, `eventId` szerint kulcsolt térkép; ismétlődő `id`-re a korábbi térkép marad.
- `group-branch-decisions-by-node.ts`: a döntés a lépés futás lista `nodeId` mezője szerinti
  csomóponthoz kerül, növekvő `eventId` szerint; a még le nem képezhető döntés kimarad, és a lista
  frissülése után leképeződik (minden renderen újraszámol).
- `resolve-highlighted-branch-edge-ids.ts`: a `latest` és az `all` mód, a `usedDefault` két ága, a
  `null` kulcs kizárása; a futás nézet még nem hívja (T-009-39 köti be a kapcsolóval).
- `build-run-graph-nodes.ts`: a kártya adata az `attempt` mezőt a megjelenített lépés futásból, a
  `usedDefaultBranch` jelzőt a csomópont legutóbbi döntéséből kapja; a kiemelés módja nem bemenet
  (O-24).

### 3. Az e2e lefedettség előtte és utána

**Előtte**: a `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 47. szekciójából ÁTVETT szám,
nem a `8413882` állapoton újra mért érték. A 47. szekció alapja (`95f62db`) óta a `8413882`
állapotig az `apps/web/e2e` alatt a PR #21 (`0310262`) bővítette a `run-view.spec.ts` fájlt
(`git diff --stat 95f62db 8413882 -- apps/web/e2e`). Az `apps/web/src` termékkódja nem változott:
ott egyetlen fájl módosult, a `greppable-invariants/greppable-invariants.spec.ts`
(`git diff --stat 95f62db 8413882 -- apps/web/src packages/ui/src`), ami teszt fájl, a termék
bundle nem importálja, tehát az istanbul mérésbe nem kerül be. A `run-view.spec.ts` bővítésének
hatását az átvett számra nem vizsgáltam (nem ellenőrzött).

**Utána**: saját mérés a jelen ág állapotán, a 47. szekció tiszta eljárásával
(`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, az `apps/web` alatt
`bun x playwright test --shard=<i>/8` nyolc egymás utáni futásban, mindegyik
`flock /tmp/playwright-gep.lock` alatt és a config `workers: 3` értékével, végül
`bun run coverage:e2e:report`, kilépési kód 0). A shardolás oka a sandbox: egy eszközhívás
futásideje korlátos, és a háttérbe tett folyamat a hívás végén leáll (saját megfigyelés), tehát a
teljes futás egy hívásban nem fér el. A nyolc shard együtt **478 teszt, mind zöld**.

| Metrika    | Előtte fedett / összes | Utána fedett / összes | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1682 / 1697            | 1724 / 1739           | 15 -> 15                 |
| branches   | 784 / 795              | 804 / 815             | 11 -> 11                 |
| functions  | 562 / 565              | 571 / 574             | 3 -> 3                   |
| lines      | 1622 / 1637            | 1663 / 1678           | 15 -> 15                 |

A mérést a commitolt állapoton, a kódkommentek utolsó javítása után, mind a nyolc sharddal megismételtem, azonos számokkal. A fedetlen tételek ugyanazon a hat fájlon maradtak, mint a 47. szekcióban (`mount-app.tsx`,
`read-frontend-config.ts`, `is-valid-connection.ts`, `browser-history-location-port.ts`,
`perform-route-request.ts`, `use-stream-connection.ts`). A küszöb nem mozdult
(`apps/web/package.json`).

**Kontroll mérés: az új e2e teszt nélkül.** Ugyanez a nyolc shard
`--grep-invert "a branch_taken keretek mellett"` kapcsolóval, tehát az új
`apps/web/e2e/branch-decision-data.spec.ts` teszt nélkül (477 teszt, mind zöld):

| Metrika    | Fedetlen az új e2e nélkül | Ebből az új kód                                                                                                                    |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| statements | 33                        | 17 (`group-branch-decisions-by-node.ts` 8, `read-branch-decision.ts` 7, `use-branch-decisions.ts` 2)                               |
| branches   | 23                        | 12 (`build-run-graph-nodes.ts` 1, `group-branch-decisions-by-node.ts` 3, `read-branch-decision.ts` 6, `use-branch-decisions.ts` 2) |
| functions  | 5                         | 2 (`group-branch-decisions-by-node.ts` 1, `use-branch-decisions.ts` 1)                                                             |
| lines      | 33                        | 17 (ugyanaz a három fájl, mint a statements soron)                                                                                 |

A meglévő e2e tesztek egyetlen érvényes `branch_taken` keretet sem küldenek (a
`transcript-panel.spec.ts` egyetlen ilyen sora `{}` payloadot hordoz), tehát az új kód érvényes
döntés ága e2e-ből csak az új teszttel érhető el. Az új teszt a futás nézet valós alakján, egy lezárt
`page.route()` SSE válaszban két érvényes döntést, egy ismétlődő `id`-t, egy más futáshoz tartozó,
egy le nem képezhető és négy hibás alakú keretet küld, és azt állítja, hogy a nézet nem törik el, a
transcript nyolc sort kap, és a futás nézet az öt meglévő végponton kívül REST hívást nem indít.

**Nyitva (nem vizsgált): a `run-view/blocking-failure-message.ts` 17. sora a kontroll futásban.** A
kontroll futásban az új kódtól független tétel, a fájl 17. sora (`return failure.message;`,
1 statement) is fedetlen maradt, a teljes futásban viszont fedett volt. Az ingadozás oka nem
vizsgált, ezért itt csak a megfigyelés áll, magyarázat nincs.

- **Mi a viselkedés addig:** a kontroll tábla "Fedetlen az új e2e nélkül" oszlopa ezt az új
  kódtól független tételt is tartalmazza, az új kód hatását az "Ebből az új kód" oszlop adja.
  Az "Utána" tábla (teljes futás, a tétel fedett) és a küszöb nem érintett.
- **Mi zárná le:** a kontroll futás megismétlése, és annak megállapítása, hogy a teljes
  futásban mely e2e teszt fedi a 17. sort, illetve hogy a kontroll futásban minden ismétlésnél
  fedetlen marad-e.

**Az e2e-ből most el nem érhető új kód.** A `resolve-highlighted-branch-edge-ids.ts` függvényt a
termékkód még nem hívja (a T-009-39 köti be), ezért a lap nem tölti be, és az istanbul mérésben nem
szerepel; a `branch-decision.ts` és a `branch-highlight-mode.ts` típus-only. Mindhárom unit
teszttel fedett (a két típus-only fájlnak nincs futásidejű kódja), a unit lefedettség 100 százalék.
