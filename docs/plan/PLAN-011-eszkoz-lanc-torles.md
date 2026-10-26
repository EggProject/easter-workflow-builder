# PLAN-011: Az in-process eszköz lánc törlésének végrehajtási terve

|               |                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| Státusz       | tervezet, 2026-10-26; a végrehajtás a SPEC-011 12. szekciójának válaszai (O-1 ... O-16) után indul     |
| Dátum         | 2026-10-26                                                                                             |
| Spec          | [`../spec/SPEC-011-eszkoz-lanc-torles.md`](../spec/SPEC-011-eszkoz-lanc-torles.md)                     |
| Mérési forrás | [`../research/2026-10-26-eszkoz-lanc-torles.md`](../research/2026-10-26-eszkoz-lanc-torles.md)         |
| Konvenció     | [`../spec/SPEC-002-csomag-architektura.md`](../spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció |
| Branch        | `feat/spec-011-eszkoz-lanc-torles`                                                                     |

Ez a terv a SPEC-011-et egyenként ellenőrizhető lépésekre bontja. Minden lépéshez azonosító,
leírás, függőség, a végrehajtó subagent `model` és `effort` beállítása és elfogadási kritérium
tartozik, a SPEC-011 11. szekciójának kritérium számára hivatkozva (`ACn`).

## 1. Előfeltételek

| Feltétel                  | Elvárt érték                                                        | Ellenőrzés                        |
| ------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| SPEC-011 nyitott kérdései | O-1 ... O-16 mind megválaszolva, a SPEC-011 12. szekciója átvezetve | a SPEC-011 fejléce                |
| Feature branch            | `feat/spec-011-eszkoz-lanc-torles` a friss `main`-ről               | `git rev-parse --abbrev-ref HEAD` |
| A mai állapot zöld        | a kilenc kapu a kiinduló fejen                                      | a T-011-1 kimenete                |
| Tiszta munkakönyvtár      | nincs uncommitted változás                                          | `git status --porcelain` üres     |

A `main` védett, a zárás PR-rel történik. `npm` és `npx` nem használható. Pusholni a sandboxból nem
lehet: minden commit sorozat után szólni kell a usernek, a branch nevével.

## 2. Kapuk

**Minden lépés végén a kilenc kapu** (`format:check`, `typecheck`, `lint`, `test`, `build`,
`docs:check`, `check:casing`, `check:graph`, `check:db-drift`) nulla kilépési kóddal fut, és a lépés
csak ezután commitolható; a mérvadó lista a `.claude/CLAUDE.md` 8. szekciója. A lint
`bun x turbo run lint --concurrency=1` alakban, a nehéz parancs `flock /tmp/kapu-gep.lock` alatt fut.
**A merge kapu** (a CI ki van kapcsolva) a T-011-10 lépésben: a kilenc kapu, a teljes e2e nyolc
shardban és a `coverage:e2e:report` a PR fején, a parancsokkal, kilépési kódokkal, számokkal és a
fej SHA-jával a PR leírásában.

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonnet`, `medium` | részletes leírás szerinti törlés és fixtúra javítás: csomag törlés, réteg térkép, `turbo.json`, a fixtúrák `agentTools` sorai, dokumentum átvezetés a megadott sorlistával |
| `sonnet`, `high`   | a T-011-5 atomi lépése, mert sok csomagot érint egy commitban, de a megoldás meghatározott                                                                                 |
| `opus`, `medium`   | a tárolt adat kezelésének megvalósítása (a választott opció), a sodródás védelem rontásos igazolása, az adverzariális átvizsgálás, a kritériumok tételes ellenőrzése       |

A `model` és az `effort` mező soha nem hagyható üresen (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

### F0 fázis: kiindulás

| ID      | Leírás                                                                                                                                                 | Függőség                         | Modell             | Elfogadási kritérium                                                                                                                                                          |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-011-1 | Kiinduló állapot: branch, tiszta munkakönyvtár, a kilenc kapu és az e2e küszöb a kiinduló fejen, a mai e2e értékek rögzítése a research fájlba.        | a SPEC-011 O-1 ... O-16 válaszai | `sonnet`, `medium` | A kilenc kapu nulla kilépési kóddal fut; a 8 shard e2e és a `coverage:e2e:report` számai a `docs/research/2026-10-26-eszkoz-lanc-torles.md` új szekciójában, a fej SHA-jával. |
| T-011-2 | A SPEC-011 12. szekciójának átvezetése a user válaszaival; a 8. szekció sorrendje, a 11. szekció kritériumai és e terv lépései a válaszokhoz igazítva. | T-011-1                          | `opus`, `medium`   | Minden O-tétel "lezárva" állapotú, a dátummal és a user szavaival; nincs feltételezéssel lezárt pont; `format:check` és `docs:check` zöld.                                    |

### F1 fázis: a hét csomag

| ID      | Leírás                                                                                                                                                          | Függőség | Modell             | Elfogadási kritérium                                                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| T-011-3 | A hét csomag törlése `git rm -r`-rel; a `package-layer.ts` hét sora és fejléc számai; a `turbo.json` négy env neve; `bun install` a `bun.lock` előállítására.   | T-011-2  | `sonnet`, `medium` | AC1, AC2, AC3, AC5, AC8; a `PACKAGE_LAYER` bejegyzésszáma egyezik a `git ls-files '*/package.json'` gyökér nélküli számával; kilenc kapu zöld. |
| T-011-4 | A `core` árva exportjai az O-10 válasza szerint, a `packages/core/CLAUDE.md` `## Fájlok` táblájával és a `browser-safe-imports.spec.ts:4` hivatkozással együtt. | T-011-3  | `sonnet`, `medium` | O-10 (a) esetén a 11 export és a fájljaik nincsenek a fán, a `core` lefedettsége 100 százalék; (b) esetén változatlan; kilenc kapu zöld.       |

### F2 fázis: az `agentTools` fogalom

| ID      | Leírás                                                                                                                                                                                                                                                                                                                                                                                                                              | Függőség | Modell             | Elfogadási kritérium                                                                                                                                                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-011-5 | **Atomi lépés**: a `protocol` `AgentToolIdSchema` (fájl és teszt) és a mező, a `db` típus, guard ág és komment, az `apps/server` `node-config-drift-protection` fixtúrája, az `apps/web` `AgentStepConfigFields.tsx` csoportja és alapértéke (O-5 szerint), és minden `agentTools` tesztfixtúra a `db`, `protocol`, `engine`, `apps/server`, `apps/web` alatt (research 3.3), az e2e `node-inspector.spec.ts:714-720` állításaival. | T-011-3  | `sonnet`, `high`   | AC6 (a `recommendedAgentTools` és az `AgentToolId` típus kivételével, azok a T-011-7, T-011-8 lépésben), AC11, AC13; kilenc kapu zöld.                                                                                                  |
| T-011-6 | A tárolt adat kezelése az O-1 ... O-4 válasza szerint (SPEC-011 5. szekció): migráció (`drizzle-kit generate --custom`), tűrő olvasó séma, vagy egyik sem; a választott út tesztje valós `:memory:` adatbázison; a lenyomat fixtúra az O-4 szerint.                                                                                                                                                                                 | T-011-5  | `opus`, `medium`   | AC12; az A vagy C opciónál a migráció a felső szintű és a `settings` alatti kulcsot is eltávolítja, a pillanatkép sort nem érinti; a B vagy C opciónál a tűrés tesztje és a mentési séma elutasításának tesztje; `check:db-drift` zöld. |
| T-011-7 | A `recommendedAgentTools` leíró mező, a két provider `tool-support/recommended-agent-tools.ts` fájlja és a `descriptor.ts` sorai, az `engine` tesztfixtúráinak `recommendedAgentTools: knownFact([])` sorai; a két provider `CLAUDE.md` `## Fájlok` táblája.                                                                                                                                                                        | T-011-5  | `sonnet`, `medium` | AC9, AC10; kilenc kapu zöld.                                                                                                                                                                                                            |
| T-011-8 | A `provider-capability` `agent-tool-id/` témája, a `tool-support/agent-tool-recommendation.ts` és a barrel sorai; a `CLAUDE.md` `## Fájlok` táblája és függőségi leírása.                                                                                                                                                                                                                                                           | T-011-7  | `sonnet`, `medium` | AC6 teljes egészében; kilenc kapu zöld.                                                                                                                                                                                                 |

### F3 fázis: dokumentáció és zárás

| ID       | Leírás                                                                                                                                                                                                                                                                             | Függőség | Modell             | Elfogadási kritérium                                                                                                                                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-011-9  | A dokumentáció átvezetése az O-11 ... O-16 válasza szerint: a szabálykönyv (6. szekció csomagszám és példák, 12. szekció buktatók), a megmaradó csomagok `CLAUDE.md` fájljai, a spec, plan és research hivatkozások (SPEC-011 7. szekció, research 3.3), az O-16 szerinti gépi őr. | T-011-8  | `sonnet`, `medium` | AC4, AC7, AC14, AC16; a `docs/research` alatt csak az O-12, O-13 szerint megtartott fájlokban marad találat; `format:check` és `docs:check` zöld.                                                                                  |
| T-011-10 | Adverzariális átvizsgálás (kimaradt hivatkozás, árva export, árva teszt segéd, megmaradt env név, a megtartott helyek indoka) és a SPEC-011 kritériumainak tételes ellenőrzése, a merge kapuval.                                                                                   | T-011-9  | `opus`, `medium`   | Minden kritérium mellett a futtatott parancs vagy teszt neve; AC15: a merge kapu zöld a PR fején, az e2e küszöb csak a szabálykönyv 8. szekciója szerinti tételes levezetéssel mozdul; a PR leírás a számokkal és a fej SHA-jával. |
| T-011-11 | Zárás: a SPEC-011 és a PLAN-011 státusza, a user értesítése a push szükségességéről.                                                                                                                                                                                               | T-011-10 | `sonnet`, `medium` | A két fejléc "végrehajtva" állapotú; a branch neve a usernek átadva.                                                                                                                                                               |

## 5. Fázis függőségek

| Fázis | Függ ettől          | Miért                                                                                                                                                                               |
| ----- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F0    | a SPEC-011 válaszai | a tárolt adat, a szerkesztő és a dokumentáció kezelése a user döntése                                                                                                               |
| F1    | F0                  | a hét csomagot termékkód nem importálja, tehát a többi lépéstől függetlenül törölhető                                                                                               |
| F2    | F1                  | a T-011-5 a `protocol` és a `db` oldalt egy commitban változtatja, mert a sodródás védelem a kettő kölcsönös értékadhatóságát őrzi; a T-011-8 csak a T-011-5 és T-011-7 után fordul |
| F3    | F2                  | a dokumentáció a végleges fájlkészletet írja le                                                                                                                                     |

A T-011-6 és a T-011-7 egymással párhuzamosítható, mert más fájlokat érint; a T-011-4 a T-011-5-tel
párhuzamosítható.

## 6. Kockázat kezelés a végrehajtás alatt

| Helyzet                                                                                 | Mit teszünk                                                                                                  |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A T-011-5 után a `typecheck` egy kimaradt fixtúrán bukik                                | a lépés nem zárható le; a research 3.3 sorlistája a kiindulás, a kimaradt fájl a research fájlba is felkerül |
| Egy törölt teszt után a lefedettség 100 százalék alá esik                               | a lépés nem zárható le; a hiányzó teszt pótlódik, a `coverage.exclude` nem bővül                             |
| Egy dokumentum hivatkozás a választott opció szerint nem egyértelműen besorolható       | a lépés megáll, a tétel a SPEC-011 12. szekciójába kerül, a user dönt                                        |
| A `bun install` más változást is hoz a `bun.lock`-ba, mint a hét bejegyzés eltávolítása | a lépés megáll, a diff a userhez megy                                                                        |
| A választott tárolt adat opció a pillanatkép módosítását igényelné                      | tilos (szabálykönyv 10. szekció 2. pont); a kérdés visszamegy a userhez                                      |

## 7. Definition of Done

1. A hét csomag és a hozzájuk tartozó konfiguráció nincs a fán (T-011-3).
2. Az `agentTools` fogalom a SPEC-011 11. szekciójának megnevezett kivételeivel nincs a fán
   (T-011-5, T-011-7, T-011-8).
3. A tárolt adat a user választása szerint kezelt, teszttel igazolva, a pillanatkép érintetlen
   (T-011-6).
4. A dokumentáció a user választása szerint átvezetve, a szabálykönyv csomagszáma helyes (T-011-9).
5. A SPEC-011 minden kritériuma teljesül, kritériumonként futtatott parancsra vagy tesztre
   hivatkozva; a merge kapu zöld (T-011-10).
6. A munka commitolva, a user értesítve a push szükségességéről (T-011-11).
