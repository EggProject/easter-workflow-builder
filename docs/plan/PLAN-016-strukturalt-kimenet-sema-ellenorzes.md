# PLAN-016: A strukturált kimenet séma ellenőrzésének terve

|         |                                                                                                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| Státusz | **blokkolt**: a SPEC-015 O-1 ... O-3 user döntése nélkül nem indítható                                               |
| Dátum   | 2026-11-03                                                                                                           |
| Spec    | [`../spec/SPEC-015-strukturalt-kimenet-sema-ellenorzes.md`](../spec/SPEC-015-strukturalt-kimenet-sema-ellenorzes.md) |
| Forrás  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)       |
| Branch  | `feat/spec-015-strukturalt-kimenet-sema`                                                                             |

A lépések a SPEC-015 8. szekciójának kritérium számára hivatkoznak (`ACn`). Ha az O-1 válasza (b)
(figyelmeztetés), a T-016-4 a lépést nem bukja, hanem figyelmeztető eseményt ír; ennek alakja a T-016-1-ben a
specbe kerül.

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                                 | Ellenőrzés                        |
| ------------------- | ------------------------------------------------------------ | --------------------------------- |
| SPEC-015 döntései   | O-1 ... O-3 lezárva, átvezetve a specbe                      | a SPEC-015 7.1 szekciója          |
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

| ID       | Leírás                                                                                                                                                                                                                                                                 | Függőség         | Modell             | Elfogadási kritérium                                                                  |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------- |
| T-016-1  | Kiindulás: kilenc kapu, a SPEC-015 döntéseinek átvezetése.                                                                                                                                                                                                             | user döntés      | `sonnet`, `medium` | kilenc kapu zöld; spec "jóváhagyott"                                                  |
| T-016-2  | Verzió: az Ajv `latest` élő registry és egy második forrás alapján, pinelve az `agent` csomagban, a `docs/research/2026-08-26-toolchain.md` táblájába vezetve.                                                                                                         | T-016-1          | `sonnet`, `medium` | AC6                                                                                   |
| T-016-3  | `agent` `sdk-message-shape` téma: a séma fordító és a kimenet ellenőrző függvény, `Outcome` alakban, `allErrors: false`, draft-07; fájlonként egy egység, unit tesztek mindkét ágra és a draft-07-nél újabb `$schema`-ra.                                              | T-016-2          | `sonnet`, `high`   | a függvények 100 százalékosan fedettek; nincs `as`, `any`                             |
| T-016-4  | Motor: a `runAgentStep` `classifyResult` ága az illeszkedésre, új `structured_output_schema_mismatch` osztály; a `join` `ai_synthesis` teszt.                                                                                                                          | T-016-3          | `opus`, `medium`   | AC1, AC2, AC4                                                                         |
| T-016-5  | Futás indítás: a sémák fordítása a validációban, `invalid_structured_output_schema`, adat írás nélkül.                                                                                                                                                                 | T-016-3          | `sonnet`, `high`   | AC3                                                                                   |
| T-016-6  | Ha az O-2 (a): a mentéskori ellenőrzés helye. Mérés: a webes csomag mérete Ajv-vel és nélküle (`vite build`); a döntés (böngészőben vagy a szerver `PUT` útján, mezőútvonalas hibával) a mérés alapján, a research fájlba vezetve; megvalósítás a mező alatti hibával. | T-016-5          | `opus`, `medium`   | a hiba a `structuredOutput.schema` mező alatt jelenik meg; e2e `page.route()` mockkal |
| T-016-7  | Hibaosztályok: a két új osztály a `ProtocolErrorClass` szótárban (a REST hibához), a kliens magyar mondataiban, az `error-class-drift-protection` bővítésével.                                                                                                         | T-016-4, T-016-5 | `sonnet`, `high`   | AC5                                                                                   |
| T-016-8  | Átvezetés: SPEC-004 21. kritérium, `packages/engine/CLAUDE.md:432-437`, `packages/agent/CLAUDE.md` `## Fájlok`, a hiányleltár H-17 sora.                                                                                                                               | T-016-7          | `sonnet`, `medium` | AC7                                                                                   |
| T-016-9  | Adverzariális átvizsgálás és kritérium tábla a research fájlba.                                                                                                                                                                                                        | T-016-8          | `opus`, `medium`   | minden AC teszthez kötve                                                              |
| T-016-10 | Merge kapu a PR fején, PR leírás.                                                                                                                                                                                                                                      | T-016-9          | `sonnet`, `medium` | AC8                                                                                   |

## 5. Kockázatok

- A felhasználói séma `pattern` kulcsszava lassú lehet (research K-8); az O-3 (a) döntésnél ez kimondott
  korlát, ugyanúgy, mint a CEL kifejezéseknél.
