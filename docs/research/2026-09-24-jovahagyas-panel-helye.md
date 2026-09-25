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
