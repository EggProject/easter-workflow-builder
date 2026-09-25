# A jóváhagyás panel helye és a vászon magassága (T-009-27 javítás)

Dátum: 2026-09-24. Kiváltó ok: egy független ellenőrzés az `fb921db` commiton (T-009-27) valódi
Chromiumban mérte, hogy a jóváhagyás panel a teljes osztott nézet (vászon plusz transcript)
FÖLÖTT áll, és a vászon magassága a jóváhagyások számától függ, négy jóváhagyásnál nulla, miközben
az `.app-content` görget. A PLAN-009 5. szekció F6 sora szerint a jóváhagyás "a futás nézet
fejlécébe és a transcript mellé" kerül; a teljes területű munkafelület szabálya a
`.claude/CLAUDE.md` 11. szekciójában áll.

## 1. Módszer

- Saját mérés, valódi Chromium (a repó `@playwright/test@1.62.1` csomagjának `chromium.launch()`
  hívása), a repón KÍVÜLI scripttel (`/private/tmp/t009-27-meres/measure.mjs`), mert az
  `apps/web/e2e/` alá képernyőképet író kódot csak a szentesített `capture-screenshots.ts` írhat
  (`.claude/CLAUDE.md` 12. szekció).
- Két build ugyanazzal a `VITE_*` konfigurációval, `vite build --outDir` alakban: az "előtte" a
  `09b449f` HEAD `apps/web` fája (a jóváhagyás kódja itt azonos az `fb921db` állapottal), az
  "utána" a javított munkafa. Mindkettő `vite preview` alól, a REST és az SSE `page.route()`
  mockon.
- Fixtúra: egy `start` és egy `human_approval` csomópont egy éllel, a lépés futás `waiting_approval`
  állapotban, és `N` függő jóváhagyás (0, 1, 4), egyforma szerkezetű címmel, törzzsel és kétmezős
  `payload` értékkel.
- Mért értékek: a `.run-graph-canvas` `getBoundingClientRect().height` értéke, az `.app-content`
  `scrollHeight - clientHeight` különbsége, és a jóváhagyás panel, illetve a transcript panel
  magassága. Viewport: 1440x900, 1440x600, 375x812.

## 2. Előtte (`09b449f`)

| Viewport | N   | Vászon (px) | `.app-content` túllógás (px) |
| -------- | --- | ----------- | ---------------------------- |
| 1440x900 | 0   | 688         | 0                            |
| 1440x900 | 1   | 414.31      | 0                            |
| 1440x900 | 4   | 60          | 258                          |
| 1440x600 | 0   | 388         | 0                            |
| 1440x600 | 1   | 114.31      | 0                            |
| 1440x600 | 4   | 60          | 558                          |
| 375x812  | 0   | 521         | 0                            |
| 375x812  | 1   | 222.52      | 0                            |
| 375x812  | 4   | 0           | 479                          |

A független ellenőrzés számai (1440x900-on 688/393/0) a saját fixtúrájából jöttek, más kártya
tartalommal; a hiba mindkét mérésben ugyanaz: a vászon magassága a jóváhagyások számával csökken,
és az `.app-content` görgetni kezd.

## 3. Utána (a javított munkafa)

A panel a transcript sávban, a transcript fölött áll (`apps/web/src/run-view/run-view.css`), a
fejlécben a vezérlő sáv "jóváhagyásra vár" jelvénye.

| Viewport | N   | Vászon (px) | `.app-content` túllógás (px) | Jóváhagyás panel (px) | Transcript panel (px) |
| -------- | --- | ----------- | ---------------------------- | --------------------- | --------------------- |
| 1440x900 | 0   | 700         | 0                            | 0                     | 668                   |
| 1440x900 | 1   | 700         | 0                            | 326                   | 326                   |
| 1440x900 | 4   | 700         | 0                            | 326                   | 326                   |
| 1440x600 | 0   | 400         | 0                            | 0                     | 368                   |
| 1440x600 | 1   | 400         | 0                            | 176                   | 176                   |
| 1440x600 | 4   | 400         | 0                            | 176                   | 176                   |
| 375x812  | 0   | 533         | 0                            | 0                     | 0                     |
| 375x812  | 1   | 533         | 0                            | 0                     | 0                     |
| 375x812  | 4   | 533         | 0                            | 0                     | 0                     |

A 375x812 sorban a panel és a transcript a rejtett "Transcript" fülön áll, ezért nulla magas; a
vászon a "Gráf" fülön van. A 0 jóváhagyásos vászon 12 pixellel magasabb, mint előtte: a régi alakban
az üres panel elem is a `.run-view-screen` flex gyereke volt, és a `--ep-space-3` térköz egy szelete
rá esett.

**A `max-height: max-content` a mért Chromiumban működik**: a `flex: 1 1 0` panel üres tartalommal
nulla magas (a transcript a teljes sávot kapja), tartalommal pedig a sáv feléig nő, mert a két
egyenlő `flex-grow` a szabad helyet felezi, és a flex algoritmus a `max-height` megsértésekor az
elemet a korlátra fagyasztja
(<https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths>, 9.7. "Fix min/max violations",
"Freeze over-flexed items"). A `max-content` a `max-height` dokumentált kulcsszava
(<https://developer.mozilla.org/en-US/docs/Web/CSS/max-height>).

## 4. A döntés eredményének láthatósága

Az első javított alakban egyetlen jóváhagyásnál is a panel tartalma a sáv felénél magasabb volt
(a "visszavonhatatlan" `Alert`, a cím, a törzs, a `payload` és a gombok), tehát a panel görgetett,
és a gombok ALATT megjelenő eredmény ("Döntés rögzítve: jóváhagyva." vagy a `conflict` üzenete) a
látható területen kívül esett: 1440x900-on a képernyőképen csak a gombok látszottak, az eredmény
nem. A javítás: a megjelenő eredmény elem csatoláskor `scrollIntoView({ block: 'nearest' })`
hívást kap, ami a legkisebb görgetéssel hozza be
(<https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView>,
<https://www.w3.org/TR/cssom-view-1/#dom-element-scrollintoview>). Utána mérve az eredmény doboza
mindkét témában, 1440x900-on és 1440x600-on is a panel doboza belsejében van, a gombok letiltva.
Regresszió: `apps/web/e2e/approval-prompt.spec.ts` (`toBeInViewport({ ratio: 1 })`, 1440x600-on),
és a hívás elhagyására mindkét döntés teszt elbukik.

**Felülírva 2026-09-25-én (7. szekció).** A `scrollIntoView` hívás megszűnt: az eredmény a
döntési sávban, a gombok alatt áll, ami nem görget el, tehát a látható területen van görgetés
nélkül.

A panel és a transcript közti `--ep-space-4` térköz külső margó: belső térközként a görgető panel
tartalmával együtt kigördült, és a panel alja a transcript szövegéhez tapadt (képernyőképen
látva).

## 5. A kétértelmű pont

A "transcript mellé" két olvasatot enged: a panel a transcript sávon BELÜL áll (megvalósítva),
vagy egy harmadik, önálló sávot kap. A megvalósítás a legkevésbé invazív olvasatot követi, ami a
meglévő két sávos `Resizable` és a `--ep-screen-md` alatti `Tabs` elrendezést nem változtatja
(SPEC-008 10. szekció). **Nyitott**, a SPEC-008 14.2 táblázatában O-9 azonosítóval: mi a
viselkedés addig: a fenti; mi zárná le: a user döntése arról, kér-e önálló sávot.

## 6. Képek

A 0, 1 és 4 jóváhagyásos, a siker és a `conflict` utáni állapot mindkét témában, plusz a telefon
méret két füle: a munkamenet `outputs/t-009-27-javitas/` mappájában, a mérő script kimenetével
(`meresek.json`) együtt.

## 7. A döntés gombjainak láthatósága (2026-09-25)

Kiváltó ok: egy független ellenőrzés a `9c44745` commiton mérte, hogy egy jóváhagyásnál a panel
tartalma 346 pixel, a látható magasság 326/176/243 pixel, és a Jóváhagyás gombból 1440x900-on 30
százalék látszik, a másik két méreten semmi; négy jóváhagyásnál a további kártyák gombjaiból
semmi. A user döntése (2026-09-24): a döntés gombjai mindig látszanak, a tartalom felettük
görgethető, és több jóváhagyásnál is minden függő döntés görgetés nélkül elérhető legyen.

**Felülírva 2026-09-25-én (8. szekció).** A döntési sáv helyére az "egyszerre egy" alak lépett
(user döntés 2026-09-25). **Az alábbi számokat repón kívüli, azóta elveszett script adta**, ami a
`.claude/CLAUDE.md` 12. szekciójával ütközött; a mérés azóta a repóban áll
(`apps/web/measurement/approval-panel.ts`, `bun run measure:approval`), és ugyanezt a két buildet
(`bffd75d`, `05b6818`) újramérte: a számok a 8.2 szekcióban állnak. Ahol eltérnek az alábbiaktól, az
a két fixtúra különbsége (az elveszett script jóváhagyásonként 346 pixel magas tartalmat adott, a
repó fixtúrája 321-et), nem a mért jelenségé.

**Módszer.** Saját mérés valódi Chromiumban, a repón kívüli scripttel
(`/private/tmp/jovahagyas-panel-2/measure.mjs`), `vite build --outDir` alakban két buildből: az
"előtte" a `bffd75d` (a `main`, a `9c44745` tartalmával), az "utána" a javított munkafa. A REST és
az SSE `page.route()` mockon, a fixtúra egy `start` és négy `human_approval` csomópont. A mért
érték gombonként a görgetés NÉLKÜL látható arány: a gomb befoglaló doboza metszve minden levágó ős
(`overflow` nem `visible`) kliens területével és a viewporttal, osztva a teljes dobozzal. A 375x812
méreten a mérés a "Transcript" fülön történik. Mindkét témában mérve, a számok témától
függetlenül azonosak.

**Előtte (`bffd75d`)**, a Jóváhagyás gombok látható aránya jóváhagyásonként (az Elutasítás
gomboké minden sorban ugyanaz):

| Viewport | 1 jóváhagyás | 4 jóváhagyás    | Panel (px) | Panel tartalma (px, 1 / 4) |
| -------- | ------------ | --------------- | ---------- | -------------------------- |
| 1440x900 | 0,3          | 0,3 / 0 / 0 / 0 | 326        | 346 / 1105                 |
| 1440x600 | 0            | 0 / 0 / 0 / 0   | 176        | 346 / 1105                 |
| 375x812  | 0            | 0 / 0 / 0 / 0   | 242,5      | 346 / 1105                 |

**A megoldás.** A panel két részre vált: felül a görgethető tartalom (a "visszavonhatatlan"
`Alert` és a kártyák: cím, törzs, `payload`), alul egy nem görgető döntési sáv, ami MINDEN
megjelenített jóváhagyásnak egy sort ad (a cím egy sorra csonkolva, mellette a két `sm` gomb,
alatta az eredmény). A tartalom `flex: 1 1 auto` és `min-height: 0`, a döntési sáv `flex: none`,
tehát a hely hiányát a tartalom fizeti meg
(<https://www.w3.org/TR/css-flexbox-1/#min-size-auto>,
<https://www.w3.org/TR/css-flexbox-1/#flex-common>).

**Utána**, mindkét témában:

| Viewport | Teljesen látható döntés (1 / 4) | Panel (px) | Görgethető tartalom (px, 1 / 4) | Vászon (px, 0 / 1 / 4) | `.app-content` túllógás |
| -------- | ------------------------------- | ---------- | ------------------------------- | ---------------------- | ----------------------- |
| 1440x900 | 1 / 4                           | 326        | 289 / 181                       | 700 / 700 / 700        | 0                       |
| 1440x600 | 1 / 4                           | 176        | 139 / 31                        | 400 / 400 / 400        | 0                       |
| 375x812  | 1 / 4                           | 242,5      | 205,5 / 97,5                    | 533 / 533 / 533        | 0                       |

Egy jóváhagyás természetes tartalma utána 310 pixel (görgethető rész) plusz 37 pixel (döntési
sáv), tehát a panel mindhárom méreten a sáv felét kapja: a `max-height: max-content` korlát a mért
eseteken nem lép életbe.

**A küszöb: hány jóváhagyásig fér el minden döntési sor görgetés nélkül.** Ugyanazzal a scripttel,
1 ... 10 jóváhagyásra mérve (a döntési sáv jóváhagyásonként 36 pixellel nő):

| Viewport | Utolsó teljesen látható darabszám | Görgethető tartalom ennél (px) |
| -------- | --------------------------------- | ------------------------------ |
| 1440x900 | 9                                 | 1                              |
| 1440x600 | 4                                 | 31                             |
| 375x812  | 6                                 | 25,5                           |

E fölött a döntési sáv nem fér el a panelben: a görgethető tartalom nulla magas, és a panel maga
görget, tehát a további sorokhoz görgetni kell. Ez a legkisebb következetes viselkedés, mert a
panel "legfeljebb a sáv fele" szabálya (8. szekció 1. pont) változatlan marad. **A cél mérten
teljesül 1 és 4 jóváhagyásra mindhárom méreten, de az ára a tartalom**: 1440x600-on négy
jóváhagyásnál a görgethető tartalom 31 pixel, vagyis a kártyák szövege gyakorlatilag csak
görgetve olvasható.

**A döntés után.** Siker és `conflict` után mindhárom méreten mindkét témában: az eredmény
(`role="status"`, illetve `role="alert"`) a viewportban, a gombok letiltva, "Rendben" gomb nincs
(0 darab). A képek: a munkamenet `outputs/jovahagyas-panel-2/` mappájában (1 és 4 jóváhagyás, három
méret, siker és conflict után, két téma), a mért számokkal (`meresek.json`).

Regresszió: `apps/web/e2e/approval-prompt.spec.ts`, mindkét témában, három méreten, 1 és 4
jóváhagyásra `toBeInViewport({ ratio: 1 })` minden döntés gombra; a tartalom zsugorodásának
letiltására (`flex: none` a görgethető részen) mind a hat méret és téma teszt, plusz a siker és a
`conflict` teszt elbukik.

## 8. Egyszerre egy jóváhagyás (2026-09-25)

Kiváltó ok: egy független ellenőrzés a `05b6818` commiton mérte, hogy a döntési sáv sorai nem
köthetők a jóváhagyásukhoz (375 pixelen a cím 155 pixel széles és csonkolt, `fan_out` ágakon a cím
minden ágon azonos, `execute-human-approval.ts` `title: config.title`), 1440x600-on négy
jóváhagyásnál a tartalomból 31 pixel látszik, öt vagy több jóváhagyásnál semmi, és a
"visszavonhatatlan" figyelmeztetés eltűnik. A user döntése (2026-09-25): a panel egyszerre egy
jóváhagyást mutat, teljes szöveggel és `payload` értékkel, alatta tapadó sávban csak az ő két
gombja; a minta a design system `drawer` törzs plusz lábléc szerkezete, a jóváhagyások között a
design system `pagination` lapozója vált.

### 8.1 Módszer

- **A mérő eszköz a repóban**: `apps/web/measurement/approval-panel.ts`, futtatás
  `cd apps/web && flock /tmp/playwright-gep.lock bun run measure:approval`. Képet nem ír, csak
  `MEASUREMENT <json>` sorokat; a fixtúra az e2e tesztekkel közös (`apps/web/e2e/approval-fixture.ts`,
  `manyApprovals`: eltérő cím, azonos törzs és kétmezős `payload`). A build nem instrumentált
  (`playwright.measurement.config.ts`, `VITE_COVERAGE=false`).
- A mért értékek: a vászon magassága (`.run-graph-canvas`), az `.app-content` függőleges és
  vízszintes túllógása, a panel magassága, a görgethető rész látható és teljes magassága (a mai
  alakban `.drawer__body`, a `05b6818` alakban `.approval-prompt-panel__content`, a `bffd75d`
  alakban maga a panel), a "Jóváhagyás" és "Elutasítás" gombok görgetés NÉLKÜLI látható aránya (a 7. szekció definíciója: a gomb doboza metszve minden levágó ős kliens területével és a
  viewporttal), a "visszavonhatatlan" cím látható aránya, és a lapozó "k / n" helyjelzője. Viewport
  1440x900, 1440x600, 375x812 (a "Transcript" fülön); 0, 1, 4 és 10 jóváhagyás; mindkét téma.
- **Az "előtte" oszlop** ugyanezzel az eszközzel és fixtúrával, a `05b6818` és a `bffd75d` fáján
  (`git archive`, a mai `node_modules` csatolásával; a `packages/` fa a két commit óta nem változott,
  `git diff --stat 05b6818 HEAD -- packages/` üres).
- **Mindkét témában a számok azonosak** (a három build minden sorában, gépi összevetéssel).

### 8.2 Előtte

**`05b6818` (döntési sáv).** Görgethető tartalom (látható / teljes, px), a Jóváhagyás gombok
látható aránya jóváhagyásonként, a "visszavonhatatlan" cím látható aránya:

| Viewport | 1 jóváhagyás | 4 jóváhagyás         | 10 jóváhagyás                 |
| -------- | ------------ | -------------------- | ----------------------------- |
| 1440x900 | 285 / 285; 1 | 181 / 861; 1 x4; 1   | 0 / 2014; 1 x9, 0; 0          |
| 1440x600 | 139 / 285; 1 | 31 / 861; 1 x4; 0,82 | 0 / 2014; 1 x4, 0,82, 0 x5; 0 |
| 375x812  | 206 / 285; 1 | 98 / 861; 1 x4; 1    | 0 / 2014; 1 x6, 0,64, 0 x3; 0 |

Ez a független ellenőrzés számait adja vissza: 1440x600-on négy jóváhagyásnál 31 pixel tartalom,
tíznél nulla, a figyelmeztetés nem látszik, és a sorok egy része a panel görgetése nélkül
elérhetetlen.

**`bffd75d` (a döntési sáv előtt, a gombok a kártyákban):** 1440x900-on 1 jóváhagyásnál a gomb
látszik (1), 4 és 10 jóváhagyásnál csak az első kártyáé (1, a többi 0); 1440x600-on és 375x812-n
egyetlen gomb sem látszik görgetés nélkül (0). A 7. szekció "előtte" táblája 1440x900-on 1
jóváhagyásnál 0,3-at mért: a különbség a fixtúráé (7. szekció eleje).

### 8.3 Utána

| Viewport | Vászon (px, 0 / 1 / 4 / 10) | Panel (px) | Görgethető törzs (látható / teljes, px) | Akciósáv (px) | Gombok | Figyelmeztetés | `.app-content` túllógás |
| -------- | --------------------------- | ---------- | --------------------------------------- | ------------- | ------ | -------------- | ----------------------- |
| 1440x900 | 700 / 700 / 700 / 700       | 326        | 233 / 319                               | 61            | 1 / 1  | 1              | 0 / 0                   |
| 1440x600 | 400 / 400 / 400 / 400       | 176        | 83 / 319                                | 61            | 1 / 1  | 1              | 0 / 0                   |
| 375x812  | 533 / 533 / 533 / 533       | 242,5      | 150 / 319                               | 61            | 1 / 1  | 1              | 0 / 0                   |

**A számok 1, 4 és 10 jóváhagyásnál azonosak**, mert egyszerre egy látszik; a lapozó helyjelzője
"1 / 1", "1 / 4", "1 / 10", és a lapozó egyik esetben sem lóg túl a panelen (0 pixel). A
görgethető törzs 1440x600-on 83 pixel: a tartalom (319 pixel) görgetve olvasható, a `payload`
(84 pixel) egyszerre nem fér el teljesen, ezért az e2e a törzs magasságával arányos láthatóságot
követel (`approval-prompt.spec.ts` `expectReadableByScrolling`).

**A döntés után**, négy jóváhagyásnál az első eldöntve (mindkét témában azonos):

| Viewport | Siker: eredmény arány, akciósáv, törzs (px) | Conflict: eredmény arány, akciósáv, törzs (px) |
| -------- | ------------------------------------------- | ---------------------------------------------- |
| 1440x900 | 1; 75; 219                                  | 1; 117; 177                                    |
| 1440x600 | 1; 75; 69                                   | 1; 117; 36                                     |
| 375x812  | 1; 75; 136                                  | 1; 138; 73                                     |

Az eredmény mindenhol teljesen látszik görgetés nélkül; az ára, hogy a több sorba törő szöveg
(a `conflict` üzenete 375 pixelen öt sor) ennyivel kisebbé teszi a törzset. A gombok letiltva
maradnak.

**A lapozó szomszéd oldalszámai** (375x812, tíz jóváhagyás, az 1., 5. és 10. oldal; a `siblings`
értékét ideiglenesen átírva mérve): a forrás alapértékével (1) a lapozó 9 elemet rajzol, túllógás
nincs, de az 1. és a 10. oldalon a "k / n" helyjelző két sorba törik (30 pixel magas, 15 helyett);
nullával 7 elemet, a helyjelző mindhárom oldalon egy sorban marad. A szállított érték ezért 0
(`ApprovalPromptPanel.tsx` `PAGINATION_SIBLINGS`).

### 8.4 A kiválasztás szabályai és a regressziók

- Alapból a legrégebbi kérés látszik; a kiválasztás a jóváhagyás azonosítója, és a látott
  jóváhagyás azonnal rögzül, tehát élő frissítéskor csak a "k" szám változik; ha a látott kerül ki,
  a legrégebbi látszik; döntés után a kiválasztás nem lép tovább (SPEC-008 8. szekció 1. pont).
- Regresszió: `apps/web/e2e/approval-prompt.spec.ts` (három méret, két téma, 1, 4, 10 jóváhagyás;
  `fan_out` útvonal a `POST /api/approvals/{id}/decision` hívásán; az eredmény megmaradása a
  Playwright Clock API-val lefuttatott egy perc után, <https://playwright.dev/docs/clock>,
  <https://playwright.dev/docs/api/class-clock>), `apps/web/e2e/sse-real-server.spec.ts` (élő
  frissítés), és a `select-shown-approval.spec.ts`, `use-approval-selection.spec.tsx` unit tesztek.
- **Szándékos rontások, mind bukik:** a gombok a görgetett törzsbe kerülnek (8 e2e teszt bukik, a
  hat méret és téma teszt, a siker és a conflict teszt); a döntés a lista első jóváhagyására megy a
  látott helyett (a `fan_out` teszt bukik); a kiválasztás a hely szerint (a
  `sse-real-server.spec.ts` kiválasztás tesztje és négy unit teszt bukik); az eredmény 3 másodperc
  után eltűnik (a Clock API teszt bukik, a lefuttatott perc után).

### 8.5 Képek

A munkamenet `outputs/jovahagyas-egyszerre-egy/` mappájában: 1, 4 és 10 jóváhagyás, a három méret,
lapozás után, siker és conflict után, mindkét témában, a mért számokkal (`meresek-*.jsonl`).
