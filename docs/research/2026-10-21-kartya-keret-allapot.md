# A csomópont kártya állapot kerete (SPEC-008 21. kritérium)

**Dátum:** 2026-10-21
**Ág:** `feat/spec-008-kod-a-spechez`
**Környezet:** Node `v26.7.0`, Bun `1.4.0`, `@playwright/test@1.62.1` (a Playwright által telepített
chromium headless shell, revízió `1234`), a sandbox rootless konténere (`.claude/CLAUDE.md` 12.
szekció, `LD_LIBRARY_PATH` kerülő).

A user 2026-10-21-i döntései (a SPEC-008 6.2 "a kártya kerete is változik" mondatának
megvalósítása): a keret színe a `Badge` állapot variánsainak tokenjeiből jön; `pending` szaggatott;
`running` vastagabb, 2.4; `failed` és `rejected` 3 pixeles dupla vonal; a többi állapot a jelvény
tokenjének színe, folytonos vonal. A 3 pixel a legkisebb vastagság, amin a Chromium két vonalat
rajzol.

## 1. Miért pontosan 3 pixel (a dupla vonal határa)

| Tény                                                                                                                                                                                       | Forrás                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `BorderEdge::EffectiveStyle` a `double` stílust 3 pixelnél vékonyabb keretre `solid`-ra cseréli (`style == kDouble && width < 3`)                                                        | `third_party/blink/renderer/core/style/border_edge.cc`, a Chromium `main` ágán 2026-10-21-én lekérve (`https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/style/border_edge.cc`)                                      |
| A `DrawDoubleBoxSide` a vastagság `(thickness + 1) / 3` (egész osztás) részét adja a két vonalnak, a maradék a rés                                                                         | `third_party/blink/renderer/core/paint/box_border_painter.cc`, ugyanott, a `main` `32e2d258b175a85b2cbce243c4080094456fe2ae` fején (`https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/paint/box_border_painter.cc`) |
| A CSS Backgrounds 3 a `double` értéket "két párhuzamos, folytonos vonal köztük hellyel" alakban írja le, a vonalak vastagságát nem rögzíti ("The thickness of the lines is not specified") | <https://www.w3.org/TR/css-backgrounds-3/#border-style>                                                                                                                                                                                                             |

A két Chromium forrás ugyanabból a tárból jön, tehát nem független megerősítés egymásnak; a
független megerősítés a saját mérés (2. szekció), a spec pedig kimondja, hogy a vastagság
megoldása a megvalósításra marad. **Nem ellenőrzött:** a telepített chromium fordítási
alapjának pontos forrás revíziója (a mérés a telepített binárisra vonatkozik, a forrás a `main`
ágra); Firefox és WebKit ellen nem futott mérés, mert az `apps/web/playwright.config.ts` ma
kizárólag chromiumot definiál.

## 2. A mérés: hány vonalat rajzol a Chromium, vastagságonként

`apps/web/e2e/graph-node-card-border.spec.ts`, "a dupla vonal határa 3 px" teszt, mindkét témában.
A `failed` kártya `--graph-node-card-border-width` értéke egyenként felülírva, a kártya felső
keretén átmenő pixel oszlop vonal futamainak száma (a rajz nagyítása 2, tehát egy CSS pixel két
képpont):

| Vastagság | Vonal futamok (világos) | Vonal futamok (sötét) |
| --------- | ----------------------- | --------------------- |
| 1px       | 1                       | 1                     |
| 2px       | 1                       | 1                     |
| 2.4px     | 1                       | 1                     |
| 3px       | 2                       | 2                     |
| 4px       | 2                       | 2                     |

A 3 pixeles `failed` kártyán az első vonal 2 képpont (1 CSS pixel, azaz a vastagság harmada), a rés
pixele és a vonal pixele közti legnagyobb csatorna távolság 199 (világos) és 213 (sötét).

## 3. A kártya keretének mért festése

Ugyanaz a spec, a futás nézet egy csomópontos fixtúráján (`run-view-stream.ts`), 1440x900,
`deviceScaleFactor: 1`, a vászon nagyítása 2 (a `fitView` felső korlátja, a teszt előfeltételként
ellenőrzi). Memóriában mért képernyőkép, lemezre nem íródik.

| Állapot     | Mért                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pending`   | a felső keret egy sorában 101 (világos) és 60 (sötét) vonal és háttér váltás: szaggatott                                |
| `succeeded` | 0 váltás, egy vonal futam, 2 képpont vastag                                                                             |
| `running`   | egy vonal futam, 4 képpont vastag (a `succeeded` 2 képpontjának kétszerese: a 2.4 pixelt a Chromium 2 pixelre kerekíti) |
| `failed`    | két vonal futam, köztük a kártya háttere                                                                                |

A vonal pixel színe mind a négy állapotra pontosan a várt token (a `--ep-border`, `--ep-info`,
`--ep-danger`, `--ep-success`, feloldva), a legnagyobb csatorna eltérés 0 mindkét témában.

**Kontraszt a kártya hátterével** (legnagyobb csatorna távolság a vonal és a kártya háttere közt):
`succeeded` 208 (világos) és 181 (sötét); `pending` 60 (világos) és 20 (sötét); `cancelled`
(`--ep-ink-900`, a `Badge` `ink` variánsának háttere, mindkét témában ugyanaz) 245 (világos) és 17
(sötét). A sötét téma `pending` és `cancelled` kerete tehát halvány, a user döntése szerinti
tokenekkel; ezt a döntés nem módosítja.

## 4. Szándékos rontások (a teszt elbukik)

A `graph-node-card.css` egy-egy módosítása, a spec 10 tesztjéből:

| Rontás                                             | Eredmény      |
| -------------------------------------------------- | ------------- |
| `failed` és `rejected` `double` helyett `solid`    | 2 teszt bukik |
| `failed` és `rejected` vastagsága 3px helyett 2px  | 2 teszt bukik |
| `pending` `dashed` helyett `solid`                 | 2 teszt bukik |
| `running` vastagsága 2.4px helyett 1px             | 2 teszt bukik |
| `danger` keretszín `--ep-warning` tokenre cserélve | 2 teszt bukik |

Az utolsó rontás elfogásához kellett a "vonal pixel pontosan a token színe" állítás: a besorolás
a három ismert szín legközelebbi tagját választja, és a figyelmeztető narancs közelebb áll a
veszély pirosához, mint a kártya hátteréhez, tehát a puszta vonal futam szám a rontást nem
látta (a csere után 10/10 zöld maradt, amíg a színtávolság állítás nem került bele).
