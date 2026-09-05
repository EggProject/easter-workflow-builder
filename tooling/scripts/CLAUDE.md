# tooling/scripts

## Mi ez a mappa

Token takarékos bash wrapper scriptek a zajos parancsokhoz (SPEC-001 11. szekció). Minden
wrapper csak összegzést és a hibákat írja ki, a burkolt eszköz teljes kimenetét nem - azt
egy `.turbo/wrapper-logs/` alá mentett fájlba írja, és az útját csak hiba esetén nevezi
meg. A `src/index.ts` a csomag saját `typecheck` scriptjéhez kell (placeholder, a
wrapperek maguk bash fájlok, nem TypeScript).

## Fájlok

| Fájl                              | Tartalom                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_lib.sh`                         | közös függvények: `turbo run <task>` futtatása, JSON összegző beolvasása, hibasorok kinyerése ESLint és `tsc` kimenetből, csonkolás                                                                                                                                                               |
| `lint.sh`                         | `turbo run lint` burkoló                                                                                                                                                                                                                                                                          |
| `typecheck.sh`                    | `turbo run typecheck` burkoló                                                                                                                                                                                                                                                                     |
| `test.sh`                         | a Vitest közvetlen burkolója, coverage összegzővel - **nem** `turbo run test`-en keresztül, lásd lent                                                                                                                                                                                             |
| `build.sh`                        | `turbo run build` burkoló                                                                                                                                                                                                                                                                         |
| `format.sh`                       | a Prettier közvetlen burkolója, `--check` (alapértelmezett) és `--write` móddal - **nem** turbo taskon keresztül, mert a Prettier egyetlen futással a teljes repót fedi                                                                                                                           |
| `claude-md.sh`                    | ellenőrzi, hogy van-e `CLAUDE.md` ott, ahol a projekt szabálya szerint kötelező; a pontos szabályt a script fejléce írja le                                                                                                                                                                       |
| `casing.sh`                       | ellenőrzi, hogy a git indexben tárolt fájlnevek betűzése megegyezik-e a rájuk hivatkozó relatív importokéval; a tényleges logika `src/casing/find-casing-mismatches.ts`, a szabály indoklása a fájl fejlécében                                                                                    |
| `check-dependency-graph.sh`       | ellenőrzi, hogy a workspace függőségi gráfja aciklikus-e, és minden éle a SPEC-002 4. szekció rétegbesorolása szerint szigorúan csökkenő rétegszám felé mutat-e; a tényleges logika `src/dependency-graph/`                                                                                       |
| `e2e-coverage.sh`                 | az `apps/web` `coverage:e2e:report` scriptjének (`nyc report`) burkolója; **stdout: csak az nyc táblázat, stderr: fejléc és minden hiba** - lásd lent                                                                                                                                             |
| `db-drift.sh`                     | ellenőrzi, hogy a `packages/db` séma (a `.ts` tábla fájlok) és a commitolt `packages/db/drizzle` migrációk szinkronban vannak-e (SPEC-003 10.3 szekció, 15. szekció 36. kritérium); **stdout: csak összegzés, stderr: minden hiba** - lásd lent                                                   |
| `src/casing/`                     | téma mappa: a `casing.sh` mögötti tényleges ellenőrzés (`check-casing.ts`) és a rá épülő `.spec.ts` regressziós teszt                                                                                                                                                                             |
| `src/dependency-graph/`           | téma mappa: a `check-dependency-graph.sh` mögötti réteg-hozzárendelés (`package-layer.ts`), a `package.json`-ok beolvasása (`read-workspace-packages.ts`), a tiszta ellenőrző logika (`find-dependency-graph-violations.ts`, `.spec.ts`-sel) és a CLI belépési pont (`check-dependency-graph.ts`) |
| `src/turbo-e2e-coverage-outputs/` | téma mappa, megvalósítás fájl nélkül: a `turbo.json` `test:e2e` taskjának `outputs`/`inputs` invariánsát őrző `.spec.ts` regressziós teszt                                                                                                                                                        |
| `src/relative-import-extension/`  | téma mappa, megvalósítás fájl nélkül: a `packages/*/src` és az `apps/*/src` alatt minden relatív import kiterjesztéssel áll (SPEC-006 M-5, M-6, M-7, PLAN-007 T-007-3); a `casing` téma `findRelativeImportSpecifiers` függvényét hívja újra                                                      |
| `src/no-preserve-symlinks/`       | téma mappa, megvalósítás fájl nélkül: az `apps/server/src` és az `apps/server/package.json` scriptjei nem tartalmazzák a `--preserve-symlinks` kapcsolót (SPEC-006 3.6, M-4, PLAN-007 T-007-3)                                                                                                    |
| `src/no-em-dash/`                 | téma mappa, megvalósítás fájl nélkül: a repó saját (nem vendorolt) `.md`/`.ts`/`.tsx`/`.css` fájljai nem tartalmaznak em dash-t (gyökér `CLAUDE.md` 6. szekció); a `packages/ui` bájtra átemelt design system fájljai a `.prettierignore` vendorolt blokkjával egyező, explicit listával kizártak |

## Függőségi irány

Csak fejlesztői eszköz, a workspace futásidejű csomagjai közül semelyiktől nem függ, réteg
nélküli "eszköz" csomag (SPEC-002 4. szekció). A gyökér `package.json` scriptjei hívják, és
bármelyik másik csomag `devDependencies`-ként hivatkozhatna rá, futásidejű `dependencies`
helyen sosem jelenhet meg.

## Szabályok

- A csonkolási határ (`_lib.sh` `WRAPPER_ERROR_LIMIT`, `format.sh` `WRAPPER_FILE_LIMIT`,
  `test.sh` `WRAPPER_ERROR_LIMIT` és `WRAPPER_MESSAGE_CHAR_LIMIT`) 50 (sorszám), illetve
  200 (karakter). **Dokumentált szabály erre nincs**, ez projekt döntés, aminek a
  nagyságrendi keretét saját mérés adja: egyetlen, egy okra visszavezethető típushiba a
  legnagyobb csomagban 90 hibasort generál 22 fájlban, átlagosan 170 karakteres sorokkal.
  A gyökérok ilyenkor már az első hibasorból azonosítható. Részletek: SPEC-001 15.
  szekció, V-16 és
  [`../../docs/research/2026-08-26-spec001-ellenorzesek.md`](../../docs/research/2026-08-26-spec001-ellenorzesek.md).
- A `claude-md.sh` nem turbo taskon keresztül fut, hanem közvetlenül, mert a szabálya a
  teljes repóra vonatkozik és `git ls-files` kimenetéből dolgozik, nem csomagonként. A
  gyökér `package.json` `docs:check` scriptje hívja, és a CI `verify` jobja is ezt futtatja.
- A `casing.sh` ugyanezért nem turbo taskon keresztül fut: a szabálya a teljes repóra
  vonatkozik. A tényleges ellenőrzést a `src/casing/check-casing.ts` végzi (Node 26 type
  stripping), a `casing.sh` csak a kimenetét összegzi. A gyökér `package.json`
  `check:casing` scriptje hívja. Ugyanaz a logika (`src/casing/find-casing-mismatches.ts`)
  Vitest tesztként is fut (`src/casing/check-casing.spec.ts`), amit a gyökér
  `vitest.config.ts` `tooling-scripts` projektje vesz fel - a `tooling/scripts` nincs a
  `packages/*`/`apps/*` mintában, ugyanaz a mechanizmus, mint a `wire-probe-regression`
  projektnél.
- A `test.sh` a Vitest `--reporter=json --outputFile=...` kimenetéből olvassa a teszt
  összegzőt (`numTotalTests`/`numPassedTests`/`numFailedTests`, `jq`-val), a hibás
  tesztek nevét és üzenetét pedig a `testResults[].assertionResults[]` tömbből. A
  coverage összegzőt (metrikánként a százalék és a 100%-os küszöb) a
  `coverage/coverage-summary.json` `total` kulcsából olvassa - ezt a
  `vitest.config.ts` `coverage.reporter` `json-summary` bejegyzése írja.
- A hibasor-kinyerés két formátumot ismer fel: az ESLint "stylish" alakot (fájl fejléc +
  behúzott `sor:oszlop severity üzenet szabály` sorok) és a `tsc` klasszikus
  `fájl(sor,oszlop): error TSxxxx: üzenet` alakját. Ami egyiket sem illeszti, ott a
  `error`/`fail` szót tartalmazó nyers sorokat adja vissza tartalékként.
- A `turbo run <task>` hívás mindig `--continue=always --summarize=true
--output-logs=errors-only` kapcsolókkal fut: a `--continue=always` biztosítja, hogy egy
  hibás csomag ne akassza meg a többi futását, a `--summarize=true` adja a gépileg
  olvasható JSON összegzőt (`execution.success/failed/cached/attempted`), amiből az
  összegző sor épül.
- A gyökér `package.json` `format:check` scriptje a `format.sh` wrappert hívja
  közvetlenül, nem a `turbo.json` `//#format:check` taskján keresztül - ugyanaz az
  indok, mint fent: a Prettier egyetlen futással fedi a teljes repót, nincs mit a
  Turborepo taskgráfjára bízni. A CI is a `bun run format:check` scriptet hívja, tehát
  a fejlesztő helyben és a CI ugyanazt a parancsot futtatja.
- Ugyanez igaz a `test.sh`-ra: a `turbo.json` `//#test` taskja (nem `test`, hanem a `//#`
  előtaggal gyökérre skópolt) a gyökér `package.json` `"test": "vitest run --coverage"`
  scriptjét hívja, CI-ben `turbo run format:check typecheck lint test` paranccsal. A
  `test.sh` ugyanezt a Vitest parancsot közvetlenül hívja, nem a turbo taskon keresztül -
  indok: a Vitest a `coverage` blokkot kizárólag a gyökér configban értelmezi
  (projektenként "Unsupported Option", https://vitest.dev/guide/projects), tehát a
  lefedettség EGYETLEN, gyökér szintű Vitest folyamatban gyűlik, ahogy a Prettier is
  egyetlen futással fedi a repót. A `//#test` elnevezés azért nem lehetett sima `test`,
  mert a gyökér `package.json` `"test"` scriptje maga a Vitest parancs, és ha a task
  nem-prefixelt lenne, a per-csomag taskgráf a gyökeret sosem érintené (mérve: a
  Turborepo `--dry=json` kimenete a nem-prefixelt taskoknál kihagyja a `//` csomagot).
- Az `e2e-coverage.sh` a többi wrappertől eltérően **szétválasztja a két kimeneti
  csatornát**: a stdout kizárólag az `nyc` szöveges táblázatát tartalmazza, minden más
  (fejléc, időmérés, hibaüzenet) a stderr-re megy. Indok: a CI ennek a scriptnek a
  stdout-ját irányítja fájlba, és abból készül a PR komment töredéke és a job summary
  kódblokkja, tehát a stdout nem szennyezhető. Mellékhatásként a hiba **soha nem tud
  elrejtőzni**: a stderr nincs átirányítva, tehát a CI naplóban akkor is látszik, ha a
  stdout fájlba megy. Ez a viselkedés javítja azt a hibát, amikor a lépés `exit code 1`-gyel
  bukott, de a naplóban egyetlen hibaüzenet sem jelent meg.
- Az `e2e-coverage.sh` a futás előtt **külön ellenőrzi, hogy van-e nyers coverage adat** az
  `apps/web/e2e/.nyc_output/` alatt, és ha nincs, beszédes üzenettel áll meg. Az `nyc` saját
  hibája (`ENOENT: no such file or directory, scandir ...`) ugyanis nem árulja el, hogy a
  valódi ok a le nem futott `test:e2e`. A nyers adat cache találat esetén is helyreáll,
  mert a `turbo.json` `test:e2e` taskjának `outputs` listájában szerepel az
  `e2e/.nyc_output/**`.
- A `src/turbo-e2e-coverage-outputs/turbo-e2e-coverage-outputs.spec.ts` regressziós teszt
  őrzi a fenti javítás konfigurációs felét: a `turbo.json` `test:e2e` taskjának `outputs`
  listájában szerepelnie kell az `e2e/.nyc_output/**` bejegyzésnek, az `inputs` listájában
  pedig a `!**/e2e/.nyc_output/**` negációnak. Ugyanaz a mechanizmus futtatja, mint a
  `check-casing.spec.ts`-t: a gyökér `vitest.config.ts` `tooling-scripts` projektje. A
  `turbo-e2e-coverage-outputs/` mappának nincs megvalósítás fájlja, mert a teszt egy
  konfigurációs invariánst őriz, nem egy egységet fed le
  (`docs/spec/SPEC-002-csomag-architektura.md` 6.2 pont 5. szabálya).
- Az `e2e-coverage.sh` az `apps/web` könyvtárából, `bun run --silent`-tel hívja a csomag
  saját `coverage:e2e:report` scriptjét, nem `bun run --filter web`-bel. Indok: a
  `--filter` minden kimeneti sor elé `web coverage:e2e:report:` előtagot fűz, ami a PR
  kommentbe kerülő táblázatot olvashatatlanná tenné, a `--silent` pedig a bun
  `$ <parancs>` visszhangját némítja el. Az `nyc` kapcsolói így egyetlen helyen, az
  `apps/web/package.json`-ben maradnak.
- **Az `e2e-coverage.sh` 2026-09-05 óta kikényszerített küszöbű kaput burkol, nem puszta
  riportot.** Az `nyc` a `--check-coverage` kapcsoló mellett `process.exitCode = 1` értéket
  állít, ha bármelyik metrika a küszöb alatt van, és a hibát `console.error`-ral, tehát
  **stderr-re** írja - pontosan abba a csatornába, amit ez a wrapper amúgy is a hibáknak
  tart fenn. A wrapper ilyenkor a stdoutra semmit nem ír, a napló végét a stderr-re teszi,
  és a kilépési kódot továbbadja. A küszöb számai nem itt, hanem az `apps/web/package.json`
  scriptjében állnak; a származtatásuk a
  `docs/research/2026-09-05-e2e-lefedettsegi-kuszob.md` fájlban. A kapu jellegét (a
  `--check-coverage` megléte és az `e2e` job a `ci` job `needs` listájában) az
  `apps/web/src/e2e-coverage-threshold/` regressziós tesztje őrzi.
- A `check-dependency-graph.sh` ugyanazért nem turbo taskon keresztül fut, mint a
  `casing.sh`: a szabálya a teljes repóra vonatkozik, nem csomagonként. A gyökér
  `package.json` `check:graph` scriptje hívja - tagja a kilenc minőségi kapunak
  (`.claude/CLAUDE.md` 8. szekció). A réteg-hozzárendelés a
  `src/dependency-graph/package-layer.ts`-ben statikus térkép: ha a `read-workspace-
packages.ts` egy olyan csomagot talál, ami nincs benne, a `find-dependency-graph-
violations.ts` "hiányzó réteg-hozzárendelés" hibát ad - így egy új csomag felvétele
  nem maradhat csendben lekövetetlen.
- A `find-dependency-graph-violations.spec.ts` **szintetikus, kézzel összeállított**
  csomaglistákkal teszteli a logikát, nem a valós repó gráfjával, hogy a négy szabály
  (hiányzó réteg-hozzárendelés, eszköz csomag `dependencies` helyen, nem szigorúan
  csökkenő él, kör) mindegyike külön, célzottan reprodukálható legyen. Korábban itt egy
  valós, nyitva jelölt ellentmondás is állt: a SPEC-002 4. szekció "Rétegbesorolás, mind a
  25 csomagra" táblázata az `engine`-t és az `agent`-et azonos L4 rétegbe sorolta, miközben
  az `engine` `package.json`-ja ténylegesen függ az `agent`-től. Ezt a user döntése
  (2026-08-27) lezárta: az `engine` L5, a rá épülő `apps/server` L6 rétegre került, a
  `bun run check:graph` valós futtatása azóta nulla eltérést ad. Részletek:
  [`../../packages/engine/CLAUDE.md`](../../packages/engine/CLAUDE.md), "Ellentmondás a
  SPEC-002-ben, lezárva".
- A `db-drift.sh` a `packages/db` könyvtárból `bun x drizzle-kit generate` parancsot
  futtat, majd a `git status --porcelain packages/db/drizzle` kimenetét nézi: ha üres, a
  séma és a commitolt migrációk szinkronban vannak (a mért viselkedés szerint séma
  változás nélkül a `drizzle-kit generate` nem módosítja a `drizzle/` mappát, lásd
  `docs/research/2026-08-27-spec003-f1-nyitott-kerdesek.md` O-5 szekció). Ha a próba drift
  miatt új migrációs fájlt hozna létre, a script a diagnosztikai kiírás UTÁN, a kilépés
  ELŐTT `git checkout` + `git clean -fd` paranccsal visszaállítja a `drizzle/` mappát, hogy
  a repo munkakönyvtára ne maradjon piszkosan. Ugyanúgy szétválasztja a két kimeneti
  csatornát, mint az `e2e-coverage.sh`: stdout kizárólag az összegzés, minden diagnosztika
  a stderr-en. A gyökér `package.json` `check:db-drift` scriptje hívja; tagja a kilenc
  minőségi kapunak (`.claude/CLAUDE.md` 8. szekció), a `check:graph` mintájára.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 11. szekció
- [`../../docs/spec/SPEC-003-domain-perzisztencia.md`](../../docs/spec/SPEC-003-domain-perzisztencia.md), 10.3 szekció, T-003-25
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. szekció, T-002-24
