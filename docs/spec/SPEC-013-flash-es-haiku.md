# SPEC-013: MiniMax-M3.1-Flash az M3 helyén, két kulcsnév, thinking átadás javítása

|          |                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | jóváhagyott, végrehajtásra kész: a 11. szekció hét nyitott kérdése a user 2026-10-27-i döntéseivel lezárva, a `claude-haiku-5-5` felvétele a user döntése szerint kikerült a hatókörből (1. szekció).                                                                                                                                                                   |
| Dátum    | 2026-10-27                                                                                                                                                                                                                                                                                                                                                              |
| Előzmény | [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md) (a leírók, a `Fact` bizonyíték kényszer), [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) (11.3: a motor viselkedése `unknown` mezővel), [`SPEC-012-helyi-inditas-es-valodi-proba.md`](SPEC-012-helyi-inditas-es-valodi-proba.md) (3.2 tiltott listák, 5. valódi próba) |
| Bemenet  | [`../research/2026-10-27-flash-es-haiku.md`](../research/2026-10-27-flash-es-haiku.md)                                                                                                                                                                                                                                                                                  |
| Kimenet  | a `minimax` leíró a `MiniMax-M3.1-Flash` modellre áll, a MiniMax kulcs két néven is érkezhet (a létrehozó ablak mindkettőt kiírja), a motor a lépés `thinking` beállítását az SDK objektum alakjában adja át, a valódi próba a Flash-sel és a `claude-haiku-4-5`-tel indítható                                                                                          |
| Terv     | [`../plan/PLAN-014-flash-es-haiku.md`](../plan/PLAN-014-flash-es-haiku.md). **A számozás eltér:** a PLAN-012 a SPEC-009-é (a `feat/spec-009-beallitasok` branchen, még nincs a `main`-en), a PLAN-013 a SPEC-012-é, ezért a SPEC-013 terve a PLAN-014. A fájlnevek és a branch neve (`flash-es-haiku`) a hatókör szűkítése után is maradnak.                            |

---

## 1. Cél és hatókör

**A user döntései (2026-10-27), szó szerint ezek:**

1. "megváltozott a model név": a MiniMax modell a `MiniMax-M3.1-Flash`, ez lép a `MiniMax-M3`
   **helyére** (csere, nem mellé). A szabálykönyv 9. szekciójának hatókör szabálya ennek megfelelően
   átíródik.
2. A MiniMax kulcs a `.env` fájlban `ANTHROPIC_API_KEY` és `ANTHROPIC_AUTH_TOKEN` néven is működjön
   ("Mindkettő működjön").
3. A Claude (`claude-subscription`) próba a legolcsóbb, a pinelt SDK-val elérhető modellel fut. Az első
   javaslat (`claude-haiku-5-5` felvétele a katalógusba) **kikerült**: a user kérdése "miert kell a
   haiku", mert a Claude próba előfizetéssel fut, nem tokenár alapon. A próba a katalógusban már álló
   `claude-haiku-4-5`-tel fut. **Nincs SDK frissítés, nincs Claude katalógus bővítés.**
4. Utána valódi próba fut mindkét providerrel (`bun run probe:real-provider`), alacsony tokennel. A user
   az engedélyt megadta; a próba nem része ennek a spec végrehajtásának, külön lépés (6.).
5. A 11. szekció O-1 ... O-7 kérdésének lezárása (a táblában "Lezárva").

### Amit eldönt

1. A `minimax` leíró modell katalógusa, és mezőnként, hogy mi marad `known` és mi lesz `unknown` (3.).
2. A Flash "mindig gondolkodik" tényének kezelése a leíróban és a motorban (3.3).
3. A két kulcsnév bemeneti szabálya, a kimenő SDK környezet, a "mindkettő beállítva" eset, a tiltott
   listák, a titok maszkolás és a felület kijelzése (4.).
4. A motor `thinking` átadásának javítása (5., O-5).
5. A valódi próba alapértékei (6.).
6. Mi áll át a Flash-re és mi marad történeti tény (3.6, 7.).

### Amit NEM dönt el (nem cél)

- Az Agent SDK verzió frissítése és a `claude-haiku-5-5` felvétele (user döntés 3., O-1). A research 3. és 4. szekciójának megállapítása (a `claude-haiku-5-5` legalább a Claude Code `2.1.293`-as verzióját
  igényli, a pinelt SDK `2.1.245`-öt csomagol) tényként marad, a hatókörbe nem tartozik.
- A SPEC-000 mérések megismétlése a Flash ellen (valódi hívás; O-2, O-7).
- Adat migráció (O-3: nincs adatbázis, nincs mit migrálni).
- Más MiniMax modell. A `MiniMax-M3` ebben a specben kizárólag mint a lecserélt modell szerepel.

---

## 2. Megerősített tények, forrással

Minden tény a research fájlban áll, elsődleges forrással és megerősítéssel. A döntésekhez szükséges
kivonat:

| Tény                                                                                                                                                               | Research szekció |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| A Flash API azonosítója `MiniMax-M3.1-Flash`, a Claude Code kliens azonosítója `MiniMax-M3.1-Flash[1m]`                                                            | 2.               |
| A Flash mindig gondolkodik: `thinking` elhagyva vagy `adaptive` mellett be, `disabled` mellett `400` (`2013`)                                                      | 2.               |
| A Flash `output_config.effort` értéke `low` ... `max`, elhagyva `max`                                                                                              | 2.               |
| Hitelesítési sorrend: `ANTHROPIC_AUTH_TOKEN` (2.) a `ANTHROPIC_API_KEY` (3.) előtt; az előbbi `Authorization: Bearer`, az utóbbi `X-Api-Key` fejléc                | 5.               |
| Az SDK a `thinking` opciót objektumként olvassa (`thinking.type`), a motor ma szöveget ad át                                                                       | 6., 10.3         |
| Egy egyszerű `agent_step` lépést egyetlen `unknown` leíró mező sem buktat                                                                                          | 7.               |
| A pinelt CLI bináris ismeri a `claude-haiku-4-5` azonosítót                                                                                                        | 10.1             |
| A `claude-haiku-4-5` az effort paramétert nem támogatja (az effort lap modell listája, a Haiku 5.5 útmutató, a pinelt CLI saját modell ellenőrzése)                | 10.2             |
| Megállapítás, a hatókörön kívül: a `claude-haiku-5-5` a pinelt SDK-val (Claude Code `2.1.245`) a szerver `400` `claude_code_version_too_old` válasza miatt nem fut | 3., 4.           |

---

## 3. A modell csere

### 3.1 Katalógus

- `MiniMaxModelId` = `'MiniMax-M3.1-Flash'` (egyetlen elem, a `'MiniMax-M3'` kikerül).
- `MiniMaxFamilyId` = `'M3.1-Flash'` (egyetlen elem, a `'M3'` kikerül). A család neve technikai
  azonosító, a modell azonosítóból képezve; a motor a `thinking.byModelFamily` kulcsaként használja.
- A `minimaxModels` lista egyetlen eleme a Flash. A leíró továbbra is pontosan egy modellt ír le, tehát a
  `requireModelSelection` modellválasztás nélkül is a Flash-t választja (SPEC-004 11.3 6. sor).
- A `measuredAt` értéke `'2026-10-27'`, a `claude-subscription` leíró meglévő mintájára kommenttel: a
  dátum a dokumentáció ellenőrzéséé, nem drótszintű mérésé.

### 3.2 A leíró mezői

**A szabály.** Az M3-ra végzett mérések (M-xx) a Flash-re nem vihetők át. Egy mező akkor `known`, ha a
research 2. szekciójának egy Flash-re vonatkozó elsődleges forrása, vagy egy modelltől független Claude
Code dokumentum **magát az értéket** állítja, **és a gyökér `CLAUDE.md` 1. szabálya szerint két, a
MiniMaxtól független forrás is megerősíti** (a második review javítása, 2026-10-27; a kiadó szerinti
függetlenség, nem a származás szerinti: a megerősítő lapok a MiniMax dokumentációját olvasták, lásd a
research 14. szekcióját). Minden más mező `unknown`, a `reason` mezőben az, hogy a mezőt az előző modellre
mérték, a Flash-re nem (a `reason` szöveg mérési azonosítót nem tartalmazhat, a `provider-registry`
tesztje ezt őrzi), a `blockedBy` mezőben az eredeti M-xx azonosítókkal (ezek a megismétlendő mérések).
**Kivétel: ha nincs olyan mérési eset, ami a mezőt lezárná** (a `requestsPerMinute` és a
`tokensPerMinute`: az M-18 és az M-36 header leltár mérés, nem az értéket zárja), a `blockedBy` üres,
és a `reason` kimondja, hogy független forrás hiányzik (a `Fact` típus az üres listát engedi; a
`provider-registry` tesztje az üres listát csak ezzel a mondattal fogadja el).

| Mező                                                           | Új állapot                                                                                                                                                                                                                                          | Bizonyíték vagy blokkoló                                                                                                                                 |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models[0].clientModelIdentifier`                              | `known` `'MiniMax-M3.1-Flash[1m]'`                                                                                                                                                                                                                  | m-plan és token-plan Claude Code lap, plusz két független megerősítés (research 2.)                                                                      |
| `models[0].contextWindow`                                      | `known` `1_000_000`                                                                                                                                                                                                                                 | text-anthropic-api, text-generation guide, plusz két független megerősítés (Cloudflare, TypingMind; research 14.)                                        |
| `models[0].maxOutputTokensRecommended` / `maxOutputTokensHard` | `known` `131_072` / `524_288`                                                                                                                                                                                                                       | text-chat-openai (`max_completion_tokens`), plusz két független megerősítés (7minai, Wokey; research 14.) / a `maxOutputTokensHard`: Wokey és TypingMind |
| `models[0].effectiveContextWindowOnWire`                       | `unknown`                                                                                                                                                                                                                                           | M-20                                                                                                                                                     |
| `models[0].maxOutputTokensWireCeiling`                         | `unknown`                                                                                                                                                                                                                                           | M-22                                                                                                                                                     |
| `models[0].imageInput`                                         | `unknown` (a doksi és az M3 mérés ütközik, research 2.)                                                                                                                                                                                             | M-23, M-16                                                                                                                                               |
| `models[0].videoInput`                                         | `unknown`, változatlan indokkal                                                                                                                                                                                                                     | M-16, M-23                                                                                                                                               |
| `models[0].listedByModelsEndpoint`                             | `unknown`                                                                                                                                                                                                                                           | M-35                                                                                                                                                     |
| `thinking.byModelFamily['M3.1-Flash']`                         | `known` `['adaptive']` (3.3)                                                                                                                                                                                                                        | text-anthropic-api, text-openai-api, m-plan Claude Code lap, plusz két független megerősítés (Wokey, 7minai; research 14.)                               |
| `thinking.interleavedSignatureRequired`                        | `unknown` (a research 2. szekciójában erre nincs forrásolt sor; adverzariális átvizsgálás, T-014-11)                                                                                                                                                | M-05                                                                                                                                                     |
| `thinking.wireShape`, `sendsBudgetTokens`, `streamEventTypes`  | `unknown`                                                                                                                                                                                                                                           | M-01, M-05, M-06                                                                                                                                         |
| `effort.accepted`                                              | `known` `true`                                                                                                                                                                                                                                      | text-anthropic-api, text-generation guide, plusz két független megerősítés (Cloudflare, Wokey; research 14.)                                             |
| `effort.wireField`                                             | `known` `'output_config.effort'`                                                                                                                                                                                                                    | text-anthropic-api, text-generation guide, plusz két független megerősítés (7minai, FounderMag; research 14.)                                            |
| `structuredOutput` minden `known` mezője                       | `unknown`                                                                                                                                                                                                                                           | M-01, M-02, M-03, M-04, M-19, M-26                                                                                                                       |
| `toolChoice` mindhárom mezője                                  | `unknown` (a doksi ellentmondásos, research 2.)                                                                                                                                                                                                     | M-03, M-17, M-34                                                                                                                                         |
| `promptCaching` minden `known` mezője                          | `unknown` (a `RESEARCH_MINIMAX` a M3 kori doksi kivonata); a már `unknown` `mode` a saját blokkoló listáját tartja (M-15, M-20, M-24, M-33)                                                                                                         | M-08, M-15, M-24, M-33                                                                                                                                   |
| `streaming` mezői, a `fineGrainedToolStreaming` kivételével    | `unknown`                                                                                                                                                                                                                                           | M-05, M-09, M-24                                                                                                                                         |
| `streaming.fineGrainedToolStreaming`                           | `known` `false`, csak a `RESEARCH_GATEWAY` bizonyítékkal                                                                                                                                                                                            | Claude Code gateway dokumentáció (modelltől független)                                                                                                   |
| `serverTools`                                                  | `unknown`                                                                                                                                                                                                                                           | M-17, M-25                                                                                                                                               |
| `modelsEndpoint.directHttpReachable`, `listedModelCount`       | `unknown`                                                                                                                                                                                                                                           | M-35                                                                                                                                                     |
| `modelsEndpoint.calledBySdk`                                   | `unknown` (a kapcsolat teszt módja ettől nem változik: `minimal_query`, research 7.)                                                                                                                                                                | M-12, M-36                                                                                                                                               |
| `rateLimits.buckets[0]`                                        | `appliesTo: ['MiniMax-M3.1-Flash']`, `requestsPerMinute` és `tokensPerMinute` `unknown`, **üres `blockedBy`**: a 200 / 10 000 000 csak a MiniMax lapjain áll, független forrás hiányzik (research 2.), és nincs mérési eset, ami az értéket lezárná | nincs (az M-18 és az M-36 header leltár, nem az értéket zárja)                                                                                           |
| `rateLimits.retryAfterHeader`, `rateLimitHeaders`              | `unknown`, változatlan                                                                                                                                                                                                                              | M-18, M-36                                                                                                                                               |
| `concurrency.subagentCapEnvVar`                                | `known`, csak a `DOC_ENV_VARS` bizonyítékkal                                                                                                                                                                                                        | Claude Code env-vars                                                                                                                                     |
| `concurrency` többi mezője                                     | `unknown`                                                                                                                                                                                                                                           | M-31, M-39                                                                                                                                               |
| `anthropicBetaHeaders`                                         | `unknown`                                                                                                                                                                                                                                           | M-01, M-11, M-14, M-32                                                                                                                                   |
| `requiredEnv`, `disallowedEnv`                                 | a 4. szekció szerint                                                                                                                                                                                                                                | 4.                                                                                                                                                       |

**A forrás konstansok.** A MiniMax dokumentum URL-ek új, nevesített konstansként a
`provider-capability` `document-url.ts` fájljába kerülnek (a meglévő `DOC_*` mintájára), a research
szekció egy új `RESEARCH_*` konstansba. Kitalált URL nincs: csak a research 2. szekciójában álló címek.

### 3.3 A "mindig gondolkodik" tény

- A `ThinkingMode` típus nem változik (`'disabled' | 'adaptive' | 'always_on'`).
- A Flash család megengedett módjai: `['adaptive']`. A `disabled` a forrás szerint `400`, tehát egy
  `disabled` beállítású Flash lépést a motor a futás indításakor `thinking_mode_unsupported` hibával
  elutasít (a meglévő `resolveThinkingMode` ág, kódváltozás nélkül), mielőtt hívás menne ki.
- Az `always_on` nem kerül a listára: az SDK `ThinkingConfig` típusának nincs ilyen ága (research 6.),
  tehát a módnak nincs drótalakja; az `adaptive` a dokumentált, elfogadott érték.
- A `null` thinking (a próba lépése) a motorban `omit`; a CLI ilyenkor a saját alapértékét küldi, ami a
  research 6. szekció 3. pontja szerint `adaptive` vagy elhagyott mező, és a Flash mindkettővel működik.
  Hogy a pinelt CLI pontosan mit küld, nem mért (research 9. 2. pont); a valódi próba sikere vagy `2013`-as
  hibája dönti el.
- A `minimax` tiltott listáján a `MAX_THINKING_TOKENS` és a `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`
  marad; az indoklás szövegéből az "M3" szó kikerül, a tartalom a Flash forrására áll (research 2.: a
  `disabled` `400`). A `disallowedEnv` és a `requiredEnv` bejegyzések M-xx bizonyítékai (például a
  `MAX_THINKING_TOKENS` M-06, M-08 és a `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` M-07, M-08, M-21)
  a CLI viselkedését mérték, nem a modellét, ezért modelltől független tényként maradnak; ezek nem
  `Fact` mezők.

### 3.4 A motor

A modell csere a motorban kódváltozást nem igényel (a `thinking` átadás javítása az 5. szekció, a
cserétől független hiba). A research 7. szekciója szerint a próba lépését egyetlen `unknown` mező sem
buktatja. A következmények (ezek a `step_started` payload meglévő jelölései):

- `modelIdentifierUnproven: false`, mert a `clientModelIdentifier` `known`;
- `includePartialMessages: false`, mert a `streaming.sse` `unknown`: a `minimax` lépés élő nézete delta
  események nélkül fut (O-7, nyitott pont, 11. szekció);
- `serverToolAvailabilityUnproven: true`, és a `WebSearch` nem kerül a `disallowedTools` listára.

### 3.5 Hol változik a kód, a teszt és a fixtúra

| Hely                                                                                                                                                                                                                                                                                                                                              | Változás                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/provider-minimax/src/model-catalog/*`                                                                                                                                                                                                                                                                                                   | 3.1                                                                                                                             |
| `packages/provider-minimax/src/request-shaping/*`, `limits/*`, `tool-support/*`, `descriptor/descriptor.ts`                                                                                                                                                                                                                                       | 3.2                                                                                                                             |
| `packages/provider-minimax/src/environment/*`                                                                                                                                                                                                                                                                                                     | 4.                                                                                                                              |
| `packages/provider-capability/src/environment/*`, `packages/engine/src/provider-environment/*`, `apps/server/src/startup-sequence/*`, `apps/server/src/provider-*`                                                                                                                                                                                | 4.                                                                                                                              |
| `packages/protocol/src/provider/*`, `apps/server/src/provider-endpoint/*`, `apps/web/src/workflow-list/*` és a `requiredEnvNames` fixtúrák                                                                                                                                                                                                        | 4.8 (O-4)                                                                                                                       |
| `packages/engine/src/agent-step/*`                                                                                                                                                                                                                                                                                                                | 5. (O-5)                                                                                                                        |
| `packages/provider-capability/src/evidence-sources/measurement-document/*`                                                                                                                                                                                                                                                                        | új `DOC_*` és `RESEARCH_*` konstansok                                                                                           |
| `apps/server/measurement/build-probe-graph.ts` és `.spec.ts`, `run-probe.spec.ts`, `real-provider-probe.ts`                                                                                                                                                                                                                                       | 6.                                                                                                                              |
| `tools/wire-probe/src/harness/environment.ts` és `.spec.ts`, `tools/wire-probe/src/proxy.ts`                                                                                                                                                                                                                                                      | 4.7 (a kulcs olvasása mindkét néven)                                                                                            |
| `apps/web/src/run-event-row/RunEventRow.tsx` és `.spec.tsx`                                                                                                                                                                                                                                                                                       | a költség magyarázat mondatában a modell neve `MiniMax-M3.1-Flash` (research 8.: a pinelt CLI ártáblájában a Flash sincs benne) |
| `apps/web/src/workflow-list/create-workflow-modal.spec.tsx`, `packages/protocol/src/provider/provider-summary.spec.ts`, `packages/engine/src/node-executor/execute-error-handler.spec.ts`, `packages/db/src/workflow-graph/agent-step-config/is-agent-step-config.spec.ts`, `packages/db/src/run-event/sdk-message/normalize-sdk-message.spec.ts` | a teszt adatban a modell azonosító `MiniMax-M3.1-Flash`                                                                         |
| `packages/provider-minimax/CLAUDE.md`, `apps/server` és `apps/web` `CLAUDE.md`                                                                                                                                                                                                                                                                    | ahol a modell neve vagy a kulcs neve áll, a Flash és a két név                                                                  |

### 3.6 Ami történeti tény marad (nem íródik át)

- A `docs/research/` minden 2026-10-27 előtti fájlja, a SPEC-000 és a PLAN-000, valamint a régebbi
  specek és tervek mérési tényei (például SPEC-004 F-11, SPEC-011 M-16/M-23 sorok): ezek az M3-ra
  mért, keltezett tények.
- `packages/db/src/graph-snapshot/snapshot-hash/graph-snapshot-document-v1-fixture.json`: a commitolt v1
  pillanatkép fixtúra, aminek a lenyomata szó szerint áll a tesztben, és a teszt fejléce szerint "a
  literált nem szabad felülírni"; a pillanatkép megváltoztathatatlan (szabálykönyv 10. 2. pont). A
  benne álló `MiniMax-M3` egy régi, tárolt gráf adata.
- `tools/wire-probe/src/cases/*` és `harness/runner.ts`: a SPEC-000 M3 méréseinek reprodukciója,
  történeti mérő eszköz (O-2, lezárva): egy jövőbeli SDK frissítés regressziós mérésénél állnak át a
  Flash-re. A kulcs olvasása (`harness/environment.ts`) ettől függetlenül mindkét nevet fogadja (4.7).
- A SPEC-012 5.1 táblázata és 47., 378. sora: a SPEC-012 a saját idejének döntése; a PLAN-014 egy
  egysoros "SPEC-013 felülírja" jelölést tesz melléjük (szabálykönyv 14. 4. pont, átvezetés).

---

## 4. A két kulcsnév

### 4.1 Bemenet

A `minimax` provider kulcsa a szerver folyamat környezetéből két néven jöhet: `ANTHROPIC_AUTH_TOKEN`
vagy `ANTHROPIC_API_KEY` (user döntés 2.). A `.env` fájlt a meglévő `node --env-file-if-exists=.env`
út tölti be, ez nem változik.

### 4.2 Kimenő SDK környezet

**Kizárólag az `ANTHROPIC_AUTH_TOKEN` megy ki**, a kulcs értékével, bármelyik néven érkezett.

Indok, forrással: a MiniMax Claude Code lapjai (m-plan, token-plan) ezt a nevet írják a Claude Code
számára (research 2.); a projekt minden eddigi CLI-s MiniMax futása ezen a néven ment (research 5.);
a CLI-n át `ANTHROPIC_API_KEY`-vel a MiniMax felé nincs mérés. Egyetlen kimenő név mellett a CLI
"mindkettő beállítva" viselkedése (research 9. 4. pont, nem mért) a lépésnél sosem áll elő.

Az `ANTHROPIC_API_KEY` a `minimax` tiltott listáján marad: a kimenő környezet alapjából kiszűrődik
(SPEC-012 3.1 2. lépés), tehát `X-Api-Key` fejléc nem megy a MiniMax felé. A bejegyzés `reason` szövege
átíródik: a változó a kulcs elfogadott bemeneti neve, de a kimenő környezetbe nem kerül, mert a
kimenő név az `ANTHROPIC_AUTH_TOKEN`.

### 4.3 Mindkettő beállítva

**Az `ANTHROPIC_AUTH_TOKEN` nyer**, az `ANTHROPIC_API_KEY` értéke figyelmen kívül marad. Forrás: a
Claude Code hitelesítési sorrendje (`ANTHROPIC_AUTH_TOKEN` 2., `ANTHROPIC_API_KEY` 3.; research 5.). A
projekt ugyanazt a választást teszi, amit a CLI tenne, ha mindkettőt megkapná.

Az üres érték (`ANTHROPIC_AUTH_TOKEN=` a `.env`-ben) **hiányzónak számít**, a `tools/wire-probe`
mérő eszközzel egyezően (a második review javítása, 2026-10-27): a `ProcessEnvironmentPort.read` az
üres változóra üres sztringet ad, a feloldás (`resolveRequiredEnvironmentValue`) viszont a `null` mellett
az üres sztringet is átlépi. Enélkül egy üres `ANTHROPIC_AUTH_TOKEN=` sor és egy érvényes
`ANTHROPIC_API_KEY` mellett a szerver üres Bearer tokent küldene. Ha minden név üres vagy hiányzik,
`missing_provider_env` a hiba. A `.env.example` figyelmeztetése a környezetbe jutásról szól, és
változatlanul igaz.

### 4.4 A leíró alakja

Az `EnvironmentRequirement` unió harmadik ágat kap a `source` mezőn:

```ts
interface AlternativePassthroughEnvironmentRequirement extends EnvironmentRequirementBase {
  readonly source: 'process_env_alternatives';
  /** További bemeneti nevek, csökkenő elsőbbséggel, a `name` után. */
  readonly alternativeNames: readonly [string, ...string[]];
}
```

- A `name` a kimenő név és az első helyen olvasott bemeneti név.
- A feloldás (`resolveRequiredEnvironmentValue`): a `name`, majd az `alternativeNames` sorrendjében az
  első nem `null` érték; ha egyik sincs, `missing_provider_env`, a hibaüzenet az összes nevet
  felsorolja, értéket soha.
- `secret: true` mellett ez az ág is csak a process env-ből olvas (a meglévő szabály).
- A `minimax` `requiredEnv` bejegyzése: `name: 'ANTHROPIC_AUTH_TOKEN'`,
  `alternativeNames: ['ANTHROPIC_API_KEY']`, `source: 'process_env_alternatives'`, `secret: true`.
- A kimerítő `switch` minden helyen, ahol a `source` mezőn ágazunk, a harmadik ágat is kezeli
  (`switch-exhaustiveness-check`).

### 4.5 Tiltott listák és a másik provider

- **`claude-subscription`: változatlan.** Mindkét név (`ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`)
  tiltott: a MiniMax titka a Claude lépéshez nem juthat (SPEC-012 O-5), és az `ANTHROPIC_API_KEY` a
  `/login` fölött állna (SPEC-012 3.2).
- Az `apps/server` `provider-environment-drift-protection` témája az alternatív neveket is a titok nevek
  közé számolja: a `claude-subscription` tiltott listájának a `minimax` minden titkos bemeneti nevét
  tartalmaznia kell.

### 4.6 Titok maszkolás

A `collect-secret-environment-values.ts` a `secret: true` bejegyzések **összes** bemeneti nevének
értékét gyűjti (a `name` és az `alternativeNames`), hogy egy `ANTHROPIC_API_KEY` néven érkezett kulcs
is `REDACTED` legyen a naplóban és a próba kimenetében.

### 4.7 Env minta, README, Turborepo, wire-probe

- A gyökér `.env.example`: a kikommentelt sor mellé a második név is, egy mondattal (bármelyik név elég;
  ha mindkettő áll, az `ANTHROPIC_AUTH_TOKEN` nyer).
- Az `apps/web/.env.example`: egy mondat, hogy a MiniMax kulcs (mindkét néven) nem ide, hanem a gyökér
  `.env` fájlba kerül, mert a Vite csak `VITE_` előtagú változót tölt, és titok ide soha nem kerül.
- `README.md`: a `minimax` sor mindkét nevet megnevezi.
- `turbo.json` `globalPassThroughEnv`: az `ANTHROPIC_API_KEY` felvétele, hogy a `turbo` alatt futó
  `dev` task is megkapja.
- `tools/wire-probe`: a kulcs olvasása (`harness/environment.ts`), a proxy és a `meta.json` titok
  maszkolása (`proxy.ts`, `harness/runner.ts`) mindkét nevet fogadja, ugyanazzal az elsőbbséggel (az
  `ANTHROPIC_AUTH_TOKEN` nyer); az üres érték mindkét helyen hiányzónak számít (4.3). A mérő a CLI környezetéből mindkét nevet
  kiveszi, és a kulcsot csak `ANTHROPIC_AUTH_TOKEN` néven adja (user döntés 2026-10-27, a 2. döntés
  következménye, mert a `tools/wire-probe` is a gyökér `.env` fájlból olvas).

### 4.8 A létrehozó ablak kijelzése (O-4, lezárva: (a))

- A `ProviderSummary` `requiredEnvNames` mezőjének eleme egy követelmény **elfogadott neveinek nem üres
  listája**, elsőbbségi sorrendben (`z.tuple([z.string()], z.string())`): `literal` és
  `process_env_passthrough` forrásnál egy név, `process_env_alternatives` forrásnál a `name` és az
  `alternativeNames`. Értéket továbbra sem hordoz.
- A létrehozó ablak egy követelmény neveit " vagy " kötőszóval fűzi össze, a követelményeket vesszővel:
  `Szükséges környezeti változók: ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY,
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. A vesszős felsorolás és a literál forrású nevek
  megjelenítése a mai viselkedés (SPEC-007 10.1), nem változik.

---

## 5. A thinking átadás javítása (O-5, lezárva: ebben a körben, regressziós teszttel)

### 5.1 A hiba

A motor `AgentStepOptions.thinking` mezője ma `ThinkingMode` szöveg (`'adaptive'`), amit a
`buildAgentStepOptions` változatlanul tesz az `Options.thinking` mezőbe. A pinelt SDK `sdk.d.ts` szerint
a mező típusa `ThinkingConfig`, három objektum ágú unió (`{ type: 'adaptive' }`, `{ type: 'enabled' }`,
`{ type: 'disabled' }`), és a `sdk.mjs` `switch(thinking.type)` ágakkal olvassa. Egy szöveg `.type`
mezője `undefined`, tehát a lépés `thinking` beállítása egyik providernél sem jut el a CLI-ig (research 6. 2. pont, 10.3). A típusrendszer nem fogta meg, mert az `AgentQueryRequest.options` mező
`Readonly<Record<string, unknown>>`.

### 5.2 A javítás

- Az `AgentStepOptions.thinking` típusa az SDK alak két ága: `{ readonly type: 'adaptive' } |
{ readonly type: 'disabled' }`. A motor csomag az SDK-tól nem függ, ezért a típus a motorban áll, a
  kompatibilitást az 5.3 típusszintű teszt őrzi.
- A leképezés a `buildAgentStepOptions` modulon belüli segédfüggvénye (`thinkingFields`), a többi mező
  segédfüggvényének mintájára: `adaptive` -> `{ type: 'adaptive' }`,
  `disabled` -> `{ type: 'disabled' }`, `always_on` -> nincs mező. Az `always_on`-nak nincs SDK ága
  (`ThinkingConfig`), és egyik valódi leíró sem engedi (a `resolveThinkingMode` előbb elutasítja); ha egy
  leíró egyszer engedné, a "mindig gondolkodik" modellnél a mező elhagyása a modell saját alapértékét
  hagyja érvényben. Az `enabled` ág (fix budget) a `ThinkingMode` típusban nem létezik, nem kerül be.
- A `display` mezőt a motor nem állítja (nem kért, az SDK opcionális mezője).

### 5.3 Regressziós teszt

- `packages/engine`: a `build-agent-step-options.spec.ts` a `thinking` mezőt objektumként állítja
  (a régi `'adaptive'` szöveg elvárás maga a hiba volt), és a leképező függvény mindhárom ágára unit
  teszt.
- `apps/server` (ott látszik a motor és az SDK típusa együtt): típusszintű teszt, hogy az
  `AgentStepOptions['thinking']` hozzárendelhető az SDK `Options['thinking']` típusához; a `typecheck`
  kapun bukik, ha a motor újra szöveget adna.

---

## 6. A valódi próba

| Beállítás                                                                   | `minimax`                                                                                                | `claude-subscription`                                                                                                                                          |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| modell                                                                      | `MiniMax-M3.1-Flash` (a `build-probe-graph.ts` `MINIMAX_MODEL_ID` konstansa)                             | `claude-haiku-4-5`, a `build-probe-graph.ts` alapértéke (user döntés 3.); a `modelId` argumentum felülírhatja                                                  |
| `maxTurns`, prompt, költségkeret, időkorlát, eszköz tiltás, kapcsolat teszt | a SPEC-012 5.1 szerint, változatlanul                                                                    | ugyanaz                                                                                                                                                        |
| `effort`                                                                    | `'low'` (O-6: a forrás a `low` értéket elfogadja, research 2.; a leíró `effort.accepted` `known` `true`) | `null` (O-6: a `claude-haiku-4-5` az effortot nem támogatja, research 10.2; a leíró provider szintű `known` `true` mezője ezt nem bontja modellre, 9. szekció) |
| `thinking`                                                                  | `null` (3.3)                                                                                             | `null`                                                                                                                                                         |

- A `run-probe.spec.ts` "modell nélkül `model_not_selected`" tesztje törlődik: a `claude-subscription`
  próbának ezután van alapmodellje, tehát ez az ág a próba úton nem áll elő. A `model_not_selected`
  motor oldali ágát a `require-model-selection.spec.ts` változatlanul fedi. Helyette a hamis ágens
  kérésében a modell `claude-haiku-4-5` (alapérték), és a `modelId` argumentum felülírása is teszt.
- A `minimax` próba elvárt kérésében a modell `MiniMax-M3.1-Flash[1m]` és az `effort` `low`; a
  `claude-subscription` kérésében `effort` nincs.
- Engedély: a user a 2026-10-27-i döntésében (4.) megadta; a végrehajtó agent a futás előtt a SPEC-012
  5.3 szerinti felsorolással egyszer még megerősíti, mert a beállítások (modell, `effort`) e spec óta
  mások.
- A futás sorrendje: mindkét próba ennek a specnek a merge-e után futhat.
- Az eredmény a research fájl új szekciójába kerül.

---

## 7. A szabálykönyv változása

A `.claude/CLAUDE.md` 9. szekciójának hatókör bekezdése (a spec első commitjában átírva):

> **Hatókör: kizárólag a `MiniMax-M3.1-Flash`** (user döntés 2026-10-27, a `MiniMax-M3` helyére). Más
> MiniMax modellt tilos említeni dokumentumban, kódban, kommentben és a usernek szóló jelentésben.
> Kivétel: a `MiniMax-M3` a lecserélt modellként a SPEC-013-ban és a research fájljában, valamint
> történeti tényként a 2026-10-27 előtti research, spec és terv dokumentumokban, a commitolt v1
> pillanatkép fixtúrában és a `tools/wire-probe` mérési eseteiben (SPEC-013 3.6, O-2) állhat.

A 9. szekció első bekezdésében a `minimax` provider leírása nem nevez modellt, nem változik.

---

## 8. Tesztelés

- `packages/provider-minimax`: egy új `descriptor/descriptor.spec.ts` a 3.2 táblázatot állítja mezőnként
  a valódi leírón (`known` érték és bizonyíték, illetve `unknown` és `blockedBy`); a `provider-registry`
  meglévő tesztje (bizonyíték kényszer, feloldható mérési azonosító, mérési azonosító nélküli `reason`)
  változatlanul fut.
- `packages/engine` `resolve-required-environment-value.spec.ts`: csak `name`; csak alternatíva; mindkettő
  (a `name` nyer); egyik sem (`missing_provider_env`, minden név, érték nélkül). A
  `build-outgoing-environment.spec.ts`: `ANTHROPIC_API_KEY` bemenetből a kimenetben csak
  `ANTHROPIC_AUTH_TOKEN` áll, az `ANTHROPIC_API_KEY` nem. A thinking: 5.3.
- `apps/server`: drift védelem (4.5), titok gyűjtés (4.6), `provider-outgoing-environment.spec.ts`, a
  provider lista végpont névcsoportjai (4.8), a motor igazolása a valódi `minimax` leíróval
  (`thinking: 'disabled'` -> `thinking_mode_unsupported`; modell nélküli lépés -> `MiniMax-M3.1-Flash[1m]`,
  `includePartialMessages: false`).
- `packages/protocol`: a `ProviderSummarySchema` névcsoportja (üres csoport elutasítva).
- `apps/web`: a létrehozó ablak " vagy " kötőszavas kijelzése.
- `apps/server/measurement`: 6.
- `tools/wire-probe`: a kulcs olvasás mindkét névre (greppes regressziós teszt).
- A valódi próba nem kapu (SPEC-012 5.3).

---

## 9. Kockázatok

| Kockázat                                                                                                                                          | Kezelés                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A pinelt CLI a Flash-nél `thinking: disabled`-et küld, és a `2013`-as `400` jön                                                                   | research 6.: az alapút `adaptive` vagy elhagyott mező; a valódi `minimax` próba igazolja; hiba esetén új nyitott pont                                                                                                                                    |
| A pinelt CLI a `[1m]` utótagot nem vágja le, és a MiniMax ismeretlen modellt jelez                                                                | a valódi próba igazolja; hiba esetén a `clientModelIdentifier` `unknown`-ra áll (a motor a wire azonosítót küldi)                                                                                                                                        |
| Egy `ANTHROPIC_API_KEY` néven tárolt, valójában Anthropic kulcs a MiniMaxhoz megy Bearer tokenként, ha `ANTHROPIC_AUTH_TOKEN` nincs               | ez a user döntés 2. közvetlen következménye (a SPEC-012 O-4 óvatossági tiltás bemeneti oldalon feloldva); a `README.md` kimondja                                                                                                                         |
| A `streaming.sse` `unknown`, az élő nézet a `minimax` lépésnél delta nélkül fut                                                                   | O-7, nyitott pont                                                                                                                                                                                                                                        |
| A `serverTools` `unknown`, a `WebSearch` nem tiltott a `minimax` lépésnél                                                                         | a mérés megismétléséig a motor konzervatív visszaesése (SPEC-004 11.2)                                                                                                                                                                                   |
| A `claude-subscription` leíró `effort.accepted` mezője provider szintű `known` `true`, a `claude-haiku-4-5` viszont nem támogatja (research 10.2) | ebben a specben csak a próba nem küld effortot (6.); egy `claude-haiku-4-5` lépés effort beállítása a motoron átmegy, és hogy a pinelt CLI ilyenkor elhagyja-e, nem mért. **Javaslat, nem döntés:** modell szintű effort tény a leíróban, külön specben. |

---

## 10. Elfogadási kritériumok

### Modell csere

1. A `packages/`, `apps/` és `tooling/` termék- és tesztkódjában a `MiniMax-M3` szöveg csak a
   `MiniMax-M3.1-Flash` részeként fordul elő, a 3.6 kivételeivel (`git grep` ellenőrzés a PR
   leírásában).
2. A `minimax` leíró pontosan egy modellt ír le, `id: 'MiniMax-M3.1-Flash'`, `family: 'M3.1-Flash'`.
3. A leíró minden mezője a 3.2 táblázat szerinti állapotú; minden `known` mező bizonyítéka a research 2.
   szekciójának forrása vagy modelltől független Claude Code dokumentum, M3 mérés azonosító nélkül.
4. Egy `thinking: 'disabled'` Flash lépés a futás indításakor `thinking_mode_unsupported` hibát ad
   (unit teszt a meglévő úton).
5. Egy modell nélküli `minimax` lépés a Flash-t kapja, a kimenő `Options.model` `MiniMax-M3.1-Flash[1m]`.

### Két kulcsnév

6. Csak `ANTHROPIC_API_KEY` mellett a `minimax` lépés kimenő környezetében az `ANTHROPIC_AUTH_TOKEN` a
   kulcs értéke, az `ANTHROPIC_API_KEY` nem szerepel.
7. Mindkét név mellett az `ANTHROPIC_AUTH_TOKEN` értéke megy ki.
8. Egyik sem: `missing_provider_env`, az üzenet mindkét nevet tartalmazza, értéket nem.
9. A `claude-subscription` lépés kimenő környezetében egyik név sem szerepel (változatlan).
10. Mindkét név értéke maszkolva van a naplóban (`collectSecretEnvironmentValues` teszt).
11. A drift védelem bukik, ha a `claude-subscription` tiltott listájáról bármelyik név kikerül.
12. A létrehozó ablak a `minimax` providernél "ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY" szöveget mutat
    (4.8).

### Thinking átadás

13. Egy `adaptive` és egy `disabled` beállítású lépés kimenő `Options.thinking` mezője
    `{ type: 'adaptive' }`, illetve `{ type: 'disabled' }`, és a típus hozzárendelhető az SDK
    `Options['thinking']` típusához (5.3).

### Próba

14. A próba `minimax` lépése `MiniMax-M3.1-Flash`, `effort: 'low'`; a `claude-subscription` lépése
    alapból `claude-haiku-4-5`, `effort` nélkül.

### Dokumentáció és kapuk

15. A szabálykönyv 9. szekciója a 7. szerinti.
16. A research fájl, a `README.md`, a két `.env.example` és az érintett `CLAUDE.md` fájlok frissek.
17. A kilenc kapu és a szabálykönyv 8. szekciója szerinti merge kapu zöld.

### Valódi próba (nyitva, a merge után, külön lépés)

18. A `minimax` próba `succeeded` állapotú futást ad a Flash-sel; az eredmény a research új szekciójában. **Lezárva (2026-10-27):** `succeeded`, research 13. szekció; a dróton kiment azonosító, a thinking és az effort alakja, a token és a költség nem mért.
19. A `claude-subscription` próba `succeeded` állapotú futást ad a `claude-haiku-4-5`-tel; az eredmény a
    research új szekciójában.

---

## 11. Nyitott kérdések és a user döntései (2026-10-27)

| Azonosító | Kérdés                                                                                                                  | Döntés                                                                                                                                                                                                       | Állapot                                                                                                                                                                                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-1       | A `claude-haiku-5-5` a pinelt SDK-val nem fut. Hol legyen az SDK frissítés?                                             | Nincs SDK frissítés és nincs `claude-haiku-5-5`: a Claude próba a katalógusban álló `claude-haiku-4-5`-tel fut (user: "miert kell a haiku"; 1. szekció 3. döntés).                                           | Lezárva                                                                                                                                                                                                                                                                       |
| O-2       | A `tools/wire-probe` mérési esetei M3-at mérnek. Átálljanak-e most a Flash-re?                                          | (a) Maradnak, történeti mérő eszköz; egy jövőbeli SDK frissítés regressziós mérésénél állnak át.                                                                                                             | Lezárva                                                                                                                                                                                                                                                                       |
| O-3       | A tárolt workflow-kban `modelId: 'MiniMax-M3'` állhat.                                                                  | Nincs migráció, mert nincs még adatbázis (user, korábban: "nincs meg adatbazis!!!! nincs mit migralni!!").                                                                                                   | Lezárva                                                                                                                                                                                                                                                                       |
| O-4       | A workflow létrehozó ablak kijelzése.                                                                                   | (a) Mindkét kulcsnév kiírva, a szükséges protokoll bővítéssel (4.8).                                                                                                                                         | Lezárva                                                                                                                                                                                                                                                                       |
| O-5       | A motor a lépés `thinking` beállítását szövegként adja az SDK-nak, ami objektumot vár.                                  | Ebben a körben javítandó, regressziós teszttel (bug, gyökér `CLAUDE.md` 7.); a helyes alak a telepített `sdk.d.ts` és `sdk.mjs` szerint (5.).                                                                | Lezárva                                                                                                                                                                                                                                                                       |
| O-6       | Kapjon-e a próba lépése effortot?                                                                                       | Igen, `effort: 'low'`, ahol a forrás és a leíró alátámasztja: a `minimax` lépésnél igen; a `claude-haiku-4-5` az effortot nem támogatja (research 10.2), ezért a `claude-subscription` lépésnél `null` (6.). | Lezárva                                                                                                                                                                                                                                                                       |
| O-7       | A `minimax` leíró `streaming.sse` mezője `unknown`, tehát az élő nézet a `minimax` lépésnél delta események nélkül fut. | Elfogadva addig, amíg egy későbbi mérés le nem zárja.                                                                                                                                                        | **Nyitva.** Mi a viselkedés addig: a `minimax` lépés `includePartialMessages: false` mellett fut, az élő nézet a teljes üzeneteket mutatja, delta nélkül. Mi zárná le: az M-05 és M-09 megismétlése a Flash-sel (valódi hívás), és a mérés szerinti `known` érték a leíróban. |

---

## 12. Kapcsolódó dokumentumok

- [`../research/2026-10-27-flash-es-haiku.md`](../research/2026-10-27-flash-es-haiku.md)
- [`../plan/PLAN-014-flash-es-haiku.md`](../plan/PLAN-014-flash-es-haiku.md)
- [`SPEC-012-helyi-inditas-es-valodi-proba.md`](SPEC-012-helyi-inditas-es-valodi-proba.md)
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md)
- `.claude/CLAUDE.md` 9. szekció
