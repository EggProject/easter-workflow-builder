# PLAN-013: A helyi indítás és a valódi provider próba végrehajtási terve

|               |                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| Státusz       | tervezet (a SPEC-012 nyitott kérdései a 11. szekcióban, user döntésre várnak)                                        |
| Dátum         | 2026-10-26                                                                                                           |
| Spec          | [`../spec/SPEC-012-helyi-inditas-es-valodi-proba.md`](../spec/SPEC-012-helyi-inditas-es-valodi-proba.md)             |
| Mérési forrás | [`../research/2026-10-26-helyi-inditas-es-valodi-proba.md`](../research/2026-10-26-helyi-inditas-es-valodi-proba.md) |
| Branch        | `feat/spec-012-inditas-es-valodi-proba`                                                                              |

Ez a terv a SPEC-012-t egyenként ellenőrizhető lépésekre bontja. A számozás: a PLAN-011 a
SPEC-011-é, a PLAN-012 a SPEC-009-é (a `feat/spec-009-beallitasok` branchen), ezért ez a PLAN-013.
Minden lépéshez azonosító, leírás, függőség, a végrehajtó subagent `model` és `effort` beállítása és
elfogadási kritérium tartozik, a SPEC-012 9. szekciójának kritérium számára hivatkozva (`ACn`).

## 1. Előfeltételek

| Feltétel                  | Elvárt érték                                                      | Ellenőrzés                        |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| SPEC-012 nyitott kérdései | O-1 ... O-19 lezárva (a T-013-9 csak az O-14 ... O-17 után indul) | a SPEC-012 11. szekciója          |
| Feature branch            | `feat/spec-012-inditas-es-valodi-proba` a friss `main`-ről        | `git rev-parse --abbrev-ref HEAD` |
| A mai állapot zöld        | a kilenc kapu a kiinduló fejen                                    | a T-013-1 kimenete                |
| Tiszta munkakönyvtár      | nincs uncommitted változás                                        | `git status --porcelain` üres     |

A `main` védett, a zárás PR-rel történik. `npm` és `npx` nem használható. Pusholni a sandboxból nem
lehet: minden commit sorozat után szólni kell a usernek, a branch nevével.

**Valódi API hívás (MiniMax, Anthropic) kizárólag a T-013-9 lépésben, és ott is csak a user
kifejezett, az adott futásra szóló engedélyével.** Minden más lépés hamis agenttel, port csonkkal
vagy hamis CLI végrehajthatóval dolgozik.

## 2. Kapuk

**Minden lépés végén a kilenc kapu** (`format:check`, `typecheck`, `lint`, `test`, `build`,
`docs:check`, `check:casing`, `check:graph`, `check:db-drift`) nulla kilépési kóddal fut, és a lépés
csak ezután commitolható; a mérvadó lista a `.claude/CLAUDE.md` 8. szekciója. A lint
`bun x turbo run lint --concurrency=1` alakban fut.

**A merge kapu** (a CI ki van kapcsolva) a T-013-11 lépésben: a friss `main` bemergelése után a PR
fején a kilenc kapu, a teljes e2e nyolc shardban (`flock /tmp/playwright-gep.lock`, legfeljebb 3
worker) és a `coverage:e2e:report` a küszöbbel; a parancsok, a kilépési kódok, a tesztszámok, a
lefedettségi számok és a fej SHA-ja a PR leírásába kerül (szabálykönyv 8. szekció). Ha a `main` a
futás után elmozdul, a kaput újra kell futtatni.

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonnet`, `medium` | részletes leírás szerinti kódolás és dokumentum írás: scriptek, env minta, `README.md`, leíró bejegyzések a megadott névlistával, átvezetések       |
| `sonnet`, `high`   | a kimenő környezet függvénye és bekötése, a port bővítése (több csomag, de a szabály meghatározott)                                                 |
| `opus`, `medium`   | a valódi próba eszközének megtervezése és megírása, a hamis CLI alfolyamat teszt (időkorlát mérés), az adverzariális átvizsgálás, a kritérium tábla |

A `model` és az `effort` mező soha nem hagyható üresen (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

### F0 fázis: kiindulás

| ID      | Leírás                                                                                                                                          | Függőség                                    | Modell             | Elfogadási kritérium                                                      |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| T-013-1 | Kiinduló állapot: branch a friss `main`-ről, tiszta munkakönyvtár, a kilenc kapu a kiinduló fejen; a fej SHA-ja a research fájl új szekciójába. | a SPEC-012 O-1 ... O-13, O-18, O-19 lezárva | `sonnet`, `medium` | A kilenc kapu nulla kilépési kóddal fut; a research fájlban a fej SHA-ja. |

### F1 fázis: a kimenő környezet

| ID      | Leírás                                                                                                                                                                                                                                                                                                                                                                                                                                        | Függőség | Modell             | Elfogadási kritérium                                                                                           |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| T-013-2 | **Regressziós teszt először:** a `provider-environment` téma új tesztje a `claude-subscription` leíróval, port csonkkal, ami `PATH` és `HOME` értéket ad; elvárás: mindkettő a kimenő objektumban. A mai kódon (csak a blokk) a teszt bukik; ezt a lépés kimenete rögzíti, a teszt a T-013-3-mal együtt commitolódik (a kapu közben nem lehet piros).                                                                                         | T-013-1  | `sonnet`, `high`   | A bukás kimenete (a teszt neve, a hiányzó név) a research fájlban; AC5.                                        |
| T-013-3 | A `ProcessEnvironmentPort` felsoroló metódusa és az `apps/server` valódi implementációja; a SPEC-012 3.1 tiszta függvénye (alap, szűrés, ráírás) a `provider-environment` témában; a `run-agent-step.ts` és a `create-engine.ts` kapcsolat teszt ága ezt hívja. Az O-1 (a) válasza esetén a `PassthroughEnvironmentRequirement` forrásnév mezője és a `minimax` leíró átírása, a `collect-secret-environment-values.ts` a forrásnevet gyűjti. | T-013-2  | `sonnet`, `high`   | AC1 ... AC5; a T-013-2 teszt zöld; 100 százalékos lefedettség; a `buildAgentStepOptions` bemenete változatlan. |
| T-013-4 | A tiltott listák a SPEC-012 3.2 és az O-2 ... O-5 válasza szerint, minden bejegyzés `reason` és nem üres `evidence`; az új bizonyíték konstans a hitelesítési precedencia research szekciójára. Az O-5 (a) válasza esetén a más provider titok neveinek szűrése.                                                                                                                                                                              | T-013-3  | `sonnet`, `medium` | AC2, AC3, AC6; a leíró tesztek minden új nevet tételesen állítanak.                                            |
| T-013-5 | A kimenő `env` értéke nem kerül eseménybe és naplóba: unit teszt a motor oldalán (egy ismert titok érték a port csonkban, utána a `run_event` sorok és a napló hívások keresése). Javaslat (SPEC-012 7.): a hamis CLI alfolyamat teszt az M-143 mintájára, előtte időmérés a teszt korlát alatt; ha a mért idő a korlát közelében van, a teszt nem készül el, és ez a research fájlba kerül.                                                  | T-013-4  | `opus`, `medium`   | AC7; az alfolyamat teszt vagy zöld és a mért ideje a research fájlban, vagy a kihagyás indoka ott áll.         |

### F2 fázis: a helyi indítás

| ID      | Leírás                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Függőség | Modell             | Elfogadási kritérium                                                                              |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------ | ------------------------------------------------------------------------------------------------- |
| T-013-6 | A szerver `start` scriptje (és az O-6 szerint a `dev`) az O-7 szerinti helyen, `node --env-file-if-exists=<minta helye> <belépési pont>` alakban; az O-8 szerinti együttes indítás (ha (b): a `turbo.json` szerver task env átengedése és ennek indoka a `turbo.json` melletti dokumentációban). Kézi ellenőrzés ideiglenes adatbázissal: `GET /api/providers` `200`, a böngészőből a workflow lista betölt és az SSE él.                                                                  | T-013-1  | `sonnet`, `medium` | AC8, AC9; a kézi ellenőrzés lépései és eredménye a research fájlban; valódi provider hívás nincs. |
| T-013-7 | Env minta fájl(ok) az O-9 és O-10 szerint; a `VITE_API_ORIGIN`, `VITE_STREAM_ORIGIN` és `EASTER_STREAM_DEV_ORIGIN` literálja a futó dev szerveren mérve (a böngésző által küldött `Origin` fejléc); az `EASTER_LOG_DIRECTORY` megjegyzése (O-19). Regressziós teszt: az `apps/web/playwright.config.ts` `webServer.env` mind a négy `VITE_` változót megadja (a meglévő `apps/web/src` regressziós téma mintájára). A commit előtt a minta fájlokra futtatott titok keresés nulla találat. | T-013-6  | `sonnet`, `medium` | AC10, AC12; a mért origin a research fájlban.                                                     |
| T-013-8 | `README.md`: előfeltételek (a verziók a toolchain research fájlra hivatkozva, szám nélkül), telepítés, env minta, indítás, böngésző cím, a `claude-subscription` előfeltétele, a valódi próba leírása a token figyelmeztetéssel, és hogy a szerver környezete az agenté is (SPEC-012 8.). Az érintett csomag `CLAUDE.md` fájlok `## Fájlok` táblája ugyanabban a commitban.                                                                                                                | T-013-7  | `sonnet`, `medium` | AC11; `docs:check` zöld.                                                                          |

### F3 fázis: a valódi próba

| ID       | Leírás                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Függőség                                           | Modell           | Elfogadási kritérium                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| T-013-9  | A próba eszköze az O-12 szerinti helyen, a SPEC-012 5.1 lépéseivel, az O-13 ... O-17 szerinti beállításokkal; maszkolás memóriában a lemezre írás előtt (5.2); a kimenet csak összegzés. **Ellenőrzés valódi provider nélkül**: a szerver hamis agenttel vagy egy helyi, a `/v1/messages` útvonalat válaszoló csonk ellen, hogy a teljes REST és stream út hívás nélkül igazolt legyen. A kapukon és a CI fájlmintáiban nem szerepel.                                                                                                                                           | T-013-3, T-013-6, a SPEC-012 O-12 ... O-17 lezárva | `opus`, `medium` | AC13, AC14, AC15; a csonk elleni futás kimenete a research fájlban; a kulcs értékére futtatott keresés a repóban nulla találat. |
| T-013-10 | **A valódi próba futtatása. A user kifejezett engedélyére vár.** Az engedélyt az askuserquestion tool kéri, futásonként (`minimax` `MiniMax-M3`-mal, `claude-subscription`), a beállítások (prompt, `maxTurns`, `maxBudgetUsd`, időkorlát) felsorolásával. Engedély nélkül a lépés nem fut, és a SPEC-012 státusza kimondja. Ha a user engedi, a `claude-subscription` futás egy alkalommal a javítás előtti fejen is lefut (a 2.1 hiba valódi igazolása). Az eredmény a research fájlba, maszkolva; utána az ideiglenes adatbázis eseményeiben is lefut a kulcs érték keresés. | T-013-9, user engedély                             | `opus`, `medium` | AC16; vagy a két futás összegzése a research fájlban, vagy a "nem engedélyezett" állapot a SPEC-012 fejlécében.                 |

### F4 fázis: átvezetés és zárás

| ID       | Leírás                                                                                                                                                                                                                                                                                                                                                                                                             | Függőség                   | Modell           | Elfogadási kritérium                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| T-013-11 | Átvezetés: a hiányleltár H-40 és H-42 gazdája a SPEC-012; a SPEC-009 7. szekció 2. pontja, az O-21 és az M-137 az O-18 válasza szerint; a SPEC-004 11.3 10. és 11. sora; a `packages/engine` `CLAUDE.md`; a szabálykönyv 9. szekciója (a teljes környezet szabálya, egy mondat, forrással). Utána a merge kapu (2.) a PR fején, az adverzariális átvizsgálás és a SPEC-012 9. kritérium tábla tételes ellenőrzése. | T-013-5, T-013-8, T-013-10 | `opus`, `medium` | AC17, AC18; a kritérium tábla a research fájlban; a merge kapu adatai a PR leírásában; a user értesítve a branch nevével (push a user dolga). |

## 5. Fázis függőségek

```
T-013-1 ─┬─> T-013-2 ─> T-013-3 ─> T-013-4 ─> T-013-5 ──────────────┐
         └─> T-013-6 ─> T-013-7 ─> T-013-8 ─────────────────────────┤
                T-013-3 + T-013-6 ─> T-013-9 ─> T-013-10 (user engedély) ─┴─> T-013-11
```

Az F1 és az F2 egymástól független, párhuzamosan is futhat. A T-013-10 a user engedélye nélkül nem
indul; ha a user nem engedélyezi, a T-013-11 a "nem engedélyezett" állapottal zár.

## 6. Kockázat kezelés a végrehajtás alatt

| Kockázat                                                                          | Kezelés                                                                                                          |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Ütközés a SPEC-009 branchével (`build-agent-step-options.ts`, `create-engine.ts`) | a branch a friss `main`-ről; a T-013-11 előtt a `main` bemergelése; a SPEC-009 átvezetése az O-18 szerint        |
| Véletlen valódi hívás egy teszt vagy a T-013-9 közben                             | a T-013-9 csonk ellen fut, a kulcs nincs a futtató környezetben; a T-013-10 előtt askuserquestion                |
| Titok a minta fájlban vagy a research fájlban                                     | a commit előtti kulcs érték keresés (szabálykönyv 9.), a minta csak nevet és forrásos, nem titkos értéket hordoz |
| A hamis CLI alfolyamat teszt a teszt korlát közelében                             | a T-013-5 előbb mér, és a korlát közelében nem viszi be a tesztet (szabálykönyv 12. "időzített bombák")          |

## 7. Definition of Done

- A SPEC-012 9. szekciójának minden kritériuma teljesül, vagy (AC16) a "nem engedélyezett" állapot
  kimondva.
- A kilenc kapu, a teljes e2e és a `coverage:e2e:report` zöld a PR fején, a merge kapu adataival a
  PR leírásában.
- A research fájl tartalmazza a T-013-1, T-013-2, T-013-5, T-013-6, T-013-7, T-013-9 és (ha
  engedélyezett) a T-013-10 eredményét.
- Minden lépés önálló, zöld commit; a user értesítve a branch nevével.
