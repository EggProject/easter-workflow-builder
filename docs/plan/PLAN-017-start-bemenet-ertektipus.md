# PLAN-017: A Start bemenet értéktípusának terve

|         |                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| Státusz | **blokkolt**: a SPEC-016 O-1 ... O-3 user döntése nélkül nem indítható (a T-017-2 mérés előtte is futhat)      |
| Dátum   | 2026-11-03                                                                                                     |
| Spec    | [`../spec/SPEC-016-start-bemenet-ertektipus.md`](../spec/SPEC-016-start-bemenet-ertektipus.md)                 |
| Forrás  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) |
| Branch  | `feat/spec-016-start-bemenet-ertektipus`                                                                       |

A lépések a SPEC-016 8. szekciójának kritérium számára hivatkoznak (`ACn`). A választólistához tartozó
lépések `[L]` jelölést kapnak, és csak akkor futnak, ha az O-1 válasza (a) vagy (c).

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                                 | Ellenőrzés                        |
| ------------------- | ------------------------------------------------------------ | --------------------------------- |
| SPEC-016 döntései   | O-1 ... O-3 lezárva, átvezetve a specbe                      | a SPEC-016 7.1 szekciója          |
| Feature branch      | `feat/spec-016-start-bemenet-ertektipus`, a friss `main`-ről | `git rev-parse --abbrev-ref HEAD` |
| A kiinduló fej zöld | a kilenc kapu                                                | a T-017-1 kimenete                |

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

| ID          | Leírás                                                                                                                                                                                                                                                    | Függőség         | Modell             | Elfogadási kritérium                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | ---------------------------------------------------------- |
| T-017-1     | Kiindulás: kilenc kapu, a SPEC-016 döntéseinek átvezetése.                                                                                                                                                                                                | user döntés      | `sonnet`, `medium` | kilenc kapu zöld; spec "jóváhagyott"                       |
| T-017-2     | Mérés (döntéstől független): a `cel-js` 8.0.0 viselkedése szöveg, szám (`double`) és logikai bemenetre: összehasonlítás int literállal, aritmetika int és double literállal, egyenlőség szöveg és szám között; eldobható próba, számok a research fájlba. | nincs            | `opus`, `medium`   | a research E-5 sora lezárva; AC5 mérési része              |
| T-017-3     | `db`: `StartInputValueKind` unió, írás oldali ellenőrzés a `replaceGraph`-ban, a kötelező szöveg mező táblából a `valueKind` törlése; az olvasó guard változatlanul bármilyen szöveget elfogad.                                                           | T-017-1          | `sonnet`, `high`   | AC1 (db rész), AC2 (olvasás); valós `:memory:` adatbázison |
| T-017-4     | `protocol`: `z.enum` a mentési sémában, az olvasó séma szöveg marad; az `apps/server` sodródás védelme kétirányú típusszintű és futásidejű ággal; a kötelező mező tábla egyenlőségének védelme frissítve.                                                 | T-017-3          | `sonnet`, `high`   | AC1                                                        |
| T-017-5 [L] | Választólista opciók: `options` mező a `StartInputField`-en (csak ennél a típusnál), a zárt kulcslisták (`isRecordWithKnownKeys`) és a mentési szabály (nem üres lista) mindkét oldalon, sodródás védelemmel.                                             | T-017-4          | `opus`, `medium`   | a zárt kulcslista teszt mindkét oldalon zöld               |
| T-017-6     | Motor: a futás indításának típus ellenőrzése a jelen lévő mezőkre, `invalid_input_type`, adat írás nélkül; a régi értékek az O-2 szerint; meglévő typeguardok, szükség esetén új guard a `typeguards` csomagban unit teszttel.                            | T-017-3          | `sonnet`, `high`   | AC2 (futás rész), AC4                                      |
| T-017-7     | Hibaosztály: `invalid_input_type` a `ProtocolErrorClass` szótárban és a kliens magyar mondataiban, az `error-class-drift-protection` bővítésével.                                                                                                         | T-017-6          | `sonnet`, `high`   | AC4 (protokoll rész)                                       |
| T-017-8     | Felület: a szerkesztő `SelectField` választója; a futás indító ablak típus szerinti mezői (`TextField` `type="number"` a `valueAsNumber` értékkel, `Checkbox`, `SelectField`), típusos JSON küldés, mező alatti hiba; unit és e2e (`page.route()`).       | T-017-4, T-017-7 | `sonnet`, `high`   | AC3                                                        |
| T-017-9     | Átvezetés: SPEC-003 4.3, SPEC-008 5.1 és 6.5, `apps/web/CLAUDE.md:284-288`, `packages/db/CLAUDE.md:77`, a SPEC-010 felhasználói súgója a szám aritmetikáról, a hiányleltár H-12 sora.                                                                     | T-017-2, T-017-8 | `sonnet`, `medium` | AC5, AC6                                                   |
| T-017-10    | Adverzariális átvizsgálás és kritérium tábla a research fájlba.                                                                                                                                                                                           | T-017-9          | `opus`, `medium`   | minden AC teszthez kötve                                   |
| T-017-11    | Merge kapu a PR fején, PR leírás.                                                                                                                                                                                                                         | T-017-10         | `sonnet`, `medium` | AC7                                                        |

## 5. Kockázatok

- A régi bemutató fixtúra (`'string'`) és a v1 pillanatkép fixtúra (`'text'`, `'number'`) eltérő szövegei:
  a v1 fixtúra commitolt és változatlan marad (pillanatkép), a bemutató fixtúra a választott készletre áll át,
  a képernyőkép lenyomata ettől elavul (`.claude/CLAUDE.md` 12. szekció), tehát a `bun run screenshots` újra
  fut.
