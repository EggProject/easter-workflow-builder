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
| `test.sh`      | `turbo run test` burkoló                                                                                                                                                |
| `build.sh`     | `turbo run build` burkoló                                                                                                                                               |
| `format.sh`    | a Prettier közvetlen burkolója, `--check` (alapértelmezett) és `--write` móddal - **nem** turbo taskon keresztül, mert a Prettier egyetlen futással a teljes repót fedi |

## Szabályok

- A csonkolási határ (`_lib.sh` `WRAPPER_ERROR_LIMIT`, `format.sh` `WRAPPER_FILE_LIMIT`)
  50, önkényesen választva - nincs rá dokumentált szabály (SPEC-001 11. szekció, V-16).
- A hibasor-kinyerés két formátumot ismer fel: az ESLint "stylish" alakot (fájl fejléc +
  behúzott `sor:oszlop severity üzenet szabály` sorok) és a `tsc` klasszikus
  `fájl(sor,oszlop): error TSxxxx: üzenet` alakját. Ami egyiket sem illeszti, ott a
  `error`/`fail` szót tartalmazó nyers sorokat adja vissza tartalékként.
- A `turbo run <task>` hívás mindig `--continue=always --summarize=true
--output-logs=errors-only` kapcsolókkal fut: a `--continue=always` biztosítja, hogy egy
  hibás csomag ne akassza meg a többi futását, a `--summarize=true` adja a gépileg
  olvasható JSON összegzőt (`execution.success/failed/cached/attempted`), amiből az
  összegző sor épül.
- A `format:check` gyökér turbo task (`turbo.json` `//#format:check`) nem ezeken a
  wrappereken keresztül fut a CI-ben, hanem közvetlenül `turbo run format:check`
  paranccsal - a `format.sh` wrapper a helyi fejlesztői/ad-hoc használatra való.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 11. szekció
