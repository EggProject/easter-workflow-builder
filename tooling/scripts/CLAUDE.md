# tooling/scripts

## Mi ez a mappa

Token takarékos bash wrapper scriptek a zajos parancsokhoz (SPEC-001 11. szekció). Minden
wrapper csak összegzést és a hibákat írja ki, a burkolt eszköz teljes kimenetét nem - azt
egy `.turbo/wrapper-logs/` alá mentett fájlba írja, és az útját csak hiba esetén nevezi
meg. A `src/index.ts` a csomag saját `typecheck` scriptjéhez kell (placeholder, a
wrapperek maguk bash fájlok, nem TypeScript).

## Fájlok

| Fájl           | Tartalom                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `_lib.sh`      | közös függvények: `turbo run <task>` futtatása, JSON összegző beolvasása, hibasorok kinyerése ESLint és `tsc` kimenetből, csonkolás                                     |
| `lint.sh`      | `turbo run lint` burkoló                                                                                                                                                |
| `typecheck.sh` | `turbo run typecheck` burkoló                                                                                                                                           |
| `test.sh`      | a Vitest közvetlen burkolója, coverage összegzővel - **nem** `turbo run test`-en keresztül, lásd lent                                                                   |
| `build.sh`     | `turbo run build` burkoló                                                                                                                                               |
| `format.sh`    | a Prettier közvetlen burkolója, `--check` (alapértelmezett) és `--write` móddal - **nem** turbo taskon keresztül, mert a Prettier egyetlen futással a teljes repót fedi |

## Szabályok

- A csonkolási határ (`_lib.sh` `WRAPPER_ERROR_LIMIT`, `format.sh` `WRAPPER_FILE_LIMIT`,
  `test.sh` `WRAPPER_ERROR_LIMIT` és `WRAPPER_MESSAGE_CHAR_LIMIT`) 50 (sorszám), illetve
  200 (karakter), önkényesen választva - nincs rá dokumentált szabály (SPEC-001 11.
  szekció, V-16).
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

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 11. szekció
