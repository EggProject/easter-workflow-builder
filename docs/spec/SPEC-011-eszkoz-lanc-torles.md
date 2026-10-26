# SPEC-011: Az in-process eszköz lánc törlése

|          |                                                                                                                                                                                                                                                                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | jóváhagyott, végrehajtásra kész (a user döntései 2026-10-26, 12. szekció); az O-17 is lezárva (12.2)                                                                                                                                                                                                                                                              |
| Dátum    | 2026-10-26                                                                                                                                                                                                                                                                                                                                                        |
| Előzmény | [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md) (a hét csomag létrehozása), [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md) (4.4), [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md) (7.7), [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) (5., a beállítás panel) |
| Bemenet  | [`../research/2026-10-26-eszkoz-lanc-torles.md`](../research/2026-10-26-eszkoz-lanc-torles.md) (a `db` guard tűrésének mérése, a gyári eszközök forrásai, a teljes leltár)                                                                                                                                                                                        |
| Kimenet  | hét workspace csomag törlése, az `agentTools` fogalom és az `emit_output_tool` strukturált kimenet stratégia törlése, a `db` NodeConfig guard szigorítása, a dokumentáció átvezetése                                                                                                                                                                              |
| Terv     | [`../plan/PLAN-011-eszkoz-lanc-torles.md`](../plan/PLAN-011-eszkoz-lanc-torles.md)                                                                                                                                                                                                                                                                                |

---

## 1. Cél és hatókör

**A mai állapot.** A workspace hét csomagja egy saját folyamatban futó (in-process) MCP eszköz
láncot alkot: három eszköz (`web_search` a MiniMax `coding_plan` keresőjével, `understand_image` a
MiniMax képértelmezőjével, `web_fetch` a Firecrawllal), a két HTTP kliens, a közös MCP segéd és a
lépésenkénti köteg. A lánc a SPEC-000 mérése nyomán készült: a MiniMax a szerver oldali
`web_search` eszközt csendben eldobja (M-17, M-25), a kép content blokkot nem látja (M-16, M-23)
(`docs/research/2026-08-26-agent-tools.md` 1. szekció). A futó termék a láncból semmit nem
importál (2.1), a lépés `agentTools` mezője tárolódik, a szerkesztőben szerkeszthető, de a motor nem
köti be (`build-agent-step-options.ts:86-92`). A strukturált kimenet `emit_output_tool` stratégiája
ugyanerre a gondolatra épül: egy in-process `emit_output` eszközt és egy `Stop` hookot feltételez.

### A user döntése, amit ez a spec megvalósít

| #   | Döntés (user döntés 2026-10-26)                                                                                                                           | Hol valósul meg    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1   | "minimaxmcp -t ki lehet dobni (törölni kell a kódját és minden ráutalást a dokumentációkból is!)", pontosítva: "csak a gyári claude tool-ok maradnak"     | 3., 4., 6., 7., 8. |
| 2   | A MiniMax mint LLM provider (`provider-minimax`, `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`) **marad**                                         | 3.2                |
| 3   | Marad a `minimax` provider szerver oldali `web_search` letiltása (`serverTools`, `clientToolName: 'WebSearch'`) és a képesség leíró mérésen alapuló mezői | 3.2                |
| 4   | "nincs még adatbázis, nincs mit migrálni", "nincs régi rajz": nincs migráció, nincs olvasó oldali tűrés, nincs kompatibilitási kód                        | 5.1                |
| 5   | A `db` NodeConfig guard minden ismeretlen kulcsot elutasít                                                                                                | 5.2                |
| 6   | Az `emit_output_tool` strukturált kimenet stratégia törlődik minden ráutalásával                                                                          | 3.1, 4.1, 7.3, 8.  |
| 7   | Az `mcpServers` mező marad, a SPEC-009-ben lesz konfigurálva és bekötve                                                                                   | 3.2                |

### Amit eldönt

- Melyik hét csomag törlődik, és melyik fogalom tűnik el velük (3.1).
- Mi marad változatlanul (3.2).
- Hogy a tárolt adatra nincs tekintettel semmilyen kód, és a `db` guard szigorodik (5.).
- A törlés sorrendjét, úgy, hogy minden lépés után a kilenc kapu zöld legyen (8.).
- A gépi elfogadási kritériumokat (11.).

### Amit NEM dönt el

- Az `mcpServers` konfigurálását és bekötését (SPEC-009 hatóköre).

---

## 2. Megerősített tények, forrással

### 2.1 A futó termék nem importálja a láncot (a commitolt fa olvasása, `6009603`)

`git grep -l "@easter-workflow-builder/<csomag>"` a `bun.lock` nélkül, a csomag saját fáján kívül:
a hét csomagra a találatok kizárólag a hét csomag egymás közti hivatkozásai és dokumentumok
(research 3.2). Az `agent-tool-bundle` csomagot semmi nem importálja; a `packages/agent`
`package.json` függőségei között nincs (`packages/agent/package.json:11-17`), a `CLAUDE.md` csak
tervezett függőségként említi (`packages/agent/CLAUDE.md:40, 48`).

### 2.2 Az `agentTools` lánc a megmaradó csomagokban

| Réteg                      | Hely                                                                                                                        | Mi az                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| szótár                     | `packages/provider-capability/src/agent-tool-id/agent-tool-id.ts:8`                                                         | `AgentToolId = 'web_search' \| 'web_fetch' \| 'understand_image'`                   |
| ajánlás típus              | `packages/provider-capability/src/tool-support/agent-tool-recommendation.ts:8-11`                                           | `AgentToolRecommendation`                                                           |
| leíró mező                 | `packages/provider-capability/src/descriptor/provider-capability-descriptor.ts:2, 43`                                       | `recommendedAgentTools: Fact<readonly AgentToolRecommendation[]>`                   |
| barrel                     | `packages/provider-capability/src/index.ts:31-32, 47`                                                                       | a két típus exportja                                                                |
| `minimax` adat             | `packages/provider-minimax/src/tool-support/recommended-agent-tools.ts:7-60`, `descriptor/descriptor.ts:14, 62`             | `known` ajánlás, M-16, M-17, M-23, M-25 bizonyítékkal                               |
| `claude-subscription` adat | `packages/provider-claude-subscription/src/tool-support/recommended-agent-tools.ts:8-14`, `descriptor/descriptor.ts:14, 53` | `unknown`, `blockedBy` M-16, M-17, M-23, M-25                                       |
| `db` típus                 | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:2, 82-85`                                            | `readonly agentTools: readonly AgentToolId[]`                                       |
| `db` guard                 | `packages/db/src/workflow-graph/agent-step-config/is-agent-step-config.ts:3, 23-27, 66-71, 193`                             | `isAgentToolIdArray`                                                                |
| `db` komment               | `packages/db/src/workflow-graph/agent-step-config/storable-mcp-server.ts:7-8`                                               | hivatkozás az `agentTools` listára                                                  |
| `db` fixtúra               | `packages/db/src/graph-snapshot/snapshot-hash/graph-snapshot-document-v1-fixture.json:55`                                   | `"agentTools": ["web_search"]`, a lenyomat literál bemenete                         |
| `protocol` séma            | `packages/protocol/src/node-config/agent-tool-id.ts:8-10`, `agent-step-config.ts:2, 74`, `index.ts:148-149`                 | `AgentToolIdSchema` és a mező                                                       |
| motor                      | `packages/engine/src/agent-step/build-agent-step-options.ts:86-92`                                                          | komment: a mező szándékosan nem kerül az `Options`-ba                               |
| szerkesztő                 | `apps/web/src/node-inspector/AgentStepConfigFields.tsx:6, 280-292`                                                          | "Beépített agent eszközök" jelölőnégyzet csoport                                    |
| szerkesztő alapérték       | `apps/web/src/node-inspector/default-agent-step-settings.ts:31`                                                             | `agentTools: []`                                                                    |
| sodródás védelem           | `apps/server/src/node-config-drift-protection/node-config-drift-protection.spec.ts:91`                                      | a `db` és a `protocol` `AgentStepConfig` kölcsönös értékadhatósága a mezővel együtt |

A tesztfixtúrák (`agentTools: []`, `recommendedAgentTools: knownFact([])`) fájlonként a research
3.3 táblájában állnak: `packages/engine` 21 kódfájl, `apps/web` 31, `packages/db` 8, `packages/protocol`
7, `apps/server` 3.

### 2.3 Az `emit_output_tool` stratégia lánca a megmaradó kódban (a commitolt fa olvasása, `6009603`)

A `StructuredOutputStrategyId` unió két tagú (`'emit_output_tool' | 'sdk_output_format'`,
`packages/provider-capability/src/request-shaping/structured-output-strategy-id.ts:4`). A mindkét
provider leírójában mindkét stratégia szerepel, **az alapértelmezés mindkettőnél `sdk_output_format`**
(`provider-minimax/src/request-shaping/structured-output.ts`, a `defaultStrategy` mezője:
M-02, M-03, M-19 bizonyíték; `provider-claude-subscription/src/request-shaping/structured-output.ts`:
dokumentáció bizonyíték). Az `sdk_output_format` mindkét providernél `usable: known true`
(`minimax`: M-02, M-03; `claude-subscription`: `DOC_STRUCTURED`). A törlés után tehát pontosan egy
stratégia marad, és az működik mindkét providerrel. A research 3.5 szekciója a teljes leltárat adja
(46 fájl, 120 találat a `tools/` és a `docs/` nélkül; az `enabledEngineHooks` mező fixtúra soraival együtt 85 fájl, 184 találat).

| Réteg                      | Hely                                                                                                                                        | Mi az                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| stratégia unió             | `provider-capability` `structured-output-strategy-id.ts:4`, `protocol` `structured-output-strategy-id.ts:7`                                 | `'emit_output_tool'` tag                                                                   |
| provider leírók            | `provider-minimax` és `provider-claude-subscription` `request-shaping/structured-output.ts`                                                 | az `emit_output_tool` stratégia bejegyzése, M-10, M-19 bizonyítékkal                       |
| `db` guard                 | `is-agent-step-config.ts:39` (`STRUCTURED_OUTPUT_STRATEGY_KEYS`)                                                                            | az `emit_output_tool` kulcs                                                                |
| szerkesztő                 | `apps/web/src/node-inspector/StructuredOutputField.tsx:7`                                                                                   | a mező alapértelmezése `emit_output_tool`                                                  |
| `enabledEngineHooks` érték | `db` `engine-hook-id.ts:15`, `protocol` `engine-hook-id.ts:9`, `is-agent-step-config.ts:30`, `AgentStepConfigFields.tsx:245-253`            | az egyetlen `EngineHookId` érték: `emit_output_tool_stop`; a mező egésze törlődik (O-17)   |
| motor, `Stop` hook         | `engine/src/agent-step/build-stop-hook-matcher.ts`, `build-agent-step-options.ts:40-43, 64-65`, `engine/src/index.ts:220`                   | a `Stop` hook illesztő és a `hooks` opció összeállítása                                    |
| motor, kommentek           | `engine/src/agent-step/validate-agent-step-capabilities.ts:105`, `engine/CLAUDE.md:78`                                                      | hivatkozás a `buildStopHookMatcher` függvényre                                             |
| tesztek                    | 46 fájl a `tools/` és `docs/` nélkül, köztük 15 `engine` `.spec.ts` fájl stratégia fixtúrával (`id: 'emit_output_tool'`, `defaultStrategy`) | a fixtúrák egy része két stratégiát használ (`resolve-structured-output-strategy.spec.ts`) |

### 2.4 A tárolt adat (saját mérés, research 1. szekció)

A user döntése szerint nincs tárolt adat, amit óvni kellene (5.1). A mérés ennek ellenére a 5.2
szigorítás alapja: a mező törlése után a `db` guard egy `agentTools` kulcsot hordozó configot
**elfogad** (`readGraph`, `isNodeConfig`, `replaceGraph` mind átengedi, és a kulcs a tárolt configban
megmarad), míg a `protocol` olvasó sémái (`z.strictObject`) `unrecognized_keys` hibával elutasítják.
A két oldal tehát az ismeretlen kulcsra ma eltérően dönt.

### 2.5 A gyári eszközök (a telepített SDK és a hivatalos dokumentáció, research 2. szekció)

- Az `allowedTools` az SDK szerint az engedélykérés nélkül futó eszközök listája, nem az elérhető
  eszközök korlátja; a `disallowedTools` az eszközt kiveszi a modell kontextusából; a beépített
  készletet a `tools` opció adja (`sdk.d.ts:1416-1422, 1437-1442, 1469-1478`). A `WebSearch` és a
  `WebFetch` beépített, engedélyt kérő eszköz (<https://code.claude.com/docs/en/tools-reference>).
- A motor a lépés két listáját és a leíró szerinti tiltott szerver oldali eszköz kliens nevét adja
  át (`build-agent-step-options.ts:100-101`), `tools` és `canUseTool` opciót nem.
- A `WebSearch` az Anthropic keresőjét hívja, a háttér nem konfigurálható; a `WebFetch` a letöltött
  tartalmon külön modellhívást futtat (tools-reference, "WebSearch tool behavior", "WebFetch tool
  behavior").
- **Nem ellenőrzött:** hogy a pinelt `0.3.245` SDK (Claude Code `2.1.245`) a mi lépésünk
  alapértelmezett `permissionMode` értéke mellett egy `allowedTools` nélküli `WebSearch` hívást mit
  csinál; és hogy a `WebFetch` külön modellhívása a `minimax` provider base URL-jére megy-e.

---

## 3. Hatókör

### 3.1 Ami törlődik

1. **A hét csomag teljes fája**: `packages/tool-minimax-web-search`,
   `packages/tool-minimax-understand-image`, `packages/tool-firecrawl-web-fetch`,
   `packages/minimax-client`, `packages/firecrawl-client`, `packages/mcp-tool-kit`,
   `packages/agent-tool-bundle` (85 fájl, research 3.2). A csomagszám 26-ról 19-re csökken
   (13 `packages`, 2 `apps`, 3 `tooling`, 1 `tools`).
2. **Az `agentTools` fogalom**: a `db` `AgentStepConfig.agentTools` mező és guard ága, a `protocol`
   `AgentToolIdSchema` és a mező, a `provider-capability` `AgentToolId` és `AgentToolRecommendation`
   típusa, a leíró `recommendedAgentTools` mezője, a két provider ajánlás adata, a szerkesztő
   választója, minden tesztfixtúra mezője (2.2).
3. **Az `emit_output_tool` strukturált kimenet stratégia** minden ráutalásával (2.3): az unió
   `'emit_output_tool'` tagja a `provider-capability`, a `protocol` és a `db` oldalon, a két provider
   leírójának bejegyzése, a szerkesztő alapértelmezése, a motor `Stop` hook illesztője
   (`build-stop-hook-matcher.ts`) és a `hooks` opció összeállítása, az `enabledEngineHooks`
   `emit_output_tool_stop` értéke és vele az `enabledEngineHooks` mező egésze (O-17), a tesztek és a dokumentáció (7.3).
4. **A `core` árván maradó 11 exportja** (`postJson`, `PostJsonRequest`, `getBinary`, `BinaryPayload`,
   `readBaseUrl`, `readTimeoutMs`, `ImageMediaType`, `mediaTypeFromContentType`,
   `mediaTypeFromExtension`, `ReadFileFunction`, `resolveImageDataUrl`), a fájljaikkal és tesztjeikkel,
   a `browser-safe-imports.spec.ts:4` hivatkozással együtt. Forrás: gyökér `CLAUDE.md` 3. szekció
   ("Remove imports/variables/functions that YOUR changes made unused").
5. **Konfiguráció**: a réteg térkép hét sora (`tooling/scripts/src/dependency-graph/package-layer.ts:22,
30-31, 37-39, 42`) és a fejléc számai (`:3, 5`), a `turbo.json` négy env neve (`:17-20`, a
   `MINIMAX_API_KEY` marad), a `bun.lock` hét workspace bejegyzése (a `bun install` állítja elő).
6. **Dokumentáció**: minden hivatkozás a 7. szekció szerint.

### 3.2 Ami marad, változatlanul

- `packages/provider-minimax` és `packages/provider-claude-subscription`, a `recommendedAgentTools`
  adat és az `emit_output_tool` stratégia bejegyzése kivételével; a `serverTools`
  (`provider-minimax/src/tool-support/server-tools.ts`) és a `models[MiniMax-M3].imageInput`
  mérésen alapuló értéke.
- A motor `disallowedServerTools` útja (`build-agent-step-options.ts:101`), tehát a `minimax`
  lépés kérésében a `WebSearch` tiltva marad.
- A lépés `allowedTools` és `disallowedTools` szabad szöveges mezője (nincs gyári eszköz választó).
- Az `mcpServers` mező (`StorableMcpServer`, a `db` és a `protocol` oldalon): a SPEC-009-ben lesz
  konfigurálva és bekötve (user döntés 2026-10-26).
- A strukturált kimenet `sdk_output_format` stratégiája, mint az egyetlen stratégia.
- A `tools/wire-probe` minden mérési esete, köztük az M-10 és az M-19 (7.1, 7.3): a provider
  viselkedését mérik, nem termékkód; a rulebook 9. szekciója szerint az SDK frissítése előtt
  regresszióként futtatandók.
- A `zod` függőség (a `protocol` és a `tools/wire-probe` használja), az Agent SDK pin.

### 3.3 Nem cél

- Új eszköz, új mérés vagy új provider képesség bevezetése.
- Migráció, olvasó oldali tűrés, kompatibilitási kód a régi `agentTools` kulcsra (5.1).
- A pillanatkép dokumentum burkolatának (`isGraphSnapshotDocumentV1`) szigorítása: az nem NodeConfig
  guard (5.2).
- A megváltoztathatatlan pillanatkép módosítása (szabálykönyv 10. szekció 2. pont).
- A `StructuredOutputCapability` további mezőinek (`blockingWireDetail`, `observedRoundTrips`)
  egyszerűsítése az egy stratégiás állapotra: a törlés csak az `emit_output_tool` bejegyzést viszi el.
- A CI visszakapcsolása.

### 3.4 Következmény, amit a törlés kimond

- **A `minimax` provideres agent lépésnek a törlés után nincs működő webes keresője és nincs
  képértelmezése.** A szerver oldali `WebSearch` tiltva marad (M-17, M-25), a `imageInput` `known:
false` (M-16, M-23). Ez kimondott korlát, nem hiba (user döntés 2026-10-26, O-6). A `WebFetch`
  viselkedése a `minimax` providerrel nem mért (2.5), ez "nem ellenőrzött" jelöléssel marad.
- A `claude-subscription` lépés a gyári `WebSearch` és `WebFetch` eszközt használhatja; hogy
  engedély nélkül mi történik a pinelt SDK-ban, "nem ellenőrzött" (2.5, user döntés 2026-10-26, O-7).
- A strukturált kimenethez egy stratégia marad, az `sdk_output_format` (2.3).

---

## 4. Az érintett helyek leltára

A teljes, fájlonkénti és soronkénti lista a research 3.3 táblájában áll (109 fájl a hét csomagon
kívül), az `emit_output_tool` lánc leltára a research 3.5 szekciójában. Itt a csomagonkénti
összesítő.

### 4.1 Kód (a hét csomagon kívül)

| Hely                                                               | Fájl                                                               | Találat     | Mit kell tenni                                                                                                                                                  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/provider-capability`                                     | 4                                                                  | 11          | `agent-tool-id/` téma és `tool-support/agent-tool-recommendation.ts` törlése, leíró mező, barrel                                                                |
| `packages/provider-minimax`                                        | 2                                                                  | 5           | `tool-support/recommended-agent-tools.ts` törlése, `descriptor.ts:14, 62`                                                                                       |
| `packages/provider-claude-subscription`                            | 2                                                                  | 4           | ugyanaz, `descriptor.ts:14, 53`                                                                                                                                 |
| `packages/db`                                                      | 8                                                                  | 18          | típus, guard, komment, `.spec.ts` fixtúrák, a lenyomat fixtúra kulcsa és a literál újraszámolása                                                                |
| `packages/protocol`                                                | 7                                                                  | 16          | `agent-tool-id.ts` és `.spec.ts` törlése, mező, barrel, fixtúrák                                                                                                |
| `packages/engine`                                                  | 21                                                                 | 31          | a `build-agent-step-options.ts:86-92` komment, 20 `.spec.ts` fixtúra                                                                                            |
| `apps/server`                                                      | 3                                                                  | 3           | három `.spec.ts` fixtúra, köztük a sodródás védelem                                                                                                             |
| `apps/web`                                                         | 31                                                                 | 53          | `AgentStepConfigFields.tsx`, alapérték, unit és e2e fixtúrák, a `node-inspector.spec.ts:714-720` e2e, a `run-event-row-summary.spec.ts:463-482` példa eszköznév |
| `apps/web/src/browser-safe-imports/browser-safe-imports.spec.ts:4` | 1                                                                  | 1           | a `core` `image-source` hivatkozás                                                                                                                              |
| `packages/core`                                                    | 1 kódfájl (`index.ts`)                                             | 11 export   | törlés                                                                                                                                                          |
| `emit_output_tool` lánc (2.3)                                      | 46 (85 az `enabledEngineHooks` sorokkal; `tools/`, `docs/` nélkül) | 120 (184)   | az unió tagja, két leíró, `db` guard, szerkesztő alapérték, `Stop` hook illesztő, tesztfixtúrák (research 3.5)                                                  |
| `tooling/scripts`                                                  | 1                                                                  | 7           | `package-layer.ts`                                                                                                                                              |
| `turbo.json`                                                       | 1                                                                  | 4           | négy env név                                                                                                                                                    |
| `bun.lock`                                                         | 1                                                                  | 7 bejegyzés | `bun install`                                                                                                                                                   |

### 4.2 Dokumentáció

| Hely                                          | Fájl     | Találat | Jellege                                                                                                                                                                                                                                   | Kezelés                         |
| --------------------------------------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `.claude/CLAUDE.md`                           | 1        | 8       | szabály példák (`:232, 262-268`) és két buktató (`:1446-1451`)                                                                                                                                                                            | O-14                            |
| csomag `CLAUDE.md` (a megmaradó csomagokban)  | 8        | 16      | `agent`, `core`, `engine`, `protocol`, `provider-capability`, a két provider, `typeguards`                                                                                                                                                | átírás a végleges fájlkészletre |
| `docs/spec`                                   | 6        | 220     | SPEC-001 (14), SPEC-002 (198), SPEC-003 (4), SPEC-004 (1), SPEC-008 (1)                                                                                                                                                                   | O-11                            |
| `docs/plan`                                   | 3        | 51      | PLAN-000 (2), PLAN-002 (39), PLAN-004 (10)                                                                                                                                                                                                | O-11                            |
| `docs/research` (szöveges)                    | 5        | 25      | `2026-08-26-agent-tools.md` (11, a teljes fájl a lánc kutatása), `2026-08-27-spec002-migracio-zaras.md` (7), `2026-09-23-transcript-panel-meresek.md` (4), `2026-08-26-toolchain.md` (2), `2026-09-25-kepernyokep-vedelem-hatokor.md` (1) | O-12, O-15                      |
| `docs/research` (nyers artefaktum)            | 8        | 60      | `2026-10-21-spec010-blokkolo-meresek/` alatti log, diff és `.masolat` másolat                                                                                                                                                             | O-13: változatlan               |
| `emit_output_tool` ráutalások a dokumentumban | lásd 7.3 | 7.3     | SPEC-003 4.4, SPEC-004 F-7 és 11.3, SPEC-008 5., `db` és `engine` `CLAUDE.md`, `2026-08-26-agent-sdk-minimax.md:147`                                                                                                                      | 7.3                             |

---

## 5. A tárolt adat és a `db` guard

### 5.1 Nincs migráció, nincs kompatibilitási kód

A user döntése (2026-10-26): "nincs még adatbázis, nincs mit migrálni", "nincs régi rajz". Ebből
következik:

- az `agentTools` mező (és minden további törölt mező) **egyszerűen törlődik** a típusokból, a
  guardokból és a sémákból;
- **nincs** adatmigráció (`drizzle-kit generate --custom` nem fut, a `packages/db/drizzle`
  könyvtár változatlan);
- **nincs** olvasó oldali tűrés (a `protocol` olvasó sémái `z.strictObject` maradnak, nem kerül beléjük
  `z.unknown().optional()`, `z.object` vagy `z.looseObject`);
- **nincs** kompatibilitási ág a futás nézet vetítésében.

A research 1. szekciójának mérése (a `json_remove` próbák, a B2 fázis) ezért nem kerül
megvalósításra; az 5.2 szigorítás alapjaként marad meg.

### 5.2 A `db` NodeConfig guard szigorítása (user döntés 2026-10-26, O-3)

**A szabály.** A `db` gráf ellenőrzése minden ismeretlen kulcsot elutasít. Az ellenőrzés helye az
`isNodeConfig` és a rá épülő `isAgentStepConfig` (a `join` `ai_synthesis` módjának `settings`
alobjektuma is), amit a következő utak futtatnak:

| Út                                                        | Hibaág                          |
| --------------------------------------------------------- | ------------------------------- |
| `replaceGraph` (írás előtt)                               | `malformed_node_config`         |
| `readGraph` (olvasás)                                     | `corrupt_node_config`           |
| a futás indításának ellenőrzése (`validate-node-configs`) | `malformed_node_config` (motor) |
| a pillanatkép node `config` mezőjének ellenőrzése         | a meglévő hibaág                |

A hibaágak és üzenetek nem változnak; csak az elfogadott alakok halmaza szűkül.

**Mit jelent az "ismeretlen kulcs".** Minden ellenőrzött objektumnak zárt, ismert kulcslistája van:

- a tíz `NodeConfig` típus (a `type` kulcs, a típus mezői és az `onUnhandledError`);
- az `AgentStepConfig` mezői (az `agent_step` node-on a `type` és az `onUnhandledError` mellett,
  a `join` `ai_synthesis` `settings` alatt azok nélkül);
- a beágyazott objektumok: `StartInputField`, `BranchOption`, `ScriptConfig` (a `script` node-on és a
  `join` `script` módján), `PresetSystemPrompt`, `StructuredOutputConfig`, `SandboxConfig`, a három
  `StorableMcpServer` variáns.

**Ami szabadon marad (a belsejük nem szűkíthető, mert a típus nyitott):**

| Hely                                | Miért                                                                                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `AgentStepConfig.agents`            | `Readonly<Record<string, unknown>>` (`agent-step-config.ts:72`)                                                                            |
| `JoinMergeNodeConfig.settings`      | `JoinMergeSettings = Readonly<Record<string, unknown>>` (`node-config.ts:75`)                                                              |
| `StructuredOutputConfig.schema`     | JSON Schema dokumentum, `unknown` (SPEC-003 4.6)                                                                                           |
| `SandboxConfig` öt nyitott mezője   | `allowUnsandboxedCommands`, `network`, `filesystem`, `ignoreViolations`, `ripgrep`: a kulcs ismert, az érték nyitott (`sandbox-config.ts`) |
| `sub_workflow.inputMapping` kulcsai | szabad nevű `Record<string, string>`                                                                                                       |

**Megvalósítási elv.** A kulcslisták a meglévő `Readonly<Record<Unió, true>>` mintát követik
(`is-agent-step-config.ts:15-40`), de kulcsra: `Readonly<Record<keyof T, true>>`, hogy a fordító
jelezzen, ha egy típus bővül és a lista nem. Az ellenőrzés `Object.keys` alapú, `as` nélkül, a
projekt typeguardjaival. Nem vezethető be olyan ág, ami típusilag vagy logikailag sosem fut
(szabálykönyv 5. szekció, 100 százalék).

**A sodródás védelem.** A szabálykönyv 5. szekciójának sodródás védelmi szabályai érvényesek: a
`protocol` mentési és olvasó sémái `z.strictObject` alapúak, a `db` guard ezzel a szigorítással
ugyanarra az ismeretlen kulcs szabályra áll. A védelem helye az `apps/server`
`node-config-drift-protection` témája, futásidejű ággal: mind a tíz `NodeConfig` típusra (a `join`
mind a négy ágára) és a beágyazott objektumokra egy ismeretlen kulcs mindkét oldalon elbukik, a
szabadon maradó mezők tetszőleges kulcsa mindkét oldalon átmegy. A szabálykönyv 5. szekciója új
bekezdést kap erről (T-011-9).

**A hatás felmérése a lépés része (T-011-8, `opus`).** Mielőtt a guard változik, a lépés a research
új szekciójában rögzíti: (1) minden objektumhoz a `protocol` séma mezőlistája mint referencia; (2) melyik
meglévő teszt és fixtúra hordoz ma ismeretlen kulcsot (például a lenyomat fixtúra agent node-ja,
`VALID_AGENT_STEP_SETTINGS`), és az hogyan igazodik; (3) hogy a `protocol` és a `db` kulcslistája a
szabad mezőknél egyezik. Hibás megítélés esetén (egy kulcs, amit a típus tartalmaz, de a lista kihagy)
a lépés nem zárható.

**A lenyomat fixtúra (user döntés 2026-10-26, O-4).** A
`graph-snapshot-document-v1-fixture.json:55` `agentTools` kulcsa törlődik, és a hozzá tartozó lenyomat
literál újraszámolódik. A fixtúra a research 1.5 szerint ma sem érvényes `NodeConfig` (nincs
`onUnhandledError`); ez nem része a feladatnak, a fixtúra csak a lenyomat literál őrzője marad.

---

## 6. A gyári eszközök a törlés után

| Kérdés                                                                     | A mai kód                                                                                                                                                      | A törlés után                                                                                                                     |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Hol nevez meg a termék eszközt?                                            | a szerkesztő "Beépített agent eszközök" csoportja a három in-process nevet kínálja (`AgentStepConfigFields.tsx:280-292`)                                       | sehol; **nincs gyári eszköz választó** (O-5); a lépés `allowedTools` és `disallowedTools` szabad szöveges mező marad (`:262-279`) |
| Ki tilt gyári eszközt?                                                     | a motor, a leíró `serverTools` adatából: `minimax` esetén `WebSearch` (`build-agent-step-options.ts:101`)                                                      | változatlan                                                                                                                       |
| Elérhető-e a `WebSearch` és a `WebFetch` a `claude-subscription` lépésben? | a motor nem ad át `tools` opciót, tehát az SDK alapkészlete érvényes (2.5); az engedély lépésenként, az "Engedélyezett eszközök" listán vagy az engedély módon | változatlan; nincs új kód (O-7); az engedély nélküli viselkedés a pinelt SDK-ban "nem ellenőrzött"                                |
| Elérhető-e a `WebFetch` a `minimax` lépésben?                              | nincs tiltva; a külön modellhívása a MiniMax felé nem mért                                                                                                     | változatlan; "nem ellenőrzött" (O-6)                                                                                              |
| Mi a `minimax` lépés kerete?                                               | szerver oldali keresés tiltva, képértelmezés nincs                                                                                                             | **kereső és képértelmezés nélkül marad, kimondott korlát** (3.4, O-6)                                                             |

Helyettesítő elem a törlés **nem** igényel: a lánc a termékben nem volt bekötve.

---

## 7. A dokumentációs hivatkozások szerepe

### 7.1 Ami a provider bizonyítéka, nem a láncé

| Hivatkozás                                                                                                                                                                                                       | Mire szolgál                                                                                          | A törlés után                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| M-17, M-25 (SPEC-000, `2026-08-26-spec000-kiertekeles.md` 5.4, M-25 szekció)                                                                                                                                     | a `minimax` `serverTools[web_search].available: false` és `clientToolName: 'WebSearch'` bizonyítéka   | marad, a leíró hivatkozza (`server-tools.ts:7-31`) |
| M-16, M-23 (ugyanott, M-23 szekció)                                                                                                                                                                              | a `models[MiniMax-M3].imageInput: known false` bizonyítéka                                            | marad                                              |
| M-16, M-17, M-23, M-25 a `recommendedAgentTools` adatban                                                                                                                                                         | az MCP eszköz ajánlásának indoklása                                                                   | a mezővel együtt törlődik                          |
| M-03, M-09, M-10, M-19, M-37, M-38 (SPEC-000 `:157, 199, 206, 267-271, 393-402`, PLAN-000 `:51, 106, 112`, `2026-08-26-spec000-meresi-jegyzokonyv.md:51, 121, 129`, `2026-08-28-parhuzamossagi-korlat.md:29-31`) | a provider tool hívásának, streamjének, `Stop` hookjának és kérésszámának mérése saját mérő eszközzel | marad; nem a lánc része, lásd 7.3                  |

### 7.2 Ami csak a láncé: a user döntései szerinti kezelés

| Dokumentum                                                                                                                                                                                                                                                      | Kezelés (user döntés 2026-10-26)                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SPEC-001 3. szekciójának `agent-tools` sorai és 51 ... 55. kritériuma, SPEC-002 5.10 ... 5.18 szekciója és a 4., 6. szekció példái, PLAN-002 F3 ... F5 fázisa, PLAN-004 `:87-97, 368-369`, SPEC-003 `:287`, SPEC-004 `:752`, SPEC-008 `:21` és `:386`, PLAN-000 | **O-11: a törölt csomagokról szóló szakaszok és sorok törlődnek.** A megmaradó szöveg számai és hivatkozásai a végleges állapothoz igazodnak (például SPEC-008 `:21` "huszonegy mezője")               |
| `2026-08-26-agent-tools.md`, a `2026-08-26-agent-sdk-minimax.md:166-178` "In-process MCP tool" szakasz, a `2026-08-27-spec002-migracio-zaras.md`, `2026-08-26-toolchain.md:120-121`, `2026-09-25-kepernyokep-vedelem-hatokor.md:192`                            | **O-12: a teljes MCP eszköz szekciók és az `agent-tools.md` törlődik.** A provider mért tényei (M-16, M-17, M-23, M-25 és társai) maradnak, mert a leíró rájuk hivatkozik                              |
| `docs/research/2026-10-21-spec010-blokkolo-meresek/` (8 fájl, 60 találat)                                                                                                                                                                                       | **O-13: változatlan**, kimondott egyetlen kivétel (a nyers kimenet átírása a mérést hamisítaná); a SPEC-011 saját research mellékletének `.masolat` és nyers fájljai, ha a nevet tartalmazzák, szintén |
| `.claude/CLAUDE.md:232, 262-268` elnevezési példák és `:1446-1451` két provider buktató                                                                                                                                                                         | **O-14: a példák meglévő csomagokra cserélődnek, a két buktató (a MiniMax hibajelzés a válasz törzsében, a `web_search` séma) törlődik**                                                               |
| `run-event-row-summary.spec.ts:463-482` (`mcp__agent-tools__web_search`) és `2026-09-23-transcript-panel-meresek.md:253, 295-302`                                                                                                                               | **O-15: csak a teszt példa eszközneve cserélődik egy gyári eszköznévre; a régi pixel mérés számai a research-ben történeti értékként maradnak** (a mérés kivétel a 11. szekció keresésében)            |
| a megmaradó csomagok `CLAUDE.md` hivatkozásai                                                                                                                                                                                                                   | átírás a végleges fájlkészletre, a `## Fájlok` tábla ugyanabban a commitban, amelyik a fájlkészletet változtatja                                                                                       |

### 7.3 Az `emit_output_tool` ráutalásai (user döntés 2026-10-26, O-9)

A szabály: **ami élő szabályt vagy a termék viselkedését írja le, az átíródik vagy törlődik; ami
a provider mérése, az marad.**

| Hely                                                                                                                                                                  | Kezelés                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| SPEC-003 4.4 (`enabledEngineHooks` sor és magyarázata, `structuredOutput.strategy` értékkészlet)                                                                      | átírás az egy stratégiás állapotra; az `enabledEngineHooks` sor törlődik (O-17)                                                               |
| SPEC-004 F-7, 11.3 táblázat 2. sora                                                                                                                                   | átírás: egy stratégia marad; a mért körszám (M-03: 4) marad                                                                                   |
| SPEC-008 `:385` (`enabledEngineHooks` a "Modell és futási korlátok" panelen)                                                                                          | az `enabledEngineHooks` a panelről törlődik (O-17)                                                                                            |
| `packages/db/CLAUDE.md:20, 59`, `packages/engine/CLAUDE.md:78`                                                                                                        | a fájlkészlet változásával (`engine-hook-id.ts` törlése O-17 szerint, `build-stop-hook-matcher.ts`)                                           |
| PLAN-004 `engine-hook-id.ts` sorai (`:130, 163, 171, 217`)                                                                                                            | törlődnek (O-17 és O-11 szerint, mint a törölt fájlokra hivatkozó sorok)                                                                      |
| `2026-08-26-agent-sdk-minimax.md:147` ("a projektben a kötelező `emit_output` tool kikényszerítésére szolgál")                                                        | a mondat törlődik; a `Stop` hook SDK leírása marad                                                                                            |
| SPEC-000 (M-10, M-19 leírása, a mérési esetek tervezett típusa és táblája), PLAN-000, `2026-08-26-spec000-kiertekeles.md`, `2026-08-26-spec000-meresi-jegyzokonyv.md` | **változatlan**: provider mérés, az eredmény és a leíró bizonyíték története; a rulebook 9. szekciója szerint a mérések regresszióként futnak |
| `tools/wire-probe/src/cases/m-10.ts`, `m-19.ts`                                                                                                                       | **változatlan**: mérő eszköz, nem termékkód                                                                                                   |
| `packages/provider-capability/.../measurement-document.ts:43` (az M-19 szakasz címe)                                                                                  | **változatlan**: a SPEC-000 szakaszcímét tükrözi, a mérés marad                                                                               |

---

## 8. A törlés sorrendje

Minden lépés után a kilenc kapu zöld (szabálykönyv 8. szekció). A sorrendet a függőségi irány
dönti el: előbb a fogyasztó, utána a szolgáltató; a `db` szigorítás a végleges kulcskészletre épül,
tehát az összes mező törlése után jön.

1. **A hét csomag**, felülről lefelé, egy lépésben is lehet, mert termékkód nem importálja őket:
   `agent-tool-bundle`, a három `tool-*`, a két kliens, a `mcp-tool-kit`; vele a réteg térkép hét
   sora, a `turbo.json` négy env neve és a `bun.lock`; a transcript teszt példa eszközneve (O-15). A
   `check:graph` a hiányzó csomagot nem jelzi, a térkép fölösleges sorát a 11. szekció ellenőrzése
   dönti el.
2. **A `core` árva exportjai** (a `browser-safe-imports.spec.ts:4` hivatkozással együtt).
3. **Az `agentTools` mező, egy atomi lépésben**: a `protocol` séma, a `db` típus és guard, az
   `apps/server` sodródás védelem, az `apps/web` szerkesztő és alapérték, és minden tesztfixtúra a
   `db`, `protocol`, `engine`, `apps/server`, `apps/web` alatt; a lenyomat fixtúra kulcsa és a literál
   újraszámolása. Szétbontani nem lehet: a sodródás védelem a két oldal kölcsönös
   értékadhatóságát a `typecheck` kapun őrzi, és az `apps/web` a `protocol` típusán fordul.
4. **A `recommendedAgentTools` leíró mező és a két provider adata**, a `engine` tesztfixtúráinak
   `recommendedAgentTools: knownFact([])` soraival.
5. **A `provider-capability` `AgentToolId` és `AgentToolRecommendation` típusa**, a barrellel; a 3.
   és 4. lépés után nincs fogyasztója.
6. **Az `emit_output_tool` stratégia, egy atomi lépésben**: az unió tagja a három csomagban, a két
   provider leírója, a `db` guard, a szerkesztő alapértéke (`sdk_output_format`), a `Stop` hook illesztő
   és a `hooks` opció, a tesztfixtúrák (15 `engine` `.spec.ts` stratégia fixtúra), és az `enabledEngineHooks` mező teljes
   törlése (O-17). Szétbontani nem lehet, ugyanazon okból, mint a 3. lépésnél.
7. **A `db` NodeConfig guard szigorítása** (5.2), a hatás felmérésével, a `db` és az `apps/server`
   tesztjeivel.
8. **Dokumentáció** a 7. szekció szerint, és a csomag `CLAUDE.md` `## Fájlok` táblák ugyanabban
   a commitban, amelyik a fájlkészletet változtatja (szabálykönyv 6. szekció).
9. **Zárás**: a merge kapu (kilenc kapu, 8 shard e2e, `coverage:e2e:report`); az e2e küszöb a fedett
   kód törlése miatt a ratchet szabály szerint, tételes levezetéssel követheti a mért értéket
   (szabálykönyv 8. szekció).

---

## 9. Tesztelés

- A törölt kódhoz tartozó tesztek a kóddal együtt törlődnek; a lefedettség 100 százalék marad, a
  `coverage.exclude` nem bővül.
- Migráció és tűrés nincs, tehát ezekhez teszt sem (5.1).
- Az 5.2 szigorítás saját tesztet kap **mindkét oldalon** (a gyökér `CLAUDE.md` 7. szekciója szerint
  minden viselkedés teszttel fedett): a `db` `is-node-config.spec.ts` és `is-agent-step-config.spec.ts`
  fájlja minden típusra és beágyazott objektumra egy ismeretlen kulcsot elutasít; a szabad mezők
  (`agents`, `JoinMergeNodeConfig.settings`, `schema`, a `SandboxConfig` nyitott mezői, `inputMapping`)
  tetszőleges kulcsot elfogadnak; a `workflow-repository.spec.ts` a `replaceGraph` és a `readGraph`
  hibaágát valós `:memory:` adatbázison; az `apps/server` `node-config-drift-protection` témája a
  protokoll és a `db` döntésének egyezését. Rontásos igazolás: a szigorítás visszavonására a tesztek
  elbuknak (a rontás a PR leírásában).
- A szerkesztő e2e tesztje (`node-inspector.spec.ts:704-720`) a csoport eltűnését állítja
  (`toBeAttached({ attached: false })`), helyettesítő választó nincs (O-5).
- A strukturált kimenet mezőjének unit és e2e tesztje az új alapértékre (`sdk_output_format`).
- Az ellenőrző keresés (11. szekció) **nem** kap regressziós tesztet (O-16): a PR leírásban futtatott
  parancs a bizonyíték.

---

## 10. Kockázatok

| Kockázat                                                                                                 | Kezelés                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A 3. és a 6. lépés atomi commitja nagy                                                                   | a 3. lépés részletes leírással `sonnet` `high`, a 6. lépés `opus` `medium` végrehajtásra megy, az ellenőrzés `opus`                                                                                                 |
| Az `emit_output_tool` törlése után a két stratégiát használó tesztek elveszítik a megkülönböztető esetet | a tesztfixtúrák a megmaradó `sdk_output_format` szerint íródnak át, a kétstratégiás ágak (kiválasztás, `observedRoundTrips`) egy bejegyzéssel és szintetikus esettel maradnak lefedve; a lefedettség nem csökkenhet |
| A `db` guard szigorítása egy meglévő fixtúrát vagy tesztet elbuktat                                      | a hatás felmérése a T-011-8 lépés első része (5.2); a fixtúra igazodik a típushoz, a guard nem enged vissza                                                                                                         |
| Az `enabledEngineHooks` üres értékkészlete nem kezelhető futó ág nélkül                                  | O-17 lezárva: a mező egésze törlődik, nincs üres értékkészletű mező                                                                                                                                                 |     |
| A `bun.lock` kézi szerkesztése                                                                           | tilos; a `bun install` állítja elő, a `--frozen-lockfile` ellenőrzés a zárásban                                                                                                                                     |
| Egy történeti research fájl módosítása egy mérés bizonyító erejét rontja                                 | az O-12 és O-13 válasza dönti el; a nyers kimenet átírása nélkül, a provider mérések változatlanok                                                                                                                  |

---

## 11. Elfogadási kritériumok

**Az ellenőrző keresések kivételei (K).** Minden alábbi `git grep` az egész fán fut (a `docs/`
alatt is), a következő, megnevezett kivételekkel, és csak ezekkel:

- `docs/research/2026-10-21-spec010-blokkolo-meresek/` (a nyers mérési kimenetek, O-13);
- `docs/spec/SPEC-011-eszkoz-lanc-torles.md`, `docs/plan/PLAN-011-eszkoz-lanc-torles.md`,
  `docs/research/2026-10-26-eszkoz-lanc-torles.md` és a
  `docs/research/2026-10-26-eszkoz-lanc-torles/` melléklet mappa (a törlés saját dokumentumai);
- `docs/research/2026-09-23-transcript-panel-meresek.md` kizárólag a `mcp__agent-tools` mintára (a
  régi pixel mérés történeti értéke, O-15).

A pathspec alakja: `-- . ':!docs/research/2026-10-21-spec010-blokkolo-meresek'
':!docs/spec/SPEC-011-*' ':!docs/plan/PLAN-011-*' ':!docs/research/2026-10-26-eszkoz-lanc-torles*'`.

### A csomagok

1. A hét csomag könyvtára nem létezik: `git ls-files packages/tool-minimax-web-search
packages/tool-minimax-understand-image packages/tool-firecrawl-web-fetch packages/minimax-client
packages/firecrawl-client packages/mcp-tool-kit packages/agent-tool-bundle` kimenete üres.
2. `git ls-files '*/package.json' | wc -l` a gyökér nélkül 19 (13 `packages`, 2 `apps`, 3 `tooling`,
   1 `tools`), és a szabálykönyv 6. szekciója ezt a számot írja.
3. A `PACKAGE_LAYER` térkép bejegyzéseinek száma a workspace csomagszámmal egyezik, a fejléc
   kommentje (`package-layer.ts:3, 5`) a frissített számot írja; `bun run check:graph` zöld.
4. `git grep -n -i -E "tool-minimax-web-search|tool-minimax-understand-image|tool-firecrawl-web-fetch|minimax-client|firecrawl-client|mcp-tool-kit|agent-tool-bundle|firecrawl|MINIMAX_API_BASE_URL|MINIMAX_TIMEOUT_MS"`
   a K kivételekkel nulla találat.
5. `bun install --frozen-lockfile` nulla kilépési kóddal fut, és a `bun.lock` nem tartalmazza a hét
   `packages/...` bejegyzést; a `turbo.json` `MINIMAX_API_KEY` sora megvan.

### Az `agentTools` fogalom

6. `git grep -n -E "agentTools|AgentToolId|AgentToolRecommendation|recommendedAgentTools|RecommendedAgentTools|agent-tool-id|recommended-agent-tools|agent-tool-recommendation"`
   a K kivételekkel nulla találat. **Kivétel nincs**: a lenyomat fixtúra kulcsa törölve (O-4), migráció
   és tűrő séma nem létezik (5.1).
7. `git grep -n -E "understand_image|web_fetch|mcp__agent-tools"` a K kivételekkel nulla találat.
8. A `ProviderCapabilityDescriptor` típusnak nincs `recommendedAgentTools` mezője, és mindkét
   provider leírója a `typecheck` kapun fordul.
9. A `minimax` leíró `serverTools` értéke bájtra azonos a `6009603` állapotával
   (`git diff 6009603 -- packages/provider-minimax/src/tool-support/server-tools.ts` üres), és a
   `build-agent-step-options.ts` `disallowedServerTools` sora változatlan.
10. A `node-config-drift-protection` téma a mező nélkül zöld, és egy szándékosan csak az egyik oldalra
    visszaírt `agentTools` mező a `typecheck` kapun elbukik (a rontás a PR leírásában).

### Az `emit_output_tool` stratégia

11. `git grep -n -E "emit_output|buildStopHookMatcher|build-stop-hook-matcher"`
    a K kivételeken **és** a 7.3 szerint megtartott helyeken kívül nulla találat. A megtartott helyek
    teljes listája: `tools/wire-probe/src/cases/m-10.ts`, `m-19.ts`;
    `packages/provider-capability/src/evidence-sources/measurement-document/measurement-document.ts`;
    `docs/spec/SPEC-000-provider-wire-measurement.md`, `docs/plan/PLAN-000-provider-wire-measurement.md`,
    `docs/research/2026-08-26-spec000-kiertekeles.md`, `docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`.
12. A `StructuredOutputStrategyId` unió egy tagú (`'sdk_output_format'`) a `provider-capability`, a
    `protocol` (`StructuredOutputStrategyIdSchema`) és a `db` oldalon; mindkét provider leírója egyetlen
    stratégiát sorol fel, az alapértelmezés `sdk_output_format`; a szerkesztő `StructuredOutputField`
    alapértéke `sdk_output_format`, unit és e2e teszttel.
13. Az `enabledEngineHooks` az O-17 szerint teljesen törölt: `git grep -n -E "enabledEngineHooks|EngineHookId|EngineHookIdSchema|engine-hook-id"` a K
    kivételekkel nulla találat, és a szerkesztőben nincs "motor hookok" csoport.

### A `db` guard és a tárolt adat

14. Az 5.2 szigorítás mindkét oldalon tesztelt (9. szekció): egy ismeretlen kulcs a tíz `NodeConfig`
    típuson, a `join` mind a négy ágán és a beágyazott objektumokon elbukik a `db` `isNodeConfig`
    guardján, a `replaceGraph` (`malformed_node_config`) és a `readGraph` (`corrupt_node_config`) hívásán,
    és a `protocol` sémáján; a szabadon maradó mezők tetszőleges kulcsa mindkét oldalon átmegy. A
    rontás (a szigorítás visszavonása) a PR leírásában, a tesztek bukásával.
15. Nincs migráció és nincs tűrés: `git diff 6009603 -- packages/db/drizzle` üres, a `check:db-drift`
    zöld, és `git diff 6009603 -- packages/protocol/src` nem ad hozzá `z.looseObject`, `z.object(` vagy
    `z.unknown().optional()` hívást a törölt mezők helyére.

### A szerkesztő

16. A "Beépített agent eszközök" csoport nincs a DOM-ban (e2e), és nincs helyettesítő gyári eszköz
    választó (O-5); az `allowedTools` és `disallowedTools` szabad szöveges mező változatlan.

### Dokumentáció és kapuk

17. A 7. szekció minden hivatkozása a user döntései szerint kezelve (O-11 ... O-15); a megmaradó
    csomagok `CLAUDE.md` fájljaiban a 4., 6., 7. és 11. kritérium mintái nulla találatot adnak.
18. A kilenc kapu nulla kilépési kóddal fut; a merge kapu (8 shard e2e, `coverage:e2e:report`) a PR
    fején zöld, a fedetlen tételek száma egyik metrikán sem nő.
19. Gondolatjel (em dash) a módosított fájlokban nincs: `git diff --name-only 6009603 | xargs grep -lP "\x{2014}"` üres.
20. Gépi őr nincs (O-16): a PR leírása tartalmazza a 4., 6., 7. és 11. kritérium futtatott
    parancsát és a kimenetét (nulla találat a megnevezett kivételekkel), a fej SHA-jával;
    `git diff 6009603 --stat -- tooling/scripts` kizárólag a `package-layer.ts` módosítását mutatja.

---

## 12. Nyitott kérdések és a user döntései

### 12.1 A tételek

Minden tétel a user 2026-10-26-i döntésével **lezárva**.

| #    | Kérdés                                                                                            | Állapot és döntés (user döntés 2026-10-26)                                                                                                                                                                                                                                                       | Hol valósul meg   |
| ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| O-1  | A mentett gráfok (`workflow_node.config`) `agentTools` kulcsa                                     | **Lezárva.** "nincs még adatbázis, nincs mit migrálni": nincs migráció, nincs tűrés, a mező egyszerűen törlődik a típusokból, guardokból, sémákból                                                                                                                                               | 5.1               |
| O-2  | A régi futások pillanatképe                                                                       | **Lezárva.** "nincs régi rajz": nincs vetítési tűrés, nincs kompatibilitási kód                                                                                                                                                                                                                  | 5.1               |
| O-3  | A `db` guard az ismeretlen kulcsot ma tűri                                                        | **Lezárva (szigorítás).** A `db` gráf ellenőrzése (írás, olvasás, `NodeConfig` guard) minden ismeretlen kulcsot elutasít; a hatás felmérése és a regressziós teszt mindkét oldalon külön lépés                                                                                                   | 5.2, T-011-8      |
| O-4  | A lenyomat fixtúra `agentTools` sora                                                              | **Lezárva.** A kulcs törlődik, a lenyomat literál újraszámolva                                                                                                                                                                                                                                   | 5.2, T-011-4      |
| O-5  | Kell-e gyári eszköz választó a szerkesztőben                                                      | **Lezárva.** Nincs; a meglévő szabad szöveges `allowedTools` mező marad                                                                                                                                                                                                                          | 6.                |
| O-6  | A `minimax` lépés kereső és képértelmezés nélkül marad                                            | **Lezárva.** Kimondott korlát a specben; a gyári `WebSearch` tiltása a `minimax` leíróban marad                                                                                                                                                                                                  | 3.4, 6.           |
| O-7  | A gyári eszköz engedélye a `claude-subscription` lépésben                                         | **Lezárva.** Lépésenként, az "Engedélyezett eszközök" listán vagy az engedély módon, ahogy ma; nincs új kód. Az engedély nélküli viselkedés a pinelt SDK-ban "nem ellenőrzött" jelöléssel marad                                                                                                  | 2.5, 6.           |
| O-8  | Kiterjed-e a döntés az `mcpServers` mezőre                                                        | **Lezárva.** A mező marad, a SPEC-009-ben lesz konfigurálva és bekötve                                                                                                                                                                                                                           | 3.2               |
| O-9  | Kiterjed-e az `emit_output_tool` stratégiára                                                      | **Lezárva (törlés).** A stratégia törlődik minden ráutalásával; a stratégia unióban az `sdk_output_format` marad az egyetlen, és mindkét providerrel működik (2.3). A `wire-probe` M-10, M-19 esetei és a mérési dokumentumok maradnak (7.3). Az `enabledEngineHooks` mező egésze törlődik: O-17 | 2.3, 7.3, T-011-7 |
| O-10 | A `core` árván maradó exportjai                                                                   | **Lezárva.** A 11 export törlődik                                                                                                                                                                                                                                                                | 3.1, T-011-3      |
| O-11 | A lezárt spec és terv dokumentumok kezelése                                                       | **Lezárva (szakaszok törlése).** A SPEC-001, 002, 003, 004, 008, PLAN-002, 004 és PLAN-000 törölt csomagokról szóló szakaszai és sorai törlődnek                                                                                                                                                 | 7.2, T-011-10     |
| O-12 | A szöveges research fájlok                                                                        | **Lezárva.** Az MCP eszközökről szóló szakaszok és az `agent-tools.md` törlődik; a MiniMax provider mért tényei (M-16, M-17, M-23, M-25 és társai) maradnak, mert a leíró rájuk hivatkozik                                                                                                       | 7.2, T-011-10     |
| O-13 | A nyers mérési artefaktumok                                                                       | **Lezárva.** A `2026-10-21-spec010-blokkolo-meresek/` alatti 8 fájl változatlan, kimondott egyetlen kivételként (és a SPEC-011 saját research mellékletének `.masolat` és nyers fájljai, ha a nevet tartalmazzák); a greppes elfogadási kritérium kihagyja őket                                  | 11. K             |
| O-14 | A szabálykönyv elnevezési példái és két buktatója                                                 | **Lezárva.** A példák meglévő csomagokra cserélődnek, a két buktató (MiniMax hibajelzés a válasz törzsében, `web_search` séma) törlődik                                                                                                                                                          | 7.2, T-011-9      |
| O-15 | A transcript példa eszköznév és a mért pixel értékek                                              | **Lezárva.** Csak a teszt példa eszköznév cserélődik egy gyári eszköznévre; a régi pixel mérés számai a research-ben történeti értékként maradnak                                                                                                                                                | 7.2, T-011-2      |
| O-16 | Gépi őr a greppes kritériumokra                                                                   | **Lezárva.** Nincs gépi őr; a PR leírásban a futtatott ellenőrző keresés (nulla találat a megnevezett kivételekkel) a bizonyíték                                                                                                                                                                 | 11. 20.           |
| O-17 | Mi lesz az `enabledEngineHooks` mezővel, ha az egyetlen értéke (`emit_output_tool_stop`) törlődik | **Lezárva (a mező törlődik).** "A mező is törlődik": az `enabledEngineHooks` mező teljesen törlődik minden rétegből (`db` típus, guard, `engine-hook-id.ts`; `protocol` séma és mező; a szerkesztő csoportja és alapértéke; a fixtúrák; a lenyomat literál újraszámolva)                         | 12.2, T-011-7     |

### 12.2 O-17: az `enabledEngineHooks` mező (lezárva)

**Lezárva (user döntés 2026-10-26): "A mező is törlődik"**, az (a) opció szerint. Az `enabledEngineHooks` mező
teljesen törlődik minden rétegből: a `db` típus, guard és az `engine-hook-id.ts`; a `protocol`
`EngineHookIdSchema` és a mező; a szerkesztő "motor hookok" csoportja és alapértéke; a fixtúrák sorai; a
lenyomat fixtúra sora és a literál újraszámolása; a SPEC-003 4.4 sora. A `hooks` opció összeállítása nincs
a motorban.

**Az eltérés, amit a döntés zárt le.** Az O-9 döntés az `emit_output_tool_stop` **értékét** nevezte meg,
az `EngineHookId` uniónak ez az egyetlen tagja (`db` `engine-hook-id.ts:15`, `protocol`
`engine-hook-id.ts:9`). Az érték törlése után a mezőnek nincs érvényes eleme, és a mező egyetlen
fogyasztója (a motor `Stop` hook illesztője) is törlődik. A mező jelenléte 62 fájlt (75 találat) érintett.

**Indok.** Üres értékkészletű mezőhöz nem írható futó ág nélküli guard, a 100 százalékos lefedettségi
szabály (szabálykönyv 5. szekció) miatt; a (b) opció (üres értékkészletű mező) spekulatív lett volna.

**Végrehajtás:** T-011-7.

### 12.3 Levezetett pontok, amelyeket a user nem nevezett meg

Ezek az O-9 és O-3 döntések következményei, a spec ezeket így vezeti le; ha a user mást akar, jelezze.

1. **A strukturált kimenet mezőjének stratégia választója** az egyetlen értékkel (`sdk_output_format`)
   marad, új kód nélkül; az alapérték az egyetlen érték.
2. **A `wire-probe` M-10, M-19 és a SPEC-000 / PLAN-000 / spec000 research mérési leírásai
   változatlanok** (7.3): provider mérések, a rulebook 9. szekciója szerint regresszióként futnak.
3. **A pillanatkép dokumentum burkolata** (`isGraphSnapshotDocumentV1`) nem része a szigorításnak (5.2):
   az nem NodeConfig guard, a döntés a `NodeConfig` guardot nevezi meg.
4. **A `StructuredOutputCapability` további mezői** (`blockingWireDetail`, `observedRoundTrips`) nem
   egyszerűsödnek (3.3).

---

## 13. Kapcsolódó dokumentumok

- [`../research/2026-10-26-eszkoz-lanc-torles.md`](../research/2026-10-26-eszkoz-lanc-torles.md)
- [`../research/2026-08-26-spec000-kiertekeles.md`](../research/2026-08-26-spec000-kiertekeles.md)
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md)
- [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md)
- [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md)
- [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md)
- [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md)
- [`../plan/PLAN-011-eszkoz-lanc-torles.md`](../plan/PLAN-011-eszkoz-lanc-torles.md)
