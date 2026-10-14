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
- A lenyomott (`aria-pressed="true"`) gomb a design system `toggle/toggle.css` 33 ... 37. sorának
  `.toggle[aria-pressed="true"]` szabályát követi (`eggproject-design-components` skill forrása):
  `background: var(--ep-accent-bg)`, keret `--ep-accent`, szín
  `var(--ep-accent-fg, var(--ep-yolk-700))`. Az egyetlen eltérés a keret alakja: a forrás `border-color`-t állít, itt
  inset gyűrű (`box-shadow: inset 0 0 0 1px var(--ep-accent)`) fest, mert a React Flow
  `.react-flow__controls-button` `border: none` mellett csak `border-bottom` szegélyt visel (saját
  olvasás, `@xyflow/react` 12.11.6 `dist/style.css` 422 ... 428. sor), tehát a `border-color` nem
  rajzolna teljes keretet. A SPEC a lenyomott állapot megjelenéséről nem rendelkezik; csak design
  token szerepel benne. A `toggle` komponens maga nincs átemelve (O-25).

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
statements és lines különbség a #26 termékkódjától származik. A fedetlen darabszám (15 / 11 / 3 / 15)
azonos, tehát a ratchet jelentése (a fedetlen sorok száma) nem változott.

**A +4 forrása, fájl szerint mérve** (2026-10-14). A `git diff --name-only 8413882 4ce7de0 --
apps/web/src ':!*.spec.ts' ':!*.spec.tsx'` nyolc termékfájlt ad, mind a #26-é (a köztes #23, `538414d`
az `apps/web/src` alatt nem módosított fájlt). A nyolc fájl mindkét állapotát (`git show
<rev>:<fájl>`) `esbuild` 0.28.2 (`ts`/`tsx` betöltő, automatikus JSX) alakította át, majd
`istanbul-lib-instrument` 6.0.3 (`createInstrumenter({ esModules: true })`) műszerezte; a számláló a
`statementMap` kulcsainak, a `branchMap` ágainak (`locations`), az `fnMap` kulcsainak és a statementek
egyedi kezdősorainak száma. Összeg a nyolc fájlra: statements 143 -> 147, branches 71 -> 71,
functions 41 -> 41, lines 135 -> 139, vagyis +4 / 0 / 0 / +4, ami megegyezik az e2e összegek
eltérésével (1739 -> 1743, 815 -> 815, 574 -> 574, 1678 -> 1682). A változás egyetlen fájlból jön:
`run-graph/project-snapshot-graph.ts` 5 -> 9 statement és 5 -> 9 sor, 2 ág és 2 függvény mindkét
állapotban; a másik hét fájl mind a négy metrikán azonos. **Korlát:** a mérés nem a
`vite-plugin-istanbul` útján futott (a Vite saját transzformációja helyett `esbuild`), tehát a
fájlonkénti szám nem az e2e riportból való, csak az összegben egyezik vele. A mérő szkript eldobott,
nincs a repóban. Ismételhető út a repóban: a fenti "Utána" eljárás a `4ce7de0^` (ez a `538414d`) és a
`4ce7de0` állapoton, a `coverage:e2e:report` helyett vagy mellett `nyc report
--reporter=json-summary` kimenettel, ami az összeg mellett fájlonkénti sort is ad (az
`istanbul-reports` `json-summary` forrása: minden fájl külön bejegyzés a `total` mellett).

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

**Ismételhető út a repóban: erre a számra jelenleg nincs.** A mérést eldobott szkript adta, és a repó
egyetlen tesztje sem olvassa vissza a kiemelt él számított `stroke` és `stroke-width` értékét. Ami
a repóban van: a `build-run-graph-flow-edges.spec.ts` a `run-graph.css` forrásában ellenőrzi a
`--ep-accent` tokent és a `2.4` vastagságot (nem a számított stílust). A számított értéket és a
kifestett pixelt a PLAN-009 T-009-40 sora vezeti be (az `edge-paint-measurement.ts` mintájára), addig
a fenti két szám nem újrafuttatható.

### 6. A lenyomott kapcsoló számított stílusa

Egyszeri számított stílus mérés a lapon (2026-10-14, a T-009-39 állapoton a `color` szabály
felvételével; eldobott, nem commitolt Playwright szkript: a `branch-decision-data.spec.ts` második
tesztjének másolata, ami a kapcsolón a kattintás előtt és után `getComputedStyle`-t olvas, a
`colorScheme` `'light'` és `'dark'` értékével, `vite build` plusz `vite preview` ellen; kép nem
készült). A `color` az ikon `stroke` értékével azonos, mert az ikon `stroke="currentColor"`.

| Téma    | Állapot   | `color`              | `background-color`                        | `box-shadow`                              | `--ep-accent-fg` |
| ------- | --------- | -------------------- | ----------------------------------------- | ----------------------------------------- | ---------------- |
| világos | nyomatlan | `rgb(10, 18, 48)`    | `rgb(255, 255, 255)`                      | `none`                                    | `#8a6220`        |
| világos | lenyomott | `rgb(138, 98, 32)`   | `rgba(227, 181, 99, 0.16)`                | `rgb(227, 181, 99) 0px 0px 0px 1px inset` | `#8a6220`        |
| sötét   | nyomatlan | `rgb(236, 231, 218)` | `oklab(0.234469 -0.000292671 -0.0124669)` | `none`                                    | `#efcb85`        |
| sötét   | lenyomott | `rgb(239, 203, 133)` | `rgba(227, 181, 99, 0.14)`                | `rgb(227, 181, 99) 0px 0px 0px 1px inset` | `#efcb85`        |

A lenyomott szín mindkét témában a `--ep-accent-fg` feloldott értéke (`#8A6220` = `rgb(138, 98, 32)`,
`#EFCB85` = `rgb(239, 203, 133)`), az ikon színe ezt követi. Egyezik a review saját mérésével.

**Ismételhető út a repóban: a számított értékre nincs.** A szkript eldobott, és a PLAN-009 T-009-40
sora a kapcsoló két módját és az újratöltést említi, a lenyomott állapot számított színét nem. Ami
a repóban van, az forrás szintű: a `BranchHighlightToggle.spec.tsx` a `run-graph.css` lenyomott
szabályában ellenőrzi a háttér, a keret és a szín tokenjét (a `color` nélküli régi CSS-en bukik,
mérve). Az, hogy a feloldott érték tényleg a tokené, csak futó böngészőben látszik, és ezt jelenleg
semmi nem őrzi.

## T-009-40

Az e2e és a mérés: a kétszer futó elágazás fixtúrája, a kiemelés kifestett pixel mérése két témában,
a kapcsoló két módja az újratöltéssel, a két jelvény és a szándékos rontások (SPEC-008 6.6, 86.,
89., 90., 91.). Ág: `feat/spec-008-d2-e2e-meres`, az `origin/main` `019c4b4` állapotáról. Új fájl az
`apps/web/e2e/branch-highlight.spec.ts`; az `apps/web/e2e/edge-paint-measurement.ts` egy új
függvényt kapott (`measureEdgeClassPaintDifference`). Termékkód nem változott.

### 1. A fixtúra

Saját, a spec fájlban álló fixtúra (a `showcase-graph.ts` és a `branch-decision-data.spec.ts`
fixtúrája változatlan): `start` -> `branch` -> két `script` csomópont, az elágazás két kulcsos éllel
(`igen`, `nem`, a `defaultBranchKey` a `nem`), tehát a kulcs nélküli élek elhagyása (O-27, T-009-54)
erre a fixtúrára nem hat. Az elágazásnak két lépés futása van (a második `attempt: 2`), mindkettő egy
`branch_taken` döntéssel. Két forgatókönyv, csak a döntések sorrendjében eltérve:

| Forgatókönyv            | 1. döntés (`id` 2)           | 2. döntés (`id` 3)           | "csak a legutóbbi" | "minden bejárt"         | Jelvény mindkét módban |
| ----------------------- | ---------------------------- | ---------------------------- | ------------------ | ----------------------- | ---------------------- |
| a legutóbbi alapért.    | `igen`, `usedDefault: false` | `null`, `usedDefault: true`  | `ag-e-nem`         | `ag-e-igen`, `ag-e-nem` | van                    |
| csak a korábbi alapért. | `null`, `usedDefault: true`  | `igen`, `usedDefault: false` | `ag-e-igen`        | `ag-e-igen`, `ag-e-nem` | nincs                  |

Minden REST hívás `page.route()` mockon megy (a futás nézet öt végpontja). Az SSE csatorna lezárt
`page.route()` válasz: a kifestés, a jelvény és a próbálkozás tesztje a
`mockSseFramesWithoutReconnect` segédet használja, az újratöltéses teszt a `mockSseFrames` segédet,
mert az újratöltés utáni kapcsolatnak is meg kell kapnia a pótlást. A várakozás egyik vizsgált
jelvényre sem épül (a kártya állapot jelvényére vár, "sikeres"), hogy egy jelvény rontása csak a saját
tesztjét buktassa.

### 2. A kifestett pixel mérés módszere

A `.claude/CLAUDE.md` 11. szekciójának kifestett pixel szabálya, a `run-graph-paint.spec.ts`
mintájára, a valós futás nézet alakján (1440x900, a transcript panellel együtt), a "Fit View" gomb
után, mindkét témában (`colorScheme` és `eggTheme`). A `measureEdgeClassPaintDifference` két
képernyőképet készít UGYANARRÓL a kivágatról (az él befoglaló doboza, a meglévő `edgeClip`
ráhagyásával), mindkettőt a meglévő mérési szondával (a pontminta, a csomópontok és a panelek
eltüntetve, `docs/research/2026-09-09-graf-el-vonal-meres.md` 7. szekció): az elsőt az él mostani
osztályaival, a másodikat a kiemelés osztálya (`run-graph-edge--highlighted`) nélkül, amit a mérés a
DOM-ból vesz le és utána visszatesz. A szám a két kép legnagyobb csatorna eltérése, a böngésző
vászon API-ján, memóriában; képet lemezre semmi nem ír. Mért élek: "csak a legutóbbi" módban a
`ag-e-nem`, "minden bejárt" módban az `ag-e-igen` és az `ag-e-nem`; kontrollként (állítás nélkül) a
nem kiemelt `ag-e-start`.

### 3. Nyers számok és a küszöb

Saját mérés, 2026-10-14, `@playwright/test@1.62.1` chromium, a sandbox rootless konténere. Az ép
állapot a végső spec állapotán, a teljes e2e futásban és külön `--repeat-each 4` mellett
(determinisztikus, mind a négy ismétlés azonos), a rontott állapotok a termékkód ideiglenes
módosításával, egyenként, a módosítás visszaállításával (`git checkout`).

| Állapot                                                              | világos `ag-e-nem` legutóbbi | világos `ag-e-igen` / `ag-e-nem` minden | sötét `ag-e-nem` legutóbbi | sötét `ag-e-igen` / `ag-e-nem` minden |
| -------------------------------------------------------------------- | ---------------------------- | --------------------------------------- | -------------------------- | ------------------------------------- |
| ép                                                                   | 117                          | 122 / 117                               | 178                        | 180 / 178                             |
| ép kiemelés a (b2) rontás futásában (a jelvény hiányzik)             | 122                          | 121 / 122                               | 170                        | 175 / 170                             |
| (a) a kiemelés osztálya nem kerül az élre                            | 0                            | (nem fut le)                            | 0                          | (nem fut le)                          |
| (a2) a `run-graph.css` kiemelés szabályának két deklarációja törölve | 0                            | (nem fut le)                            | 0                          | (nem fut le)                          |
| részleges: csak a szín marad (a `stroke-width` törölve)              | 66                           | 66 / 66                                 | 65                         | 66 / 65                               |
| részleges: csak a vastagság marad (a `stroke` törölve)               | 57                           | (nem fut le)                            | 133                        | 132 / 133                             |

A kontroll él (`ag-e-start`, osztály nélkül) minden futásban 0 mindkét témában. A második sor
kiemelése ép (a (b2) rontás csak a jelvényt érinti), a számai mégis eltérnek az első sorétól; az
eltérés oka nem vizsgált (nem ellenőrzött feltevés: a hiányzó jelvény a kártya méretén át az él
geometriáját változtatja). Az ép tartomány a két sorból 117 ... 180. "(nem fut le)": az első állítás bukása után a teszt megáll.

**A küszöb: 58.** A hibás állapot (a kiemelés nem fest: (a), (a2)) mért legnagyobb értéke 0, az ép
állapoté legalább 117 (világos téma); az 58 a kettő egész felezőpontja (`floor(117 / 2)`), mindkét
témára egyetlen szám. **Amit a pixel küszöb nem dönt el:** a két részleges rontás a világos témában
a küszöb két oldalára esik (csak szín 66, csak vastagság 57), a sötétben mindkettő felette van; a
pixel állítás tárgya az, hogy a kiemelés látszik-e, nem a pontos szín és vastagság. Ezt a számított
stílus tesztje dönti el, és mindkét részleges rontásra, mindkét témában bukik (5. pont).

### 4. A számított stílus

A kiemelt él (`ag-e-nem`, "csak a legutóbbi" mód) számított `stroke` értéke a `--ep-accent`
feloldott értéke, a teszt saját futásában kiolvasva `rgb(227, 181, 99)` mindkét témában (egy
ideiglenes elem `stroke: var(--ep-accent)` számított értéke a vásznon belül), a számított
`stroke-width` számértéke 2.4. A nem kiemelt `ag-e-start` és `ag-e-igen` éle `rgb(177, 177, 183)` és
1, a React Flow szállított alapértéke (`@xyflow/react@12.11.6` `dist/style.css`:
`--xy-edge-stroke-default: #b1b1b7`, `--xy-edge-stroke-width-default: 1`). Ezzel a T-009-39 5.
pontjának "Ismételhető út a repóban: erre a számra jelenleg nincs" mondata a kiemelt él `stroke` és
`stroke-width` értékére nem áll tovább: a `branch-highlight.spec.ts` minden e2e futásban visszaolvassa.

### 5. Szándékos rontások és a bukó tesztek

Mindegyik a termékkód egyetlen helyének ideiglenes módosítása, a teljes `branch-highlight.spec.ts`
(8 teszt) lefuttatva, utána visszaállítva. A rövidítések: K-v és K-s a "a kiemelt él vonala eltér
ugyanannak a kivágatnak az osztály nélküli képétől, mindkét módban" (világos, sötét); S-v és S-s a "a
kiemelt él számított stroke értéke a --ep-accent feloldott értéke és 2.4 vastag, a nem kiemelté a
React Flow alapértéke"; M a "a két mód különböző élhalmazt emel ki, és újratöltés után a mentett mód
marad"; J1 a "ha a legutóbbi döntés az alapértelmezett ágra lépett, a jelvény mindkét módban áll"; J2
a "ha csak egy korábbi döntés lépett az alapértelmezett ágra, a jelvény a minden bejárt módban sem
áll"; P a "a kétszer futó elágazáson a próbálkozás jelvény "2. próbálkozás" felirattal, a kártya
dobozán belül áll".

| Rontás                                                                                                     | Hely                                     | Bukó tesztek                        |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| (a) a kiemelés osztálya nem kerül az élre (`{ ...flowEdge }` a `className` helyett)                        | `build-run-graph-flow-edges.ts`          | K-v, K-s, S-v, S-s, M, J1, J2 (7/8) |
| (a2) a kiemelés CSS szabályának `stroke` és `stroke-width` deklarációja törölve                            | `run-graph.css`                          | K-v, K-s, S-v, S-s (4/8)            |
| (b1) "csak a legutóbbi" helyett az első döntés (`slice(-1)` -> `slice(0, 1)`)                              | `resolve-highlighted-branch-edge-ids.ts` | K-v, K-s, S-v, S-s, M, J2 (6/8)     |
| (b2) a jelvény a legutóbbi helyett az első döntésből (`at(-1)` -> `at(0)`)                                 | `build-run-graph-nodes.ts`               | J1, J2 (2/8)                        |
| (b3) a jelvény bármelyik alapértelmezett döntésre (`at(-1)` -> `find((decision) => decision.usedDefault)`) | `build-run-graph-nodes.ts`               | J2 (1/8)                            |
| (b4) a döntések csökkenő `eventId` sorrendben (a "legutóbbi" mindkét felhasználójánál elrontva)            | `group-branch-decisions-by-node.ts`      | K-v, K-s, S-v, S-s, M, J1, J2 (7/8) |
| (c) a kapcsoló nem menti a módot (`storeBranchHighlightMode` hívás törölve)                                | `RunGraphCanvas.tsx`                     | M (1/8)                             |
| (d) a próbálkozás jelvény csak 2 felett (`attempt > 1` -> `attempt > 2`)                                   | `GraphNodeCard.tsx`                      | P (1/8)                             |
| részleges: csak a szín marad                                                                               | `run-graph.css`                          | S-v, S-s (2/8)                      |
| részleges: csak a vastagság marad                                                                          | `run-graph.css`                          | K-v, S-v, S-s (3/8)                 |

A (b3) az O-24 döntés pontos megsértése (a jelvény a "minden bejárt" értelemben követné a
döntéseket): egyedül a J2 fogja, és ez az a teszt, ami a "minden bejárt" módban is állítja a jelvény
hiányát. A rontatlan állapoton mind a 8 teszt zöld, a `run-graph-paint.spec.ts`, a
`branch-decision-data.spec.ts` és a `showcase-graph.spec.ts` is (22/22, egy futásban).

### 6. Az e2e lefedettség előtte és utána

**Előtte**: saját mérés a tiszta `origin/main` (`019c4b4`) állapoton, a T-009-38 szekció eljárásával
(`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, nyolc egymás utáni
`bun x playwright test --shard=<i>/8` `flock /tmp/playwright-gep.lock` alatt, majd
`bun run coverage:e2e:report`, kilépési kód 0, a nyers összeg `nyc report --reporter=json-summary`
kimenetéből). **479 teszt, mind zöld.**

**Utána**: ugyanez az eljárás a jelen ág állapotán. **487 teszt, mind zöld** (a 8 új teszttel), a
`coverage:e2e:report` kilépési kódja 0.

| Metrika    | Előtte fedett / összes | Utána fedett / összes | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1771 / 1786            | 1771 / 1786           | 15 -> 15                 |
| branches   | 828 / 839              | 828 / 839             | 11 -> 11                 |
| functions  | 582 / 585              | 582 / 585             | 3 -> 3                   |
| lines      | 1710 / 1725            | 1710 / 1725           | 15 -> 15                 |

A fedetlen tételek fájlonkénti listája (a `nyc report --reporter=text` 100 alatti sorai) a két
állapoton betűre azonos, ugyanaz a hat fájl, mint a T-009-39 szekcióban. Az összes sem változott,
mert termékkód nem változott, és az új tesztek a már fedett kódot futtatják. A küszöb nem mozdult
(`apps/web/package.json`).
