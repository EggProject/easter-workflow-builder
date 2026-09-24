# A topnav stream jelző sötét témában: ink felület gyűrűs pöttyel

Dátum: 2026-09-24. Minden szám saját, most futtatott mérés a pinelt `@playwright/test@1.62.1`
(chromium, `chromium-1234` build) ellen, hacsak a sor mást nem mond.

## 1. A döntés és a forrás példái

**User döntés (2026-09-24):** sötét témában a topnav stream jelzője (`StreamStatusIndicator`, a
`packages/ui` `FeedIndicator` komponense) a forrás `ink` felületét gyűrűs pöttyel használja, a
forrás ink példái szerint. Világos témában semmi nem változik.

**A forrás példái** (`eggproject-design-components/components/feed-indicator/feed-indicator.html`):

- Az "Ink surface" (dark chrome, sidebars) blokk mindhárom példája (`streaming`, `stale`,
  `disconnected`) a pöttyre `ep-dot--ring`-et tesz, és egyik sem visel `ep-dot--halo`-t:
  `ep-dot--success ep-dot--ring ep-dot--pulse`, `ep-dot--warning ep-dot--ring ep-dot--blink`,
  `ep-dot--danger ep-dot--ring ep-dot--hollow`. `connecting` állapotú ink példa nincs.
- A paper blokkok (a négy kanonikus állapot, a soft, az outline és a compact változat) egyike sem
  tesz gyűrűt; a kanonikus és a compact blokk `connecting`, `streaming` és `stale` pöttye
  `ep-dot--halo`-t visel.
- A `dot/dot.html` "Modifiers" blokkja a `ring` módosítót sűrű, sötét hátterű mintán mutatja be
  (`swatch--dense`, "ring (on ink bg)"); a forrás `Dot.jsx` leírása: "hard ring outline (good on
  dense bg)".
- A gyűrű útja a forrásban a `FeedIndicator` `dotProps` propja ("any extra props for the inner
  `<Dot>`"), ami a `.jsx` szerint az állapotból számolt módosítók UTÁN terül szét.

**A megvalósítás:** sötét témában `dotProps={{ ring: true, halo: false }}`, világosban üres
`dotProps` (a `FeedIndicator` alapértelmezése), tehát a világos DOM változatlan.

## 2. Miért kell a `halo: false`: a `dot.css` kaszkádja

A `dot.css` (bájtra azonos a forrással) `.ep-dot--ring` szabálya egyetlen osztály, a halo tónusos
változatai (`.ep-dot--halo.ep-dot--success`, `--warning`, `--danger`, `--yolk`, `--neutral`,
`--muted`, `--ink`) kettő, tehát magasabb specificitásúak: ahol a halo és a gyűrű együtt áll, a
halo nyer. Kivétel az `info` tónus, amire csak az egyosztályos `.ep-dot--halo` vonatkozik, és azt
a később álló `.ep-dot--ring` felülírja. A `.ep-dot--hollow` szintén egy osztály és a
`.ep-dot--ring` UTÁN áll, tehát a `disconnected` állapotban a körvonal nyer a gyűrű felett.

**Mérve** (számított `box-shadow`, sötét téma, három build: a gyűrű előtti `HEAD`, a javítás, és
egy szándékosan rontott változat `halo: false` nélkül):

| fázis (forrás állapot)          | gyűrű előtt (`HEAD`) | javítás (`ring`, `halo: false`)    | rontás (`ring`, halo marad) |
| ------------------------------- | -------------------- | ---------------------------------- | --------------------------- |
| `connecting` (`connecting`)     | halo                 | gyűrű                              | gyűrű (info: a gyűrű nyer)  |
| `live` (`streaming`)            | halo                 | gyűrű                              | **halo** (a gyűrű nem fest) |
| `reconnecting` (`disconnected`) | körvonal (`hollow`)  | körvonal, a `ring` osztály mellett | körvonal                    |

A `disconnected` sor a forrással azonos: a forrás saját ink "Offline" példáján is kizárólag a
körvonal fest (számított `box-shadow`: `rgb(240, 156, 168) 0px 0px 0px 1.5px inset` sötét
témában), a `ep-dot--ring` osztály ellenére.

## 3. Mérés: a gyűrű kifestett pixele

**A mérés módja.** Eldobható mérő spec a repón kívül (`/private/tmp/feed-ring-meres/`, a
`screenshot-pipeline` invariáns miatt), valódi Chromium, 1440x900, a három `vite build` statikus
kiszolgálón, minden REST hívás mockolva. A `connecting` fázis a `/events` kérés válasz nélküli
visszatartásával, a `live` és a `reconnecting` fázis egy célra írt `node:http` teszt szerverrel (a
nyitva tartott, illetve `retry: 600000` után lezárt kapcsolat). Minden felvétel
`animations: 'disabled'` mellett, hogy a `pulse` hullám ne essen a kivágatba (a végtelen animáció
a felvétel idejére a kezdő állapotára áll vissza,
<https://playwright.dev/docs/api/class-page#page-screenshot>, a telepített `playwright-core@1.62.1`
`types/types.d.ts` ugyanígy). Mintavétel DPR 4 mellett a pötty függőleges középvonalán: a pötty
közepe, a rés közepe (0.75 CSS px a pötty felső élén kívül), a gyűrű közepe (2.25 px) és a gyűrűn
túl (4.5 px). A "box-shadow eltérés" a pötty kivágatának két képe (a `box-shadow` réteggel és
`box-shadow: none !important` alatt) közötti legnagyobb csatorna eltérés, DPR 1 mellett, ahogy az
e2e teszt méri.

**A topnav pöttye, `live` fázis (DPR 4), és a forrás ink "Live" példája:**

| minta                           | pötty közepe | rés         | gyűrű       | gyűrűn túl  | box-shadow eltérés |
| ------------------------------- | ------------ | ----------- | ----------- | ----------- | ------------------ |
| topnav, sötét, gyűrű előtt      | 125,211,168  | 30,50,47    | 30,50,47    | 27,30,36    | 20                 |
| topnav, sötét, javítás          | 125,211,168  | 27,30,36    | 125,211,168 | 27,30,36    | 181                |
| forrás ink "Live", sötét téma   | 125,211,168  | 27,30,36    | 125,211,168 | 10,18,48    | 193                |
| topnav, világos, előtte = utána | 47,156,106   | 222,239,231 | 222,239,231 | 255,255,255 | 33                 |

A javított topnav gyűrűje pixelre egyezik a forrás ink példájáéval: a rés `27,30,36` (a
`--ep-bg-elevated` sötét értéke, a `dot.css` gyűrűjének belső sávja), a gyűrű `125,211,168` (a
`--ep-success` sötét értéke, a pötty `currentColor`-ja). Az egyetlen eltérés a gyűrűn túli háttér:
a forrás ink panelje `--ep-ink-900` (`10,18,48`), a topnav sávja `--ep-bg-elevated`, ezért a
topnavon a rés beleolvad a sáv hátterébe, a forrás panelján látszik. Ez a `FeedIndicator`
átállásakor (`b3464c4`) választott elhelyezés következménye, nem a gyűrűé.

**A `connecting` fázis (DPR 4):** gyűrű előtt a rés és a gyűrű `29,40,66` (halo), a javítás után
a rés `27,30,36`, a gyűrű `46,91,224` (a `--ep-blue-600`, az `info` tónus). A box-shadow eltérés
30 -> 188.

**Világos téma, előtte és utána:** mindhárom fázis minden mintája és box-shadow eltérése azonos
(`connecting` 34, `live` 33, `reconnecting` 199), és a teljes topnav sáv DPR 4-es képe a `live`
fázisban a két buildben pixelre azonos. Sötét témában ugyanez a két kép egyetlen, 14x14 CSS
pixeles dobozban tér el: a pöttyön és a gyűrűjén.

## 4. Az e2e kapu: `apps/web/e2e/stream-status-indicator.spec.ts`

Két új állítás, a `connecting` fázison (a `/events` visszatartásával determinisztikus): a pötty
osztálylistája (sötétben `ep-dot--ring` `ep-dot--halo` nélkül, világosban változatlan), és a
kifestett gyűrű, a fenti box-shadow eltéréssel, mindkét témában és élő témaváltáson át, oda és
vissza.

**A küszöb.** A gyűrű nélküli állapotok legnagyobb box-shadow eltérése 34 (világos halo; a sötét
téma gyűrű előtti halója 30), a sötét gyűrűé 188: a **111** a kettő egész felezőpontja. A kapu
spec öt ismétlésben (`--repeat-each=5`, a repó Playwright configjával) mindig 188 (sötét) és 34
(világos) értéket mért.

**A bukás igazolva, a repó Playwright configjával:**

| rontás                                                          | ami bukik                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| a gyűrű előtti `StreamStatusIndicator.tsx` (`HEAD`)             | a sötét és az élő váltás teszt, osztály: `ep-dot--halo` a várt `ep-dot--ring` helyett |
| `ring: true`, de `halo: false` nélkül                           | ugyanaz a két teszt, osztály: `ep-dot--halo ep-dot--ring`                             |
| a `dot.css` gyűrűje a `--ep-bg-elevated` színnel (ideiglenesen) | ugyanaz a két teszt, pixel: `Expected: >= 111, Received: 1`; az osztály zöld          |

A harmadik sor mutatja, miért kell a pixel állítás az osztály mellé: a gyűrű osztálya ott van, a
gyűrű mégsem látszik (`.claude/CLAUDE.md` 11. szekció). A világos téma tesztjei mindhárom rontáson
zöldek maradtak.
