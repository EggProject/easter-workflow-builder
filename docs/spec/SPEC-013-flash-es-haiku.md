# SPEC-013: MiniMax-M3.1-Flash csere, két kulcsnév, claude-haiku-5-5

|          |                                                                                                                                                                                                                                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet, a user döntéseire vár (11. szekció, O-1 ... O-7). A 2026-10-27-i négy user döntés (1. szekció) kötött, nem nyitott.                                                                                                                                                                                                                                           |
| Dátum    | 2026-10-27                                                                                                                                                                                                                                                                                                                                                              |
| Előzmény | [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md) (a leírók, a `Fact` bizonyíték kényszer), [`SPEC-004-vegrehajto-motor.md`](SPEC-004-vegrehajto-motor.md) (11.3: a motor viselkedése `unknown` mezővel), [`SPEC-012-helyi-inditas-es-valodi-proba.md`](SPEC-012-helyi-inditas-es-valodi-proba.md) (3.2 tiltott listák, 5. valódi próba) |
| Bemenet  | [`../research/2026-10-27-flash-es-haiku.md`](../research/2026-10-27-flash-es-haiku.md)                                                                                                                                                                                                                                                                                  |
| Kimenet  | a `minimax` leíró a `MiniMax-M3.1-Flash` modellre áll, a MiniMax kulcs két néven is érkezhet, a `claude-subscription` katalógusban megjelenik a `claude-haiku-5-5`, a valódi próba az új modellekkel indítható                                                                                                                                                          |
| Terv     | [`../plan/PLAN-014-flash-es-haiku.md`](../plan/PLAN-014-flash-es-haiku.md). **A számozás eltér:** a PLAN-012 a SPEC-009-é (a `feat/spec-009-beallitasok` branchen, még nincs a `main`-en), a PLAN-013 a SPEC-012-é, ezért a SPEC-013 terve a PLAN-014.                                                                                                                  |

---

## 1. Cél és hatókör

**A user döntései (2026-10-27), szó szerint ezek:**

1. "megváltozott a model név": a MiniMax modell a `MiniMax-M3.1-Flash`, ez lép a `MiniMax-M3`
   **helyére** (csere, nem mellé). A szabálykönyv 9. szekciójának hatókör szabálya ennek megfelelően
   átíródik.
2. A MiniMax kulcs a `.env` fájlban `ANTHROPIC_API_KEY` és `ANTHROPIC_AUTH_TOKEN` néven is működjön
   ("Mindkettő működjön").
3. A Claude (`claude-subscription`) próbához a legolcsóbb modell kell: `claude-haiku-5-5`, a Claude
   katalógusba felvéve.
4. Utána valódi próba fut mindkét providerrel (`bun run probe:real-provider`), alacsony tokennel. A user
   az engedélyt megadta.

### Amit eldönt

1. A `minimax` leíró modell katalógusa, és mezőnként, hogy mi marad `known` és mi lesz `unknown` (3.).
2. A Flash "mindig gondolkodik" tényének kezelése a leíróban és a motorban (3.3).
3. A két kulcsnév bemeneti szabálya, a kimenő SDK környezet, a "mindkettő beállítva" eset, a tiltott
   listák és a titok maszkolás (4.).
4. A `claude-haiku-5-5` katalógus bejegyzése és a pinelt SDK verzió akadálya (5.).
5. A valódi próba alapértékei az új modellekkel (6.).
6. Mi áll át a Flash-re és mi marad történeti tény (3.6, 7.).

### Amit NEM dönt el (nem cél)

- Az Agent SDK verzió frissítése. Az 5.2 szerint a `claude-haiku-5-5` futásához kell; hogy ebben a
  specben vagy külön történik, user döntés (O-1).
- A SPEC-000 mérések megismétlése a Flash ellen (valódi hívás; O-1, O-7).
- A motor `thinking` átadásának hibája (research 6. szekció 2. pont); külön döntés (O-5).
- Más MiniMax modell. A `MiniMax-M3` ebben a specben kizárólag mint a lecserélt modell szerepel.

---

## 2. Megerősített tények, forrással

Minden tény a research fájlban áll, elsődleges forrással és megerősítéssel. A döntésekhez szükséges
kivonat:

| Tény                                                                                                                                                                | Research szekció |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| A Flash API azonosítója `MiniMax-M3.1-Flash`, a Claude Code kliens azonosítója `MiniMax-M3.1-Flash[1m]`                                                             | 2.               |
| A Flash mindig gondolkodik: `thinking` elhagyva vagy `adaptive` mellett be, `disabled` mellett `400` (`2013`)                                                       | 2.               |
| A Flash `output_config.effort` értéke `low` ... `max`, elhagyva `max`                                                                                               | 2.               |
| A `claude-haiku-5-5` legalább a Claude Code `2.1.293`-as verzióját igényli; régebbi kliens kérését a szerver `400` `claude_code_version_too_old` hibával elutasítja | 3., 4.           |
| A pinelt `@anthropic-ai/claude-agent-sdk@0.3.245` a Claude Code `2.1.245`-öt csomagolja; a legalább `2.1.293`-at csomagoló első SDK a `0.3.293`                     | 4.               |
| Hitelesítési sorrend: `ANTHROPIC_AUTH_TOKEN` (2.) a `ANTHROPIC_API_KEY` (3.) előtt; az előbbi `Authorization: Bearer`, az utóbbi `X-Api-Key` fejléc                 | 5.               |
| Az SDK a `thinking` opciót objektumként olvassa (`thinking.type`)                                                                                                   | 6.               |
| Egy egyszerű `agent_step` lépést egyetlen `unknown` leíró mező sem buktat                                                                                           | 7.               |

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
research 2. szekciójának egy Flash-re vonatkozó forrása, vagy egy modelltől független Claude Code
dokumentum **magát az értéket** állítja. Minden más mező `unknown`, a `reason` mezőben "az M3-ra mérve,
a Flash-re nem mérve (SPEC-013 3.2)", a `blockedBy` mezőben az eredeti M-xx azonosítókkal (ezek a
megismétlendő mérések).

| Mező                                                           | Új állapot                                                                           | Bizonyíték vagy blokkoló                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `models[0].clientModelIdentifier`                              | `known` `'MiniMax-M3.1-Flash[1m]'`                                                   | MiniMax m-plan és token-plan Claude Code lap                  |
| `models[0].contextWindow`                                      | `known` `1_000_000`                                                                  | text-anthropic-api, text-generation guide                     |
| `models[0].maxOutputTokensRecommended` / `maxOutputTokensHard` | `known` `131_072` / `524_288`                                                        | text-chat-openai (`max_completion_tokens`)                    |
| `models[0].effectiveContextWindowOnWire`                       | `unknown`                                                                            | M-20                                                          |
| `models[0].maxOutputTokensWireCeiling`                         | `unknown`                                                                            | M-22                                                          |
| `models[0].imageInput`                                         | `unknown` (a doksi és az M3 mérés ütközik, research 2.)                              | M-23, M-16                                                    |
| `models[0].videoInput`                                         | `unknown`, változatlan indokkal                                                      | M-16, M-23                                                    |
| `models[0].listedByModelsEndpoint`                             | `unknown`                                                                            | M-35                                                          |
| `thinking.byModelFamily['M3.1-Flash']`                         | `known` `['adaptive']` (3.3)                                                         | text-anthropic-api, text-openai-api, m-plan Claude Code lap   |
| `thinking.interleavedSignatureRequired`                        | `known` `true`                                                                       | text-anthropic-api ("preserve them unchanged in later turns") |
| `thinking.wireShape`, `sendsBudgetTokens`, `streamEventTypes`  | `unknown`                                                                            | M-01, M-05, M-06                                              |
| `effort.accepted`                                              | `known` `true`                                                                       | text-anthropic-api, text-generation guide                     |
| `effort.wireField`                                             | `known` `'output_config.effort'`                                                     | text-anthropic-api, text-generation guide                     |
| `structuredOutput` minden `known` mezője                       | `unknown`                                                                            | M-01, M-02, M-03, M-04, M-19, M-26                            |
| `toolChoice` mindhárom mezője                                  | `unknown` (a doksi ellentmondásos, research 2.)                                      | M-03, M-17, M-34                                              |
| `promptCaching` minden `known` mezője                          | `unknown` (a `RESEARCH_MINIMAX` a M3 kori doksi kivonata)                            | M-08, M-15, M-24, M-33                                        |
| `streaming` mezői, a `fineGrainedToolStreaming` kivételével    | `unknown`                                                                            | M-05, M-09, M-24                                              |
| `streaming.fineGrainedToolStreaming`                           | `known` `false`, csak a `RESEARCH_GATEWAY` bizonyítékkal                             | Claude Code gateway dokumentáció (modelltől független)        |
| `serverTools`                                                  | `unknown`                                                                            | M-17, M-25                                                    |
| `modelsEndpoint.directHttpReachable`, `listedModelCount`       | `unknown`                                                                            | M-35                                                          |
| `modelsEndpoint.calledBySdk`                                   | `unknown` (a kapcsolat teszt módja ettől nem változik: `minimal_query`, research 7.) | M-12, M-36                                                    |
| `rateLimits.buckets[0]`                                        | `appliesTo: ['MiniMax-M3.1-Flash']`, `known` 200 / 10 000 000                        | rate-limits lap                                               |
| `rateLimits.retryAfterHeader`, `rateLimitHeaders`              | `unknown`, változatlan                                                               | M-18, M-36                                                    |
| `concurrency.subagentCapEnvVar`                                | `known`, csak a `DOC_ENV_VARS` bizonyítékkal                                         | Claude Code env-vars                                          |
| `concurrency` többi mezője                                     | `unknown`                                                                            | M-31, M-39                                                    |
| `anthropicBetaHeaders`                                         | `unknown`                                                                            | M-01, M-11, M-14, M-32                                        |
| `requiredEnv`, `disallowedEnv`                                 | a 4. szekció szerint                                                                 | 4.                                                            |

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
  `disabled` `400`).

### 3.4 A motor

Kódváltozás a motorban nem kell. A research 7. szekciója szerint a próba lépését egyetlen `unknown`
mező sem buktatja. A következmények (ezek a `step_started` payload meglévő jelölései):

- `modelIdentifierUnproven: false`, mert a `clientModelIdentifier` `known`;
- `includePartialMessages: false`, mert a `streaming.sse` `unknown`: a `minimax` lépés élő nézete delta
  események nélkül fut, amíg a mérés meg nem ismétlődik (O-7);
- `serverToolAvailabilityUnproven: true`, és a `WebSearch` nem kerül a `disallowedTools` listára.

### 3.5 Hol változik a kód, a teszt és a fixtúra

| Hely                                                                                                                                                                                                                                                                                                                                              | Változás                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/provider-minimax/src/model-catalog/*`                                                                                                                                                                                                                                                                                                   | 3.1                                                                                                                             |
| `packages/provider-minimax/src/request-shaping/*`, `limits/*`, `tool-support/*`, `descriptor/descriptor.ts`                                                                                                                                                                                                                                       | 3.2                                                                                                                             |
| `packages/provider-minimax/src/environment/*`                                                                                                                                                                                                                                                                                                     | 4.                                                                                                                              |
| `packages/provider-capability/src/evidence-sources/measurement-document/*`                                                                                                                                                                                                                                                                        | új `DOC_*` és `RESEARCH_*` konstansok                                                                                           |
| `apps/server/measurement/build-probe-graph.ts` és `.spec.ts`, `run-probe.spec.ts`                                                                                                                                                                                                                                                                 | 6.                                                                                                                              |
| `apps/web/src/run-event-row/RunEventRow.tsx` és `.spec.tsx`                                                                                                                                                                                                                                                                                       | a költség magyarázat mondatában a modell neve `MiniMax-M3.1-Flash` (research 8.: a pinelt CLI ártáblájában a Flash sincs benne) |
| `apps/web/src/workflow-list/create-workflow-modal.spec.tsx`, `packages/protocol/src/provider/provider-summary.spec.ts`, `packages/engine/src/node-executor/execute-error-handler.spec.ts`, `packages/db/src/workflow-graph/agent-step-config/is-agent-step-config.spec.ts`, `packages/db/src/run-event/sdk-message/normalize-sdk-message.spec.ts` | a teszt adatban a modell azonosító `MiniMax-M3.1-Flash`                                                                         |
| `packages/provider-minimax/CLAUDE.md`, `apps/server` és `apps/web` `CLAUDE.md`                                                                                                                                                                                                                                                                    | ahol a modell neve áll, a Flash                                                                                                 |

### 3.6 Ami történeti tény marad (nem íródik át)

- A `docs/research/` minden 2026-10-27 előtti fájlja, a SPEC-000 és a PLAN-000, valamint a régebbi
  specek és tervek mérési tényei (például SPEC-004 F-11, SPEC-011 M-16/M-23 sorok): ezek az M3-ra
  mért, keltezett tények.
- `packages/db/src/graph-snapshot/snapshot-hash/graph-snapshot-document-v1-fixture.json`: a commitolt v1
  pillanatkép fixtúra, aminek a lenyomata szó szerint áll a tesztben, és a teszt fejléce szerint "a
  literált nem szabad felülírni"; a pillanatkép megváltoztathatatlan (szabálykönyv 10. 2. pont). A
  benne álló `MiniMax-M3` egy régi, tárolt gráf adata.
- `tools/wire-probe/src/cases/*` és `harness/runner.ts`: a SPEC-000 M3 méréseinek reprodukciója. A
  sorsuk O-2.
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

Az üres érték (`ANTHROPIC_AUTH_TOKEN=` a `.env`-ben) a mai szabály szerint beállított érték, nem
hiányzó: a `ProcessEnvironmentPort.read` csak a nem létező változóra ad `null`-t. Ez nem változik; a
`.env.example` meglévő figyelmeztetése mindkét névre kiterjed.

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

### 4.7 Env minta, README, Turborepo

- `.env.example`: a kikommentelt sor mellé a második név is, egy mondattal (bármelyik név elég; ha
  mindkettő áll, az `ANTHROPIC_AUTH_TOKEN` nyer).
- `README.md`: a `minimax` sor mindkét nevet megnevezi.
- `turbo.json` `globalPassThroughEnv`: az `ANTHROPIC_API_KEY` felvétele, hogy a `turbo` alatt futó
  `dev` task is megkapja.
- A felület (`create-workflow-modal`) kijelzése: O-4.

---

## 5. claude-haiku-5-5

### 5.1 Katalógus bejegyzés

- `ClaudeModelId` bővül a `'claude-haiku-5-5'` elemmel, család `'haiku'`. A `claude-haiku-4-5`
  marad (a user felvételt kért, nem cserét).
- Mezők (research 3.): `clientModelIdentifier` `known` `'claude-haiku-5-5'`; `contextWindow` `known`
  `1_000_000`; `maxOutputTokensHard` `known` `128_000`; `imageInput` `known` `true`; `videoInput`
  `known` `false`; `listedByModelsEndpoint` `known` `true`. A három közös `unknown` konstans
  (`maxOutputTokensRecommended`, `maxOutputTokensWireCeiling`, `effectiveContextWindowOnWire`) ide is
  vonatkozik.
- Új konstans: `DOC_HAIKU_5_5` (a Haiku 5.5 áttekintő lap URL-je).
- A `haiku` család thinking módjai (`['disabled', 'adaptive']`) maradnak; a Haiku 5.5 forrása ezt
  megerősíti (research 3.: adaptív, `disabled` `high` effort vagy alatta).

### 5.2 A pinelt SDK akadálya

A pinelt SDK (`0.3.245`) a Claude Code `2.1.245`-öt csomagolja, a `claude-haiku-5-5` legalább
`2.1.293`-at kér, és a szerver a régebbi kliens kérését `400` `claude_code_version_too_old` hibával
utasítja el (research 4.). **A katalógus bejegyzés ettől még felvehető**, de egy `claude-haiku-5-5`
lépés a pinelt SDK-val nem fut le.

- **Mi a viselkedés addig:** a modell választható; a lépés a szerver `400` válaszával, az SDK `result`
  hibájaként bukik, a meglévő hibaúton. A valódi Claude próba ezzel a modellel addig nem futtatható.
- **Mi zárná le:** SDK frissítés legalább a `0.3.293`-ra, a szabálykönyv 9. szekciója szerinti SPEC-000
  regressziós mérésekkel (valódi MiniMax hívás). Hogy ez hol és mikor, O-1.

---

## 6. A valódi próba

| Beállítás                                                                   | `minimax`                                                                    | `claude-subscription`                                                                                         |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| modell                                                                      | `MiniMax-M3.1-Flash` (a `build-probe-graph.ts` `MINIMAX_MODEL_ID` konstansa) | `claude-haiku-5-5`, a `build-probe-graph.ts` alapértéke (user döntés 3.); a `modelId` argumentum felülírhatja |
| `maxTurns`, prompt, költségkeret, időkorlát, eszköz tiltás, kapcsolat teszt | a SPEC-012 5.1 szerint, változatlanul                                        | ugyanaz                                                                                                       |
| `effort`                                                                    | O-6                                                                          | O-6                                                                                                           |
| `thinking`                                                                  | `null` (3.3)                                                                 | `null`                                                                                                        |

- A `run-probe.spec.ts` "modell nélkül `model_not_selected`" tesztje törlődik: a `claude-subscription`
  próbának ezután van alapmodellje, tehát ez az ág a próba úton nem áll elő. A `model_not_selected`
  motor oldali ágát a `require-model-selection.spec.ts` változatlanul fedi. Helyette a hamis ágens
  kérésében a modell `claude-haiku-5-5` (alapérték) és a `modelId` argumentum felülírása is teszt.
- A `minimax` próba elvárt kérésében a modell `MiniMax-M3.1-Flash[1m]`.
- Engedély: a user a 2026-10-27-i döntésében (4.) megadta; a végrehajtó agent a futás előtt a SPEC-012
  5.3 szerinti felsorolással egyszer még megerősíti, mert a beállítások (modell, `effort`) e spec óta
  mások.
- A futás sorrendje: a `minimax` próba ennek a specnek a merge-e után futhat; a `claude-subscription`
  próba a `claude-haiku-5-5`-tel csak az 5.2 lezárása után (O-1).
- Az eredmény a research fájl új szekciójába kerül.

---

## 7. A szabálykönyv változása

A `.claude/CLAUDE.md` 9. szekciójának hatókör bekezdése (ebben a commitban átírva):

> **Hatókör: kizárólag a `MiniMax-M3.1-Flash`** (user döntés 2026-10-27, a `MiniMax-M3` helyére). Más
> MiniMax modellt tilos említeni dokumentumban, kódban, kommentben és a usernek szóló jelentésben.
> Kivétel: a `MiniMax-M3` a lecserélt modellként a SPEC-013-ban és a research fájljában, valamint
> történeti tényként a 2026-10-27 előtti research, spec és terv dokumentumokban, a commitolt v1
> pillanatkép fixtúrában és a `tools/wire-probe` mérési eseteiben (SPEC-013 3.6) állhat.

A 9. szekció első bekezdésében a `minimax` provider leírása nem nevez modellt, nem változik.

---

## 8. Tesztelés

- `packages/provider-minimax`: a meglévő leíró tesztek a 3.2 táblázatát állítják mezőnként
  (`known` érték és bizonyíték, illetve `unknown` és `blockedBy`).
- `packages/provider-capability`: az új `source` ág típusőre (ha a csomag guardot exportál rá), mindkét
  ágra.
- `packages/engine` `resolve-required-environment-value.spec.ts`: csak `name`; csak alternatíva; mindkettő
  (a `name` nyer); egyik sem (`missing_provider_env`, minden név, érték nélkül). A
  `build-outgoing-environment.spec.ts`: `ANTHROPIC_API_KEY` bemenetből a kimenetben csak
  `ANTHROPIC_AUTH_TOKEN` áll, az `ANTHROPIC_API_KEY` nem.
- `apps/server`: drift védelem (4.5), titok gyűjtés (4.6), `provider-outgoing-environment.spec.ts`.
- `packages/provider-claude-subscription`: a `claude-haiku-5-5` bejegyzés mezői.
- `apps/server/measurement`: 6.
- A valódi próba nem kapu (SPEC-012 5.3).

---

## 9. Kockázatok

| Kockázat                                                                                                                            | Kezelés                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A pinelt CLI a Flash-nél `thinking: disabled`-et küld, és a `2013`-as `400` jön                                                     | research 6.: az alapút `adaptive` vagy elhagyott mező; a valódi `minimax` próba igazolja; hiba esetén új nyitott pont            |
| A pinelt CLI a `[1m]` utótagot nem vágja le, és a MiniMax ismeretlen modellt jelez                                                  | a valódi próba igazolja; hiba esetén a `clientModelIdentifier` `unknown`-ra áll (a motor a wire azonosítót küldi)                |
| Egy `ANTHROPIC_API_KEY` néven tárolt, valójában Anthropic kulcs a MiniMaxhoz megy Bearer tokenként, ha `ANTHROPIC_AUTH_TOKEN` nincs | ez a user döntés 2. közvetlen következménye (a SPEC-012 O-4 óvatossági tiltás bemeneti oldalon feloldva); a `README.md` kimondja |
| A `streaming.sse` `unknown`, az élő nézet a `minimax` lépésnél delta nélkül fut                                                     | O-7                                                                                                                              |
| A `serverTools` `unknown`, a `WebSearch` nem tiltott a `minimax` lépésnél                                                           | a mérés megismétléséig a motor konzervatív visszaesése (SPEC-004 11.2)                                                           |
| A user tárolt workflow-iban `MiniMax-M3` modell áll                                                                                 | O-3                                                                                                                              |

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

### claude-haiku-5-5

12. A `claude-subscription` leíró listájában a `claude-haiku-5-5` szerepel az 5.1 mezőivel.
13. A próba `claude-subscription` alapmodellje `claude-haiku-5-5`.

### Dokumentáció és kapuk

14. A szabálykönyv 9. szekciója a 7. szerinti.
15. A research fájl, a `README.md`, a `.env.example` és az érintett `CLAUDE.md` fájlok frissek.
16. A kilenc kapu és a szabálykönyv 8. szekciója szerinti merge kapu zöld.

### Valódi próba (nyitva, a merge után)

17. A `minimax` próba `succeeded` állapotú futást ad a Flash-sel; az eredmény a research új szekciójában.
18. A `claude-subscription` próba `claude-haiku-5-5`-tel: az 5.2 lezárása után (O-1).

---

## 11. Nyitott kérdések (a user dönt)

Minden pontnál: mi a viselkedés addig, és mi zárná le.

| Azonosító | Kérdés                                                                                                                                                              | Opciók (az ajánlott elsőként)                                                                                                                                                                                                                                                                                                                                                   | Mi a viselkedés addig                                 | Mi zárná le                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------- |
| O-1       | A `claude-haiku-5-5` a pinelt SDK-val nem fut (5.2). Hol legyen az SDK frissítés?                                                                                   | (a) Külön spec: SDK legalább `0.3.293`, a SPEC-000 regressziós mérésekkel a Flash ellen; a Claude próba utána. Ez a spec csak a katalógust veszi fel. (b) Ebben a specben, a regressziós mérésekkel együtt (több valódi MiniMax hívás, nagyobb PR). (c) A Claude próba most `claude-haiku-4-5`-tel fut (a pinelt CLI ismeri), a `claude-haiku-5-5` próba az SDK frissítés után. | a katalógus bejegyzés felvéve, a Claude próba nem fut | a user választása               |
| O-2       | A `tools/wire-probe` mérési esetei M3-at mérnek. Átálljanak-e most a Flash-re?                                                                                      | (a) Maradnak (az M3 mérések reprodukciója, történeti); a Flash-re az SDK frissítés regressziós méréseinél állnak át. (b) Most állnak át, futtatás nélkül.                                                                                                                                                                                                                       | maradnak, a szabálykönyv kivétele megnevezi őket (7.) | a user választása               |
| O-3       | A user meglévő workflow-iban `modelId: 'MiniMax-M3'` állhat.                                                                                                        | (a) Nincs adat migráció: a futás `unknown_model_id` hibával indul el; a szerkesztőben a modellt újra kell választani. (b) Egyszeri, kézzel írt (`--custom`) Drizzle migráció, ami a szerkeszthető gráf csomópontjaiban a `MiniMax-M3` értéket `MiniMax-M3.1-Flash`-re írja; a pillanatképek érintetlenek.                                                                       | (a)                                                   | a user választása               |
| O-4       | A workflow létrehozó ablak ma "Szükséges környezeti változók: ANTHROPIC_AUTH_TOKEN" szöveget mutat.                                                                 | (a) "ANTHROPIC_AUTH_TOKEN vagy ANTHROPIC_API_KEY": a `ProviderSummary` protokoll séma az alternatív neveket is hordozza. (b) Marad a mai szöveg, a `README.md` és a `.env.example` mondja ki a második nevet.                                                                                                                                                                   | (b)                                                   | a user választása               |
| O-5       | A motor a lépés `thinking` beállítását szövegként adja az SDK-nak, ami azt nem olvassa (research 6. 2. pont): a beállítás ma egyik providernél sem jut el a CLI-ig. | (a) Külön hibajavítás (saját spec vagy PR, regressziós teszttel), ennek a specnek a merge-e után. (b) Ebben a specben.                                                                                                                                                                                                                                                          | a beállítás elmarad, a CLI alapértéke fut             | a user választása               |
| O-6       | A próba "alacsony tokennel" fusson. Kapjon-e a próba lépése effortot?                                                                                               | (a) `effort: 'low'` mindkét providernél: a forrás szerint a kisebb effort kevesebb thinking tokent ad (research 2., 3.), és mindkét leíró `effort.accepted` mezője `known` `true`. (Az O-5 hibája az effortot nem érinti: az `effort` szövegként helyes SDK opció.) (b) Marad `null` (SPEC-012 5.1): a CLI alapértéke fut, a Flash-nél a MiniMax lap szerint `high`, nem mérve. | (b)                                                   | a user választása               |
| O-7       | A `minimax` leíró `streaming.sse` mezője `unknown`, tehát az élő nézet a `minimax` lépésnél delta események nélkül fut.                                             | (a) Elfogadva az SDK frissítő spec regressziós méréseiig (O-1 (a)). (b) Egy célzott mérés most (az M-05 és M-09 megismétlése a Flash-sel, valódi hívás).                                                                                                                                                                                                                        | (a)                                                   | a user választása, majd a mérés |

---

## 12. Kapcsolódó dokumentumok

- [`../research/2026-10-27-flash-es-haiku.md`](../research/2026-10-27-flash-es-haiku.md)
- [`../plan/PLAN-014-flash-es-haiku.md`](../plan/PLAN-014-flash-es-haiku.md)
- [`SPEC-012-helyi-inditas-es-valodi-proba.md`](SPEC-012-helyi-inditas-es-valodi-proba.md)
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md)
- `.claude/CLAUDE.md` 9. szekció
