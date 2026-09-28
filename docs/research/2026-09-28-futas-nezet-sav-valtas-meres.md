# A futás nézet gráf/transcript sáv-váltási pontjának mérése (O-7 lezárás)

Kapcsolódó: SPEC-008 14.2 O-7 (nyitott kérdés), PLAN-009 T-009-29, `.claude/CLAUDE.md` 4. szekció
(bizonyíték kényszer) és 12. szekció (mérő eszköz a repóba).

## 1. A kérdés

A futás nézet gráf/transcript osztott elrendezése három reszponzív sávot használ (SPEC-008 10.
szekció): `< --ep-screen-md` fülek, `--ep-screen-md ... --ep-screen-lg - 1` függőlegesen egymás
alatt, `>= --ep-screen-lg` vízszintesen egymás mellett. Az O-7 kérdés: a két token
(`--ep-screen-md`, `--ep-screen-lg`) VÁLASZTÁSA helyes-e erre a váltásra, vagy a valódi törés
(vízszintes túllógás, illetve a panelek gyakorlati használhatatlansága a CSS pixeles minimum
közelében) máshol van.

## 2. Módszer

SPEC-007 5.3 szekció módszere: valódi Chromium, `apps/web` preview build (nem instrumentált,
`VITE_COVERAGE=false`), a dokumentum vízszintes túllógása (`scrollWidth - clientWidth`) sűrű
rácson mérve a két érintett token körül. Az eszköz: `apps/web/measurement/run-view-band.ts`
(`bun run measure:run-view-band`), ami a `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md`-t
megelőző mérésekkel megegyező, repóba vitt mérő eszköz mintát követi (számot ír, képet nem).

A vizsgált szélességek: mindkét token (`--ep-screen-md` = 768, `--ep-screen-lg` = 1024) 64
pixellel alatta és fölötte, plusz a token eggyel alatti értéke (a media query illesztésének másik
oldala): 704, 767, 768, 832, 960, 1023, 1024, 1088. A viewport magassága rögzített, 900 pixel. A
mérés minden ponton rögzíti: a dokumentum túllógását, az aktív sávot (`tabs` / `vertical` /
`horizontal`, a fülsor, illetve az elválasztó `aria-orientation` attribútuma dönti el), és a gráf,
illetve a transcript panel tényleges pixelméretét a sáv tengelye szerint, valamint ennek távolságát
a `packages/ui` `resizable-panel` CSS pixeles minimumától (80×60, `packages/ui/src/resizable/resizable.css`).

## 3. Mért adatok

Nyolc pont, mind a nyolc lefutott (`8 passed`), mindegyik nulla kilépési kóddal:

| Szélesség | Sáv        | Túllógás | Gráf méret (px) | Transcript méret (px) | Gráf a minimum fölött (px) | Transcript a minimum fölött (px) |
| --------- | ---------- | -------- | --------------- | --------------------- | -------------------------- | -------------------------------- |
| 704       | tabs       | 0        | -               | -                     | -                          | -                                |
| 767       | tabs       | 0        | -               | -                     | -                          | -                                |
| 768       | vertical   | 0        | 486.5           | 208.5                 | 426.5                      | 148.5                            |
| 832       | vertical   | 0        | 486.5           | 208.5                 | 426.5                      | 148.5                            |
| 960       | vertical   | 0        | 486.5           | 208.5                 | 426.5                      | 148.5                            |
| 1023      | vertical   | 0        | 486.5           | 208.5                 | 426.5                      | 148.5                            |
| 1024      | horizontal | 0        | 713.31          | 305.69                | 633.31                     | 225.69                           |
| 1088      | horizontal | 0        | 758.11          | 324.89                | 678.11                     | 244.89                           |

A `vertical` sávban a négy szélesség (768, 832, 960, 1023) azonos gráf/transcript magasságot ad,
mert ebben a sávban a panelek a MAGASSÁG szerint osztoznak (a viewport magassága rögzített 900
pixelen mindegyik mérésnél), a szélesség változása nem hat erre a tengelyre - ez az elvárt
viselkedés, nem mérési hiba.

## 4. Kiértékelés

1. **Túllógás nincs egyetlen mért pontban sem.** Mind a nyolc szélességen `overflow: 0`; ez
   megegyezik a `responsive.spec.ts` kapu tesztjének eredményével a design system mind a hét
   töréspontján, itt csak sűrűbb rácson, a két érintett token körül megismételve.
2. **A sávváltás pontosan a token értékén történik, mindkét oldalon.** A `--ep-screen-md` (768)
   alatt (767) még `tabs`, pontosan 768-on már `vertical` - nincs csúszás. A `--ep-screen-lg`
   (1024) alatt (1023) még `vertical`, pontosan 1024-en már `horizontal` - nincs csúszás. A media
   query illesztés tehát a tervezett tokeneken áll, méréssel megerősítve.
3. **A panelek minden mért pontban messze a gyakorlati használhatósági minimum fölött maradnak.**
   A legszűkebb mért eset (768 széles, `vertical` sáv) is 426.5, illetve 148.5 pixellel a
   80×60-as CSS minimum fölött áll mindkét panelen; a `horizontal` sávba lépéskor (1024) ez
   633.31, illetve 225.69 pixel. Nincs olyan mért pont, ahol egy panel a minimum közelébe szorulna.

**Következtetés: a `--ep-screen-md`/`--ep-screen-lg` token választás helyes.** Sem túllógás, sem
csúszó váltási pont, sem a minimumhoz szoruló panel nem mutatkozott a token körüli sűrű rácson.
Az O-7 ezzel lezárva, tippelés nélkül, méréssel (SPEC-008 14.1).
