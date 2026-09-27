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
