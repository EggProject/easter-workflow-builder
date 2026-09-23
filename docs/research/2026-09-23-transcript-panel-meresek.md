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
