# PLAN-015: A szkript csomópont végrehajtásának terve

|         |                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------- |
| Státusz | **blokkolt**: a SPEC-014 O-1 ... O-3 (és B úton az O-4) user döntése nélkül nem indítható                      |
| Dátum   | 2026-11-03                                                                                                     |
| Spec    | [`../spec/SPEC-014-szkript-csomopont.md`](../spec/SPEC-014-szkript-csomopont.md)                               |
| Forrás  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md) |
| Branch  | `feat/spec-014-szkript-csomopont`                                                                              |

A lépések a SPEC-014 8. szekciójának kritérium számára hivatkoznak (`ACn`). A B úthoz (JavaScript) tartozó
lépések `[B]` jelölést kapnak, és csak akkor futnak, ha az O-1 válasza (b) vagy (c).

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                               | Ellenőrzés                        |
| ------------------- | ---------------------------------------------------------- | --------------------------------- |
| SPEC-014 döntései   | O-1 ... O-3 lezárva (B úton az O-4 is), átvezetve a specbe | a SPEC-014 7.1 szekciója          |
| Feature branch      | `feat/spec-014-szkript-csomopont`, a friss `main`-ről      | `git rev-parse --abbrev-ref HEAD` |
| A kiinduló fej zöld | a kilenc kapu                                              | a T-015-1 kimenete                |

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

| ID          | Leírás                                                                                                                                                                                                                                  | Függőség         | Modell             | Elfogadási kritérium                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | ---------------------------------------------------------------------------- |
| T-015-1     | Kiindulás: a kilenc kapu a kiinduló fejen, a SPEC-014 döntéseinek átvezetése a spec fejlécébe és a 7.1 táblába.                                                                                                                         | user döntés      | `sonnet`, `medium` | kilenc kapu zöld; a spec státusza "jóváhagyott"                              |
| T-015-2 [B] | Blokkoló mérés: `quickjs-emscripten` pinelt verziója (élő registry, két forrás, toolchain research), megszakítás szinkron és aszinkron kódra, memória korlát viselkedése; eldobható próba, a számok a research fájlba.                  | T-015-1          | `opus`, `medium`   | a SPEC-014 T-2 lezárva vagy kimondott korláttal nyitva; a T-1 sorsa kimondva |
| T-015-3     | Motor validáció: a `validateImplementedNodeTypes` szűkítése, az `unimplemented_node_type` sorsa (törlés vagy megtartás a halott ág tilalma szerint, kód olvasással eldöntve); a nyelvi mező ellenőrzés kiterjesztése a `source` mezőre. | T-015-1          | `opus`, `medium`   | AC1, AC4 (fordítási hiba); 100 százalék lefedettség                          |
| T-015-4     | Végrehajtó: közös szkript végrehajtó a `node-executor` témában, a diszpécser `script` ága és a `join` beágyazott `switch` `script` ága; bemenet a SPEC-010 7.3 leképezéssel, kimenet a 7.4 normalizálással, tárolási korlát.            | T-015-3          | `sonnet`, `high`   | AC2, AC3, AC4 (futásidejű hiba); valós `:memory:` adatbázison                |
| T-015-5 [B] | QuickJS futtató port az `apps/server` oldalon a `expressionEvaluator` mintájára (SPEC-004 3.2), a sandbox globális objektuma csak a futás kontextus, 60 másodperces megszakítás, `script_timed_out`.                                    | T-015-2, T-015-4 | `opus`, `medium`   | AC5, AC6; a sandbox globálisaira unit teszt                                  |
| T-015-6 [B] | Adat modell: új `runtime` érték a `db` unióban és a `protocol` sémában, sodródás védelem az `apps/server` `node-config-drift-protection` témában; a `GRAPH_DOCUMENT_VERSION` döntése a SPEC-003 5.2 szerint.                            | T-015-1          | `sonnet`, `high`   | a sodródás védelem mindkét irányban; a pillanatkép olvasó változatlanul zöld |
| T-015-7     | Hibaosztályok: az 5.5 tábla új osztályai a motor uniójában, a `ProtocolErrorClass` szótárban, a kliens magyar mondataiban, az `error-class-drift-protection` bővítésével.                                                               | T-015-3          | `sonnet`, `high`   | AC4; a drift védelem zöld                                                    |
| T-015-8     | Mentés: a `source` a kötelező szöveg mezők közé mindkét oldalon, a tábla egyenlőségének védelmével; az olvasó út változatlan.                                                                                                           | T-015-1          | `sonnet`, `high`   | AC7 (mentés rész); a régi üres `source` olvasható                            |
| T-015-9     | Felület: a kártya figyelmeztetése, a panel `role="alert"` mondata és a futás tiltása törlődik (a `has-script-node` és a `script-unimplemented-error-class` téma árváival); B úton `runtime` `SelectField`; unit tesztek.                | T-015-4, T-015-8 | `sonnet`, `high`   | AC7; e2e a futás indítható szkript lépéssel (`page.route()` mock)            |
| T-015-10    | Átvezetés: SPEC-003 4.3, SPEC-004 4.7 és 5. szekció, SPEC-008 5.1 és O-43, a csomagok `CLAUDE.md` `## Fájlok` táblái, a hiányleltár H-13 sora; a szabálykönyv érintett pontjai.                                                         | T-015-9          | `sonnet`, `medium` | AC9                                                                          |
| T-015-11    | Adverzariális átvizsgálás (sandbox szökés kísérletek a választott nyelven, hibaosztályok, halott ág) és kritérium tábla a research fájlba.                                                                                              | T-015-10         | `opus`, `medium`   | minden AC teszthez kötve; a talált hibák javítva, teszttel                   |
| T-015-12    | Merge kapu a PR fején (2. szekció), PR leírás.                                                                                                                                                                                          | T-015-11         | `sonnet`, `medium` | AC8; a kapu kimenete a PR leírásában                                         |

## 5. Kockázatok

- B úton a sandbox biztonsága a WASM határán múlik, és a README nem ad erős garanciát (research S-6): a
  T-015-11 szökési kísérletei kötelezőek.
- A úton a lassú kifejezés a szervert blokkolja (SPEC-010 O-2): kimondott, elfogadott korlát.
