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

## T-009-39

A megjelenítés: a két jelvény a kártya fejlécében, a kiemelés osztálya és CSS szabálya, a kapcsoló a
`Controls` utolsó gombjaként, `localStorage` tárolással (SPEC-008 6.6, O-25, O-26).

### 1. A forrás tényei, saját olvasással

| Tény                                                                                                                                                                      | Forrás                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| A forrás vonaldiagram az első sorozat vonalát `2.4` szélességgel rajzolja: `strokeWidth={seriesIndex === 0 ? 2.4 : 1.8}` (239. sor)                                       | `components/charts/LineChart.jsx` 239. sor, a `eggproject-design-components` skill forrása |
| A `Route` ikon három elemből áll: két `circle` (`6,19` és `18,5`, `r=3`) és egy `path` (`M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15`)                           | `assets/vendor/lucide.min.js`, fejléc: `lucide v0.525.0`, `Route` exportja                 |
| A React Flow `Edge.className` a `<g class="react-flow__edge ...">` elemre kerül, a vonal a `.react-flow__edge-path`                                                       | saját olvasás, `@xyflow/react` 12.11.6 telepített forrása                                  |
| A `Controls` a beépített gombok UTÁN rendereli a gyerekeit; a `ControlButton` `<button type="button" class="react-flow__controls-button">` és átadja a `...rest` propokat | saját olvasás, `@xyflow/react` 12.11.6 telepített forrása                                  |
| A beépített `.react-flow__controls-button svg` szabály `fill: currentColor` és `12px` felső korlátot ad, ezért a körvonalas ikonhoz specifikusabb felülírás kell          | saját olvasás, `@xyflow/react` 12.11.6 `style.css`                                         |

### 2. Az ikon választása

**`Route`** a vendorolt `lucide@0.525.0` készletből. Indok: két végpontot összekötő, kanyarodó utat
rajzol, ami az "összes bejárt út" jelentést hordozza, és nincs verziókezelési (merge, fork) vagy
szétválási jelentése, amit a felhasználó az elágazás csomóponttal vagy egy másik funkcióval
téveszthetne össze. A repó `packages/ui` ikonjainak konvenciója szerint `viewBox="0 0 24 24"`,
`strokeWidth="1.75"`, kerek végek, `stroke="currentColor"`, `fill="none"`, `aria-hidden`.

Megfontolt és elvetett jelöltek (mind ugyanabban a vendorolt készletben megvannak): `GitFork` (verzió
kezelési jelentés), `Waypoints` (csomópont hálózatot idéz, nem egyetlen bejárt utat), `Split` (egy
elágazás ikonja, tehát az elágazás csomópont jele lehetne, nem a bejárt utaké).

### 3. A tervezési döntések

- A tárolt módot a `BRANCH_HIGHLIGHT_MODES.find((mode) => mode === stored) ?? DEFAULT` olvassa:
  nincs `as`, nincs külön guard, és a hiányzó, ismeretlen és dobó tároló ugyanarra az alapértékre
  esik (`latest`). A tárolt érték a nyers szöveg, nem JSON.
- A kiemelés osztálya a `Edge.className` mezőn át megy (`buildRunGraphFlowEdges`, tiszta függvény),
  mert az élek happy-dom alatt nem rajzolódnak ki (M-53): az él állapota unit teszt, a kifestés nem.
- A kapcsoló csak akkor jelenik meg, ha a pillanatképben van `branch` csomópont.
- **Saját tervezési részlet, nem a SPEC szövege:** a lenyomott (`aria-pressed="true"`) gomb
  `--ep-accent-bg` hátteret és `--ep-accent` belső gyűrűt kap. A SPEC a lenyomott állapot
  megjelenéséről nem rendelkezik; csak design token szerepel benne.

### 4. Az e2e lefedettség előtte és utána

**Előtte**: saját mérés a tiszta `origin/main` (`7e61152`) állapoton (a munkamásolat `git stash`
alatt), a T-009-38 szekció eljárásával (`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, nyolc
egymás utáni `bun x playwright test --shard=<i>/8` `flock /tmp/playwright-gep.lock` alatt, majd
`bun run coverage:e2e:report`, kilépési kód 0). **478 teszt, mind zöld.** A nyers összeget a
`nyc report --reporter=json-summary` adta.

**Utána**: ugyanez az eljárás a T-009-39 állapoton. **479 teszt, mind zöld**, a
`coverage:e2e:report` kilépési kódja 0.

| Metrika    | Előtte fedett / összes | Utána fedett / összes | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1728 / 1743            | 1771 / 1786           | 15 -> 15                 |
| branches   | 804 / 815              | 828 / 839             | 11 -> 11                 |
| functions  | 571 / 574              | 582 / 585             | 3 -> 3                   |
| lines      | 1667 / 1682            | 1710 / 1725           | 15 -> 15                 |

A fedetlen tételek ugyanazon a hat fájlon maradtak (`mount-app.tsx`, `read-frontend-config.ts`,
`is-valid-connection.ts`, `browser-history-location-port.ts`, `perform-route-request.ts`,
`use-stream-connection.ts`). A küszöb nem mozdult (`apps/web/package.json`).

**Megjegyzés a T-009-38 szekció "utána" számához.** Az ott rögzített összes (1739 / 815 / 574 / 1678)
a `8413882` alapú ág állapotát írja le; a tiszta `main` összege ma 1743 / 815 / 574 / 1682. A
`8413882` és a `7e61152` között az `apps/web/src` alatt a PR #25 mellett csak a PR #26 (`4ce7de0`,
T-009-48) módosított fájlt (`git log --oneline 8413882..HEAD -- apps/web/src`), tehát a négy
statements és lines különbség a #26 termékkódjától származik; a pontos fájl szerinti bontást nem
mértem (nem ellenőrzött). A fedetlen darabszám (15 / 11 / 3 / 15) azonos, tehát a ratchet jelentése (a
fedetlen sorok száma) nem változott.

**Kontroll mérés: az új e2e teszt nélkül.** Ugyanez a nyolc shard
`--grep-invert "az elágazás kártyáján a döntésekből látszik"` kapcsolóval (az új teszt nélkül, minden
más zöld):

| Metrika    | Fedetlen az új e2e nélkül | Ebből az új kód                                                        |
| ---------- | ------------------------- | ---------------------------------------------------------------------- |
| statements | 20                        | 5 (`RunGraphCanvas.tsx` 3, `branch-highlight-mode-storage.ts` 2)       |
| branches   | 15                        | 4 (`RunGraphCanvas.tsx` 2, `resolve-highlighted-branch-edge-ids.ts` 2) |
| functions  | 5                         | 2 (`RunGraphCanvas.tsx` 1, `branch-highlight-mode-storage.ts` 1)       |
| lines      | 20                        | 5 (ugyanaz a két fájl, mint a statements soron)                        |

A meglévő e2e tesztek egyetlen `branch` csomópontos pillanatképet sem nyitnak meg döntésekkel, tehát a
kapcsoló kezelője, a tárolás és a kiemelés számítás ága e2e-ből csak az új teszttel érhető el. Az új
teszt a `branch-decision-data.spec.ts` fájlban a két jelvény szövegét és a kapcsoló `aria-pressed`
állapotát állítja (kattintás után `true`, a második után `false`), pixel mérés, újratöltés és kép
nélkül (T-009-40).

### 5. A kifestett kiemelés számított stílusa

Egyszeri számított stílus mérés a lapon (eldobott, nem commitolt Playwright szkript, kép nem készült):
a kiemelt él vonala `rgb(227, 181, 99)`, `2.4px`, a nem kiemelté `rgb(177, 177, 183)`, `1px`; a kiemelt
szín a `--ep-accent` feloldott értéke. A kifestett pixelre vonatkozó, két témás bizonyíték a T-009-40
dolga.
