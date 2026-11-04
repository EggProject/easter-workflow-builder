# PLAN-015: A szkript csomópont végrehajtásának terve

|         |                                                                                                                                        |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz | indítható: a SPEC-014 O-1 ... O-6 és a T-3 (memória, stack) mind lezárva (user döntés 2026-11-04), a lépések nem várnak termékdöntésre |
| Dátum   | 2026-11-03, átvezetve 2026-11-04                                                                                                       |
| Spec    | [`../spec/SPEC-014-szkript-csomopont.md`](../spec/SPEC-014-szkript-csomopont.md)                                                       |
| Forrás  | [`../research/2026-11-03-szkript-kimenet-ertektipus.md`](../research/2026-11-03-szkript-kimenet-ertektipus.md)                         |
| Branch  | `feat/spec-014-szkript-csomopont`                                                                                                      |

A lépések a SPEC-014 8. szekciójának kritérium számára hivatkoznak (`ACn`). Végrehajtási sorrend a három
terv között: PLAN-017, PLAN-016, PLAN-015 (a research 9. szekciója); ez a terv a harmadik, mert mindhárom a
`ProtocolErrorClass` szótárt és az `error-class-drift-protection` témát bővíti, és ez a legnagyobb.

## 1. Előfeltételek

| Feltétel            | Elvárt érték                                          | Ellenőrzés                        |
| ------------------- | ----------------------------------------------------- | --------------------------------- |
| SPEC-014 döntései   | O-1 ... O-6 lezárva (megvan)                          | a SPEC-014 7.1 szekciója          |
| Előző terv          | a PLAN-016 mergelve a `main`-re                       | `git log origin/main`             |
| Feature branch      | `feat/spec-014-szkript-csomopont`, a friss `main`-ről | `git rev-parse --abbrev-ref HEAD` |
| A kiinduló fej zöld | a kilenc kapu                                         | a T-015-1 kimenete                |

## 2. Kapuk

**Minden lépés végén a kilenc kapu** (`format:check`, `typecheck`, `lint`, `test`, `build`, `docs:check`,
`check:casing`, `check:graph`, `check:db-drift`) nulla kilépési kóddal fut, és a lépés csak ezután
commitolható; a mérvadó lista a `.claude/CLAUDE.md` 8. szekciója. A lint `bun x turbo run lint --concurrency=1`
alakban fut.

**Merge kapu** (a CI ki van kapcsolva): a friss `main` bemergelése után a PR fején a kilenc kapu, a teljes e2e
nyolc shardban (`flock /tmp/playwright-gep.lock`, legfeljebb 3 worker) és a `coverage:e2e:report` a küszöbbel;
a parancsok, a kilépési kódok, a tesztszámok, a lefedettségi számok és a fej SHA-ja a PR leírásába kerül. Ha a
`main` a futás után elmozdul, a kaput újra kell futtatni.

**Valódi API hívás nincs** ebben a tervben: minden lépés hamis agenttel vagy port csonkkal dolgozik; a
hálózati teszt helyi `node:http` szerverrel, a fájl teszt ideiglenes könyvtárral fut.

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| `sonnet`, `medium` | forrás és verzió ellenőrzés, dokumentum átvezetés, a spec szerint részletesen leírt egyszerű kódolás |
| `sonnet`, `high`   | több csomagot érintő, de a spec által meghatározott kódolás (séma, guard, sodródás védelem, felület) |
| `opus`, `medium`   | ahol a megoldást ki kell találni, mérés kiértékelése, adverzariális átvizsgálás és kritérium tábla   |

A `model` és az `effort` mező soha nem hagyható üresen (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

| ID       | Leírás                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Függőség                   | Modell             | Elfogadási kritérium                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------ | ---------------------------------------------------------------------------- |
| T-015-1  | Kiindulás: a kilenc kapu a kiinduló fejen; az O-5 és az O-6 állapotának ellenőrzése a SPEC-014 7.1 táblájában.                                                                                                                                                                                                                                                                                                                                                                                                                    | PLAN-016 merge             | `sonnet`, `medium` | kilenc kapu zöld                                                             |
| T-015-2  | Blokkoló mérés: a `quickjs-emscripten` pinelt verziója (élő registry, két forrás, toolchain research); eldobható próbán az interrupt kezelő CPU kötött és gazda ígéretre váró kódra (T-2), a 128 MB korlát túllépése, a modul szintű plafon és a mély rekurzió (T-3), a bellard változat verziója a quickjs-ng hibáihoz (T-4); a számok a research fájlba.                                                                                                                                                                        | T-015-1                    | `opus`, `medium`   | T-2, T-3, T-4 lezárva vagy kimondott korláttal nyitva; AC10                  |
| T-015-3  | Adat modell: a `ScriptConfig` `runtime` szerinti diszkriminált uniója a `db`-ben és a `protocol`-ban (`z.discriminatedUnion`, zárt kulcslista mindkét ágra), a `timeoutMs` pozitív egész szabálya felső határral mindkét oldalon, sodródás védelem az `apps/server` `node-config-drift-protection` témájában (típusszintű kétirányú és mezőnként futásidejű ág).                                                                                                                                                                  | T-015-1                    | `sonnet`, `high`   | AC6 (adat rész); a pillanatkép fixtúra teszt változatlanul zöld              |
| T-015-3a | Memória korlát mező (user döntés 2026-11-04, SPEC-014 5.3, 5.4): a `ScriptConfig` JavaScript ágán `memoryLimitMb: number \| null`, egész 16 ... 2048, a `db` guardban és a `protocol` mentési sémájában, zárt kulcslistával, sodródás védelem mezőnként futásidejű ággal az `apps/server` `node-config-drift-protection` témájában.                                                                                                                                                                                               | T-015-3                    | `sonnet`, `high`   | AC7 (adat rész); a pillanatkép fixtúra teszt változatlanul zöld              |
| T-015-4  | Motor validáció: a `validateImplementedNodeTypes` szűkítése, az `unimplemented_node_type` sorsa (törlés vagy megtartás a halott ág tilalma szerint, kód olvasással eldöntve); a CEL `source` a nyelvi mező ellenőrzésre; a `scriptRunner` port típusa (fordítás, futtatás) a SPEC-004 3.2 portlistájába.                                                                                                                                                                                                                          | T-015-3                    | `opus`, `medium`   | AC1, AC4 (CEL fordítási hiba); 100 százalék lefedettség                      |
| T-015-5  | Végrehajtó: közös szkript végrehajtó a `node-executor` témában, a diszpécser `script` ága és a `join` beágyazott `switch` `script` ága, kimerítő `switch` a `runtime`-ra; bemenet a SPEC-010 7.3 leképezéssel, kimenet a 7.4 normalizálással, tárolási korlát; megszakítás és `fail_run` jel a portnak.                                                                                                                                                                                                                           | T-015-4                    | `sonnet`, `high`   | AC2, AC3, AC4 (futásidejű hiba); valós `:memory:` adatbázison, port csonkkal |
| T-015-6  | JavaScript futtató az `apps/server` oldalon: lépésenként új runtime és `dispose`, `async` törzs csomagolás, `resolvePromise` és `executePendingJobs`, a hét név JSON-ként, lépésenként friss WebAssembly modul saját `WebAssembly.Memory` maximummal (`memoryLimitMb`, üresen `min(os.totalmem(), 2048 MB)`, SPEC-014 5.4), `setMaxStackSize(131072)`, a gazdára kijutó `RangeError` a lépés hibája, kettős időkorlát (interrupt kezelő plusz `AbortSignal.timeout`), JSON kimenet, a fordító művelet; a gazda függvények nélkül. | T-015-2, T-015-3a, T-015-5 | `opus`, `medium`   | AC5, AC6, AC7; a globális kulcslista unit tesztje                            |
| T-015-7  | Gazda függvények az O-5 és az O-6 döntése szerint: `fetch` (csak `http:` és `https:`, `redirect: 'manual'`, a határidő jele, az O-6 címkészlete), `files` (a gyökér az O-5 szerint, `path.resolve` plusz `fs.realpath` előtag ellenőrzés); helyi `node:http` szerverrel és ideiglenes könyvtárral tesztelve.                                                                                                                                                                                                                      | T-015-6                    | `opus`, `medium`   | AC8                                                                          |
| T-015-8  | Hibaosztályok: az 5.7 tábla új osztályai a motor uniójában; a `script_compile_failed` a `ProtocolErrorClass` szótárban és a kliens magyar mondataiban, az `error-class-drift-protection` bővítésével.                                                                                                                                                                                                                                                                                                                             | T-015-4                    | `sonnet`, `high`   | AC4; a drift védelem zöld                                                    |
| T-015-9  | Mentés: a `source` a kötelező szöveg mezők közé mindkét oldalon, a tábla egyenlőségének védelmével.                                                                                                                                                                                                                                                                                                                                                                                                                               | T-015-3                    | `sonnet`, `high`   | AC9 (mentés rész)                                                            |
| T-015-10 | Felület: a kártya figyelmeztetése, a panel `role="alert"` mondata és a futás tiltása törlődik (a `has-script-node` és a `script-unimplemented-error-class` téma árváival); `runtime` `SelectField`, időkorlát mező másodpercben, memória korlát mező MB-ban, `source` `TextAreaField`, mező alatti hiba; unit és e2e (`page.route()`).                                                                                                                                                                                            | T-015-5, T-015-8, T-015-9  | `sonnet`, `high`   | AC9; e2e a futás indítható szkript lépéssel                                  |
| T-015-11 | Átvezetés: SPEC-003 4.3, SPEC-004 3.2, 4.7 és 5. szekció, SPEC-008 5.1 és O-43, a csomagok `CLAUDE.md` `## Fájlok` táblái, a hiányleltár H-13 sora; a szabálykönyv érintett pontjai (5. szekció sodródás védelem, 7. szekció stack).                                                                                                                                                                                                                                                                                              | T-015-7, T-015-10          | `sonnet`, `medium` | AC12                                                                         |
| T-015-12 | Adverzariális átvizsgálás: sandbox szökés kísérletek JavaScript úton (globális objektum, prototípus, `eval`, `Function` konstruktor, gyökéren kívüli út, szimbolikus link, átirányítás, nem HTTP séma, időkorlát megkerülése ígéret lánccal), hibaosztályok, halott ág; kritérium tábla a research fájlba.                                                                                                                                                                                                                        | T-015-11                   | `opus`, `medium`   | minden AC teszthez kötve; a talált hibák javítva, teszttel                   |
| T-015-13 | Merge kapu a PR fején (2. szekció), PR leírás.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | T-015-12                   | `sonnet`, `medium` | AC11; a kapu kimenete a PR leírásában                                        |

Becsült lépésszám: 14.

## 5. Kockázatok

- A sandbox biztonsága a WebAssembly és a QuickJS határán múlik, a wrapper nem auditált, a motor ágakban 2026-ban
  memóriabiztonsági hibák voltak (research J-8): a T-015-12 szökési kísérletei kötelezőek, a T-015-2 a pinelt
  motor verzióját ellenőrzi.
- A `quickjs-emscripten` 1.0 alatti, a README szerint "expect occasional breaking API changes" (J-1): a verzió
  pontosan pinelve, a frissítés előtt a T-015-2 próbái regresszióként futnak.
- A CEL és a JavaScript CPU kötött szkriptje a szervert blokkolja (SPEC-010 O-2, SPEC-014 5.4): kimondott,
  elfogadott korlát.
- A memória alapértéke a rendszermemória (legfeljebb 2048 MB) lépésenként (user döntés 2026-11-04): több párhuzamos
  szkript lépés együtt a gép memóriáját meghaladó foglalást kísérelhet meg; kimondott kockázat (SPEC-014 5.10 5. pont).
- Az O-5 és az O-6 user döntése megvan (2026-11-04): a fájl hozzáférés gyökere a JavaScript ág `cwd` mezője,
  címszűrés nincs. A kockázat kimondott és elfogadott (SPEC-014 5.10 2. és 3. pont).
