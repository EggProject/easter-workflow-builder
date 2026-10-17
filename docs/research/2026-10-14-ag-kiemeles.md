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

**Lezárva (2026-10-14, `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 48. szekció): a
`run-view/blocking-failure-message.ts` 17. sora a kontroll futásban.** A kontroll futásban az új
kódtól független tétel, a fájl 17. sora (`return failure.message;`, 1 statement) is fedetlen
maradt, a teljes futásban viszont fedett volt. Az ok: a sort a meglévő e2e tesztek közül csak a
`run-control.spec.ts` két indítás tesztje érte el, mellékhatásként (a futás nézet hiányzó
mockjainak 404-e, a hibás renderelést a teszt nem várja meg), ezért a találatszám időzítéstől
függött. A javítás két új, determinisztikus `run-view.spec.ts` teszt, amelyek a hibás renderelést
megvárják.

- **Mi volt a viselkedés addig:** a kontroll tábla "Fedetlen az új e2e nélkül" oszlopa ezt az új
  kódtól független tételt is tartalmazta, az új kód hatását az "Ebből az új kód" oszlop adta. Az
  "Utána" tábla (teljes futás, a tétel fedett) és a küszöb nem volt érintett.
- **Mi zárta le:** a 48. szekció mérése: a teljes futásban pontosan két teszt érte el a sort, és a
  két teszt külön ismételve nem minden futásban; az új tesztek önállóan, ismételve is minden
  futásban elérik, és a fedetlen darabszám a javítás előtt és után azonos.

**Az e2e-ből most el nem érhető új kód.** A `resolve-highlighted-branch-edge-ids.ts` függvényt a
termékkód még nem hívja (a T-009-39 köti be), ezért a lap nem tölti be, és az istanbul mérésben nem
szerepel; a `branch-decision.ts` és a `branch-highlight-mode.ts` típus-only. Mindhárom unit
teszttel fedett (a két típus-only fájlnak nincs futásidejű kódja), a unit lefedettség 100 százalék.

## T-009-39

A megjelenítés: a két jelvény a kártya fejlécében, a kiemelés osztálya és CSS szabálya, a kapcsoló a
`Controls` utolsó gombjaként, `localStorage` tárolással (SPEC-008 6.6, O-25, O-26).

### 1. A forrás tényei, saját olvasással

| Tény                                                                                                                                                                      | Forrás                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A forrás vonaldiagram az első sorozat vonalát `2.4` szélességgel rajzolja: `strokeWidth={seriesIndex === 0 ? 2.4 : 1.8}` (239. sor)                                       | `components/charts/LineChart.jsx` 239. sor, a `eggproject-design-components` skill forrása                                                                                     |
| A `Route` ikon három elemből áll: két `circle` (`6,19` és `18,5`, `r=3`) és egy `path` (`M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15`)                           | `assets/vendor/lucide.min.js`, fejléc: `lucide v0.525.0`, `Route` exportja                                                                                                     |
| A React Flow `Edge.className` a `<g class="react-flow__edge ...">` elemre kerül, a vonal a `.react-flow__edge-path`                                                       | saját olvasás, `@xyflow/react` 12.11.6 `dist/esm/index.js` 3031-3034. sor (a `<g>` `className` listája, `edge.className` a 3034.) és 2588. sor (`react-flow__edge-path`)       |
| A `Controls` a beépített gombok UTÁN rendereli a gyerekeit; a `ControlButton` `<button type="button" class="react-flow__controls-button">` és átadja a `...rest` propokat | saját olvasás, `@xyflow/react` 12.11.6 `dist/esm/index.js` 4587-4589. sor (`ControlButton`) és 4622. sor (a `Controls` a `children` értéket a beépített gombok után rendereli) |
| A beépített `.react-flow__controls-button svg` szabály `fill: currentColor` és `12px` felső korlátot ad, ezért a körvonalas ikonhoz specifikusabb felülírás kell          | saját olvasás, `@xyflow/react` 12.11.6 `dist/style.css` 438-443. sor                                                                                                           |

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

Lezárva: a `T-009-40` 4. pontja szerint a `branch-highlight.spec.ts` minden e2e futásban visszaolvassa.

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

## T-009-54

A kulcs nélküli elágazás kimenet megszüntetése és a régi, kulcs nélküli elágazás élek elhagyása a
futás nézetben (SPEC-008 5.1, O-23, O-27, 106., a 108. unit és futás nézet része). Ág:
`feat/spec-008-d2-kulcs-nelkuli-kimenet`, az `origin/main` `019c4b4` állapotáról.

### 1. A felhasznált tények, forrással

| Tény                                                                                                                                                               | Forrás                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| A kártya kimenő handle-jeinek készletét a csomópont `type` mezője választja ki (`GRAPH_NODE_CATALOG`), a `branch` ágat a `config.type` szűkíti                     | `apps/web/src/graph-node-card/GraphNodeCard.tsx` (`resolveOutputHandles`), `graph-node-catalog/graph-node-catalog.ts` |
| A `WorkflowNodeInputSchema` a `type` és a `config.type` mezőt nem kapcsolja össze                                                                                  | a `GraphNodeCard.tsx` doksija, `packages/protocol/src/workflow/workflow-graph-document.ts`                            |
| A `null` handle azonosítójú élt a React Flow az első handle-hez kötve rajzolja                                                                                     | SPEC-008 M-111; saját mérés: a 3. pont (b) rontása, a szűrő nélkül a régi él a vásznon van (7 él a várt 6 helyett)    |
| A motor a `null` kulcsú kimenő élt soha nem követi                                                                                                                 | SPEC-008 M-106, 6.6 3. pont                                                                                           |
| A fix kimenetű típusok névtelen kimenete (`start`, `agent_step`, `fan_out`, `join`, `sub_workflow`, `script`, az `error_handler` első kimenete) `null` azonosítójú | `graph-node-catalog.ts` (`SINGLE_UNNAMED_OUTPUT`, `error_handler` bejegyzés)                                          |

### 2. A tervezési döntések

- **A kártya.** A `resolveOutputHandles` `branch` ága pontosan a `config.branches` listát képezi le
  (`id: key`, `label`); a `null` azonosítójú "Alapértelmezett" bejegyzés és a hozzá tartozó
  `eslint-disable` sor törölve. A `key={handle.id ?? 'default'}` megmaradt, mert a fix kimenetű
  típusok névtelen handle-je továbbra is `null` azonosítójú.
- **A szűrő** (`graph-node-card/omit-keyless-branch-edges.ts`): `(nodes, edges)` bemenet, a
  `branch` **`type`** mezőjű csomópontok azonosítóinak halmaza, és az él akkor marad ki, ha a
  `branchKey` `null` és a forrása ebben a halmazban van. A SPEC-008 5.1 1. pontja "a forrás
  csomópontja `branch` típusú" alakban fogalmaz; a `type` mező választás oka, hogy a kártya
  kimenetkészletét is ez választja ki. A két mező eltérésének két esete: `type: 'branch'` és nem
  `branch` config mellett a kártya nulla kimenetet rajzol, az él elmarad; `type: 'agent_step'` és
  `branch` config mellett a kártya a fix névtelen kimenetet rajzolja, az él megmarad. A listában nem
  szereplő forrás éle megmarad. A szignatúra a szerkesztő (`WorkflowNodeInput`/`WorkflowEdgeInput`,
  `graph-editor-document-projection.ts`) és a futás nézet alakjával egyezik, tehát a T-009-55
  átalakítás nélkül hívhatja.
- **A bekötés** a `RunGraphCanvas` egy `useMemo` lépésében, a pillanatkép vetítése után, a
  `buildRunGraphFlowEdges` és a `resolveHighlightedBranchEdgeIds` előtt: mindkettő a szűrt listát
  kapja. A `project-snapshot-graph.ts` nem változott (a D3 fájlja, SPEC-008 11.4 3. pont), a
  pillanatkép sora sem.
- **A bemutató fixtúra.** A `branch` csomópont ötödik ága `{ key: 'feldolgozas', label:
'Feldolgozás' }`, a `defaultBranchKey` erre mutat, az `e-branch-loop` `sourceHandle` és
  `branchKey` mezője `'feldolgozas'`. A kulcs és a címke neve saját választás (a PLAN-009 csak annyit
  ír elő, hogy az él saját kulcsot kap); a célcsomópont "Forrásonkénti feldolgozás" címkéjéből
  származik, a többi ág kulcsának mintájára. A handle-ek száma nem változott (korábban négy ág plusz
  az "Alapértelmezett", most öt ág), tehát az elrendezés sem; az `e-branch-loop` a kártya ötödik
  (legalsó) kimenetéből indul, korábban az M-111 szerint az elsőből.
- **A képernyőképek.** A fixtúra lenyomata megváltozott, a `screenshot-pipeline` (6) invariánsa a
  `test` kapun bukott (a várt és a tárolt `fixtureSha256` eltért). A `bun run screenshots` lefutott
  (8 kép, mind zöld), a manifeszt `fixtureSha256` értéke frissült (`captureScriptSha256` és az
  éllisták változatlanok); a képeket átnéztem (`editor-no-selection-light`, `editor-panel-dark`,
  `run-view-dark`, `graph-edges-light`): az elágazás kártyán öt kimenet áll, az `e-branch-loop` a
  legalsóból fut a "Ciklus" kártyához, minden él kifestett. A képek nincsenek a repóban
  (`.gitignore`), csak a manifeszt.

### 3. A szándékos rontások

Mindegyik rontás ideiglenes volt, a fájl utána visszaállítva; a visszaállított állapoton minden
felsorolt teszt zöld.

**(a) A szűrő `branch` feltételének elhagyása** (a PLAN-009 elfogadási kritériuma):
`return edges.filter((edge) => edge.branchKey !== null);`. Unit, 7 bukás:

- `omit-keyless-branch-edges.spec.ts`: "az agent_step null kulcsú élét megtartja", "az error_handler
  null kulcsú élét megtartja, a kulcsos on_error élével együtt", "a csomópont listában nem szereplő
  forrás null kulcsú élét megtartja", "a forrás típusát a csomópont type mezője adja, nem a
  config.type", "vegyes listán csak a kulcs nélküli elágazás élt hagyja el, a sorrendet megtartja";
- `RunGraphCanvas.spec.tsx`: "a pillanatkép csomópontjaiból és éleiből épít, a kártya adatát
  továbbadva", "a régi, kulcs nélküli elágazás élek (O-27) > a branch forrású, null kulcsú él nem jut a
  vászonra, a többi él igen".

E2e, 8 bukás: a `keyless-branch-edges.spec.ts` "egy kulcs nélküli elágazás élt tartalmazó
pillanatképre a futás nézet ezt az élt nem rajzolja, a többit igen" (`rf__edge-k-e-start` nincs a
DOM-ban) és "a futás nézetben az elágazás kártyája ágankénti egy, kulcsos kimenetet rajzol", valamint
a `run-graph-paint.spec.ts` mind a hat tesztje (mindkét témában; `rf__edge-e-start-branch` nincs a
DOM-ban). A `showcase-graph.spec.ts` zöld maradt, mert a szerkesztőt méri, ott a szűrő még nincs
bekötve (T-009-55).

**(b) A szűrő bekötésének elhagyása a `RunGraphCanvas`-ból** (a `visibleEdges` helyett az `edges`).
Unit, 1 bukás: "a branch forrású, null kulcsú él nem jut a vászonra, a többi él igen". E2e, 1 bukás:
a régi élű pillanatkép tesztje, `locator('.react-flow__edge')` 6 helyett 7. Ez egyben a saját mérés
az M-111 tényre: a `null` handle azonosítójú régi él a szűrő nélkül a vásznon van.

**(c) A kulcs nélküli "Alapértelmezett" handle visszahelyezése a `resolveOutputHandles`-be.** Unit, 2
bukás a `GraphNodeCard.spec.tsx`-ben (a `branch` handle lista és az üres ág listájú `branch`); e2e, 3
bukás: a `graph-node-card.spec.ts` elágazás tesztje és a `keyless-branch-edges.spec.ts` két handle
tesztje (szerkesztő és futás nézet).

### 4. Az e2e lefedettség előtte és utána

**Előtte**: saját mérés a tiszta `019c4b4` állapoton, a módosítások előtt, a T-009-38 szekció
eljárásával (`rm -rf apps/web/e2e/.nyc_output apps/web/coverage-e2e`, nyolc egymás utáni
`bun x playwright test --shard=<i>/8` `flock /tmp/playwright-gep.lock` alatt, majd
`bun run coverage:e2e:report`, kilépési kód 0, a nyers összeg `nyc report --reporter=json-summary`
kimenetből). **479 teszt, mind zöld.**

**Utána**: ugyanez az eljárás a T-009-54 állapoton, a `bun run screenshots` futása után a
`.nyc_output` törlésével (a 29. szekció buktatója, `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`).
**483 teszt, mind zöld**, a `coverage:e2e:report` kilépési kódja 0, a küszöb változatlan.

| Metrika    | Előtte fedett / összes | Utána fedett / összes | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1771 / 1786            | 1779 / 1794           | 15 -> 15                 |
| branches   | 828 / 839              | 830 / 841             | 11 -> 11                 |
| functions  | 582 / 585              | 588 / 591             | 3 -> 3                   |
| lines      | 1710 / 1725            | 1714 / 1729           | 15 -> 15                 |

Az összes változása fájlonként (a `json-summary` fájl soraiból, statements / branches / functions /
lines): `omit-keyless-branch-edges.ts` új, 5 / 2 / 4 / 2, mind fedett; `RunGraphCanvas.tsx` 24 / 6 / 9 /
22 -> 27 / 6 / 11 / 25, mind fedett; `GraphNodeCard.tsx` lines 21 -> 20 (a törölt bejegyzés), a többi
metrika változatlan, mind fedett. Összeg: +8 / +2 / +6 / +4, egyezik a táblázattal. A fedetlen
tételek ugyanazon a hat fájlon és sorszámon maradtak (`mount-app.tsx` 16, 21-22;
`read-frontend-config.ts`; `is-valid-connection.ts` 36; `browser-history-location-port.ts` 21;
`perform-route-request.ts` 89; `use-stream-connection.ts` 202).

A négy új e2e teszt: a `keyless-branch-edges.spec.ts` három tesztje (a 106. kritérium két
képernyője a bemutató fixtúrán, és a 108. kritérium futás nézet része saját, régi élű
pillanatképpel) és a `showcase-graph.spec.ts` fixtúra alak tesztje (egyetlen `branch` forrású él sem
kulcs nélküli, az `e-branch-loop` kulcsa az alapértelmezett ág). A `graph-node-card.spec.ts` elágazás
tesztje átírva: két kimenet a korábbi három helyett, kulccsal és hozzáférhető névvel.

### 5. Migráció

A `packages/db` sémája és a `packages/db/drizzle` alatti migrációk nem változtak (`git diff --stat
019c4b4 -- packages/db` üres), a `bun run check:db-drift` zöld.

## T-009-46

A futás nézet bemutató képének transcript tartalma (SPEC-008 12.6, 93. kritérium): a két kép
(`run-view-light.png`, `run-view-dark.png`) 3-6 jellemző transcript sort mutat, jóváhagyás nélkül,
görgetés nélkül. Ág: `feat/spec-008-bemutato-kep`, az `origin/main` `fe22c2e` állapotáról.

### 1. A felhasznált tények, forrással

| Tény                                                                                                                                                                       | Forrás                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A keretek és a mockok kizárólag a fixtúrában állnak, a szentesített script nem tarthat saját `mockRoute` vagy `page.route` hívást                                          | SPEC-008 12.6, `.claude/CLAUDE.md` 12. szekció ("Képernyőkép és vizuális bizonyíték")                                           |
| A `mockSseFrames` lezárt választ ad, a böngésző újracsatlakozik, és ugyanazt a pótlást kapja újra; a `mockSseFramesWithoutReconnect` csak az első kapcsolatot szolgálja ki | `apps/web/e2e/sse-mock.ts`, `.claude/CLAUDE.md` 12. szekció ("A lezárt `page.route()` SSE mock újracsatlakozáskor újrapótol")   |
| Az átvett sorok kurzora (`afterEventId`) a már látott azonosítójú keretet eldobja                                                                                          | `apps/web/src/transcript-panel/` reducer                                                                                        |
| A `toBeInViewport()` alapértéke a részleges láthatóságot is elfogadja, a teljes láthatósághoz `ratio: 1` kell                                                              | <https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-in-viewport>, `.claude/CLAUDE.md` 12. szekció |
| A stream jelző `reconnecting` állapota a "újracsatlakozás" felirat (üres piros kör)                                                                                        | `apps/web/src/app-shell/StreamStatusIndicator.tsx`                                                                              |

### 2. A tervezési döntések

- **A sorok** (`SHOWCASE_RUN_EVENTS`, öt `run_event`, azonosítóik 1-5): `step_started` (`sr-agent`),
  `sdk_assistant` (`sr-agent`), `sdk_result` (`sr-agent`, a `sdkResultRecord` segéddel),
  `step_finished` (`sr-agent`, `succeeded`) és `step_started` (`sr-loop`, a még futó lépés).
  `branch_taken` sor nincs, a SPEC-008 12.6 szerint: az elágazás mind az öt célja futott, amit egyetlen
  kiemelt él ellentmondásosan mutatna. A négy sorfajta mind szerepel, az öt sor a 3-6 tartományban van.
- **A lépés futások.** Az `sr-agent` és az `sr-approval` `succeeded`, az `sr-loop` marad `running`,
  `waiting_approval` állapotú lépés futás nincs. Az `sdk_result` sor ezért lezárt agent lépéshez tartozik
  (SPEC-008 12.6: "`sdk_result` csak lezárt agent lépéshez tartozik"), és minden sor `stepRunId` mezője
  a `SHOWCASE_RUN_STEP_RUNS` egy sorára mutat.
- **A jóváhagyás hiánya.** A `listPendingApprovals` mock üres listát ad; a `SHOWCASE_PENDING_APPROVALS`
  konstans és az ahhoz tartozó importok és konstansok törölve (a fixtúra saját árvái).
- **Az időbélyeg.** A sorok helyi időben rögzített `occurredAtMs` értéket kapnak (4 másodperces
  közökkel), tehát a kijelzett óra:perc:másodperc a gép időzónájától független.
- **Az SSE segéd: `mockSseFramesWithoutReconnect`.** Indok: egyetlen, stabil pótlás; a `mockSseFrames`
  újracsatlakozáskor ugyanazt a pótlást újra kézbesíti (a kurzor eldobja, így a sorok száma ott is
  azonos, a 4. pont mérése), de minden újrapótlás egy újabb `replay_complete` keretet és újratöltést
  hoz, ami a képkészítés pillanatában felesleges mozgó rész. **2026-10-14 óta a képkészítés nem ezt
  használja**, hanem élő, nyitva tartott streamet (9. pont); ez a segéd a fixtúra
  `installShowcaseRunMocks` függvényén át a regressziós tesztekben marad.
- **Az állítás helye.** Az `expectShowcaseTranscript` a `showcase-graph.ts` fájlban áll, és a
  szentesített `capture-screenshots.ts` a képernyőkép előtt hívja: a képet így csak az a futás
  készítheti el, amelyiken a sorok teljesen látszanak, nincs mit görgetni, és nincs jóváhagyás panel
  vagy "jóváhagyásra vár" jelvény. A script saját mockot nem kapott.
- **A manifeszt.** A fixtúra és a szentesített script lenyomata változott (`fixtureSha256`,
  `captureScriptSha256`), a `bun run screenshots` újrafuttatása után a manifeszt friss; az éllisták
  változatlanok (az `e-branch-loop` kulcsos marad, 7. pont).

### 3. A mérés: a stream jelző nem mutat hibamentes állapotot (LEZÁRVA, 9. pont)

A SPEC-008 12.6 előírja, hogy a segéd úgy legyen választva, hogy "a stream állapot jelző ne mutasson
hibát; ezt a lépés méri, nem feltételezi". Saját mérés (ideiglenes spec, a lap `Stream kapcsolat`
státusz elemének `aria-label` értéke a pótlás lezárulta után és 1500 ms múlva; a mérő spec a mérés
után törölve):

| Mock                                                           | Felirat a pótlás után               | 1500 ms múlva                       |
| -------------------------------------------------------------- | ----------------------------------- | ----------------------------------- |
| `mockSseFramesWithoutReconnect` (a fixtúra mockja)             | `Stream kapcsolat: újracsatlakozás` | `Stream kapcsolat: újracsatlakozás` |
| `mockSseFrames` (lezárt válasz, újrapótlás)                    | `Stream kapcsolat: újracsatlakozás` | `Stream kapcsolat: újracsatlakozás` |
| `mockIdleStream` (`mockSseFrames` egy `stream_ready` kerettel) | `Stream kapcsolat: újracsatlakozás` | `Stream kapcsolat: újracsatlakozás` |

Mindhárom mock lezárt `route.fulfill()` választ ad, tehát az `EventSource` a válasz végén `error`-t
kap, és a jelző `reconnecting` állapotba kerül. Ez a viselkedés a T-009-46 előtti állapoton is fennáll
(a `mockIdleStream` sor), tehát nem a T-009-46 hozta be. A "ne mutasson hibát" feltétel a három
meglévő segédből egyikkel sem teljesíthető; a lépés ezt nem döntötte el.

- **Mi a viselkedés addig.** A képen a jelző "újracsatlakozás" feliratú üres piros kört mutat, mint a
  T-009-46 előtt. A sorok egyszer szerepelnek (4. pont), a 93. kritérium többi része teljesül.
- **Mi zárná le.** Döntés a három lehetőség közül: (A) a jelenlegi állapot elfogadása, mert a baseline
  kép is ezt mutatta; (B) a `node:http` hibrid teszt szerver beemelése a fixtúrába, ami nyitott
  kapcsolaton tartja az `EventSource` példányt (SPEC-007 13.4, `apps/web/e2e/run-view-stream.ts`),
  de a szentesített script szabálya (nincs saját szerver, nincs saját mock) és a SPEC-008 12.6 szövege
  módosítást igényel; (C) a SPEC-008 12.6 "ne mutasson hibát" mondatának elhagyása a 93. kritériumból,
  mert a lezárt `route.fulfill()` mock mellett a nyitva maradás nem érhető el.
- **Lezárva** (user döntés 2026-10-14, "Valódi teszt szerver"): a (B) út, élő, nyitva tartott
  streammel; a két megvalósítási út összevetése, a megvalósítás és a mérés a 9. pontban.

### 4. A sorok egyszer szerepelnek: a mérés

A `showcase-graph.spec.ts` két tesztje egy lap oldali `EventSource` burkolóval számolja a
kézbesített `run_event` kereteket (`e2eDeliveredRunEventFrameCount`), és a transcript sorokat a DOM-ból:

- a fixtúra mockjával (`mockSseFramesWithoutReconnect`) a böngésző újracsatlakozik (a második `GET
/events` kérés megérkezik, `streamRequestCount === 2`), a mock nem válaszol rá: kézbesített keretek =
  küldött keretek (5), sorok = 5;
- a `mockSseFrames` felülírásával (a később regisztrált útvonalat a Playwright előbb próbálja) a
  második pótlás is megérkezik: kézbesített keretek = 2 \* küldött keretek (10), sorok = 5. A kurzor
  tehát a kettős kézbesítést is egyszeri sorrá szűri.

### 5. A szándékos rontások

Mindegyik rontás ideiglenes volt (a fixtúra a rontás után a `git`-ben commitolt állapotra
visszaállítva); a rontott állapoton a `showcase-graph.spec.ts` felsorolt tesztjei buktak, a
visszaállítottan mind a 13 teszt zöld.

| Rontás                                                                        | Bukó tesztek (a `showcase-graph.spec.ts`-ben)                                                                                                  |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| (I1) az `sr-approval` lépés futás `waiting_approval` állapotú, lezárás nélkül | a "egyetlen lépés futás sem vár jóváhagyásra" alak teszt, mindkét téma futás nézet tesztje, mindkét újracsatlakozás teszt (5 bukás)            |
| (I2) a `listPendingApprovals` egy függő jóváhagyást ad                        | mindkét téma futás nézet tesztje, mindkét újracsatlakozás teszt: a jóváhagyás panel kitölti a helyet, a sorok nem látszanak teljesen (4 bukás) |
| (I3) 20 további `sdk_result` sor a fixtúrában                                 | az alak teszt (a sorok száma a 3-6 tartományon kívül), mindkét téma futás nézet tesztje, mindkét újracsatlakozás teszt (5 bukás)               |
| (I5) az `sdk_result` sor a futó `sr-loop` lépés futáshoz tartozik             | az alak teszt (az `sdk_result` csak lezárt lépéshez tartozhat); a többi teszt zöld, mert a sor láthatósága nem függ a lépés futástól (1 bukás) |

### 6. Az e2e lefedettség előtte és utána

**Előtte**: saját mérés a `fe22c2e` állapoton (az e2e fa és az `apps/web/CLAUDE.md` a `fe22c2e`-ről
kicsekkolva, a `src` ugyanaz), a T-009-38 szekció eljárásával: `rm -rf apps/web/e2e/.nyc_output
apps/web/coverage-e2e`, nyolc egymás utáni `bun x playwright test --shard=<i>/8` `flock
/tmp/playwright-gep.lock` alatt (három worker), majd `bun run coverage:e2e:report`, kilépési kód 0.
**493 teszt, mind zöld.**

**Utána**: ugyanez az eljárás a T-009-46 állapoton, a `bun run screenshots` után a `.nyc_output`
törlésével (a 29. szekció buktatója, `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`). **499
teszt, mind zöld**, a `coverage:e2e:report` kilépési kódja 0, a küszöb (`apps/web/package.json`)
változatlan. A nyers összegek az `nyc report --reporter=json-summary` kimenetből:

| Metrika    | Előtte fedett / összes | Utána fedett / összes | Fedetlen előtte -> utána |
| ---------- | ---------------------- | --------------------- | ------------------------ |
| statements | 1786 / 1801            | 1786 / 1801           | 15 -> 15                 |
| branches   | 835 / 846              | 835 / 846             | 11 -> 11                 |
| functions  | 591 / 594              | 591 / 594             | 3 -> 3                   |
| lines      | 1721 / 1736            | 1721 / 1736           | 15 -> 15                 |

A `git diff --stat fe22c2e HEAD -- apps/web/src` üres, tehát a termékkód és vele az összegek nem
változtak, és a hat új e2e teszt (két alak teszt, két futás nézet teszt, két újracsatlakozás teszt)
nem érintett fedetlen sort. A fedetlen tételek ugyanazon a hat fájlon és sorszámon maradtak
(`mount-app.tsx` 16, 21-22; `read-frontend-config.ts`; `is-valid-connection.ts` 36;
`browser-history-location-port.ts` 21; `perform-route-request.ts` 89; `use-stream-connection.ts` 202).

### 7. A többi kritérium

- Az `e-branch-loop` él kulcsos marad (`sourceHandle` és `branchKey` `'feldolgozas'`), a fixtúra alak
  tesztje (SPEC-008 5.1, 106.) zöld; a `keyless-branch-edges.spec.ts` és a `run-graph-paint.spec.ts`
  zöld.
- A D2 kapcsoló ("Minden bejárt ág kiemelése") a futás nézet képén a vezérlők között látszik; a
  futás nézet tesztje ezt állítja mindkét témában.
- A transcript sorok címe a panel szélességénél ellipszissel csonkul. Ez a termék viselkedése
  (a sor fejléce egy szövegsor), a T-009-46 nem változtatta.

### 8. Migráció

A `packages/db` sémája és a `packages/db/drizzle` alatti migrációk nem változtak (`git diff --stat
fe22c2e HEAD -- packages/db` üres), a `bun run check:db-drift` zöld.

### 9. A stream jelző élő állapota: a két út összevetése és a mérés (user döntés 2026-10-14)

A user két döntése: (1) "Valódi teszt szerver": a képkészítés élő streamet kapjon, hogy a jelző "élő"
állapotot mutasson; (2) később, külön üzenetben: "ha kell MSW-t használjatok". A választás szempontja
a legkevesebb szabály kivétel, a termékkód változatlansága és a meglévő minták újrahasznosítása.

**(A) A meglévő `node:http` teszt szerver** (`apps/web/e2e/run-view-stream.ts` `startOpenStreamServer`,
`attachStreamServer`). A szerver szabad porton figyel, a lap `GET /events` kérését a
`route.continue({ url })` irányítja rá, a kereteket kiírja, és a kapcsolatot nyitva hagyja. Mérlegelés:

- termékkód változás: nincs; új függőség: nincs;
- szabály: a SPEC-007 13.4 hibrid útjának harmadik esete (bármely állítás, aminek a nyitva maradó
  kapcsolat az előfeltétele, `.claude/CLAUDE.md` 11. szekció); a regressziós teszt az
  `sse-real-server.spec.ts`-be kerül, tehát az "egyetlen spec fájl, ami valódi szervert indít" szabály
  változatlan; a `listen` egyetlen helye a `listenOnLoopback` marad (`e2e-stream-server-free-port`);
- képernyőkép védelem: a fixtúra új importja (`run-view-stream.ts`) a képernyőkép kör függőségei közé
  kerül; abban nincs a `DISK_WRITER_PATTERN` szerinti modul (`node:http` és `node:net` nincs a listán)
  és nincs `path` kulcs; a szentesített script továbbra sem tart saját gráfot, `mockRoute` vagy
  `page.route` hívást (az (5) invariáns változatlanul zöld).

**(B) MSW** (Mock Service Worker). Saját olvasás és lekérdezés, 2026-10-14:

| Tény                                                                                                                                                                                                                              | Forrás                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Az SSE támogatás (`sse()`) a 2.12.0 óta van: "support server-sent events (SSE) (#2299)"                                                                                                                                           | <https://github.com/mswjs/msw/releases/tag/v2.12.0>; <https://mswjs.io/blog/server-sent-events-are-here/>                                                                                                                              |
| A 3.x-ben az `sse` a `msw/sse` belépési pontról jön                                                                                                                                                                               | <https://mswjs.io/docs/migrations/2.x-to-3.x> ("Use this table to find the new entrypoint")                                                                                                                                            |
| A kapcsolatot a kezelő zárja (`client.close()`, `client.error()`); a `client.close()` "will not emit the `error` event"                                                                                                           | <https://mswjs.io/docs/sse/server-events/closing-the-connection/>                                                                                                                                                                      |
| Az aktuális verzió `msw` 3.0.3 (2026-10-10), `engines.node` `>=22.12.0`; a `@msw/playwright` 0.7.0 (2026-09-28), peer `msw >=3`                                                                                                   | élő registry: `https://registry.npmjs.org/msw` és `https://registry.npmjs.org/@msw%2fplaywright` (`dist-tags.latest`, `time`); második forrás: `https://data.jsdelivr.com/v1/package/npm/msw` és `.../@msw/playwright` (`tags.latest`) |
| A böngészős MSW-hez az alkalmazás szolgálja ki a worker scriptet, és az alkalmazás indítja: "If your application registers a Service Worker it must host and serve it", "we need to start the worker by calling `worker.start()`" | <https://mswjs.io/docs/integrations/browser>                                                                                                                                                                                           |
| A 3.x `msw/vite` pluginja kiszolgálja a scriptet, de "You still define the handlers and enable mocking in your application" (a `virtual:msw` `network.enable()` hívás az alkalmazás belépési pontja előtt)                        | <https://mswjs.io/guides/integrations/vite>                                                                                                                                                                                            |
| A `@msw/playwright` a `page.route()` útra épül, worker script nélkül: "any `page.route()` limitations now affect this library"; a válasz `route.fulfill({ body: Buffer.from(await response.arrayBuffer()) })` alakban megy        | a csomag README-je és `src/fixture.ts` fájlja a 0.7.0 verzióban (`https://cdn.jsdelivr.net/npm/@msw/playwright@0.7.0/`), saját olvasás                                                                                                 |
| A Service Worker által kezelt kérés a `page.route()` számára láthatatlan: "it adds its own Service Worker that takes over the network requests, hence making them invisible to browserContext.route() and page.route()"           | <https://playwright.dev/docs/network> ("Missing Network Events and Service Workers"); a forrása: <https://github.com/microsoft/playwright/blob/main/docs/src/network.md>                                                               |

Következtetés a (B)-re: a böngészős MSW nyitott SSE streamet adna, de csak a Service Worker úton, ami
termékkód változást kíván (a worker indítása az alkalmazás belépési pontjában), és a `page.route()`
REST mockokat (`.claude/CLAUDE.md` 11. szekció) a Service Worker elől kellene elvezetni. A
termékkód változás nélküli `@msw/playwright` a `page.route()` lezárt válaszára épül: a forrása az
egész törzset puffereli, mielőtt `fulfill`-el, tehát a nyitott streamre vagy a lezárásig vár, vagy lezárt
választ ad (forrásolvasásból következtetett, NEM MÉRT). Egyik változat sem kevesebb kivétel, mint az
(A), ezért MSW nem került be, és a toolchain research fájl nem változott.

**A döntés: (A).** A megvalósítás (`apps/web/e2e/`):

- `showcase-graph.ts`: az `installShowcaseLiveRunMocks` a `startOpenStreamServer`-rel indítja a szervert
  a `SHOWCASE_RUN_STREAM_FRAMES` keretekkel, ugyanazokat a REST mockokat telepíti, mint az
  `installShowcaseRunMocks`, és visszatér a szerverrel; az `expectShowcaseStreamLive` a
  `Stream kapcsolat: élő` nevű státusz elemet várja. Az `installShowcaseRunMocks` változatlan (a
  `run-graph-paint.spec.ts`, a `keyless-branch-edges.spec.ts` és a `showcase-graph.spec.ts` használja).
- `capture-screenshots.ts`: a futás nézet képe az élő függvénnyel készül, a képernyőkép előtt a
  transcript és a jelző állítása fut, a szervert a `finally` ág zárja (`closeAllConnections()` és
  `close()`).
- `sse-real-server.spec.ts`: két teszt (világos és sötét téma, 1440x900): a jelző élő, az
  `expectShowcaseTranscript` állításai teljesülnek, pontosan egy `GET /events` kérés indult (tehát a
  pótlás egyszer ment ki, újracsatlakozás nincs), és a sorok száma a keretekével (5) egyenlő.

**Szándékos rontások** (ideiglenesek, visszaállítva):

| Rontás                                                                                                                                     | Eredmény                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (L1) az élő függvényben a nyitott szerver mellé a lezárt `mockSseFramesWithoutReconnect` route is regisztrálva (a később regisztrált nyer) | mindkét téma teszt bukik: a `Stream kapcsolat: élő` státusz elem nem található                                                                                                                                                               |
| (L2) a teszt a transcript állítása után lezárja a szerver kapcsolatait (`closeAllConnections()`)                                           | a sötét téma bukott (`GET /events` kérés 2), a világos zöld maradt: a lezárás és a jelző állítása közti versenyben a jelző még élő volt. A teszt tehát a kép pillanatáig igazolja a nyitott kapcsolatot, azt nem, hogy később sem szakad meg |

**A képek.** `bun run screenshots` (`flock` alatt): 8 kép, mind zöld. A `run-view-light.png` és a
`run-view-dark.png` képen a topnav jelzője "élő" feliratú, zöld pöttyel, a transcript öt sora
látszik, jóváhagyás panel nincs; a képeket átnéztem. A manifeszt két lenyomata frissült
(`fixtureSha256`, `captureScriptSha256`), az éllisták változatlanok. A gráf szerkesztő képeinek útja
nem változott.

**Az e2e lefedettség.** Előtte: a 6. pont mérése (`0525044`) és a `main` `b133b0e` mérése
(`docs/research/2026-10-14-csomopont-felvetel.md` 27. és 44.5 szekció) is 15 / 11 / 3 / 15 fedetlen tételt
adott. Utána: a jelen ág (a `main` összefésülése után) a 6. pont eljárásával, nyolc shardban, **501
teszt, mind zöld** (63 + 63 + 63 + 63 + 63 + 62 + 62 + 62), a `coverage:e2e:report` kilépési kódja 0, a
küszöb változatlan:

| Metrika    | Fedett / összes utána | Fedetlen előtte -> utána |
| ---------- | --------------------- | ------------------------ |
| statements | 1788 / 1803           | 15 -> 15                 |
| branches   | 835 / 846             | 11 -> 11                 |
| functions  | 592 / 595             | 3 -> 3                   |
| lines      | 1722 / 1737           | 15 -> 15                 |

A fedetlen tételek ugyanazon a hat fájlon maradtak (`mount-app.tsx`, `read-frontend-config.ts`,
`is-valid-connection.ts`, `browser-history-location-port.ts`, `perform-route-request.ts`,
`use-stream-connection.ts`); a termékkód nem változott (`git diff --stat origin/main -- apps/web/src`
üres).
