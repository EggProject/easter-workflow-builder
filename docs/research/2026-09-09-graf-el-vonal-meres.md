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

## 6. Amit ez a mérés NEM zár le

- Kizárólag chromium ellen futott, mert az `apps/web/playwright.config.ts` ma csak azt
  definiálja. Firefox és WebKit: **nem ellenőrzött**.
- A sötét témás él a `--ep-border-strong` token szerint `rgba(255, 255, 255, 0.22)`, ami látható,
  de halvány. Hogy ez a szándékolt vizuális súly-e, az terméktervezési kérdés, nem mérési: a
  design system ezt a tokent adja az erős szegélyre, és kitalált szín bevezetése tilos.
