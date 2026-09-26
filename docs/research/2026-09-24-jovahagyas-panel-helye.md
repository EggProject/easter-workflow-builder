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

## 9. Húzható elválasztó, egységes felület, egy igazítási vonal (2026-09-25)

Kiváltó ok: a user három döntése (2026-09-25) és egy független ellenőrzés a `da9fa70` commiton.
(1) Húzható elválasztó a jóváhagyás panel és a transcript között, a design system `Resizable`
elemével, kezdetben felén, perzisztált aránnyal; a 8. szekció egyenlő `flex-grow` felezését egy
agent választotta, nem a user. (2) A jóváhagyás szakasz a forrás drawer felületét kapja
(`--ep-bg-elevated`, a törzs és a lábléc együtt), és a lapozó is a 24 pixeles szélhez igazodik.
(3) Döntés után a panel a helyén marad (a mai viselkedés, most user döntésként). Az ellenőrzés két
hiányt is talált: a lapozás nélkül látott jóváhagyás azonnali rögzítését e2e nem őrizte, és a
SPEC-008 8. szekció 4. pontjának "minden méreten látszik" állítása csak az `Alert` címére igaz.

### 9.1 Módszer

- **A mérő eszköz a repóban**, bővítve: `apps/web/measurement/approval-panel.ts`, futtatás
  `cd apps/web && flock /tmp/playwright-gep.lock bun run measure:approval`. Képet nem ír. Az 1-3.
  jelenet (elrendezés, döntés, lapozó) változatlan, új mezőkkel: az `Alert` blokk egészének látható
  aránya, a lapozó (első gyereke), az `Alert` és a cím bal széle, a szakasz oldalsó belső térköze
  látható alakjában, az elválasztó értéke. Három új jelenet: **4. felület** (a törzs és az akciósáv
  KIFESTETT képpontja a belső térközükből, a lemezre nem írt, memóriában dekódolt képernyőképen);
  **5. küszöb** (az elválasztó `Home` állásától, 5, `ArrowDown` lépésenként 95-ig, minden állásban a
  két gomb görgetés nélküli látható aránya); **6. érintés** (375x812, a Chrome DevTools Protocol
  `Input.dispatchTouchEvent` hívásával 100 pixeles lefelé húzás, és a lapon naplózott pointer
  események).
- **Előtte**: a `741f63e` fán (a jóváhagyás és a futás nézet kódja azonos a `da9fa70` állapottal,
  `git diff --stat da9fa70 741f63e -- apps/web/src packages/ui/src` csak a transcript panel öt
  fájlját mutatja). **Utána**: a munkafa. Mindkét témában a számok azonosak (a két téma sorai
  gépi összevetéssel egyeznek, a kifestett színek kivételével).

### 9.2 Előtte és utána, egy jóváhagyással, kezdő arányon

| Viewport | Görgethető törzs (px), előtte -> utána | `Alert` blokk látható aránya | Bal szél: lapozó / `Alert` / cím (px), előtte -> utána | Törzs és akciósáv képpontja, világos (előtte -> utána)  | Ugyanez sötét                                  |
| -------- | -------------------------------------- | ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------- | ---------------------------------------------- |
| 1440x900 | 233 -> **241**                         | 1 -> 1                       | 1029 / 1053 / 1053 -> **1037 / 1037 / 1037**           | 246,243,235 és 255,255,255 -> **255,255,255 mindkettő** | 11,13,18 és 27,30,36 -> **27,30,36 mindkettő** |
| 1440x600 | 83 -> **91**                           | 0,7 -> **0,79**              | 1029 / 1053 / 1053 -> **1037 / 1037 / 1037**           | ugyanaz                                                 | ugyanaz                                        |
| 375x812  | 150 -> **158**                         | 1 -> 1                       | 16 / 40 / 40 -> **24 / 24 / 24**                       | ugyanaz                                                 | ugyanaz                                        |

- A "visszavonhatatlan" **cím** mindhárom méreten 1 arányban látszik, előtte és utána is; a blokk
  egésze 1440x600-on nem (SPEC-008 8. szekció 4. pont ennek megfelelően pontosítva).
- A vászon magassága (700, 400, 533 pixel) és az `.app-content` túllógása (0, 0) változatlan 0, 1,
  4 és 10 jóváhagyással, mindkét témában. A gombok kezdő arányon 1, 4 és 10 jóváhagyásnál
  mindenhol 1 arányban látszanak, és az akciósáv szélesebb lett (a transcript sáv 16 pixeles külső
  térköze nélkül), ezért a döntés után az eredmény ritkábban tör több sorba: az akciósáv 1440
  pixelen siker után 75 -> 61, `conflict` után 117 -> 96 pixel; 375 pixelen 75 és 138, változatlan.
- **Oldalsó belső térköz** (utána): bal 24, jobb **19** pixel a vízszintes sávban (1440), 24 és 24 a
  fül sávban (375). A jobb oldali 5 pixel hiány a design system `Resizable` geometriája: a panelek
  inline `flex-basis` százaléka 100-at ad ki, az 5 pixeles elválasztó (`flex: 0 0 5px`) ezen felül
  áll, a panelek `flex-shrink: 0`, tehát a csoport 5 pixellel túllóg, és az `overflow: hidden` a
  transcript oldal jobb szélét levágja. Az elválasztó előtt ugyanez a transcript sáv 16 pixeles
  külső térközébe esett (SPEC-008 14.2 O-10).

### 9.3 A gombok az elválasztó teljes tartományán

A két gomb görgetés nélkül, teljesen látszik (mindkét témában azonos):

| Viewport | Legkisebb érték, ahonnan fölfelé mindig | A törzs a küszöbön és 50-en (px) |
| -------- | --------------------------------------- | -------------------------------- |
| 1440x900 | 20                                      | 36 (a belső térköze), 241        |
| 1440x600 | 35                                      | 36, 91                           |
| 375x812  | 25                                      | 36, 158                          |

A küszöb alatt a panel kisebb a lapozó és az akciósáv együttes magasságánál, és a design system
`.resizable-panel { overflow: auto }` szabálya görgeti. A `Resizable` (a forrás `Resizable.jsx`
`resizeAt` függvénye és a port `resize-at.ts` fájlja) kizárólag százalékos, `[5, 95]` tartományú
korlátot ismer, pixeles vagy tartalom szerinti minimumot nem, tehát a user kérése ("a panel
minimális magasságát a gombok sávja szabja meg, ha a `Resizable` ezt engedi") a design system
eleme módosítása nélkül nem teljesíthető (SPEC-008 14.2 O-12).

### 9.4 Érintés a fül sávban

375x812, 100 pixeles lefelé húzás CDP érintés eseményekkel, mindkét témában azonos:

| Állapot                                             | Arány előtte -> utána | Pointer események a húzás alatt               |
| --------------------------------------------------- | --------------------- | --------------------------------------------- |
| a design system elválasztója (`touch-action: auto`) | 50 -> 54              | `pointerdown`, `pointermove`, `pointercancel` |
| `touch-action: none` (`run-view.css`)               | 50 -> 69              | `pointerdown`, `pointermove`, `pointerup`     |

A böngésző az érintéses mozdulatot alapból pásztázásnak veszi, és a pointer folyamot
`pointercancel` zárja; a `touch-action` a dokumentált eszköz ennek kizárására
(<https://www.w3.org/TR/pointerevents/>, <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action>,
<https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event>). A `touch-action:
none` a belső elválasztón áll; a gráf és a transcript közti külső elválasztó ugyanebben a hiányban
él (SPEC-008 14.2 O-11).

### 9.5 Regressziók és szándékos rontások

- `apps/web/e2e/approval-prompt.spec.ts`: az elválasztó három méreten, két témában (valódi egér
  húzás, `ArrowUp`, `aria-valuenow`, újratöltés, a vászon és a túllógás változatlan, `Home`
  állásban egérgörgővel elérhető gomb); érintéses húzás; hibás alakú és dobó tárolás.
  `apps/web/e2e/approval-surface.spec.ts` (három méret, két téma): a két szakasz kifestett
  képpontja a `--ep-bg-elevated` szondáéval egyezik, a három bal szél azonos. Külön fájlban, mert
  képernyőképet készít, és a `screenshot-pipeline` invariánsa szerint ilyen fájl `path` kulcsot nem
  tarthat, az `approval-prompt.spec.ts` viszont a döntés kérések útvonalát `path` mezőben rögzíti.
  `apps/web/e2e/sse-real-server.spec.ts`: a lapozás nélkül látott jóváhagyás élő frissítéskor is a
  helyén marad. Unit: `RunViewTranscriptSide.spec.tsx` (a transcript nem szerel le),
  `run-view-approval-layout.spec.ts`, `RunViewScreen.spec.tsx`.
- **Rontások, mind bukik:** a lapozás nélküli rögzítés elhagyása (`use-approval-selection.ts`, az új
  `node:http` e2e bukik, a két régi élő frissítés teszt zöld marad, ez volt az ellenőrzés
  kimutatott rése); a szakasz hátterének elhagyása (a képpont teszt); a lapozó belső térközének
  elhagyása (a bal szél teszt); az arány mentésének elhagyása (az újratöltés); a külső gráf panel
  `overflow: hidden` szabályának kiterjesztése a belső panelre (a görgő teszt); a `touch-action`
  elhagyása (az érintés teszt); a transcript leszerelése jóváhagyás nélkül (két unit teszt).
- Két meglévő e2e állítás a mérés szerint módosult: a lapozó láthatóságát a tartalma méri, nem a
  `<nav>` doboza (a 24 pixeles belső térköz a jobb szélen a 9.2 szerinti 5 pixeles levágásba esik),
  és a törzsben görgetett rész olvashatóságának tűrése egy képpont lett a 0,99-es szorzó helyett (a
  panel magassága a sáv százaléka, a törzs teteje tört képponton áll, a görgetési pozíció egész:
  375x812-n mérve 0,27 pixel kilógás egy 24 pixeles sorból).

### 9.6 Képek

A munkamenet `outputs/jovahagyas-elvalaszto/` mappájában: kezdő arány és áthúzott arány, 1440x900,
1440x600 és 375x812, mindkét témában, a mért számokkal (`meresek-elotte-741f63e.jsonl`,
`meresek-utana.jsonl`).

## 10. Fix lapozó és gombsor, a `Resizable` szélső állásai, `pointercancel` (2026-09-25)

Kiváltó ok: egy független ellenőrzés a `5093e67` állapoton, és a user két döntése (2026-09-25).
Mért hibák (a `decfa69` fán, ahol a jóváhagyás és a `Resizable` kódja a `5093e67` állapottal
azonos): (1) a gombok a 9.3 szerinti küszöb alatt kicsúsztak; (2) a forrás CSS
`.resizable-panel { min-height: 60px }` pixeles minimumáról a százalékos `[5, 95]` korlát nem tud,
a panelek `flex-shrink: 0` mellett a csoport kilógott, és a kilógó rész (a transcript alja)
eltűnt; (3) a jobb belső térköz 19 pixel volt a bal 24 helyett (O-10); (4) sem a forrás, sem a port
nem kezelte a `pointercancel` eseményt, a húzás állapota bent ragadt (O-11). A user döntései: (A) a
lapozó és a döntés gombsora fix helyen, a `Resizable` elemen kívül áll, csak a jóváhagyás szövege és
a transcript osztozik a húzható területen; (B) a 19 pixeles jobb térköz hiba, a mi oldalunkon,
ízlésesen javítandó, eltérésként jelölve.

### 10.1 Módszer

- **A mérő eszköz a repóban**, bővítve (`apps/web/measurement/approval-panel.ts`, `cd apps/web &&
flock /tmp/playwright-gep.lock bun run measure:approval`), képet nem ír. Három új jelenet: **7.
  szélső állás** (egy jóváhagyás, 20 tárolt transcript sor; a kezdő arányon, `Home` és `End`
  állásban a jelentett érték és a két határ, a két panel kirajzolt magasságából számolt VALÓDI
  arány, a csoport túllógása, a lapozó és a két gomb görgetés nélküli látható aránya, a transcript
  utolsó sorának látható aránya a user görgetése után, és a törzs két oldalsó belső térköze); **8.
  megszakított érintés** (900x1000, a függőleges sáv, ahol mindkét elválasztó áll: a külső
  elválasztón valódi CDP érintéses húzás, a belsőn `touchCancel`, utána egérmozgás a vásznon és
  görgetés a transcripten); **9. külső szélső állás** (900x1000, a külső elválasztó `Home` és `End`
  állása). Az 5. jelenet (küszöb) 2026-09-25 óta a jelentett `Home` értéktől lép a jelentett
  maximumig, mert a `Home` már nem mindig 5.
- **Előtte**: a `decfa69` fán; **utána**: a munkafa. Mindkét témában a számok azonosak (a sorok
  gépi összevetéssel egyeznek, a kifestett színek kivételével). A nyers sorok a munkamenet
  `outputs/jovahagyas-fix-gombsor/` mappájában (`meresek-elotte-decfa69.jsonl`,
  `meresek-utana.jsonl`).

### 10.2 Szélső állások, előtte és utána

Előtte (`decfa69`):

| Viewport | Állás | `aria-valuenow` | Valódi arány | Csoport túllógás (px) | Gombok | Transcript utolsó sor, görgetve | Jobb térköz (px) |
| -------- | ----- | --------------- | ------------ | --------------------- | ------ | ------------------------------- | ---------------- |
| 1440x900 | kezdő | 50              | 50           | 5                     | 1      | 1                               | 19               |
| 1440x900 | Home  | 5               | 8,28         | 30                    | 0      | 0,74                            | 19               |
| 1440x900 | End   | 95              | 91,72        | 30                    | 1      | 0                               | 19               |
| 1440x600 | kezdő | 50              | 50           | 5                     | 1      | 1                               | 19               |
| 1440x600 | Home  | 5               | 13,64        | 45                    | 0      | 0,45                            | 19               |
| 1440x600 | End   | 95              | 86,36        | 45                    | 1      | 0                               | 19               |
| 375x812  | kezdő | 50              | 50           | 5                     | 1      | 1                               | 24               |
| 375x812  | Home  | 5               | 10,59        | 38,34                 | 0      | 0,58                            | 24               |
| 375x812  | End   | 95              | 89,41        | 38,34                 | 1      | 0                               | 24               |

Utána (a munkafa):

| Viewport | Állás | `aria-valuenow` / min / max | Valódi arány | Csoport túllógás (px) | Lapozó és gombok | Transcript utolsó sor, görgetve | Bal / jobb térköz (px) |
| -------- | ----- | --------------------------- | ------------ | --------------------- | ---------------- | ------------------------------- | ---------------------- |
| 1440x900 | kezdő | 50 / 10 / 90                | 50           | 0                     | 1                | 1                               | 24 / 24                |
| 1440x900 | Home  | 10 / 10 / 90                | 10,24        | 0                     | 1                | 1                               | 24 / 24                |
| 1440x900 | End   | 90 / 10 / 90                | 89,76        | 0                     | 1                | 1                               | 24 / 24                |
| 1440x600 | kezdő | 50 / 21 / 79                | 50           | 0                     | 1                | 1                               | 24 / 24                |
| 1440x600 | Home  | 21 / 21 / 79                | 20,98        | 0                     | 1                | 1                               | 24 / 24                |
| 1440x600 | End   | 79 / 21 / 79                | 79,02        | 0                     | 1                | 1                               | 24 / 24                |
| 375x812  | kezdő | 50 / 5 / 95                 | 50           | 0                     | 1                | 1                               | 24 / 24                |
| 375x812  | Home  | 14 / 14 / 86                | 14,32        | 0                     | 1                | 1                               | 24 / 24                |
| 375x812  | End   | 86 / 14 / 86                | 85,68        | 0                     | 1                | 1                               | 24 / 24                |

- A **szélső állás a pixeles minimum**: mindkét panel a forrás 60 pixelén áll (1440x900-on 60 és
  526, 1440x600-on 60 és 226, 375x812-n 60 és 359 pixel), és a jelentett érték ezt az arányt
  mondja. 375x812-n a kezdő arányon a két határ még 5 és 95: a "Transcript" fül a csatoláskor rejtett,
  tehát a panelek nulla méretűek, és a mérés elmarad; a fókusz, az első billentyű vagy húzás
  újramér (10.4).
- A **kezdő arányon** a görgethető törzs 1440x900-on 293, 1440x600-on 143, 375x812-n 210 pixel
  (9.2 szerint előtte 241, 91, 158: a lapozó és az akciósáv már nem a húzható terület része), és a
  "visszavonhatatlan" `Alert` blokk mindhárom méreten teljesen látszik (előtte 1440x600-on 0,79). A
  vászon (700, 400, 533) és az `.app-content` túllógása (0, 0) változatlan 0, 1, 4 és 10
  jóváhagyással, mindkét témában; az akciósáv siker után 61 (375-ön 75), `conflict` után 96 (375-ön 138) pixel.
- **A gombok a teljes tartományon látszanak** (5. jelenet): a `Home` értéktől (10, 21, 14) a
  maximumig minden 5 százalékos lépésben mindkét gomb 1 arányban.
- **A bal szél** (lapozó, `Alert`, cím) egy vonalban maradt (1440 pixelen 1033,5, 375 pixelen 24), a
  törzs és az akciósáv kifestett képpontja a `--ep-bg-elevated` tokenje (255,255,255 és 27,30,36).

### 10.3 A megszakított érintés

900x1000, mindkét témában azonos:

| Elválasztó                     | Pointer események                             | Előtte (`decfa69`): érintés után / egérmozgás után / görgetés után / `is-dragging` | Utána                |
| ------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------- |
| külső (gráf és transcript)     | `pointerdown`, `pointermove`, `pointercancel` | 70 -> 73 / **5** / **85** / bent ragad                                             | 73 / 73 / 73 / nincs |
| belső (jóváhagyás, transcript) | ugyanez (`touchCancel`)                       | 50 -> 63 / **5** / **91** / bent ragad                                             | 52 / 52 / 52 / nincs |

A belső elválasztón az érintés utáni érték a két futás között eltér (63, illetve 52), mert a CDP
`touchCancel` a mozgás eseményekhez képest más képkockában érkezik; a mérés tárgya az, hogy a
megszakítás UTÁN semmi nem mozdít. A megszakítás nélküli, `pointerup` zárású érintéses húzás a
belső elválasztón 375x812-n 50-ről 74-re visz (6. jelenet, változatlanul működik).

### 10.4 A megoldás és a forrásai

- **A lapozó és a gombsor a `Resizable` elemen kívül** (user döntés A). A transcript oldal felülről
  lefelé: a lapozó (`ApprovalPromptPanel`), a `Resizable` a jóváhagyás törzsével
  (`ApprovalPromptBody`, `.drawer__body`) és a transcripttel, alul a döntés akciósávja
  (`ApprovalDecisionActions`, `.drawer__footer`). A design system `drawer` szerkezete megmaradt: a
  görgethető törzs fölött a fej, alatta a felső elválasztós tapadó akciósáv; a forrás egyetlen
  `DrawerSections` portja ezért két komponensre vált (`DrawerBody`, `DrawerFooter`), a forrás JSX
  osztályaival. **Mérlegelt és elvetett alak:** a gombsor a lapozó alatt, a transcript fölött. Ez a
  forrás `drawer` sorrendjét (törzs, UTÁNA akciósáv) fordítaná meg, a `.drawer__footer` felső
  elválasztója a lapozó és a gombok közé esne, és a felolvasási és fókusz sorrendben a döntés gombjai
  a "visszavonhatatlan" figyelmeztetés ELÉ kerülnének. A választott alak a futás nézet alján ugyanaz
  a felső elválasztós, emelt hátterű sáv, amit a gráf szerkesztő alsó akciósávja (`page-footer`) már
  ad.
- **A zsugorodó panelek** (user döntés B, `ResizablePanel`: `flex-shrink: 1` a forrás `0` értéke
  helyett). A CSS Flexbox 9.7 szerint negatív szabad helynél a zsugorodási tényező a belső
  `flex-basis` mérettel szorzódik ("scaled flex shrink factor"), tehát az 5 pixeles elválasztó helyét
  a két panel a százalékuk arányában adja le, és az arányuk pontosan a százalék marad; a minimumába
  ütköző panel befagy, és a másik zsugorodik tovább ("Fix min/max violations").
  <https://drafts.csswg.org/css-flexbox-1/#resolve-flexible-lengths>,
  <https://www.w3.org/TR/css-flexbox-1/>, a skálázás indoka a CSSWG levelezésében
  (<https://lists.w3.org/Archives/Public/www-style/2014Oct/0495.html>), és egy kidolgozott példa a
  minimumba ütköző elemre (<https://stackoverflow.com/questions/76291155/understanding-flex-shrink-when-the-value-is-less-than-1>).
  A forrás saját demója is túllóg (`resizable.html`, 9.2: 4,98 pixel).
- **A pixeles minimum a határban és a jelentett értékben** (`measure-panel-geometry.ts`,
  `resize-at.ts`, `ResizableHandle.tsx`). A `Resizable` a panelek kiszámított `min-height`/`min-width`
  értékét (a forrás 60 és 80 pixele) a panelek együttes méretének százalékára váltja, és ez a `Home`
  és az `End` határa; az `aria-valuemin` és az `aria-valuemax` a `Home`, illetve az `End` érkezési
  helye. Forrás: a W3C APG Window Splitter mintája szerint az érték az elsődleges panel mérete, az
  `aria-valuemin` az a hely, ahol az elsődleges panel a legkisebb, az `aria-valuemax`, ahol a
  legnagyobb (<https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/>); az MDN szerint fókuszálható
  `separator` esetén az `aria-valuenow` az elválasztó TÉNYLEGES helye, és változáskor frissítendő
  (<https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/separator_role>);
  az APG szerint az `aria-valuenow` a két határ közé esik
  (<https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/>); a WAI-ARIA 1.1 szöveget
  bevezető változás (<https://github.com/w3c/aria/commit/8a67e6e8e5>). **A mérés ideje:** csatoláskor,
  ablak átméretezéskor, az elválasztó fókuszakor, minden húzás és billentyű előtt. A csoport más okú
  méretváltozását (rejtett fül megjelenése, egy szülő elrendezés húzása) a következő ilyen esemény
  követi, mert a `ResizeObserver` a csomagban tiltott (SPEC-007 16. szekció 24. kritérium); a
  kirajzolás ilyenkor is helyes (a zsugorodó panelek miatt nincs levágás), csak a jelentett érték
  késik egy eseményt.
- **A transcript alja a minimumon.** A forrás modellje: a panel minimuma 60 pixel, és ami nem fér
  el, görget (`.resizable-panel { overflow: auto }`). A transcript burkolója ezért `overflow: auto`
  (korábban `hidden`), és a lista legalább egy összecsukott sornyi magas (`TranscriptPanel.tsx`, a
  `collapsed-transcript-row-height.ts` egyetlen forrásából): az `End` állásban a burkolót görgetve a
  lista, benne az utolsó sor, teljesen elérhető. Nagyobb panelben nincs mit görgetni.
- **`pointercancel`** (`Resizable.tsx`): a húzást a `pointerup` mellett a `pointercancel` is lezárja,
  a már alkalmazott méret marad. A W3C Pointer Events szerint a böngésző `pointercancel` eseménnyel
  zárja a pointer esemény folyamát, ha a mozdulatot maga veszi át (pásztázás, nagyítás) vagy a pointer
  várhatóan nem ad több eseményt, és utána arra a pointerre `pointerup` sem jön
  (<https://www.w3.org/TR/pointerevents3/>, "Suppressing a pointer event stream" és "The pointercancel
  event"; <https://www.w3.org/TR/2019/SPSD-pointerevents1-20190404/>, 5.2.8;
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event>). A külső elválasztó
  `touch-action` értéke nem változott (O-11 nyitva a külső érintéses húzására); a belső elválasztó
  `touch-action: none` szabálya helyes, a design system maga is ezt teszi a saját oszlop méretező
  fogantyúján (`datatable.css`: `.data-table__resizer { touch-action: none }`), és a W3C Pointer
  Events és az MDN `touch-action` oldala szerint ez a dokumentált eszköz (9.4).

### 10.5 Ami nyitva maradt, méréssel

**A külső elválasztó `End` állása a függőleges sávban** (9. jelenet, 900x1000, mindkét témában):
a kezdő (70) és a `Home` (8) állásban a lapozó és a két gomb 1 arányban látszik, a transcript oldal
239, illetve 735 pixel; az `End` (92) állásban a transcript oldal a külső panel 60 pixeles
minimumán áll, a lapozó még látszik, a két gomb nem (0). Ez a külső `Resizable` minimuma, nem a
belsőé; a SPEC-008 14.2 O-13 tétele (a user döntését kéri: a külső transcript panel minimuma a fej
és az akciósáv magasságához igazodjon-e).

### 10.6 Regressziók és szándékos rontások

- `apps/web/e2e/approval-prompt.spec.ts`: a szélső állások három méreten két témában (a lapozó és a
  két gomb `toBeInViewport({ ratio: 1 })`, a csoport túllógása 0, az `aria-valuenow` a kirajzolt
  magasságokból számolt valódi arány, a `Home` az `aria-valuemin`, az `End` az `aria-valuemax`, a
  transcript utolsó sora egérgörgővel teljesen látható, a vászon és a túllógás változatlan); a
  megszakított érintés a külső és a belső elválasztón (`hasTouch`); az egér húzás és az érintés
  elvárt értéke a két panel együttes magasságához mérve. `apps/web/e2e/approval-surface.spec.ts`: a
  bal és a jobb belső térköz azonos (24), a törzsben és az akciósávban is. Unit: a `packages/ui`
  `resizable` téma (a mért minimum a határban, az ablak átméretezés, a leszerelt panel, a húzás a
  panelek együttes méretéhez, a `pointercancel`, az `Enter` a minimumra), `drawer` (`DrawerBody`,
  `DrawerFooter`), `approval-prompt` (`ApprovalPromptBody`, a fej, az akciósáv), `run-view` (a három
  rész sorrendje, a transcript nem szerel le).
- **Rontások, mind bukik:** (a) a gombsor a `Resizable` panelébe téve: a szélső állás e2e mind a hat
  esete bukik (a gomb látható aránya 0); (b) a `pointercancel` kezelés kivéve: a megszakított érintés
  mindkét tesztje bukik (bent ragadt `is-dragging`); (c) a transcript levágásának visszahozása a
  forrás `flex-shrink: 0` értékével: a szélső állás mind a hat esete bukik (túllógás 5), és a térköz
  négy vízszintes sávbeli esete (19 a 24 helyett); (c2) a transcript burkolójának `overflow: hidden`
  értéke: a szélső állás mind a hat esete bukik az `End` állás utolsó során; (d) a `decfa69` teljes
  `resizable` témája a mai elrendezés alatt: 12 bukás a 14 érintett tesztből (a két zöld a 375
  pixeles térköz teszt, ahol külső elválasztó nincs).

### 10.7 Képek

A munkamenet `outputs/jovahagyas-fix-gombsor/` mappájában: kezdő (köztes), `Home` és `End` állás,
1440x900, 1440x600 és 375x812, mindkét témában (a fájlnévben a jelentett érték). A képek egy
repón kívüli, eldobott Playwright futásból származnak, ami a repó `approval-fixture.ts` fixtúráját
importálta (a `screenshot-pipeline` invariánsa szerint a szentesített `capture-screenshots.ts`
kizárólag a bemutató gráfot fényképezheti, minden képén kifestett élekkel, a 375 pixeles
"Transcript" fülön viszont nincs él).

## 11. Transcript felül, kérdés alul: a CLI sorrend (2026-09-25)

Kiváltó ok: egy független ellenőrzés a `09fd514` állapoton, és a user döntése (2026-09-25,
"Transcript felül, kérdés alul"). Mért hibák az előtte alakban: a szöveg és a gombok között a
teljes transcript állt, Tabbal az elválasztótól a "Jóváhagyás" gombig transcript sorokon át vitt az
út, a gombsor nem volt a "Függő jóváhagyások" régióban, és semmilyen ARIA hivatkozás nem kötötte a
jóváhagyáshoz. A döntés: felül a transcript, alatta a jóváhagyás szövege, közvetlenül alatta a
lapozó és a döntés gombjai, mint egy CLI engedélykérés; a húzható elválasztó a transcript és a
szöveg között, a lapozó és a gombsor továbbra is a `Resizable` elemen kívül, fix helyen.

### 11.1 Módszer

- **A mérő eszköz a repóban**, két új jelenettel (`apps/web/measurement/approval-panel.ts`, `cd
apps/web && flock /tmp/playwright-gep.lock bun run measure:approval`), képet nem ír: **10.
  sorrend** (egy jóváhagyás, 20 tárolt transcript sor, 1440x900, 1440x600, 375x812 a "Transcript"
  fülön és 900x1000 a függőleges sávban, két témában; a belső elválasztó kezdő, `Home` és `End`
  állásában a transcript burkoló, az elválasztó, a görgethető törzs, a lapozó és az akciósáv
  függőleges doboza, a szöveg és a gombok közti sáv, és abból a transcript burkolóra eső rész, a
  régió neve, a csoport neve és leírása; a kezdő állásban valódi Tab lépések az elválasztótól a
  "Jóváhagyás" gombig) és **11. külső `End`** (a gráf és a transcript közti elválasztó `End` állása
  a függőleges sáv öt és a vízszintes sáv két méretén: a lapozó és a két gomb látható aránya
  görgetés nélkül, majd valódi Tab lépésekkel a külső elválasztótól a "Jóváhagyás" gombig és még
  egy lépéssel az "Elutasítás" gombig). Az elválasztó nevét az eszköz mindkét alakban felismeri.
- **Előtte**: a `1bcface` `apps/web` fája (`git archive`) a munkafa csomagjaival (a `packages/ui`
  egyetlen eltérése a `DrawerFooter` új, a régi fán nem használt attribútumai). **Utána**: a
  munkafa. A két téma számai azonosak. A nyers sorok a munkamenet `outputs/jovahagyas-cli-sorrend/`
  mappájában (`meresek-elotte-1bcface.jsonl`, `meresek-utana.jsonl`).

### 11.2 A sorrend, előtte és utána

A "szöveg és gombok közti sáv" a görgethető törzs alja és az akciósáv teteje közti távolság, a
"benne transcript" ennek a transcript burkolóra eső része.

| Viewport | Állás | Előtte: sorrend felülről                       | Előtte: sáv / benne transcript (px) | Utána: sorrend felülről                        | Utána: sáv / benne transcript (px) |
| -------- | ----- | ---------------------------------------------- | ----------------------------------- | ---------------------------------------------- | ---------------------------------- |
| 1440x900 | kezdő | lapozó, szöveg, elválasztó, transcript, gombok | 298 / 293                           | transcript, elválasztó, szöveg, lapozó, gombok | 48 / 0                             |
| 1440x900 | Home  | ugyanez                                        | 531 / 526                           | ugyanez                                        | 48 / 0                             |
| 1440x900 | End   | ugyanez                                        | 65 / 60                             | ugyanez                                        | 48 / 0                             |
| 1440x600 | kezdő | ugyanez                                        | 148 / 143                           | ugyanez                                        | 48 / 0                             |
| 1440x600 | Home  | ugyanez                                        | 231 / 226                           | ugyanez                                        | 48 / 0                             |
| 1440x600 | End   | ugyanez                                        | 65 / 60                             | ugyanez                                        | 48 / 0                             |
| 375x812  | kezdő | ugyanez                                        | 214,5 / 209,5                       | ugyanez                                        | 48 / 0                             |
| 375x812  | Home  | ugyanez                                        | 364 / 359                           | ugyanez                                        | 48 / 0                             |
| 375x812  | End   | ugyanez                                        | 65 / 60                             | ugyanez                                        | 48 / 0                             |
| 900x1000 | kezdő | ugyanez                                        | 67,25 / 62,25                       | ugyanez                                        | 48 / 0                             |
| 900x1000 | Home  | ugyanez                                        | 69,5 / 64,5                         | ugyanez                                        | 48 / 0                             |
| 900x1000 | End   | ugyanez                                        | 65 / 60                             | ugyanez                                        | 48 / 0                             |

- Utána a sávban kizárólag a lapozó áll (48 pixel), a lapozó a törzs aljához, az akciósáv a lapozó
  aljához pontosan illeszkedik. A lapozó és a két gomb minden állásban, mindhárom méreten 1
  arányban látszik (előtte is), a jelentett érték és a két határ változatlan (10/90, 21/79, 14/86;
  a 900x1000-es sávban 48/52), mert a két panel mérete a helycserével nem változott.
- **Tab** az elválasztótól a "Jóváhagyás" gombig: előtte 1440x900-on 8 lépés (7 transcript sor),
  1440x600-on 5 (4), 375x812-n 6 (5), 900x1000-en 5 (4); utána minden méreten, egy jóváhagyással 3
  lépés (a görgethető törzs (a mért első fókusz maga a görgethető `.drawer__body` elem), az
  aktuális oldal gombja, a "Jóváhagyás"), transcript sor nélkül. Több jóváhagyásnál a lapozó
  gombjai is a lépések közé kerülnek: négy jóváhagyásnál 7, 8, illetve 7 lépés (12.6 szekció).
- Változatlan (1., 2. és 4-9. jelenet, két témában): a vászon 700, 400, 533 pixel, az
  `.app-content` túllógása 0, 0, 1, 4 és 10 jóváhagyással; a görgethető törzs kezdő arányon 293,
  143, 210 pixel; a "visszavonhatatlan" blokk kezdő arányon 1 arányban látszik; az akciósáv siker
  után 61 (375-ön 75), `conflict` után 96 (375-ön 138) pixel; a bal és a jobb belső térköz 24 és 24;
  a lapozó, az `Alert` és a cím bal széle 1033,5 (375-ön 24); a törzs és az akciósáv kifestett
  képpontja a `--ep-bg-elevated` tokenje; az érintéses húzás 50-ről 74-re visz; a megszakított
  érintés után semmi nem mozdít. Jóváhagyás nélkül a transcript a teljes oldalt kapja (a régió
  üres, név nélküli szakasz).

### 11.3 A régió és az ARIA kötés

A lapozó és a gombsor a "Függő jóváhagyások" régióban áll (`ApprovalPromptPanel`, `<section>` a
hozzáférhető nevével). A szöveg a húzható panelben áll, a régió azon kívül, tehát egyetlen DOM elem
nem foghatja össze őket, és egy második, azonos nevű régió a W3C APG szerint tilos (minden régiónak
egyedi név kell, <https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/>). Ezért a gombsor a
jóváhagyáshoz kötött csoport: `role="group"`, `aria-labelledby` a cím, `aria-describedby` a szöveg
azonosítójára (mérve utána: a csoport neve "Tömeges jóváhagyás 1", a leírása a jóváhagyás szövege,
a régió neve "Függő jóváhagyások", a lapozó a régióban; előtte a gomb nem állt régióban, csoportja
nem volt). Források: a W3C WCAG ARIA17 technika szerint a `group` csoport címkéje a csoport minden
vezérlőjének közös címkéje, és a segítő technológia a csoportba lépéskor és kilépéskor jelzi
(<https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA17>); az MDN `group` szerepkör leírása
ugyanezt a jelzést írja le (<https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/group_role>);
az APG "Providing Accessible Names and Descriptions" szerint az `aria-labelledby` és az
`aria-describedby` a lap bármely elemére hivatkozhat, a leírást a képernyőolvasó a név és a
szerepkör után mondja (<https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/>); a
WAI-ARIA 1.2 `group` szerepkör (<https://www.w3.org/TR/wai-aria-1.2/#group>). **Nem ellenőrzött**,
tehát nem állítjuk: hogy egy adott képernyőolvasó a csoport leírását a gomb fókuszakor
felolvassa-e; az e2e a Chromium hozzáférhetőségi fáját méri (`toHaveAccessibleDescription`).

Az elválasztó elsődleges panele a transcript lett (a W3C APG Window Splitter szerint az elválasztó
értéke és neve az elsődleges panelé, <https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/>),
ezért a neve "A transcript és a jóváhagyás aránya", és az `aria-valuenow` a transcript százaléka. A
`localStorage` `eggRunViewApprovalLayout` kulcsa nem változott, a tárolt pár a panelek sorrendjében
áll, tehát egy korábban tárolt arány az új sorrendben olvasódik vissza. **Javítva (2026-09-25,
később):** ez egy korábban mentett arányt fordítva töltött vissza, és a régi kulcs alatt azóta
mindkét sorrend előfordulhat, tehát egy átfordítás sem egyértelmű; az arány új kulcson áll
(`eggRunViewTranscriptApprovalLayout`), a régi kulcs értéke figyelmen kívül marad
(`run-view-approval-layout.ts`, regressziós unit teszttel; SPEC-008 8. szekció 1. pont).

### 11.4 A külső elválasztó `End` állása (O-13), a teljes hatókörrel

11\. jelenet, előtte és utána azonos számokkal, két témában:

| Sáv        | Viewport | Külső `End` | Transcript oldal | Görgetés nélkül: lapozó / Következő / Jóváhagyás / Elutasítás | Tab után a Jóváhagyás gombra: ugyanez |
| ---------- | -------- | ----------- | ---------------- | ------------------------------------------------------------- | ------------------------------------- |
| függőleges | 768x1024 | 93          | 768 x 60         | 1 / 1 / 0 / 0                                                 | 0 / 0 / 1 / 1                         |
| függőleges | 820x1180 | 94          | 820 x 60         | 1 / 1 / 0 / 0                                                 | 0 / 0 / 1 / 1                         |
| függőleges | 900x1000 | 92          | 900 x 60         | 1 / 1 / 0 / 0                                                 | 0 / 0 / 1 / 1                         |
| függőleges | 1000x700 | 88          | 1000 x 60        | 1 / 1 / 0 / 0                                                 | 0 / 0 / 1 / 1                         |
| függőleges | 1023x768 | 89          | 1023 x 60        | 1 / 1 / 0 / 0                                                 | 0 / 0 / 1 / 1                         |
| vízszintes | 1024x768 | 92          | 80 x 568         | 1 / 0 / 0 / 0,72                                              | 1 / 0 / 0 / 0,72                      |
| vízszintes | 1440x900 | 94          | 80 x 700         | 1 / 0 / 0 / 0,72                                              | 1 / 0 / 0 / 0,72                      |

A "lapozó" oszlop a "k / n" helyjelző. A függőleges sávban a fókusz a gombokat előgörgeti (a
lapozó közben kicsúszik), a vízszintesben semmi nem hozza elő őket. A CLI sorrend ezt nem oldja
meg: a fix rész (a 48 pixeles lapozó és a 61 pixeles akciósáv) nagyobb a külső panel 60 pixeles
magasságánál, és szélesebb a 80 pixeles szélességénél. A SPEC-008 14.2 O-13 tétele ezért a
teljes hatókörrel nyitva marad (a user döntését kéri).

### 11.5 A gráf szerkesztő elválasztójának elavult határa

A független ellenőrzés szerint a gráf szerkesztőben a csomópont kijelölése után az elválasztó
`aria-valuemin`/`aria-valuemax` értéke a fókuszig 5/95 volt. Ok: a beállítás panel a kijelöléskor
csatolódik, a `Resizable` viszont csak a saját csatolásakor, ablak átméretezéskor, fókuszkor és
húzás vagy billentyű előtt mért, tehát addig az egy panelos mérésen (a forrás [5, 95] tartományán)
maradt. Javítás (`packages/ui` `Resizable.tsx`): egy panel csatolása is mérést vált ki. Mérve
(e2e, `graph-editor-layout.spec.ts`): a kijelölés után, fókusz nélkül 1440x900-on 6/94,
1024x768-on 8/92, ugyanaz, mint a fókusz utáni újramérés; a javítás nélkül 5/95 (mindkét teszt
bukik). Ugyanez a futás nézetben az élőben érkező jóváhagyás törzsére is igaz. A fül sávban a
csatoláskor rejtett "Transcript" fül továbbra is a következő eseményig vár (SPEC-008 8. szekció 1.
pont).

### 11.6 Regressziók és szándékos rontások

- `apps/web/e2e/approval-prompt.spec.ts`, "CLI sorrend", négy méreten, két témában: a régióban a
  lapozó és a jóváhagyás címével nevezett csoport, a csoport leírása a szöveg; Tab az
  elválasztótól a "Jóváhagyás" gombig transcript sor nélkül; a kezdő, `Home` és `End` állásban a
  sorrend transcript, elválasztó, szöveg, lapozó, gombok, rés nélkül (egy pixel tűrés), a lapozó
  és a két gomb `toBeInViewport({ ratio: 1 })`. `approval-surface.spec.ts`: a lapozó kifestett
  képpontja is a `--ep-bg-elevated` tokenje. Unit: `RunViewTranscriptSide` (sorrend, a transcript
  nem szerel le), `ApprovalPromptPanel` (régió csak tartalommal), `ApprovalDecisionActions` és
  `RunViewScreen` (a csoport a cím és a szöveg azonosítójára mutat), `DrawerFooter`, `Resizable` (a
  később csatolt panel mérése).
- **Rontások, mind bukik:** (a) a gombsor a transcript alatt (a törzs panel az első, a transcript
  a második gyerek): a "CLI sorrend" e2e 8/8 esete bukik (Tab 7, illetve 4 transcript soron át), és
  a `RunViewTranscriptSide` unit tesztje; (b) az ARIA kötés kivétele (`DrawerFooter` szerepkör és
  hivatkozás nélkül): a "CLI sorrend" e2e 8/8 esete bukik (a csoport nem található), és két unit
  teszt (`ApprovalDecisionActions`, `RunViewScreen`); (c) a panel csatolásakori mérés kivétele: a
  gráf szerkesztő két e2e esete (5/95 a 6/94 és 8/92 helyett) és a `Resizable` unit tesztje.

### 11.7 Képek

A munkamenet `outputs/jovahagyas-cli-sorrend/` mappájában: kezdő, `Home` és `End` állás, valamint
jóváhagyás nélkül, 1440x900, 1440x600, 375x812 (a "Transcript" fülön) és 900x1000 méreten, mindkét
témában (a fájlnévben a jelentett érték). A képek egy repón kívüli, eldobott Playwright futásból
származnak, ami a repó `approval-fixture.ts` fixtúráját importálta (a 10.7 szerinti okból).

## 12. A rajz összehúzódik: függő jóváhagyásnál a kérdés kifér (2026-09-25)

**Kiváltó ok.** A user 2026-09-25-i döntése ("a rajz húzódjon össze"): ha függő jóváhagyás van, és a
felhasználó még nem állított saját arányt, az elválasztók annyira mozduljanak, hogy a kérdés
szövege és a gombok kiférjenek (a rajz, illetve a transcript rovására); saját aránynál a tárolt
arány marad. Egy független ellenőrzés a `2743b6b` állapoton mérte, hogy álló tableten a kérdésből
semmi nem látszik (lásd lent, "előtte").

### 12.1 Módszer

`bun run measure:approval -g kerdes` (a mérő eszköz 12. jelenete, `measurement/approval-panel.ts`):
egy jóváhagyással (a fixtúra rövid szövegével), hosszú szöveggel és 30 mezős `payload` értékkel,
és jóváhagyás nélkül; a tárolt arány három állapotában (nincs, saját külső `[60, 40]`, saját belső
`[70, 30]`); 768x1024, 900x1000, 1000x700, 1023x768 (függőleges sáv), 1440x600, 1440x900
(vízszintes sáv) és 375x812 (fül sáv, a "Transcript" fülön) méreten, két témában. Mért: a
"visszavonhatatlan" figyelmeztetés, a cím, a szöveg, a lapozó és a két gomb látható aránya (a
befoglaló doboz metszve minden levágó ős kliens területével és a viewporttal), a vászon, a két
`Resizable` panelei, a transcript lista magassága, a kérdés igénye (a szöveg alja a görgethető
törzs tetejétől, a görgetéstől függetlenül), a két elválasztó jelentett értéke és a két
`localStorage` kulcs értéke. A két téma minden számban egyezik. Előtte a `20d8620` kódján (a
termékkód ideiglenesen visszaállítva), utána a mostanin.

### 12.2 Előtte

| Méret    | Figyelmeztetés / cím / szöveg | Gombok | Vászon | Törzs / igény |
| -------- | ----------------------------- | ------ | ------ | ------------- |
| 768x1024 | 0,66 / 0 / 0                  | 1 / 1  | 573    | 66 / 162      |
| 900x1000 | 0,6 / 0 / 0                   | 1 / 1  | 557    | 62 / 162      |
| 1000x700 | 0 / 0 / 0                     | 1 / 1  | 347    | 60 / 162      |
| 1023x768 | 0 / 0 / 0                     | 1 / 1  | 394    | 60 / 162      |
| 1440x600 | 1 / 0,79 / 0                  | 1 / 1  | 400    | 143 / 181     |
| 1440x900 | 1 / 1 / 1                     | 1 / 1  | 700    | 293 / 181     |
| 375x812  | 1 / 1 / 1                     | 1 / 1  | fül    | 210 / 181     |

Két további mért tény a tárolóról, jóváhagyástól függetlenül: (a) a futás nézet első megnyitása
után mindkét kulcs az alapértelmezéssel jelen van (`[70,30]`, `[50,50]`), felhasználói húzás
nélkül is, mert a `Resizable` a kezdő renderen is értesített (`onSizesChange`), és a hívó
tárolt; (b) egy kis csoportban a mért minimumhoz igazítás is a tárolóba íródott: 768x1024-en a
tárolt `[70, 30]` belső arány `[54,44, 45,56]`-ra íródott felül, a felhasználó döntése elveszett.
A kulcs megléte tehát a saját arányról nem mond semmit.

### 12.3 A szabály és a megoldás

**A szabály.** Saját arány nélkül az elválasztók annyira mozdulnak, hogy a látott jóváhagyás
kérdése (a figyelmeztetés, a cím és a szöveg, a `payload` nélkül) a görgethető törzsben teljesen
látsszon, a gombok közvetlenül alatta. A szükséges méret a tartalomból jön: a törzs panele
akkora legyen, hogy a szöveg alja a törzs alja fölé kerüljön (`measureRevealRequirement`, felfelé
egész pixelre kerekítve, mert a `flex-basis` százalék tört pixelt ad). Előbb a befoglaló
elválasztó ad helyet, ha ugyanazon a tengelyen áll (a függőleges sávban a gráf és a transcript
közti, a rajz rovására), a belső arányt megtartva (kezdetben felén); a maradékot a belső elválasztó
fizeti, a transcript rovására; a vízszintes és a fül sávban csak a belső mozdul. Mindkettő a design
system pixeles minimumáig mozdul (a panel 60 pixele), tovább nem. **A hosszú szövegre ugyanez a
szabály**: ha a kérdés a határokon belül sem fér el, a határig mozdul, a figyelmeztetés, a cím és
a szöveg első sorai látszanak, a többi a törzsben görgethető; a `payload` mindig a görgethető
részben marad, mert az a kérdés részlete, nem maga a kérdés. Jóváhagyás nélkül semmi nem mozdul.

**A mozdulás ideiglenes.** Nem kerül a tárolóba, és a jóváhagyás eltűnésekor a mozdulás előtti
arány áll vissza; lapozáskor (másik jóváhagyás, más szöveg) a számítás a mozdulás előtti arányból
újra fut, tehát egy rövidebb szövegre visszafelé is igazodik, az alapállás alá nem. Ha a
felhasználó közben húzza az elválasztót, a méret az övé: onnan tárolódik, a felfedés vége nem írja
felül, és az a csoport a leszereléséig nem igazodik.

**A saját arány felismerése** (`is-own-layout-sizes.ts`; 2026-09-26 óta felülírva, a saját arány
egy új, csak felhasználói írású kulcs megléte, 13. szekció): saját az a tárolt, érvényes pár, ami
eltér az alapértelmezéstől. Ok: a (a) pont szerint a kulcs megléte nem bizonyít felhasználói
döntést, az alapértelmezés viszont a korábbi automatikus írás értéke volt. A `Resizable`
2026-09-25 óta **csak a felhasználó változtatására értesít** (húzás, nyíl, `Home`, `End`, `Enter`),
a kezdő renderen, a minimumhoz igazításkor és a felfedéskor nem, tehát innentől a tárolóba csak a
felhasználó döntése kerül, és a (b) pont hibája sem ismétlődhet. A kimondott következmény: egy
pontosan az alapértelmezésre (billentyűvel, 5-ös lépésközzel elérhető `[50, 50]` vagy `[70, 30]`)
visszahúzott arány nem számít sajátnak.

**A megvalósítás** (`packages/ui` `resizable` téma, generikus): a `Resizable` két új propja a
`reveal` (a felfedendő elem azonosítója és egy kulcs) és az `adjustsForReveal` (mozdulhat-e). A
beágyazott csoport a befoglaló csoport kontextusán kér helyet (`resizeForReveal`,
`plan-container-growth.ts`), a saját tervét a `plan-reveal.ts` tiszta függvénye adja. A csoport
rendelkezésre álló méretét a csoport kliens területéből mérjük, nem a panelek összegéből
(`measure-group-available.ts`): 1000x700-on a belső csoport 34,5 pixel, a két panel pedig a
60-60 pixeles minimumán túllóg, és az összegből számolva a befoglaló csoport a szükségesnél
kevesebbet adott (mérve: a szöveg 0 arányban látszott). A számítás a felfedés kezdetekor, a kulcs
és a mozdíthatóság változásakor, egy panel csatolásakor, az ablak átméretezésekor és a befoglaló
csoport tengelyváltásakor fut; a fül sávban csak a "Transcript" fülön (a rejtett fül nulla méretű,
`run-view-transcript-visibility.ts`). `ResizeObserver` nincs (a `packages/ui` csomagban és az
`apps/web` termékkódjában tiltott), pixel küszöb és időzítő sincs, a mérés a `packages/ui`
csomagban áll (az `apps/web` termékkódja geometriát nem olvas, greppes invariánsok (15) és (17)).

### 12.4 Utána

| Méret    | Figyelmeztetés / cím / szöveg | Gombok | Vászon (előtte) | Belső panelek           | Tároló |
| -------- | ----------------------------- | ------ | --------------- | ----------------------- | ------ |
| 768x1024 | 1 / 1 / 1                     | 1 / 1  | 381 (573)       | 162 / 162               | üres   |
| 900x1000 | 1 / 1 / 1                     | 1 / 1  | 358 (557)       | 162 / 162               | üres   |
| 1000x700 | 1 / 1 / 1                     | 1 / 1  | 60 (347)        | 159 / 162               | üres   |
| 1023x768 | 1 / 1 / 1                     | 1 / 1  | 125 (394)       | 162 / 162               | üres   |
| 1440x600 | 1 / 1 / 1                     | 1 / 1  | 400 (400)       | 105 / 181               | üres   |
| 1440x900 | 1 / 1 / 1                     | 1 / 1  | 700 (700)       | 293 / 293 (változatlan) | üres   |
| 375x812  | 1 / 1 / 1                     | 1 / 1  | fül             | 210 / 210 (változatlan) | üres   |

- A függőleges sávban a rajz fizet, a belső arány felén marad (1000x700-on a rajz a 60 pixeles
  minimumán áll, és a maradék 3 pixelt a transcript fizeti). A vízszintes sávban a transcript
  fizet. Ahol a kérdés elfért (1440x900, 375x812), semmi nem mozdul.
- Hosszú szöveggel (igény 211-403 pixel): a függőleges sávban teljesen kifér (768x1024: vászon
  233, törzs 236); 1440x600-on a transcript a 60 pixelén, a szöveg 0,24 arányban, 375x812-n a
  transcript a 60 pixelén, a szöveg 0,8 arányban látszik, a figyelmeztetés és a cím mindenhol 1.
- Saját aránnyal: a saját arányú elválasztó nem mozdul, a másik a szabály szerint igen (768x1024,
  saját belső `[70, 30]`: a rajz fizet, a törzs 162 pixel; saját külső `[60, 40]`: a transcript a
  minimumáig fizet, a szöveg 0,71 arányban). Mindkettő saját: nem mozdul semmi, a tárolt érték
  változatlan (e2e).
- Jóváhagyás nélkül minden méret változatlan (vászon 573, 557, 347, 394, 400, 700; lista 163, 156,
  66, 86, 297, 597, 409), és a tároló üres marad.

### 12.5 A kimondott következmény a vízszintes sávban

1440x600-on a transcript panel 105 pixelre szűkül. A transcript tartalma (a 16-16 pixeles belső
térköz, a delta kapcsoló háromsoros mondata, a hézag és a lista egy sornyi, 53 pixeles minimuma)
ennél magasabb (143 pixel, pontosan a korábbi kezdő arány), tehát a transcript burkolója görget (a
design system modellje, 10. szekció), és kezdő állásban a burkolóban csak a mondat látszik; a lista
utolsó sora 0,34 arányban (mérő eszköz, `measure:transcript` 13. jelenet, research
`2026-09-23-transcript-panel-meresek.md` 22. szekció; előtte 1). Ez a döntés szó szerinti
következménye ("a transcript kárára"), nem hiba; hogy a transcript minimuma a tartalmához (a
mondat plusz egy sor) igazodjon-e, user döntés (SPEC-008 14.2 O-16).

### 12.6 A Tab lépések pontosítása (a 11.2 szekció "3 lépés" állítása)

`bun run measure:approval -g tab-lepesek` (13. jelenet), négy méreten, két témában, a jóváhagyás
elválasztójától a "Jóváhagyás" gombig, valódi `Tab` billentyűvel: **egy jóváhagyással 3 lépés**
(a görgethető törzs, az egyetlen oldal gombja, a "Jóváhagyás"); **négy jóváhagyással az első
oldalon 7** (a törzs, a négy oldal gomb, a "Következő", a "Jóváhagyás"), **a második oldalon 8**
(előtte az "Előző" is), **az utolsó oldalon 7** (a törzs, az "Előző", a négy oldal gomb, a
"Jóváhagyás"; a "Következő" letiltva, nincs a sorrendben); transcript sor egyik esetben sincs a
lépések között. A 11.2 szekció "minden méreten 3
lépés" mondata tehát csak egy jóváhagyásra igaz.

### 12.7 Regressziók és szándékos rontások

- `apps/web/e2e/approval-prompt.spec.ts`, "a rajz összehúzódik": 768x1024, 900x1000 és 1440x600
  méreten, két témában (a) saját arány nélkül a figyelmeztetés, a cím, a szöveg és a két gomb
  `toBeInViewport({ ratio: 1 })`, a mozgó elválasztó az alapértelmezés alatt áll, a tároló üres;
  (b) saját aránnyal mindkét tárolt arány marad; (c) jóváhagyás nélkül az alapértelmezés áll, a
  tároló üres. A `20d8620` kódján (a termékkód visszaállítva) az (a) 6/6 és a (c) 6/6 eset bukik
  (a (c) a kezdő render tárolása miatt), a (b) 6/6 zöld.
- `apps/web/e2e/sse-real-server.spec.ts`, "görgetés látható jóváhagyás mellett" (1440x900 és
  900x1000, két témában): követés, a kinyitott utolsó sor a helyén marad, az ugrás gomb és a kézi
  visszatérés, mindegyik után a kérdés is teljesen látszik; és az élőben érkező jóváhagyás: a lista
  zsugorodik (1440x900-on 597-ről 190-re, 900x1000-en 156-ról 79-re), az utolsó sor alja a lista
  alján marad, a jóváhagyás eltűnésekor a lista és a külső elválasztó visszaáll. A `20d8620`
  kódján 900x1000-en az élő érkezés 2/2 esete bukik (a kérdés nem látszik). **Rontás:** a
  transcript átméretezés követésének kivétele (`TranscriptPanel` `onResize` a hook hívása nélkül):
  az élő érkezés 4/4 esete bukik (az utolsó sor alja nem a lista alján), a többi 12 zöld.
- Unit: `Resizable` (felfedés: saját elválasztó, alapállás visszaállítása, mozdíthatatlan csoport,
  kulcsváltás, ablak átméretezés, nem létező elem, rejtett csoport, felhasználói húzás után; a
  befoglaló csoport ad helyet előbb, a minimumánál a belső fizet, más tengelyű és mozdíthatatlan
  befoglaló nem ad, tengelyváltás, együtt csatolva sem vonja vissza; az értesítés csak
  felhasználói változtatásra), `grow-panel`, `plan-reveal`, `plan-container-growth`,
  `measure-reveal-requirement`, `measure-group-available`, `is-own-layout-sizes`, `RunViewLayout`
  (a láthatóság kontextus és a fül sáv), `RunViewTranscriptSide`.

### 12.8 Képek

A munkamenet `outputs/rajz-osszehuzodik/` mappájában: `elotte-kerdes-*` és `utana-kerdes-*`
768x1024, 900x1000, 1440x600, 1440x900 és 375x812 méreten (a "Transcript" fülön), és
`elotte-ugras-gomb-*`, `utana-ugras-gomb-*` 900x1000 és 1440x900 méreten, mindkét témában. A képek
egy repón kívüli, eldobott Playwright futásból származnak, ami a repó `approval-fixture.ts` és
`run-view-stream.ts` fixtúráját importálta (a 10.7 szerinti okból).

## 13. A felfedés javítása: csak belső saját arány, újraszámolás a méretváltozásra, saját arány új kulcson (2026-09-26)

**Kiváltó ok.** Egy független ellenőrzés az `e3e952f` állapoton (valódi Chromium, két témában)
három hibát mért: (1) csak belső saját aránnyal (`[70, 30]` a jóváhagyás belső kulcsán, a külső
nincs állítva) a külső elválasztó a rajzot 60 pixelre nyomta, a kérdés mégsem látszott; (2) a
felfedés nem futott újra a csoport méretváltozására: a döntés hibaüzenete megnövelte az
akciósávot, és a külső elválasztó húzása újratördelte a szöveget; (3) a "saját arány" az
alapértelmezéstől való eltérés volt, tehát egy pontosan az alapértelmezésre visszahúzott arány nem
számított sajátnak. És a user döntése (2026-09-26, "a kérdés az első"): a 12.5 szekció vízszintes
sávbeli következménye így marad (SPEC-008 14.1 O-16).

### 13.1 Módszer

`bun run measure:approval -g "kerdes|hibauzenet|kulso-huzas"` (a mérő eszköz 12., 14. és 15.
jelenete, `measurement/approval-panel.ts`, képet nem ír): a 12. jelenet a 12.1 szerint, 375x667-tel
bővítve és a látható listasorok számával; a 14. jelenet a `conflict` döntés hibaüzenete előtt és
után (375x812 a "Transcript" fülön, 1440x600, 768x1024, 1000x700, 1440x900); a 15. jelenet a külső
elválasztó mozdítása előtt és után, valódi egér húzással (a transcript oldal felé 200, a
függőleges sávban 150 pixel) és billentyűvel (három nyíl lépés), 1440x900, 1440x600, 1024x768 és
900x1000 méreten. Mind két témában, és a két téma minden mért számban egyezik (kivétel a látható
listasorok száma két esetben, ami a mérés pillanatától függ). A saját arány jelenetei a régi és az
új kulcsra is írnak, tehát ugyanaz a jelenet a kulcscsere előtti kódon (a régit olvassa) és utána
(az újat) is ugyanazt az esetet méri. Előtte az `e3e952f` kódján, utána a mostanin. A nyers
kimenet a munkamenet `outputs/felfedes-javitas/meres/` mappájában.

### 13.2 Csak belső saját arány (`[70, 30]`), egy jóváhagyással

| Méret    | Figyelmeztetés / cím / szöveg, előtte | Vászon, előtte | Figyelmeztetés / cím / szöveg, utána | Vászon, utána     | Belső elválasztó |
| -------- | ------------------------------------- | -------------- | ------------------------------------ | ----------------- | ---------------- |
| 768x1024 | 1 / 1 / 1                             | 165            | 1 / 1 / 1                            | 165               | 70 (marad)       |
| 900x1000 | 1 / 1 / 1                             | 141            | 1 / 1 / 1                            | 141               | 70 (marad)       |
| 1000x700 | 1 / 0 / 0                             | 60             | 0 / 0 / 0                            | 347 (változatlan) | 70 (marad)       |
| 1023x768 | 1 / 0,5 / 0                           | 60             | 0 / 0 / 0                            | 394 (változatlan) | 70 (marad)       |
| 1440x600 | 0,73 / 0 / 0                          | 400            | 0,73 / 0 / 0                         | 400               | 70 (marad)       |
| 1440x900 | 1 / 1 / 0,8                           | 700            | 1 / 1 / 0,8                          | 700               | 70 (marad)       |
| 375x812  | 1 / 0,05 / 0                          | fül            | 1 / 0,05 / 0                         | fül               | 70 (marad)       |

**A szabály (2026-09-26 óta felülírva, lásd a 15. szekciót: "Ideiglenesen engedjen").** A saját
belső arány marad (a user döntése). A külső elválasztó egésszel vagy semmivel mozdul: csak akkor, ha a kérdés a saját belső arányon, a külső határán belül teljesen
kifér, és akkor pontosan annyit (768x1024, 900x1000); különben a külső sem mozdul (1000x700,
1023x768). Indok: a külső minden átadott pixeléből a kérdés csak a belső arány szerinti részt kapja
(itt 30 százalékot), a többi a transcripté; ha a teljes igény a külső határán belül sem teljesíthető,
a mozdulás a kérdést nem hozza elő (előtte 1000x700-on és 1023x768-on a szöveg a 60 pixelre
nyomott rajz mellett is 0 maradt), csak a rajzot nyomja össze. Saját arány nélkül a részleges hely
is a kérdést szolgálja (a maradékot a belső elválasztó fizeti), ezért ott a 12.3 szerinti határig
mozdulás marad. **Kimondott következmény:** 1000x700-on és 1023x768-on csak belső saját aránnyal a
kérdésből semmi nem látszik (a figyelmeztetés sem, mert a belső csoport két panelje a saját arányán
a 60 pixeles minimuma alá kerülne, és a csoport túllóg); a gombok és a lapozó látszanak (1 / 1), a
felhasználó a belső elválasztóval a kérdést előhozhatja. Megvalósítás: `packages/ui`
`plan-container-growth.ts` `requiresFullGrowth` (a kérő csoport maga nem mozdulhat), a
`plan-reveal.ts` a saját mozdíthatatlanságát adja át.

### 13.3 Újraszámolás a méretváltozásra

| Eset                                  | Előtte (szöveg) | Utána (szöveg)  | Megjegyzés                                                      |
| ------------------------------------- | --------------- | --------------- | --------------------------------------------------------------- |
| hibaüzenet, 375x812, "Transcript" fül | 0,61            | 1               | a régió 109-ről 186 pixelre nő, a belső elválasztó 50-ről 47-re |
| hibaüzenet, 1440x600                  | 0,12            | 1               | a régió 109-ről 144 pixelre nő, a transcript 105-ről 70 pixelre |
| hibaüzenet, 768x1024, 1000x700        | 1               | 1               | a régió itt nem nő (109 pixel marad)                            |
| külső, három nyíl, 1440x900 (85)      | 0,72            | 1               | a törzs 293-ról 308 pixelre nő                                  |
| külső, egér 200 pixel, 1440x900 (84)  | 1               | 1               | az igény (288) a kezdő törzsbe (293) még belefért               |
| külső, három nyíl, 900x1000 (60)      | 0               | 0,34            | a transcript a 60 pixeles minimumán, a határig                  |
| külső, egér 150 pixel, 900x1000 (64)  | 0               | 0 (cím 0,38)    | a transcript a 60 pixeles minimumán, a határig                  |
| külső, 1440x600, egér és billentyű    | 0               | 0               | a transcript a minimumán, a határig (cím 0,92, illetve 0,5)     |
| külső, 1024x768, egér és billentyű    | 0               | 0, illetve 0,35 | a határig; a "Jóváhagyás" gomb vízszintesen kilóg (0 és 0,45)   |

Az 1440x600-as, az 1024x768-as és a nagyobb elmozdítású 900x1000-es esetben a kérdés a belső
elválasztó határán belül sem fér el; ott a 12.3 szerinti határig mozdulás történik. Az 1024x768-as
esetben (a külső elválasztó 90, illetve 85 százalékán) a gombsor szélesebb a transcript oldalnál,
az a fix rész szélessége, nem a felfedésé (a SPEC-008 14.2 O-13 tételének rokona).

**A megoldás.** `ResizeObserver` nélkül (`packages/ui` `component-boundary-invariant`, `apps/web`
greppes invariáns (7)): (a) a `Resizable` minden új felfedés leírásra (`ResizableReveal`, a hatás
függősége maga az objektum, a React `Object.is` szerint hasonlít,
<https://react.dev/reference/react/useLayoutEffect>) újra számol, és a `RunViewScreen` minden
renderelésekor új leírást ad, tehát a képernyő minden React állapotváltozását követi (a döntés
eredménye és hibája, a lista hibája, a lapozás, a fejléc); (b) a befoglaló `Resizable` kontextusa
a felhasználói méretváltoztatások számát adja (`userResizeCount`: húzás, nyíl, `Home`, `End`,
`Enter`), és a beágyazott csoport erre is újra számol. A csoport saját és a befoglaló csoport
felfedés okozta újrarenderelése a leírást nem cseréli, tehát nem indít újabb számítást.

**Egy változatlan elrendezésre a terv ugyanaz.** A csoport rendelkezésre álló mérete 2026-09-26 óta
a befoglaló doboz tört pixeles magassága a két szegély nélkül (`measure-group-available.ts`,
`read-pixels.ts`), nem a `clientHeight`: az egész számra kerekített (CSSOM View
`readonly attribute long clientHeight`, <https://drafts.csswg.org/cssom-view/>; MDN: "An integer",
<https://developer.mozilla.org/en-US/docs/Web/API/Element/clientHeight>; a
`getBoundingClientRect()` tört értéket ad, MDN "Determining the dimensions of elements",
<https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Determining_the_dimensions_of_elements>),
és a kerekítés hibája a befoglaló csoport tervébe is bekerülne, amit most minden renderelés újra
kiszámol. Az azonos értékű terv nem ír új állapotot. Mérve (e2e, `sse-real-server.spec.ts`
"látható jóváhagyás mellett a lista követ"): 1440x900-on és 900x1000-en, két témában, élő
keretek alatt a két csoport összes panelének `flex-basis` értéke változatlan.

### 13.4 A saját arány: új kulcs, csak felhasználói írással

A két arány új kulcson áll: `eggRunViewUserLayout` (a gráf és a transcript) és
`eggRunViewTranscriptApprovalUserLayout` (a transcript és a jóváhagyás). A kulcsokra kizárólag a
felhasználó változtatása ír (a `Resizable` `onSizesChange` 2026-09-25 óta csak arról értesít), tehát
a saját arány a kulcs megléte, érvényes párral; egy pontosan az alapértelmezésre visszahúzott arány
is saját, a 12.3 kivétele megszűnt. A régi kulcsok (`eggRunViewLayout`,
`eggRunViewTranscriptApprovalLayout`, és a még régebbi `eggRunViewApprovalLayout`) nem olvasottak,
mert a 12.2 (a) pontja szerint a kezdőértéket felhasználói húzás nélkül is tartalmazhatják.
Regresszió: `run-view-layout.spec.ts`, `run-view-approval-layout.spec.ts` (a régi kulcs figyelmen
kívül marad, az alapértelmezésre visszahúzott pár saját, a hibás és a rossz alakú érték nem saját);
az `is-own-layout-sizes.ts` törölve.

### 13.5 O-16 lezárva, és a testvér esete

A user döntése (2026-09-26, "a kérdés az első"): a 12.5 szerinti vízszintes sávbeli következmény
marad. Mérve (`kerdes` jelenet, két témában): 1440x600-on a transcript panel 105 pixel (a
hibaüzenet után 70); 375x667-en a "Transcript" fülön a transcript panel 93 pixel, a jóváhagyás
törzse 181, és a listából egyetlen sor sem látszik (0). Mindkettő a transcript burkolójának
görgetésével elérhető.

### 13.6 Regressziók és a bukás igazolása

- `apps/web/e2e/approval-prompt.spec.ts`, két témában: (a) csak belső saját aránnyal 1000x700-on és
  1023x768-on egyik elválasztó sem mozdul (mindkettő 70), a tároló változatlan; 768x1024-en a
  kérdés és a gombok teljesen látszanak, a belső 70 marad, a külső a 70 alá mozdul; (b) a döntés
  hibaüzenete után 375x812-n és 1440x600-on a kérdés, a gombok és a hibaüzenet teljesen látszanak;
  (c) a külső elválasztó billentyűs mozdítása után (1440x900 három, 900x1000 egy nyíl lépés) és egér
  húzása után (1440x900, 215 pixel, ugyanaz a hely, mint a három nyíl lépés) a kérdés és a gombok
  teljesen látszanak, a belső arány nem tárolódik. **Bukás a `e3e952f` kódján** (a termékkód
  ideiglenesen visszaállítva): mind a 16 új teszt bukik; a régi kulcsra írt saját aránnyal is 14
  bukik, csak a 768x1024-es (a szabállyal egyező) eset zöld: a külső 70 helyett 12, illetve 11
  (1000x700, 1023x768), a szöveg 0,61 és 0,12 (hibaüzenet), a három nyíl után 0,72.
- `apps/web/e2e/sse-real-server.spec.ts`: a "látható jóváhagyás mellett a lista követ" tesztje az
  élő keretek előtt és után a panelek `flex-basis` értékének egyezését is állítja.
- Unit: `Resizable` (új leírásra újra számol, ugyanaz a leírás nem, egy változatlan elrendezésre
  nincs újabb véglegesítés, React `Profiler`; saját belső aránnyal a befoglaló csak a teljes igényt
  adja meg, különben semmit; a befoglaló felhasználói mozdítására a belső újra számol),
  `plan-container-growth`, `plan-reveal`, `measure-group-available`, `read-pixels`,
  `run-view-layout`, `run-view-approval-layout`. Szándékos rontással igazolva: a `requiresFullGrowth`
  ág kivételére, az azonos értékű terv ellenőrzésének kivételére és a befoglaló számláló
  függőségének kivételére egy-egy unit teszt bukik.
- A korábbi e2e-k (a kérdés kifér hét méreten, saját arány marad, jóváhagyás nélkül változatlan,
  mini lista, görgetés látható jóváhagyással) változatlanul zöldek; a teljes e2e készlet 407
  teszt, mind zöld.

### 13.7 Képek

A munkamenet `outputs/felfedes-javitas/` mappájában, `elotte-*` (az `e3e952f` kódja) és `utana-*`,
mindkét témában: `sajat-belso-1000x700`, `sajat-belso-1023x768`, `sajat-belso-768x1024`,
`nincs-sajat-1000x700` (a rajz a 60 pixelén), `hibauzenet-375x812`, `hibauzenet-1440x600`,
`kulso-huzas-1440x900` (három nyíl), `kulso-huzas-900x1000` (egy nyíl), `o16-1440x600`,
`o16-375x667-transcript-ful`. A képek a 10.7 szerinti okból egy repón kívüli, eldobott Playwright
futásból származnak, ami a repó `approval-fixture.ts` fixtúráját importálta.

## 14. A döntés hibája a design system `danger` `Alert` blokkjában (2026-09-26)

**Kiváltó ok.** A user 2026-09-24-i döntése ("Mindhárom javítás", SPEC-007 8.4): a REST hibák a
design system `danger` `Alert` blokkjában jelennek meg, a szerver `message` mezője nélkül, ".:"
dupla írásjel nélkül. A jóváhagyás akciósávjában eddig egy kis betűs `<p role="alert">` állt a
gombok előtt, a mondattal és a szerver szövegével (`Az elem állapota most nem engedi a
műveletet.: a jóváhagyás már el lett döntve`). A kérdés: hová kerül a blokk, és mit csinál a
felfedéssel (13. szekció).

### 14.1 Módszer

`bun run measure:approval -g hibauzenet` (a mérő eszköz 14. jelenete, `measurement/approval-panel.ts`,
képet nem ír, instrumentálatlan build), a `conflict` döntés előtt és után, öt méreten, két témában.
Előtte a `b0708b2` kódján (a régi `<p>`), utána a mostanin. A két téma minden mért számban egyezik.
A nyers kimenet a munkamenet `outputs/rest-hibauzenet/meres/` mappájában (`elotte-hibauzenet.log`,
`utana-hibauzenet.log`). A blokk két elhelyezési változatát és a `box-sizing` hatását egy repón
kívüli, eldobott Playwright futás mérte a `approval-fixture.ts` fixtúrával (`getBoundingClientRect`,
instrumentált build), a 13.7 szerinti okból.

### 14.2 A döntés után (a mondat, `conflict`)

| Méret    | Szöveg, előtte | Belső panelek, előtte | Régió, előtte | Szöveg, utána | Belső panelek, utána | Régió, utána |
| -------- | -------------- | --------------------- | ------------- | ------------- | -------------------- | ------------ |
| 375x812  | 1              | 161 / 181             | 186           | 1             | 159 / 181            | 188          |
| 1440x600 | 1              | 70 / 181              | 144           | 0,44          | 60 / 166,5           | 168,5        |
| 768x1024 | 1              | 162 / 162             | 109           | 1             | 162 / 162            | 168,5        |
| 1000x700 | 1              | 159 / 162             | 109           | 1             | 99,5 / 162           | 168,5        |
| 1440x900 | 1              | 275,5 / 275,5         | 144           | 1             | 263,25 / 263,25      | 168,5        |

A "Belső panelek" a transcript és a jóváhagyás törzse, a "Régió" a lapozó plusz az akciósáv. A
hibaüzenet (`alert`), a cím, a két gomb és a lapozó minden méreten 1 arányban látszik, előtte és
utána is. **1440x600-on a kérdés szövege 0,44 arányban látszik**: a törzsnek 180,8 pixel kell, a
transcript a 60 pixeles minimumán áll, és a törzs 166,5 pixelt kap (az instrumentált buildben 167,
a szöveg aránya 0,42).

### 14.3 Az elhelyezés és a `box-sizing`

- **A gombok fölötti saját sor** (a választott): 1440 pixelen az akciósáv 61-ről 121 pixelre nő,
  375 pixelen 140-re.
- **A gombok mellett** (`flex: 1 1 auto`): a mondat 1440 pixelen is három sorba törik, a sáv 122
  pixel, 375 pixelen 161. Egyik méreten sem alacsonyabb, tehát 1440x600-on ez sem fér el.
- **`box-sizing` nélkül** a saját sorú blokk szélessége 416,5 pixel a sáv 382,5 pixeles tartalma
  helyett (a `.alert` 32 pixeles vízszintes belső térköze és 2 pixeles szegélye a 100 százalékos
  alap fölött), és a `flex-end` igazítás miatt 10 pixellel a panel bal széle alá lóg; a hibaüzenet
  1440x600-on 0,976 arányban látszott. `border-box` mellett a blokk pontosan a tartalom széles.

### 14.4 Következmény

A forrás `Alert` elemének nincs kisebb változata (a `tone`, a `banner` és az `icon` sem csökkenti
érdemben a magasságot), tehát 1440x600-on a hibaüzenet, a gombok és a teljes kérdés együtt nem fér
el a "kérdés az első" szabály (O-16) mellett sem. Ez két user döntés ütközése volt, a SPEC-008
O-17 pontja; a user 2026-09-26-án elfogadta (15.5 szekció): a blokk a gombok fölötti saját sorban
áll, 1440x600-on a kérdés szövegének alja levágódik, és a szöveg a görgethető törzsben olvasható.

### 14.5 Képek

A munkamenet `outputs/rest-hibauzenet/` mappájában, mindkét témában: `jovahagyas-conflict-1440x900`,
`jovahagyas-conflict-375x812`, `jovahagyas-conflict-1440x600` (az O-17 levágás),
`workflow-torles-hiba-1440x900`, `workflow-letrehozas-hiba-1440x900`,
`futas-inditas-hiba-modalis-1440x900`, `futas-inditas-hiba-lablec-1440x900`,
`futas-elozmenyek-betoltesi-hiba-1440x900`. A képek a 13.7 szerinti okból egy repón kívüli,
eldobott Playwright futásból származnak, ami a repó fixtúráit és `page.route()` mockjait használta.

## 15. A saját belső arány ideiglenesen enged, O-17 elfogadva, a külső húzás e2e (2026-09-26)

**Kiváltó ok.** Egy független ellenőrzés a `b0708b2` állapoton mérte: ha a felhasználó csak a
belső (transcript és jóváhagyás közti) arányt állította be, a külsőt nem, és ezen az arányon a
kérdés nem fér ki (1000x700, 1023x768), a 13.2 "egésszel vagy semmivel" szabálya miatt semmi nem
mozdul: a kérdésből semmi, csak a lapozó és a két gomb látszik, a belső csoport 39,5, illetve 59,9
pixel, a két panel túllóg a 60 pixeles minimumán, és a belső elválasztó nem érhető el (az
`elementFromPoint` nem találja). A user döntése (2026-09-26, "Ideiglenesen engedjen"): a rajz és
szükség esetén a belső arány is ideiglenesen enged, amíg a kérdés kifér; a tárolt saját arány nem
íródik felül, és a felfedés végén visszaáll; a felfedés közbeni húzás a felhasználó új aránya; a
belső elválasztó mindig látható és elérhető; a 60 pixeles minimumok érvényesek. Ugyanez az
ellenőrzés mérte, hogy a külső húzás e2e tesztje a `userResizeCount` jel kivételére nem bukik.

### 15.1 Módszer

`bun run measure:approval -g "kerdes|kulso-huzas"` (a 12. és a 15. jelenet, `measurement/approval-panel.ts`,
képet nem ír, instrumentálatlan build), két témában. A 12. jelenet 2026-09-26 óta a belső csoport
magasságát, a belső elválasztó látható arányát és egérrel elérhetőségét (a középpontjában álló
legfelső elem az elválasztó vagy a leszármazottja, `elementFromPoint`) is méri, és egy negyedik
tárolási esetet (`sajat-mindketto`: a külső `[60, 40]`, a belső `[70, 30]`). Előtte a `c566213`
(HEAD) termékkódján (a `Resizable.tsx` és a `RunViewScreen.tsx` ideiglenesen visszaállítva),
utána a mostanin. A két téma minden mért számban egyezik. A nyers kimenet és a táblázatok a
munkamenet `outputs/felfedes-ideiglenes/meres/` mappájában (`elotte.log`, `utana.log`,
`*-tabla.txt`).

### 15.2 Csak belső saját arány (`[70, 30]`), egy jóváhagyással

| Méret    | Figyelmeztetés / cím / szöveg, előtte | Belső csoport, elválasztó elérhető, előtte | Figyelmeztetés / cím / szöveg, utána | Belső csoport, elválasztó elérhető, utána | Vászon, utána | Külső / belső, utána |
| -------- | ------------------------------------- | ------------------------------------------ | ------------------------------------ | ----------------------------------------- | ------------- | -------------------- |
| 768x1024 | 1 / 1 / 1                             | 545, igen                                  | 1 / 1 / 1                            | 545, igen                                 | 165           | 20 / 70              |
| 900x1000 | 1 / 1 / 1                             | 545, igen                                  | 1 / 1 / 1                            | 545, igen                                 | 141           | 18 / 70              |
| 1000x700 | 0 / 0 / 0                             | 39,5, nem                                  | 1 / 1 / 1                            | 326, igen                                 | 60            | 12 / 50              |
| 1023x768 | 0 / 0 / 0                             | 59,9, nem                                  | 1 / 1 / 1                            | 394, igen                                 | 60            | 11 / 58              |
| 1440x600 | 0,73 / 0 / 0                          | 291, igen                                  | 1 / 1 / 1                            | 291, igen                                 | 400           | 70 / 37              |
| 1440x900 | 1 / 1 / 0,8                           | 591, igen                                  | 1 / 1 / 1                            | 591, igen                                 | 700           | 70 / 69              |
| 375x812  | 1 / 0,05 / 0                          | 424, igen                                  | 1 / 1 / 1                            | 424, igen                                 | fül           | fül / 57             |
| 375x667  | 0,69 / 0 / 0                          | 279, igen                                  | 1 / 1 / 1                            | 279, igen                                 | fül           | fül / 34             |

A két gomb minden sorban, előtte és utána is 1 arányban látszik. A tárolt belső arány minden
esetben `[70,30]` marad, a külső kulcs üres. A saját arány nélküli (`nincs`, egy, hosszú és nulla
jóváhagyással), a csak külső saját arányú és a teljes saját arányú (`sajat-mindketto`) eset minden
mért száma bájtra azonos előtte és utána (80 sor), és a 15. jelenet (a külső elválasztó húzása
saját arány nélkül, 16 mérés) is.

### 15.3 A szabály és a megvalósítás

- **A sorrend** ugyanaz, mint saját arány nélkül (12.3), csak a belső kiinduló aránya a tárolt
  saját arány: előbb a külső ad helyet a belső arányt megtartva, és ha a külső határa sem elég, a
  maradékot a belső fizeti. 768x1024-en és 900x1000-en a rajz egymaga elég, a belső 70 marad;
  1000x700-on és 1023x768-on a rajz a 60 pixeles minimumára húzódik, és a belső 50-re, illetve
  58-ra enged. A vízszintes és a fül sávban a külső nem ad helyet, ott csak a belső enged.
- **A bekötés:** a belső `Resizable` `adjustsForReveal` értéke igaz, ha a belső vagy a külső
  arány nem saját (`RunViewScreen.tsx`); ha mindkettő saját, hamis, és egyik sem mozdul. A
  `Resizable` algoritmusa ehhez nem változott: a tárolt arány a `defaultSizes`, a felfedés előtti
  méret (`revealBase`), és a felfedés vége ezt állítja vissza; a tárolóba továbbra is csak a
  felhasználó változtatása ír (`onSizesChange`).
- **Egy futó felfedést a mozdíthatóság megszűnése nem állít meg** (`packages/ui` `Resizable`): ha
  a felhasználó a felfedés közben a külső elválasztót mozdítja, mindkét arány sajáttá válik, és a
  futás nézet a következő renderelésétől a belső `adjustsForReveal` értékét hamisra adja. E nélkül
  a belső egy tetszőleges későbbi renderelésnél (egy élő sor, a döntés) visszaugrana a tárolt
  arányára, és a kérdés levágódna; mérve (e2e, 1000x700, két témában, a javítás nélkül) egy élő
  sor után a kérdés már nem látszott teljesen. A csoport ezért a felfedés végéig igazodik, ha már
  igazodott; a következő felfedés az új értékkel indul.
- **Az "egésszel vagy semmivel" ág** (`plan-container-growth.ts` `requiresFullGrowth`) arra az
  esetre marad, amikor a felhasználó a felfedés közben a belső elválasztót húzta (az az ő aránya,
  a belső onnan nem igazodik), változatlanul.

### 15.4 A külső húzás e2e a `userResizeCount` jelre

Az `approval-prompt.spec.ts` külső elválasztó tesztjei (1440x900 és 900x1000 billentyűvel,
1440x900 egér húzással, két témában) a `mockSseFrames` lezárt válaszát használták: a böngésző a
válasz végén újracsatlakozik (HTML Standard 9.2.2, "reestablish the connection",
<https://html.spec.whatwg.org/multipage/server-sent-events.html>), és a mock ugyanazt a pótlást
adja újra, aminek a `replay_complete` kerete a lépés futások és a jóváhagyások újratöltését, tehát
a képernyő újrarenderelését váltja ki (a független ellenőrzés mérése szerint 3113 és 6120 ms-nál).
Az újrarenderelés új felfedés leírást ad, tehát a felfedés a `userResizeCount` jel nélkül is újra
számol, és a teszt a várakozási idején belül zöld lesz. A javítás: a két teszt a
`mockSseFramesWithoutReconnect` mockot használja (`e2e/sse-mock.ts`), ami csak az első kapcsolatot
szolgálja ki; a második kérés függőben marad, mert a Playwright dokumentációja szerint egy
útvonalra illeszkedő kérés "will stall unless it's continued, fulfilled or aborted"
(<https://playwright.dev/docs/api/class-page#page-route>; megerősítve:
<https://qaskills.sh/blog/playwright-network-interception-route-guide>,
<https://runebook.dev/en/docs/playwright/api/class-route/route-continue>). Időzítő nincs.

**Igazolva** (a `Resizable` hatásának függőségei közül a `containerUserResizeCount` ideiglenesen
kivéve): az új alakú hat teszt mind bukik (a szöveg aránya 0,716, 900x1000-en 0,227), a HEAD alakú
ugyanez a hat teszt ugyanazon a kódon mind zöld (az újrapótlás elfedi).

### 15.5 O-17 elfogadva

A user döntése (2026-09-26): 1440x600-on, ha egy jóváhagyási döntés hibára fut, a `danger`
`Alert` blokk a kérdés szövegének alját levágja (a 14. szekció szerint 14 pixel), és a szöveg a
görgethető törzsben görgetve olvasható. Az `approval-prompt.spec.ts` 1440x600-on ezt állítja (a
görgetve olvashatóság a meglévő `expectReadableByScrolling` segédfüggvénnyel), a korábbi "nem
látszik teljesen" állítás helyett.

### 15.6 Regressziók és a bukás igazolása

- `apps/web/e2e/sse-real-server.spec.ts`, két témában: (a) csak belső saját aránnyal 1000x700,
  1023x768, 768x1024 és 900x1000 méreten a figyelmeztetés, a cím, a szöveg és a két gomb
  `toBeInViewport({ ratio: 1 })`, a belső elválasztó `toBeInViewport({ ratio: 1 })` és a
  középpontjában egérrel elérhető, ha a belső engedett, a külső a legkisebb helyén áll
  (`aria-valuenow` egyenlő az `aria-valuemin` értékkel), a tárolt arány `[70,30]`, és egy élő
  `approval_decided` keret utáni eltűnéskor a külső 70-re, a transcript panel `flex-basis`
  értéke 70 százalékra áll vissza, a tároló változatlan; (b) 1000x700-on a külső elválasztó
  felfedés közbeni mozdítása után egy élő sor sem ugrasztja vissza a belsőt.
- **Bukás a `c566213` (HEAD, a `b0708b2` szabálya) termékkódján:** az (a) 1000x700-as és
  1023x768-as négy tesztje és a (b) két tesztje bukik (a figyelmeztetés nem látszik); a 768x1024-es
  és a 900x1000-es négy teszt zöld, mert ott a viselkedés nem változott (a rajz egymaga elég).
  **A felfedés végi visszaállítás kivételére** (`endReveal` nem állítja vissza a méretet) az (a)
  bukik (a külső 12 marad 70 helyett). **Az új rögzítés kivételére** a (b) két tesztje bukik.
- `apps/web/e2e/approval-prompt.spec.ts`: a 13.6 (a) két "nem fér ki, egyik sem mozdul" tesztje
  törölve (a döntés felülírta); a 768x1024-es "a rajz egymaga elég" teszt marad; a külső húzás
  tesztjei újrapótlás nélkül (15.4); az O-17 teszt a görgetve olvashatóságot állítja (15.5).
- Unit: `Resizable` (egy már igazodó felfedést az `adjustsForReveal` hamisra váltása nem állít
  meg, a végén visszaáll, a következő felfedés az új értékkel indul); a rögzítés kivételére bukik.

### 15.7 Képek

A munkamenet `outputs/felfedes-ideiglenes/` mappájában, mindkét témában: `utana-sajat-belso-*`
(1000x700, 1023x768, 768x1024, 900x1000, 1440x600, 375x812 a "Transcript" fülön),
`elotte-sajat-belso-*` (1000x700, 1023x768, 1440x600, 375x812, a `c566213` termékkódján) és
`utana-o17-hibauzenet-1440x600`. A képek a 13.7 szerinti okból egy repón kívüli, eldobott
Playwright futásból származnak, ami a repó `approval-fixture.ts` fixtúráját importálta.
