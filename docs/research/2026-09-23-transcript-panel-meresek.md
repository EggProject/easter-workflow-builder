# A transcript panel mérései (PLAN-009 T-009-25)

Dátum: 2026-09-23. Minden szám saját, most futtatott mérés a pinelt `react@19.2.8`,
`react-window@2.3.1` és `@playwright/test@1.62.1` (chromium) ellen, hacsak a sor mást nem mond. A
nem saját mérésből származó állításoknál a forrás URL-je áll.

## 1. A `lastFrame` állapot egy löketből csak az utolsó keretet adja át

**Kérdés.** A `useStreamConnection` minden dekódolt keretet egy `useState` értékbe (`lastFrame`)
ír. Egy erre épülő effekt látja-e az összes keretet, ha azok egy hálózati darabban érkeznek (a
pótlás pontosan így jön)?

**Módszer.** Eldobható mérőoldal (`esbuild` IIFE bundle a repó `react`/`react-dom` csomagjából,
a scratchpadben, nem a repóban), `node:http` SSE forrás, ami N darab `run_event` keretet EGYETLEN
`res.write` hívással küld, és valódi Chromium. A komponens két dolgot mér: a `lastFrame`
állapotra kötött `useEffect` futásainak számát, és egy függvény alakú állapotfrissítéssel
(`setCount((n) => n + 1)`) számolt keretszámot.

| N (keret egy darabban) | függvény alakú frissítés | `lastFrame` effekt futása |
| ---------------------- | ------------------------ | ------------------------- |
| 10                     | 10                       | 1                         |
| 1000                   | 1000                     | 1                         |
| 3000                   | 3000                     | 1                         |

**Verdikt.** A `lastFrame` egy löketből csak az utolsó keretet adja át; a köztes kereteket egy rá
épülő effekt sosem látja. Ami minden keretet igényel (a transcript), az ezért a
`subscribeToFrames` veszteségmentes feliratkozást használja, és függvény alakban frissít
(`stream-client/subscribe-to-stream-frames.ts`, `transcript-panel/use-run-transcript.ts`).

## 2. A függvény alakú hozzáfűzés költsége egy löketben

Ugyanaz a mérőoldal, a keretek egy tömb végére fűzve (`setRecords((prev) => [...prev, record])`),
az első keret érkezésétől az utolsó commitig mérve (JSON dekódolással együtt):

| N     | ms  |
| ----- | --- |
| 1000  | 26  |
| 5000  | 62  |
| 20000 | 336 |

Ez az egyszeri pótlás költsége; élő szakaszban keretenként egyetlen tömbmásolás. A projekt eddigi
legnagyobb mért futása 6143 esemény (`2026-09-05-grafszerkeszto-es-transcript.md` 3. szekció),
ennek a nagyságrendje a táblázat középső sora.

## 3. A `rowHeight` alak: `useDynamicRowHeight`

**A telepített `.d.ts`** (`node_modules/react-window/dist/react-window.d.ts`, 2.3.1) szerint a
`List` `rowHeight` propja négy alakot fogad: szám, százalék sztring, `(index, rowProps) => number`
függvény, és a `useDynamicRowHeight` hook által adott gyorsítótár. **A telepített forrás**
(`dist/react-window.js`, a `List` törzse) a negyedik alakot a lista belsejében pontosan a harmadikra
fordítja: `(index) => getRowHeight(index) ?? getAverageRowHeight()`, tehát a soronként eltérő
magasság ugyanazon a gépezeten megy, amit a T-009-4 mérés (O-5,
`2026-09-05-plan009-f0-blokkolo-meresek.md` 3. szekció) valós Chromiumban igazolt.

**Miért nem a tiszta függvény alak.** A sor kinyitható, és a kinyitott sor a teljes, tördelt JSON
payloadot mutatja (SPEC-008 7.1). Ennek a magassága a tartalomtól ÉS a panel szélességétől függ,
tehát adatból előre nem számítható; tiszta függvény alakkal a kinyitott sor rálógna a következőre.
A `useDynamicRowHeight` a kirajzolt tartalomból méri a magasságot, ami a SPEC-008 7.3 első
kimenete ("a sor magassága a tartalomból számítódik").

**Mérve** (`e2e/transcript-panel.spec.ts`): a kinyitott sor magasabb, mint az összecsukott, és a
következő sor teteje a kinyitott sor aljával egyezik (eltérés 0, egy tizedes pontossággal).

**A `ResizeObserver` kérdés.** A `useDynamicRowHeight` a könyvtáron BELÜL `ResizeObserver`-rel
mér, és maga a `List` is azzal méri a konténerét (ugyanaz a forrás). A projekt termékkódja nem
hivatkozik rá (a (7) greppes invariáns zöld), a happy-dom stub miatti hamis zöld kockázatát pedig a
geometriai állítások e2e helye fedi: a virtualizáció, a sormagasság és a jelölő oszlop tesztje
valódi böngészőben fut.

## 4. A cím: egy sorra csonkolt, ellipszissel

**A mért hiba a javítás előtt**, a panelen belül (a `run-event-row.css` csonkolási szabálya nélkül,
400 karakteres, szóköz nélküli URL-lel):

| Szélesség | dokumentum túllógás | lista túllógás | cím szélessége | fejléc magasságok (px) |
| --------- | ------------------- | -------------- | -------------- | ---------------------- |
| 375       | 0                   | 3719           | 4000           | 99,17 / 76,78 / 143,95 |
| 1440      | 0                   | 3662           | 4000           | 99,17 / 76,78 / 121,56 |

**Fontos mellékeredmény.** A dokumentum túllógása a panelen belül NULLA: a `react-window` gyökere
`overflow-y: auto`, amitől az `overflow-x` is `auto`, tehát a kilógó sor a LISTÁT görgeti, nem a
dokumentumot. A független ellenőrzés 3462-es dokumentum mérése a T-009-24 állapotán készült,
amikor a sort semmi nem csatolta fel, tehát nem a virtualizált lista görgető dobozán belül. A
túllógás teszt ezért a dokumentum mellett a lista görgető dobozát is méri.

**A javítás után:** mindkét szélességen dokumentum 0, lista 0, és mind a három sor fejléce
54,390625 pixel (a 54,4 a layout 1/64 pixeles egységére kerekítve).

**A döntés indoka.** Tördelt címnél a sor magassága a szöveg hosszától és a húzható panel
szélességétől függene, tehát a még nem kirajzolt sorok becslése pontatlan lenne, és minden
átméretezés minden sor magasságát megváltoztatná; csonkolt címnél minden összecsukott sor
ugyanolyan magas, és ez a magasság a design system CSS-éből előre ismert (5. szekció). A teljes
szöveg a gomb hozzáférhető nevében és a kinyitott payloadban megmarad.

**A CSS mechanizmus**, három független forrással (Sonnet subagent webes ellenőrzése, 2026-09-23):

- CSS Flexbox 1, 4.5: görgető konténer flex elemen az automatikus minimális méret nulla
  (<https://www.w3.org/TR/css-flexbox-1/#min-size-auto>); megerősítve: MDN `min-width`
  (<https://developer.mozilla.org/en-US/docs/Web/CSS/min-width>) és Flexbox Land
  (<https://flexboxland.com/content/05-advanced-concepts/01-automatic-minimum-size-of-flex-items>).
- CSS Overflow 3, 3.1: a `hidden` görgethető érték, a doboz görgető konténer
  (<https://www.w3.org/TR/css-overflow-3/#overflow-control>).
- CSS Overflow 3, 5.1: a `text-overflow` csak nem `visible` túlcsordulású dobozon hat
  (<https://www.w3.org/TR/css-overflow-3/#text-overflow>).

Ebből következik, és saját méréssel megerősítve: a `min-width: 0` az `overflow: hidden` mellett
fölösleges (nélküle ugyanaz a geometria, 7. szekció b), ezért a szabályban nem szerepel.

## 5. Az összecsukott sor magassága

`2 * 16 + 16 * 1,4 = 54,4` pixel: a design system `accordion.css` `.accordion__header` szabályának
két függőleges belső margója (`padding: 16px 4px`) és egy szövegsor (`font: 600 16px/1.4 ...`). Az
`.accordion__item` alsó szegélye nem adódik hozzá, mert a sor egyetlen `.accordion__item` eleme a
burkolójának utolsó gyereke (`:last-child { border-bottom: 0 }`). A konstans
(`collapsed-transcript-row-height.ts`) a `useDynamicRowHeight` `defaultRowHeight` értéke. Két
regressziós teszt őrzi: a unit teszt a forrás CSS-ből számolja újra, az e2e a kirajzolt sor
magasságát hasonlítja a fejléc számított stílusához, 375 és 1440 pixelen.

## 6. A virtualizáció

`e2e/transcript-panel.spec.ts`, 1440x900, a lista az aljára tapadva, majd a tetejére görgetve
(a számok a Playwright annotációjából):

| Sorok száma | DOM sor az alján | DOM sor a tetején |
| ----------- | ---------------- | ----------------- |
| 3000        | 16               | 16                |
| 6000        | 16               | 16                |

## 7. Szándékos rontások, mindegyik a hozzá tartozó teszttel

| Rontás                                                           | Teszt                                   | Eredmény                                                         |
| ---------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| a) `flex-shrink: 0` törölve az `.accordion__icon` szabályból     | jelölő oszlop geometria                 | bukik: az ikon 11,9375 px a szűkre húzott panelen (1440, 85/15)  |
| b) a csonkolási szabály törölve (`run-event-row.css`)            | vízszintes túllógás (`responsive.spec`) | bukik: a lista túllógása 3774 px 320 pixelen                     |
| b') csak a `min-width: 0` törölve, `overflow: hidden` marad      | ugyanaz                                 | NEM bukik: a szabály fölösleges volt, ezért törölve (4. szekció) |
| c) csak a `white-space: nowrap` törölve                          | összecsukott sor magassága              | bukik: 99,17 px a várt 54,4 helyett, 375 pixelen                 |
| d) a `List` `onResize` bekötése törölve                          | fül sáv, utolsó sor látszik             | bukik: a fül megnyitásakor az utolsó kirajzolt sor a 13., nem 40 |
| e) az `onResize` azonnal görget (nem a következő passzív effekt) | virtualizáció (laphiba figyelés)        | bukik: `RangeError: Invalid index specified: 2999`, lista nélkül |

Az a) rontás a támogatott viewport szélességeken önmagában NEM látszik, mert ott a cím nullára
zsugorodhat, és a flex elemek alapméretének összege elfér; a jelölő oszlop csak akkor zsugorodik,
ha a fejléc tartalma nem fér ki. Ezt a húzható elválasztóval szűkre állított panel (a gráf 85, a
transcript 15 százalék) állítja elő, ezért ez az eset a teszt része.

Az e) rontás oka a telepített forrásban (`dist/react-window.js`, a `useVirtualizer` törzse): a
lista az `onResize` hívást egy layout effektben adja ki, ami a komponensen belül MEGELŐZI azt a
layout effektet, ami a `scrollToRow` mögötti függvényt az aktuális sorszámra frissíti. Ha egy
commitban a méret és a sorszám is változik, az azonnali görgetés a régi sorszámmal ellenőriz.

## 8. A fül sáv: rejtett csatolás

A `--ep-screen-md` alatt a transcript a második fülön áll, a `Tabs` mindkét panelt felcsatolva
tartja, az inaktívat a natív `hidden` rejti. A csatoláskori "aljára görgetés" ezért rejtett elemen
fut, és nem hat: a d) rontás mérése szerint a fül megnyitásakor a lista a tetején áll. A javítás a
`List` `onResize` jelzése (a könyvtár `.d.ts` szövege szerint erre való: "This may be used to
(re)scroll a row into view"), ami követés közben újra az aljára görget; egy fülváltás oda-vissza
után is az utolsó sor látszik (mérve, 375x812).

## 9. Ami NEM ELLENŐRZÖTT

- Firefox és WebKit ellen nem futott mérés (az `apps/web/playwright.config.ts` ma kizárólag
  chromiumot definiál).
- Az élő, nyitott kapcsolatba menet közben érkező keretek útja (a szabálykönyv 11. szekciója
  szerinti `node:http` teszt szerverrel) a PLAN-009 T-009-30 hatóköre; itt az automatikus
  görgetés mindkét ágát két egymást követő, LEZÁRT SSE válasz (az `EventSource` újracsatlakozása)
  igazolja.
- A lépés futások élő frissülése: a panel a providert a képernyő megnyitásakor betöltött
  `StepRunRecord` listából oldja fel; egy később indult lépés `sdk_result` sora addig "nem ismert
  provider" állapotban áll, amíg a lista újra nem töltődik.

## 10. A csontváz színe a két témában, és a futó, üres transcript

**Módszer.** Eldobható mérő script a repón kívül (a `screenshot-pipeline` invariáns miatt):
`vite build` a scratchpadbe, `node:http` statikus kiszolgálás, a REST hívások `page.route()`
mockon, az SSE egy nyitva tartott `node:http` kapcsolaton, valódi Chromium, 1440x900. A pótlás
lezáró `replay_complete` kerete nélkül a transcript a csontváz állapotban marad. Mért érték a
`.transcript-panel__loading .skel` elemek számított `background-image` értéke, és a kifestett
pixel (`page.screenshot({ animations: 'disabled' })`, a PNG a böngészőben, canvasszal dekódolva)
mind a négy sáv 10, 50 és 90 százalékánál, plusz a panel háttere az első sáv fölött.

| Téma    | számított `background-image`                                          | sáv pixelek (RGB)           | panel háttér (RGB) |
| ------- | --------------------------------------------------------------------- | --------------------------- | ------------------ |
| világos | `linear-gradient(90deg, rgb(236, 231, 218), rgb(246, 243, 235), ...)` | 237,232,219 ... 245,242,233 | 246,243,235        |
| sötét   | ugyanaz                                                               | 237,232,219 ... 245,242,233 | 11,13,18           |

**Gyökérok: a design system forrása, nem az átemelés.** A forrás
`eggproject-design-components/components/skeleton/skeleton.css` `.skel` szabálya a nyers paletta
`--ep-paper-200` és `--ep-paper-100` tokenjére épül, amit a `theme-dark.css` nem definiál felül,
tehát a sáv mindkét témában ugyanazt a világos krémszínt festi. Az átemelt `packages/ui`
`skeleton.css` `.skel` szabályai bájtra azonosak a forrással (a `diff` eltérése kizárólag a
fejlécben dokumentált `.skel-list*` kihagyás), a `theme-dark.css` is bájtra azonos, és az
`apps/web` alatt nincs `.skel` felülírás. A forrás `DESIGN.md` "Skeleton" szekciója ezt a
leképezést nevesítve rögzíti (világos shimmer: `--ep-paper-200`/`--ep-paper-100`; sötét
felületre az opt-in `ink` változat: `--ep-slate-700`/`--ep-slate-600`), a `theme-light.css` saját
kommentje szerint viszont az "Interaction surfaces" tokenek épp a komponensek nyers
`paper-100/200` használatát váltják ki; a skeleton ezt a migrációt nem kapta meg. A csökkentett
mozgás ág (`--ep-bg-pressed`) téma függő, tehát ott a hiba nem jelentkezik.

**Lezárva (user döntés, 2026-09-23).** A forrás meglévő `ink` változata köti a sötét témát,
nem a forrás javítása/újraátemelés: a `packages/ui` `skeleton.css` bájtra azonos marad, új
token, új szín és új CSS szabály nem készül. A téma feloldását a fogyasztó végzi: az
`apps/web` `themed-skeleton` témája (`ThemedSkeleton`, `useIsDarkTheme`) egyetlen helyen olvassa
ki az élő `data-theme` attribútumot (`MutationObserver` a `packages/ui` `useThemeMode` által írt
attribútumon, újratöltés nélkül is naprakész), és minden `Skeleton` hívást erre a burkolóra
cserél, hogy a döntés ne ismétlődjön hívásonként. Megerősítő újramérés, ugyanazzal a
scripttel, a friss `apps/web` build ellen: világos témában a sáv pixelei változatlanok
(237,232,220 ... 245,242,233, panel háttér 246,243,235), sötét témában a számított
`background-image` `linear-gradient(90deg, rgb(42, 52, 71) 0%, rgb(62, 74, 96) 50%, rgb(42, 52,
71) 100%)` (a `--ep-slate-700`/`--ep-slate-600` token számított értéke), a kifestett sáv pixelei
44,54,73 ... 60,72,94 között, a panel háttere változatlanul 11,13,18. Élő témaváltásnál (oldal
újratöltés nélkül) a `.skel--ink` módosító azonnal meg- és eltűnik, e2e regresszió:
`apps/web/e2e/skeleton-theme.spec.ts`.

**A futó, üres transcript** (ugyanazzal a scripttel, a pótlás `replay_complete` keretével, mindkét
témában azonos eredmény). Előtte: `running` és `succeeded` futásnál is "A futásnak még nincs
eseménye.", `role="status"` elem nélkül. Utána: `running` futásnál egyetlen `role="status"` elem,
"Várakozás az első eseményre"; `succeeded` futásnál "A futásnak nincs eseménye.", státusz elem
nélkül.

## 11. A sor tipográfiája: mono csak a meta (2026-09-24)

**A döntés (user, 2026-09-24).** Az időbélyeg, az eszköznév, az azonosító és a számok a design
system Code szerepével (`--ep-text-code`), a sor szövege (eredet, címke, összefoglaló) a törzs
betűjével. A törzs token a `--ep-text-small` (`400 14px/1.5`, Roboto). **Hogy ez marad, azt a
user 2026-09-24-én külön döntésként rögzítette** (addig a végrehajtó saját választása volt), ezzel
az indokkal: a `packages/ui/src/design-token/typography.css` törzs betűs tokenjei közül ez az
egyetlen, aminek mérete és sormagassága a `--ep-text-code` (`500 14px/1.5`) tokenével azonos. Forrás: a design
system DESIGN.md 3. szekciója ("JetBrains Mono is reserved for code, tokens, timestamps and
numeric meta") és a SKILL.md (szemantikus type token, "never ad-hoc `font-size`").

**A hiba gyökere előtte.** A `run-event-row.css` `.run-event-row { font-family: var(--ep-font-mono) }`
szabálya a forrás `.accordion__header` `font-family: inherit` során át az egész fejlécre öröklődött.

**Módszer.** Eldobható mérő script a repón kívül (`/private/tmp/transcript-tipografia/measure.cjs`,
a screenshot-pipeline invariáns miatt), `vite build` a scratchpadbe az e2e `VITE_*` értékeivel,
előtte a `6dd8df9` (az `apps/web` kódja az `ab6e6b1` óta változatlan), utána a munkafa állapotán.
Valódi Chromium (`@playwright/test@1.62.1`), 1440x1500 ablak, `hu-HU` locale, `Europe/Budapest`
időzóna, mindkét téma, mérés a `document.fonts.ready` után. A transcript valós alakú: 19 perzisztált
esemény (a projekt MCP szerverének eszköznevei, `mcp__agent-tools__web_search` stb., valódi
formátumú azonosítók: `toolu_01T1x1fJ34qAmk2tNTrN7Up6` a
`2026-08-26-agent-sdk-minimax.md` fájlból, `call_a2fd4cce75a02c75` a
`tools/wire-probe/artifacts/00002-1787918376206.json` MiniMax-M3 válaszából), plusz 3 átmeneti
delta keret, `persistedStreamDeltas: false`. A transcript panel szélessége az alapértelmezett
70/30 arányon 400 pixel, a cím szlot ebből 334 pixel. A két téma minden száma azonos.

**Számított betű** (a `getComputedStyle` értéke):

| Elem                         | Előtte                               | Utána                                                    |
| ---------------------------- | ------------------------------------ | -------------------------------------------------------- |
| a cím (eredet, címke, törzs) | JetBrains Mono, 16px, 600, `22.4px`  | Roboto, 14px, 400, `21px` (`--ep-text-small`)            |
| a meta darabok               | nincs külön elem, a cím betűje       | JetBrains Mono, 14px, 500, `21px` (`--ep-text-code`)     |
| a költség meta               | Roboto 500 12px (`.accordion__meta`) | a felirat változatlan, az összeg JetBrains Mono 500 14px |

**Sormagasság.** Előtte mind a 22 sor 54,390625 pixel (a cím sordoboza 22,390625). Utána a 19
perzisztált sor 53 pixel, a cím sordoboza pontosan 21 pixel; a 3 átmeneti sor 54 pixel.

- **A levezetés:** `2 * 16 + 14 * 1,5 = 53`, az `accordion.css` fejléc belső margója és a
  `--ep-text-small` egy szövegsora. A CSS 2.1 10.8.1 szerint egy sorban álló, eltérő ascent és
  descent értékű betűcsaládok a sordobozt a `line-height` fölé is növelhetik
  (<https://www.w3.org/TR/CSS21/visudet.html#line-height>); a mérés szerint ezzel a két
  webfonttal, ezen a méreten a sordoboz nem nő, pontosan 21 pixel. Hogy ez melyik betűmetrikából
  következik, azt nem vizsgáltuk (nem ellenőrzött), ezért a konstans mért érték, és az e2e
  sormagasság teszt a betöltött webfontokon méri.
- **Az átmeneti sor kivétele:** a "Nem tárolt" `Badge` 22 pixel magas (a `badge.css` saját
  szabálya), ami a 21 pixeles címnél magasabb, tehát ez a sor 54 pixel. A `useDynamicRowHeight`
  a kirajzolt sort méri, a becslés csak a még nem kirajzolt átmeneti sornál tér el 1 pixellel.
  Előtte a 22,4 pixeles cím a `Badge`-nél magasabb volt, ezért ott nem jelentkezett. **Ennek a
  következménye nem volt ártalmatlan**, és ez a bekezdés eredetileg ezt nem mondta ki: a
  `react-window@2.3.1` a görgetés után nem igazít a mért magassághoz, tehát az utolsó sor alja
  átmeneti soronként egy pixellel lemaradt a lista aljától. Mérés és javítás: 13. szekció.

**Látható cím szélesség összecsukva, 400 pixeles panelen** (látható / teljes, pixel), és a SPEC-008
7.1 szerkezet (időbélyeg, eredet, címke, törzs), illetve 7.2 3. pont (eszköz neve, azonosítója):

| Sor                                              | Előtte     | Utána      | Láthatóság utána                                                                                                                   |
| ------------------------------------------------ | ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| motor, Futás indult                              | 334 / 480  | 334 / 334  | minden rész teljes                                                                                                                 |
| motor, Lépés elindult                            | 334 / 680  | 334 / 423  | időbélyeg, eredet, címke teljes, a törzs részben                                                                                   |
| eszközhívás, `mcp__agent-tools__web_search`      | 334 / 1720 | 334 / 1147 | időbélyeg, eredet, címke teljes; eszköznév 140/224 px (előtte 34/280); azonosító nem                                               |
| eredmény, `claude-subscription`, költség metával | 153 / 1140 | 142 / 698  | címke részben, 31/62 px (előtte egyáltalán nem); a törzs nem; a meta 180 px (előtte 169); a meta azóta csak az összeg, 14. szekció |
| átmeneti sor, Streamelt részlet                  | 246 / 620  | 246 / 384  | a címke teljes (előtte 76/170 px), a törzs részben                                                                                 |

**Ami a 400 pixeles panelen nem fér ki, mérve.** (1) Az eszközhívás azonosítója: a teljes
láthatósághoz a cím szlotnak 657 pixel kell (`web_search`, előtte 890), a MiniMax sorban 633
(`understand_image`, előtte 860), az eszköz eredmény sorban 626 (előtte 910). (2) Az eszköznév
teljes egészében: 409 pixel kell (`web_search`), illetve 457 (`understand_image`). (3) Az
eredmény sor törzse: a költség meta 180 pixelt foglal, a cím szlotnak 142 marad, a címke teljes
láthatóságához 164 kellene. A cím és a meta szerkezete a design system `accordion.css` szerinti,
a belső margó és a meta mérete nem változott.

**Képek:** `before-light.png`, `after-light.png`, `before-dark.png`, `after-dark.png`, ugyanezzel a
scripttel, a futás nézet teljes ablakáról.

## 12. A sor React kulcsa: `rowKey` (2026-09-24)

**A telepített forrás.** A pinelt csomag a `react-window@2.3.1` (`2026-08-26-toolchain.md`). A
`dist/react-window.d.ts` szerint a `List` propja
`rowKey?: (index: number, data: RowProps) => React.Key`, a doksi kommentje: "Lists use the row
index as a `key` by default", és "It is important to always `useCallback` for this prop; do not use
an inline function". A `dist/react-window.js` `List` törzse `key: d ? d(w, h) : w` alakban
kulcsol (`d` a `rowKey`, `w` a sorszám, `h` a memoizált `rowProps`).

**Webes megerősítés** (Sonnet subagent, 2026-09-24): a hivatalos doksi List props oldala
(<https://react-window.vercel.app/list/props>) ugyanezt a két mondatot hozza; a CHANGELOG
(<https://github.com/bvaughn/react-window/blob/main/CHANGELOG.md>) szerint a `rowKey` a 2.3.0-ban
érkezett ("Add optional `rowKey` prop to `List`"); a React doksi
(<https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key>) az index kulcsról:
"Index as a key often leads to subtle and confusing bugs."

**A bekötés.** A `transcript-row-key.ts` modul szintű (tehát stabil) függvénye a sor saját `key`
mezőjét adja. **Mérve, unit tesztben:** `rowKey` nélkül a lista elem a sorszámhoz kötődik; egy
elé beszúrt sor után a kinyitott sor lista eleme nem követi a sort, a benne álló `RunEventRow` a sor
saját (belső `map`) kulcsa miatt újracsatolódik, és a kinyitott állapot elvész: a teszt a `['3']`
helyett `[]`-t kap. Az állapot másik sorra nem kerül át, ezt a belső kulcs megakadályozza, tehát
a korábbi belső kulcs nem volt hatástalan, csak a lista elem azonosságát nem adta. **A
virtualizáció korlátja:** a kirajzolt tartományból kikerülő sort a lista leszereli, tehát a
kinyitott állapot csak a kirajzolva maradó sorra őrizhető meg (a debug futás szerint egy beszúrás
utáni első render még a régi tartományt rajzolja, és az onnan kicsúszó sor újracsatolódik).

## 13. A lista alja: az utolsó sor teljes egészében (2026-09-24)

**A hiba.** Egy független ellenőrzés a `f03b885` commiton mérte, hogy az automatikus követés és
az "Ugrás az aljára" gomb nem ér le az utolsó sor aljáig. A saját mérés megismételte, és egy
második, független okot is talált.

**Módszer.** Eldobható mérő script a repón kívül (`/private/tmp/transcript-alja/measure.cjs`, a
screenshot-pipeline invariáns miatt), `vite build` a scratchpadbe az e2e `VITE_*` értékeivel,
`node:http` statikus kiszolgálás és NYITVA TARTOTT SSE kapcsolat, a REST hívások `page.route()`
mockon. Valódi Chromium (`@playwright/test@1.62.1`), 1440x900, `hu-HU`, `Europe/Budapest`, mindkét
téma, három független futás. A pótlás a 11. szekció 19 tárolt eseménye, utána átmeneti delta
keretek a nyitott kapcsolatba. Mért érték az utolsó sor alsó éle mínusz (a) a lista látható alsó
éle, és (b) a ténylegesen látható alsó él: a lista, minden levágó (nem `visible` túlcsordulású) ős
kliens doboza és az ablak alja közül a legkisebb. Az érték akkor számít stabilnak, ha 20 egymást
követő animációs kereten át nem változik. Előtte a `2eefddb` (az `apps/web` kódja a `f03b885` óta
változatlan), utána a munkafa állapota.

| Helyzet                                          | Előtte, pixel (lista / látható) | Utána |
| ------------------------------------------------ | ------------------------------- | ----- |
| 3 átmeneti sor egy löketben                      | 3 / 19                          | 0 / 0 |
| 120 átmeneti sor egy löketben                    | 18 / 34                         | 0 / 0 |
| felgörgetve 120 sor, majd "Ugrás az aljára"      | 15 / 31                         | 0 / 0 |
| 10 átmeneti sor egyenként, minden sor után mérve | 1 / 17 (mind a tízszer)         | 0 / 0 |

A három futás és a két téma minden száma azonos.

**Két független ok.**

1. **Becslés.** A `useDynamicRowHeight` a még nem kirajzolt sort a `defaultRowHeight` (53) értékkel
   becsüli, az átmeneti sor 54 (11. szekció). A telepített forrás (`dist/react-window.js`, a source
   map szerint `lib/core/getOffsetForIndex.ts` és `lib/components/list/List.tsx`) szerint a
   `scrollToRow({ align: 'end' })` a becsült határokból számol (`bounds.scrollOffset -
containerSize + bounds.size`), és a görgetés után semmi nem igazít: a kirajzolt sor mérése
   (`setRowHeight`) új gyorsítótárat ad, a sorok lejjebb csúsznak, a `scrollTop` marad.
2. **Levágás.** A `.run-view-screen__transcript` `height: 100%` plusz `padding:
var(--ep-space-4)`, `box-sizing` nélkül: a burkoló 32 pixellel magasabb a panelnél (1440x900-on
   552 a 520 helyett), és a panel (`overflow: auto`) a lista alsó 16 pixelét levágja. A lista saját
   dobozához mért eltérésben ez nem látszik, a látható alsó élhez mérve minden helyzetben 16 pixel,
   a csak tárolt sorokat tartalmazó listán is. A független ellenőrzés számai ezt nem tartalmazták;
   az új e2e teszt `toBeInViewport({ ratio: 1 })` állítása fogta meg (ratio 0,698 = 37/53).

**Az elvetett irányok.**

- **Kisebb `Badge`.** A design system forrása (`eggproject-design-components/components/badge/`
  `badge.css`, `Badge.jsx`, `badge.html`) egyetlen méretet definiál (`padding: 4px 10px; font: 500
12px`), méret változat nincs; kitalált méret nem jöhet.
- **Soronkénti pontos magasság.** A `.d.ts` szerint a `rowHeight` elfogad `(index, rowProps) =>
number` függvényt, de a függvény alak a sorra fix `height` stílust tesz (`List.tsx`: `height:
isDynamicRowHeight ? undefined : bounds.size`), a kinyitott sor magassága pedig tartalom és
  szélesség függő (3. szekció): rálógna a következő sorra. A `DynamicRowHeight` alak saját
  megvalósítása saját `ResizeObserver`-t igényelne, amit a (7) greppes invariáns tilt, a könyvtár
  `getRowHeight`-je pedig a mért és a becsült értéket nem különbözteti meg (hiánynál a becsültet
  tárolja el). Az 54 pixel ráadásul nem tokenből jön, hanem a `Badge` `normal` sormagasságából,
  tehát nem vezethető le determinisztikusan.
- **A konstans 54-re emelése.** A független ellenőrzés szerint löketnél 65 pixel marad le: akkor a
  tárolt sorok becslése hibás.
- **Verzióemelés.** A `react-window` 2.3.2 CHANGELOG bejegyzése "Improve `scrollToRow` accuracy for
  dynamic height rows" (PR #914, resolves #883); a független ellenőrzés szerint 2.3.3 mellett
  0/0/1/0 pixel. A user tiltotta, ezért nem emeltük.

**A választott megoldás.** Az automatikus követés maga igazít a mért magassághoz
(`use-transcript-auto-scroll.ts`): követés közben a `rowHeight` gyorsítótár minden változása után
újra `scrollToRow({ index: rowCount - 1, align: 'end' })`. A telepített forrás szerint
(`lib/components/list/useDynamicRowHeight.ts`) a gyorsítótár identitása pontosan akkor új, amikor
egy mért magasság eltér a tárolttól: a `setRowHeight` azonos értéknél az előző állapotot adja
vissza, a visszaadott objektum pedig `useMemo` a térképen. A felhasználó beavatkozása a lista
elemén (`wheel`, `touchstart`, `pointerdown`, `keydown`, 2026-09-24 óta a `click` is, 15. szekció)
felfüggeszti az igazítást a következő új sorig, átméretezésig vagy ugrásig.

**Pontosítás (2026-09-24): ez NEM az upstream 2.3.2 mechanizmusa, csak a megszakító
eseménylistáját veszi át.** A korábbi "az upstream javítás mintájára" megfogalmazás pontatlan volt.
Az upstream korrekció (`lib/components/list/useScrollToRow.ts` a 2.3.2 tagen) EGYETLEN
`scrollToRow` híváshoz kötött és véges: a hívás egy `requestAnimationFrame` hurkot indít, ami
legfeljebb 1000 ms-ig fut (`deadline: performance.now() + 1000`), 1 pixeles tűréssel újragörget,
és leáll, ha két egymást követő kereten stabil (`++request.stableFrames >= 2`), a cél sor ki van
rajzolva és a mért magasságok a lista modelljében vannak. Megszakítja a `wheel`, a `touchstart`, a
`pointerdown`, és a `keydown`, de az utóbbi csak a görgető billentyűkre (`ArrowUp`, `ArrowDown`,
`PageUp`, `PageDown`, `Home`, `End`, `Space`). Nálunk az élesítés nem egy görgetéshez kötött és
nincs határideje: minden új sor, átméretezés és ugrás korlátlan ideig élesíti, amíg a felhasználó
bele nem nyúl, mert a projekt időzítőt és pixel tűrést nem használ (PLAN-009 T-009-33 (6)). A
`keydown` minden billentyűre szakít, mert a sor `Enter`-rel is kinyílik. Ennek a korlátlan
élesítésnek a mellékhatása volt a 15. szekció hibája. Forrás, a telepített forrás olvasása
mellett: <https://raw.githubusercontent.com/bvaughn/react-window/2.3.2/lib/components/list/useScrollToRow.ts>,
<https://github.com/bvaughn/react-window/pull/914>,
<https://raw.githubusercontent.com/bvaughn/react-window/2.3.2/CHANGELOG.md>.

A levágásra a burkoló `box-sizing: border-box` sora a javítás: a projekt a design system univerzális
resetjét szándékosan nem emeli át (`topnav-shell.css`), a hiányából eredő eseteket pontszerűen
javítja (precedens: `node-inspector.css`).

**Miért kell a felfüggesztés, mérve.** Szándékos rontással (a négy esemény helyett üres lista),
ugyanazzal a scripttel: az alján állva a végétől ötödik sor kinyitásakor a lista 277 pixelt
görgetett, a kinyitott sor fejléce 277 pixelt ugrott felfelé, és a követés bekapcsolva maradt.
Felfüggesztéssel a fejléc és a `scrollTop` 0 pixelt mozdul, és a következő átmeneti sor után
megjelenik az "Ugrás az aljára" gomb, pontosan úgy, mint előtte: a kinyitás viselkedése nem
változott. Az utolsó sor kinyitásakor utána sem görget, és a következő sor után az alja pontosan a
lista alján áll (előtte 1 pixel). Ez a mérés egérkattintással készült; a `Space`-szel (közben
érkező sorral) és a csak `click` eseménnyel kinyitott sort ez a felfüggesztés NEM védte, lásd 15.
szekció.

**Webes megerősítés** (Sonnet subagent, 2026-09-24, forrásonként három hivatkozás):

- A 2.3.2 javítása (`lib/components/list/useScrollToRow.ts`) `requestAnimationFrame` hurokban
  korrigál, és `wheel`, `touchstart`, `pointerdown`, `keydown` szakítja meg (a `keydown` csak a
  görgető billentyűkre; a határidőt és a stabil kereteket lásd a fenti pontosításban). Publikálás a registry
  szerint: 2.3.1 2026-09-05, 2.3.2 és 2.3.3 2026-09-22
  (<https://github.com/bvaughn/react-window/blob/2.3.3/CHANGELOG.md>,
  <https://github.com/bvaughn/react-window/pull/914>, <https://registry.npmjs.org/react-window>).
- A `useEffectEvent` a React 19.2 óta stabil, effektből hívható, és nem kerül a függőségi listába
  (<https://react.dev/reference/react/useEffectEvent>, <https://react.dev/blog/2025/10/01/react-19-2>,
  <https://blog.logrocket.com/react-19-2-is-here/>).
- A `pointerdown` egérre, tollra és érintésre is kiváltódik
  (<https://w3c.github.io/pointerevents/#the-pointerdown-event>,
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/pointerdown_event>,
  <https://developer.chrome.com/blog/pointer-events>).
- A gombot az `Enter` a `keydown`-ra, a `Space` a `keyup`-ra aktiválja, tehát a `keydown` mindkettőt
  megelőzi (<https://html.spec.whatwg.org/multipage/interaction.html#activation-triggering-input-event>,
  <https://github.com/whatwg/html/issues/10301>,
  <https://www.stefanjudis.com/today-i-learned/keyboard-button-clicks-with-space-and-enter-behave-differently/>).
- A Playwright `toBeInViewport` `ratio` opciója: "The minimal ratio of the element to intersect
  viewport ... Defaults to 0."; a megvalósítás gyökér nélküli `IntersectionObserver`, aminek a
  metszete minden levágó ős szerint szűkül
  (<https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-in-viewport>,
  <https://github.com/microsoft/playwright/blob/main/packages/injected/src/injectedScript.ts>,
  <https://w3c.github.io/IntersectionObserver/#calculate-intersection-rect-algo>).

**Regresszió.** E2E: `apps/web/e2e/sse-real-server.spec.ts`, a négy helyzet mindkét témában,
`toBeInViewport({ ratio: 1 })` plusz a lista aljához mért eltérés 0,5 pixel alatt (a user
kritériuma), a Playwright alap 1280x720 ablakán. Bukás igazolva: a `f03b885` állapotán (régi hook,
régi CSS) már a pótlás utáni első állítás bukik (ratio 0,698); csak a régi hookkal mind a nyolc teszt
bukik (ratio 0,944, 0,741, 0,796 és 0,981, a négy helyzet sorrendjében); csak a régi CSS-sel 0,698.
Unit: `use-transcript-auto-scroll.spec.tsx`; a négy esemény helyett üres listával négy, az igazító
effekt törlésével hat teszt bukik.

**A fül sáv** (375x812, a transcript a második fülön), ugyanazzal a scripttel, egy futás, mindkét
témában azonos: előtte 3 / 19, 15 / 31, 12 / 28 és 1 / 17 pixel, utána mind a négy helyzetben
0 / 0; a középső sor kinyitása ott sem görget.

**NEM ELLENŐRZÖTT:** Firefox és WebKit ellen nem futott mérés.

## 14. Az eredmény sor metája: csak az összeg (user döntés, 2026-09-24)

**A döntés.** Az `sdk_result` sor összecsukva a metában csak az összeget mutatja (a Code szereppel),
a "Költség (SDK becslés)" felirat és a magyarázat a kinyitott törzsben áll. MiniMax providernél a
költség továbbra sehol nem jelenik meg (SPEC-008 AC37).

**Mérve** a 13. szekció scriptjével, a 400 pixeles alap panelen, pixelben (látható / teljes), a két
téma minden száma azonos:

| Elem                       | Előtte                                   | Utána                                        |
| -------------------------- | ---------------------------------------- | -------------------------------------------- |
| meta                       | `Költség (SDK becslés): $0.0873`, 180 px | `$0.0873`, 56 px, JetBrains Mono 500 14/21px |
| cím szlot                  | 142                                      | 266                                          |
| címke ("Eredmény")         | 31 / 62                                  | 62 / 62                                      |
| törzs                      | 0 / 528                                  | 87 / 528                                     |
| MiniMax eredmény sor       | nincs meta; címke 62 / 62, törzs 155/504 | változatlan                                  |
| kinyitva, a törzs költsége | felirat, összeg, magyarázat              | változatlan                                  |

A két provider ágát a `RunEventRow.spec.tsx` unit tesztjei őrzik.

## 15. Sor kinyitása élő stream közben: a kinyitott sor a helyén marad (2026-09-24)

**A hiba.** Egy független ellenőrzés a `dfcaa38` commiton, valódi Chromiumban, 150 ms-onként érkező
sorokkal mérte, hogy a 13. szekció felfüggesztése két kinyitási utat nem véd: a `Space`-szel
kinyitott sort, ha a `keydown` és a `keyup` között új sor érkezik, és a csak `click` eseménnyel
(pointer és billentyű nélkül) kinyitott sort. Mindkét esetben a lista az aljára ugrott, a kinyitott
sor fejléce felfelé kicsúszott, és a követés bekapcsolva maradt; ez a SPEC-008 7.4 két szabályát
sérti ("ha hamis, nem görget", "a kinyitott sor a helyén marad"). Az ok: a `Space` a gombot a
`keyup`-ra aktiválja, a `keyup` és a `click` pedig nem volt felfüggesztő esemény, tehát a közben
érkező sor (13. szekció: minden új sor korlátlanul élesít) újraélesítette az igazítást, és a kinyitás
mérése után a hook az elavult `isFollowing` értékkel görgetett.

**Módszer.** Eldobható mérő script a repón kívül (`/private/tmp/transcript-kinyitas/measure.cjs`, a
screenshot-pipeline invariáns miatt), `vite build` a scratchpadbe az e2e `VITE_*` értékeivel,
`node:http` statikus kiszolgálás és NYITVA TARTOTT SSE kapcsolat, a REST hívások `page.route()`
mockon. Valódi Chromium (`@playwright/test@1.62.1`), 1440x900, `hu-HU`, `Europe/Budapest`, mindkét
téma. A pótlás 19 tárolt esemény, utána egy 120 soros átmeneti löket, majd folyamatos stream:
150 ms-onként egy átmeneti sor. A cél a lista végétől ötödik sor. Mért érték a kinyitott sor
fejlécének helye **a lista elemének tetejéhez mérve**: a `click` esemény pillanatában (capture
figyelő, tehát a kinyitás előtt) és utána minden animációs kereten, amíg még három új sor meg nem
érkezik. A lista tetejéhez mérés azért kell, mert a kinyitás utáni első új sorral megjelenő
"Ugrás az aljára" gomb sáv az egész listát 36 pixellel lejjebb tolja (ez a gomb specifikált helye a
lista fejlécében, nem a lista görgetése; előtte és utána egyformán). Előtte a `fb921db` (a
`transcript-panel` és a `run-event-row` kódja a `dfcaa38` óta változatlan), utána a munkafa.

**Kinyitás egy érkezés után, 4 ismétlés utanként, mindkét témában** (a fejléc elmozdulása pixelben,
negatív: felfelé; a két téma minden száma azonos):

| Út                                                     | Előtte                    | Utána                       |
| ------------------------------------------------------ | ------------------------- | --------------------------- |
| egér (`page.mouse.click`)                              | 0, gomb: 3 új esemény     | 0, gomb: 3 új esemény       |
| `Enter`                                                | 0, gomb: 3 új esemény     | 0, gomb: 3 új esemény       |
| `Space`, a `keydown` és a `keyup` között érkező sorral | -460, követés bekapcsolva | 0, gomb: 3 új esemény       |
| csak `click` (`element.click()`)                       | -460, követés bekapcsolva | 0, gomb: 3 új esemény       |
| egér lenyomva tartva, közben új sor, majd felengedés   | nem nyílik ki             | nem nyílik ki (változatlan) |

Az utolsó sor: a követés közben érkező sor a lenyomott egér alatt elgörgeti a fejlécet, a `click` a
közös ősre, a listára esik, tehát a sor nem nyílik ki. A független ellenőrzés más fixtúrán -331 és
-277 pixelt mért; az eltérés okát nem vizsgáltuk.

**Egy második, régebbi ok: a kinyitás és egy új sor versenyhelyzete.** A kinyitás után a lista a sor
új magasságát a következő képkocka `ResizeObserver` mérésével kapja meg, és a látható tartományt a
mért magassággal csak egy további, szinkron újrarenderelésben jelenti (`useVirtualizer`: a
`setIndices` egy layout effektben fut). Ha ebben az ablakban új sor érkezik, a hook az új sort a
kinyitás előtti `isFollowing` értékkel követi, és a kinyitott sort elrántja. Véletlen fázisú,
csak `click` eseménnyel indított kinyitások, 30 vagy 40 ismétlés témánként:

| Hook                                                       | 150 ms-os stream    | 40 ms-os stream |
| ---------------------------------------------------------- | ------------------- | --------------- |
| a `2eefddb` hookja (a `dfcaa38` előtti), a mai fán         | 4 / 60 (-54, -460)  | 12 / 40         |
| csak a `click` felfüggesztő eseményként                    | 5 / 60 (-460, -514) | 10 / 40         |
| várakozás, feloldás a mérés renderében (elvetett változat) | 4 / 60 (-460, -514) | nem mértük      |
| a választott megoldás                                      | 0 / 80              | 0 / 60          |

A versenyhelyzet tehát a `dfcaa38` előtt is megvolt (egy sornyi, -54 pixeles, vagy a teljes
ugrás), a `dfcaa38` korlátlan élesítése a kisebbik változatot is teljes ugrássá tette. A csak `click`
felfüggesztés a determinisztikus hibát javítja, a versenyhelyzetet nem.

**Miért nem elég a feloldás a mérés renderében, mérve.** Naplózó buildben (a repóba nem került): a
`click` 0,3 ms-kor, a közben érkező sor 7,2 ms-kor (a görgetés visszatartva), a mérés 11,4 ms-kor,
a lista jelentése a mért magassággal 12,0 ms-kor (136. sor a 143-ból, tehát a lista felfelé
mozdult), és a visszatartott görgetés UGYANABBAN a commitban, 12,0 ms-kor, még `isFollowing: true`
értékkel futott le. A React a mérés passzív effektjében ütemezett frissítést a lista szinkron
újrarenderelésével együtt dolgozta fel, a jelentés pedig csak annak a commitnak a passzív
effektjében került a reducerbe. A feloldást ezért a jelentéshez kell kötni.

**A választott megoldás** (`use-transcript-auto-scroll.ts`), pixel küszöb és időzítő nélkül:

1. A `click` a felfüggesztő események közé kerül (a `Space` a `keyup`-ra, az `Enter` a `keydown`-ra
   ad `click`-et, az `element.click()` csak `click`-et ad).
2. Egy `aria-expanded` gombon belüli `click` (a sor fejléce) várakozást indít: `measurement`, amíg a
   `rowHeight` gyorsítótár nem változik; `report`, amíg a lista `onRowsRendered` jelentése meg nem
   érkezik. Közben a görgető effekt kimarad; ha kimaradt, a jelentést feldolgozó renderben fut le,
   tehát a friss `isFollowing` értékkel. Ha a kinyitás nem változtat a látható tartományon (például
   az utolsó sor nyílik ki), a lista nem jelent, és a várakozást a következő új sor jelentése
   zárja: az a sor egy érkezéssel később görget.

**Ami nem romlott, mérve, utána:**

- A 13. szekció négy alsó helyzete (3 átmeneti sor, 120 soros löket, "Ugrás az aljára", egyenként)
  mindkét témában 0 / 0 pixel 1440x900-on és a 375x812-es fül sávban is.
- Nem kinyitó beavatkozás élő stream közben, látható görgetősávval (a Playwright alapértelmezett
  `--hide-scrollbars` kapcsolója nélkül, 15 pixeles sáv): egérkerék -300 pixel, görgetősáv húzás
  felfelé (-1322 és -2111 pixel), `PageUp` (összesen körülbelül -511 pixel): a lista egyik esetben
  sem ugrik vissza az aljára, és megjelenik a gomb; 20 pixeles kerék után a következő sor
  visszaviszi az aljára, az utolsó sor alja 0 pixelre. Előtte ugyanez.

**Regresszió.** E2E: `apps/web/e2e/sse-real-server.spec.ts`, a kinyitás három útja (egér
`page.mouse`-szal, `Space` a `keydown` és a `keyup` között érkező sorral, csak `click` a
`locator.dispatchEvent('click')` hívással, ami a Playwright doksi szerint az `element.click()`
megfelelője) mindkét témában: a fejléc a lista tetejéhez mérve pontosan a helyén marad, és a
kinyitás utáni új sorra az "Ugrás az aljára (1 új esemény)" gomb jelenik meg. A kinyitás utáni
keret rögtön a nyitott állapot megjelenése után megy ki, tehát a mérés előtt és után is érkezhet.
Mérve: a választott megoldáson 6/6 zöld, `--repeat-each=3` mellett 18/18; a `dfcaa38` hookjával
6/6 bukik (a `Space` út fejléce 222-ről -34-re, a `click` úté 276-ról 20-ra mozdul, az egér útnál a
gomb nem jelenik meg, mert a keret a mérés elé esik); a "mindig görget" rontással (a mérés utáni
igazítás feltétel nélkül) 6/6 bukik; a csak `click` felfüggesztéssel az egér út bukik. Unit:
`use-transcript-auto-scroll.spec.tsx`, a `click` felfüggesztés és a várakozás öt esete; a `dfcaa38`
hookjával 6, a csak `click` változattal 4 teszt bukik.

**Webes megerősítés** (Sonnet subagent, 2026-09-24):

- Az `HTMLElement.click()` egyetlen szintetikus `click` eseményt ad, `pointerdown`, `mousedown` és
  `keydown` nélkül (<https://html.spec.whatwg.org/multipage/interaction.html#dom-click>,
  <https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click>,
  <https://testing-library.com/docs/guide-events/>).
- A `click` buborékol (<https://w3c.github.io/uievents/#event-type-click>,
  <https://www.quirksmode.org/dom/events/click.html>,
  <https://javascript.info/bubbling-and-capturing>).
- A `locator.dispatchEvent('click')` a Playwright doksi szerint az `element.click()` megfelelője
  (<https://playwright.dev/docs/api/class-locator#locator-dispatch-event>, saját olvasás).
- Az NVDA és a JAWS böngésző módban `Enter`/`Space` aktiváláskor a lapnak `click`-et ad, `keydown`
  nélkül (<https://webaim.org/discussion/mail_thread?thread=9092>,
  <https://tink.uk/understanding-screen-reader-interaction-modes/>,
  <https://www.tpgi.com/event-handling-in-jaws-and-nvda/>; az utóbbi ma átirányít, a tartalma csak
  közvetve igazolt). **NEM ELLENŐRZÖTT:** a VoiceOver viselkedése, és hogy a képernyőolvasók
  `pointerdown`/`mousedown` eseményt nem küldenek (egy forrás szerint egyes kombinációk küldenek). A
  javítás egyikre sem épít: a `click` minden aktiválási úton megjelenik.

**Ismert korlát, nem mért.** Ha ugyanaz a sor egyetlen képkockán belül kinyílik és be is csukódik,
a `ResizeObserver` nem jelez változást, és a várakozás a következő sormagasság változásig tart; addig
új sor nem görget. Emberi kattintással ezt nem állítottuk elő, és nem mértük.

**NEM ELLENŐRZÖTT:** Firefox és WebKit ellen nem futott mérés.

**Képek** (a mérő script, a kinyitás után három sorral, a stream megállítva): előtte és utána, a négy
út, mindkét téma, a munkamenet kimeneti mappájában (`transcript-kinyitas/`).
