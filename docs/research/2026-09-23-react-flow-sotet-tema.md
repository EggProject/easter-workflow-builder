# A React Flow vászon sötét témája: vezérlő gombok és attribúció

Dátum: 2026-09-23. Minden szám saját, most futtatott mérés a pinelt `@xyflow/react@12.11.6` és
`@playwright/test@1.62.1` (chromium, 1440x900) ellen, hacsak a sor mást nem mond. A nem saját
mérésből származó állításoknál a forrás URL-je vagy a telepített csomag fájlja áll.

## 1. A hiba és a gyökérok

**Tünet.** Sötét témában a futás nézet vásznán a bal alsó vezérlő gombok (nagyítás, kicsinyítés,
illesztés, lakat) fehér dobozt festenek, a jobb alsó "React Flow" attribúció szürke dobozban áll.

**Mérés előtte.** Eldobható mérő script a repón kívül (a `screenshot-pipeline` invariáns miatt),
a buildelt `apps/web` ellen, minden REST hívás mockolva. Pontok: a gomb belseje (bal szél plusz
3px, függőleges közép, az ikontól távol), az attribúció doboza (bal felső sarok plusz 1px, a
paddingban), a vászon háttere (a vezérlőktől 40px-re jobbra).

| vászon és téma       | gomb pixel  | attribúció pixel | vászon pixel | a `.react-flow` osztálya |
| -------------------- | ----------- | ---------------- | ------------ | ------------------------ |
| szerkesztő, világos  | 255,255,255 | 255,255,255      | 246,243,235  | `react-flow light`       |
| szerkesztő, sötét    | 27,30,36    | 27,30,36         | 11,13,18     | `react-flow light`       |
| futás nézet, világos | 254,254,254 | 251,249,245      | 246,243,235  | `react-flow light`       |
| futás nézet, sötét   | 254,254,254 | 133,134,137      | 11,13,18     | `react-flow light`       |

**A szerkesztő NEM volt hibás**: a 2026-09-05-i javítás (`graph-editor.css`) ott már a design
system tokenjére kötötte a `--xy-*` változókat, és egy meglévő e2e teszt
(`graph-editor.spec.ts`, "a React Flow vezérlő gombjai a design system tokenjeire vannak
témázva") őrizte. A hiba kizárólag a futás nézetben állt.

**Gyökérok.** A `--xy-*` blokk a `.graph-editor-canvas` szelektoron állt, tehát csak a szerkesztő
konténerén öröklődött. A futás nézet vászna (`RunGraphCanvas`, T-009-20) később érkezett, saját
`.run-graph-canvas` konténerrel, amire a blokk nem vonatkozott, ezért ott a React Flow szállított
világos alapértelmezése festett: `--xy-controls-button-background-color-default: #fefefe` (a
mért 254,254,254) és `--xy-attribution-background-color-default: rgba(255, 255, 255, 0.5)` (a
sötét vásznon a mért 133,134,137). A `colorMode` prop egyik vásznon sincs megadva, tehát a gyökér
osztálya mind a négy esetben `react-flow light`.

## 2. A React Flow sötét téma mechanizmusa, két forrásból

**Hivatalos dokumentáció.**

- <https://reactflow.dev/learn/customization/theming>: a témázás a könyvtár CSS változóinak
  felülírásával megy ("you can override some of the CSS variables we use throughout the
  library"); a `-default` végű változók a beépített alapértékek ("These variables are used to
  define the defaults for the various elements"); a táblázat a
  `--xy-controls-button-background-color-default` értékét `#fefefe`-nek, a
  `--xy-attribution-background-color-default` értékét `rgba(255, 255, 255, 0.5)`-nek adja. A
  `colorMode` esetén "React Flow adds a class to the root element".
- <https://reactflow.dev/api-reference/react-flow>: a `colorMode` prop ("Controls color scheme
  used for styling the flow"), alapértéke `'light'`.
- <https://reactflow.dev/api-reference/types/color-mode>: `ColorMode = 'light' | 'dark' |
'system'`.

**A telepített csomag forrása** (`node_modules/.bun/@xyflow+react@12.11.6+*/node_modules/@xyflow/react/`).

- `dist/style.css` 3-52. sor: a `.react-flow` szelektor a világos `-default` palettát adja
  (`--xy-controls-button-background-color-default: #fefefe`,
  `--xy-attribution-background-color-default: rgba(255, 255, 255, 0.5)`).
- `dist/style.css` 53-98. sor: a `.react-flow.dark` szelektor a sötét `-default` palettát adja
  (`#2b2b2b` a gombon, `rgba(150, 150, 150, 0.25)` az attribúción, `#141414` a vászon
  hátterén).
- `dist/style.css` 316-325. és 415-436. sor: az attribúció és a vezérlő gomb háttere
  `var(--xy-<név>, var(--xy-<név>-default))` láncon olvas, tehát a nem `-default` változó
  mindig nyer a `-default` felett; az attribúció linkje fix `color: #999`.
- `dist/esm/index.mjs` 332-359. sor (`useColorModeClass`) és 3767-3775. sor (`ReactFlow`): a
  `colorMode` alapértéke `'light'`, a feloldott osztály a gyökér `className`-jébe kerül
  (`cc(['react-flow', className, colorModeClassName])`), `'system'` esetén a
  `prefers-color-scheme: dark` media query dönt.

**Független harmadik megerősítés.** A publikált build <https://unpkg.com/@xyflow/react@12.11.6/dist/style.css>
ugyanezeket az értékeket adja. A build előtti forrásban az értékek KÉT fájlban állnak: a vezérlő
gomb `-default` változói (`#fefefe` világos, `#2b2b2b` sötét) a
<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/styles/style.css>
fájlban, az attribúció háttér változója (`rgba(255, 255, 255, 0.5)` világos,
`rgba(150, 150, 150, 0.25)` sötét) és a link fix `#999` színe viszont NEM ott, hanem a
<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/styles/init.css>
fájlban: a `style.css`-ben az `attribution` szóra nulla találat van (mindkét fájl lekérve
2026-09-23-án, a `main` ágról). A `colorMode` feloldása:
<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/src/hooks/useColorModeClass.ts>.

**Nem megerősített a dokumentáció szövegében**: hogy a `colorMode="system"` a
`prefers-color-scheme` media queryt figyeli, azt csak a forráskód mondja ki, a reactflow.dev
szövege nem. A javítás a `colorMode`-ot nem használja, tehát a döntés nem függ tőle.

## 3. A döntés: közös `--xy-*` blokk, `colorMode` nélkül

**Részben felülírva, lásd a 6. szekciót.** A közös fájlban mára KIZÁRÓLAG a vezérlő gomb és az
attribúció sorai állnak (az alábbi táblázat hét sora); az él, a kapcsolódási vonal, a fogantyú, a
pontminta és a kijelölés sorai visszakerültek a `graph-editor.css`-be, mert a futás nézetre
átvéve annak élét és pontmintáját elhalványították.

A `--xy-*` blokk a `graph-editor.css`-ből a közös `apps/web/src/graph-editor/graph-canvas-theme.css`
fájlba költözött, `.graph-canvas-theme` osztályon, és MINDKÉT vászon konténere viseli
(`GraphEditorCanvas`, `RunGraphCanvas`), mindkettő importálja a fájlt.

**Miért nem a `colorMode` prop.** (1) A `colorMode="dark"` csak a `-default` palettát cseréli a
könyvtár saját hex értékeire (`#2b2b2b`, `#141414`, `rgba(150, 150, 150, 0.25)`), ezek nem a design
system tokenjei, és az attribúció linkje így is `#999` maradna. (2) A `var()` lánc miatt a mi
`--xy-*` felülírásaink minden általunk rajzolt elemen nyernek, tehát a `colorMode` ott hatástalan
lenne, egyetlen kivétellel: a `--xy-background-color-default` sötétben `#141414`, ami a futás
nézet (saját háttér nélküli) vásznára egy nem design system színt festene. (3) A téma mód állapota
a `packages/ui` `ThemeModeToggle` komponensén belüli `useThemeMode` hookban él, tehát a
`colorMode` szinkronizálása állapot kiemelést vagy a `data-theme` figyelését igényelné, látható
nyereség nélkül.

**Hogyan követi a témát ugyanabból a forrásból, élőben.** A `useThemeMode` a `<html>`
`data-theme` attribútumát írja (`applyThemeModeToDocument`), a `--ep-*` tokeneket a
`packages/ui/src/design-token/theme-dark.css` a `[data-theme="dark"]` szelektoron definiálja újra,
a `--xy-*` változók pedig `var(--ep-*)` hivatkozások. Az attribútum változásakor a böngésző a
kaszkádot újraszámolja, tehát a vászon JS nélkül, újratöltés nélkül vált.

**A token kötések.** Egyik sem új: a 2026-09-05-i szerkesztő javítás kötései, most mindkét
vásznon. Az indok a token saját kommentje a `packages/ui/src/design-token/theme-*.css` fájlokban.

| React Flow változó                             | token              | miért                                                     |
| ---------------------------------------------- | ------------------ | --------------------------------------------------------- |
| `--xy-controls-button-background-color`        | `--ep-bg-elevated` | a vezérlő a vászon fölött lebegő panel ("cards / panels") |
| `--xy-controls-button-background-color-hover`  | `--ep-bg-hover`    | "row / button hover"                                      |
| `--xy-controls-button-color` és `-hover`       | `--ep-fg`          | az ikon elsődleges előtér, a szállított `inherit` helyett |
| `--xy-controls-button-border-color`            | `--ep-divider`     | az egymás alatti gombok elválasztója                      |
| `--xy-controls-box-shadow`                     | `--ep-shadow-sm`   | a design system kis emelési árnyéka                       |
| `--xy-attribution-background-color`            | `--ep-bg-elevated` | ugyanaz a lebegő panel felület, mint a vezérlőé           |
| attribúció link `color` (a fix `#999` helyett) | `--ep-fg-subtle`   | "tertiary / meta" szöveg                                  |

A blokk többi sora (él, kapcsolódási vonal, fogantyú, háttér minta, kijelölés) ebben a lépésben
szintén a közös fájlba került; a futás nézetben ezek addig a könyvtár világos alapértékén álltak.
Ez a futás nézet élein, fogantyúin és pontmintáján NEM KÉRT, látható változás volt, amit a 6.
szekció visszavont.

## 4. Mérés utána

Ugyanaz a script, ugyanazok a pontok, a javított build ellen.

| vászon és téma       | gomb pixel előtte -> utána | attribúció pixel előtte -> utána |
| -------------------- | -------------------------- | -------------------------------- |
| szerkesztő, világos  | 255,255,255 -> 255,255,255 | 255,255,255 -> 255,255,255       |
| szerkesztő, sötét    | 27,30,36 -> 27,30,36       | 27,30,36 -> 27,30,36             |
| futás nézet, világos | 254,254,254 -> 255,255,255 | 251,249,245 -> 255,255,255       |
| futás nézet, sötét   | 254,254,254 -> 27,30,36    | 133,134,137 -> 27,30,36          |

A futás nézet attribúció linkjének színe `rgb(153, 153, 153)` (a fix `#999`) helyett világosban
`rgb(92, 105, 129)`, sötétben `rgb(164, 157, 140)`, azaz a `--ep-fg-subtle`. A téma váltó gomb
megnyomása után mind a négy esetben átvált a gomb számított háttere, oldal újratöltés nélkül.

## 5. Regressziós védelem

`apps/web/e2e/react-flow-theme.spec.ts`, mindkét vászonra: világos témában betölt, majd a téma
váltó gombbal sötétre vált. Mindkét témában a gomb belsejének és az attribúció dobozának
kifestett pixele PONTOSAN egyezik egy `var(--ep-bg-elevated)` hátterű mérő szonda pixelével
ugyanazon a képernyőképen, tehát küszöb szám nincs; a váltás után a gomb számított háttere
`expect.poll` alatt megváltozik. Szándékos rontással mérve (a futás nézet konténeréről levéve a
`graph-canvas-theme` osztályt) a futás nézet tesztje már a világos szakaszban elbukik (254,254,254
a várt 255,255,255 helyett), a szerkesztő tesztje átmegy.

## 6. Regresszió és javítás: a futás nézet éle és pontmintája (2026-09-23)

**A hiba.** A 3. szekció döntése a szerkesztő TELJES `--xy-*` blokkját tette közössé, nem csak a
kért vezérlő és attribúció sorokat. Egy független ellenőrzés mérte ki, hogy a futás nézet éle
sötét témában a harmadára gyengült, a pontmintája pedig mindkét témában gyakorlatilag eltűnt; a
szerkesztő változatlan maradt. Kapu nem fogta meg: a `react-flow-theme.spec.ts` csak a gombot és
az attribúciót méri, a `showcase-graph.spec.ts` csak a szerkesztő élét, a `bun run screenshots`
nem kapu, a közös 8-as él küszöb (`edge-paint-measurement.ts`) pedig a gyengült élt is
kifestettnek fogadta el.

**A javítás.** A közös `graph-canvas-theme.css` kizárólag a vezérlő gomb és az attribúció sorait
tartja (a 3. szekció táblázatának hét sora); az él, a kapcsolódási vonal, a fogantyú, a pontminta
és a kijelölés sorai szó szerint visszakerültek a `graph-editor.css` `.graph-editor-canvas`
blokkjába, ahol a `7229769` előtt álltak. A futás nézet ezeken ismét a React Flow szállított
alapértelmezését festi (él `#b1b1b7`, pont `#91919a`, `@xyflow/react@12.11.6` `dist/style.css` 6. és 24. sor; mért számított érték `rgb(177, 177, 183)` és `rgb(145, 145, 154)`). **Lezárt
termékdöntés (user, 2026-09-24):** a futás nézet éle és pontmintája mindkét témában ezen a React
Flow alapértelmezésen marad, design system tokent nem kap. A javítás tehát a nem kért változást
vonta vissza, és a visszaállított festés a végleges.

**A mérés módja.** Eldobható mérő spec a repón kívül (`/private/tmp/runview-vaszon/`, a
`screenshot-pipeline` invariáns miatt), valódi Chromium (`@playwright/test@1.62.1`), 1440x900,
a repó `showcase-graph.ts` bemutató futása és szerkesztője (tizenegy él, a "Fit View" gomb után;
illesztési nagyítás a futás nézetben 0.58, a szerkesztőben 0.83), három `vite build` a három
állapotról. Él: a `measureEdgePaintDifference` szondás mérése élenként, a táblázatban a
tizenegy él legkisebb és legnagyobb értéke. Pontminta: a teljes vászon kivágata, a csomópont, az
él és a panel mindkét képről `visibility: hidden` alatt, egyszer a pontmintával, egyszer
`.react-flow__background { display: none }` mellett, a két kép legnagyobb csatorna eltérése.
Gomb és attribúció: a 4. szekció pontjai.

| vászon, téma         | állapot                  | él (min..max) | pontminta | gomb pixel  | attribúció pixel |
| -------------------- | ------------------------ | ------------- | --------- | ----------- | ---------------- |
| futás nézet, világos | `7229769` előtt          | 21..40        | 21        | 254,254,254 | 251,249,245      |
| futás nézet, világos | `7229769`                | 69..136       | 4         | 255,255,255 | 255,255,255      |
| futás nézet, világos | javítás                  | 21..40        | 21        | 255,255,255 | 255,255,255      |
| futás nézet, sötét   | `7229769` előtt          | 47..95        | 29        | 254,254,254 | 133,134,137      |
| futás nézet, sötét   | `7229769`                | 15..31        | 6         | 27,30,36    | 27,30,36         |
| futás nézet, sötét   | javítás                  | 47..95        | 29        | 27,30,36    | 27,30,36         |
| szerkesztő, világos  | mindhárom állapot azonos | 193..198      | 7         | 255,255,255 | 255,255,255      |
| szerkesztő, sötét    | mindhárom állapot azonos | 43..47        | 11        | 27,30,36    | 27,30,36         |

A javítás után a futás nézet mind a tizenegy élének értéke élenként, bitre azonos a `7229769`
előtti állapotéval, mindkét témában; a szerkesztő élenkénti értékei mindhárom állapotban azonosak.
**Teljes képernyőkép összevetés** (az előtte és a javított build, pixelenként): a futás nézeten
kizárólag a bal alsó vezérlő és a jobb alsó attribúció területe tér el, plusz a transcript panel
csontváz területe, ami UGYANANNAK a buildnek két egymás utáni futása között is ugyanígy eltér
(animáció); a szerkesztőn csak ez utóbbi fajta, futásról futásra változó eltérés van.

**A szándékos rontás a küszöbhöz.** A futás nézet élének vonala a vászon háttérszínével festve
(`.react-flow__edge-path { stroke: <a mért háttér pixel> }`): élenként világosban 2..3, sötétben
1..2.

**A kapu teszt, nem kért változás elleni őr:** `apps/web/e2e/run-graph-paint.spec.ts`, a
`test:e2e` kapun, a futás nézet bemutató futásán, témánként egy él és egy pontminta teszt. A fenti
döntés miatt nem azt állítja, hogy ez a helyes festés, hanem azt, hogy a mostani festés ne
változzon kéretlenül (user döntés, 2026-09-24). A küszöbök a fenti táblázatból:

| állítás                 | küszöb | a legerősebb hibás állapot | az ép állapot legkisebb értéke | származtatás                                     |
| ----------------------- | ------ | -------------------------- | ------------------------------ | ------------------------------------------------ |
| él, világos             | 12     | 3 (háttérszínnel festő)    | 21                             | a 3 és a 21 egész felezőpontja                   |
| él, sötét               | 39     | 31 (`7229769`)             | 47                             | a 31 és a 47 felezőpontja                        |
| pontminta, mindkét téma | 13     | 6 (`7229769`, sötét)       | 21 (világos)                   | a 6 és a 21 egész felezőpontja, lefelé kerekítve |

Világosban a `7229769` éle ERŐSEBB volt az épnél (69..136), tehát ott az él küszöbe csak az
eltűnést és a háttérszínnel festést fogja; a világos regressziót a pontminta állítása fogja.
**Ez csak a teljes `7229769` visszaállításra igaz**: ha kizárólag az él festése változik, a
pontminta ép marad, és az él alsó korlátja sem bukik. A rést a 7. szekció zárja.

**A bukás igazolva.** A két CSS fájl a `7229769` állapotára visszaállítva, a spec a repó
Playwright configjával: négy tesztből három bukik (világos pontminta `Expected: >= 13, Received:
4`; sötét él `Expected: >= 39, Received: 15`; sötét pontminta `Expected: >= 13, Received: 6`), a
világos él átmegy (a fenti ok). A javított állapoton mind a négy zöld, élenként ugyanazokkal a
számokkal, mint a fenti mérés.

**Az őr ismert felbontási korlátja (2026-09-24).** Az őr nem minden kéretlen változást lát; ez a
korlát leírása, nem javítandó hiba. Egy független ellenőrzés mérése szerint, a teljes kaput
értve (a 7. szekció referencia összevetésével együtt):

- A referencia összevetés felső korlátja **6**, az ép állapot eltérése **0..2**.
- Világos témában egy közeli árnyalat átmegy: a **#a8a8ae** (a `#b1b1b7`-től csatornánként -9)
  legnagyobb eltérése **6**, a **#acacb2** (csatornánként -5) legnagyobb eltérése **4**.
- A **#babac0**, a **#a5a5ab** és a **#a9b1c1** **7**-tel bukik.
- Az él teljes elrejtését a referencia teszt NEM fogja meg, az alsó korlátos teszt igen.
- A pontminta `display: none` elrejtése nem az állításon bukik, hanem a szonda várakozásának
  időtúllépésén: a szonda a felvétel előtt a pontminta nem `none` számított `display` értékére
  vár (`expect.poll`).

**Saját ismétlés, a valódi kapu specen** (2026-09-24, a `run-graph.css` végére ideiglenesen írt
rontással, a repó Playwright configjával, egy futás változatonként): minden fenti pont
reprodukálódott. Az árnyalatok a `.run-graph-canvas { --xy-edge-stroke: <szín> }` szabállyal:
világosban a #a8a8ae 3..6, a #acacb2 2..4 (mindkettő zöld), a #babac0, a #a9b1c1 és a #a5a5ab az
első 7-es élen bukik. Sötét témában a #babac0 és a #a9b1c1 átmegy (legnagyobb eltérés 6), a
#a5a5ab ott is 7-tel bukik. A teljes elrejtést három módon mérve (a `.react-flow__edges` réteg, az
él `<g>` csoportja, illetve az útvonal `display: none` alatt) a referencia teszt mindhárom esetben
élenként 0-t mér és zöld, mert a kivágat az elrejtett útvonal üres befoglaló dobozából számolódik;
az alsó korlát `Received: 0`-val bukik. A `.react-flow__background { display: none }` rontás
mellett mind a hat teszt a szonda `Expected: not "none"` várakozásának 5000 ms-os időtúllépésén
bukik, mert az él mérés szondája is a pontminta visszatérésére vár.

## 7. Rés a futás nézet él kapuján: referencia festés összevetés (2026-09-23)

**A rés.** Egy független ellenőrzés két kísérlettel igazolta, hogy a 6. szekció él állítása
világos témában csak alsó korlát: (a) ha kizárólag a futás nézet éle kapja a `7229769` erősebb
festését (69..136 az ép 21..40 helyett), a teljes e2e készlet zöld; (b) ha a világos él a felére
gyengül (12..22), a teszt négyből négy zöld. A pontminta állítás egyik esetben sem bukik, mert a
pontminta ép marad.

**Miért nem felső korlát a meglévő mérésre.** A "látszik-e" mérés (él be, él ki) élenként más
értéket ad, és a gyengített él tartománya (világosban 12..21) az ép tartomány (21..40) alsó
szélével átfed, tehát egyetlen közös alsó-felső sáv sem választaná el a kettőt. Élenkénti mért
táblázat pedig minden geometria változásnál elavulna.

**A választott forma: referencia festés, élenként.** Ugyanarról a kivágatról két kép: a valós él,
és UGYANAZ a geometria a várt festéssel újrarajzolva. A várt festés a React Flow szállított
alapértelmezése, mert a futás nézet vásznán semmi nem írja felül a `--xy-edge-*` változókat, és
a gyökér osztálya `colorMode` nélkül mindkét témában `react-flow light`:
`--xy-edge-stroke-default: #b1b1b7`, `--xy-edge-stroke-width-default: 1`. Források: a telepített
`@xyflow/react@12.11.6` `dist/style.css` 6. és 7. sor; a publikált
<https://unpkg.com/@xyflow/react@12.11.6/dist/style.css>; a build előtti
<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/styles/init.css> 6. és 7. sor; a <https://reactflow.dev/learn/customization/theming> változó táblázata (`#b1b1b7`),
mind lekérve 2026-09-23-án.

A referencia szabály az útvonalat `all: initial` alá teszi, tehát semmilyen szerzői szabály
(osztály, `--xy-*` változó, átlátszóság, szűrő) nem hat rá; a geometriát a saját `d`
attribútumából kapja vissza (`d: path(...)`, mert az `all` a Chromiumban a `d` tulajdonságot is
alaphelyzetbe tenné), a festést kizárólag a várt szín és vastagság adja. Az ősökön (a közös
`.react-flow__edges` réteg, az él `<svg>` burkolója és `<g>` csoportja) az `opacity`, a `filter` és
a `mix-blend-mode` áll alaphelyzetben; `all: initial`-t nem kaphatnak, mert az a pozíciójukat is
elvenné. **A módszer elvi korlátja:** ami a közös `.react-flow__viewport` vagy afölötti ős
festését változtatja (az a csomópontokat is érinti), azt ez az összevetés nem látja.

**Mérés.** Eldobható mérő spec a repón kívül (`/private/tmp/feed-edge-meres/`, a
`screenshot-pipeline` invariáns miatt), valódi Chromium (`@playwright/test@1.62.1`), 1440x900, a
repó `showcase-graph.ts` bemutató futása, a kapu teszttel azonos segédfüggvénnyel
(`measureEdgeReferenceDifference`). A rontások futásidőben befecskendezett stíluslapként, négy
párhuzamos worker, tesztenként négy ismétlés, tizenegy él, tehát állapotonként és témánként 44
mérés. A táblázatban a legkisebb és a legnagyobb érték.

| állapot                                                           | világos: látszik | világos: referencia | sötét: látszik | sötét: referencia |
| ----------------------------------------------------------------- | ---------------- | ------------------- | -------------- | ----------------- |
| ép                                                                | 21..40           | 0..2                | 47..95         | 0..2              |
| (a) `--xy-edge-stroke: var(--ep-border-strong)` (a `7229769` éle) | 69..136          | 48..98              | 15..31         | 33..65            |
| (b) `stroke-opacity: 0.5` az útvonalon                            | 12..21           | 10..20              | 23..47         | 24..48            |
| (b) `opacity: 0.5` az útvonalon                                   | 12..21           | 10..20              | 23..47         | 24..48            |
| (b) `--xy-edge-stroke-width: 0.5`                                 | 12..20           | 11..21              | 23..47         | 24..48            |
| (b) `opacity: 0.5` az él `<g>` csoportján                         | 12..21           | 10..20              | 23..47         | 24..49            |
| (b) fél erősségű szín (`color-mix`, 50 százalék)                  | 11..20           | 10..20              | 23..47         | 24..49            |

A (b) sorok "látszik" értéke világosban (11..21) egyezik az ellenőrzés 12..22-es számával.

**Az ép állapot nem mindig 0.** Az ép 88 mérésből 58 volt 0, 12 volt 1, 18 volt 2. A 0-tól eltérő
pixelek mindig az él végpontjai körül, a csomópontok helyén állnak, és akkor is előfordulnak, ha
ugyanazt az állapotot kétszer fényképezzük le, a kettő között egy másik szonda állapottal: a
Chromium a szonda váltásakor csak a kivágat egy részét raszterizálja újra, és az újra
raszterizált rész széle 1..2 szinttel eltérhet. Mért, sikertelen kísérletek a zaj megszüntetésére
(mind a fenti futtatókörnyezetben): két `requestAnimationFrame` várakozás a felvétel előtt
(egymagában 264 összevetésből kettőben még eltért); két egymást követő, bitre azonos felvételig
várás (a Playwright `toHaveScreenshot` feltétele, "wait until two consecutive page screenshots
yield the same result", <https://playwright.dev/docs/api/class-pageassertions>), ami azonnal
teljesült, a zaj mégis megmaradt; az él elrejtése és visszahozása a felvétel előtt, ami rontott
rajta. A zaj tehát nem beálló, hanem a raszterezés előtörténetétől függ, ezért a pontos egyezés
helyett mért felső korlát kell.

**A küszöb.** Ép állapotban a legnagyobb érték 2, a legenyhébb rontás legkisebb értéke 10 (a
felére gyengített él, világos téma): a **6** a kettő egész felezőpontja, mindkét témára. A sötét
téma tartaléka nagyobb (a legkisebb rontás 24).

**A bukás igazolva, a valódi termék CSS-en.** A `run-graph.css` végére írt rontással, a repó
Playwright configjával (build plusz `vite preview`), a kapu specen:

| állapot                           | világos, referencia teszt     | sötét, referencia teszt       | sötét, meglévő alsó korlát |
| --------------------------------- | ----------------------------- | ----------------------------- | -------------------------- |
| ép                                | zöld (élenként 0..2)          | zöld (élenként 0..2)          | zöld                       |
| (a) `--xy-edge-stroke` rontás     | bukik, `<= 6`, `Received: 48` | bukik, `<= 6`, `Received: 33` | bukik (`15`)               |
| (b) `stroke-opacity: 0.5`         | bukik, `<= 6`, `Received: 11` | bukik, `<= 6`, `Received: 24` | bukik (`23`)               |
| (b) `--xy-edge-stroke-width: 0.5` | bukik, `<= 6`, `Received: 11` | bukik, `<= 6`, `Received: 24` | bukik (`23`)               |

A világos téma alsó korlátja és pontminta állítása mindhárom rontáson zöld marad: a rést
kizárólag az új állítás zárja. A teszt az első eltérő élen megáll, ezért a `Received` az első
bukó él értéke.

**Ami nyitva marad, javaslat, nem döntés.** A pontminta állítása ugyanígy egyoldalú (csak alsó
korlát); a felére gyengített pontmintát sötétben nem fogná. Ugyanez a referencia forma
átvihető rá, ha kérik.
