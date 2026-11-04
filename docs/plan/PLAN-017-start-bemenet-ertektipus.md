# PLAN-017: A Start bemenet értéktípusának terve

|         |                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz | végrehajtva (T-017-1 ... T-017-10; a T-017-11 és T-017-12 a PR előtti lépés): a SPEC-016 O-1 ... O-3 lezárva (user döntés 2026-11-04) |
| Dátum   | 2026-11-03, átvezetve 2026-11-04                                                                                                      |
| Spec    | [`../spec/SPEC-016-start-bemenet-ertektipus.md`](../spec/SPEC-016-start-bemenet-ertektipus.md)                                        |
| Forrás  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)                        |
| Branch  | `feat/spec-016-bemenet-ertektipus`                                                                                                    |

A lépések a SPEC-016 8. szekciójának kritérium számára hivatkoznak (`ACn`). Végrehajtási sorrend a három
terv között: PLAN-017, PLAN-016, PLAN-015 (a research 9. szekciója); ez a terv az első, mert a legkisebb, nincs új
külső függősége, és a típusos bemenet a szkript lépés (PLAN-015) bemenetét is adja.

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                           | Ellenőrzés                        |
| ------------------- | ------------------------------------------------------ | --------------------------------- |
| SPEC-016 döntései   | O-1 ... O-3 lezárva, átvezetve a specbe (megvan)       | a SPEC-016 7.1 szekciója          |
| Feature branch      | `feat/spec-016-bemenet-ertektipus`, a friss `main`-ről | `git rev-parse --abbrev-ref HEAD` |
| A kiinduló fej zöld | a kilenc kapu                                          | a T-017-1 kimenete                |

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

| ID       | Leírás                                                                                                                                                                                                                                                                                                           | Függőség         | Modell             | Elfogadási kritérium                                            |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | --------------------------------------------------------------- |
| T-017-1  | Kiindulás: kilenc kapu a kiinduló fejen.                                                                                                                                                                                                                                                                         | nincs            | `sonnet`, `medium` | kilenc kapu zöld                                                |
| T-017-2  | Mérés: a `cel-js` 8.0.0 viselkedése szöveg, szám (`double`), logikai, szöveg tömb és JSON objektum bemenetre: összehasonlítás int literállal, aritmetika int és double literállal, egyenlőség szöveg és szám között, `size()` és tagság a tömbön; eldobható próba, számok a research fájlba.                     | nincs            | `opus`, `medium`   | a research E-5 sora lezárva; AC6 mérési része                   |
| T-017-3  | `db`: `StartInputValueKind` hat értékű unió, a `StartInputField` `valueKind` szerinti uniója (`choice` ágon `options`), zárt kulcslista ágonként, az `isNodeConfig` szigorú ellenőrzése írás és olvasás úton, a `choice` mentési szabálya, a kötelező szöveg mező táblából a `valueKind` törlése.                | T-017-1          | `sonnet`, `high`   | AC1 (db rész), AC2, AC3 (db rész); valós `:memory:` adatbázison |
| T-017-4  | `protocol`: `z.enum` és `z.discriminatedUnion('valueKind', ...)` az olvasó és a mentési sémában, a `choice` mentési szabálya a `superRefine` `when` feltételével; az `apps/server` sodródás védelme (kétirányú típusszintű és futásidejű ág, a kötelező mező tábla egyenlősége, az `options` szabály mezőnként). | T-017-3          | `sonnet`, `high`   | AC1, AC3                                                        |
| T-017-5  | Motor: a futás indításának típus ellenőrzése a jelen lévő mezőkre az SPEC-016 5.5 táblája szerint (`isString`, `isNumber`, `isBoolean`, `isStringArray`, tagság), `invalid_input_type`, adat írás nélkül.                                                                                                        | T-017-3          | `sonnet`, `high`   | AC5 (motor rész)                                                |
| T-017-6  | Hibaosztály: `invalid_input_type` a `ProtocolErrorClass` szótárban és a kliens magyar mondataiban, az `error-class-drift-protection` bővítésével.                                                                                                                                                                | T-017-5          | `sonnet`, `high`   | AC5 (protokoll rész)                                            |
| T-017-7  | Szerkesztő: `SelectField` a hat értékre, alapérték `text`; `choice` típusnál az opciók soronkénti `TextAreaField` mezője; mező alatti hiba; a bemutató fixtúra `'text'` értékre; unit.                                                                                                                           | T-017-4          | `sonnet`, `high`   | AC3 (felület rész)                                              |
| T-017-8  | Futás indító ablak: az 5.1 táblázat mezői (`TextField`, `type="number"` a `valueAsNumber` értékkel, `Checkbox`, `SelectField`, soronkénti és JSON `TextAreaField`), típusos JSON küldés, üres mező hiányzó kulcs, érvénytelen JSON mező alatti hibája; unit és e2e (`page.route()`).                             | T-017-4, T-017-6 | `sonnet`, `high`   | AC4                                                             |
| T-017-9  | Képernyőképek: a `bun run screenshots` újrafuttatása a megváltozott bemutató fixtúrával, a manifeszt frissítése (`.claude/CLAUDE.md` 12. szekció).                                                                                                                                                               | T-017-7, T-017-8 | `sonnet`, `medium` | a `screenshot-pipeline` invariánsai zöldek                      |
| T-017-10 | Átvezetés: SPEC-003 4.3, SPEC-004 4.8, SPEC-008 5.1 és 6.5, a SPEC-010 dokumentációja a szám aritmetikáról, `apps/web/CLAUDE.md:284-288`, `packages/db/CLAUDE.md:77`, a szabálykönyv 5. szekciója (a szigorú olvasó út kivétele), a hiányleltár H-12 sora.                                                       | T-017-2, T-017-9 | `sonnet`, `medium` | AC6, AC7                                                        |
| T-017-11 | Adverzariális átvizsgálás és kritérium tábla a research fájlba.                                                                                                                                                                                                                                                  | T-017-10         | `opus`, `medium`   | minden AC teszthez kötve                                        |
| T-017-12 | Merge kapu a PR fején, PR leírás.                                                                                                                                                                                                                                                                                | T-017-11         | `sonnet`, `medium` | AC8                                                             |

Becsült lépésszám: 12.

## 5. Kockázatok

- A v1 pillanatkép fixtúra (`'text'`, `'number'`) a választott nevekkel érvényes, tehát változatlan marad; ha egy
  lépés mégis a fixtúra módosítására kényszerülne, a lenyomat literál nem írható felül (a fixtúra teszt fejléce),
  és a lépés megáll.
- A bemutató fixtúra változása a képernyőkép lenyomatot elavulttá teszi (T-017-9).
