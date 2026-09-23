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
ugyanezeket az értékeket adja, a build előtti forrás
<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/system/src/styles/style.css> és
<https://raw.githubusercontent.com/xyflow/xyflow/main/packages/react/src/hooks/useColorModeClass.ts>.

**Nem megerősített a dokumentáció szövegében**: hogy a `colorMode="system"` a
`prefers-color-scheme` media queryt figyeli, azt csak a forráskód mondja ki, a reactflow.dev
szövege nem. A javítás a `colorMode`-ot nem használja, tehát a döntés nem függ tőle.

## 3. A döntés: közös `--xy-*` blokk, `colorMode` nélkül

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

A blokk többi sora (él, kapcsolódási vonal, fogantyú, háttér minta, kijelölés) szintén
változatlan; a futás nézetben ezek eddig a könyvtár világos alapértékén álltak, mostantól a
szerkesztővel azonosak. Ez látható változás a futás nézet élein, fogantyúin és pontmintáján.

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
