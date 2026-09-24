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

A panel és a transcript közti `--ep-space-4` térköz külső margó: belső térközként a görgető panel
tartalmával együtt kigördült, és a panel alja a transcript szövegéhez tapadt (képernyőképen
látva).

## 5. A kétértelmű pont

A "transcript mellé" két olvasatot enged: a panel a transcript sávon BELÜL áll (megvalósítva),
vagy egy harmadik, önálló sávot kap. A megvalósítás a legkevésbé invazív olvasatot követi, ami a
meglévő két sávos `Resizable` és a `--ep-screen-md` alatti `Tabs` elrendezést nem változtatja
(SPEC-008 10. szekció). **Nyitott**: mi a viselkedés addig: a fenti; mi zárná le: a user döntése
arról, kér-e önálló sávot.

## 6. Képek

A 0, 1 és 4 jóváhagyásos, a siker és a `conflict` utáni állapot mindkét témában, plusz a telefon
méret két füle: a munkamenet `outputs/t-009-27-javitas/` mappájában, a mérő script kimenetével
(`meresek.json`) együtt.
