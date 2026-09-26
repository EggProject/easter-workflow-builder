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
  átmeneti soronként egy pixellel lemaradt a lista aljától. Mérés és első javítás: 13. szekció;
  2026-09-24 óta a sor fejléce pontosan egy szövegsor magas, és az átmeneti sor is 53 pixel (16.
  szekció).

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

**A választott megoldás (2026-09-24 óta kivezetve, lásd 16. szekció: az átmeneti sor egyforma
magas lett, és az eredeti követés újragörgetés nélkül is 0 pixelre pontos).** Az automatikus
követés maga igazít a mért magassághoz
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
ugrás), a `dfcaa38` korlátlan élesítése a kisebbik változatot is teljes ugrássá tette.
A táblát adó script elveszett; a repóbeli mérő eszközzel a `dfcaa38` előtti hookot 2026-09-25-én
újramérve (egyforma sormagasság mellett) 40 ms-on 60/200 az arány, minden kísérletet számolva (a 17. szekció korábbi 34/205 értékét egy hibás szűrő adta, 18. szekció). A csak `click`
felfüggesztés a determinisztikus hibát javítja, a versenyhelyzetet nem.

**Miért nem elég a feloldás a mérés renderében, mérve.** Naplózó buildben (a repóba nem került): a
`click` 0,3 ms-kor, a közben érkező sor 7,2 ms-kor (a görgetés visszatartva), a mérés 11,4 ms-kor,
a lista jelentése a mért magassággal 12,0 ms-kor (136. sor a 143-ból, tehát a lista felfelé
mozdult), és a visszatartott görgetés UGYANABBAN a commitban, 12,0 ms-kor, még `isFollowing: true`
értékkel futott le. A React a mérés passzív effektjében ütemezett frissítést a lista szinkron
újrarenderelésével együtt dolgozta fel, a jelentés pedig csak annak a commitnak a passzív
effektjében került a reducerbe. A feloldást ezért a jelentéshez kell kötni.

**A választott megoldás** (`use-transcript-auto-scroll.ts`), pixel küszöb és időzítő nélkül (2026-09-24
óta felváltva, lásd 16. szekció: a lent leírt várakozásnak nem volt kilépése, ha a mérés elmaradt):

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

**A korlát, mérve (2026-09-24, 16. szekció).** Ha ugyanaz a sor egyetlen képkockán belül kinyílik és
be is csukódik, a `ResizeObserver` nem jelez változást (a W3C Resize Observer `isActive()` lépése
szerint csak a legutóbb jelentett mérettől eltérő méret aktív megfigyelés), a várakozás a
`measurement` fázisban ragad, és a visszatartott effekt az érkezések számlálását is kihagyja. A
`d598677` állapotán, tárolt sorokkal, a pótlás végétől harmadik sor fejlécén Playwright
`dblclick`-kel és egy szkriptben kétszeri `element.click()`-kel (mindkét témában, 2-2 ismétlés,
8/8): a következő öt tárolt sor után az utolsó sor alja rendre 53, 106, 159 pixellel lóg a lista
alja alá, utána ki sem rajzolódik, és "Ugrás az aljára" gomb egyszer sem jelenik meg. Javítás és
regresszió: 16. szekció.

**NEM ELLENŐRZÖTT:** Firefox és WebKit ellen nem futott mérés.

**Képek** (a mérő script, a kinyitás után három sorral, a stream megállítva): előtte és utána, a négy
út, mindkét téma, a munkamenet kimeneti mappájában (`transcript-kinyitas/`).

## 16. Egyforma sormagasság, az újragörgető gépezet kivezetése, a beragadás javítása (2026-09-24)

**A kérdés.** A 13. szekció újragörgető gépezete (`dfcaa38`) és a 15. szekció várakozása
(`d598677`) egyetlen okra épült: az átmeneti sor egy pixellel magasabb volt a becslésnél. Ha a két
sortípus egyforma magas, elég-e a T-009-25 eredeti követése (a `f03b885^` hookja), és mi kell a
kinyitás közbeni versenyhez?

**Módszer.** Eldobható mérő script a repón kívül (`/private/tmp/transcript-egyszerusites/measure.cjs`,
a 15. szekció scriptjének bővítése), `vite build` a scratchpadbe az e2e `VITE_*` értékeivel,
`node:http` statikus kiszolgálás és nyitva tartott SSE kapcsolat, REST `page.route()` mockon,
valódi Chromium (`@playwright/test@1.62.1`), `hu-HU`, `Europe/Budapest`, mindkét téma. A régi
hookok az egyforma magasságot a lapra injektált CSS szabállyal kapták, a kóddal azonos alakban.

**Pontosítás (2026-09-25): a script elveszett, a mérés azóta a repóban él.** A fenti script a
munkamenet végén megszűnt, tehát az alábbi táblák számai nem állíthatók elő újra; ez a
szabálykönyv 12. szekciójával ütközött. A mérések repóbeli, verziókövetett eszköze
`apps/web/measurement/transcript-scroll.ts` (`bun run measure:transcript`, 17. szekció), ugyanazzal
a fixtúrával, mint az e2e. Az eszközzel 2026-09-25-én újramérve, a 2026-09-25-i hookon: a négy alsó
helyzet 1440x900-on és 375x812-en, mindkét témában mind 0 pixel (`alja`); a kinyitás négy útja
1440x900-on, mindkét témában 0 pixel elmozdulás a kinyitás és a következő sor után is, a gomb
"2 új esemény" (`kinyitas-ut`, a kattintással egy feladatban érkező sorral, ahogy az e2e);
a verseny 0 elrántás minden beállításban (a számok a 17. szekcióban, szűrő nélkül újramérve a
18.-ban); az utolsó sor kinyitása -309 pixel (lásd lent; a 2026-09-25-i user döntés óta 0 pixel és
ugrás gomb, 18. szekció). A régi hookok soraihoz az eszköz a hook fájlok ideiglenes cseréjével fut;
ezt a 17. szekció a `dfcaa38` előtti hookra el is végzi.

**Az egyforma magasság.** A sor fejléce pontosan egy szövegsor: `height: calc(1lh + 2 * 16px)`
(`run-event-row.css`). A `lh` egység az elem saját számított `line-height` értéke
(<https://www.w3.org/TR/css-values-4/#font-relative-lengths>; Chrome 109 óta:
<https://caniuse.com/mdn-css_types_length_lh>, <https://groups.google.com/a/chromium.org/g/blink-dev/c/E3Q7qOCk7A4/m/kMtu9VlqAQAJ>),
a `button` alapértelmezett `box-sizing` értéke `border-box` (Chromium `html.css`,
<https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/html/resources/html.css>;
<https://html.spec.whatwg.org/multipage/rendering.html>; <https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing>).
Mérve (1440x900 és 375x812, mindkét téma): előtte a tárolt sor 53, az átmeneti 54 pixel; utána
mindkettő 53, a fejléc számított `line-height` értéke 21 pixel, a 22 pixeles jelvény a fejléc
tetejétől és aljától 15,5 pixelre áll (a 16 pixeles belső margóba fél-fél pixelt nyúlik, levágás
nélkül), a lista vízszintes túllógása 0. **Az elvetett első alak:** `box-sizing: content-box;
height: 1lh` ugyanígy 53 pixelt adott, de a forrás `width: 100%` szabálya mellett a fejléc 8 pixellel
szélesebb lett a listánál, a lista vízszintes görgetősávot kapott (`clientHeight` 570 a 585
helyett), és a függőleges görgetősáv húzása 4/4 esetben nem indult el.

**A lista alja, a 13. szekció négy helyzetében** (az utolsó sor alsó éle mínusz a lista, illetve a
ténylegesen látható alsó él, pixel; minden sor mindkét témában azonos):

| Hook és CSS                               | 1440x900     | 375x812 (fül sáv) |
| ----------------------------------------- | ------------ | ----------------- |
| `f03b885^` hook, eltérő magasság (a HEAD) | 3, 18, 15, 1 | 3, 14, 11, 1      |
| `f03b885^` hook, egyforma magasság        | 0, 0, 0, 0   | 0, 0, 0, 0        |
| `d598677` hook, egyforma magasság         | 0, 0, 0, 0   | 0, 0, 0, 0        |
| a választott megoldás                     | 0, 0, 0, 0   | 0, 0, 0, 0        |

A helyzetek sorrendje: 3 átmeneti sor, 120 soros löket, "Ugrás az aljára", 10 sor egyenként
(a legnagyobb eltérés). A látható alsó élhez mért eltérés mindenhol azonos a listához mérttel,
tehát a `box-sizing` javítás megmaradt. **Verdikt: az alsó igazításhoz az újragörgető gépezet nem
kell,** az egyforma magasság mellett a T-009-25 eredeti követése 0 pixelre pontos.

**A kinyitás közbeni verseny azonban megmarad.** Véletlen fázisú, csak `click` eseménnyel indított
kinyitás a végétől ötödik soron, folyamatos streammel (a fejléc elmozdulása, ha van):

| Hook, egyforma magasság | 150 ms-os stream | 40 ms-os stream           |
| ----------------------- | ---------------- | ------------------------- |
| `f03b885^` hook         | 4 / 80 (-53)     | 23 / 80 (-53, -457, -510) |
| a választott megoldás   | 0 / 80           | 0 / 200                   |

A -53 pixeles eset: az új sor a mérés előtt érkezik, és a lista még a régi magassággal görget
egy sornyit. A teljes ugrás: az érkezés a mérés renderébe esik. A tiszta visszavezetés tehát nem
helyes; a verseny ellen kell egy mechanizmus, de az újragörgetés nem.

**Két elrontott köztes változat, mérve.** (1) A kattintás kikapcsolta a követést, a mérés után
egy lezárás az utolsó jelentés szerint visszakapcsolta: 40 ms-os streamnél 45 / 60 elrántás. A
naplózó build szerint egy, a kattintás ELŐTTI görgetés `scroll` eseményéből jövő jelentés (a mérés
előtti gyorsítótárral, "az utolsó sor látható") a kattintás után visszakapcsolta a követést, és a
görgető effekt a visszakapcsolásra magától lefutott. (2) Kétlépcsős lezárással: 9 / 80. Ebből lett
a három szabály: a mérés előtti jelentés nem kapcsolhatja vissza a követést; a visszakapcsolás
önmagában nem görget (görgetést csak új sor, átméretezés, csatolás és az ugrás indít); a lezárás a
lista mért magasságú jelentése UTÁN fut.

**A választott megoldás** (`use-transcript-auto-scroll.ts`, `reduce-transcript-auto-scroll.ts`):

1. Egy `aria-expanded` fejléc `click` eseménye a mérésig kikapcsolja a követést
   (`row_toggle_started`); a közben érkező sor nem görget, a gomb számába kerül. A görgetés a
   még nem mért váltást egy hivatkozásból is olvassa, mert a kattintás egy már kirajzolt, de
   effektjét még le nem futtatott érkezés elé is eshet.
2. A `rowHeight` gyorsítótár új identitása (a mérés) egy állapot frissítéssel kéri a lezárást, ami
   a következő commitban, a lista (gyerek komponens) jelentése után fut, és a predikátum az utolsó
   jelentés szerint dönt. Mérve: a kétlépcsős lezárás nélkül, közvetlen lezárással ugyanez 0 / 100
   (40 ms); a sorrendet nem mérés, hanem a React gyerek-szülő effekt sorrendje garantálja, ezért
   megtartva.
3. A váltások fejlécenként párosodnak: egy képkockán belüli ki-be csukás (páros számú kattintás
   ugyanazon a fejlécen) után nincs mit mérni, a második kattintás maga zárja le a váltást.
4. Az "ugrás az aljára" a várakozást is lezárja (egy a mérése előtt leszerelt sor sosem kapna
   mérést). A nem látott sorok száma a várakozás alatt is nő; a gépezet egyetlen ponton sem tart
   vissza érkezést.

Pixel küszöb, időzítő és saját `ResizeObserver` nincs.

**Amire a megoldás épít, és nem dokumentált API** (a telepített forrás olvasása szerint): a
`useDynamicRowHeight` gyorsítótár identitása pontosan a mért magasság változásakor új
(`lib/components/list/useDynamicRowHeight.ts`, a 13. szekció óta ismert); a `List` a látható
tartományt egy layout effektben számolja újra, és a következő renderben jelenti
(`lib/core/useVirtualizer.ts`, `List.tsx`); a React a gyerek komponens passzív effektjét a szülőé
előtt futtatja; és az `AccordionItem` fejléce kattintásonként pontosan egyszer vált (saját
komponens). A `d598677` ugyanezekre épült. A kattintás mint egyetlen belépési pont a 15. szekció
webes megerősítésén áll (a `Space`, az `Enter` és az `element.click()` is `click` eseményt ad).

**Mérve a választott megoldáson:**

- Kinyitás négy úton (egér, `Space` a `keydown` és a `keyup` között érkező sorral, `Enter`, csak
  `click`), 150 ms-os stream, 4 ismétlés, mindkét témában: a fejléc a listához mérve 0 pixelt
  mozdul, és a három utána érkező sort a gomb nevezi meg ("3 új esemény"). A lap tetejéhez mérve a
  fejléc +36 pixelt mozdul: ennyivel tolja le a listát a gomb sáv (1440x900). Lenyomott egér alatt
  érkező sor: a sor nem nyílik ki, -159 pixel (a 15. szekció óta változatlan).
- Az utolsó sor kinyitása: a következő sorig 0 pixel, utána -351 pixel, gomb nélkül (a követés
  megmarad, SPEC-008 7.4); a `f03b885^` hookkal ugyanígy -351, a `d598677` hookkal -352.
  **Pontosítás (2026-09-25):** az elmozdulás a törzs PLUSZ az új sor magassága, nem a törzsé. A
  repóbeli eszközzel (`utolso-sor`) 1440x900-on és 375x812-en, mindkét témában: összecsukva 53, a
  törzs 256, a következő sor után -309 = -(256 + 53) pixel, az utolsó sor alja 0, gomb nincs; a
  `bffd75d` hookjával 1440x900-on ugyanígy -309. A -351 egy másik, a repón kívüli script payloadjának törzsére
  szólt, és ma nem állítható elő. A 2026-09-25-i user döntés óta a kinyitott utolsó sor a következő
  sor után is a helyén marad, és megjelenik az ugrás gomb (18. szekció).
- Nem kinyitó beavatkozás látható görgetősávval (2 ismétlés, mindkét téma): 300 pixeles kerék és
  `PageUp` után megjelenik a gomb; 20 pixeles kerék után a követés megmarad, az utolsó sor alja 0;
  a görgetősáv húzása -1797 ... -2330 pixel, gomb.
- Dupla kattintás egy tárolt sor fejlécén (Playwright `dblclick` és egy szkriptben kétszeri
  `element.click()`, mindkét téma, 2 ismétlés), utána öt tárolt sor egyenként: az utolsó sor alja
  mind az ötször 0, gomb nincs (8 / 8). A `d598677` állapotán 53, 106, 159 pixel, majd a sor ki sem
  rajzolódik, gomb nincs (8 / 8, 15. szekció).

**Az e2e determinizmusa, mérve.** A kinyitás utáni azonnali küldés (a korábbi e2e) a
mechanizmus nélkül csak 4 / 30 esetben bukott. A kattintásra indított hálózati küldés
(`fetch` a teszt szerverre a kattintás capture fázisából) a mechanizmus nélkül egérrel 5 / 6,
csak `click`-kel 5 / 6, `Space`-szel 0 / 6 esetben bukott; 30 ms-os blokkolással 0 / 18 (a
renderelés megelőzte a hálózati feladatot). Ezért az e2e egy sort a kattintás capture fázisában,
a lapon rögzített valódi `EventSource` példányon kiváltott üzenetként kézbesít (szabálykönyv 11.
szekció). Eredmény (`apps/web/e2e/sse-real-server.spec.ts`, a lista alja, a kinyitás négy útja
(az egér út a kinyitott törzsbe kattintást is ellenőrzi: nem vált sort), a dupla kattintás és a
sormagasság tesztjei, 21 teszt):

| Állapot                                                   | Eredmény                                         |
| --------------------------------------------------------- | ------------------------------------------------ |
| a választott megoldás                                     | 21 / 21 zöld                                     |
| a kattintás figyelő nélkül                                | a 8 kinyitás teszt bukik (ismételve 23 / 23)     |
| a `f03b885^` hook, reducer és panel, egyforma magassággal | a 8 kinyitás teszt bukik, a többi 13 zöld        |
| a `dfcaa38` állapota                                      | a 8 kinyitás és a sormagasság teszt bukik        |
| a `d598677` állapota                                      | a 4 dupla kattintás és a sormagasság teszt bukik |
| a választott hook a `d598677` CSS-ével (eltérő magasság)  | a 8 lista alja és a sormagasság teszt bukik      |

Unit szándékos rontások (`use-transcript-auto-scroll.spec.tsx`, `reduce-transcript-auto-scroll.spec.ts`):
a mérés előtti jelentés visszakapcsol: 1 teszt bukik; párosítás nélkül: 1; a hivatkozás
ellenőrzése nélkül: 1; az ugrás nem zárja a várakozást: 1; a mérés nem zár: 2.

**NEM ELLENŐRZÖTT:** Firefox és WebKit; emberi dupla kattintás foglalt fő szál alatt (csak a két
szintetikus út). A kinyitás közbeni verseny a 375 pixeles fül sávban azóta mérve (17. szekció,
0/120 és 0/80). A W3C Resize Observer `isActive()` lépése szerint a megfigyelés csak a legutóbb jelentett
mérettől eltérő méretre aktív (<https://www.w3.org/TR/resize-observer/>); hogy egy képkockán belüli
ki-be csukás ezért nem ad értesítést, az ebből levezetett, és a `d598677` beragadása méri.

**Képek** (a mérő script, a munkamenet kimeneti mappájában, `transcript-gorgetes/`): a sorok előtte
és utána (a jelvény nagyítva), a beragadás előtte és utána dupla kattintás plusz öt sor után, a
kinyitás négy útja három sor után, és a kinyitott utolsó sor a következő sor után, mindkét témában.
A képeket előállító script is elveszett; a 17. szekció képei szemléltetők, a számok a repóbeli
eszközből jönnek.

## 17. A várakozás kilépései, a görgetés rögzítés és a repóbeli mérő eszköz (2026-09-25)

**A kiindulás.** Egy független ellenőrzés a `c7b2e35` állapotát (a `main`-en a `bffd75d`) elfogadta,
de négy hiányt talált: (1) 375 pixelen, ha a sor kinyitása és a fülváltás egy feladatba esik, a
lista beragad, és a kézi görgetés az aljára sem oldja fel; (2) bekapcsolt böngésző görgetés
rögzítés mellett az "ugrás az aljára" utáni első kinyitásnál a kinyitott sor 36 pixelt ugrik; (3) a
várakozás kilépéseit és a `rowHeight` identitására épülő lezárást egyetlen e2e sem védi; (4) a 16.
szekció számai repón kívüli, elveszett scriptből jöttek. A user két döntése (2026-09-24): a kézi
görgetés az aljára is oldja fel a várakozást, és a listán a görgetés rögzítés legyen kikapcsolva.

**A mérő eszköz.** `apps/web/measurement/transcript-scroll.ts`, saját configgal
(`apps/web/playwright.measurement.config.ts`: egyetlen worker, instrumentálatlan build, mert az
istanbul számlálók lassítják az időzítés érzékeny versenyt), futtatás:
`cd apps/web && flock /tmp/playwright-gep.lock bun run measure:transcript [-g <jelenet>]`. A fixtúra
(a `node:http` SSE szerver, a keretek, a REST mockok, a lista mérései) az e2e-vel közös
`apps/web/e2e/run-view-stream.ts`. Minden jelenet egy `MEASUREMENT <json>` sort ír; képet nem ír
(`screenshot-pipeline` invariánsok). Jelenetek: `alja` (13. és 16. szekció négy alsó helyzete),
`kinyitas-ut` (a kinyitás négy útja a kattintással egy feladatban érkező sorral), `utolso-sor`,
`fulvaltas`, `render-sorrend` (a React DevTools csatlakozási pontján: `onCommitFiberRoot` minden
commit után, `onPostCommitFiberRoot` a passzív effektek után; mindkét hívás a telepített
`react-dom` éles buildjében is megvan, a bundle-ben mérve), `verseny` (folyamatos stream 150 és 40
ms-os időközzel, véletlen fázisú, csak `click` kinyitás a végétől ötödik soron;
`MEASURE_TRIALS`, és `MEASURE_OVERFLOW_ANCHOR=auto` a rögzítés visszakapcsolására). A régi
hookokat a hook fájlok ideiglenes cseréjével méri. Minden szám ebben a szekcióban ebből az
eszközből jön, a kifejezetten "feltáró" jelölésűek kivételével.

**(1) A fülváltás, előtte és utána** (`fulvaltas`, 375x812, mindkét témában azonos): a lista az
alján, a végétől második sor kinyitása és a "Gráf" fül EGY szkript futásban, a rejtett fül alatt
három új sor, vissza a transcript fülre, egérkerék a lista aljára, majd három új sor.

| Állapot                 | Visszatérés után             | Kerék után | A három új sor után (az utolsó sor alja, px) | Gomb a végén   |
| ----------------------- | ---------------------------- | ---------- | -------------------------------------------- | -------------- |
| `bffd75d`               | "Ugrás az aljára (3 új ...)" | 0          | 53, 106, 159                                 | "6 új esemény" |
| a kézi visszatérés után | "Ugrás az aljára (3 új ...)" | 0          | 0, 0, 0                                      | nincs          |

Az ok a telepített forrás szerint (`react-window@2.3.1`, `dist/react-window.js`, a
`useDynamicRowHeight` `ResizeObserver` visszahívása): a mért blokkméret csak akkor kerül a
gyorsítótárba, ha nem nulla (`u && f(z, u)`), a rejtett (`hidden`) fülön minden sor 0 magas, a
lista tárolója is 0 magas, a kirajzolt tartomány a túlrajzolási sávra szűkül, és a kinyitott sor
leszerelődik, mielőtt nem nulla méretet kapna. Mérés nem jön, a `rowHeight` identitása nem
változik, a várakozás a `bffd75d`-n csak az ugrás gombbal zárult. A görgetési hely a
visszatéréskor megmarad (feltáró mérés: `scrollTop` 1181 előtte és utána).

**A javítás** (`use-transcript-auto-scroll.ts`): a várakozás alatt a hook figyeli a lista
jelentéseit; ha egy jelentés szerint az utolsó sor nem látszik, a lista "elhagyta az alját", és ha
ezután egy jelentés szerint a predikátum igaz, a várakozás lezárul
(`bottom_reached_while_unmeasured`: követés be, nem látott sorok nulla). Az alj elhagyásának
feltétele azért kell, mert a 16. szekció (1) elrontott változatában a kattintás ELŐTTI görgetés
késve érkező jelentése (a mérés előtti gyorsítótárral) kapcsolta vissza a követést. Pixel küszöb,
időzítő és saját `ResizeObserver` a termékkódban nincs.

**(2) A görgetés rögzítés.** A CSS Scroll Anchoring spec szerint ha a görgető dobozt adó elem
`overflow-anchor` értéke `none`, a böngésző az adott görgető dobozban nem választ horgonyt
(<https://www.w3.org/TR/css-scroll-anchoring-1/> 2.1, "do not select an anchor node for S";
megerősítés: <https://github.com/w3c/csswg-drafts/blob/main/css-scroll-anchoring-1/Overview.bs>,
<https://github.com/WICG/ScrollAnchoring/blob/master/explainer.md>). Az MDN szerint a kezdőérték
`auto`, a `none` érték a horgonyként választást zárja ki
(<https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor>; megerősítés:
<https://drafts.csswg.org/css-scroll-anchoring-1/>, a propdef táblázat). A Chrome 56 óta támogatja
(<https://caniuse.com/css-overflow-anchor>,
<https://web-platform-dx.github.io/web-features-explorer/features/overflow-anchor/>,
<https://blog.chromium.org/2017/04/scroll-anchoring-for-web-developers.html>). A spec szerint az
abszolút pozicionált elem csak akkor zárt ki a horgony jelöltek közül, ha a tartalmazó blokkja a
görgető dobozon kívül esik; a `react-window` sorai a listán belül abszolút pozicionáltak, tehát
jelöltek lehetnek (webes forrás: a spec "excluded subtree" definíciója; hogy PONTOSAN melyik
horgony és melyik változás adta a 36 pixelt, NEM ELLENŐRZÖTT).

`verseny`, 1440x900, 150 ms, a mai hookkal, témánként 40 kísérlet:

| `overflow-anchor`          | világos | sötét  | elmozdulások |
| -------------------------- | ------- | ------ | ------------ |
| `auto` (a `bffd75d` CSS-e) | 3 / 40  | 3 / 38 | mind -36     |
| `none` (a javítás)         | 0 / 40  | 0 / 40 | nincs        |

**Pontosítás (2026-09-25, 18. szekció):** a tábla (és a szekció többi verseny táblája) a hibás
"releváns" szűrővel készült, ami az aljára ugró kísérletet kidobta. Szűrő nélkül, minden kísérletet
számolva, a 2026-09-25-i hookkal újramérve: `auto` 4/40 és 5/40 (mind -36), `none` 0/40 és 0/40.

**Második pontosítás (2026-09-25, 19. szekció):** a "mind -36" csak a saját futásainkra igaz, nem
általános. Egy független ellenőrzés ugyanezzel a jelenettel (`auto`, 150 ms, 1440x900) 5/80
elmozdulást mért, köztük egy -574 pixeles teljes elrántást. A 19. szekció újramérése a `905ab7e`
hookkal 4/40 és 3/40, mind -36; a -574 abban a futásban nem jelent meg, tehát ritka, de létező
kimenetel. A gomb sáv helyének fenntartása után ugyanez a jelenet `auto` mellett 0/40 és 0/40.

A -36 a lista `scrollTop` +36 pixeles változása a kattintás utáni első képkockákban, a hook
görgetése nélkül, és a fejléc a helyén marad utána is (a 36 megegyezik a gomb sáv magasságával;
az okát nem mértük). **Kiegészítés (2026-09-25, 19. szekció):** a gomb sáv helyének fenntartása
után bekapcsolt rögzítéssel is 0/80, tehát a -36 a gomb sáv megjelenéséhez kötött; hogy pontosan
melyik horgony mozdult, továbbra is nem ellenőrzött. Feltáró futásban (a repóba nem került kód) egyszer egy teljes elrántás is
előfordult (-574 pixel) a rögzítés és a kézi visszatérés együttesével: a rögzítés görgetése után
egy jelentés az utolsó sort láthatónak mutatta, és a várakozás lezárult. A `none` ezt is kizárja.
Feltáró futásokban képkockához igazított kattintással, tétlen listán és a kattintással egy
feladatban érkező sorral a jelenség nem jelent meg (a fázistól és az előző ugrástól függ), ezért
nincs rá determinisztikus e2e: az e2e a lista kiszámított `overflow-anchor` értékét és az ugrás
utáni első kinyitás képkockánkénti helyét ellenőrzi. **Javítva 2026-09-25-én (18. szekció):** a
képkockánkénti rész vak volt (a CSS és a kiszámított érték ellenőrzése nélkül is zöld), ezért
kikerült; az e2e kizárólag a konfigurációt őrzi.

**Az utolsó sor kinyitása** (`utolso-sor`, 1440x900 és 375x812, mindkét témában): összecsukva 53,
törzs 256, a kinyitás után 0, a következő sor után -309 = -(256 + 53) pixel, az új sor alja 0,
gomb nincs. A SPEC-008 7.4 "a törzse magasságával" mondata ennek megfelelően javítva.

**A verseny a mai hookkal** (`verseny`, `overflow-anchor: none`), elrántás / releváns kísérlet
(releváns: a mérés utáni harmadik képkockán az utolsó sor nem látszik):

| Elrendezés | 40 ms, világos | 40 ms, sötét | 150 ms, világos | 150 ms, sötét |
| ---------- | -------------- | ------------ | --------------- | ------------- |
| 1440x900   | 0 / 60         | 0 / 60       | 0 / 40          | 0 / 40        |
| 375x812    | 0 / 60         | 0 / 60       | 0 / 40          | 0 / 40        |

Szűrő nélkül újramérve ugyanezzel a hookkal (18. szekció), 40 ms-on: 1440x900-on és 375x812-en is
0/60 mindkét témában.

**A `dfcaa38` előtti hook aránya** (a szabálykönyv 12. szekció "harmadában" mondatának
ellenőrzése): az `eede38b` hook fájljaival, a mai CSS-sel és egyforma sormagassággal, 1440x900, 40
ms. **Javítva 2026-09-25-én (18. szekció):** az itt eredetileg álló tábla (bekapcsolt rögzítéssel
34/205, kikapcsolttal 10/73, "minden elrántás -53 pixel", "mintegy hatod", "a harmadában túlzás
volt") a hibás "releváns" szűrőből jött, ami pontosan a teljes elrántást dobta ki: az a listát az
aljára viszi, tehát a mérés utáni harmadik képkockán az utolsó sor látszik. Minden kísérletet
számolva, témánként 50 kísérlettel:

| `overflow-anchor` | világos                               | sötét                        |
| ----------------- | ------------------------------------- | ---------------------------- |
| `auto`            | 16 / 50 (8 × -53, 5 × -786, 3 × -839) | 18 / 50 (14 × -53, 4 × -786) |
| `none`            | 15 / 50 (9 × -53, 5 × -786, 1 × -839) | 11 / 50 (9 × -53, 2 × -786)  |

Összesen 60/200 (30 százalék), ebből 40 egy soros (-53 pixel) és 20 teljes elrántás (-786 és -839
pixel: a lista az aljára ugrott). A szabálykönyv eredeti "harmadában" mondata tehát nagyságrendben
helyes volt, a 34/205 és a "mintegy hatod" a hibás. A korábbi, repón kívüli mérések 12/40 (15.
szekció) és 23/80 (16. szekció), a független ellenőrzés 38/100.

**A commitok sorrendje** (`render-sorrend`, 1440x900, világos téma, a kattintással egy feladatban
érkező sorral): egér, `Space` és `Enter` úton a kattintás után három commit a mérés előtt, az első
már az új sort tartalmazza a kinyitás nélkül, a harmadik a kinyitást. A mérés saját, a hook
figyelője UTÁN regisztrált kattintás figyelője az első két commit után fut, és a lista `scrollTop`
értéke végig változatlan: az érkezés nem görgetett, tehát az effektje már a várakozást látta.
Csak `click` úton (szkriptből kiváltott esemény) a figyelők a commitok előtt futnak, és már az
első commit tartalmazza a kinyitást és az új sort is (két vagy három commit a mérés előtt,
futásonként). Az "EGY renderbe" állítás tehát csak a csak `click` útra igaz; a többi úton az új
sor a kinyitás előtti commitba kerül, de mindig a mérés előtt.

**Az e2e és a szándékos rontások** (`apps/web/e2e/sse-real-server.spec.ts`, "A VÁRAKOZÁS
KILÉPÉSEI" és "NINCS BÖNGÉSZŐ GÖRGETÉS RÖGZÍTÉS" blokk, mindkét témában: a 375 pixeles fülváltás
kézi görgetéssel, a mérés nélkül maradt várakozás ugrás gombbal és utána kézi görgetéssel, az
utolsó sor kinyitása és a következő sor (-(törzs + új sor)), a mérés utáni kézi görgetés, a
kattintás utáni, a mérés előtti ÜZENET feladatban érkező sor, és az ugrás utáni első kinyitás). A
mai kódon a fájl 50/50 zöld, az új tesztek `--repeat-each 4` mellett 40/40. A rontásokat a fájl
nem soros másolatán futtattuk, hogy egy bukás ne hagyja ki a többit:

| Rontás                                                       | Bukó e2e                                                                   |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| a `bffd75d` hookja, reducere és CSS-e                        | fülváltás (2), ugrás utáni első kinyitás (2)                               |
| `overflow-anchor: none` nélkül                               | ugrás utáni első kinyitás (2)                                              |
| a mérés utáni lezárás kiesése (a `rowHeight` effekt törölve) | utolsó sor kinyitása (2)                                                   |
| az ugrás nem üríti a még nem mért váltásokat                 | mérés nélküli várakozás ugrás gombbal (2)                                  |
| az ugrás a reducerben nem zárja a várakozást                 | mérés nélküli várakozás ugrás gombbal (2)                                  |
| a kézi visszatérés kilépése törölve                          | fülváltás (2)                                                              |
| a `rowHeight` identitása sosem változik                      | utolsó sor kinyitása (2)                                                   |
| a `rowHeight` identitása minden renderben új                 | a mérés előtti üzenet feladat (2; ismételve 6/6), fülváltás (1), ugrás (2) |
| a hivatkozás-ellenőrzés kivétele a görgetésből               | nincs (35 releváns teszt zöld)                                             |
| a mérés előtti jelentés visszakapcsolhat                     | nincs (35 releváns teszt zöld)                                             |

A mérés előtti üzenet feladat tesztjében az új sor a kattintás után nyolc `MessageChannel`
ugrással érkezik (a feladat sorrend adja a helyét, időzítő nincs): egyetlen ugrással a minden
renderben új identitású rontás mellett is zöld volt.

**Pontosítás (2026-09-25, 18. szekció):** az `overflow-anchor: none` nélküli sor bukását kizárólag a
kiszámított érték állítása adta; a képkockánkénti rész a CSS nélkül is zöld (16/16), ezért kikerült.
A "kinyitott utolsó sor és a következő sor" teszt a user döntés után megfordult (a sor a helyén
marad); a mérés utáni lezárás kiesését ma a becsukás e2e teszt fogja (18. szekció).

**A két nem bukó rontás.** A verseny 40 ms-on, 1440x900-on, témánként 60 kísérlettel mindkét
rontás mellett 0/120 elrántás. A hivatkozás-ellenőrzés azt az esetet védi, amikor a kattintás egy
már commitolt érkezés passzív effektje elé esik; a `render-sorrend` mérésben egyik úton sem futott
a görgető effekt a kattintás előtti állapottal (az érkezés vagy a várakozást is tartalmazó
commitba került, vagy utána). A mérés előtti visszakapcsolás tiltása nélkül a kód
szerint a görgetést a hivatkozás a mérésig visszatartja, és a mérés utáni jelentés (a tartomány
felfelé mozdul) a követést újra kikapcsolja. A két ág a telepített React és `react-window` mellett megfigyelhető hatás nélküli;
unit teszt mindkettőt őrzi (1-1 bukó teszt). **Javaslat, nem döntés:** a két védelem egyszerűsítése
mérlegelhető, de más React vagy `react-window` verzió más sorrendet adhat, ezért marad.

**Képek** (a munkamenet kimeneti mappájában, `transcript-utomunka/`): a fülváltás utáni állapot a
kerék és három új sor után, előtte (`bffd75d`, beragadt, "6 új esemény") és utána, a kinyitott
utolsó sor és a következő sor utáni állapot, a mérés utáni kézi görgetés előtt és után, mindkét
témában. Szemléltetők: egy repón kívüli, eldobott lépés készítette őket ugyanazzal a repóbeli
fixtúrával (`run-view-stream.ts`); a számok a mérő eszközből jönnek.

**NEM ELLENŐRZÖTT:** Firefox és WebKit; a görgetés rögzítés 36 pixeles igazításának pontos oka
(melyik horgony, melyik változás); a görgetés rögzítés 375 pixelen és 40 ms-on; a két nem bukó
rontás más React és `react-window` verzióval.

## 18. Az utolsó sor kinyitása is megállítja a követést, a verseny szűrő és a rögzítés e2e hatóköre (2026-09-25)

**A kiindulás.** Egy független ellenőrzés az `5d9eb91`-en három hiányt talált. (1) A kinyitott utolsó
sor sorsa időzítésfüggő volt: ha a következő sor a mérés commitja után, a React DevTools commit
horgával időzítve érkezett, 12/12 esetben 0 pixel és "2 új esemény"; ha a lezárás után, a törzs
plusz az új sor magasságával (-309 pixel) feljebb került, gomb nélkül. (2) A mérő eszköz verseny
jelenetének "releváns" szűrője pontosan a teljes elrántást dobta ki, tehát a 17. szekció 34/205
aránya hamis volt. (3) A görgetés rögzítés e2e tesztjének képkockánként mérő része vak volt. A
user döntése (2026-09-25): az utolsó sor kinyitása is megállítja a követést, determinisztikusan,
minden kinyitási úton.

**A szabály** (`use-transcript-auto-scroll.ts`, `reduce-transcript-auto-scroll.ts`, SPEC-008 7.4). Egy
fejléc `click` eseménye szünetelteti a követést. A kinyitás szünete a mérés után is tart, és csak
az ugrás gomb, a kézi visszatérés az aljára (az alj előzetes elhagyásával) vagy a váltás
visszaállása (ugyanannak a fejlécnek a páros számú kattintása) zárja. A becsukás szünete
változatlanul a mérésig tart, utána a predikátum dönt. Hogy a kattintás kinyitás-e, a fejléc
kattintás előtti `aria-expanded` értéke dönti el: a lista figyelője a React saját kezelője előtt
fut, mert a telepített `react-dom@19.2.8` a gyökér tárolón figyel (`listenToAllSupportedEvents`,
`react-dom-client.production.js`), a `click` pedig buborékol (15. szekció). Pixel küszöb, időzítő
és saját `ResizeObserver` nincs.

**Mérve a repóbeli eszközzel** (`apps/web/measurement/transcript-scroll.ts`), előtte (`da9fa70`) és
utána:

| Jelenet                                                        | Előtte                  | Utána                                     |
| -------------------------------------------------------------- | ----------------------- | ----------------------------------------- |
| `utolso-sor`, a következő sor után (1440x900, 375x812, 2 téma) | -309 pixel, gomb nincs  | 0 pixel, "Ugrás az aljára (1 új esemény)" |
| `kinyitas-ut`, négy út, 2 téma                                 | 0 pixel, "2 új esemény" | 0 pixel, "2 új esemény"                   |
| `alja`, négy helyzet, 2 elrendezés, 2 téma                     | mind 0                  | mind 0                                    |
| `fulvaltas`, 2 téma                                            | a kerék után 0, 0, 0, 0 | a kerék után 0, 0, 0, 0                   |

Az utolsó sor után érkező új sor alja utána 345 pixellel a lista látható alja alatt áll: 256 (a
törzs) + 53 (az új sor) + 36 (a gomb sáv). **Pontosítás (19. szekció):** a táblázat csak teli
listát (20 + 10 sor) mért; nem teli listán a szünet ekkor még nem állt, tehát a user döntés
"determinisztikusan" feltétele erre az esetre nem teljesült. A gomb sáv helyének fenntartása óta
a 345 helyett 309 (256 + 53).

**Az e2e** (`apps/web/e2e/sse-real-server.spec.ts`, "AZ UTOLSÓ SOR KINYITÁSA IS MEGÁLLÍTJA A
KÖVETÉST" blokk), mind a négy úton (egér, `Space`, `Enter`, csak `click`), mindkét témában, három
időzítéssel: (a) az új sor a mérés után érkezik; (b) a felhasználó a kinyitott törzset a lista
aljáig görgeti, majd érkezik az új sor; (c) az új sor PONTOSAN a mérés commitjában, a passzív
effektjei előtt érkezik (a React DevTools csatlakozási pontján, `installMeasuredCommitDelivery`,
a `run-view-stream.ts` közös fixtúrájában), utána még egy. Mindegyik a fejléc helyét és az ugrás
gomb szövegét állítja. Plusz a becsukás változatlansága: az alján becsukott sor után a követés
folytatódik (2, a táblában "becsukás"), és felgörgetve a kinyitott sor becsukása után a követés
kikapcsolva marad (2; ez fedi a lezárás "az utolsó sor nem látszik" ágát, lásd
`2026-09-05-e2e-lefedettsegi-kuszob.md` 36. szekció). A rontásokat a fájl nem soros másolatán
futtattuk:

| Állapot                                                                                                             | (a)        | (b)        | (c)        | becsukás   |
| ------------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ---------- | ---------- |
| a választott megoldás                                                                                               | 8/8 zöld   | 8/8 zöld   | 8/8 zöld   | 2/2 zöld   |
| a `da9fa70` hookja, reducere és állapota (a régi viselkedés)                                                        | 8/8 bukik  | 8/8 bukik  | 8/8 zöld   | nem futott |
| a mérés a kinyitás szünetét is lezárja                                                                              | 8/8 bukik  | 8/8 bukik  | 8/8 zöld   | nem futott |
| a szünet alatti, az utolsó sort mutató jelentés az alj elhagyása nélkül is visszatérés                              | 8/8 zöld   | 8/8 bukik  | 8/8 zöld   | nem futott |
| a szünet alatti jelentés visszakapcsolja a követést (a reducer feltétele törölve, a "mérés előtti visszakapcsolás") | 8/8 zöld   | 8/8 zöld   | 8/8 zöld   | nem futott |
| a kattintás iránya figyelmen kívül (minden kattintás kinyitás)                                                      | nem futott | nem futott | nem futott | 2/2 bukik  |
| a mérés utáni lezárás kiesése (a `rowHeight` effekt törölve)                                                        | 8/8 zöld   | nem futott | nem futott | 2/2 bukik  |

A teljes fájl a választott megoldáson 76/76 zöld (nem soros másolat, egy worker), a teljes e2e készlet 303/303.

**A (c) időzítés a régi kódon is zöld**, egyezően az ellenőrzés 12/12 eredményével: a mérés
commitjában érkező sor a lezárással egy renderbe kerül, a görgető effekt a lezárás ELŐTT fut, és
a lezárás után a predikátum már az új sorral számol. A (c) a döntés "minden időzítésben"
feltételét dokumentálja; a régi viselkedést az (a) és a (b) fogja.

**A "mérés előtti visszakapcsolás" rontás e2e-n nem bukik, és miért.** A reducer `rows_rendered`
ágának szünet feltétele nélkül egy szünet alatti, az utolsó sort mutató jelentés a követést
visszakapcsolja, a kinyitás viszont a hook hivatkozásában marad a szünet kilépéséig, és a görgetés
azt is olvassa (`followToBottom`): a görgetés ezért elmarad, és a következő sor a nem látottak
közé kerül. Az új szabályban a két védelem egymást fedi, tehát ez a rontás a kinyitásnál
megfigyelhető hatás nélküli (24/24 zöld). Az ellenőrzés régi kódon mért bukása azért jöhetett
létre, mert ott a mérés a hivatkozást kiürítette, és a lezárásig a reducer feltétele volt az
egyetlen védelem. A feltételt unit teszt őrzi (`reduce-transcript-auto-scroll.spec.ts`, 1 bukó
teszt). Az ellenőrzés pontos időzítését nem reprodukáltuk: a (c) időzítés a régi kódon ezzel a
rontással is 8/8 zöld volt.

**Unit rontások** (`use-transcript-auto-scroll.spec.tsx`, `reduce-transcript-auto-scroll.spec.ts`,
43 teszt): a reducer szünet feltétele törölve: 1 bukik; a mérés a kinyitást is lezárja: 3; az alj
elhagyásának feltétele törölve: 5; a kattintás iránya figyelmen kívül: 2.

**(2) A verseny szűrő.** A 17. szekció verseny jelenete egy kísérletet csak akkor számolt, ha a
kinyitás utáni harmadik képkockán az utolsó sor NEM látszott, azzal az indokkal, hogy ha látszik,
a predikátum szerint a követés szándékosan folytatódik. A kinyitott, a végétől ötödik sor 256
pixeles törzse azonban a lista alján állva az utolsó sort mindig kitolja, tehát az utolsó sor
pontosan akkor látszik, ha a lista az aljára ugrott: a szűrő a teljes elrántást dobta ki. A javított
jelenet minden kísérletet számol (elrántás: a fejléc bármely képkockán elmozdul). Az `eede38b`
hookjával, a mai CSS-sel, 1440x900, 40 ms, témánként 50 kísérlet (két külön futás, a fázis
véletlen):

| `overflow-anchor` | Eszköz          | Világos                               | Sötét                        |
| ----------------- | --------------- | ------------------------------------- | ---------------------------- |
| `auto`            | a régi szűrővel | 6 / 37 releváns (mind -53)            | 8 / 45 releváns (mind -53)   |
| `auto`            | minden kísérlet | 16 / 50 (8 × -53, 5 × -786, 3 × -839) | 18 / 50 (14 × -53, 4 × -786) |
| `none`            | a régi szűrővel | 9 / 44 releváns (mind -53)            | 10 / 44 releváns (mind -53)  |
| `none`            | minden kísérlet | 15 / 50 (9 × -53, 5 × -786, 1 × -839) | 11 / 50 (9 × -53, 2 × -786)  |

A régi szűrővel 33/170 releváns kísérlet, mind egy soros; minden kísérletet számolva 60/200 (30
százalék), ebből 40 egy soros és 20 teljes elrántás. A független ellenőrzés 38/100-at mért (21
számolt, 17 kiszűrt).

**A mai és az előző hook a javított jelenettel** (`overflow-anchor: none`, minden kísérlet számolva):

| Hook               | 40 ms, 1440x900 | 40 ms, 375x812 | 150 ms, 1440x900 | 150 ms, 375x812 |
| ------------------ | --------------- | -------------- | ---------------- | --------------- |
| a `da9fa70` hookja | 0/60, 0/60      | 0/60, 0/60     | nem mértük       | nem mértük      |
| a választott       | 0/60, 0/60      | 0/60, 0/60     | 0/40, 0/40       | 0/40, 0/40      |

(Témánként: világos, sötét.) A választott hookkal `overflow-anchor: auto` mellett, 150 ms,
1440x900: 4/40 és 5/40, mind -36; a 17. szekció 3/40 és 3/38 értéke szintén a hibás szűrőből jött.
**Pontosítás (2026-09-25, 19. szekció):** a "mind -36" nem általános: egy független ellenőrzés
ugyanitt 5/80 elmozdulást mért, köztük egy -574 pixeles teljes elrántást; a 19. szekció saját
újramérése 4/40 és 3/40, mind -36.

**(3) A görgetés rögzítés e2e.** A korábbi teszt a kiszámított `overflow-anchor` érték mellett az
ugrás utáni első kinyitás képkockánkénti helyét is mérte. A képkockánkénti rész a CSS és a
kiszámított érték állítása nélkül 16/16 zöld (`--repeat-each 8`, két téma), tehát vak volt; az
ellenőrzés 30/30-at mért. Hogy hatásossá tehető-e, azt a mérő eszköz új `anchoring` jelenete méri:
ugyanaz a lépéssor ismételve (felgörgetés, három sor, ugrás, a végétől ötödik sor kinyitása),
hat, időzítő nélküli érkezési móddal (az új sor a kattintás feladatában, a mérés commitjában, a
negyedik képkockán, érkezés nélkül, és egy követett sor a kattintással egy feladatban, illetve egy
képkockával előtte), `overflow-anchor: auto` mellett, témánként 10 ismétléssel: 0/120 elmozdulás.
Folyamatos, időzítős streamnél ugyanez 9/80. Determinisztikus forgatókönyvet tehát nem találtunk,
ezért az e2e kizárólag a konfigurációt őrzi ("a listán nincs böngésző görgetés rögzítés"), és ezt a
teszt kommentje kimondja; a CSS sor nélkül bukik (1/1).

**Képek** (a munkamenet kimeneti mappájában, `transcript-utolso-sor/`, 1440x900 és 375x812, mindkét
témában, előtte a `da9fa70` hookjával, utána a választottal): a kinyitott utolsó sor a mérés után
(`1-kinyitva`), a következő sor után (`2-uj-sor-utan`), a törzs aljáig görgetve (`3-torzs-olvasva`)
és az akkor érkező sor után (`4-olvasva-uj-sor-utan`). Előtte a következő sor a kinyitott sort
feljebb viszi, gomb nincs; utána a sor a helyén marad, és megjelenik az "Ugrás az aljára (1 új
esemény)" gomb. Szemléltetők: egy repón kívüli, eldobott lépés készítette őket ugyanazzal a
repóbeli fixtúrával (`run-view-stream.ts`), mert képernyőképet lemezre kizárólag a szentesített
`capture-screenshots.ts` írhat; a számok a mérő eszközből és az e2e-ből jönnek.

**NEM ELLENŐRZÖTT:** Firefox és WebKit; a görgetés rögzítés 36 pixeles igazításának pontos oka;
hogy létezik-e a hat kipróbáltnál ügyesebb, időzítő nélküli lépéssor, ami a rögzítést
determinisztikusan előhozza; az ellenőrzés "mérés előtti visszakapcsolás" rontáson mért pontos
időzítése.

## 19. A gomb sáv helye, a nem teli lista szünete és a teszt szerver portja (2026-09-25)

**A kiindulás.** A user döntése (2026-09-25): az "Ugrás az aljára" gomb megjelenése ne tolja le a
listát, a design system szerint, kitalált elem nélkül, és a gomb maradjon elérhető, olvasandó
tartalmat elérhetetlenül ne takarjon. Egy független ellenőrzés a `905ab7e`-n négy hiányt talált:
(1) nem teli listán a kinyitás szünete nem áll, a gomb sosem jelenik meg, és a lista megtelése
után a kinyitott sort soronként 53 pixellel elviszi; (2) emiatt a SPEC-008 7.4 "a rövid törzsű nem
utolsó sorra is" mondata hamis volt; (3) a 17. és 18. szekció "mind -36" állítása nem általános
(`auto` rögzítéssel 150 ms-on 5/80, köztük egy -574 pixeles teljes elrántás); (4) az
`sse-real-server.spec.ts` rögzített portja `--repeat-each 3` mellett három workerrel `EADDRINUSE`
hibát ad. Minden szám ebben a szekcióban a repóbeli mérő eszközből
(`apps/web/measurement/transcript-scroll.ts`, új `gombsav` és `rovid-lista` jelenet) vagy a
Playwright futásokból jön.

**(A) A gomb sáv helye.** A design systemben (`eggproject-design-components`) nincs lebegő, a lista
fölé kerülő gomb minta: sem "ugrás a legújabbhoz" komponens, sem lebegő akciógomb; a meglévő lebegő
elemek (Popover, HoverCard, Toast, modálisok) más célúak. Egy fedő elhelyezés tehát kitalált
pozíciót és árnyékot igényelne, és a lista szélén álló sorokat takarná. A választott megoldás a
hely előre fenntartása: a `transcript-panel__header` sáv mindig a lista fölött áll, benne a design
system `Button` (`secondary`, `sm`) új esemény nélkül is, `visibility: hidden` alatt
(`transcript-panel__jump--idle`): a doboz megmarad, a gomb nem fókuszálható, és kimarad a
hozzáférhetőségi fából. A sáv magasságát a gomb maga adja, szám nélkül. Az ára egy állandó,
gombnyi magas sáv a lista fölött. **Felülírva (2026-09-25, 20. és 21. szekció):** a fenntartott
sáv megszűnt; a gomb előbb a lista alján, majd a user "Felül, belső margóval" döntése óta a lista
tetején, a lista felső belső margójában lebeg.

`gombsav` jelenet: 20 + 10 sor, a lista alján a legutolsó sor kinyitva, majd egy új sor.

| Állapot       | A lista teteje | A kinyitott fejléc | A fejlécből látható (a listán belül) | A gomb alja a lista teteje fölött |
| ------------- | -------------- | ------------------ | ------------------------------------ | --------------------------------- |
| előtte (HEAD) | +36            | +36                | 53 -> 17                             | 8                                 |
| utána         | 0              | 0                  | 53 -> 53                             | 8                                 |

Mindkét sor 1440x900-on és 375x812-n, két témában, azonos értékkel. Előtte a 17 pixel a fejléc
felső belső margója: a fejléc szövege egyik méreten sem látszott (a képeken is).

**(B) A nem teli lista.** A telepített `react-window@2.3.1` (`dist/react-window.js`, `useVirtualizer`)
a látható tartományt állapotban tartja; egy render a `Math.min(itemCount - 1, stopIndexVisible)`
vágással jelenti, és az újraszámolás egy layout effektben fut, aminek az eredményét a lista csak a
következő renderben jelenti (`onRowsRendered` passzív effektben). A sorszám növekedése utáni első
jelentés ezért még a régi utolsó sornál ér véget. Nem teli listán (3 sor) egy új sor után előbb
(2, 4), majd (3, 4) jön (`stopIndex`, sorszám), és a hook ezt "az alj elhagyása, majd visszatérés"
párnak vette: a szünet minden érkezésnél lezárult. A javítás (`is-pre-arrival-range-report.ts`): ha
a sorszám az előző jelentés óta nőtt, és a `stopIndex` pontosan az előző jelentés utolsó sora, a
jelentés nem az alj elhagyása. Ha a régi tartomány korábban véget ért, az újraszámolás ugyanott ér
véget, tehát más jelentés nem lehet elavult; és ilyenkor a friss jelentés mindig megérkezik, mert a
kirajzolt tartomány a túlrajzolási sávval az új sorig bővül (a forrás szerint az `overscanCount`
alapértéke 3). Pixel küszöb, időzítő és saját `ResizeObserver` nincs.

`rovid-lista` jelenet: 3 pótolt sor, a 3. (utolsó) vagy az 1. sor kinyitva, majd egyenként 12 új
sor; a kinyitott fejléc elmozdulása az ablakban és a gomb szövege érkezésenként.

| Állapot       | 1440x900 (mindkét sor, két téma)                             | 375x812 (mindkét sor, két téma)                              |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| előtte (HEAD) | 0 a 7. új sorig, utána -53, -106, ... -265; gomb egyszer sem | 0 a 3. új sorig, utána -29, -82, -135, ...; gomb egyszer sem |
| utána         | 0 mind a 12 után; a gomb "1 ... 12 új esemény"               | 0 mind a 12 után; a gomb "1 ... 12 új esemény"               |

Előtte a lista 1440x900-on a 8., 375x812-n a 4. új sornál telt meg, egyezően az ellenőrzéssel. A
nem teli listán utána a gomb akkor is megjelenik, ha az új sor még látszik: a szünet a user döntése
szerint áll, amíg a felhasználó vissza nem ér az aljára vagy meg nem nyomja a gombot.

**Az e2e** (`sse-real-server.spec.ts`, "AZ UGRÁS GOMB MEGJELENÉSE NEM MOZDÍTJA A LISTÁT" és "NEM TELI
LISTÁN IS ÁLL A KINYITÁS SZÜNETE" blokk): a gomb megjelenése két méreten két témában (a lista és a
kinyitott fejléc helye az ablakban pontosan változatlan, a fejléc teljes egészében látszik, a gomb
teljes egészében az ablakban és a lista fölött áll, és a megnyomása után az utolsó sor a lista
alján); a nem teli lista két méreten két témában, az utolsó és az első sorra (minden új sor után a
gomb száma nő, a fejléc az ablakban nem mozdul, és a végén a lista megtelt). Rontások, a 12 új
teszten:

| Állapot                             | A gomb megjelenése (4) | A nem teli lista (8) |
| ----------------------------------- | ---------------------- | -------------------- |
| a választott megoldás               | 4/4 zöld               | 8/8 zöld             |
| a HEAD hookja, az új panellel       | 4/4 zöld               | 8/8 bukik            |
| az új hook, a HEAD panelje és CSS-e | 4/4 bukik              | 8/8 bukik            |
| a HEAD (a mai kód)                  | 4/4 bukik              | 8/8 bukik            |

Unit: az elavult jelentés szűrése nélkül (`isPreArrivalRangeReport` hatástalanítva) a
`use-transcript-auto-scroll.spec.tsx` új, nem teli listás tesztje bukik (1/29).

**A többi jelenet a javítás után** (a 18. szekció táblázatához képest): `alja` mind 0; `kinyitas-ut`
négy úton, két témában 0 pixel, "2 új esemény"; `utolso-sor` 0 pixel, "1 új esemény", és a
következő sor alja 309 pixellel (256 + 53, a gomb sáv 36 pixele már nincs benne) a lista látható
alja alatt; `fulvaltas` a kerék után 0, 0, 0, 0. `verseny` (`overflow-anchor: none`, 20 kísérlet
beállításonként): 150 és 40 ms, 1440x900 és 375x812, két téma, 0/160.

**(C) A görgetés rögzítés pontosítása.** A HEAD-en (`905ab7e` hook, a gomb sáv régi alakja)
`MEASURE_OVERFLOW_ANCHOR=auto`, 150 ms, 1440x900, témánként 40 kísérlet: 4/40 és 3/40, mind -36.
A független ellenőrzés ugyanitt 5/80-at mért, köztük egy -574 pixeles teljes elrántást; a mi
futásunkban ez nem jelent meg, tehát ritka, de létező kimenetel, és a 17. és 18. szekció "mind -36"
állítása nem általános (ott javítva). A gomb sáv helyének fenntartása után ugyanez a jelenet `auto`
mellett 0/40 és 0/40: a -36 a gomb sáv megjelenéséhez kötött. Hogy pontosan melyik horgony mozdult,
továbbra is NEM ELLENŐRZÖTT. A listán az `overflow-anchor: none` marad (user döntés 2026-09-24).

**(D) A teszt szerver portja.** A fájl minden szervere az operációs rendszer által kiosztott szabad
porton figyel a `127.0.0.1` címen (Node doksi: "If `port` is omitted or is 0, the operating system
will assign an arbitrary unused port", <https://nodejs.org/api/net.html#serverlistenport-host-backlog-callback>;
megerősítés: <https://github.com/nodejs/node/blob/main/doc/api/net.md>,
<https://beta.docs.nodejs.org/net/Server>), és a lap a build időben rögzített `STREAM_ORIGIN` felé
induló `GET /events` kérését a `route.continue({ url })` erre a portra irányítja (Playwright doksi:
"If set changes the request URL. New URL must have same protocol as original one",
<https://playwright.dev/docs/api/class-route#route-continue>; megerősítés:
<https://github.com/microsoft/playwright/blob/main/docs/src/api/class-route.md>,
<https://playwright.dev/python/docs/api/class-route>). Chromiumban ez a CDP `Fetch.continueRequest`
`url` paramétere, "a lap számára nem megfigyelhető módon"
(<https://chromedevtools.github.io/devtools-protocol/tot/Fetch/#method-continueRequest>; megerősítés:
<https://github.com/chromedp/cdproto/blob/main/fetch/fetch.go>). A kérés valódi hálózaton megy,
nem mock; a `Last-Event-ID` újracsatlakozás tesztjei ezen az úton is zöldek. A leállás és
újraindulás tesztjei a leállt és az újraindult példányt a korábban kiosztott portra kötik. A
workerenkénti fix port (`testInfo.parallelIndex`, Playwright doksi: "It is guaranteed that workers
running at the same time have a different `parallelIndex`",
<https://playwright.dev/docs/api/class-workerinfo>) kitalált alap portszámot igényelne, ezért a
szabad port a választás. A fájl `mode: 'serial'` beállítása ezzel kikerült.

| Állapot       | `sse-real-server.spec.ts --repeat-each 3 --workers 3`                     |
| ------------- | ------------------------------------------------------------------------- |
| előtte (HEAD) | 77 zöld, 2 bukik (`EADDRINUSE`), 152 nem futott (soros fájl a bukás után) |
| utána         | 267/267 zöld (89 teszt háromszor), nulla `EADDRINUSE`                     |

A "utána" sor 2026-09-25-én újramérve (20. szekció (G)): a korábbi 231/231 a 12 új teszt
előtti, 77 tesztes fájlra szólt, a commitolt fájl 89 tesztje háromszor 267. A teljes e2e készlet utána 331/331 zöld (hat `--shard` hívás, sorban, három workerrel), az e2e
lefedettség ratchetje `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 38. szekció.

**Képek** (a munkamenet kimeneti mappájában, `transcript-gombsav/`, 1440 és 375 pixel, két téma,
előtte a HEAD panelével és hookjával, utána a választottal): `gombsav-*-1-kinyitva` (a lista alján
kinyitott utolsó sor) és `gombsav-*-2-uj-sor-utan` (az új sor és a gomb megjelenése után: előtte a
fejléc a lista alja alá csúszik, utána a helyén marad); `rovid-*-1-kinyitva` és
`rovid-*-2-tiz-uj-sor-utan` (három sor, az utolsó kinyitva, majd tíz új sor: előtte gomb nincs, és
a kinyitott sor kigördül, utána a sor a helyén, "Ugrás az aljára (10 új esemény)"). Szemléltetők:
egy repón kívüli, eldobott lépés készítette őket ugyanazzal a repóbeli fixtúrával
(`run-view-stream.ts`), mert képernyőképet lemezre kizárólag a szentesített `capture-screenshots.ts`
írhat; a számok a mérő eszközből és az e2e-ből jönnek.

**NEM ELLENŐRZÖTT:** Firefox és WebKit; hogy a `react-window` más verziója ugyanígy jelenti-e a régi
tartományt az érkezés utáni első renderben (a szűrés a pinelt `2.3.1` forrásán alapul); a -574
pixeles elrántás pontos lépéssora; a görgetés rögzítés 36 pixeles igazításának pontos horgonya.

## 20. A lista fölött lebegő ugrás gomb és a szabad port regressziós tesztje (2026-09-25)

**A kiindulás.** A 19. szekció fenntartott gomb sávjának ára egy állandó, 36 pixeles üres sáv a
lista fölött (a 28 pixeles `sm` gomb és a 8 pixeles `--ep-space-2` térköz), a lista
magasságának 6 (1440x900), illetve 9 (375x812) százaléka. A user döntése (2026-09-25): "Lista
fölé kerüljön", tehát a gomb a lista fölött lebegjen, üres sáv nélkül. Egy független ellenőrzés
szerint a design systemben nincs lista fölé lebegő gomb (viewporthoz rögzített toast, a
triggerhez igazodó popover és hover-card, sticky csak a DataTable fejlécében és a drawer
láblécében van), ezért az elhelyezés saját kiegészítés, a gomb maga a design system `Button`-ja.
Minden szám a repóbeli mérő eszközből (`apps/web/measurement/transcript-scroll.ts`, új
`lista-magassag` és `takaras` jelenet, a `gombsav` és a `rovid-lista` jelenet bővítve, új
`MEASURE_JUMP_PLACEMENT` kapcsoló) vagy a Playwright futásokból jön, 1440x900-on és 375x812-n,
két témában; a két téma minden sorban azonos értéket adott.

**(A) A lista magassága** (`lista-magassag`, követő lista, gomb nélkül):

| Állapot                                                | A lista magassága (1440 / 375) | A lista teteje a panel tetejétől |
| ------------------------------------------------------ | ------------------------------ | -------------------------------- |
| az `1c7dd13` előtti panel (a sáv a gombbal jelent meg) | 597 / 409                      | 71 / 92                          |
| `1c7dd13` (fenntartott sáv)                            | 561 / 373                      | 107 / 128                        |
| utána (lebegő gomb)                                    | 597 / 409                      | 71 / 92                          |

A panel magassága mindhárom állapotban 668 / 501, a lista alja a panel alján áll.

**(B) A gomb megjelenése** (`gombsav`: 20 + 10 sor, a lista alján a legutolsó sor kinyitva,
majd egy új sor):

| Állapot             | A lista és a fejléc elmozdulása | A fejlécből a listán belül | A gomb helye                                             |
| ------------------- | ------------------------------- | -------------------------- | -------------------------------------------------------- |
| az `1c7dd13` előtti | +36 / +36                       | 53 -> 17                   | a lista fölött, az alja 8 pixellel a lista teteje fölött |
| `1c7dd13`           | 0 / 0                           | 53 -> 53                   | ugyanott, a fenntartott sávban                           |
| utána               | 0 / 0                           | 53 -> 53                   | a listán belül, az alja 8 pixellel a lista alja fölött   |

Utána a gomb a kinyitott utolsó sort (a 30.) takarja; a sor görgetéssel kiszabadítható.

**(C) A hely: a lista alja vagy teteje.** A döntés szövege a helyet nem nevezi meg (SPEC-008
14.2 O-14). A mérő eszköz a takart sorokat a sor és a gomb dobozából számolja
(`rowsUnderJumpButton`, `e2e/run-view-stream.ts`), és azt is, hogy a sor a lista görgetési
tartományán belül a gomb fölé vagy alá vihető-e úgy, hogy teljes egészében a lista látható
területén álljon. A tető változatot a `MEASURE_JUMP_PLACEMENT=top` kapcsoló méri (a gomb
`top: var(--ep-space-2)` helyen).

| Jelenet                                                  | Alul lebegő gomb                                                              | Tetején lebegő gomb                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| `takaras`: 30 sor, a lista tetejére görgetve, egy új sor | takart sor 1440-en a 11. és a 12., 375-ön a 8.; mind görgethető (4/4)         | takart az 1. sor, nem görgethető (4/4)                 |
| `rovid-lista`: 3 sor, egy kinyitva, 12 érkezés           | 96 érkezésből 12 után egy sor alsó része takart és a lista még nem görgethető | 96 érkezésből 96 után az 1. sor takart, nem görgethető |

A `rovid-lista` alul lebegő eseteinek részletei: 1440x900-on a 7. érkezés után a 10. sor
(a 8.-nál már görgethető), 375x812-n a 3. érkezés után a 6., a 4. után a 7. sor (az 5.-nél már
görgethető), mindkét kinyitott sorral, mindkét témában. A `takaras` jelenetben a legfelső takart
sor egérkerékkel a gomb fölé görgetve teljes egészében látszik (a sor alja pontosan a gomb
tetején, 0 pixel), és a gomb a helyén marad, mert a lista még nem ért az aljára. A választott hely
ezért a lista alja, középen; az ára, hogy a lista alján kinyitott utolsó sor fejlécét a megjelenő
gomb takarja (B). **Felülírva (2026-09-25, 21. szekció):** a user döntése a lista teteje, a lista
tartalmának felső belső margójával, így a lista első sora sem takart, és alul sem takar semmit.

**(D) A megvalósítás** (`TranscriptPanel.tsx`, `transcript-panel.css`): a lista egy
`transcript-panel__list-frame` keretben áll (a lista inline `flex-grow: 1` és
`max-height: 100%` stílusával kitölti), a keret a gomb pozicionálási doboza, és az egy sornyi
minimum a keretre került. A gomb csak `unseenCount > 0` mellett van a DOM-ban, a keretben a lista
előtt. Középre `inset-inline: 0` és `margin-inline: auto` igazít, nem `transform`, mert a design
system `.btn:active` szabálya (`packages/ui/src/button/button.css`) lenyomáskor a `transform`
értéket `translateY(1px)`-re állítja. A lista gyökere a telepített `react-window@2.3.1` forrása
szerint `position: relative`, a sorai `position: absolute` (`dist/react-window.js`), a gomb pedig
a DOM-ban előttük áll, ezért kap `z-index: 1`-et. A CSS 2 E. függeléke szerint egy rétegkörnyezeten
belül "All positioned descendants with 'z-index: auto' or 'z-index: 0', in tree order", utána
"Stacking contexts formed by positioned descendants with z-indices greater than or equal to 1"
festődnek (<https://www.w3.org/TR/CSS2/zindex.html>; megerősítés:
<https://www.w3.org/TR/CSS22/zindex.html>, <https://www.w3.org/TR/CSS2/visuren.html> 9.9.1,
<https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_without_z-index>).
Az árnyék a design system saját lebegő elemének, a toastnak a tokenje (`toast.css`:
`--ep-shadow-lg`).

**(E) Takarás és `toBeInViewport`.** A Playwright doksi szerint a `toBeInViewport` "Ensures the
Locator points to an element that intersects viewport, according to the intersection observer
API" (<https://playwright.dev/docs/api/class-locatorassertions#locator-assertions-to-be-in-viewport>;
megerősítés: <https://github.com/microsoft/playwright/blob/main/docs/src/api/class-locatorassertions.md>,
<https://playwright.dev/python/docs/api/class-locatorassertions>), az intersection observer első
változata pedig a más tartalom általi takarást nem nézi: "it doesn't tell you whether the Element
is covered by any other page content" (<https://github.com/w3c/IntersectionObserver/blob/v2/explainer.md>;
megerősítés: <https://web.dev/articles/intersectionobserver-v2>,
<https://www.afasterweb.com/2019/02/28/proposed-updates-for-intersection-observer>). Ezért az e2e
a takarást a sor és a gomb dobozából számolja, a `toBeInViewport({ ratio: 1 })` mellett.

**(F) Az e2e** (`sse-real-server.spec.ts`): "AZ UGRÁS GOMB MEGJELENÉSE NEM MOZDÍTJA A LISTÁT, ÉS
NINCS ÜRES SÁV" (4 teszt: a lista és a kinyitott fejléc helye az ablakban változatlan, a gomb a
lista látható területén belül áll, a delta mondat és a lista között csak a panel sortávolsága van,
a gomb és a fejléc teljes egészében az ablakban), és "A LEBEGŐ GOMB ALATTI SOR GÖRGETÉSSEL ELÉRHETŐ"
(4 teszt: a gomb alatti sor görgethető, egérkerékkel a gomb fölé görgetve nem takart és
`toBeInViewport({ ratio: 1 })`; a gomb fókuszálható, a `Tab` a lista egy sorára visz, a
`Shift+Tab` vissza a gombra, az `Enter` az aljára ugrik, utána a gomb nincs a hozzáférhetőségi
fában). Rontások a 8 teszten:

| Állapot                                | Megjelenés (4)                | Takart sor és billentyűzet (4)                  |
| -------------------------------------- | ----------------------------- | ----------------------------------------------- |
| a választott megoldás                  | 4/4 zöld                      | 4/4 zöld                                        |
| az `1c7dd13` panelje (fenntartott sáv) | 4/4 bukik (üres sáv: 36)      | 4/4 bukik (a gomb egyetlen sort sem takar)      |
| az `1c7dd13` előtti panel              | 4/4 bukik (a lista +36 pixel) | 4/4 bukik                                       |
| a gomb a lista tetején (`top`)         | 4/4 zöld (a hely nem tárgya)  | 4/4 bukik (a takart sor nem görgethető)         |
| a gomb a DOM-ban a lista után          | nem futott                    | 4/4 bukik (a `Tab` nem a lista egy sorára visz) |

A teljes `sse-real-server.spec.ts` (93 teszt) és a `transcript-panel.spec.ts` (14 teszt)
107/107 zöld; `--repeat-each 3` mellett három workerrel 279/279, nulla `EADDRINUSE`. Unit: a
`TranscriptPanel.spec.tsx` a gomb hiányát új esemény nélkül, a látható gomb fókuszálhatóságát,
`tabIndex`-ét, `aria-hidden` hiányát és a lista előtti helyét, és a sáv hiányát őrzi.

**(G) A szabad port regressziós tesztje** (`apps/web/src/e2e-stream-server-free-port/`,
megvalósítás nélküli téma). A 19. szekció (D) szabad portja a CI egy workerén fix porton is zöld
lenne (független ellenőrzés: 89/89), tehát a visszaállítást egyetlen futó e2e sem fogná meg. A
teszt az `apps/web/e2e` és az `apps/web/measurement` minden `.ts` fájljának szövegén négy
szabályt őriz: a `listen` szó pontosan egyszer áll, a közös fixtúra `listenOnLoopback`
függvényében; a `listenOnLoopback` port paraméterének alapértéke `0`, és a `listen` hívás ezt
kapja; a `listenOnLoopback` hívásai portként nem adnak át szám, szöveg vagy origin literált; minden
`port` nevű függvény paraméter alapértéke `0`. Igazolás, egy-egy injekcióval (a teszt az eredeti
fán 5/5 zöld):

| Injekció                                                        | Eredmény      |
| --------------------------------------------------------------- | ------------- |
| a `listenOnLoopback` alapértéke `4174`                          | 2 teszt bukik |
| közvetlen `server.listen(4174)` egy spec fájlban                | 1 teszt bukik |
| `listenOnLoopback(server, 4174)`                                | 1 teszt bukik |
| `listenOnLoopback(server, Number(new URL(STREAM_ORIGIN).port))` | 1 teszt bukik |
| egy helper `port = 4174` alapértéke                             | 1 teszt bukik |
| a két fájl `1c7dd13^` állapota (a tényleges visszaállítás)      | 3 teszt bukik |

A korlát kimondva: egy nevesített konstansban álló szám, amit egy helper paramétereként adnak
tovább, egyik szabályon sem akad fenn.

A 19. szekció (D) táblázatának "utána" sora újramérve: a commitolt, 89 tesztes fájl
`--repeat-each 3` mellett három workerrel 267/267 zöld, nulla `EADDRINUSE` (a commitolt panellel és fixtúrával).

**(H) Tört listamagasság a jóváhagyás panel mellett.** A sáv megszűnésével a lista a jóváhagyás
panel melletti kezdő állásban is a teljes maradék helyet kapja, és ez a húzható elválasztó
százalékos felosztásából tört szám lehet. A teljes e2e első futásán az
`approval-prompt.spec.ts` 375x812-es szélső állás tesztje (két téma) bukott: a lista utolsó sora
görgetve 0,9906 arányban látszott. A mérő eszköz `tort-magassag` jelenete (kezdő állás, a lista
végére görgetve, az utolsó sor alja a lista dobozának alja alatt):

| Állapot                              | 375x812: doboz / `clientHeight` / legnagyobb `scrollTop` / az utolsó sorból nem látszik | 1440x900 és 1440x600 |
| ------------------------------------ | --------------------------------------------------------------------------------------- | -------------------- |
| a lebegő gomb, kerekítés nélkül      | 85,5 / 86 / 974 / 0,5 pixel                                                             | egész magasság, 0    |
| a lebegő gomb, egész magasságú lista | 85 / 85 / 975 / 0                                                                       | egész magasság, 0    |

A görgetési tartomány egész pixelre kerekít (a 974,5 helyett 974 a legnagyobb `scrollTop`), a
`clientHeight` pedig 86-ra, tehát a lista `clientHeight` alapú mérései (`lastRowBottomOverflow`)
ezt a fél pixelt nem látják; a jelenet ezért a lista dobozához mér. A javítás: a lista
`max-height` értéke `round(down, 100%, 1px)` (a `react-window` `List` `style` propján, ami a
könyvtár saját `maxHeight: 100%` értékét felülírja), tehát a lista egész pixel magas, a keretnél
legfeljebb egy pixellel kisebb. A CSS `round()` függvény a `down` stratégiával a
`Math.floor()` megfelelője (<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/round>;
megerősítés: <https://web.dev/blog/css-stepped-value-functions>, Chrome 125 kiadási jegyzet:
<https://developer.chrome.google.cn/release-notes/125>). Utána a két bukott e2e zöld, a teljes
készlet 343/343. A korábbi, sávos alakban ugyanez a teszt zöld volt; hogy ott a lista az egy
sornyi minimumán állt-e, NEM ELLENŐRZÖTT.

**Képek** (a munkamenet kimeneti mappájában, `transcript-lebego-gomb/`, 1440 és 375 pixel, két
téma): `*-1-kovet-gomb-nelkul` (követő lista, gomb és sáv nélkül), `*-2-kinyitott-utolso-sor-gomb`
(a kinyitott utolsó sor és a megjelent gomb), `*-3-felgorgetve-gomb` (a lista tetején, a gomb
alul), `*-4-takart-sor-gorgetve` (a korábban takart sor a gomb fölé görgetve),
`*-5-gomb-fokuszban`. Szemléltetők: egy repón kívüli, eldobott lépés készítette őket ugyanazzal a
repóbeli fixtúrával, mert képernyőképet lemezre kizárólag a szentesített `capture-screenshots.ts`
írhat; a számok a mérő eszközből és az e2e-ből jönnek.

**NEM ELLENŐRZÖTT:** Firefox és WebKit; más ablakméret a két mértnél; hogy a `rovid-lista`
átmeneti takarása a gomb megnyomására is feloldódik-e (nem mért).

## 21. A lista tetején, belső margóban lebegő ugrás gomb (2026-09-25)

**A kiindulás.** A 20. szekció a gombot a lista aljára tette, mert a lista tetején, margó nélkül a
gomb alatt a lista első sora semmilyen görgetéssel nem szabadítható ki. Alul viszont éppen a lista
alján kinyitott utolsó sor fejlécét takarta, amit a gomb sáv korábbi 36 pixeles lelökése miatt meg
akartunk óvni (20. szekció (B)). A user döntése (2026-09-25, "Felül, belső margóval"): a gomb a
lista tetején lebeg, és a lista tartalma felül egy gombnyi belső margót kap, ami a görgetéssel
együtt eltűnik (a görgetett tartalom része, nem fix sáv), így a lista legelső sora is elérhető,
alul pedig semmit nem takar; a virtualizáció a margót a mért magasságokkal összhangban kezelje.
Minden szám a repóbeli mérő eszközből (`apps/web/measurement/transcript-scroll.ts`, a `gombsav` és
a `takaras` jelenet bővítve, a `MEASURE_JUMP_PLACEMENT=top` kapcsoló helyett
`MEASURE_JUMP_BAND=none`) vagy a Playwright futásokból jön, 1440x900-on és 375x812-n, két témában;
a két téma minden sorban azonos értéket adott. "Előtte" a `2743b6b` (a gomb az `1bcface` óta a
lista alján), "utána" a mostani kód, "margó nélkül" a mostani kód `MEASURE_JUMP_BAND=none` mellett.

**(A) A megvalósítás** (`transcript-panel.css`): a gomb `top: var(--ep-space-2)`, a lista
`padding-top: calc(2 * var(--ep-space-2) + 28px)` (44 pixel: a gomb két térköze és a design system
`sm` gombja; a `.btn--icon.btn--sm` `block-size: 28px`, és a szöveges `.btn--sm` is ennyi: 2 x 7
pixel belső margó, 12 pixeles betű 1-es sormagassággal, 2 x 1 pixel szegély,
`packages/ui/src/button/button.css`; mérve a gomb 28 pixel magas) és `box-sizing: border-box`.
Hogy a `react-window@2.3.1` a belső margóval miért pontos, azt a telepített forrás
(`dist/react-window.js`) és a CSS specifikációk adják:

- A sorok `position: absolute` elemek `transform: translateY(...)` eltolással, `top` érték nélkül
  (a `List` sor `style` objektuma), tehát a `top` `auto`, és a sor a statikus helyéről indul, ami a
  görgető doboz belső margója alatt van. Forrás: CSS 2.2 10.6.4 ("If all three of 'top', 'height',
  and 'bottom' are auto, set 'top' to the static position",
  <https://www.w3.org/TR/CSS22/visudet.html#abs-non-replaced-height>; megerősítés:
  <https://www.w3.org/TR/CSS2/visudet.html>, <https://www.w3.org/TR/2008/REC-CSS2-20080411/visudet.html>).
- A görgető doboz belső margója a görgethető terület része, tehát a görgetéssel együtt eltűnik.
  Forrás: CSS Overflow 3, a "scrollable overflow area" része a doboz "own padding box"-a
  (<https://www.w3.org/TR/css-overflow-3/>; megerősítés: <https://drafts.csswg.org/css-overflow-3/>,
  <https://github.com/w3c/csswg-drafts/blob/main/css-overflow-3/Overview.bs>).
- A könyvtár a látható magasságot egy `ResizeObserver` `contentRect.height` értékéből veszi (a
  forrás `we` függvénye), ami a margót nem tartalmazza. Forrás: MDN, "the returned `contentRect` is
  the element's content box" (<https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry/contentRect>;
  megerősítés: <https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserverEntry>,
  <https://web.dev/articles/resize-observer>). A `clientHeight` ezzel szemben tartalmazza a
  margót (CSSOM View: "the unscaled height of the padding edge", <https://www.w3.org/TR/cssom-view-1/>;
  megerősítés: <https://drafts.csswg.org/cssom-view/>,
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/clientHeight>), ezért a lista mérései
  (`lastRowBottomOverflow`, `rowsUnderJumpButton`) változatlanul helyesek.
- Következmény (a forrás `ee` és `Oe` függvénye): a sorok koordinátáiban a doboz valódi alsó éle
  `scrollTop` plusz a tartalom magassága, pontosan az, amivel a könyvtár a látható tartományt és a
  `scrollToRow({ align: 'end' })` célját számolja. A lista alja, a `stopIndex` predikátum és a
  legnagyobb `scrollTop` (a méretező elem magassága mínusz a tartalom magassága) tehát a margóval is
  pontos; a könyvtár "látható" tartományából éppen a margó sávja marad ki.
- A `border-box` a `max-height: round(down, 100%, 1px)` értéket (20. szekció (H)) a margóval
  együtt a dobozra teszi: CSS Box Sizing 3, a `box-sizing` "affects the interpretation of all sizing
  properties" (<https://www.w3.org/TR/css-sizing-3/>; megerősítés:
  <https://drafts.csswg.org/css-sizing-3/>,
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/box-sizing>). Enélkül a
  `max-height` a tartalom dobozára vonatkozna, ami a margóval kisebb a keretnél, tehát a kerekítés
  hatástalan lenne.

Egy első, üres "margó sor" a sorszámokat eltolná (a hook `stopIndex === rowCount - 1` predikátuma
és az `aria-posinset` is), a becslése pedig az összecsukott sor 53 pixele lenne, tehát a mérésekor
a lista elugrana (13. és 16. szekció). A `List` `children` propja a sorok UTÁN, a méretező előtt
rajzolódik, és a forrás minden nem `aria-hidden` gyereket sorként mér (a `data-react-window-index`
kiosztása), tehát a gomb sem állhat ott. Ez a két elvetett alternatíva a telepített forrásból
következik, nem mértük.

**(B) A lista magassága** (`lista-magassag`, követő lista, gomb nélkül): előtte és utána is 597
(1440x900) és 409 (375x812) pixel, a `clientHeight` ugyanennyi, a lista teteje a panel tetejétől 71,
illetve 92 pixelre; a felső belső margó előtte 0, utána 44 pixel. Fix sáv nincs.

**(C) A gomb megjelenése** (`gombsav`: 20 + 10 sor, a lista alján a legutolsó sor kinyitva, majd
egy új sor):

| Állapot      | A lista és a fejléc elmozdulása | A fejlécből a gomb alatt | A gomb teteje a lista tetejétől | A gomb alatti sorok (1440 / 375) |
| ------------ | ------------------------------- | ------------------------ | ------------------------------- | -------------------------------- |
| előtte       | 0 / 0                           | 28 pixel                 | 561 / 373 (a lista alján)       | 30 / 30 (a kinyitott utolsó sor) |
| utána        | 0 / 0                           | 0 pixel                  | 8 / 8                           | 19, 20 / 23 (a lista tetején)    |
| margó nélkül | 0 / 0                           | 0 pixel                  | 8 / 8                           | 19, 20 / 23                      |

Utána a lista tetején a gomb alatt álló sorok görgetéssel kiszabadíthatók (mindegyik
`isReachableByScrolling`).

**(D) A lista legteteje és a közepe** (`takaras`: 20 + 10 sor, egérkerékkel a lista tetejére, majd
egy új sor; utána a görgetési tartomány felére, és az ott legelső takart sor kiszabadítása
egérkerékkel):

| Állapot      | A tetején a gomb alatti sorok (1440 / 375) | Az első sor teteje a gomb alja alatt | A közepén takart, kiszabadítva                           |
| ------------ | ------------------------------------------ | ------------------------------------ | -------------------------------------------------------- |
| előtte       | 11, 12 / 8 (a lista alján, görgethető)     | -589 / -401 (a gomb a lista alján)   | 21 / 19, a gomb fölé: a sor alja a gomb tetején, 0 pixel |
| utána        | nincs / nincs                              | 8 / 8                                | 10 / 12, a gomb alá: a sor teteje a gomb alján, 0 pixel  |
| margó nélkül | 1 / 1, görgetéssel sem kiszabadítható      | -36 / -36                            | 11 / 12, a gomb alá: a sor teteje a gomb alján, 0 pixel  |

Utána a lista legtetején az első sor teteje ugyanannyival (8 pixel) áll a gomb alja alatt, mint a
gomb teteje a lista teteje alatt: a gomb alatt a margó látszik, nem sor.

**(E) A nem teli lista** (`rovid-lista`: 3 sor, az utolsó vagy az első kinyitva, egyenként 12 új
sor; mindkét méret, mindkét téma, 96 érkezés): előtte 64 érkezés után takart a gomb sort, ebből 12
után görgetéssel sem kiszabadíthatót (a 20. szekció (C) száma); utána 0 érkezés után; margó nélkül
mind a 96 után az első sort, kiszabadíthatatlanul. A kinyitott fejléc elmozdulása és a gomb
szövege ("1 ... 12 új esemény") előtte és utána azonos, 0 pixel.

**(F) Változatlan viselkedés, utána** (a 13-20. szekció jelenetei): `alja` mind a négy helyzetben
0; `kinyitas-ut` négy úton két témában 0 pixel, "2 új esemény"; `utolso-sor` 0 pixel, "1 új
esemény", a következő sor alja 309 pixellel a lista látható alja alatt; `fulvaltas` a kerék után 0,
0, 0, 0; `verseny` (`overflow-anchor: none`, 20 kísérlet beállításonként, 150 és 40 ms, két méret,
két téma) 0/160; `anchoring` (hat érkezési mód, két téma, 10 ismétlés) 0/120; `tort-magassag` a
lista 190, 53 és 85 pixel, az utolsó sor alja a doboz alján (0), a legnagyobb `scrollTop` a
margóval nő (870 -> 914, 1007 -> 1051, 975 -> 1019). Az `alja`, `kinyitas-ut`, `utolso-sor` és
`fulvaltas` előtte is ugyanezt adta.

**(G) Az e2e** (`sse-real-server.spec.ts`): "AZ UGRÁS GOMB A LISTA TETEJÉN LEBEG, A MEGJELENÉSE
SEMMIT NEM MOZDÍT, ÉS ALUL SEMMIT NEM TAKAR" (4 teszt: a lista és a kinyitott utolsó sor fejléce az
ablakban pontosan a helyén, a gomb a lista felső belső margóján belül, a fejléc és a gomb doboza
nem fedi egymást, a gomb alatti sorok között nincs a kinyitott sor, üres sáv nincs) és "A LISTA
LEGTETEJÉN A GOMB ALATT A MARGÓ ÁLL, NEM SOR" (4 teszt: a lista legtetején a gomb egyetlen sort sem
takar, az első sor `toBeInViewport({ ratio: 1 })`, a gomb alatti és fölötti térköz egyenlő; a
billentyűzet: a gomb fókuszálható, a `Tab` a lista egy sorára visz, a `Shift+Tab` vissza; a
görgetési tartomány felénél a gomb alatti sor egérkerékkel a gomb alá görgetve teljesen látszik;
`Enter` az aljára, utána a gomb nincs a hozzáférhetőségi fában). `--repeat-each 3` mellett 24/24.
Rontások a 8 teszten (a termék két fájlja kicserélve, a build újra):

| Állapot                                              | Megjelenés (4)                          | Legteteje és billentyűzet (4)                     |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| a választott megoldás                                | 4/4 zöld                                | 4/4 zöld                                          |
| az `1bcface` panelje és CSS-e (a gomb a lista alján) | 4/4 bukik (a gomb nincs a felső sávban) | 4/4 bukik (a lista legtetején a gomb sort takar)  |
| az `1c7dd13` előtti panel (a sáv lelöki a listát)    | 4/4 bukik (a lista teteje elmozdul)     | 4/4 bukik (a gomb alatti és fölötti térköz eltér) |
| margó nélkül (`padding-top: 0`)                      | 4/4 bukik (a gomb nincs a felső sávban) | 4/4 bukik (a lista legtetején az első sor takart) |
| a gomb a DOM-ban a lista után                        | 4/4 zöld (a hely nem tárgya)            | 4/4 bukik (a `Tab` nem a lista egy sorára visz)   |

A teljes e2e készlet 353/353 zöld (négy `--shard` hívás, sorban, három workerrel), az e2e
lefedettség ratchetje `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` 42. szekció. Unit: a
`TranscriptPanel.spec.tsx` a gomb hiányát, a látható gomb fókuszálhatóságát, `tabIndex`-ét és a
lista előtti helyét változatlanul őrzi.

**Képek** (a munkamenet kimeneti mappájában, `transcript-gomb-felul/`, 1440 és 375 pixel, két téma;
`elotte-` előtaggal a `2743b6b` panelje és CSS-e): `*-1-kovet-gomb-nelkul`,
`*-2-kinyitott-utolso-sor-gomb` (előtte a gomb a kinyitott utolsó sor fejlécén, utána a lista
tetején), `*-3-tetejen-gomb-alatt-margo`, `*-4-kozepen-gomb-alatti-sor`,
`*-5-takart-sor-gomb-ala-gorgetve`, `*-6-gomb-fokuszban` (billentyűvel), `*-7-rovid-lista-margo`
(három sor, gomb nélkül: a margó a lista tetején), `*-8-rovid-lista-gomb` (előtte a gomb a lista
alján, utána a margóban). Szemléltetők: egy repón kívüli, eldobott lépés készítette őket ugyanazzal
a repóbeli fixtúrával, mert képernyőképet lemezre kizárólag a szentesített `capture-screenshots.ts`
írhat; a számok a mérő eszközből és az e2e-ből jönnek.

**NEM ELLENŐRZÖTT:** Firefox és WebKit; más ablakméret a két mértnél; a görgetés rögzítés
bekapcsolt (`auto`) értékkel a margó mellett. **Ismert korlát, mérve, de gomb nélkül:** ahol a lista az egy sornyi, 53 pixeles minimumán áll (a
`tort-magassag` jelenet szerint 1440x600-on a jóváhagyás panel melletti kezdő állásban is, és az
elválasztó `End` állásában), a 44 pixeles margó után 9 pixel marad a tartalomnak: a lista aljára
görgetve az utolsó sor teljesen látszik (a margó kigördül), a lista legtetején viszont az első
sorból csak 9 pixel látszik, és a lista minden más állásában egy megjelenő gomb (a lista tetejétől
8 és 36 pixel között) a látható sort takarja. A gombbal együtt ez nem mért, és hogy a gomb ebben az
állásban hogyan viselkedjen, nyitott kérdés volt (SPEC-008 14.2 O-15); 2026-09-25-én lezárva: szűk
listán a gomb a lista mellett, a folyásban áll (22. szekció).

## 22. Szűk listán a gomb nem lebeg (2026-09-25, a 21. szekció ismert korlátjának és az O-15-nek a lezárása)

**Kiváltó ok.** A user 2026-09-25-i döntése (O-15, "javítsuk"): ahol a lista annyira szűk, hogy a
44 pixeles felső belső margó után egy sornál kevesebb marad, a gomb ne lebegjen, hanem más formában
jelezze az új eseményeket, a design system meglévő elemeiből, kitalált küszöb nélkül.

**A feltétel, mért értékből.** A lista akkor szűk, ha a látható magassága kisebb, mint a margó
plusz egy összecsukott sor. A `react-window` a lista `onResize` hívásában a `ResizeObserver`
`contentRect` méretét adja át (a telepített csomag forrástérképe szerint
`lib/hooks/useResizeObserver.ts`: a megfigyelő `contentRect` értékét tárolja, és a lista ezt adja
az `onResize` hívásnak), ami a belső
margót NEM tartalmazza (MDN "contentRect": "the element's content box"). A feltétel ezért pontosan
annyi, hogy a tartalom doboz kisebb egy sornál (`is-compact-transcript-list.ts`, a sor magassága a
mért `COLLAPSED_TRANSCRIPT_ROW_HEIGHT` konstans, 53 pixel). A margó szűk listán is marad, mert a
feltétel a margó nélküli tartalom dobozon áll; egy eltüntetett margó a tartalom dobozát 44
pixellel növelné, és a feltétel a két alak között billegne.

**A forma.** Ugyanaz a design system `Button` (`secondary`, `sm`), ugyanazzal a szöveggel ("Ugrás az
aljára (N új esemény)"), de a lista bal oldalán, a lista tetejéhez igazítva, a folyásban áll, nem
lebeg (`.transcript-panel__list-frame--compact`: a keret sor irányú, a gomb `position: static`,
árnyék nélkül). A DOM-ban továbbra is a lista előtt áll, tehát a látás, a `Tab` sorrend és a
képernyőolvasó sorrendje egyezik (balról jobbra előbb a gomb). A lista a keret teljes magasságát
kapja, tehát a gomb megjelenése a lista magasságát és helyét nem változtatja, csak a szélességét
(egysoros, csonkolt sorcímekkel a sorok magassága sem változik). A javasolt másik két forma
elvetve: egy `Badge` nem interaktív elem, egy gombbá tett jelvény kitalált elem lenne; a transcript
fejlécébe, a lista fölé tett szöveges jelzés a folyásban a listát lefelé tolná (a user 2026-09-25-i
döntése éppen ezt tiltotta a normál listán), szűk listán pedig a transcript burkolóját görgetni
kényszerítené.

**Mérés** (`bun run measure:transcript -g szuk-lista`, a mérő eszköz 13. jelenete, a látott
jóváhagyással, a lista közepére görgetve három új sor után, két témában, a két téma minden
számban egyezik; előtte a `20d8620` kódján):

| Méret    | Lista / tartalom doboz, előtte | Gomb helye, takart sor előtte | Lista / tartalom doboz, utána | Gomb helye, takart sor utána | Lista mozdulása |
| -------- | ------------------------------ | ----------------------------- | ----------------------------- | ---------------------------- | --------------- |
| 1440x900 | 190 / 146                      | lebeg, 8. és 9. sor           | 190 / 146 (változatlan)       | lebeg, 8. és 9. sor          | 0               |
| 900x1000 | 53 / 9                         | lebeg, 10. sor                | 79 / 35                       | a lista mellett, nincs       | 0               |
| 1440x600 | 53 / 9                         | lebeg, 10. sor                | 53 / 9                        | a lista mellett, nincs       | 0               |
| 375x812  | 85 / 41                        | lebeg, 10. sor                | 85 / 41                       | a lista mellett, nincs       | 0               |

A normál listán (1440x900) a lebegő gomb a lista közepén változatlanul sort takar, az a 21. szekció
szerint a gomb alá görgethető (nem új viselkedés). A gomb megnyomása után az utolsó sor alja
minden méreten a lista alján (0 pixel). **A 900x1000-es lista 79 pixel** a 2026-09-25-i
"rajz összehúzódik" döntés miatt (research `2026-09-24-jovahagyas-panel-helye.md` 12. szekció),
előtte 53. **1440x600-on** ugyanez a döntés a transcript panelt a tartalma minimuma alá szűkíti
(105 pixel a 143 helyett), tehát a transcript burkolója görget, és az utolsó sor az ablakban 0,34
arányban látszik (előtte 1); ez a jelzés formájától független. **Lezárva** (user döntés
2026-09-26, "a kérdés az első", SPEC-008 14.1 O-16): így marad, a testvér esettel együtt (375x667,
"Transcript" fül: a transcript panel 93 pixel, 0 látható sor; research
`2026-09-24-jovahagyas-panel-helye.md` 13. szekció).

**Regresszió** (`apps/web/e2e/sse-real-server.spec.ts`, két témában): szűk listán (900x1000, a
látott jóváhagyás mellett) a gomb `position: static`, teljesen látszik, egyetlen sort sem takar
(`rowsUnderJumpButton`), a lista helye és magassága a megjelenésekor nem változik, és a gomb az
aljára visz; normál listán (1440x900) a gomb `position: absolute`, a lista tetején, a felső
margóban lebeg. A `20d8620` kódján a szűk lista 2/2 esete bukik. Unit: `TranscriptPanel.spec.tsx`
(rögzített `ResizeObserver` jelentéssel: egy sornál kisebb tartalom dobozon a keret szűk alakja,
pontosan egy sornyin a lebegő), `is-compact-transcript-list.spec.ts`. A "görgetés látható
jóváhagyás mellett" e2e csoport (research `2026-09-24-jovahagyas-panel-helye.md` 12.7) 900x1000-en
a szűk alakkal futja végig a követést, a kinyitás szünetét, az ugrás gombot és a kézi
visszatérést.

**Képek:** a munkamenet `outputs/rajz-osszehuzodik/` mappájában, `elotte-ugras-gomb-*` és
`utana-ugras-gomb-*`, 900x1000 és 1440x900, két témában (a 12.8 szekció szerinti repón kívüli
futásból).
