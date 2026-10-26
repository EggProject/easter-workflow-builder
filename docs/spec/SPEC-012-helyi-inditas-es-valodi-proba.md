# SPEC-012: Helyi indítás és valódi provider próba

|          |                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | jóváhagyott, végrehajtásra kész (a user döntései 2026-10-26, 11. szekció). Minden tétel lezárva: a forrás nélküli értékekre a user a webes keresést kérte, az iparági ajánlás lett az alapérték (11.2, research 13.), az O-20 pedig a (b) opció (11.3: a `tools/wire-probe` is az `ANTHROPIC_AUTH_TOKEN` nevet olvassa).                                                                                          |
| Dátum    | 2026-10-26                                                                                                                                                                                                                                                                                                                                                                                                        |
| Előzmény | [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md) (a leírók, a titokkezelés), [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) (11.3, 10. és 11. sor: a kimenő env), [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md) (3.2, 6.6, 7.3, O-1 ... O-8), [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) (O-4, O-6, 45. kritérium) |
| Bemenet  | [`../research/2026-10-26-helyi-inditas-es-valodi-proba.md`](../research/2026-10-26-helyi-inditas-es-valodi-proba.md) (M-141 ... M-145, a források és a 10. szekció forrásolt alapértékei); a hatókör hiányleltár H-40 és H-42 tétele (`docs/research/2026-10-26-hatokor-hianyleltar.md`, a `feat/spec-009-beallitasok` branchen)                                                                                  |
| Kimenet  | a kimenő SDK környezet javítása, helyi indítási út (scriptek, env minta, `README.md`), kézzel indítható valódi provider próba a repóban                                                                                                                                                                                                                                                                           |
| Terv     | [`../plan/PLAN-013-helyi-inditas-es-valodi-proba.md`](../plan/PLAN-013-helyi-inditas-es-valodi-proba.md). **A számozás eltér:** a PLAN-011 a SPEC-011-é, a PLAN-012 a SPEC-009-é (a `feat/spec-009-beallitasok` branchen, még nincs a `main`-en), ezért a SPEC-012 terve a PLAN-013.                                                                                                                              |

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
2. A helyi indítás scriptjei, a forrásolt alapértékek a kódban, az env minta fájlok alakja és a `README.md`
   indítási leírása (4.).
3. A valódi provider próba alakja, helye, korlátai és a futtatás engedélyhez kötése (5.).

**A user döntései (2026-10-26)** a 11. szekció mind a húsz tételére megszülettek (a táblában
"Lezárva" jelöléssel); a legfontosabbak: a MiniMax kulcs neve a szerver környezetében
`ANTHROPIC_AUTH_TOKEN` (O-1), a tiltott listák a hivatalos hitelesítési sorrend szerint bővülnek (O-2,
O-4), a `CLAUDE_CODE_OAUTH_TOKEN` nem tiltott (O-3), a szerverre figyelő módú `dev` script kell (O-6),
és a konfigurációs számok alapértéke a kódban áll (O-10, "de akkor keress forrást! legyen default érték
beállítva!"). Ahol a keresés elsődleges forrást talált, az a forrás; ahol a `pino-roll` és a szabványok nem
adtak számot, a user második döntése ("webes keresés! mi az ajánlás! nehogy már én találjak ki mindent,
amikor ezeket az ipar már kitalálta!") alapján az **iparági bevett gyakorlat** (11.2, research 13.), a
`tools/wire-probe` pedig szintén az `ANTHROPIC_AUTH_TOKEN` nevet olvassa (O-20, 11.3).

### Amit NEM dönt el (nem cél)

- Éles telepítés, folyamatfelügyelet, HTTPS, hitelesítés a szerver előtt.
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

| Tény                                                                                                                                                                                                      | Forrás                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Az `apps/server` scriptjei: `typecheck`, `lint`; nincs `start` és `dev`.                                                                                                                                  | `apps/server/package.json`                                                                                                           |
| A gyökér `dev` scriptje `turbo run dev`; `dev` scriptje csak az `apps/web`-nek van (`vite`).                                                                                                              | `package.json` (`"dev": "turbo run dev"`); `apps/web/package.json`                                                                   |
| A `README.md` egyetlen sor.                                                                                                                                                                               | `README.md`                                                                                                                          |
| A szerver belépési pontja `apps/server/src/main.ts`, a `process.env` és a `process.cwd()` megy a `runStartupSequence` hívásba.                                                                            | `apps/server/src/main.ts:1-4`                                                                                                        |
| **A döntés előtti állapot:** a szerver hat kötelező env változója alapérték nélkül, a `EASTER_STREAM_DEV_ORIGIN` és az `EASTER_LOG_LEVEL` nem kötelező (a forrásolt alapértékek a 4.2 szerint változnak). | `apps/server/src/server-config/server-config.ts:83-131`; `apps/server/src/server-config/environment-variable-name.ts`                |
| Az adatbázis útvonala `EASTER_DB_FILE`, hiányában a `process.cwd()` alatti `.data/easter-workflow-builder.sqlite`.                                                                                        | `apps/server/src/startup-sequence/run-startup-sequence.ts:47-50, 65`; `packages/db/src/database-file/environment-variable-name.ts:7` |
| **A döntés előtti állapot:** a web négy kötelező `VITE_` változója alapérték nélkül (a forrásolt alapértékek a 4.2 szerint változnak).                                                                    | `apps/web/src/frontend-config/read-frontend-config.ts:13-16, 59`                                                                     |
| A Vite `/api` proxy célja a `VITE_STREAM_ORIGIN`.                                                                                                                                                         | `apps/web/vite.config.ts` (`server.proxy`)                                                                                           |
| A szerver portja `3001`, a Vite dev szerver az alapértelmezett `5173` porton, a REST a Vite proxyn, az SSE közvetlenül a backend originre.                                                                | `.claude/CLAUDE.md` 11. szekció (SPEC-008 3.)                                                                                        |
| A szerver statikus felületet nem szolgál ki (SPEC-006 O-8).                                                                                                                                               | `docs/spec/SPEC-006-szerver-alkalmazas.md:732`                                                                                       |
| A szerver build nélkül, `node apps/server/src/main.ts` alakban elindul a pinelt Node alatt.                                                                                                               | saját mérés M-141 (research 1.); <https://nodejs.org/docs/latest-v26.x/api/typescript.html>                                          |
| Az `EASTER_LOG_DIRECTORY` értéke a `pino-roll` `file` mezője, tehát fájl útvonal előtag (a napló `<érték>.1.log`).                                                                                        | saját mérés M-142 (research 2.)                                                                                                      |
| A `bun run` csomag scriptje a csomag könyvtárában fut; a szerver ott indítva az `apps/server/.data/` alá nyitná az adatbázist.                                                                            | saját mérés M-144 (research 6.)                                                                                                      |
| A Node `--env-file` és `--env-file-if-exists` kapcsolója beépített, a környezetben már álló változó nyer a fájlbeli ellen.                                                                                | <https://nodejs.org/docs/latest-v26.x/api/cli.html#--env-filefile> (egy hivatalos forrás, research 5.)                               |
| A Turborepo alapból `strict` env módban fut: a task csak a nevesített és a beépített rendszer változókat látja.                                                                                           | <https://turborepo.com/docs/crafting-your-repository/using-environment-variables> (research 5.)                                      |
| A `.gitignore` a `.env` és `.env.*` fájlokat kizárja, a `.env.example` kivétel.                                                                                                                           | `.gitignore` ("titkok" blokk)                                                                                                        |

### 2.4 A MiniMax kulcs neve

A `minimax` leíró `ANTHROPIC_AUTH_TOKEN` követelményét a motor a saját nevén olvassa a folyamat
környezetéből, a leíró `purpose` szövege és a SPEC-000 táblája viszont a `MINIMAX_API_KEY` névből való
átvezetést írta (research 7.). **Lezárva (O-1, user döntés 2026-10-26): a kulcs a szerver környezetében
`ANTHROPIC_AUTH_TOKEN` néven áll**, a kód változatlan; a `MINIMAX_API_KEY` név a termékből kivezetődik
(6. szekció). A user `.env` fájljában (csak nevek olvasva) ma `MINIMAX_API_KEY` áll: **a usernek át kell
neveznie `ANTHROPIC_AUTH_TOKEN`-re** (a `README.md` és a 4.3 minta is kimondja). Következmény: egy
`claude-subscription` lépés nem kaphatja meg ezt a változót, mert a precedencia 2. szintjén a
`/login` elé kerülne; ezt a 3.2 tiltott listája zárja ki.

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

Végleges (O-2 ... O-5, user döntés 2026-10-26). A sorrend forrása a 2.2 (research 4. és 12.). A "rang"
oszlop a hitelesítési precedencia szintje (1 a legerősebb, 7 a `/login`).

**`claude-subscription`: minden változó, ami felülírná a `/login` bejelentkezést.**

| Név                                                                              | Rang                   | Megjegyzés                                                                                                            |
| -------------------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`   | 1                      | felhő provider választó                                                                                               |
| `CLAUDE_CODE_USE_ANTHROPIC_AWS`, `CLAUDE_CODE_USE_MANTLE`                        | **nem ellenőrzött**    | az env-vars lapon provider választó; a precedencia lap nem sorolja fel, a rangja nem igazolt, ezért "nem ellenőrzött" |
| `ANTHROPIC_AUTH_TOKEN`                                                           | 2                      | a `minimax` titka (O-1), ezért ide is tartozik (O-5)                                                                  |
| `ANTHROPIC_API_KEY`                                                              | 3                      |                                                                                                                       |
| `ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID` | 6 (a `/login` fölött)  | a federációs két név csak együtt hat; mindhárom külön tiltott, hogy egyik se maradjon a kimenő környezetben           |
| `ANTHROPIC_BASE_URL`                                                             | nem része a sorrendnek | a mai bejegyzés: felülírja az endpointot, amivel a provider megszűnik first-party lenni                               |

**Nem tiltott (O-3):** a `CLAUDE_CODE_OAUTH_TOKEN`. A lap szerint a tokent a `claude setup-token` a
claude.ai előfizetéshez állítja elő ("authenticates with your Claude subscription"), az env-vars lap
szerint "Alternative to `/login` for SDK and automated environments": előfizetéses út marad.

**`minimax`: a mai három név, plusz a más hitelesítők.**

| Név                                                                                                                              | Megjegyzés                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING`, `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, `MAX_THINKING_TOKENS`                 | a mai három bejegyzés, változatlan                                                                                                                                                                                                                                                                                      |
| `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`                                                   | rang 1, az `ANTHROPIC_AUTH_TOKEN` (rang 2) fölött: elvinné a lépést a MiniMax mellől                                                                                                                                                                                                                                    |
| `CLAUDE_CODE_USE_ANTHROPIC_AWS`, `CLAUDE_CODE_USE_MANTLE`                                                                        | provider választók, a rangjuk **nem ellenőrzött** (fent)                                                                                                                                                                                                                                                                |
| `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `ANTHROPIC_PROFILE`, `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID` | rang 3, 5, 6: az `ANTHROPIC_AUTH_TOKEN` alatt állnak, tehát a precedencia szerint nem nyernek; a tiltás óvatossági (user döntés, O-4), hogy Anthropic hitelesítő ne kerüljön egy harmadik fél endpointjához. Hogy a CLI egy alacsonyabb rangú hitelesítőt elküldene-e az `ANTHROPIC_BASE_URL` felé, **nem ellenőrzött** |

**A másik provider titkai (O-5).** Minden lépés csak a saját providere titkait kapja. A szabály nem
futásidejű gyűjtés, hanem a leírók adata: egy provider tiltott listája tartalmazza a másik provider
minden `secret: true` forrásnevét, kivéve a saját `requiredEnv[]` neveit. Ma ez egyetlen név:
`ANTHROPIC_AUTH_TOKEN` a `claude-subscription` listájában (fent); a `minimax` oldalon a
`claude-subscription` leírónak nincs titka, tehát nincs plusz bejegyzés. Az `apps/server` (az egyetlen
hely, ahol a két leíró együtt látszik) egy futásidejű ágat nem hozó, mindkét irányt vizsgáló regressziós
tesztje őrzi, hogy egy új provider vagy titok felvétele ezt a szabályt ne törje meg (7.).

Minden új `DisallowedEnvironmentRequirement` bejegyzés `reason` és nem üres `evidence` mezőt kap
(`packages/provider-capability/src/environment/disallowed-environment-requirement.ts`, a leíró
bizonyíték kényszere, `.claude/CLAUDE.md` 9.). A hitelesítési precedencia forrása új research szekció
azonosítóként kerül a `provider-capability` bizonyíték konstansai közé (a mai `RESEARCH_GATEWAY`
mintájára); a pontos név a PLAN-013 T-013-4 lépésében dől el. A "nem ellenőrzött" rangú nevek `reason`
szövege ezt kimondja.

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
- A `secret: true` értékek naplóbeli maszkolása
  (`apps/server/src/startup-sequence/collect-secret-environment-values.ts`): a maszkolt érték az
  `ANTHROPIC_AUTH_TOKEN` változó értéke, a kód változatlan, mert a függvény már a követelmény saját nevét
  olvassa a folyamat környezetéből (O-1).
- A `minimax` leíró `required-environment.ts` fájljában csak a `purpose` szöveg változik: a "MINIMAX_API_KEY
  process env változó" helyett az `ANTHROPIC_AUTH_TOKEN` process env változó értéke megy Bearer
  tokenként. Forrásnév mező nem kerül a `provider-capability` típusba (az O-1 (a) opciója elvetve).

---

## 4. Helyi indítás

### 4.1 Scriptek

Mind a három a **gyökér `package.json`** scriptje (O-7, O-8: két parancs, két terminál), `bun run` alatt,
`npx` és `bun:` modul nélkül. A szerver a repo gyökeréből indul, ezért a munkakönyvtár a gyökér, és az
alapértelmezett adatbázis a megszokott `.data/easter-workflow-builder.sqlite` (M-144, SPEC-003 10.1).

| Script                 | Parancs                                                          | Megjegyzés                                                                                                             |
| ---------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bun run start:server` | `node --env-file-if-exists=.env apps/server/src/main.ts`         | build nélkül (M-141); a `.env` hiánya nem hiba; a környezetben álló változó nyer a fájlbeli ellen (research 5., M-145) |
| `bun run dev:server`   | `node --watch --env-file-if-exists=.env apps/server/src/main.ts` | figyelő mód (O-6): a szerver forrás, a workspace csomagok forrása **és az env fájl** változására újraindul (M-145)     |
| `bun run dev:web`      | `bun run --filter @easter-workflow-builder/web dev`              | a meglévő `apps/web` `dev` script (`vite`) változatlanul; a Vite a `apps/web/.env` fájlt maga tölti (research 5.)      |

- **A figyelő mód határa.** A Node `--watch` stabil a `v22.0.0` óta, a belépési pontot és minden importált
  modult figyel (research 11.); új függőség nem kell. Hogy az újraindítás mit tesz egy futó lépéssel, **nem
  mért** (research 11.): a `dev:server` fejlesztői kényelem, és a `README.md` ezt kimondja.
- **Miért nem turbo.** A Turborepo alapból `strict` env módban fut: a task csak a nevesített változókat
  látná, ami a 3.1 "teljes környezet" szabályát csendben szűkítené (O-8). A három script ezért nem
  `turbo run`, hanem közvetlen `node` illetve `bun run --filter`. A gyökér `dev` script (`turbo run dev`)
  változatlan marad; az indítási leírás nem erre épül. A `bun run --filter <név>` csomag nevére szűrése a
  T-013-6 lépésben igazolandó (M-144 a `--filter` munkakönyvtárát mérte, a csomag név alakot nem).
- **`turbo.json`.** Az `ANTHROPIC_AUTH_TOKEN` már szerepel a `globalPassThroughEnv` listában (a kódban
  változás nem kell); a `MINIMAX_API_KEY` sor **kikerül** (O-20 (b), user döntés 2026-10-26: a
  `tools/wire-probe` is az `ANTHROPIC_AUTH_TOKEN` nevet olvassa, 11.3; PLAN-013 T-013-12).

### 4.2 Alapértékek a kódban (O-10, user döntés 2026-10-26: forrásolt alapérték, ahol nincs, iparági ajánlás)

**A szabály.** Minden konfigurációs értéknek **alapértéke van a kódban**: a szerver és a web config olvasója
az env változó hiányában (nincs beállítva, vagy üres) az alapértéket használja. **Megadott, de érvénytelen
értékre továbbra is hibaág jön** (a mai `invalid_env_variable`), nem csendes visszaesés az alapértékre. Az
alapérték forrása háromféle: elsődleges forrás (research 10.), iparági ajánlás (user döntés 2026-10-26:
"webes keresés! mi az ajánlás!", research 13.), vagy kimondott user döntés (a port, a napló útvonal). Ez a
SPEC-006 O-1 ... O-4 és a SPEC-007 O-4, O-6 "alapérték nélkül" döntéseit **teljesen felülírja** (a két spec
jelzést kapott).

| Változó                                | Alapérték               | Forrás (research 10.)                                                                                                                                                                                                                                | Hol áll a kódban                                                 |
| -------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `EASTER_SERVER_PORT`                   | `3001`                  | user termékdöntés 2026-09-05 (`.claude/CLAUDE.md` 11., SPEC-008 3.)                                                                                                                                                                                  | `apps/server/src/server-config/`, új `default-server-config.ts`  |
| `EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS` | `15000`                 | WHATWG HTML 9.2.7 "every 15 seconds or so"; axum `KeepAlive` és `sse-starlette` alapértéke 15 másodperc (10.1)                                                                                                                                       | ugyanott                                                         |
| `VITE_API_ORIGIN`                      | `http://localhost:5173` | Vite `server.host` `'localhost'` és `server.port` `5173` alapértéke, user port döntés (10.3)                                                                                                                                                         | `apps/web/src/frontend-config/`, új `default-frontend-config.ts` |
| `VITE_STREAM_ORIGIN`                   | `http://127.0.0.1:3001` | a szerver `127.0.0.1` bind címe (`continue-startup-with-database.ts:74`) és a user port döntés (10.2, 10.4)                                                                                                                                          | ugyanott                                                         |
| `EASTER_LOG_DIRECTORY`                 | `.data/logs/server`     | user döntés 2026-10-26: a repo gyökerének `.data/logs/` mappája (a `.data/` kizárt a gitből, `.gitignore:44`); **fájl útvonal előtag**, a napló `.data/logs/server.1.log` (M-142, M-146)                                                             | ugyanott                                                         |
| `EASTER_LOG_ROTATION_SIZE`             | `10m`                   | user döntés 2026-10-26: iparági ajánlás, forrással. Szállított alapérték: kubelet `containerLogMaxSize` 10Mi, `pm2-logrotate` `max_size` 10M, Spring Boot `max-file-size` 10MB (research 13.1); a `pino-roll` `m` utótagja 1024 négyzet bájt (M-146) | ugyanott                                                         |
| `EASTER_LOG_ROTATION_FREQUENCY`        | `604800000`             | user döntés 2026-10-26: iparági ajánlás, forrással. A `logrotate` `weekly` (Debian, Ubuntu, RHEL, upstream), ezredmásodpercben, mert a `pino-roll` 4.0.0 a `weekly` nevet nem ismeri; a határ UTC csütörtök 00:00 (research 13.1, M-146)             | ugyanott                                                         |
| `EASTER_LOG_RETAINED_FILE_COUNT`       | `4`                     | user döntés 2026-10-26: iparági ajánlás, forrással. A `logrotate` `rotate 4` (forgatott példányok, az aktív fájlon felül), kubelet és Docker `local`: 5 fájl az aktívval együtt; a `pino-roll` `limit.count` jelentése ugyanez (research 13.1)       | ugyanott                                                         |
| `VITE_LIST_LIMIT`                      | `100`                   | user döntés 2026-10-26: iparági ajánlás, forrással. Slack alapérték és ajánlás ("100-200"), a GitHub, Stripe és GitLab közös maximuma (research 13.2)                                                                                                | ugyanott                                                         |
| `VITE_STREAM_REPLAY_LIMIT`             | `100`                   | user döntés 2026-10-26: iparági ajánlás, forrással. Ugyanaz a művelet (esemény napló lapja): Slack `conversations.history`, Ably history, Loki `query_range` alapértéke 100; **lapméret, nem plafon** (research 13.3)                                | ugyanott                                                         |

- **Egy fájl, egy exportált egység.** A szerver oldali fájl egyetlen csak olvasható objektumot exportál
  (`as const satisfies`, `as` nélkül), a web oldali is. Mindkettő kommentje a research szekció azonosítóját
  hivatkozza (10.1 ... 10.4), mérési próza nélkül (`.claude/CLAUDE.md` 4. 3. pont).
- **A web literálok egyetlen helye.** A `vite.config.ts` a `/api` proxy `target` mezőjét az env hiányában
  ugyanebből a fájlból veszi (importálja), így a literál nem duplázódik, és a `vite.config.ts` továbbra sem
  tartalmaz origin literált. A `greppable-invariants` (8) kapuja ennek megfelelően szűkül: a
  `localhost|127.0.0.1|:5173|:3001` minta tiltott marad minden termékfájlban, **kivéve** a
  `default-frontend-config.ts` fájlt; a `?? <szám>` tiltás a `read-frontend-config.ts` fájlban marad. A
  `listLimit` és a `streamReplayLimit` alapértéke is a `default-frontend-config.ts` fájlban áll, az olvasó
  onnan veszi, `?? <szám>` alak nélkül; a (8) idő szám ága (`*Ms`, `duration`, `setTimeout`) ezeket a
  kulcsokat nem érinti. A (13) változatlan. Ez a szabálykönyv 11. szekciójának és a SPEC-007 45. kritériumának szűkítése (user döntés
  2026-10-26); a szabálykönyv szövege a kóddal együtt változik (6., 10.).
- **Kockázat, kimondva.** A web alapérték elfedi a hiányzó build konfigurációt: egy éles build `VITE_*`
  nélkül csendben a helyi címekre mutat. Éles telepítés nem cél (1.), a döntést a user hozta (11.).
- **A lista levágás kockázata, kimondva.** A `VITE_LIST_LIMIT` értéke 100, de a `GET /api/workflows`
  kezelő a `limit` darabszámnál csendben levág (`list-workflows.ts:35`), nincs lapozás: 100 workflow
  fölött a lista elrejti a többit. Az iparági ajánlás a számot adja, a lapozás hiányát nem oldja meg
  (research 13.2); a lapozás nem ennek a specnek a hatóköre.
- **A `pino-roll` darabszám korlát a könyvtárra szól (lezárva, user technikai döntés 2026-10-26).** A
  `limit.count` alapból csak a jelenlegi folyamat fájljait törölte (`removeOtherLogFiles` nem volt beállítva a
  `buildLogRotationOptions` függvényben), tehát egy újraindítás után a korábbi futások fájljai megmaradtak. A
  függvény ezért mindig `limit.removeOtherLogFiles: true` mezőt ad, így a darabszám a könyvtárra érvényes, mint a
  `logrotate` `rotate` szabálya (forrás: a telepített `pino-roll` 4.0.0 `lib/utils.js` 205-211. sora és a README
  `limit` szakasza, research 13.1 és 14.6). A SPEC-006 9.2 szakasza ezzel egyezően módosult; a
  `build-log-rotation-options.spec.ts` regressziós teszt őrzi.
- **Az `EASTER_STREAM_DEV_ORIGIN` opcionális marad, alapérték nélkül** (levezetett pont, 11.4): a hiánya a
  "nincs CORS" biztonsági állapot (SPEC-006 5.7 1. pont), azt alapértékkel nem kapcsoljuk be.
- **A `EASTER_LOG_ROTATION_FREQUENCY` kódbeli alapértéke szám** (`604800000`), az env változó numerikus
  sztringje a mai olvasó szerint számmá alakul (`readRotationFrequency`); egy névvel megadott `daily` vagy
  `hourly` változatlanul átmegy. A `server-config.ts` doc kommentje a 4.0.0-ban nem létező `'weekly'` értéket
  is felsorolja (research 10.5): a megvalósítás ezt a kommentet a `daily` és `hourly` értékre javítja.

### 4.3 Env minta (O-9: két fájl)

- **Gyökér `.env.example`** a szervernek, **`apps/web/.env.example`** a négy `VITE_` változónak. Indok: a
  `vite.config.ts` a `loadEnv(mode, process.cwd(), '')` hívással a fájl **minden** változóját betölti a dev
  folyamatba (research 5.); egy közös fájl a szerver titkát is a Vite folyamatba vinné. A `.gitignore` a
  `.env` és `.env.*` fájlokat kizárja, a `.env.example` kivétel (minden mélységben).
- Csak változónevek és forrással alátámasztott, nem titkos értékek; titok értéke soha (`.claude/CLAUDE.md` 7. és 9.).
- **Minden érték az alapértékkel egyezően** (a minta ezt mutatja, 4.2): `EASTER_SERVER_PORT=3001`,
  `EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS=15000`, `EASTER_LOG_DIRECTORY=.data/logs/server`,
  `EASTER_LOG_ROTATION_SIZE=10m`, `EASTER_LOG_ROTATION_FREQUENCY=604800000`,
  `EASTER_LOG_RETAINED_FILE_COUNT=4`, `VITE_API_ORIGIN`, `VITE_STREAM_ORIGIN`, `VITE_LIST_LIMIT=100`,
  `VITE_STREAM_REPLAY_LIMIT=100`. Az
  `EASTER_STREAM_DEV_ORIGIN` mintaértéke a böngészőben megnyitott web origin (`http://localhost:5173`); a
  `localhost` és a `127.0.0.1` eltérő origin, a végleges literált a T-013-7 a futó dev szerveren mért
  `Origin` fejléccel igazolja.
- **Megjegyzések a mintában:** minden sor megjegyzése megnevezi a forrást (research 13.). Az
  `EASTER_LOG_ROTATION_FREQUENCY` megjegyzése kimondja, hogy 7 nap ezredmásodpercben, mert a `pino-roll`
  4.0.0 a `weekly` nevet nem ismeri, és hogy a határ UTC csütörtök 00:00 (M-146). A `VITE_STREAM_REPLAY_LIMIT`
  megjegyzése kimondja, hogy lapméret, nem plafon. A `VITE_LIST_LIMIT` megjegyzése kimondja, hogy 100 fölött
  a lista levágódik.
- Az `EASTER_LOG_DIRECTORY` megjegyzése kimondja, hogy **fájl útvonal előtag**, nem könyvtár: a napló a
  `<érték>.1.log` fájlba kerül, tehát `.data/logs/server.1.log` (M-142, M-146, O-19: a név félrevezető, csak
  a minta és a `README.md` magyarázza, átnevezés nincs).
- **Provider változók:** a `minimax` kulcs `ANTHROPIC_AUTH_TOKEN` néven (üresen, a megjegyzés kimondja:
  a MiniMax kulcs; a user `.env` fájljában a régi `MINIMAX_API_KEY` név helyett); a `claude-subscription`
  nem kér env változót (a `/login` hitelesítését használja). A mintában az `EASTER_DB_FILE` és az
  `EASTER_LOG_LEVEL` opcionális sorként, megjegyzéssel áll.

### 4.4 `README.md`

Előfeltételek (Node, Bun, a pinelt verziók a `docs/research/2026-08-26-toolchain.md` fájlra hivatkozva,
szám nélkül), `bun install --frozen-lockfile`, az env minták másolása (`.env.example` -> `.env`,
`apps/web/.env.example` -> `apps/web/.env`), a három script (4.1), a böngésző címe, a `claude-subscription`
előfeltétele (Claude Code bejelentkezés), a **kulcs átnevezése** (a `.env` fájlban a `MINIMAX_API_KEY` helyett
`ANTHROPIC_AUTH_TOKEN`), az alapértékek és a felülírásuk (4.2, 11.2: a napló, a lista és a visszajátszás értékei), és a valódi próba (5.) leírása a
figyelmeztetéssel, hogy valódi tokenbe kerül. Kimondja: a szerver környezete az agenté is (8.), a
`dev:server` újraindítása futó lépéssel nem mért, és az `EASTER_LOG_DIRECTORY` fájl útvonal előtag.

### 4.5 Statikus kiszolgálás

**Lezárva (O-11, user döntés 2026-10-26): a szerver nem szolgálja ki az épített webet.** A helyi út a Vite
dev szerver, a SPEC-006 O-8 szerinti "nincs statikus kiszolgálás" változatlan.

### 4.6 A kapuk és az e2e érintetlensége

- A kilenc kapu és az e2e nem olvas `.env` fájlt: a Playwright `webServer.env` mind a négy `VITE_`
  változót beállítja (`apps/web/playwright.config.ts:77-81`), és a Vite szerint a már létező
  változó nyer a `.env` fájl ellen (research 5.). Egy helyi `apps/web/.env` tehát az e2e buildet
  nem változtatja meg, és a 4.2 web alapértékek sem érvényesülnek az e2e-ben (a `VITE_LIST_LIMIT` és a
  `VITE_STREAM_REPLAY_LIMIT` sem); a PLAN-013 egy
  regressziós teszttel rögzíti, hogy a `webServer.env` mind a négy változót megadja.
- Az új scriptek a `test` kapu lefedettségébe nem kerülnek. Az új `default-*-config.ts` fájlok `src/` alatti
  TypeScript, a tesztjük a 7. szerinti.

---

## 5. Valódi provider próba

### 5.1 Alak

Egy kézzel indítható, a repóban élő, verziókövetett eszköz (a szabálykönyv 12. szekció tanulsága: minden
bizonyíték előállító eszköz a repóba tartozik).

- **Helye (O-12):** `apps/server/measurement/`, az `apps/web/measurement/` mintájára; új csomag és
  réteg bejegyzés nélkül. Indítása gyökér script: `bun run probe:real-provider -- <providerId>`
  (`minimax` vagy `claude-subscription`), `node --env-file-if-exists=.env` alatt, a gyökérből.
- **Saját szerver (O-13):** a próba saját szervert indít (gyermek folyamat, `apps/server/src/main.ts`),
  **ideiglenes adatbázissal és napló útvonallal** (az `EASTER_DB_FILE` és az `EASTER_LOG_DIRECTORY` egy
  ideiglenes könyvtárra mutat, a futás végén törlődik), szabad porton. A user adatbázisa érintetlen, a
  próba megismételhető. A gyermek folyamat környezete a próba folyamaté (3.1 "teljes környezet"); a napló
  rotáció értékei a 4.2 alapértékekből jönnek, a próba csak az `EASTER_DB_FILE` és az `EASTER_LOG_DIRECTORY`
  értékét írja felül (a user `.data/` mappája érintetlen).
- **Lépései:**
  1. A szerver indítása; várakozás a `GET /api/providers` `200` válaszra.
  2. `PUT /api/settings` (a vizsgált provider mint alapértelmezett), `POST /api/workflows`,
     `PUT /api/workflows/:id/graph` egy minimális gráffal: Start és egyetlen `agent_step`.
  3. `GET /events` stream feliratkozás, `POST /api/workflows/:id/runs`, várakozás a `run_finished`
     keretre.
  4. A kimenet összegzése: a futás állapota, a lépés `result` `subtype`-ja, a `num_turns`, a
     kimeneti szöveg hossza (a szöveg maga nem kell), a hibaosztály, ha volt.
  5. A gyermek szerver leállítása és az ideiglenes könyvtár törlése (a `SIGINT` és `SIGTERM` is idáig
     ér).
- **A lépés beállításai (O-14 ... O-17, user döntés 2026-10-26):**

| Beállítás       | Érték                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lépés típusa    | `agent_step`                                                                                                                                                         |
| `providerId`    | a próba paramétere; `minimax` esetén `modelId`: `MiniMax-M3`, `claude-subscription` esetén `modelId` nincs                                                           |
| `maxTurns`      | `1` (O-14)                                                                                                                                                           |
| prompt          | rövid, eszközt nem kérő; a pontos szöveg a próba kódjában áll, nem döntés                                                                                            |
| `maxBudgetUsd`  | **nincs beállítva** (O-15): a `maxBudgetUsd` csak túllépés után állít meg (sdk.d.ts:1727-1730), és a `minimax` költsége tartalék díjtételű becslés (research 9.)     |
| időkorlát       | **nincs** (O-15, user döntés): a `run_finished` várakozásnak nincs felső korlátja; a próba megszakítása a user dolga (`Ctrl-C`), ami a gyermek szervert is leállítja |
| eszköz tiltás   | nincs (O-16): `maxTurns: 1` mellett egy eszközhívás `error_max_turns` zárást ad, ami a próbában hibaként látszik                                                     |
| kapcsolat teszt | **nem hívódik** (O-17): a kapcsolat teszt `model` és `maxTurns` nélkül hívja a `query()`-t (research 8.), költsége nem korlátos; a valódi útja a SPEC-009 témája     |

- **Két futás:** egyszer `minimax` providerrel `MiniMax-M3` modellel, egyszer `claude-subscription`
  providerrel. A `claude-subscription` futás egyben a 2.1 hiba valódi igazolása: a javítás előtti fejen
  (ha a user engedi) és utána. A `.env` fájlban álló `ANTHROPIC_AUTH_TOKEN` a `claude-subscription`
  futásban a 3.2 tiltott lista miatt nem juthat a lépéshez; ezt a futás igazolja (a tárolt események
  keresése a kulcs értékére).

### 5.2 Titokkezelés

A szabálykönyv 9. szekciója szerint: a kulcs csak env változóból jön (a próba folyamatnál az
`ANTHROPIC_AUTH_TOKEN`); az `authorization` és `x-api-key` fejléc és a kulcs értékének minden
előfordulása `REDACTED`, még a lemezre írás előtt, memóriában; nyers, maszkolatlan artefaktum nem kerül
lemezre. A próba csak összegzést ír, és a commit előtt a kulcs értékére futtatott keresés nulla
találatot ad. A próba nem készít képernyőképet, videót, trace-t vagy PDF-et
(`screenshot-pipeline` védelem, szabálykönyv 12.).

### 5.3 Engedély és kapuk

- **A végrehajtó agent a próbát csak a user kifejezett, az adott futásra szóló engedélyével
  futtatja.** A user szava: "úgy hajtsd meg a minimax api-t hogy nincs végtelen tokenem!". Az engedélyt az
  askuserquestion tool kéri, a 5.1 táblázat beállításainak felsorolásával. A beállítások felsorolása
  kiemeli, hogy **nincs költségkeret és nincs időkorlát** (a user döntése), csak a `maxTurns: 1`.
- A próba nem tagja a kilenc kapunak, nem fut a CI-ban (a CI nem kap kulcsot, SPEC-001 12.), és
  nincs a `test` kapu fájlmintáiban.
- Az eredmény a research fájl új szekciójába kerül, a nyers számok ott, a szabálykönyvbe nem.

---

## 6. Hova kerül a kód

| Hely                                                                                                                                                           | Változás                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine` `engine-port`                                                                                                                                | a `ProcessEnvironmentPort` felsoroló metódusa                                                                                                                                                                 |
| `packages/engine` `provider-environment`                                                                                                                       | a teljes kimenő környezet tiszta függvénye és tesztje                                                                                                                                                         |
| `packages/engine` `agent-step`, `engine-port`                                                                                                                  | a hívás helye (`run-agent-step.ts`, `create-engine.ts`)                                                                                                                                                       |
| `packages/provider-claude-subscription`, `packages/provider-minimax`                                                                                           | a `disallowed-environment.ts` bővítése a 3.2 szerint; a `minimax` `required-environment.ts` `purpose` szövege (`ANTHROPIC_AUTH_TOKEN`, a `MINIMAX_API_KEY` név kivezetése)                                    |
| `packages/provider-capability`                                                                                                                                 | új bizonyíték konstans a hitelesítési precedenciára; típusváltozás nincs (O-1 (b))                                                                                                                            |
| `apps/server` `engine-assembly`                                                                                                                                | a port valódi implementációja                                                                                                                                                                                 |
| `apps/server` új drift védelem téma                                                                                                                            | a 3.2 O-5 szabály mindkét irányú regressziós tesztje (a két leíró együtt csak itt látszik)                                                                                                                    |
| `apps/server` `server-config`                                                                                                                                  | új `default-server-config.ts`; a `server-config.ts` olvasója a port és az életben tartás hiányában az alapértéket használja; az `environment-variable-name.ts` megjegyzései a forrásokra mutatnak             |
| `apps/web` `frontend-config`, `vite.config.ts`, `greppable-invariants`                                                                                         | új `default-frontend-config.ts`; az olvasó és a `vite.config.ts` onnan veszi az origin alapértéket; a (8) invariáns kivétele a 4.2 szerint                                                                    |
| gyökér `package.json`                                                                                                                                          | `start:server`, `dev:server`, `dev:web`, `probe:real-provider` (4.1, 5.1)                                                                                                                                     |
| `tools/wire-probe` (`src/harness/environment.ts`, `src/proxy.ts`, a `proxy/mask.ts`, `probe.ts`, `cases/m-32.ts`, `harness/runner.ts` kommentjei, `CLAUDE.md`) | a mérő eszköz a kulcsot `ANTHROPIC_AUTH_TOKEN` néven olvassa (a `process.env`-ből, majd a gyökér `.env` fájlból), és ennek értékét maszkolja; a `MINIMAX_API_KEY` név kivezetve (O-20 (b), PLAN-013 T-013-12) |
| `turbo.json`                                                                                                                                                   | az `ANTHROPIC_AUTH_TOKEN` már szerepel; a `MINIMAX_API_KEY` sor kikerül (O-20 (b))                                                                                                                            |
| gyökér `.env.example`, `apps/web/.env.example`                                                                                                                 | env minták (4.3)                                                                                                                                                                                              |
| `README.md`                                                                                                                                                    | indítási leírás, a kulcs átnevezése (4.4)                                                                                                                                                                     |
| `apps/server/measurement/`                                                                                                                                     | a valódi próba eszköze (5.1)                                                                                                                                                                                  |
| `docs/research/`                                                                                                                                               | a próba eredménye, a mérések (T-013-1, T-013-5, T-013-6, T-013-7)                                                                                                                                             |
| `packages/protocol` `provider-summary.spec.ts`, `apps/web` `GraphEditorScreen.spec.tsx`, `create-workflow-modal.spec.tsx`, `e2e/workflow-list.spec.ts`         | a tesztfixtúrák `requiredEnvNames: ['MINIMAX_API_KEY']` sora `ANTHROPIC_AUTH_TOKEN`-re (a termék env neve; a teszt viselkedése nem változik)                                                                  |

---

## 7. Tesztelés

- **Unit (100 százalék, kizárás nélkül):** a 3.1 függvény minden ága: alap másolás, tiltott név
  törlése, a `requiredEnv[]` ráírása az alap fölé, a tiltott és kötelező ütközés, a hiányzó kötelező
  változó hibája. A két provider leíróval: `claude-subscription` mellett a 3.2 tiltott nevek **egyike
  sem** kerül ki (táblázatosan, minden név, a `CLAUDE_CODE_OAUTH_TOKEN` pedig átmegy), a `PATH` és a
  `HOME` kikerül; `minimax` mellett az `ANTHROPIC_BASE_URL` a literál, a kulcs az
  `ANTHROPIC_AUTH_TOKEN` változó értéke, és a 3.2 `minimax` nevei kikerülnek.
- **Regressziós teszt a hibára:** a régi kódon (csak a blokk) elbukik, mert a `PATH` hiányzik.
- **A kapcsolat teszt:** ugyanaz a környezet megy ki, mint a lépésé (port csonkkal, a meglévő
  `create-engine.spec.ts` mintájára).
- **Az O-5 szabály (apps/server, futásidejű ág nélkül):** minden provider `p`-re és minden más provider
  `q` minden `secret: true` forrásnevére: a név `p` tiltott nevei közt van, vagy `p` saját `requiredEnv[]`
  nevei közt. Mindkét irányban fut; egy új provider vagy titok felvétele ezen bukik.
- **Alapértékek (SPEC-012 4.2):** a `server-config.spec.ts` az `EASTER_SERVER_PORT`, az
  `EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS`, az `EASTER_LOG_DIRECTORY`, az `EASTER_LOG_ROTATION_SIZE`, az
  `EASTER_LOG_ROTATION_FREQUENCY` és az `EASTER_LOG_RETAINED_FILE_COUNT` hiányára (nincs beállítva, üres) a
  4.2 táblázat értékeit várja (`3001`, `15000`, `.data/logs/server`, `10m`, `604800000`, `4`; a
  gyakoriság szám); megadott érvénytelen értékre (`0`, `abc`, a pozitív egész mezőkre) `invalid_env_variable`
  hibaágat; a felülírás (megadott érvényes érték) az alapértéket váltja. A `read-frontend-config.spec.ts`
  ugyanígy: az origin alapértékek, a `VITE_LIST_LIMIT` és a `VITE_STREAM_REPLAY_LIMIT` (`100`) hiányára az
  alapérték, megadott érvénytelen értékre hibaág. A `greppable-invariants` (8)
  kivétele pozitív és negatív esettel (a literál a `default-frontend-config.ts` fájlban átmegy, máshol
  bukik).
- **A `webServer.env` őr:** a `apps/web/playwright.config.ts` mind a négy `VITE_` változót megadja
  (4.6).
- **Az alfolyamat szintje (javaslat, nem döntés):** az M-143 hamis végrehajtható mintájára egy
  `apps/server` teszt, ami a valódi SDK `query()` hívást egy hamis CLI-vel futtatja, és a kapott
  nevek közt a `PATH`-ot és a `HOME`-ot várja. Hálózatot nem érint. Hogy belefér-e a teszt
  időkorlátba (szabálykönyv 12. "időzített bombák"), mérni kell.
- **Indítás:** a `start:server` egy szerver folyamatot indít ideiglenes adatbázissal, a
  `GET /api/providers` `200`; a `dev:server` újraindul egy forrásfájl `touch` után (M-145 mintájára); a
  `dev:web` kiszolgálja a webet. Ez kézi ellenőrzés a PLAN-ban, nem kapu.
- **A próba csonk elleni futása** (PLAN-013 T-013-9): hamis agenttel vagy helyi `/v1/messages` csonkkal,
  hívás nélkül.

---

## 8. Kockázatok

| Kockázat                                                                                                                                          | Kezelés                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A teljes környezettel a lépés eszközei (például a `Bash`) a szerver minden változóját látják, titkot is.                                          | O-5 (a másik provider titka kiszűrve); a `README.md` kimondja, hogy a szerver környezete az agenté is; a saját provider titka (a kulcs) a lépésé.                                                                                  |
| Egy a szerver környezetében álló hitelesítő átirányítja a `minimax` lépést (precedencia 1. szint).                                                | O-4 (a felhő provider választók tiltva).                                                                                                                                                                                           |
| Az `ANTHROPIC_AUTH_TOKEN` a szerver környezetében a precedencia 2. szintje: minden, a szerver környezetét örökítő Claude folyamatot átirányítana. | A `claude-subscription` lépés listája kiszűri (3.2); a `.env` kizárólag a `node --env-file-if-exists` útján a szerver folyamatba kerül, a user shelljébe nem. Az O-1 (a) ezt a kockázatot kerülte volna; a user (b)-t választotta. |
| Ütközés a SPEC-009 branchével (ugyanazok a motor fájlok, a SPEC-009 7.2 és O-21 ugyanerről szól).                                                 | O-18; a PLAN-013 a friss `main`-ről indul, a SPEC-009 átvezetése a `feat/spec-009-beallitasok` branchen történik, nem ezen.                                                                                                        |
| A valódi próba tokenbe kerül, költségkeret és időkorlát nélkül (user döntés).                                                                     | 5.3: engedélyhez kötött futás, `maxTurns: 1`, a kapcsolat teszt kihagyva (O-17); a megszakítás a user dolga.                                                                                                                       |
| A Turborepo `strict` módja a szerver környezetét csendben szűri.                                                                                  | O-8: a három script nem turbo alatt fut (4.1).                                                                                                                                                                                     |
| A web alapérték elfedi a hiányzó build konfigurációt (éles build `VITE_*` nélkül a helyi címekre mutat).                                          | Éles telepítés nem cél (1.); a döntés a user döntése (4.2).                                                                                                                                                                        |
| A `dev:server` újraindítása futó lépéssel nem mért.                                                                                               | A `README.md` kimondja; a `start:server` a stabil út.                                                                                                                                                                              |
| Az `ANTHROPIC_AWS`/`MANTLE` választók rangja nem ellenőrzött (3.2).                                                                               | A tiltott listába a leírásuk miatt kerülnek; a "nem ellenőrzött" jelölés a `reason` mezőben áll.                                                                                                                                   |

---

## 9. Elfogadási kritériumok

### Kimenő környezet

1. A lépés kimenő `env` objektuma a 3.1 szabály szerint áll elő, unit teszt igazolja mindhárom
   lépést.
2. `claude-subscription` mellett a kimenő `env` tartalmazza a `PATH` és a `HOME` változót (ha a
   szerver környezetében állnak), és a 3.2 tiltott nevek egyikét sem; a `CLAUDE_CODE_OAUTH_TOKEN` átmegy.
3. `minimax` mellett az `ANTHROPIC_BASE_URL` értéke a leíró literálja akkor is, ha a szerver
   környezetében más érték áll; a kulcs az `ANTHROPIC_AUTH_TOKEN` változó értéke; a 3.2 `minimax` nevei
   nem jutnak ki.
4. A kapcsolat teszt ugyanazzal a függvénnyel építi a környezetet (teszt igazolja).
5. A regressziós teszt a javítás előtti kódon elbukik.
6. Minden új tiltott bejegyzés `reason` és nem üres `evidence` mezőt hordoz; az `ANTHROPIC_AWS`/`MANTLE`
   bejegyzések `reason` szövege a rang "nem ellenőrzött" voltát kimondja.
7. A kimenő `env` értéke nem jelenik meg a `run_event` táblában és a naplóban (teszt).
8. Az O-5 szabály mindkét irányú drift tesztje (7.) az `apps/server` alatt zöld.
9. A termékkódban és a `tools/wire-probe` alatt (O-20 (b)) a `MINIMAX_API_KEY` név nem szerepel: greppel
   ellenőrizve (a `docs/research/` mérési jegyzőkönyvei és a lezárt `PLAN-000` történeti hivatkozásai
   kivételek, megnevezve a PR leírásban).

### Helyi indítás

10. A szerver egyetlen dokumentált `bun run` paranccsal indul (`start:server`), `npx` és `bun:` modul
    nélkül; a `dev:server` figyelő módban fut; a `dev:web` a webet indítja (4.1).
11. A web és a szerver két külön parancs; a böngészőből a workflow lista betölt, az SSE kapcsolat
    él (kézi ellenőrzés, a lépés leírásával a research fájlban).
12. A commitolt env minták titkot nem tartalmaznak; minden érték a 4.2 táblával egyezik, a megjegyzések a
    forrást megnevezik.
13. A `README.md` leírja az indítást, a kulcs átnevezését, a `claude-subscription` előfeltételét, a
    az alapértékek felülírását (napló, lista, visszajátszás) és a próbát.
14. A kilenc kapu és az e2e változatlanul zöld; a `webServer.env` négy változóját regressziós teszt őrzi.
15. Az `EASTER_SERVER_PORT` hiányában a szerver `3001`-en, az `EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS`
    hiányában `15000`-rel indul; a napló értékei hiányában a 4.2 táblázat szerint (`.data/logs/server`, `10m`,
    `604800000`, `4`); megadott érvénytelen érték hibaág (unit, 7.).
16. A web `VITE_API_ORIGIN` és `VITE_STREAM_ORIGIN` hiányában a 4.2 literálokat használja; a literálok
    egyetlen fájlban állnak, a `vite.config.ts` onnan importál, a `greppable-invariants` (8) kivétele
    pozitív és negatív esettel tesztelt; a `VITE_LIST_LIMIT` és a `VITE_STREAM_REPLAY_LIMIT` hiányában a `100`
    az alapérték (ugyanabban a fájlban), megadott érvénytelen érték hibaág.
17. A T-013-7 a literálok helyességét a futó dev szerveren mért `Origin` fejléccel igazolja, az eredmény a
    research fájlban áll.

### Valódi próba

18. A próba eszköze az `apps/server/measurement/` alatt van, az 5.1 lépéseivel és beállításaival,
    verziókövetve; saját szervert indít ideiglenes adatbázissal.
19. A próba nem része a kilenc kapunak és a CI-nak.
20. A próba kimenete maszkolt; a kulcs értékére futtatott keresés a repóban nulla találatot ad.
21. A próba futása (ha a user engedélyezi) mindkét providerre a research fájlban áll; ha a user nem
    engedélyezi, a spec státusza ezt kimondja, és a 21. kritérium nyitva marad.

### Dokumentáció

22. A H-40 és a H-42 a hiányleltárban ezt a specet nevezi gazdának (10. szekció); a leltár a
    `feat/spec-009-beallitasok` branchen él, az átvezetés ott történik.
23. A SPEC-009 7.2, O-21 és M-137 átvezetése a `feat/spec-009-beallitasok` branchen történik (O-18); ezen
    a branchen csak a 10. szekció jelzése áll.
24. A SPEC-004 11.3, a `packages/engine` `CLAUDE.md`, a szabálykönyv 9. és 11. szekciója, a SPEC-000
    leíró tábla sora átvezetve (10.).

---

## 10. A hiányleltár tételei és az átvezetés

### 10.1 A tételek

| Tétel | Mai gazda a leltárban              | Lezárás                                                                                       |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------- |
| H-40  | SPEC-009 (7. 2. pont, O-21, M-137) | a 3. szekció (a user 2026-10-26-i döntése a SPEC-009 O-21 (b) ágát választotta, ide helyezve) |
| H-42  | nyitott besorolás: SPEC-009 O-29   | a 4. és 5. szekció ("Saját kis spec, elsőként")                                               |

Más tétel a leltárban helyi indításról vagy env mintáról nem szól (`rg "README|\.env" ` a leltár
fájlon: nincs további találat).

**A SPEC-009 átvezetése (O-18, user döntés 2026-10-26).** A SPEC-009 7.2, O-21 és M-137 tétele, valamint a
hatókör hiányleltár H-40 és H-42 gazdája a `feat/spec-009-beallitasok` branchen vezetendő át, mielőtt a
SPEC-009 a `main`-re kerül; **ezen a branchen nem módosítjuk**. A két spec különben ellentmondana
egymásnak a `main`-en (a SPEC-009 O-21 kérdése már eldőlt). Ennek teendője: a SPEC-009 7.2 pontja a
kimenő környezetet ezen spec 3. szekciójára hivatkozza; az O-21 "lezárva, SPEC-012 3." jelölést kap; az M-137
hivatkozása a SPEC-012 research 3. szekciójára (M-143) egészül ki.

### 10.2 A döntések átvezetése a többi dokumentumba

| Dokumentum                                                               | Mi változik                                                                                                                                                                                                                                 | Mikor                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| SPEC-006 (3.2, 6.6, 7.3, O-1 ... O-4)                                    | jelzés: "user döntés 2026-10-26: forrásolt alapérték" a port, az életben tartás időközére; a napló rotációra és útvonalra "user döntés 2026-10-26: iparági ajánlás, forrással" (research 13.1)                                              | ebben a commitban                  |
| SPEC-007 ("Amit NEM dönt el", 9.3, O-4, O-6, 45. kritérium)              | jelzés: az origin alapértékek forrásoltak; a lapméret és a visszajátszás limit "user döntés 2026-10-26: iparági ajánlás, forrással" (research 13.2, 13.3); a 45. kritérium szűkítése                                                        | ebben a commitban                  |
| SPEC-000 leíró tábla (`requiredEnv[ANTHROPIC_AUTH_TOKEN]` sor, 720. sor) | "`process_env_passthrough` az `ANTHROPIC_AUTH_TOKEN` néven álló szerver env változóból" (a `MINIMAX_API_KEY` név helyett)                                                                                                                   | PLAN-013 T-013-11                  |
| SPEC-000 / szabálykönyv 9. szekció titokkezelési mondatai                | a maszkolt érték (a termék oldalán és a `tools/wire-probe` mérő eszközén is) az `ANTHROPIC_AUTH_TOKEN` értéke (O-20 (b)); a SPEC-000 3. szekció maszkolás mondata, a 133. sor env minta, a 763. sor ellenőrzés, a szabálykönyv 9. szekciója | PLAN-013 T-013-11, T-013-12        |
| SPEC-004 11.3 (10. és 11. sor), `packages/engine` `CLAUDE.md`            | a kimenő `env` a 3.1 szerint                                                                                                                                                                                                                | PLAN-013 T-013-11                  |
| szabálykönyv 11. (port és proxy döntés, `greppable-invariants` (8))      | a forrásolt alapérték kivétele, a (8) szűkítése                                                                                                                                                                                             | PLAN-013 T-013-7 (a kóddal együtt) |
| `tools/wire-probe` `CLAUDE.md` (76., 115., 118. sor)                     | a kulcs neve `ANTHROPIC_AUTH_TOKEN` (O-20 (b))                                                                                                                                                                                              | PLAN-013 T-013-12                  |
| `turbo.json`                                                             | a `MINIMAX_API_KEY` sor kikerül (O-20 (b))                                                                                                                                                                                                  | PLAN-013 T-013-12                  |

**Miért nem minden azonnal.** A szabálykönyv, a SPEC-000 és a SPEC-004 szövege olyan állapotot ír le, amit
ma a kód és egy kapu még tart (például a `greppable-invariants` (8) a literálokat tiltja); a szöveg a kóddal
együtt, ugyanabban a commitban változik, különben a szabálykönyv ellentmondana a futó kapunak.

---

## 11. Nyitott kérdések és a user döntései

### 11.1 A tételek

Minden tétel a user 2026-10-26-i döntésével **lezárva**. Az O-10 a forrás nélküli értékekkel együtt lezárt
(a user második döntése: iparági ajánlás, 11.2), az O-20 a (b) opcióval lezárt (11.3).

| ID   | Kérdés                                                                              | Döntés (user döntés 2026-10-26)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Hol valósul meg |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| O-1  | Milyen néven álljon a MiniMax kulcs a szerver környezetében?                        | **Lezárva.** `ANTHROPIC_AUTH_TOKEN` (a (b) opció, a `MINIMAX_API_KEY` helyett); a kód változatlan. A usernek át kell neveznie a `.env` fájl bejegyzését. Következmények: 3.2, 3.4, 6., 10.2                                                                                                                                                                                                                                                                                                                               | 2.4, 3.4, 4.3   |
| O-2  | A `claude-subscription` tiltott listája a minimumon túl mit tartalmazzon?           | **Lezárva.** Minden, a hivatalos hitelesítési sorrendben a `/login` fölött álló env forrás (az `ANTHROPIC_PROFILE`, a két federációs név, a felhő provider választók), plusz az `ANTHROPIC_AWS`/`MANTLE` választók **"nem ellenőrzött" rang** jelöléssel                                                                                                                                                                                                                                                                  | 3.2             |
| O-3  | A `CLAUDE_CODE_OAUTH_TOKEN` tiltott legyen-e a `claude-subscription` providernél?   | **Lezárva.** Nem tiltott, átmegy: claude.ai előfizetéses hitelesítés                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 3.2             |
| O-4  | A `minimax` tiltott listája bővüljön-e a teljes környezet miatt?                    | **Lezárva.** Igen: a felhő provider választók, az `ANTHROPIC_API_KEY`, a `CLAUDE_CODE_OAUTH_TOKEN`, a profil és a federációs nevek                                                                                                                                                                                                                                                                                                                                                                                        | 3.2             |
| O-5  | A kimenő környezetből kerüljenek-e ki a MÁSIK provider titok változói?              | **Lezárva.** Igen: minden lépés csak a saját providere titkait kapja. A megvalósítás a leírók tiltott listája és egy drift teszt, nem futásidejű gyűjtés (levezetett pont, 11.4)                                                                                                                                                                                                                                                                                                                                          | 3.2, 7.         |
| O-6  | Kapjon-e a szerver figyelő módú `dev` scriptet?                                     | **Lezárva.** Igen (a (b) opció): `dev:server`, a Node beépített `--watch` kapcsolójával és az `--env-file-if-exists`-szel, új függőség nélkül. Forrás: research 11. (M-145)                                                                                                                                                                                                                                                                                                                                               | 4.1             |
| O-7  | Honnan induljon a szerver?                                                          | **Lezárva.** A repo gyökeréből, gyökér `package.json` script (az (a) opció); az adatbázis a megszokott `.data/` alatt                                                                                                                                                                                                                                                                                                                                                                                                     | 4.1             |
| O-8  | Egy paranccsal induljon-e a web és a szerver?                                       | **Lezárva.** Két parancs, két terminál (az (a) opció); a turbo `strict` módja nem érinti, mert a scriptek nem turbo alatt futnak                                                                                                                                                                                                                                                                                                                                                                                          | 4.1             |
| O-9  | Egy vagy két env minta fájl?                                                        | **Lezárva.** Kettő: gyökér `.env.example` a szervernek, `apps/web/.env.example` a webnek (az (a) opció)                                                                                                                                                                                                                                                                                                                                                                                                                   | 4.3             |
| O-10 | A forrás nélküli konfigurációs számok kapjanak-e értéket a mintában?                | **Lezárva.** Első döntés ("de akkor keress forrást! legyen default érték beállítva!"): ahol van elsődleges forrás, az érték alapértékként a kódban áll, a minta ezt mutatja, a regressziós teszt őrzi (4.2); forrás: research 10. Második döntés ("webes keresés! mi az ajánlás! nehogy már én találjak ki mindent, amikor ezeket az ipar már kitalálta!"): ahol nincs, az **iparági bevett gyakorlat** az alapérték, forrással (research 13.); ez a SPEC-006 és SPEC-007 "alapérték nélkül" döntéseit teljesen felülírja | 4.2, 11.2       |
| O-11 | Szolgálja-e ki a szerver az épített webet (SPEC-006 O-8)?                           | **Lezárva.** Nem (az (a) opció): a helyi út a Vite dev szerver                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 4.5             |
| O-12 | Hol éljen a valódi próba eszköze?                                                   | **Lezárva.** `apps/server/measurement/` (az (a) opció), gyökér script `probe:real-provider`                                                                                                                                                                                                                                                                                                                                                                                                                               | 5.1             |
| O-13 | A próba saját szervert indítson-e ideiglenes adatbázissal?                          | **Lezárva.** Igen: saját szerver, ideiglenes adatbázis és napló (az (a) opció)                                                                                                                                                                                                                                                                                                                                                                                                                                            | 5.1             |
| O-14 | A próba lépésének `maxTurns` értéke?                                                | **Lezárva.** `1`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 5.1             |
| O-15 | A próba `maxBudgetUsd` értéke és a `run_finished` várakozás időkorlátja?            | **Lezárva.** Költségkeret nincs, időkorlát nincs (user döntés): a korlát a `maxTurns: 1`. A kockázat kimondva (8.)                                                                                                                                                                                                                                                                                                                                                                                                        | 5.1, 8.         |
| O-16 | Tiltsa-e a próba lépése az eszközöket?                                              | **Lezárva.** Nem, csak rövid, eszközt nem kérő prompt                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 5.1             |
| O-17 | Hívja-e a próba a kapcsolat tesztet is?                                             | **Lezárva.** Nem                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 5.1             |
| O-18 | Hol és mikor vezetjük át a SPEC-009 7.2, O-21 és M-137 tételét?                     | **Lezárva.** A `feat/spec-009-beallitasok` branchen történik; ezen a branchen nem; a spec itt csak jelzi (10.1)                                                                                                                                                                                                                                                                                                                                                                                                           | 10.1            |
| O-19 | Az `EASTER_LOG_DIRECTORY` név és a fájl útvonal jelentés eltérése (M-142)           | **Lezárva.** Most csak a minta és a `README.md` magyarázza (az (a) opció); átnevezés nincs                                                                                                                                                                                                                                                                                                                                                                                                                                | 4.3, 4.4        |
| O-20 | A `tools/wire-probe` saját mérési kulcsa (`MINIMAX_API_KEY`) mi legyen az O-1 után? | **Lezárva (user döntés 2026-10-26): (b).** A `tools/wire-probe` is az `ANTHROPIC_AUTH_TOKEN` nevet olvassa, a `.env` fájlban egyetlen név marad. A végrehajtás (kód, SPEC-000, szabálykönyv 9., `tools/wire-probe` `CLAUDE.md`, `turbo.json`) a PLAN-013 T-013-12 lépése                                                                                                                                                                                                                                                  | 11.3            |

### 11.2 Az iparági alapértékek (user döntés 2026-10-26: iparági ajánlás, forrással)

A 10.5 ... 10.7 research szekció szerint a `pino-roll` nem ad alapértéket, és a lapméretre nincs szabvány.
**A user döntése (2026-10-26):** "webes keresés! mi az ajánlás! nehogy már én találjak ki mindent, amikor
ezeket az ipar már kitalálta!" Ezért a hat változó alapértéke az iparági bevett gyakorlat, a döntést a
legtekintélyesebb, legszélesebb körben használt szállított alapérték vagy kimondott ajánlás alapján
a forrás alapján megszületett, nem maradt a userre; a források, az idézetek és az indok a research 13.
szekciójában állnak (elsődleges forrás plusz két független megerősítés értékenként, a napló útvonal
kivételével, ami user döntés). Az értékek a 4.2 táblában vannak a
kódbeli alapértékkel; itt a döntés összegzése:

| Változó                          | Érték               | Forrás (rövid)                                                                                        | Indok egy mondatban                                                                                                                            |
| -------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `EASTER_LOG_ROTATION_SIZE`       | `10m`               | kubelet 10Mi, `pm2-logrotate` 10M, Spring Boot 10MB (research 13.1)                                   | Három független rendszer szállított alapértéke egyezik, és a `pino-roll` `m` utótagja pontosan 10 MiB (M-146).                                 |
| `EASTER_LOG_RETAINED_FILE_COUNT` | `4`                 | `logrotate` `rotate 4` (Debian, Ubuntu, RHEL, upstream); kubelet és Docker `local` 5 fájl az aktívval | A forgatott példányok száma a `logrotate` és a kubelet szerint egyezik (4 plusz az aktív), a `pino-roll` `limit.count` jelentése ugyanez.      |
| `EASTER_LOG_ROTATION_FREQUENCY`  | `604800000`         | `logrotate` `weekly` (három disztribúció és az upstream példa)                                        | A rendszer szintű szabvány a heti; a `pino-roll` 4.0.0 a `weekly` nevet nem ismeri, ezért 7 nap ezredmásodpercben (UTC csütörtök 00:00 határ). |
| `EASTER_LOG_DIRECTORY`           | `.data/logs/server` | **user döntés** (nem iparági): a repo gyökerének `.data/logs/` mappája; a `.data/` kizárt a gitből    | Fájl útvonal előtag (M-142), a napló `.data/logs/server.1.log`; a `db` fájl mintáját követi.                                                   |
| `VITE_LIST_LIMIT`                | `100`               | Slack alapérték és ajánlás, a GitHub, Stripe és GitLab közös maximuma (research 13.2)                 | Alapértékben nincs egyezés (10 és 50 között szórnak), a közös felső korlát és egy kimondott ajánlás igen, és a kezelő 100 fölött levág.        |
| `VITE_STREAM_REPLAY_LIMIT`       | `100`               | Slack `conversations.history`, Ably history, Loki `query_range` alapértéke (research 13.3)            | Három nagy rendszer ugyanazt adja a legközelebbi analóg műveletre (közepes közelség); a szám lapméret, nem plafon.                             |

**Mennyire közeli az analógia.** A naplóra az analógia közeli (ugyanaz a fájl forgatás). A lista és a
visszajátszás lapmérete **közepesen** közeli: a `VITE_LIST_LIMIT` esetén nincs egyező iparági alapérték, a 100
a közös felső korlát és egy ajánlás; a `VITE_STREAM_REPLAY_LIMIT` esetén SSE specifikus lapméret iparági
forrásban nincs, a legközelebbi analógia az eseménynapló lapjának alapértéke. Mindkettő kimondva a research
13.2 és 13.3 szekciójában.

**A felülírás útja.** Mindegyik érték env változóval felülírható (4.3 minta); megadott érvénytelen érték
hibaág, nem csendes visszaesés.

### 11.3 O-20: a `tools/wire-probe` kulcsa (lezárva, user döntés 2026-10-26: (b))

**A helyzet.** A `tools/wire-probe` (a SPEC-000 mérő eszköze) a saját mérési kulcsát korábban
`MINIMAX_API_KEY` néven olvasta a `process.env`-ből, vagy a gyökér `.env` fájlból
(`tools/wire-probe/src/harness/environment.ts:13-33`, `proxy.ts:39`), és ennek értékét maszkolta a lemezre
írás előtt (`mask.ts`); a SPEC-000 3. szekciója és a szabálykönyv 9. szekciója ezt a nevet nevezi. Az O-1
szerint a user a `.env` fájlban a `MINIMAX_API_KEY` sort `ANTHROPIC_AUTH_TOKEN`-re nevezi át, ezért a
wire-probe a kulcsot nem találta volna.

**A döntés (b).** A `tools/wire-probe` is az `ANTHROPIC_AUTH_TOKEN` nevet olvassa, a `.env` fájlban
**egyetlen név** marad (a user korábbi döntése: a kulcs neve `ANTHROPIC_AUTH_TOKEN`). A régi (a) opció (két
név egymás mellett) elvetve.

**Mit érint (PLAN-013 T-013-12).** A kód: `tools/wire-probe/src/harness/environment.ts` (a `process.env`
olvasás, a `.env` sor előtagja, a két hibaüzenet), `src/proxy.ts:39`, valamint a `MINIMAX_API_KEY`-t említő
kommentek (`proxy/mask.ts`, `probe.ts`, `cases/m-32.ts`, `harness/runner.ts`). A dokumentumok: SPEC-000 3.
szekció maszkolás mondata, a mérési configot bemutató blokk és az ellenőrzési pont, a szabálykönyv 9.
szekció titokkezelési mondata, a `tools/wire-probe` `CLAUDE.md` (76., 115., 118. sor). A `turbo.json`
`MINIMAX_API_KEY` sora kikerül (az `ANTHROPIC_AUTH_TOKEN` már szerepel). A `tools/wire-probe/**` a
lefedettségből kizárt mérő eszköz (`vitest.config.ts`), ezért az átnevezés védelme egy greppes regressziós
teszt a `wire-probe-regression` projektben és az AC9 grep. Valódi MiniMax hívás ehhez nem kell. A
`docs/research/` mérési jegyzőkönyvei és a lezárt `PLAN-000` a történeti nevet megtartják (a mérés akkori
állapotát írják le).

### 11.4 Levezetett pontok, amelyeket a user nem nevezett meg

Ezek a döntések következményei; ha a user mást akar, jelezze.

1. **Az O-5 megvalósítása** a leírók tiltott listája plusz drift teszt, nem futásidejű gyűjtés: a két
   leíró fix, és egy futásidejű ág a 100 százalékos lefedettségi szabály miatt (szabálykönyv 5.) halott
   ág volna.
2. **A script nevek:** `start:server`, `dev:server`, `dev:web`, `probe:real-provider` (a repóbeli
   `kettőspontos` névkonvenciót követik: `test:e2e`, `check:graph`).
3. **Az `EASTER_STREAM_DEV_ORIGIN` opcionális marad, alapérték nélkül** (4.2); a mintában
   `http://localhost:5173`.
4. **A web alapérték helye és a (8) invariáns kivétele** (4.2): a forrásolt alapérték csak így fér el a
   meglévő gépi őr mellett.
5. **Az `ANTHROPIC_AWS`/`MANTLE` választók a tiltott listában** vannak, "nem ellenőrzött" rang jelöléssel.
6. **Az üres env érték hiányzónak számít** (a mai config olvasó szabálya), tehát az üres sor az
   alapértékre esik vissza (4.2); a mintában az `ANTHROPIC_AUTH_TOKEN` áll üresen (titok, értéket nem hordoz).
7. **A `dev:server` az env fájl változására is újraindít** (M-145), a `README.md` kimondja.
8. **A figyelő módú újraindítás hatása futó lépéssel nem mért**; a spec nem állít róla semmit.

---

## 12. Kapcsolódó dokumentumok

- [`../research/2026-10-26-helyi-inditas-es-valodi-proba.md`](../research/2026-10-26-helyi-inditas-es-valodi-proba.md)
- [`../plan/PLAN-013-helyi-inditas-es-valodi-proba.md`](../plan/PLAN-013-helyi-inditas-es-valodi-proba.md)
- [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) 11.3 és 12. szekció
- [`SPEC-006-szerver-alkalmazas.md`](SPEC-006-szerver-alkalmazas.md) 4.2, 12. (O-1 ... O-8)
- [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) O-4, O-6, 45. kritérium
- `.claude/CLAUDE.md` 4., 7., 8., 9., 11. és 12. szekció
