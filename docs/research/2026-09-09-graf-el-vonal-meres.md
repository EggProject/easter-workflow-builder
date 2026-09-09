# A gráf éleinek kifestett vonala: bisect és pixel mérés

Dátum: 2026-09-09. Környezet: chromium (`@playwright/test` a pinelt verzión), 1440x900 viewport,
`deviceScaleFactor: 1`, a `vite build` kimenetét kiszolgáló `vite preview`.

A felhasználó bejelentése: a gráf szerkesztőben eltűntek a csomópontokat összekötő vonalak,
világos és sötét témában egyaránt, és a bizonyítéka a szállított képernyőképek voltak.

---

## 1. A kérdés

Van-e olyan commit a `feat/spec-008-grafszerkeszto` ágon, ami elvette az élek kirajzolását, és ha
igen, melyik. A gyanú két, nem kért változtatásra irányult: a React Flow `--xy-*` változóinak a
design system `--ep-*` tokenjeire kötése, illetve a `body { color: ... }` szabály átemelése.

---

## 2. A mérés módja

Két, egymástól független mérés ugyanazon a felületen, mindkettő valós böngészőben, a VALÓS
alkalmazás gráfalakján (vízszintes lánc, azonos magasságban álló csomópontok), a REST és az SSE
hívások `page.route()` mockján:

1. **Számított stílus.** A `.react-flow__edge-path` elem `stroke`, `stroke-width`, `opacity`,
   `visibility`, `display` értéke, a befoglaló doboza, és a `--xy-edge-stroke`, illetve
   `--ep-border-strong` custom property értéke.
2. **Kifestett pixel.** Ugyanarról a kis területről (a két csomópont közötti szakasz közepe,
   16x17 CSS pixel) két képernyőkép, egyszer az éllel, egyszer az él útvonalát
   `display: none` alá rejtve, majd a két kép legnagyobb csatorna eltérése. Ez a metrika immunis
   a React Flow háttér pontmintájára, mert az mindkét képen ugyanott áll.

---

## 3. Az eredmény: nincs olyan commit

Ugyanaz a mérés lefutott a jelenlegi `HEAD` (`06ec41f`) és a `887f50b` commit ellen. A `887f50b`
azért ez a második pont, mert az utána következő commitok a gyanús változtatások, és a `887f50b`
utáni állapotról készült az utolsó olyan képernyőkép, amin a vonalak még látszottak.

| Commit    | Téma    | `stroke`                    | `stroke-width` | `opacity` | `visibility` | `--xy-edge-stroke` |
| --------- | ------- | --------------------------- | -------------- | --------- | ------------ | ------------------ |
| `887f50b` | világos | `rgb(10, 18, 48)`           | `1px`          | `1`       | `visible`    | `#0a1230`          |
| `887f50b` | sötét   | `rgba(255, 255, 255, 0.22)` | `1px`          | `1`       | `visible`    | `#ffffff38`        |
| `06ec41f` | világos | `rgb(10, 18, 48)`           | `1px`          | `1`       | `visible`    | `#0a1230`          |
| `06ec41f` | sötét   | `rgba(255, 255, 255, 0.22)` | `1px`          | `1`       | `visible`    | `#ffffff38`        |

A négy sor bájtra azonos a két commit között. A `--xy-edge-stroke` értéke mindkét témában
pontosan a `--ep-border-strong` design system token értéke, tehát az él színe nem háttér tokenre
került. A pixel mérés a `HEAD` ellen: **legnagyobb csatorna eltérés világos témában 236, sötétben
53** (mindkét témában 48 megváltozott pixel a 16x17-es kivágatban). A vonal tehát mindkét témában
ténylegesen ki van festve.

Kiegészítő, tisztán forrásból igazolt tények, amik ugyanezt támasztják alá:

- A `--xy-*` blokk a `16ed848` commitban került be (2026-09-06 00:18), tehát MEGELŐZI azokat a
  képernyőképeket, amiken a vonalak még látszottak. Nem lehet a hiba oka.
- A `887f50b` óta összesen négy CSS fájl változott (`node-inspector.css`, `button-group.css`,
  `textarea.css`, `topnav-shell.css`), egyik sem hivatkozik SVG elemre vagy `--xy-*` változóra.
- A `packages/ui/src/design-token/` fa 2026-09-05 óta változatlan.

**Következtetés: az alkalmazás soha nem vesztette el az éleket.** A szállított képernyőképeken
azért nem volt vonal, mert a képernyőkép készítő fixtúrája (a repón kívüli, eldobható script) tíz
csomópontot és ÜRES `edges` tömböt adott vissza a `readWorkflowGraph` mockon. Ahol nincs él, ott
nincs mit kirajzolni. A hiba a bizonyíték előállításában volt, nem a termékben.

---

## 4. Amit a meglévő e2e teszt nem fogott meg

Az `apps/web/e2e/graph-editor.spec.ts` egyetlen él állítása
`expect(page.getByTestId('rf__edge-e1')).toBeVisible()`. Ez két okból elégtelen:

1. A `toBeVisible()` a nem üres befoglaló dobozt és a `visibility` értéket nézi
   (<https://playwright.dev/docs/actionability#visible>), a VONAL SZÍNÉRŐL semmit nem állít.
2. Az ott használt fixtúra szándékosan átlós, mert egy vízszintes él befoglaló doboza 0 magas.
   A valós alkalmazás viszont épp vízszintes láncot rajzol, tehát a teszt pont azt az esetet
   kerüli meg, amit a felhasználó lát.

Mindkettő mérve. Az `apps/web/src/graph-editor/graph-editor.css` fájlhoz hozzáadott
`.react-flow__edge-path { stroke: var(--ep-bg-sunken); }` szabály mellett, azaz amikor a vonal
pontosan a háttér színével fest:

| Mérés                                          | Világos | Sötét |
| ---------------------------------------------- | ------- | ----- |
| Legnagyobb csatorna eltérés, ép állapot        | 236     | 53    |
| Legnagyobb csatorna eltérés, elrontott állapot | 0       | 1     |
| A meglévő `graph-editor.spec.ts` eredménye     | zöld    | zöld  |

A meglévő öt teszt az elrontott állapotban is végig zöld maradt.

---

## 5. Az új regressziós teszt

`apps/web/e2e/graph-edge-stroke.spec.ts`, két teszt (világos és sötét téma), vízszintes lánc
fixtúrán. A küszöb **24**: jóval a mért sötét témás 53 alatt (nem törékeny), és nagyságrenddel az
elrontott állapot 1 értéke felett (ténylegesen fog). A számot ez a mérés adja, nem becslés.

A teszt a fenti, szándékosan elrontott állapotban mindkét témában elbukik, a pixel mérés
állításánál (`0 >= 24`, illetve `1 >= 24`).

---

## 6. A gyökérok megszüntetése: a fixtúra és a képernyőkép készítés a repóba került

A 3. szekció megállapította, hogy a hiba a bizonyíték előállításában volt. A javítás ezt a
lehetőséget zárja be, nem egy tünetet javít:

| Ami korábban volt                                                  | Ami most van                                                         |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| a script a repón kívül, `/tmp/shots/` alatt                        | `apps/web/e2e/capture-screenshots.ts`, verziókövetve                 |
| a fixtúra a scriptbe ágyazva, munkamenetenként újraírva            | `apps/web/e2e/showcase-graph.ts`, verziókövetve, tizenegy éllel      |
| a fixtúrát semmi nem ellenőrizte                                   | `apps/web/e2e/showcase-graph.spec.ts` a `test:e2e` kapun             |
| a nagyítás a betöltéskori `fitView` prop, a panel megnyitása előtt | a panel megnyitása UTÁN a React Flow saját "Fit View" vezérlő gombja |
| a parancs munkamenetenként újra összerakva                         | `bun run screenshots`                                                |

**Miért az `apps/web/e2e/` a helye, és miért nem a `tooling/scripts`.** A `tooling/scripts` a zajos
parancsokhoz tartozó, token takarékos bash wrapperek és a teljes repóra vonatkozó konfigurációs
ellenőrzések helye; a képernyőkép készítés egyik sem. A `tools/*` egy önálló csomag lenne, aminek
importálnia kellene az `apps/web` e2e belső segédfüggvényeit, ami a rétegzés szerint tilos. Az
`apps/web/e2e` viszont már ma is birtokolja mindazt, amire a képernyőkép készítésnek szüksége van:
a Playwright felállást a `vite build` plusz `vite preview` webszerverrel és a kötelező `VITE_*`
konfigurációval, a REST és az SSE `page.route()` mockolást, és a `protocol` típusokat, amikre a
fixtúra épül. A capture fájl SZÁNDÉKOSAN nem `.spec.ts`, ezért a `playwright.config.ts`
alapértelmezett `testMatch` mintája nem veszi fel; kizárólag a `playwright.screenshots.config.ts`
futtatja, tehát a kilenc kapu és a `test:e2e` job ideje változatlan.

**A négy oszlop nem esztétikai döntés.** A React Flow `minZoom` alapértelmezése `0.5` (a szállított
`@xyflow/react@12.11.6` forrásában `minZoom = 0.5`), a `fitView` pedig
`zoom = szélesség / (tartalom * (1 + padding))` alakban számol. 1440x900-as ablakban, nyitott
beállítás panel mellett a vászon 1013 pixel széles, tehát a tartalom nem lehet szélesebb
1013 / (0.5 * 1.1) = 1842 pixelnél, különben a `fitView` a `minZoom`-on megáll, és a gráf jobb széle
levágódik. Négy oszlop a mért 358 pixeles kártyaszélességgel és a dagre alapértelmezett 50 pixeles
`ranksep` értékével 1582 pixel; a mért illesztési nagyítás 0.58 (panellel) és 0.83 (panel nélkül).

---

## 7. A per-él pixel mérés: miért kell mérési szonda, és honnan jön a küszöb

A 2. szekció mérése egyetlen, vízszintes élre és egy 16x17 pixeles, üres területre eső kivágatra
szólt. A bemutató fixtúra kilenc éle ennél változatosabb (átlós görbék, oszlopon belüli
visszakanyarodás), ezért a kivágat az él teljes befoglaló doboza, 8 pixel ráhagyással. Ezen a
nagyobb kivágaton a 2. szekció metrikája **nem dönt**, és ezt mérés mutatta ki.

**A kontroll mérés módja.** Az `apps/web/src/graph-editor/graph-editor.css` fájlhoz ideiglenesen
hozzáadott `.react-flow__edge-path { stroke: var(--ep-bg-sunken); }` szabály, azaz a vonal pontosan
a vászon háttérszínével fest. Mind a kilenc élen, mindkét témában, mindkét nézetben (panellel és
panel nélkül), tehát 36 mérés állapotonként.

| Állapot                    | Szonda nélkül | Szondával  |
| -------------------------- | ------------- | ---------- |
| hibás (háttérszínnel fest) | 1 ... 25      | 1 ... 3    |
| ép (a jelenlegi termékkód) | 16 ... 136    | 15 ... 136 |

**Szonda nélkül a két tartomány átfed** (a hibás állapot 25-ig felment, az ép állapot 16-ról
indult), tehát a mérés nem tudott dönteni. Az ok mérten azonosított: a nagyobb kivágat áthalad a
React Flow háttér pontmintáján és a csomópont kártyák árnyékán, ezeket pedig a háttérszínnel festő
(tehát hibás) él is ELTAKARJA, így az elrejtésekor újra előbukkannak, és ez önmagában eltérést ad.

**A szonda** ezért mindkét képernyőképen eltünteti a nem egyenletes hátteret: a pontmintát
`display: none`, a csomópont kártyákat és a vezérlő paneleket `visibility: hidden` alá teszi. A
`visibility` és nem a `display` azért, mert a `display: none` a React Flow méret figyelőjén át új
`dimensions` változást váltana ki, ami az élek geometriáját is elmozdíthatná a két felvétel között.
A szondával az él alatt egyetlen, egyenletes szín marad (`--ep-bg-sunken`), és a mérés pontosan azt
kérdezi, amit kérdeznie kell: elüt-e az él vonala a vászon hátterétől.

**A küszöb 8**, mert a mért hibás maximum 3 és a mért ép minimum 15 közé esik: több mint két és
félszerese az előbbinek, és nagyjából fele az utóbbinak. A szám nem becslés, a fenti táblázatból
származik. A helye: `apps/web/e2e/edge-paint-measurement.ts`,
`EDGE_PAINT_MINIMUM_CHANNEL_DIFFERENCE`.

**Az ép állapot mért értékei, nyitott beállítás panel mellett (0.58-as nagyítás), élenként:**

| Él                  | Világos | Sötét |
| ------------------- | ------- | ----- |
| `e-start-branch`    | 136     | 30    |
| `e-branch-fanout`   | 136     | 32    |
| `e-branch-agent`    | 136     | 30    |
| `e-branch-script`   | 136     | 30    |
| `e-fanout-loop`     | 72      | 16    |
| `e-agent-join`      | 136     | 30    |
| `e-script-approval` | 71      | 15    |
| `e-loop-join`       | 135     | 31    |
| `e-approval-join`   | 136     | 30    |

A két alacsonyabb érték (`e-fanout-loop`, `e-script-approval`) a két tökéletesen VÍZSZINTES él: a
0.58-as nagyításon az egy pixel vastag vonal két képpontsor között oszlik meg, tehát a
csúcsértéke arányosan kisebb. Mind a kilenc érték a küszöb felett van, mindkét témában.

**A regressziós teszt bukása igazolva.** A fenti, szándékosan elrontott állapotban a
`showcase-graph.spec.ts` mindkét témás pixel mérése elbukik, az első élnél
(`Expected: >= 8, Received: 1`, illetve `Received: 2`), miközben a fixtúra alakját őrző két
állítás és a "teljes gráf a vásznon belül" állítás zöld marad. A CSS visszaállítása után mind a
hat teszt zöld.

---

## 7/a. Frissítés 2026-09-10: a fixtúra végleges alakja tizenegy éllel, újramérve

A fenti 7. szekció mérése a bemutató fixtúra egy KORÁBBI, kilenc élű állapotán készült. Azóta a
fixtúra topológiája megváltozott: az `e-fanout-loop` és `e-script-approval` él eltűnt, helyette
az `n-fanout`, `n-script`, `n-approval` és `n-loop` csomópont mind közvetlenül a `n-join`
csomópontra köt (`e-fanout-join`, `e-script-join`, `e-approval-join`, `e-loop-join`), a
`n-branch` pedig közvetlenül az `n-approval` és az `n-loop` csomópontra is
(`e-branch-approval`, `e-branch-loop`). Az ok a `showcase-graph.ts` saját dokumentált
invariánsa: minden él szigorúan balról jobbra, szomszédos oszlopok között halad, egy
`fanout -> loop` közvetlen él viszont ugyanabban az oszlopban állna (mindkettő a 2. oszlopban),
ami a React Flow alapértelmezett handle-elrendezésén levágódó kanyart adna. A végeredmény
tizenegy él, minden csomópont bekötve.

**Ez a mérés a VÉGLEGES, repóban lévő fixtúrát méri**, a `bun run test:e2e` kapun ténylegesen
lefutó `showcase-graph.spec.ts` konzolkimenetéből, nem becslésből. Az ép állapot mért értékei
(panel nyitva, 0.58-as illesztési nagyítás), mind a tizenegy élen:

| Él                  | Világos | Sötét |
| ------------------- | ------- | ----- |
| `e-start-branch`    | 136     | 30    |
| `e-branch-fanout`   | 136     | 30    |
| `e-branch-agent`    | 141     | 34    |
| `e-branch-script`   | 136     | 30    |
| `e-branch-approval` | 138     | 33    |
| `e-branch-loop`     | 136     | 30    |
| `e-fanout-join`     | 136     | 30    |
| `e-agent-join`      | 134     | 30    |
| `e-script-join`     | 136     | 30    |
| `e-approval-join`   | 134     | 30    |
| `e-loop-join`       | 136     | 30    |

Legkisebb mért érték 30 (sötét), legnagyobb 141 (világos, `e-branch-agent`) - mindkettő jóval a
**8**-as küszöb felett, tehát a küszöb a végleges topológián is helytálló.

**A szándékos rontás (háttérszínnel festő vonal) újra lefuttatva ugyanerre a fixtúrára**: a teszt
az első élnél (`e-start-branch`) elbukik, mielőtt a többi élt mérhetné (a `for` ciklusban álló
`expect` az első hibán megállítja a tesztet) - világos témában **1**, sötétben **2**, ami a 7.
szekció korábban dokumentált, hibás állapotra mért 1...3 tartományába esik. A teszt mindkét
témában elbukik (`Expected: >= 8, Received: 1`, illetve `Received: 2`), a fixtúra alakját őrző
két állítás (legalább öt él, minden csomópont bekötve) viszont zöld marad, mert azok a
`SHOWCASE_GRAPH` adatszerkezetét nézik, nem a kifestett pixelt. A CSS visszaállítása után mind a
hat teszt zöld.

---

## 8. Amit ez a mérés NEM zár le

- Kizárólag chromium ellen futott, mert az `apps/web/playwright.config.ts` ma csak azt
  definiálja. Firefox és WebKit: **nem ellenőrzött**.
- A sötét témás él a `--ep-border-strong` token szerint `rgba(255, 255, 255, 0.22)`, ami látható,
  de halvány. Hogy ez a szándékolt vizuális súly-e, az terméktervezési kérdés, nem mérési: a
  design system ezt a tokent adja az erős szegélyre, és kitalált szín bevezetése tilos.
