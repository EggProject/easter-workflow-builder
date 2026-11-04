# PLAN-016: A strukturált kimenet séma ellenőrzésének terve

|         |                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| Státusz | indítható: a SPEC-015 O-1 ... O-3 lezárva (user döntés 2026-11-04)                                                   |
| Dátum   | 2026-11-03, átvezetve 2026-11-04                                                                                     |
| Spec    | [`../spec/SPEC-015-strukturalt-kimenet-sema-ellenorzes.md`](../spec/SPEC-015-strukturalt-kimenet-sema-ellenorzes.md) |
| Forrás  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)       |
| Branch  | `feat/spec-015-strukturalt-kimenet-sema`                                                                             |

A lépések a SPEC-015 8. szekciójának kritérium számára hivatkoznak (`ACn`). Végrehajtási sorrend a három
terv között: PLAN-017, PLAN-016, PLAN-015 (a research 9. szekciója); ez a terv a második, a PLAN-017 merge után
indul, mert mindhárom a `ProtocolErrorClass` szótárt bővíti.

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                                 | Ellenőrzés                        |
| ------------------- | ------------------------------------------------------------ | --------------------------------- |
| SPEC-015 döntései   | O-1 ... O-3 lezárva, átvezetve a specbe (megvan)             | a SPEC-015 7.1 szekciója          |
| Előző terv          | a PLAN-017 mergelve a `main`-re                              | `git log origin/main`             |
| Feature branch      | `feat/spec-015-strukturalt-kimenet-sema`, a friss `main`-ről | `git rev-parse --abbrev-ref HEAD` |
| A kiinduló fej zöld | a kilenc kapu                                                | a T-016-1 kimenete                |

## 2. Kapuk

**Minden lépés végén a kilenc kapu** (`format:check`, `typecheck`, `lint`, `test`, `build`, `docs:check`,
`check:casing`, `check:graph`, `check:db-drift`) nulla kilépési kóddal fut, és a lépés csak ezután
commitolható; a mérvadó lista a `.claude/CLAUDE.md` 8. szekciója. A lint `bun x turbo run lint --concurrency=1`
alakban fut.

**Merge kapu** (a CI ki van kapcsolva): a friss `main` bemergelése után a PR fején a kilenc kapu, a teljes e2e
nyolc shardban (`flock /tmp/playwright-gep.lock`, legfeljebb 3 worker) és a `coverage:e2e:report` a küszöbbel;
a parancsok, a kilépési kódok, a tesztszámok, a lefedettségi számok és a fej SHA-ja a PR leírásába kerül. Ha a
`main` a futás után elmozdul, a kaput újra kell futtatni.

**Valódi API hívás nincs** ebben a tervben: minden lépés hamis agenttel vagy port csonkkal dolgozik.

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `sonnet`, `medium` | forrás és verzió ellenőrzés, dokumentum átvezetés, a spec szerint részletesen leírt egyszerű kódolás |
| `sonnet`, `high`   | több csomagot érintő, de a spec által meghatározott kódolás (séma, guard, sodródás védelem, felület) |
| `opus`, `medium`   | ahol a megoldást ki kell találni, mérés kiértékelése, adverzariális átvizsgálás és kritérium tábla   |

A `model` és az `effort` mező soha nem hagyható üresen (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

| ID       | Leírás                                                                                                                                                                                                                                                                                                 | Függőség         | Modell             | Elfogadási kritérium                                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ------------------ | ------------------------------------------------------------------------------------- |
| T-016-1  | Kiindulás: kilenc kapu a kiinduló fejen.                                                                                                                                                                                                                                                               | PLAN-017 merge   | `sonnet`, `medium` | kilenc kapu zöld                                                                      |
| T-016-2  | Verzió: az Ajv `latest` élő registry és egy második forrás alapján, pinelve az `agent` csomagban, a `docs/research/2026-08-26-toolchain.md` táblájába vezetve.                                                                                                                                         | T-016-1          | `sonnet`, `medium` | AC6                                                                                   |
| T-016-3  | `agent` `sdk-message-shape` téma: a séma fordító és a kimenet ellenőrző függvény, `Outcome` alakban, `allErrors: false`, draft-07; fájlonként egy egység, unit tesztek mindkét ágra és a draft-07-nél újabb `$schema`-ra.                                                                              | T-016-2          | `sonnet`, `high`   | a függvények 100 százalékosan fedettek; nincs `as`, `any`                             |
| T-016-4  | Motor: a `runAgentStep` `classifyResult` ága az illeszkedésre, új `structured_output_schema_mismatch` osztály; a `join` `ai_synthesis` teszt.                                                                                                                                                          | T-016-3          | `opus`, `medium`   | AC1, AC2, AC4                                                                         |
| T-016-5  | Futás indítás: a sémák fordítása a validációban, `invalid_structured_output_schema`, adat írás nélkül.                                                                                                                                                                                                 | T-016-3          | `sonnet`, `high`   | AC3                                                                                   |
| T-016-6  | Mentéskori ellenőrzés (O-2 user döntés, SPEC-015 5.7): a szerver `PUT .../graph` kezelője az `agent` fordító függvényével, `invalid_request` a mezőúttal (`agent_step` és `join` `ai_synthesis`); a kliens a mezőutat a `structuredOutput.schema` mező alatti hibára képezi le; unit és szerver teszt. | T-016-5          | `sonnet`, `high`   | a hiba a `structuredOutput.schema` mező alatt jelenik meg; e2e `page.route()` mockkal |
| T-016-7  | Hibaosztályok: a két új osztály a `ProtocolErrorClass` szótárban (a REST hibához), a kliens magyar mondataiban, az `error-class-drift-protection` bővítésével.                                                                                                                                         | T-016-4, T-016-5 | `sonnet`, `high`   | AC5                                                                                   |
| T-016-8  | Átvezetés: a szabálykönyv 11. szekciója (a mentés mezőútja ennél az egy mezőnél mondatot kap), SPEC-004 21. kritérium, `packages/engine/CLAUDE.md:432-437`, `packages/agent/CLAUDE.md` `## Fájlok`, a hiányleltár H-17 sora.                                                                           | T-016-7          | `sonnet`, `medium` | AC7                                                                                   |
| T-016-9  | Adverzariális átvizsgálás és kritérium tábla a research fájlba.                                                                                                                                                                                                                                        | T-016-8          | `opus`, `medium`   | minden AC teszthez kötve                                                              |
| T-016-10 | Merge kapu a PR fején, PR leírás.                                                                                                                                                                                                                                                                      | T-016-9          | `sonnet`, `medium` | AC8                                                                                   |

Becsült lépésszám: 10.

## 5. Kockázatok

- A felhasználói séma `pattern` kulcsszava lassú lehet (research K-8); az O-3 user döntése ("Nincs") mellett ez
  kimondott korlát, ugyanúgy, mint a CEL kifejezéseknél (SPEC-015 5.8).
- A mentéskori hiba csak a szerver válasza után látszik (SPEC-015 5.7); a kliens mezőút leképezése a
  szabálykönyv 11. szekciójának szűkített kiegészítése, a T-016-8 vezeti át.
