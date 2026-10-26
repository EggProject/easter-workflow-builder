# PLAN-012: A beállítások és az agent konfiguráció végrehajtási terve

|               |                                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Státusz       | tervezet, 2026-10-26; a SPEC-009 jóváhagyására és a 14. szekció válaszaira vár                                   |
| Dátum         | 2026-10-26                                                                                                       |
| Spec          | [`../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md`](../spec/SPEC-009-beallitasok-es-agent-konfiguracio.md) |
| Megfeleltetés | a PLAN-009 a SPEC-008 terve; a SPEC-009 terve ez a fájl, mert a PLAN-010 a SPEC-010-é, a PLAN-011 a SPEC-011-é   |
| Előzmény      | SPEC-011 (az in-process eszköz lánc törlése) bemergelve a `main`-be                                              |
| Hiánylista    | [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md)                 |
| Branch        | `feat/spec-009-beallitasok` (a tervezet ága); a végrehajtás fázisonként `feat/spec-009-<fázis>` ágon, PR-rel     |

A terv a SPEC-009-et egyenként ellenőrizhető lépésekre bontja. Minden lépéshez azonosító, leírás,
függőség, a végrehajtó subagent `model` és `effort` beállítása és elfogadási kritérium tartozik, a
SPEC-009 12. szekciójának kritérium számára hivatkozva (`ACn`). A nyitott kérdések (`O-n`) a SPEC-009 14. szekciójára mutatnak; ahol egy lépés tartalma a választól függ, a lépés az ajánlott opciót
írja le, és a válasz átvezetése a T-012-2 dolga.

## 1. Előfeltételek

| Feltétel             | Elvárt érték                                                                      | Ellenőrzés                                                                                         |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SPEC-009 jóváhagyva  | a user jóváhagyta, a 14. szekció kérdései megválaszolva                           | a SPEC-009 fejléce                                                                                 |
| SPEC-011 bemergelve  | az `agentTools`, `enabledEngineHooks`, `emit_output_tool` nem létezik a `main`-en | `git grep -n -E "agentTools\|enabledEngineHooks\|emit_output_tool" -- packages apps` nulla találat |
| Tiszta munkakönyvtár | nincs uncommitted változás                                                        | `git status --porcelain` üres                                                                      |
| Playwright chromium  | a `.claude/CLAUDE.md` 12. szekció `LD_LIBRARY_PATH` kerülőútjával                 | `bun run test:e2e` a mai tesztekre zöld                                                            |

Pusholni a futtatókörnyezetből nem lehet: minden commit sorozat után szólni kell a usernek, a branch
nevével. `npm` és `npx` nem használható.

## 2. Kapuk

Minden lépés végén a `.claude/CLAUDE.md` 8. szekciójában felsorolt kilenc kapu nulla kilépési kóddal
fut, és a lépés csak ezután commitolható; a kapuk mérvadó listája ott áll. **Merge kapu, amíg a CI ki
van kapcsolva:** minden PR merge előtt, a friss `main` bemergelése után, a merge fején helyben lefut a
kilenc kapu, a teljes e2e nyolc shardban és a `coverage:e2e:report` a küszöbbel; a parancsok, a
kilépési kódok, a tesztszámok, a lefedettségi számok és a fej SHA-ja a PR leírásába kerülnek
(`.claude/CLAUDE.md` 8. szekció). A lint `bun x turbo run lint --concurrency=1`, a Playwright legfeljebb
3 workerrel, `flock /tmp/playwright-gep.lock` alatt (`.claude/CLAUDE.md` 8. és 11. szekció).

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `sonnet`, `medium` | forrás lekérés, grep alapú leltár, doksi átvezetés, design system átemelés bájtazonos CSS-sel                          |
| `sonnet`, `high`   | részletes leírás szerinti kódolás: sémák, REST kezelők, szerkesztő mezők, e2e tesztek a megadott forgatókönyvvel       |
| `opus`, `medium`   | blokkoló mérések, a leképezés és az izoláció megtervezése, hibakeresés, adverzariális átvizsgálás, a zárási ellenőrzés |

Minden subagentnél explicit `model` és `effort` mező kell (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

### F0: kiindulás, mérések, döntések

| ID      | Leírás                                                                                                                                                                                              | Függőség | Modell             | Elfogadási kritérium                                                                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-012-1 | Kiinduló állapot: branch, a kilenc kapu, a teljes e2e és a `coverage:e2e:report` a munka előtt; a mai fedetlen e2e tételek száma metrikánként feljegyezve                                           | nincs    | `sonnet`, `medium` | mind zöld; a négy szám a research fájlban; az SDK pin változatlan (`0.3.245`)                                                                                                   |
| T-012-2 | A SPEC-009 14. szekció kérdéseinek felterjesztése az askuserquestion tool-lal, önálló részkérdésekre bontva; a válaszok átvezetése a SPEC-009-be ("Lezárva, dátum, user döntés")                    | nincs    | `opus`, `medium`   | az O-1 ... O-30 mind lezárva vagy kimondottan nyitva; a 3., 5., 6., 7. és 9. szekció a válaszokhoz igazítva                                                                     |
| T-012-3 | Forrás lekérés: a Skills oldal "Invalid skill name error" szakasza, a TS referencia `Query` metódusai, az MCP szerver név szabálya; elsődleges forrás plusz két megerősítés                         | nincs    | `sonnet`, `medium` | a SPEC-009 2.2 és 2.3 "nem ellenőrzött" sorai vagy ellenőrzöttre váltanak, vagy úgy maradnak; a research fájlban URL-lel                                                        |
| T-012-4 | **Blokkoló mérés M-136 és M-139**: plugin út skillje és helyi MCP csonk szerverek az `init` üzenetben, `settingSources: []` mellett, helyi csonk `ANTHROPIC_BASE_URL` végponttal, valódi API nélkül | T-012-3  | `opus`, `medium`   | feljegyezve: az `init` `skills` tömbje, az elfogadott `skills` lista alak, az MCP szerverek állapota, a stdio alfolyamat környezete; nyers kimenet a `docs/research/` alatt     |
| T-012-5 | **Blokkoló mérés M-137**: a mai `Options.env` blokk hatása (`claude-subscription` esetén `{}`), helyi csonk végponttal                                                                              | T-012-3  | `opus`, `medium`   | feljegyezve, hogy az alfolyamat elindul-e és mit lát a `PATH` és a `HOME` változóból; ha a hiba igazolt, a hiányleltár H-40 tétele hibaként, regressziós teszt kötelezettséggel |
| T-012-6 | **Mérés M-138** (és az O-1 (b) választás esetén M-140), csak a user O-22 jóváhagyása után                                                                                                           | T-012-2  | `opus`, `medium`   | feljegyezve a hitelesítés eredménye izolációs módban; ha a user nem hagyja jóvá, az O-20 (b) marad, és ez a SPEC-009-ben kimondva                                               |

**Amíg a T-012-4 és a T-012-5 nem zöld, az F2 és az F4 termékkódja nem íródik.**

### F1: design system elemek

| ID      | Leírás                                                                                                                                                  | Függőség | Modell           | Elfogadási kritérium                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-012-7 | A design system elemek átemelése a `packages/ui`-ba (ajánlottan `Switch`, `FileUpload`, `Empty`, `TagInput`; O-7, O-15, O-16, O-19), bájtazonos CSS-sel | T-012-2  | `sonnet`, `high` | a CSS bájtazonos a design system forrással (a meglévő precedens tesztje szerint); unit teszt mindkét ágra; `packages/ui` `CLAUDE.md` `## Fájlok` frissítve |

### F2: protokoll, szerver, motor

| ID       | Leírás                                                                                                                                                                                                      | Függőség                     | Modell           | Elfogadási kritérium                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- |
| T-012-8  | A kapcsolat teszt `mode` mezője az O-1 szerint (ajánlottan törlés a protokollból és a motorból)                                                                                                             | T-012-2                      | `sonnet`, `high` | AC19; a "nem elfogadott végállapot" mondat törölve; a sodródás védelem zöld                        |
| T-012-9  | Skill könyvtár a szerverben: a kötelező könyvtár konfiguráció (alapérték nélkül), a lista, feltöltés és törlés útvonala a `protocol` route táblában és az `apps/server`-ben                                 | T-012-2, T-012-4             | `sonnet`, `high` | AC9 (szerver oldal), AC10; a sémák a négy írási szabály szerint; unit teszt ideiglenes könyvtárral |
| T-012-10 | Motor: `plugins` a skill könyvtárra, a `skills` lista alakja (5.3), a hiányzó skill indítási ellenőrzése és az új hibaosztály a sodródás védelemmel (O-13)                                                  | T-012-9                      | `opus`, `medium` | AC11, AC12 (motor és szerver); `error-class-drift-protection` zöld                                 |
| T-012-11 | Motor: az `mcpServers` leképezése a 6.3 szerint a `processEnvironment` porton át, a hiányzó env név hibája (O-18); a `build-agent-step-options.ts:86-92` komment és a `packages/engine` `CLAUDE.md` átírása | T-012-4                      | `opus`, `medium` | AC15, AC17                                                                                         |
| T-012-12 | Motor: izoláció és környezet az O-20, O-21 és a mérések szerint (`settingSources`, `strictMcpConfig`, `env`)                                                                                                | T-012-5, T-012-6             | `opus`, `medium` | AC18; ha az M-137 hibát igazolt, regressziós teszt, ami a javítás nélkül bukik                     |
| T-012-13 | Szerver végponttól végpontig próba rögzítő `query` porttal: `Options` alakja, env érték sehol a kimenetben                                                                                                  | T-012-10, T-012-11, T-012-12 | `opus`, `medium` | AC16; valódi API hívás nincs                                                                       |

### F3: Beállítások képernyő és provider

| ID       | Leírás                                                                                                                                         | Függőség              | Modell           | Elfogadási kritérium                                                |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------- | ------------------------------------------------------------------- |
| T-012-14 | A provider választó komponens a "Kapcsolat teszt" gombbal, az O-2 szerinti minden helyen                                                       | T-012-7, T-012-8      | `sonnet`, `high` | AC4                                                                 |
| T-012-15 | A Beállítások képernyő Provider szekciója: globális alapértelmezés, env nevek, első indulás jelzése (O-4, O-5)                                 | T-012-14              | `sonnet`, `high` | AC1, AC2, AC3                                                       |
| T-012-16 | Párhuzamossági korlát szekció (O-6), alapérték nélkül                                                                                          | T-012-7               | `sonnet`, `high` | AC5, AC6                                                            |
| T-012-17 | Delta kapcsoló szekció (O-7)                                                                                                                   | T-012-7               | `sonnet`, `high` | AC7                                                                 |
| T-012-18 | Workflow szintű provider utólagos módosítása (O-3)                                                                                             | T-012-14              | `sonnet`, `high` | AC8                                                                 |
| T-012-19 | e2e a T-012-15 ... T-012-18 forgatókönyveire, mindkét témában, 320 és 1440 pixelen, `page.route()` mockkal; szándékos rontás minden új tesztre | T-012-15 ... T-012-18 | `sonnet`, `high` | a rontásra bukik, az ép kódon zöld; a fedetlen tételek száma nem nő |

### F4: skill és MCP a felületen

| ID       | Leírás                                                                                                                                         | Függőség              | Modell             | Elfogadási kritérium                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------ | ------------------------------------------------- |
| T-012-20 | A greppes invariáns (9) tiltásának feloldása és a SPEC-008 54. kritérium átírása, ugyanabban a commitban, amiben az első tiltott téma létrejön | T-012-2               | `sonnet`, `medium` | AC20                                              |
| T-012-21 | `skill-upload` téma: a Skill könyvtár szekció (lista, feltöltés, felülírás, törlés megerősítéssel, O-9 ... O-16)                               | T-012-9, T-012-20     | `sonnet`, `high`   | AC9 (web oldal)                                   |
| T-012-22 | A lépés és az agent definíció `skills` mezőjének szerkesztése (O-14)                                                                           | T-012-21              | `sonnet`, `high`   | AC13                                              |
| T-012-23 | `mcp-server-config` téma: a lépés és az agent definíció `mcpServers` mezőjének szerkesztése (O-17, O-19)                                       | T-012-7, T-012-20     | `sonnet`, `high`   | AC14                                              |
| T-012-24 | e2e a T-012-21 ... T-012-23 forgatókönyveire, a mentés `PUT` törzsének állításával; szándékos rontás                                           | T-012-21 ... T-012-23 | `sonnet`, `high`   | a rontásra bukik; a fedetlen tételek száma nem nő |

### F5: átvezetés és zárás

| ID       | Leírás                                                                                                                                                                                                                                                                                                                                                  | Függőség | Modell             | Elfogadási kritérium                                                                                                                                                                                     |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-012-25 | A SPEC-009 8. szekció átvezetései (SPEC-007, SPEC-008, kód kommentek, a felhasználónak látható szöveg, csomag `CLAUDE.md` fájlok, a szabálykönyv 9. és 13. szekciója)                                                                                                                                                                                   | F3, F4   | `sonnet`, `medium` | AC21, AC22                                                                                                                                                                                               |
| T-012-26 | Adverzariális átvizsgálás a SPEC-009 kritériumaira, független subagentekkel; a talált hibák javítása vagy nyitott kérdésként felterjesztése                                                                                                                                                                                                             | T-012-25 | `opus`, `medium`   | jelentés a `docs/research/` alatt; minden talált tétel javítva vagy a usernél                                                                                                                            |
| T-012-27 | Kritérium tábla: a SPEC-009 12. szekciójának mind a 24 kritériuma tételesen, bizonyítékkal (teszt neve, parancs, `fájl:sor`)                                                                                                                                                                                                                            | T-012-26 | `opus`, `medium`   | research fájl, a SPEC-010 kritérium tábla mintájára                                                                                                                                                      |
| T-012-28 | **Kötelező zárási lépés: a hiányleltár tételes ellenőrzése.** A `docs/research/2026-10-26-hatokor-hianyleltar.md` minden SPEC-009 gazdájú tétele (H-01, H-02, H-03, H-04, H-05, H-07, H-19, H-21, H-22, H-26, H-40, H-41) tételesen: lezárva (commit SHA-val) vagy kimondott user döntéssel nyitva; a 14.6 besorolás szerinti tételek gazdája frissítve | T-012-27 | `opus`, `medium`   | AC23: a hiányleltárban egyetlen tétel sem marad gazda és döntés nélkül; a SPEC-009 és a PLAN-012 fejléce "végrehajtva"; a merge kapu (2. szekció) zöld a merge fején, a PR leírás tartalmazza a számokat |

## 5. Fázis függőségek

```
F0 (T-012-1 ... T-012-6)
 ├─> F1 (T-012-7)
 ├─> F2 (T-012-8 ... T-012-13)   [T-012-4, T-012-5 után]
 ├─> F3 (T-012-14 ... T-012-19)  [F1 és T-012-8 után]
 └─> F4 (T-012-20 ... T-012-24)  [F1, T-012-9 után]
F5 (T-012-25 ... T-012-28)       [F3 és F4 után]
```

Fázisonként egy PR; minden PR a 2. szekció merge kapuján megy át.

## 6. Definition of Done

- A SPEC-009 12. szekciójának mind a 24 kritériuma teljesül, a T-012-27 táblája szerint.
- A hiányleltár zárási ellenőrzése (T-012-28) kész, gazda nélküli tétel nincs.
- A merge kapu zöld a merge fején, a számok a PR leírásban.
