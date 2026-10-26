# SPEC-012: Helyi indítás és valódi provider próba

|          |                                                                                                                                                                                                                                                                                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet (a nyitott kérdések a 11. szekcióban, user döntésre várnak)                                                                                                                                                                                                                                                                                                             |
| Dátum    | 2026-10-26                                                                                                                                                                                                                                                                                                                                                                       |
| Előzmény | [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md) (a leírók, a titokkezelés), [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) (11.3, 10. és 11. sor: a kimenő env), [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md) (4.2, O-8), [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) (O-4, O-6) |
| Bemenet  | [`../research/2026-10-26-helyi-inditas-es-valodi-proba.md`](../research/2026-10-26-helyi-inditas-es-valodi-proba.md) (M-141 ... M-144 és a források); a hatókör hiányleltár H-40 és H-42 tétele (`docs/research/2026-10-26-hatokor-hianyleltar.md`, a `feat/spec-009-beallitasok` branchen)                                                                                      |
| Kimenet  | a kimenő SDK környezet javítása, helyi indítási út (scriptek, env minta, `README.md`), kézzel indítható valódi provider próba a repóban                                                                                                                                                                                                                                          |
| Terv     | [`../plan/PLAN-013-helyi-inditas-es-valodi-proba.md`](../plan/PLAN-013-helyi-inditas-es-valodi-proba.md). **A számozás eltér:** a PLAN-011 a SPEC-011-é, a PLAN-012 a SPEC-009-é (a `feat/spec-009-beallitasok` branchen, még nincs a `main`-en), ezért a SPEC-012 terve a PLAN-013.                                                                                             |

---

## 1. Cél és hatókör

**A user döntése (2026-10-26): "Saját kis spec, elsőként".** Ma nincs leírva, hogyan kell az
alkalmazást helyben elindítani, és a termék soha nem futott valódi provider ellen: minden szerver
mérés hamis agenttel készült. Közben egy valódi hiba is előkerült (2.1).

**A user döntése (2026-10-26): "Teljes környezet, tiltott változók nélkül".** A kimenő
`Options.env` a szerver `process.env`-je, a provider tiltott változói kiszűrve, plusz a provider
saját változói. A `claude-subscription` provider tiltott listája legalább az `ANTHROPIC_API_KEY`,
`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL` és a hitelesítési precedenciában felettük álló
változók. A kapcsolat teszt is ugyanezen az úton megy.

### Amit eldönt

1. A kimenő `env` összeállításának szabálya és helye (3. szekció).
2. A helyi indítás scriptjei, az env minta fájl alakja és a `README.md` indítási leírása (4.).
3. A valódi provider próba alakja, helye, korlátai és a futtatás engedélyhez kötése (5.).

### Amit NEM dönt el (nem cél)

- Éles telepítés, folyamatfelügyelet, HTTPS, hitelesítés a szerver előtt.
- A szerver konfigurációs számainak (napló rotáció, életben tartás, lista lapméret) értéke: ezekre
  nincs forrás (SPEC-006 O-3, O-4, SPEC-007 O-6), és ez a spec sem talál ki értéket (11. O-10).
- A SPEC-009 egyéb tárgyai (`mcpServers`, `settingSources`, skill, Beállítások képernyő).
- A `MiniMax-M3`-on kívüli modell. Más MiniMax modellt ez a spec nem említ és nem próbál.

---

## 2. Megerősített tények, forrással

### 2.1 A kimenő `env` ma csak a provider blokkja (a hiba)

| Tény                                                                                                                               | Forrás                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A lépés `Options.env` mezője a `buildProviderEnvironmentBlock` kimenete.                                                           | `packages/engine/src/agent-step/build-agent-step-options.ts:82`; `packages/engine/src/agent-step/run-agent-step.ts:250`                                             |
| A blokk kizárólag a `requiredEnv[]` neveiből épül; a `disallowedEnv[]` csak a `requiredEnv[]` ütközését szűri.                     | `packages/engine/src/provider-environment/build-provider-environment-block.ts:19-42`                                                                                |
| A `claude-subscription` `requiredEnv[]` listája üres, tehát a blokk `{}`.                                                          | `packages/provider-claude-subscription/src/environment/required-environment.ts:3-4`                                                                                 |
| A kapcsolat teszt ugyanezt a blokkot adja, és mást nem.                                                                            | `packages/engine/src/engine-port/create-engine.ts:186-198`                                                                                                          |
| Megadott `env` mellett az alfolyamat környezete pontosan ez az objektum (plusz két SDK által pótolt név): `PATH` és `HOME` nélkül. | telepített `sdk.d.ts:1482-1498`; <https://code.claude.com/docs/en/agent-sdk/typescript>; CHANGELOG `0.2.113`, `0.3.149`; saját mérés M-143 (research 3.)            |
| A folyamat env port ma csak név szerinti olvasást ad (`read(name)`), a teljes környezet felsorolására nincs metódus.               | `packages/engine/src/engine-port/process-environment-port.ts:93-95` (a fájl 7-9. sora); `apps/server/src/engine-assembly/create-process-environment-reader.ts:9-13` |

**Ami nem ellenőrzött:** hogy a valódi CLI `PATH` és `HOME` nélkül elbukik-e. A mérés csak azt
igazolja, hogy a két változó hiányzik (M-143); a valódi viselkedést az 5. szekció próbája méri.

### 2.2 A hitelesítési precedencia

A Claude Code több hitelesítő jelenléte esetén ebben a sorrendben választ: felhő provider
(`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`),
`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `apiKeyHelper` (beállítás fájl), `CLAUDE_CODE_OAUTH_TOKEN`,
Anthropic profil és federáció (`ANTHROPIC_PROFILE`, illetve együtt `ANTHROPIC_FEDERATION_RULE_ID` és
`ANTHROPIC_ORGANIZATION_ID`), végül a `/login` előfizetéses hitelesítése. Elsődleges forrás
<https://code.claude.com/docs/en/authentication>, megerősítés
<https://code.claude.com/docs/en/env-vars>, <https://code.claude.com/docs/en/llm-gateway-connect> és
<https://github.com/anthropics/claude-code/issues/39126> (research 4.).

### 2.3 A helyi indítás mai állapota

| Tény                                                                                                                                       | Forrás                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Az `apps/server` scriptjei: `typecheck`, `lint`; nincs `start` és `dev`.                                                                   | `apps/server/package.json`                                                                                                           |
| A gyökér `dev` scriptje `turbo run dev`; `dev` scriptje csak az `apps/web`-nek van (`vite`).                                               | `package.json` (`"dev": "turbo run dev"`); `apps/web/package.json`                                                                   |
| A `README.md` egyetlen sor.                                                                                                                | `README.md`                                                                                                                          |
| A szerver belépési pontja `apps/server/src/main.ts`, a `process.env` és a `process.cwd()` megy a `runStartupSequence` hívásba.             | `apps/server/src/main.ts:1-4`                                                                                                        |
| A szerver hat kötelező env változója alapérték nélkül, a `EASTER_STREAM_DEV_ORIGIN` és az `EASTER_LOG_LEVEL` nem kötelező.                 | `apps/server/src/server-config/server-config.ts:83-131`; `apps/server/src/server-config/environment-variable-name.ts`                |
| Az adatbázis útvonala `EASTER_DB_FILE`, hiányában a `process.cwd()` alatti `.data/easter-workflow-builder.sqlite`.                         | `apps/server/src/startup-sequence/run-startup-sequence.ts:47-50, 65`; `packages/db/src/database-file/environment-variable-name.ts:7` |
| A web négy kötelező `VITE_` változója alapérték nélkül.                                                                                    | `apps/web/src/frontend-config/read-frontend-config.ts:13-16, 59`                                                                     |
| A Vite `/api` proxy célja a `VITE_STREAM_ORIGIN`.                                                                                          | `apps/web/vite.config.ts` (`server.proxy`)                                                                                           |
| A szerver portja `3001`, a Vite dev szerver az alapértelmezett `5173` porton, a REST a Vite proxyn, az SSE közvetlenül a backend originre. | `.claude/CLAUDE.md` 11. szekció (SPEC-008 3.)                                                                                        |
| A szerver statikus felületet nem szolgál ki (SPEC-006 O-8).                                                                                | `docs/spec/SPEC-006-szerver-alkalmazas.md:732`                                                                                       |
| A szerver build nélkül, `node apps/server/src/main.ts` alakban elindul a pinelt Node alatt.                                                | saját mérés M-141 (research 1.); <https://nodejs.org/docs/latest-v26.x/api/typescript.html>                                          |
| Az `EASTER_LOG_DIRECTORY` értéke a `pino-roll` `file` mezője, tehát fájl útvonal előtag (a napló `<érték>.1.log`).                         | saját mérés M-142 (research 2.)                                                                                                      |
| A `bun run` csomag scriptje a csomag könyvtárában fut; a szerver ott indítva az `apps/server/.data/` alá nyitná az adatbázist.             | saját mérés M-144 (research 6.)                                                                                                      |
| A Node `--env-file` és `--env-file-if-exists` kapcsolója beépített, a környezetben már álló változó nyer a fájlbeli ellen.                 | <https://nodejs.org/docs/latest-v26.x/api/cli.html#--env-filefile> (egy hivatalos forrás, research 5.)                               |
| A Turborepo alapból `strict` env módban fut: a task csak a nevesített és a beépített rendszer változókat látja.                            | <https://turborepo.com/docs/crafting-your-repository/using-environment-variables> (research 5.)                                      |
| A `.gitignore` a `.env` és `.env.*` fájlokat kizárja, a `.env.example` kivétel.                                                            | `.gitignore` ("titkok" blokk)                                                                                                        |

### 2.4 A MiniMax kulcs neve

A `minimax` leíró `ANTHROPIC_AUTH_TOKEN` követelményét a motor a saját nevén olvassa a folyamat
környezetéből, a leíró szövege és a SPEC-000 táblája viszont a `MINIMAX_API_KEY` névből való
átvezetést írja (research 7.). A user `.env` fájljában (csak nevek olvasva) `MINIMAX_API_KEY` áll.
Ez döntést igényel (11. O-1).

---

## 3. A kimenő környezet

### 3.1 A szabály

A lépés és a kapcsolat teszt kimenő `env` objektuma ugyanabból a tiszta függvényből jön, ebben a
sorrendben:

1. **Alap:** a szerver folyamat teljes környezete (a port új, felsoroló metódusán át, 3.3).
2. **Szűrés:** a provider `disallowedEnv[]` minden neve kikerül.
3. **Ráírás:** a provider `requiredEnv[]` blokkja (a mai `buildProviderEnvironmentBlock` kimenete)
   felülírja az alapot. A tiltott név a ráírásban sem jelenhet meg (a mai szabály marad,
   `build-provider-environment-block.ts:13-17`).

A `requiredEnv[]` hiányzó `process_env_passthrough` változója változatlanul `missing_provider_env`
hibát ad, a névvel, érték nélkül.

### 3.2 A tiltott listák

A végleges tartalom a 11. szekció O-2 ... O-5 válaszán múlik; a minimum a user döntése szerint:

| Provider              | Minimum (user döntés)                                                                                                                                                    | Döntésre vár                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude-subscription` | `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY` (precedencia 1-3, 2.2) | `CLAUDE_CODE_OAUTH_TOKEN` (O-3); `ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID` (O-2); a precedencia lapon nem szereplő provider választók (O-2) |
| `minimax`             | a mai három név (`CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING`, `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, `MAX_THINKING_TOKENS`)                                       | a teljes környezet miatt új nevek (O-4)                                                                                                                                            |
| mindkettő             |                                                                                                                                                                          | a másik provider titkainak kiszűrése (O-5)                                                                                                                                         |

Minden új `DisallowedEnvironmentRequirement` bejegyzés `reason` és nem üres `evidence` mezőt kap
(`packages/provider-capability/src/environment/disallowed-environment-requirement.ts`, a leíró
bizonyíték kényszere, `.claude/CLAUDE.md` 9.). A hitelesítési precedencia forrása új research
szekció azonosítóként kerül a `provider-capability` bizonyíték konstansai közé (a mai
`RESEARCH_GATEWAY` mintájára); a pontos név a PLAN-013 T-013-4 lépésében dől el.

### 3.3 A port és a hely

- A `ProcessEnvironmentPort` (`packages/engine/src/engine-port/process-environment-port.ts`) egy
  második, csak olvasó metódust kap, ami a teljes környezetet adja `Readonly<Record<string,
string>>` alakban (az `undefined` értékű bejegyzések nélkül). A valódi implementáció az
  `apps/server` `create-process-environment-reader.ts` fájlja.
- Az összeállítás a `provider-environment` téma új tiszta függvénye; a
  `build-agent-step-options.ts` és a `create-engine.ts` kapcsolat teszt ága ezt hívja. A
  `buildAgentStepOptions` bemenete (`environmentBlock`) nem változik, csak a tartalma.
- A kimenő `env` értéke nem kerülhet naplóba, eseménybe, pillanatképbe és hibaüzenetbe. A forrás
  szerint a motor az `Options` objektumot csak a runnernek adja át
  (`packages/engine/src/agent-step/run-agent-step.ts:270-278`), az eseménybe az SDK üzenetei
  kerülnek (`:123`). Hogy az SDK üzenetei (például a `system` `init`) hordoznak-e környezeti értéket,
  **nem ellenőrzött**: a PLAN-013 regressziós tesztje a motor oldalát, a valódi próba a tárolt
  eseményeket ellenőrzi (a kulcs értékére futtatott keresés az ideiglenes adatbázison).

### 3.4 Ami változatlan marad

- A `minimax` `ANTHROPIC_BASE_URL` literálja és a kulcs `Bearer` útja (`requiredEnv[]`), a `ráírás`
  lépés miatt egy a szerver környezetében álló más `ANTHROPIC_BASE_URL` nem nyer.
- A `secret: true` értékek naplóbeli maszkolása (`apps/server/src/startup-sequence/collect-secret-environment-values.ts`).

---

## 4. Helyi indítás

### 4.1 Scriptek

- **Szerver:** `start` script, Node runtime, build nélkül (M-141), a `.env` betöltése a Node
  beépített `--env-file-if-exists` kapcsolójával (új függőség nem kell). `bun run` alatt fut, `npx`
  nincs, `bun:` modul nincs. A script helye és a munkakönyvtár (ebből az adatbázis útvonala) a 11. O-7 válaszán múlik.
- **Web:** a meglévő `apps/web` `dev` script (`vite`), változatlanul.
- **Együttes indítás:** a 11. O-8 válasza szerint. A Turborepo `strict` env módja a szerver taskból
  a nem nevesített változókat kiszűrné, ami a 3.1 "teljes környezet" szabályát csendben szűkítené;
  ezt a választott út kifejezetten kezeli (vagy nem turbo alatt fut a szerver, vagy a task env
  átengedése kimondott).
- Figyelő módú `dev` script a szerverre: O-6.

### 4.2 Env minta

- Commitolt minta fájl(ok), kizárólag változónevekkel és nem titkos, forrással alátámasztott
  értékekkel. Titok értéke soha (`.claude/CLAUDE.md` 7. és 9.).
- Forrásos érték: `EASTER_SERVER_PORT=3001` és a web/szerver origin (szabálykönyv 11.); a
  `VITE_API_ORIGIN`, `VITE_STREAM_ORIGIN` és `EASTER_STREAM_DEV_ORIGIN` pontos literálját a
  végrehajtó a futó dev szerveren mérve rögzíti (a `localhost` és a `127.0.0.1` eltérő origin).
- Forrás nélküli szám (napló méret, gyakoriság, megőrzés, életben tartás, lista és visszajátszás
  limit): a mintában **érték nélkül**, megjegyzéssel, hogy kitöltendő (O-10).
- Az `EASTER_LOG_DIRECTORY` megjegyzése kimondja, hogy fájl útvonal előtag (M-142, O-19).
- A provider változók: a `minimax` kulcs neve az O-1 válasza szerint; a `claude-subscription`
  nem kér env változót (a `/login` hitelesítését használja).
- Egy vagy két fájl: O-9.

### 4.3 `README.md`

Előfeltételek (Node, Bun, a pinelt verziók a `docs/research/2026-08-26-toolchain.md` fájlra
hivatkozva, szám nélkül), `bun install --frozen-lockfile`, az env minta másolása, a két folyamat
indítása, a böngésző címe, a `claude-subscription` előfeltétele (Claude Code bejelentkezés), és a
valódi próba (5.) leírása a figyelmeztetéssel, hogy valódi tokenbe kerül.

### 4.4 Statikus kiszolgálás

A SPEC-006 O-8 nyitva marad, vagy ez a spec zárja: 11. O-11.

### 4.5 A kapuk és az e2e érintetlensége

- A kilenc kapu és az e2e nem olvas `.env` fájlt: a Playwright `webServer.env` mind a négy `VITE_`
  változót beállítja (`apps/web/playwright.config.ts:77-81`), és a Vite szerint a már létező
  változó nyer a `.env` fájl ellen (research 5.). Egy helyi `apps/web/.env` tehát az e2e buildet
  nem változtatja meg; a PLAN-013 egy regressziós teszttel rögzíti, hogy a `webServer.env` mind a
  négy változót megadja.
- Az új script a `test` kapu lefedettségébe nem kerül (nem `src/` alatti TypeScript, vagy ha az,
  unit teszt fedi).

---

## 5. Valódi provider próba

### 5.1 Alak

Egy kézzel indítható, a repóban élő, verziókövetett eszköz (a szabálykönyv 12. szekció
tanulsága: minden bizonyíték előállító eszköz a repóba tartozik). Helye: O-12. Lépései:

1. A valódi szerver indítása ideiglenes adatbázissal és napló útvonallal (O-13), a 3. szekció
   javítása után.
2. `PUT /api/settings` (a vizsgált provider mint alapértelmezett), `POST /api/workflows`,
   `PUT /api/workflows/:id/graph` egy minimális gráffal: Start és egyetlen `agent_step`, rövid
   prompttal, a lépésen a `providerId`, `MiniMax-M3` esetén a `modelId`, `maxTurns` és
   `maxBudgetUsd` az O-14 és O-15 szerint.
3. `GET /events` stream feliratkozás, `POST /api/workflows/:id/runs`, várakozás a `run_finished`
   keretre egy felső időkorláttal (értéke: O-15 kérdéssel együtt, forrás nélkül nem adunk számot).
4. A kimenet összegzése: a futás állapota, a lépés `result` `subtype`-ja, a `num_turns`, a
   kimeneti szöveg hossza (a szöveg maga nem kell), a hibaosztály, ha volt.
5. Két futás: egyszer `minimax` providerrel `MiniMax-M3` modellel, egyszer `claude-subscription`
   providerrel. A `claude-subscription` futás egyben a 2.1 hiba valódi igazolása: a javítás előtti
   fejen (ha a user engedi) és utána.

### 5.2 Titokkezelés

A szabálykönyv 9. szekciója szerint: a kulcs csak env változóból jön; az `authorization` és
`x-api-key` fejléc és a kulcs értékének minden előfordulása `REDACTED`, még a lemezre írás előtt,
memóriában; nyers, maszkolatlan artefaktum nem kerül lemezre. A próba csak összegzést ír, és a
commit előtt a kulcs értékére futtatott keresés nulla találatot ad.

### 5.3 Engedély és kapuk

- **A végrehajtó agent a próbát csak a user kifejezett, az adott futásra szóló engedélyével
  futtatja.** A user szava: "úgy hajtsd meg a minimax api-t hogy nincs végtelen tokenem!".
- A próba nem tagja a kilenc kapunak, nem fut a CI-ban (a CI nem kap kulcsot, SPEC-001 12.), és
  nincs a `test` kapu fájlmintáiban.
- Az eredmény a research fájl új szekciójába kerül, a nyers számok ott, a szabálykönyvbe nem.

---

## 6. Hova kerül a kód

| Hely                                                                 | Változás                                                                                              |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `packages/engine` `engine-port`                                      | a `ProcessEnvironmentPort` felsoroló metódusa                                                         |
| `packages/engine` `provider-environment`                             | a teljes kimenő környezet tiszta függvénye és tesztje                                                 |
| `packages/engine` `agent-step`, `engine-port`                        | a hívás helye (`run-agent-step.ts`, `create-engine.ts`)                                               |
| `packages/provider-claude-subscription`, `packages/provider-minimax` | a `disallowed-environment.ts` bővítése (O-2 ... O-5); O-1 szerint a `required-environment.ts`         |
| `packages/provider-capability`                                       | O-1 (a) válasza esetén a `PassthroughEnvironmentRequirement` forrásnév mezője; új bizonyíték konstans |
| `apps/server` `engine-assembly`                                      | a port valódi implementációja; O-5 esetén a titok nevek gyűjtése                                      |
| `apps/server/package.json`, gyökér `package.json`, `turbo.json`      | scriptek az O-7, O-8 szerint                                                                          |
| gyökér és/vagy `apps/web`                                            | env minta (O-9)                                                                                       |
| `README.md`                                                          | indítási leírás                                                                                       |
| O-12 szerint                                                         | a valódi próba eszköze                                                                                |
| `docs/research/`                                                     | a próba eredménye                                                                                     |

---

## 7. Tesztelés

- **Unit (100 százalék, kizárás nélkül):** a 3.1 függvény minden ága: alap másolás, tiltott név
  törlése, a `requiredEnv[]` ráírása az alap fölé, a tiltott és kötelező ütközés, a hiányzó kötelező
  változó hibája. A két provider leíróval: `claude-subscription` mellett a tiltott minimum (3.2)
  egyike sem kerül ki, a `PATH` és a `HOME` kikerül; `minimax` mellett az `ANTHROPIC_BASE_URL` a
  literál, a kulcs a forrásából.
- **Regressziós teszt a hibára:** a régi kódon (csak a blokk) elbukik, mert a `PATH` hiányzik.
- **A kapcsolat teszt:** ugyanaz a környezet megy ki, mint a lépésé (port csonkkal, a meglévő
  `create-engine.spec.ts` mintájára).
- **Az alfolyamat szintje (javaslat, nem döntés):** az M-143 hamis végrehajtható mintájára egy
  `apps/server` teszt, ami a valódi SDK `query()` hívást egy hamis CLI-vel futtatja, és a kapott
  nevek közt a `PATH`-ot és a `HOME`-ot várja. Hálózatot nem érint. Hogy belefér-e a teszt
  időkorlátba (szabálykönyv 12. "időzített bombák"), mérni kell.
- **Indítás:** a `start` script egy szerver folyamatot indít ideiglenes adatbázissal, a
  `GET /api/providers` `200`; ez kézi ellenőrzés a PLAN-ban, nem kapu.

---

## 8. Kockázatok

| Kockázat                                                                                                 | Kezelés                                                                               |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A teljes környezettel a lépés eszközei (például a `Bash`) a szerver minden változóját látják, titkot is. | O-5; a `README.md` kimondja, hogy a szerver környezete az agenté is.                  |
| Egy a szerver környezetében álló hitelesítő átirányítja a `minimax` lépést (precedencia 1. szint).       | O-4.                                                                                  |
| Ütközés a SPEC-009 branchével (ugyanazok a motor fájlok, a SPEC-009 7.2 és O-21 ugyanerről szól).        | O-18; a PLAN-013 a friss `main`-ről indul, a SPEC-009 átvezetése külön lépés.         |
| A valódi próba tokenbe kerül.                                                                            | 5.3: engedélyhez kötött futás, `maxTurns`, a kapcsolat teszt alapból kihagyva (O-17). |
| A Turborepo `strict` módja a szerver környezetét csendben szűri.                                         | O-8.                                                                                  |

---

## 9. Elfogadási kritériumok

### Kimenő környezet

1. A lépés kimenő `env` objektuma a 3.1 szabály szerint áll elő, unit teszt igazolja mindhárom
   lépést.
2. `claude-subscription` mellett a kimenő `env` tartalmazza a `PATH` és a `HOME` változót (ha a
   szerver környezetében állnak), és a 3.2 tiltott nevek egyikét sem.
3. `minimax` mellett az `ANTHROPIC_BASE_URL` értéke a leíró literálja akkor is, ha a szerver
   környezetében más érték áll; a kulcs az O-1 szerinti forrásból jön.
4. A kapcsolat teszt ugyanazzal a függvénnyel építi a környezetet (teszt igazolja).
5. A regressziós teszt a javítás előtti kódon elbukik.
6. Minden új tiltott bejegyzés `reason` és nem üres `evidence` mezőt hordoz.
7. A kimenő `env` értéke nem jelenik meg a `run_event` táblában és a naplóban (teszt).

### Helyi indítás

8. A szerver egyetlen dokumentált `bun run` paranccsal indul, `npx` és `bun:` modul nélkül.
9. A web és a szerver az O-8 szerint indul; a böngészőből a workflow lista betölt, az SSE kapcsolat
   él (kézi ellenőrzés, a lépés leírásával a research fájlban).
10. A commitolt env minta titkot nem tartalmaz; forrás nélküli számhoz értéket nem ad.
11. A `README.md` leírja az indítást, a `claude-subscription` előfeltételét és a próbát.
12. A kilenc kapu és az e2e változatlanul zöld; a `webServer.env` négy változóját regressziós teszt őrzi.

### Valódi próba

13. A próba eszköze a repóban van, a 5.1 lépéseivel, verziókövetve.
14. A próba nem része a kilenc kapunak és a CI-nak.
15. A próba kimenete maszkolt; a kulcs értékére futtatott keresés a repóban nulla találatot ad.
16. A próba futása (ha a user engedélyezi) mindkét providerre a research fájlban áll; ha a user nem
    engedélyezi, a spec státusza ezt kimondja, és a 16. kritérium nyitva marad.

### Dokumentáció

17. A H-40 és a H-42 a hiányleltárban ezt a specet nevezi gazdának (10. szekció).
18. A SPEC-009 7.2, O-21 és M-137 átvezetése az O-18 válasza szerint.

---

## 10. A hiányleltár tételei, amelyeket ez a spec lezár

| Tétel | Mai gazda a leltárban              | Lezárás                                                                                       |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| H-40  | SPEC-009 (7. 2. pont, O-21, M-137) | a 3. szekció (a user 2026-10-26-i döntése a SPEC-009 O-21 (b) ágát választotta, ide helyezve) |
| H-42  | nyitott besorolás: SPEC-009 O-29   | a 4. és 5. szekció ("Saját kis spec, elsőként")                                               |

Más tétel a leltárban helyi indításról vagy env mintáról nem szól (`rg "README|\.env" ` a leltár
fájlon: nincs további találat).

---

## 11. Nyitott kérdések

Mindegyik önálló, egy kérdés egy döntés. A "mi a viselkedés addig" oszlop a döntésig érvényes
állapot.

| ID   | Kérdés                                                                                                                                                 | Opciók                                                                                                                                                                                                                                                                   | Ajánlott, indokkal                                                                                                                                                                                                                                                              | Mi a viselkedés addig                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| O-1  | Milyen néven álljon a MiniMax kulcs a szerver környezetében?                                                                                           | (a) `MINIMAX_API_KEY`, a leíró egy forrásnév mezővel `ANTHROPIC_AUTH_TOKEN` néven küldi ki; (b) `ANTHROPIC_AUTH_TOKEN`, a kód változatlan                                                                                                                                | (a): ezt írja a leíró szövege és a SPEC-000 táblája (research 7.), ez áll a user `.env` fájljában, és egy globális `ANTHROPIC_AUTH_TOKEN` a precedencia 2. szintjén minden más Claude folyamatot is átirányítana, ami ezt a környezetet örökli                                  | a kód `ANTHROPIC_AUTH_TOKEN` nevet olvas |
| O-2  | A `claude-subscription` tiltott listája a minimumon túl mit tartalmazzon?                                                                              | (a) a precedencia lap minden, a `/login` felett álló env forrását (`ANTHROPIC_PROFILE`, a két federációs név); (b) ezeken felül az env-vars lap provider választóit is (`CLAUDE_CODE_USE_ANTHROPIC_AWS`, `CLAUDE_CODE_USE_MANTLE`); (c) csak a minimum                   | (a): forrással igazolt, hogy felülírják a `/login`-t (2.2); a (b) nevekről a precedencia lap hallgat, ezért ott forrás nélkül döntenénk                                                                                                                                         | a minimum                                |
| O-3  | A `CLAUDE_CODE_OAUTH_TOKEN` tiltott legyen-e a `claude-subscription` providernél?                                                                      | (a) nem, átmehet; (b) igen, tiltott                                                                                                                                                                                                                                      | (a): a dokumentáció szerint claude.ai hitelesítés, "Alternative to `/login` for SDK and automated environments" (env-vars), tehát előfizetéses út marad                                                                                                                         | átmegy                                   |
| O-4  | A `minimax` tiltott listája bővüljön-e a teljes környezet miatt?                                                                                       | (a) igen: a felhő provider választók (`CLAUDE_CODE_USE_BEDROCK`, `_VERTEX`, `_FOUNDRY`), az `ANTHROPIC_API_KEY`, a `CLAUDE_CODE_OAUTH_TOKEN`, a profil és federáció nevei; (b) csak a felhő provider választók; (c) nem                                                  | (a): a felhő provider választó a precedencia 1. szintjén az `ANTHROPIC_AUTH_TOKEN` fölött áll, tehát a lépést elvinné a MiniMax mellől (2.2); a többi egy Anthropic hitelesítő kiszivárgását zárja ki egy harmadik fél felé                                                     | a mai három név                          |
| O-5  | A kimenő környezetből kerüljenek-e ki a MÁSIK provider titok változói?                                                                                 | (a) igen: minden leíró `secret: true` forrásneve kiszűrve, kivéve a saját `requiredEnv[]` blokkét; (b) nem                                                                                                                                                               | (a): a teljes környezetet az agent eszközei is látják (8.), egy `claude-subscription` lépésnek nincs dolga a MiniMax kulccsal                                                                                                                                                   | nincs szűrés                             |
| O-6  | Kapjon-e a szerver figyelő módú `dev` scriptet (Node `--watch`, stabil a `v22.0.0` óta, <https://nodejs.org/docs/latest-v26.x/api/cli.html#--watch>)?  | (a) nem, csak `start`; (b) igen, `start` és `dev`                                                                                                                                                                                                                        | (a): nem kérték (gyökér `CLAUDE.md` 2.); hogy egy figyelő módú újraindítás a futó lépésekkel mit tesz, nem mértük                                                                                                                                                               | nincs script                             |
| O-7  | Honnan induljon a szerver (ebből jön a munkakönyvtár és az alapértelmezett adatbázis helye)?                                                           | (a) gyökér `package.json` script, munkakönyvtár a gyökér, az adatbázis a megszokott `.data/` alatt; (b) `apps/server` `start` script, a minta `EASTER_DB_FILE` abszolút útvonalat kér; (c) `apps/server` script, és a kód a repó gyökerét a saját fájl helyéből számolja | (a): kódváltozás nélkül megtartja a SPEC-003 10.1 szerinti alapértelmezett helyet (M-144)                                                                                                                                                                                       | nincs script                             |
| O-8  | Egy paranccsal induljon-e a web és a szerver?                                                                                                          | (a) két parancs, két terminál; (b) a gyökér `dev` (turbo) mindkettőt indítja, a szerver task env átengedésével; (c) egy gyökér script, ami turbo nélkül indítja a kettőt                                                                                                 | (a): a Turborepo `strict` módja a szerver környezetét szűrné (2.3), ami ellentmond a "teljes környezet" döntésnek; a (b) ezt `passThroughEnv` vagy `envMode` módosítással oldaná, ami az összes task cache viselkedését érinti                                                  | nincs                                    |
| O-9  | Egy vagy két env minta fájl?                                                                                                                           | (a) gyökér `.env.example` a szervernek, `apps/web/.env.example` a négy `VITE_` változónak; (b) egy közös gyökér fájl, a Vite `envDir` a gyökérre állítva                                                                                                                 | (a): a Vite config a `loadEnv(..., '')` hívással a fájl MINDEN változóját betölti a dev folyamatba (research 5.), így a közös fájl a titkot is a Vite folyamatba vinné; a (b) a `vite.config.ts` módosítását is kérné                                                           | nincs minta                              |
| O-10 | A forrás nélküli konfigurációs számok (napló méret, gyakoriság, megőrzés, életben tartás, lista és visszajátszás limit) kapjanak-e értéket a mintában? | (a) nem, üresen, "kitöltendő" megjegyzéssel; (b) a user most megadja az értékeket, és a minta azokat hordozza "user döntés" jelöléssel                                                                                                                                   | (b), ha a cél, hogy a másolt minta azonnal induljon; különben (a). Forrás nélkül mi nem adunk számot (`.claude/CLAUDE.md` 4. 1. pont)                                                                                                                                           | a szerver ezek nélkül nem indul (M-141)  |
| O-11 | Szolgálja-e ki a szerver az épített webet (SPEC-006 O-8)?                                                                                              | (a) nem, a helyi út a Vite dev szerver; (b) igen, a `dist` statikus kiszolgálása                                                                                                                                                                                         | (a): a kérés helyi indítás, a SPEC-006 O-8 szerint ez az `apps/web` éles kiszolgálásának kérdése, és a (b) új útvonal kezelést, cache és biztonsági fejléc döntéseket hozna                                                                                                     | nincs statikus kiszolgálás               |
| O-12 | Hol éljen a valódi próba eszköze?                                                                                                                      | (a) `apps/server/measurement/` plusz `apps/server` script, az `apps/web/measurement/` mintájára; (b) új `tools/*` csomag; (c) a `tools/wire-probe` bővítése                                                                                                              | (a): új csomag és réteg bejegyzés nélkül, a meglévő minta szerint; a (c) a drótszintű proxyhoz tartozik, nem a szerverhez                                                                                                                                                       | nincs eszköz                             |
| O-13 | A próba saját szervert indítson-e ideiglenes adatbázissal, vagy egy futóhoz kapcsolódjon?                                                              | (a) saját, ideiglenes adatbázis és napló; (b) a futó szerver                                                                                                                                                                                                             | (a): a user adatbázisa érintetlen, és a próba megismételhető                                                                                                                                                                                                                    |                                          |
| O-14 | A próba lépésének `maxTurns` értéke?                                                                                                                   | (a) `1`; (b) más szám a user szerint                                                                                                                                                                                                                                     | (a): egyszerű prompt a mérésben egy körben, `success` subtype-pal zárult (M-13, `docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md:155`); több kör csak eszközhívásnál és strukturált kimenetnél kellett (M-02, `docs/research/2026-08-26-spec000-kiertekeles.md:721-724`) | nincs próba                              |
| O-15 | A próba `maxBudgetUsd` értéke és a `run_finished` várakozás felső időkorlátja?                                                                         | (a) `maxBudgetUsd` nincs beállítva, a korlát a `maxTurns`; (b) a user ad egy USD értéket; az időkorlátra mindkét esetben a user ad értéket                                                                                                                               | (a) a keretre: a `maxBudgetUsd` csak túllépés után állít meg (sdk.d.ts:1727-1730), és a `minimax` költsége tartalék díjtételű becslés (research 9.), tehát nem véd az első kör ellen; az időkorlátra nincs forrásunk, értéket nem javasolunk                                    | nincs próba                              |
| O-16 | Tiltsa-e a próba lépése az eszközöket?                                                                                                                 | (a) nem, csak rövid, eszközt nem kérő prompt; (b) igen, `disallowedTools` listával                                                                                                                                                                                       | (a): `maxTurns: 1` mellett egy eszközhívás `error_max_turns` zárást ad, ami a próbában láthatóan hibaként jelenik meg; a (b) listáját a gyári eszköznevekből kellene összeállítani, ami a próba célján túlmegy                                                                  |                                          |
| O-17 | Hívja-e a próba a kapcsolat tesztet is?                                                                                                                | (a) nem; (b) igen, providerenként egyszer                                                                                                                                                                                                                                | (a): a kapcsolat teszt `model` és `maxTurns` nélkül hívja a `query()`-t (research 8.), tehát a költsége nem korlátos; a kapcsolat teszt valódi útja a SPEC-009 témája                                                                                                           |                                          |
| O-18 | Hol és mikor vezetjük át a SPEC-009 7.2, O-21 és M-137 tételét?                                                                                        | (a) a `feat/spec-009-beallitasok` branchen, a PLAN-013 egy lépésében, mielőtt a SPEC-009 a `main`-re kerül; (b) a SPEC-009 merge után a `main`-en                                                                                                                        | (a): a két spec különben ellentmond egymásnak a `main`-en, és a SPEC-009 O-21 kérdése már eldőlt                                                                                                                                                                                | a SPEC-009 az O-21-et nyitottnak mutatja |
| O-19 | Az `EASTER_LOG_DIRECTORY` név és a fájl útvonal jelentés eltérése (M-142)                                                                              | (a) csak a minta és a `README.md` magyarázza; (b) átnevezés vagy a szemantika javítása külön tételként                                                                                                                                                                   | (a) ebben a specben (sebészi változtatás); a (b) külön hiányleltár tétel                                                                                                                                                                                                        | a név félrevezető                        |

---

## 12. Kapcsolódó dokumentumok

- [`../research/2026-10-26-helyi-inditas-es-valodi-proba.md`](../research/2026-10-26-helyi-inditas-es-valodi-proba.md)
- [`../plan/PLAN-013-helyi-inditas-es-valodi-proba.md`](../plan/PLAN-013-helyi-inditas-es-valodi-proba.md)
- [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) 11.3 és 12. szekció
- [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md) 4.2, 12. (O-1 ... O-8)
- `.claude/CLAUDE.md` 4., 7., 8., 9., 11. és 12. szekció
