# PLAN-018: A JavaScript szkript lépés külön folyamatban, végrehajtási terv

|         |                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------ |
| Státusz | végrehajtva (T-018-1 ... T-018-8)                                                                      |
| Dátum   | 2026-11-05                                                                                             |
| Spec    | [`../spec/SPEC-017-szkript-kulon-folyamat.md`](../spec/SPEC-017-szkript-kulon-folyamat.md)             |
| Forrás  | [`../research/2026-11-05-szkript-kulon-folyamat.md`](../research/2026-11-05-szkript-kulon-folyamat.md) |
| Branch  | `feat/szkript-kulon-folyamat`                                                                          |

A lépések a SPEC-017 8. szekciójának kritérium számára hivatkoznak (`ACn`).

## 1. Előfeltételek

| Feltétel       | Elvárt érték                                      | Ellenőrzés                        |
| -------------- | ------------------------------------------------- | --------------------------------- |
| User döntés    | "Külön folyamatban fusson" (2026-11-04)           | a SPEC-017 1. szekciója           |
| Feature branch | `feat/szkript-kulon-folyamat`, a friss `main`-ről | `git rev-parse --abbrev-ref HEAD` |

## 2. Kapuk

Minden lépés végén a kilenc kapu nulla kilépési kóddal (a mérvadó lista a `.claude/CLAUDE.md` 8. szekciója); a merge
előtt a végső fejen a kilenc kapu, a nyolc shardos e2e és a `coverage:e2e:report` (ugyanott, "Merge kapu").

## 3. Lépések

| #       | Lépés                                                                                                                                                                              | Függ        | Elfogadás                                                       |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- |
| T-018-1 | Forrásellenőrzés (C1 ... C12) és a rések saját mérése (`execArgv`, `env`, `'disconnect'`, WebAssembly memória és heap, időzóna, heap alsó határ)                                   |             | research 2. és 3. szekció                                       |
| T-018-2 | A kérés és a válasz típusa és guardja (`SandboxRunRequest`, `isSandboxRunRequest`, `isScriptRunResult`), a kérés leképezése (`buildSandboxRunRequest`), a közös időkorlát eredmény | T-018-1     | unit tesztek mindkét ágra                                       |
| T-018-3 | A `runScript` a szkript folyamat függvénye: a kérés jele helyett a szülő öl, a `waitForSettlement` csak a határidővel versenyez; a meglévő tesztek a leképezésen át                | T-018-2     | a SPEC-014 tesztjei változatlan állítással zöldek               |
| T-018-4 | A szkript folyamat oldala (`serveScriptChild`, `script-child-entry.ts`) és indítása (`spawnScriptChild`, `buildScriptChildEnvironment`)                                            | T-018-3     | AC1, AC4, AC5; unit tesztek                                     |
| T-018-5 | A szülő oldal (`createChildProcessScriptRun`) és a bekötés (`quickJsScriptRunner.run`)                                                                                             | T-018-4     | AC1 ... AC3, AC5, AC6; unit tesztek hamis és valódi folyamattal |
| T-018-6 | A T-5 regressziója végponttól végpontig, bukás a régi kódon                                                                                                                        | T-018-5     | AC2; research 3.4                                               |
| T-018-7 | Mérő eszköz és mérések (M-1 ... M-5), research 4. szekció                                                                                                                          | T-018-5     | research 4. szekció                                             |
| T-018-8 | Dokumentáció (SPEC-014 7.2 T-4, T-5, 5.4, 5.8, 5.10; `apps/server` CLAUDE.md), független adverzariális átvizsgálás, merge kapu                                                     | T-018-6, -7 | AC7 ... AC9                                                     |
