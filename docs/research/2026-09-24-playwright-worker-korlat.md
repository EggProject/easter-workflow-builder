# Playwright worker korlát, 2026-09-24

Kérdés: a user szó szerinti kérése ("A Playwright teszteknél maximum három worker futhat. Több
nem, lokál. CI-ban futhat több is, mert az elviseli.") előtt igazolni kell három tényt a
pinelt `@playwright/test@1.62.1` (`docs/research/2026-08-26-toolchain.md`) ellen: mit fogad és
mi az alapértéke a `workers` config opciónak, hogyan ismeri fel a config a CI környezetet és
állítja-e be a GitHub Actions a `CI` env változót, és felülírja-e a `--workers` CLI kapcsoló a
configot. Minden pont két független forrással: a hivatalos playwright.dev doksi ÉS a telepített
csomag saját forrása/típusdefiníciója.

---

## 1. A `workers` config opció: mit fogad, mi az alapértéke

**Forrás 1 (hivatalos doksi):** <https://playwright.dev/docs/api/class-testconfig> és
<https://playwright.dev/docs/test-cli>. A `testConfig.workers` leírása szó szerint: "The maximum
number of concurrent worker processes to use for parallelizing tests. Can also be set as
percentage of logical CPU cores, e.g. `'50%'.`" A CLI táblázat szerint: "`-j` or `--workers` -
Number of concurrent workers or percentage of logical CPU cores, use 1 to run in a single worker
(default: 50%)."

**Forrás 2 (telepített csomag, `node_modules/.bun/playwright@1.62.1/node_modules/playwright/`):**

- A típusdefiníció (`types/test.d.ts`, 1998-2020. sor) szó szerint: "The maximum number of
  concurrent worker processes to use for parallelizing tests. Can also be set as percentage of
  logical CPU cores... Defaults to half of the number of logical CPU cores." Típus: `workers?:
number|string;`
- A CLI saját forrása (`lib/program.js`, 228. sor) szó szerint: `"-j, --workers <workers>",
{ description: "Number of concurrent workers or percentage of logical CPU cores, use 1 to run
in a single worker (default: 50%)" }`.

**Válasz:** a `workers` szám vagy százalék string (`'50%'`) lehet. Alapértéke (ha sem a config,
sem a CLI nem adja meg) **a logikai CPU magok fele**, mind lokálisan, mind CI-ban - a Playwright
maga NEM különbözteti meg a két környezetet automatikusan, ezt a projekt saját configjának kell
kifejezetten megtennie (lásd 2. szekció).

---

## 2. CI felismerés a configban, és a GitHub Actions `CI` env változója

**Forrás 1 (hivatalos doksi):** <https://playwright.dev/docs/test-parallel> és
<https://playwright.dev/docs/ci>, mindkettő ugyanazt a mintát dokumentálja szó szerint:

```ts
export default defineConfig({
  // Limit the number of workers on CI, use default locally
  workers: process.env.CI ? 2 : undefined,
});
```

A `docs/ci` "Workers" szekciója szó szerint: "We recommend setting workers to \"1\" in CI
environments to prioritize stability and reproducibility... However, if you have a powerful
self-hosted CI system, you may enable parallel tests." A `docs/test-configuration` oldal
ugyanezt a `process.env.CI` mintát ismétli a `forbidOnly`, a `retries` és a `webServer.
reuseExistingServer` mezőn is. Tehát a `process.env.CI` egy egyszerű, a projekt configja által
kézzel kiértékelt jelző, nem beépített Playwright mechanizmus.

**Forrás 2 (GitHub hivatalos doksi, két önálló GitHub oldal):**

- <https://docs.github.com/en/actions/reference/workflows-and-actions/variables> "Default
  environment variables" táblázata szó szerint: "`CI` - Always set to `true`. You can use this
  variable to differentiate when tests are being run locally or by GitHub Actions." Megjegyzi
  azt is, hogy a `CI` érték (a `GITHUB_*`/`RUNNER_*` változóktól eltérően) felülírható a
  workflow-ban, de ez "not guaranteed" marad támogatottnak.
- <https://github.blog/changelog/2020-04-15-github-actions-sets-the-ci-environment-variable-to-true/>
  (hivatalos GitHub changelog, 2020-04-15): "The GitHub Actions runner now sets the `CI=true`
  environment variable by default."

**Válasz:** a Playwright config a `process.env.CI` (illetve a projekt saját stílusában
`process.env['CI']`) jelenlétét/igazságértékét olvassa ki kézzel, ezt dokumentálja a hivatalos
doksi minden példája. A GitHub Actions minden futtatáson **mindig** beállítja a `CI=true` env
változót, tehát a repó `.github/workflows/ci.yml` alatt futó minden job a `Boolean(process.env
['CI'])` ágat kapja, hacsak a workflow explicit nem írja felül (a jelen workflow nem írja felül).

---

## 3. A `--workers` CLI kapcsoló felülírja-e a configot

**Forrás 1 (hivatalos doksi):** <https://playwright.dev/docs/api/class-testconfig>, a
`testConfig.tsconfig` mező leírása szó szerint kimondja a testvér-mechanizmust: "Ignored when
`--tsconfig` command line option is specified." Ugyanez a minta áll a `docs/test-cli`
`--add-reporter` sorára: "Unlike `--reporter`, this keeps the configured reporters instead of
replacing them" - vagyis a sima `--reporter` (és az azonos elvű, config-tükröző kapcsolók, mint a
`--workers`) LECSERÉLIK a configban megadott értéket, nem összegzik.

**Forrás 2 (telepített csomag forrása,
`node_modules/.bun/playwright@1.62.1/node_modules/playwright/lib/cli/testActions.js`, 113-141.
sor):** a `overridesFromOptions(options)` függvény szó szerint egy `overrides` objektumot épít,
benne `workers: options.workers` mezővel (141. sor), ami a config-betöltés UTÁN, az onnan jövő
értéket felülírva kerül alkalmazásra (`clearCache`/`runTestServerAction` és a teszt futtatás
egyaránt ezen az `overrides` objektumon megy át a config feloldásakor). Ha a `--workers` CLI
kapcsolót nem adják meg, `options.workers` értéke `undefined`, tehát az override nem hat, és a
config értéke marad érvényben.

**Válasz:** igen, a `--workers` CLI kapcsoló felülírja a configban megadott `workers` értéket
(mind a lokális, mind a CI-ágat), pontosan úgy, ahogy a `--tsconfig` is felülírja a
`testConfig.tsconfig` mezőt. Ez azt jelenti, hogy egy lokális `playwright test --workers=8`
hívás MEGKERÜLHETI a configban rögzített hármas korlátot - ez a config szintjén nem zárható ki
(a CLI mindig az utolsó szó), ezért a korlát valódi kikényszerítése emberi fegyelem kérdése:
a configban rögzített `3` az alapértelmezett, nem felülírt viselkedés lokálisan.

---

## Alkalmazott döntés

`apps/web/playwright.config.ts` `workers` mezője `Boolean(process.env['CI']) ? 1 : 3` (user
kérés 2026-09-24): a CI-ág (`1`) változatlan a korábbi, `docs/ci#workers` által ajánlott
értékhez képest, a lokális ág a korábbi, dokumentált alapértelmezés (logikai CPU magok fele)
helyett fix `3`-ra korlátozva. A korábbi kód a lokális ágon a `workers` mezőt teljesen kihagyta
(feltételes spread `...(Boolean(process.env['CI']) && { workers: 1 })`) az
`exactOptionalPropertyTypes` mellett `undefined` érték tilalma miatt (`tooling/tsconfig/
base.json`) - mivel most a lokális ágnak is van explicit értéke (`3`), ez a kényszer megszűnt,
a spread egyszerű ternary-re cserélve (SPEC-001 "Simplicity First" elve: a korábbi megoldás
csak azért kellett, mert a lokális ágnak nem volt értéke).

`apps/web/playwright.screenshots.config.ts` `workers: 1` értéke változatlan marad: ez már
eddig is megfelel a 3-as korlátnak, és a `fullyParallel: false` melletti explicit `1` a
képernyőkép sorrend determinizmusát szolgálja (lásd a fájl saját fejléc kommentje), nem a
worker szám korlátozását - a két cél véletlenül egybeesik.

A CI-ági workers érték (`1`) méretezése (kihasználható-e több worker egy erősebb CI gépen)
**nyitva marad**, a user kifejezett kérése szerint ("CI-ban futhat több is... ha elviseli, ott
majd meg kell nézni"): ehhez a tényleges CI futtatókörnyezet terhelhetőségét kellene mérni, ami
nem ennek a lépésnek a hatóköre. Lásd `.claude/CLAUDE.md` 11. szekció.

**Ezt a "nyitva marad" mondatot a lenti 4. szekció 2026-09-27-én felülírja**: a user döntése
szerint a CI-ági érték `2`-re változott, egyetlen zöld CI futással igazolva.

---

## 4. CI-ági mérés, 2026-09-27

A user két döntése ("2 legyen, azzal mérjük meg" és "Egy zöld futás elég") alapján a CI-ági
`workers` érték `1`-ről `2`-re változott. Ez a szekció a hozzá tartozó bizonyítékot rögzíti:
a GitHub-hosted runner erőforrásait, a helyi `CI=1` igazolást és a PR első CI futásának mérését.

### 4.1 A GitHub-hosted runner erőforrásai (publikus repó, `ubuntu-latest`)

**Forrás 1 (hivatalos doksi):** <https://docs.github.com/en/actions/reference/runners/github-hosted-runners>
"Standard GitHub-hosted runners for public repositories" táblázata szó szerint: `ubuntu-latest`
(és a vele azonos sorban álló `ubuntu-24.04`, `ubuntu-22.04`, `ubuntu-26.04`) - Linux, 4 CPU,
16 GB memória, 14 GB SSD tároló, x64. A táblázat felett a szöveg szó szerint: "Use of the
standard GitHub-hosted runners is free and unlimited on public repositories." Ugyanez a
táblázat szó szerint megismétlődik a
<https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/choose-the-runner-for-a-job>
oldalon is.

**Forrás 2 (hivatalos GitHub blog, 2024-01-17, Larissa Fortuna):**
<https://github.blog/news-insights/product-news/github-hosted-runners-double-the-power-for-open-source/>
szó szerint: "we now provide machines that are double their previous specification, with
4-vCPUs, 16 GiB of memory" - megerősítve, hogy a publikus repókon futó `ubuntu-latest` runner
4 vCPU-s, 16 GiB memóriájú gép, 2023. december 1. óta (korábban 2 vCPU volt).

**Válasz:** a repó publikus, tehát az `e2e` job (`runs-on: ubuntu-latest`) egy 4 vCPU-s,
16 GB memóriájú, 14 GB SSD tárolójú Linux gépen fut, ingyenesen és korlátlanul.

### 4.2 Helyi igazolás: `CI=1` mellett a config 2 workert ad

Parancs: `CI=1 bun x playwright test e2e/action-menu-opacity.spec.ts` (`apps/web` alatt, a
`workers` mező módosítása után, egyetlen Playwright folyamatként). A Playwright saját sora szó
szerint:

```
Running 2 tests using 2 workers
```

Mindkét teszt zöld (`2 passed (10.7s)`). Ez igazolja, hogy a `Boolean(process.env['CI']) ? 2 : 3`
kifejezés `CI=1` mellett ténylegesen `2`-t ad, függetlenül attól, hogy a valódi CI napló worker
sorát admin jog nélkül nem látjuk.

### 4.3 A PR első CI futásának mérése

- **PR:** [EggProject/easter-workflow-builder#15](https://github.com/EggProject/easter-workflow-builder/pull/15)
- **Run id:** `36287275308`
- **Merge commit SHA** (`refs/pull/15/merge`, a `GET /repos/.../pulls/15` végpont
  `merge_commit_sha` mezője): `b226753523c85c9a2850dc4fc6315d957d068ab4`
- **PR head SHA:** `bea701bb95a3c96f642ca0b6d711c5fd8fe8e680` (egyetlen commit, kizárólag
  `apps/web/playwright.config.ts`), **base SHA:** `67c06a2972e50c6070e1540c8c4ce674249a7b6f`
  (a `main` változatlan a futás alatt, tehát a tesztszám azonos az alap futáséval)
- **Eredmény:** `E2E` job `conclusion: success`, a `Run e2e tests` lépés `conclusion: success`
  (nem cache találat: a lépés ténylegesen 3m31s-ig futott, nem ~0s)

|                                                  | job (`E2E`)                 | `Run e2e tests` lépés       |
| ------------------------------------------------ | --------------------------- | --------------------------- |
| Alap (`36277905998`, `main` `67c06a2`, 1 worker) | 7m40s                       | 6m36s                       |
| Ez a futás (`36287275308`, 2 worker)             | 4m23s (02:01:44 - 02:06:07) | 3m31s (02:02:26 - 02:05:57) |

A job időtartama 42,8%-kal, a `Run e2e tests` lépés 46,7%-kal rövidebb 2 workerrel, ugyanazon a
tesztkészleten (a `main` a futás alatt nem változott, a PR kizárólag a `workers` értéket
módosítja). A jobs végpont
(`https://api.github.com/repos/EggProject/easter-workflow-builder/actions/runs/36287275308/jobs`)
hitelesítés nélkül olvasható volt, a job naplója (admin jog hiányában) nem.

### 4.4 Következtetés

A négy vCPU-s, 16 GB memóriájú publikus runner elviseli a 2 workert: a futás zöld, és a mérés
szerint gyorsabb is, mint 1 workerrel. A user "Egy zöld futás elég" döntése szerint ez az egy
mérés elegendő a `2` érték elfogadásához; a 3 vagy több worker kihasználhatósága (a runner 4
vCPU-jából elvileg még maradna kapacitás) továbbra sem mért kérdés, és nem tárgya ennek a
lépésnek.

---

## 5. CI runner váltás `blacksmith-2vcpu-ubuntu-2404`-re, 2026-09-27

A fenti 4. szekció mérése a GitHub-hosted, publikus repókon négy vCPU-s `ubuntu-latest` runneren
történt. A user kifejezett kérésére ("a github runner-t én kértem hogy állítsa át") a
`.github/workflows/ci.yml` mind a hat jobja (`gate` mátrix, `test`, `build`, `e2e`,
`coverage-comment`, `ci`) `blacksmith-2vcpu-ubuntu-2404` futtatóra vált (`d26d998` commit).

### 5.1 A Blacksmith runner erőforrásai

**Forrás 1 (hivatalos doksi):** <https://docs.blacksmith.sh/blacksmith-runners/overview>, "x64
Runners" szekció, "Ubuntu 24.04" tábla szó szerint: `blacksmith-2vcpu-ubuntu-2404` - 2 vCPU,
8 GB memória, 80 GB tároló. A `blacksmith-2vcpu-ubuntu-2404` tag az `x64 Runners` alatt áll, az
ARM sorok (`-arm` utótaggal) ettől külön szekcióban, más (6 GB/75 GB) értékekkel szerepelnek,
tehát a szóban lévő tag architektúrája x64.

**Forrás 2 és Forrás 3 törölve, nem független források voltak (2026-09-27, független
ellenőrzés nyomán javítva).** A <https://latchkey.dev/learn/runners/blacksmith-runners-explained>
(Daniel Zoghalchali) saját szövege szerint a táblázatot a Blacksmith dokumentációjából olvasta
("Everything in it was read from blacksmith.sh and docs.blacksmith.sh"), tehát ugyanazt a
forrást ismétli, nem attól független ellenőrzés. A
<https://apis.io/apis/blacksmith-sh/github-actions-runners/> a konkrét 8 GB / 80 GB számot nem
is közli, csak a vCPU mérettartományt (2-32) és az architektúra családokat nevezi meg, tehát a
memória- és tároló-állítást nem erősíti meg. Új keresés valódi független forrásra (a
Blacksmith saját domainjétől eltérő, nem a docs.blacksmith.sh tábláját idéző/másoló oldal)
nem talált olyat, ami a teljes állítást (2 vCPU, 8 GB, 80 GB, x64) együtt megerősítené. A
szabálykönyv 4. szekció 2. pontja szerint: **egy hivatalos forrás (Forrás 1) áll, második
független megerősítés nincs.**

**Válasz:** a `blacksmith-2vcpu-ubuntu-2404` runner 2 vCPU-s, 8 GB memóriájú, 80 GB tárolójú,
x64 architektúrájú gép, Ubuntu 24.04 image-en, Firecracker microVM-ben, bare-metal gaming CPU
alapú fizikai hardveren (a docs.blacksmith.sh Overview lapja szerint). Ez a 4. szekcióban mért
`ubuntu-latest` runnerhez (4 vCPU, 16 GB) képest fele vCPU-számot és fele memóriát jelent.

### 5.2 Nyitott kérdés: bírja-e a 2 vCPU-s runner a 2 Playwright workert

A 4. szekció következtetése ("a négy vCPU-s... runner elviseli a 2 workert") kifejezetten a
négy vCPU-s hardverre hivatkozott. Ez a Blacksmith runneren nem eleve igaz: fele a mag- és
memória-számmal a két worker közötti erőforrás verseny nagyobb lehet. **NYITVA marad, amíg egy
tényleges CI futás nem méri.** Mi a viselkedés addig: a `playwright.config.ts` `workers` mezője
változatlanul `Boolean(process.env['CI']) ? 2 : 3`, nem csökkentjük óvatosságból. Mi zárná le:
egy zöld CI `e2e` job ezen a PR-en, a "Run e2e tests" lépés tényleges (nem cache) lefutásával, a
job és a lépés időtartamának rögzítésével, összevetve a 4.3 alatti két méréssel.

### 5.3 A PR első CI futásának mérése

- **PR:** [EggProject/easter-workflow-builder#17](https://github.com/EggProject/easter-workflow-builder/pull/17)
- **Run id:** `36334506650`
- **Runner:** mind a tizenkét job `blacksmith-2vcpu-ubuntu-2404`-en futott, a `GET
.../actions/runs/36334506650/jobs` végpont `runner_name` mezője szerint (pl.
  `blacksmith-2vcpu-ubuntu-2404-Runner-a7af74d607`, `...-cb08add2ae`), a `labels` mezőben
  `["blacksmith-2vcpu-ubuntu-2404"]`. A jobok a queue-olás nélkül, azonnal `in_progress`
  állapotba kerültek: a `created_at` és a `started_at` között mért különbség jobonként
  eltér, 9-17 másodperc a tartománya (a `gate` mátrix lábai, a `test` és a `build` 16-17,
  az `e2e` 10, a `coverage-comment` és az összesítő `ci` 9 másodperc után indult, a GET
  .../actions/runs/36334506650/jobs végpont `created_at` és `started_at` mezői szerint),
  tehát a Blacksmith GitHub App telepítve van és működik.
- **Eredmény:** mind a tizenkét job (a `gate` mátrix hét lába: `format`, `typecheck`, `lint`,
  `docs`, `casing`, `graph`, `db-drift`, valamint `test`, `build`, `e2e`, `coverage-comment` és
  az összesítő `ci`) `conclusion: success`.
- **`test` job:** a `Test` lépés (a `bun run test`, tehát a teljes Vitest suite `--coverage`
  mellett) `16:47:31` - `16:49:31`, **2m 0s**. A job zöld záró állapota igazolja a 100 százalékos
  lefedettségi küszöböt is mind a négy metrikán, mert a `test.sh` wrapper a küszöb alatt nem
  nulla kilépési kóddal állna.
- **`e2e` job:** a `Run e2e tests` lépés `16:48:17` - `16:51:32`, **3m 15s** (nem cache találat:
  a lépés ténylegesen ennyi ideig futott, nem ~0s). A teljes `E2E` job **3m 54s**.

|                                                          | job (`E2E`) | `Run e2e tests` lépés |
| -------------------------------------------------------- | ----------- | --------------------- |
| `ubuntu-latest`, 1 worker (`36277905998`)                | 7m40s       | 6m36s                 |
| `ubuntu-latest`, 2 worker (`36287275308`)                | 4m23s       | 3m31s                 |
| `blacksmith-2vcpu-ubuntu-2404`, 2 worker (`36334506650`) | 3m54s       | 3m15s                 |

### 5.4 Következtetés

**A NYITVA jelölés lezárva.** A 2 vCPU-s, feleannyi magú Blacksmith runner a 2 Playwright
workert nem csak elviseli, hanem a `Run e2e tests` lépés rajta **gyorsabb** (3m15s), mint a
korábbi, duplán annyi magú (4 vCPU-s) `ubuntu-latest` runneren ugyanazzal a 2 workeres
beállítással (3m31s). A `test` job (teljes Vitest suite, 100 százalékos lefedettségi küszöb mind
a négy metrikán) is zölden, 2 perc alatt lefutott. A magyarázat a Blacksmith saját, hivatalos
állítása szerint a bare-metal gaming CPU-k magasabb egyszálú teljesítménye (5.1 szekció,
`docs.blacksmith.sh` "significantly higher single-thread performance"), amivel a fele magszám
nem jelent tényleges lassulást ezen a terhelésen. A `playwright.config.ts` CI-ági `workers: 2`
értéke emiatt változatlan marad, csökkentésre vagy a mérés megismétlésére nincs szükség.
