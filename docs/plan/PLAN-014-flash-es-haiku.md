# PLAN-014: A Flash csere, a két kulcsnév és a thinking átadás javításának végrehajtási terve

|         |                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------- |
| Státusz | végrehajtásra kész: a SPEC-013 O-1 ... O-7 a user 2026-10-27-i döntéseivel lezárva (az O-7 elfogadott nyitott pont) |
| Dátum   | 2026-10-27                                                                                                          |
| Spec    | [`../spec/SPEC-013-flash-es-haiku.md`](../spec/SPEC-013-flash-es-haiku.md)                                          |
| Forrás  | [`../research/2026-10-27-flash-es-haiku.md`](../research/2026-10-27-flash-es-haiku.md)                              |
| Branch  | `feat/spec-013-flash-es-haiku`                                                                                      |

Ez a terv a SPEC-013-at egyenként ellenőrizhető lépésekre bontja. A számozás: a PLAN-012 a SPEC-009-é
(a `feat/spec-009-beallitasok` branchen), a PLAN-013 a SPEC-012-é, ezért ez a PLAN-014. Minden
lépéshez azonosító, leírás, függőség, a végrehajtó subagent `model` és `effort` beállítása és
elfogadási kritérium tartozik, a SPEC-013 10. szekciójának kritérium számára hivatkozva (`ACn`).

## 1. Előfeltételek

| Feltétel                  | Elvárt érték                                                            | Ellenőrzés                        |
| ------------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| SPEC-013 nyitott kérdései | O-1 ... O-6 lezárva, az O-7 elfogadott nyitott pont, átvezetve a specbe | a SPEC-013 11. szekciója          |
| Feature branch            | `feat/spec-013-flash-es-haiku`, a friss `main`-nel                      | `git rev-parse --abbrev-ref HEAD` |
| A mai állapot zöld        | a kilenc kapu a kiinduló fejen                                          | a T-014-1 kimenete                |
| Tiszta munkakönyvtár      | nincs uncommitted változás                                              | `git status --porcelain` üres     |

A `main` védett, a zárás PR-rel történik. `npm` és `npx` nem használható. Pusholni a sandboxból csak a
user által adott hitelesítéssel lehet; force push tilos.

**Valódi API hívás kizárólag a T-014-13 lépésben**, a user 2026-10-27-i engedélyével és a futás előtti,
a SPEC-013 6. szerinti megerősítéssel. Minden más lépés hamis agenttel vagy port csonkkal dolgozik.

## 2. Kapuk

**Minden lépés végén a kilenc kapu** (`format:check`, `typecheck`, `lint`, `test`, `build`,
`docs:check`, `check:casing`, `check:graph`, `check:db-drift`) nulla kilépési kóddal fut, és a lépés
csak ezután commitolható; a mérvadó lista a `.claude/CLAUDE.md` 8. szekciója. A lint
`bun x turbo run lint --concurrency=1` alakban fut, nehéz parancs `flock /tmp/kapu-gep.lock` alatt.

**A merge kapu** (a CI ki van kapcsolva) a T-014-12 lépésben: a friss `main` bemergelése után a PR
fején a kilenc kapu, a teljes e2e nyolc shardban (`flock /tmp/playwright-gep.lock`, legfeljebb 3
worker) és a `coverage:e2e:report` a küszöbbel; a parancsok, a kilépési kódok, a tesztszámok, a
lefedettségi számok és a fej SHA-ja a PR leírásába kerül. Ha a `main` a futás után elmozdul, a kaput
újra kell futtatni.

## 3. Modell hozzárendelés

| Modell, effort     | Mikor                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sonnet`, `medium` | a 3.2 táblázat szerinti leíró mezők, a katalógus bejegyzések, a teszt adat cseréje, a dokumentum átvezetések                                      |
| `sonnet`, `high`   | az `EnvironmentRequirement` új ága és a feloldás, a titok gyűjtés és a drift védelem, a protokoll névcsoport (több csomag, meghatározott szabály) |
| `opus`, `medium`   | a thinking átadás javítása (T-014-9, hibajavítás), az adverzariális átvizsgálás és a kritérium tábla (T-014-11), a valódi próba kiértékelése      |

A `model` és az `effort` mező soha nem hagyható üresen (gyökér `CLAUDE.md` 6. szekció).

## 4. Todo lépések

A SPEC-013 10. szekciójának kritérium számai (`ACn`) a 2026-10-27-i átvezetés utániak.

### F0 fázis: kiindulás

| ID      | Leírás                                                                                                                                                                                                                                                                                     | Függőség                    | Modell             | Elfogadási kritérium                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ------------------ | ----------------------------------------------------------------------- |
| T-014-1 | Kiindulás: a branch a friss `main`-nel, tiszta munkakönyvtár, a fej SHA-ja a research fájl új szekciójába. A SPEC-013 11. szekciójának user döntései átvezetve a specbe és ebbe a tervbe; a pinelt CLI bináris `claude-haiku-4-5` ismerete és az effort források a research-be (O-1, O-6). | SPEC-013 O-1 ... O-7 döntés | `sonnet`, `medium` | a spec 11. szekciójában O-1 ... O-6 "Lezárva", O-7 nyitva a két mezővel |

### F1 fázis: a modell csere

| ID      | Leírás                                                                                                                                                                                                                                                                                                                                                                     | Függőség | Modell             | Elfogadási kritérium                                       |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | ---------------------------------------------------------- |
| T-014-2 | Forrás konstansok: a research 2. szekciójának URL-jei nevesített `DOC_*` konstansként és egy `RESEARCH_*` konstans a `provider-capability` `measurement-document` témájában, a barrelben exportálva.                                                                                                                                                                       | T-014-1  | `sonnet`, `medium` | csak research-ben álló URL; a barrel nevesített újraexport |
| T-014-3 | A `provider-minimax` csere a SPEC-013 3.1 és 3.2 szerint: modell és család azonosító, a modell bejegyzés, a thinking (`'M3.1-Flash'` család, `['adaptive']`), az effort, a kért `unknown` mezők a `blockedBy` listával, a rate limit `appliesTo`, a `measuredAt`, a tiltott lista indoklásainak szövege (3.3). Új `descriptor.spec.ts` mezőnként a 3.2 táblázatot állítja. | T-014-2  | `sonnet`, `medium` | AC2, AC3; a csomag tesztjei 100 százalékon                 |
| T-014-4 | A motor oldali igazolás, kódváltozás nélkül: unit teszt a valódi `minimax` leíróval az `apps/server` csomagban (ott látszik a leíró és a motor együtt), hogy (1) a `thinking: 'disabled'` lépés `thinking_mode_unsupported`, (2) a modell nélküli lépés kimenő modellje `MiniMax-M3.1-Flash[1m]`, `includePartialMessages` `false`.                                        | T-014-3  | `sonnet`, `medium` | AC4, AC5                                                   |
| T-014-5 | A teszt adat és a szöveg csere a SPEC-013 3.5 táblázata szerint (`RunEventRow` mondat és teszt, a felsorolt `.spec.ts`/`.spec.tsx` fájlok, az érintett `CLAUDE.md`-k); a 3.6 kivételek érintetlenek. Adat migráció nincs (O-3).                                                                                                                                            | T-014-3  | `sonnet`, `medium` | AC1 (a `git grep` kimenete a PR leírásában)                |

### F2 fázis: a két kulcsnév

| ID      | Leírás                                                                                                                                                                                                                                                                                                                                                                                                                                      | Függőség | Modell           | Elfogadási kritérium |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------- | -------------------- |
| T-014-6 | **Teszt először:** a `resolve-required-environment-value.spec.ts` és a `build-outgoing-environment.spec.ts` új esetei (SPEC-013 8.) a mai kódon bukik. Utána az `EnvironmentRequirement` `process_env_alternatives` ága (4.4), a feloldás, a kimerítő `switch` minden ágazó helyen, a `minimax` `requiredEnv` bejegyzése és a tiltott lista `ANTHROPIC_API_KEY` indoklása (4.2). A `claude-subscription` tiltott listája változatlan (4.5). | T-014-3  | `sonnet`, `high` | AC6, AC7, AC8, AC9   |
| T-014-7 | A titok gyűjtés minden bemeneti névre (4.6), a drift védelem az alternatív nevekre (4.5), a `turbo.json` `globalPassThroughEnv`, a két `.env.example`, a `README.md`, a `tools/wire-probe` kulcs olvasása mindkét néven (4.7).                                                                                                                                                                                                              | T-014-6  | `sonnet`, `high` | AC10, AC11, AC16     |
| T-014-8 | O-4 (a): a `ProviderSummary` `requiredEnvNames` névcsoportjai (4.8), a `list-providers` kitöltése, a létrehozó ablak " vagy " kijelzése, a fixtúrák (unit és e2e).                                                                                                                                                                                                                                                                          | T-014-6  | `sonnet`, `high` | AC12                 |

### F3 fázis: a thinking javítás és a próba

| ID       | Leírás                                                                                                                                                                                                                                                                                                            | Függőség                                     | Modell             | Elfogadási kritérium                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------ | ----------------------------------------------------------------- |
| T-014-9  | **Teszt először:** a `build-agent-step-options.spec.ts` a `thinking` mezőt objektumként várja (a mai kódon bukik). Utána a leképező függvény (SPEC-013 5.2), az `AgentStepOptions.thinking` típusa, és az `apps/server` típusszintű teszt az SDK `Options['thinking']` típusával (5.3).                           | T-014-1                                      | `opus`, `medium`   | AC13                                                              |
| T-014-10 | A próba eszköz: `MINIMAX_MODEL_ID`, a `claude-subscription` alapmodellje `claude-haiku-4-5`, az `effort` providerenként (SPEC-013 6., O-6), a `run-probe.spec.ts` és a `build-probe-graph.spec.ts`; a SPEC-012 5.1 és 47., 378. sora mellé "SPEC-013 felülírja" jelölés, a PLAN-013 T-013-10 sora mellé ugyanígy. | T-014-3                                      | `sonnet`, `medium` | AC14                                                              |
| T-014-11 | Adverzariális átvizsgálás és kritérium tábla: minden AC-hez a bizonyító teszt neve vagy parancs kimenete; minden `known` leíró mező bizonyítéka a research-ben visszakereshető; a `MiniMax-M3` előfordulások listája a 3.6 kivételekkel egyezik. Eredmény a research fájl új szekciójában.                        | T-014-5, T-014-7, T-014-8, T-014-9, T-014-10 | `opus`, `medium`   | AC1 ... AC17 tételesen, nyitott tétel nélkül (az O-7 kivételével) |

### F4 fázis: zárás és valódi próba

| ID       | Leírás                                                                                                                                                                                                                                                                                                                                                                               | Függőség                                   | Modell                         | Elfogadási kritérium                                                  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------ | --------------------------------------------------------------------- |
| T-014-12 | Merge kapu a friss `main` bemergelése után (2. szekció), push, PR leírás a kapuk adataival.                                                                                                                                                                                                                                                                                          | T-014-11                                   | `sonnet`, `medium`             | AC17; a PR leírásban a parancsok, kilépési kódok, számok és a fej SHA |
| T-014-13 | **Valódi próba**, a merge után: `bun run probe:real-provider -- minimax` és `bun run probe:real-provider -- claude-subscription`. Az összegzés a research fájl új szekciójába; a kulcs értékére futtatott keresés nulla találat a commit előtt. Ha a futás `2013`-as `400`-at vagy ismeretlen modell hibát ad, a SPEC-013 9. kockázat táblázata szerinti teendő, új nyitott ponttal. | T-014-12, a user futás előtti megerősítése | `opus`, `medium` (kiértékelés) | AC18, AC19                                                            |

## 5. Fázis függőségek

```
T-014-1
  ├─ T-014-2 ── T-014-3 ─┬─ T-014-4
  │                       ├─ T-014-5 ──────────────────────┐
  │                       ├─ T-014-6 ─┬─ T-014-7 ───────────┤
  │                       │           └─ T-014-8 ───────────┤
  │                       └─ T-014-10 ──────────────────────┤
  └─ T-014-9 ───────────────────────────────────────────────┴─ T-014-11 ── T-014-12 ── T-014-13
```

## 6. Kockázat kezelés a végrehajtás alatt

| Kockázat                                                                                                              | Teendő                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Egy `unknown`-ra álló mező miatt egy meglévő motor vagy szerver teszt bukik (például a `serverTools` tiltás elvárása) | a teszt a leíró új tényét követi; ha a teszt egy termék viselkedést őriz, ami a mezőn állt, a végrehajtó jelzi, nem gyengíti csendben |
| A 100 százalékos lefedettség az új `source` ágon és a thinking leképezésen                                            | minden ág valós bemenettel tesztelt; garantáltan sosem futó ág nem kerül be (szabálykönyv 5.)                                         |
| A valódi próba a pinelt CLI miatt bukik                                                                               | a SPEC-013 9. táblázata; új nyitott pont, nem csendes javítás                                                                         |

## 7. Definition of Done

- A SPEC-013 AC1 ... AC17 teljesül, a kritérium tábla a research fájlban.
- A merge kapu zöld a PR fején, az adatok a PR leírásában.
- A szabálykönyv 9. szekciója a SPEC-013 7. szerinti (már a spec első commitjában).
- A T-014-13 eredménye a research fájlban (AC18, AC19).
