# SPEC-011: Az in-process eszköz lánc törlése

|          |                                                                                                                                                                                                                                                                                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz  | tervezet, 2026-10-26; a 12. szekció nyitott kérdései (O-1 ... O-16) a user döntésére várnak, a végrehajtás addig nem indul                                                                                                                                                                                                                                                      |
| Dátum    | 2026-10-26                                                                                                                                                                                                                                                                                                                                                                      |
| Előzmény | [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md) (a hét csomag létrehozása), [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md) (4.4, `agentTools`), [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md) (7.7), [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) (5., a beállítás panel) |
| Bemenet  | [`../research/2026-10-26-eszkoz-lanc-torles.md`](../research/2026-10-26-eszkoz-lanc-torles.md) (a tárolt adat mérése, a gyári eszközök forrásai, a teljes leltár)                                                                                                                                                                                                               |
| Kimenet  | hét workspace csomag törlése, az `agentTools` fogalom törlése a `provider-capability`, a két provider, a `db`, a `protocol`, az `engine`, az `apps/server` és az `apps/web` csomagból, a dokumentáció átvezetése                                                                                                                                                                |
| Terv     | [`../plan/PLAN-011-eszkoz-lanc-torles.md`](../plan/PLAN-011-eszkoz-lanc-torles.md)                                                                                                                                                                                                                                                                                              |

---

## 1. Cél és hatókör

**A mai állapot.** A workspace hét csomagja egy saját folyamatban futó (in-process) MCP eszköz
láncot alkot: három eszköz (`web_search` a MiniMax `coding_plan` keresőjével, `understand_image` a
MiniMax képértelmezőjével, `web_fetch` a Firecrawllal), a két HTTP kliens, a közös MCP segéd és a
lépésenkénti köteg. A lánc a SPEC-000 mérése nyomán készült: a MiniMax a szerver oldali
`web_search` eszközt csendben eldobja (M-17, M-25), a kép content blokkot nem látja (M-16, M-23)
(`docs/research/2026-08-26-agent-tools.md` 1. szekció). A futó termék a láncból semmit nem
importál (2.1), a lépés `agentTools` mezője tárolódik, a szerkesztőben szerkeszthető, de a motor nem
köti be (`build-agent-step-options.ts:86-92`).

### A user döntése, amit ez a spec megvalósít

| #   | Döntés (2026-10-26)                                                                                                                                       | Hol valósul meg |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | "minimaxmcp -t ki lehet dobni (törölni kell a kódját és minden ráutalást a dokumentációkból is!)"                                                         | 3., 4., 7., 8.  |
| 2   | "csak a gyári claude tool-ok maradnak"                                                                                                                    | 3., 6.          |
| 3   | A MiniMax mint LLM provider (`provider-minimax`, `ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic`) **marad**                                         | 3.2             |
| 4   | Marad a `minimax` provider szerver oldali `web_search` letiltása (`serverTools`, `clientToolName: 'WebSearch'`) és a képesség leíró mérésen alapuló mezői | 3.2             |

### Amit eldönt

- Melyik hét csomag törlődik, és melyik fogalom tűnik el velük (3.1).
- Mi marad változatlanul (3.2).
- A törlés sorrendjét, úgy, hogy minden lépés után a kilenc kapu zöld legyen (8.).
- A gépi elfogadási kritériumokat (11.).

### Amit NEM dönt el (a 12. szekció nyitott kérdései)

- A régi, `agentTools` kulcsot hordozó tárolt gráfok és pillanatképek sorsát (5., O-1 ... O-4).
- Hogy a szerkesztő kínál-e a gyári eszközökre választót (6., O-5 ... O-7).
- Hogy a "csak a gyári claude tool-ok maradnak" kiterjed-e a `mcpServers` mezőre és az
  `emit_output_tool` stratégiára (O-8, O-9).
- A `core` csomag árván maradó exportjainak sorsát (O-10).
- A történeti spec, plan és research dokumentumok átírásának mértékét (7., O-11 ... O-16).

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

### 2.3 A tárolt adat (saját mérés, research 1. szekció)

A mező törlése után (`db` típus, `db` guard, `protocol` séma, három sor) egy régi, `agentTools`
kulcsot hordozó tárolt gráf és futás:

- a `db` `readGraph` és a motor `isNodeConfig` ellenőrzése **átmegy**, mert a `db` guard az
  ismeretlen kulcsot nem utasítja el;
- a szerkesztő betöltése (`WorkflowGraphDocumentSchema`, `GraphEditorScreen.tsx:438`) **elbukik**:
  `unrecognized_keys`, `nodes.0.config`, `agentTools`;
- a futás nézet rajza (`NodeConfigSchema.safeParse`, `project-snapshot-graph.ts:35`) **elbukik**
  ugyanígy, a felület a hibás mező útvonalát nevezi meg (`project-snapshot-graph.ts:37-40`);
- a `db` `replaceGraph` egy `agentTools` kulcsos configot elfogad és **változatlanul tárol**;
- a `workflow_node` sorokon a `json_remove` a kulcsot eltávolítja, ezután a szerkesztő betöltése
  átmegy; a `graph_snapshot` sorra ugyanez `SQLITE_CONSTRAINT_TRIGGER` hibát ad
  (`graph_snapshot is immutable`), tehát a pillanatkép rajza a régi futásokra továbbra is elbukik.

### 2.4 A gyári eszközök (a telepített SDK és a hivatalos dokumentáció, research 2. szekció)

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
   `packages/agent-tool-bundle` (85 fájl, research 3.2).
2. **Az `agentTools` fogalom**: a `db` `AgentStepConfig.agentTools` mező és guard ága, a `protocol`
   `AgentToolIdSchema` és a mező, a `provider-capability` `AgentToolId` és `AgentToolRecommendation`
   típusa, a leíró `recommendedAgentTools` mezője, a két provider ajánlás adata, a szerkesztő
   választója, minden tesztfixtúra mezője (2.2).
3. **Konfiguráció**: a réteg térkép hét sora (`tooling/scripts/src/dependency-graph/package-layer.ts:22,
30-31, 37-39, 42`) és a fejléc számai (`:3, 5`), a `turbo.json` négy env neve (`:17-20`, a
   `MINIMAX_API_KEY` marad), a `bun.lock` hét workspace bejegyzése (a `bun install` állítja elő).
4. **Dokumentáció**: minden hivatkozás a 7. szekció szerint, a user O-11 ... O-16 válaszának
   megfelelő mértékben.

### 3.2 Ami marad, változatlanul

- `packages/provider-minimax` és `packages/provider-claude-subscription`, a `recommendedAgentTools`
  adat kivételével; a `serverTools` (`provider-minimax/src/tool-support/server-tools.ts`) és a
  `models[MiniMax-M3].imageInput` mérésen alapuló értéke.
- A motor `disallowedServerTools` útja (`build-agent-step-options.ts:101`), tehát a `minimax`
  lépés kérésében a `WebSearch` tiltva marad.
- A lépés `allowedTools` és `disallowedTools` szabad szöveges mezője, a `mcpServers` mező, a
  strukturált kimenet két stratégiája (O-8 és O-9 eldöntéséig).
- A `tools/wire-probe` minden mérési esete; a hat in-process mérő eszköz (M-03, M-09, M-10, M-19,
  M-37, M-38) a provider viselkedését méri, nem a lánc része (research 3.4).
- A `zod` függőség (a `protocol` és a `tools/wire-probe` használja), az Agent SDK pin.

### 3.3 Nem cél

- Új eszköz, új mérés vagy új provider képesség bevezetése (O-6 egy mérést felvet, de az döntés).
- A `db` guard általános szigorítása az ismeretlen kulcsokra (O-3).
- A megváltoztathatatlan pillanatkép módosítása (szabálykönyv 10. szekció 2. pont).
- A CI visszakapcsolása.

### 3.4 Következmény, amit a törlés kimond

A `minimax` provideres agent lépésnek a törlés után nincs működő webes keresője (a szerver oldali
`WebSearch` tiltva, M-17, M-25) és nincs képértelmezése (`imageInput` `known: false`, M-16, M-23). A
`claude-subscription` lépés a gyári `WebSearch` és `WebFetch` eszközt használhatja, a 2.4 nem
ellenőrzött pontjával (O-7).

---

## 4. Az érintett helyek leltára

A teljes, fájlonkénti és soronkénti lista a research 3.3 táblájában áll (109 fájl a hét csomagon
kívül), a minta a research 3.1 szekciójában. Itt a csomagonkénti összesítő.

### 4.1 Kód (a hét csomagon kívül)

| Hely                                                               | Fájl                   | Találat     | Mit kell tenni                                                                                                                                                         |
| ------------------------------------------------------------------ | ---------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/provider-capability`                                     | 4                      | 11          | `agent-tool-id/` téma és `tool-support/agent-tool-recommendation.ts` törlése, leíró mező, barrel                                                                       |
| `packages/provider-minimax`                                        | 2                      | 5           | `tool-support/recommended-agent-tools.ts` törlése, `descriptor.ts:14, 62`                                                                                              |
| `packages/provider-claude-subscription`                            | 2                      | 4           | ugyanaz, `descriptor.ts:14, 53`                                                                                                                                        |
| `packages/db`                                                      | 8                      | 18          | típus, guard, komment, `.spec.ts` fixtúrák, a lenyomat fixtúra (O-4)                                                                                                   |
| `packages/protocol`                                                | 7                      | 16          | `agent-tool-id.ts` és `.spec.ts` törlése, mező, barrel, fixtúrák                                                                                                       |
| `packages/engine`                                                  | 21                     | 31          | a `build-agent-step-options.ts:86-92` komment, 20 `.spec.ts` fixtúra                                                                                                   |
| `apps/server`                                                      | 3                      | 3           | három `.spec.ts` fixtúra, köztük a sodródás védelem                                                                                                                    |
| `apps/web`                                                         | 31                     | 53          | `AgentStepConfigFields.tsx`, alapérték, unit és e2e fixtúrák, a `node-inspector.spec.ts:714-720` e2e, a `run-event-row-summary.spec.ts:463-482` példa eszköznév (O-15) |
| `apps/web/src/browser-safe-imports/browser-safe-imports.spec.ts:4` | 1                      | 1           | a `core` `image-source` hivatkozás (O-10)                                                                                                                              |
| `packages/core`                                                    | 1 kódfájl (`index.ts`) | 11 export   | O-10 szerint                                                                                                                                                           |
| `tooling/scripts`                                                  | 1                      | 7           | `package-layer.ts`                                                                                                                                                     |
| `turbo.json`                                                       | 1                      | 4           | négy env név                                                                                                                                                           |
| `bun.lock`                                                         | 1                      | 7 bejegyzés | `bun install`                                                                                                                                                          |

### 4.2 Dokumentáció

| Hely                                         | Fájl | Találat | Jellege                                                                                                                                                                                                                                   |
| -------------------------------------------- | ---- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/CLAUDE.md`                          | 1    | 8       | szabály példák (`:232, 262-268`) és két buktató (`:1446-1451`), O-14                                                                                                                                                                      |
| csomag `CLAUDE.md` (a megmaradó csomagokban) | 7    | 16      | `agent`, `core`, `engine`, `protocol`, `provider-capability`, a két provider, `typeguards`                                                                                                                                                |
| `docs/spec`                                  | 6    | 220     | SPEC-001 (14), SPEC-002 (198), SPEC-003 (4), SPEC-004 (1), SPEC-008 (1), SPEC-000 (a mérési esetek in-process eszközei, a minta nem fogja, 7.1)                                                                                           |
| `docs/plan`                                  | 3    | 51      | PLAN-000 (2), PLAN-002 (39), PLAN-004 (10)                                                                                                                                                                                                |
| `docs/research` (szöveges)                   | 5    | 25      | `2026-08-26-agent-tools.md` (11, a teljes fájl a lánc kutatása), `2026-08-27-spec002-migracio-zaras.md` (7), `2026-09-23-transcript-panel-meresek.md` (4), `2026-08-26-toolchain.md` (2), `2026-09-25-kepernyokep-vedelem-hatokor.md` (1) |
| `docs/research` (nyers artefaktum)           | 8    | 60      | `2026-10-21-spec010-blokkolo-meresek/` alatti log, diff és `.masolat` másolat, O-13                                                                                                                                                       |

---

## 5. A tárolt adat kompatibilitása

**A probléma (mérve, 2.3).** A `protocol` olvasó sémái `z.strictObject` alapúak, tehát a mező
törlése után egy régi gráf a szerkesztőben nem tölthető be, és egy régi futás rajza nem jelenik meg.
A `db` guard ezzel szemben tolerál, tehát a futás indítása működik, és a `db` szinten a kulcs
csendben megmaradhat. A pillanatkép megváltoztathatatlan (szabálykönyv 10. szekció 2. pont,
trigger mérve), tehát rajta adatmigráció nem futhat.

**Az opciók, a mért viselkedéssel** (a döntés O-1 ... O-3):

| #   | Opció                                                                                                                                                                          | A szerkesztő (régi gráf)                            | A futás nézet (régi futás)                 | Ára                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| A   | Adatmigráció a `workflow_node` sorokon (`drizzle-kit generate --custom`, `json_remove` a `$.agentTools` és a `$.settings.agentTools` útra), az olvasó sémák szigorúak maradnak | betölt (B2 mérés)                                   | nem rajzol, a hibás mező útvonalát mutatja | egy kézzel írt migráció; a pillanatkép rajza elveszik                                                                            |
| B   | Az olvasó oldal tolerálja a régi kulcsot: a `protocol` olvasó sémájában `agentTools: z.unknown().optional()` (a mentési séma nem engedi)                                       | betölt, a kulcs a következő mentésig a kliensben él | rajzol                                     | a mentés a kulcs miatt elbukik, amíg a kliens el nem dobja; a szabálykönyv 5. szekció `strictObject` szabályához pontosítás kell |
| C   | A + B: migráció a gráfokra, tolerancia csak a pillanatkép vetítésében (`project-snapshot-graph.ts`, a vetítés előtt a kulcs eldobása)                                          | betölt                                              | rajzol                                     | két mechanizmus                                                                                                                  |
| D   | Semmi: a régi gráf és futás a mért hibával jelenik meg                                                                                                                         | nem tölt be                                         | nem rajzol                                 | adatvesztés jellegű élmény a régi adaton                                                                                         |

A `z.object` (eldobó) és a `z.looseObject` (megtartó) séma a szabálykönyv `strictObject` szabályának
feloldása volna (research 1.4), ezért egyik sem szerepel külön opcióként; ha a user ezt kéri, az a
szabálykönyv módosítása.

**Mi a viselkedés addig:** a SPEC-011 végrehajtása nem indul, a mező a mai alakjában él.

---

## 6. A gyári eszközök a törlés után

| Kérdés                                                                     | A mai kód                                                                                                                                           | A törlés után                                                                              |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hol nevez meg a termék eszközt?                                            | a szerkesztő "Beépített agent eszközök" csoportja a három in-process nevet kínálja (`AgentStepConfigFields.tsx:280-292`)                            | sehol; a lépés `allowedTools` és `disallowedTools` szabad szöveges mező marad (`:262-279`) |
| Ki tilt gyári eszközt?                                                     | a motor, a leíró `serverTools` adatából: `minimax` esetén `WebSearch` (`build-agent-step-options.ts:101`)                                           | változatlan                                                                                |
| Elérhető-e a `WebSearch` és a `WebFetch` a `claude-subscription` lépésben? | a motor nem ad át `tools` opciót, tehát az SDK alapkészlete érvényes (2.4); engedélyhez a lépés `allowedTools` listája vagy a `permissionMode` kell | változatlan; a pinelt verzió engedély nélküli viselkedése nem ellenőrzött (O-7)            |
| Elérhető-e a `WebFetch` a `minimax` lépésben?                              | nincs tiltva; a külön modellhívása a MiniMax felé nem mért                                                                                          | változatlan (O-6)                                                                          |

Helyettesítő elem a törlés **nem** igényel technikailag: a lánc a termékben nem volt bekötve. Hogy a
felhasználó felé kell-e a gyári eszközökre választó, az termékkérdés (O-5).

---

## 7. A dokumentációs hivatkozások szerepe

### 7.1 Ami a provider bizonyítéka, nem a láncé

| Hivatkozás                                                                                                                                                                                                       | Mire szolgál                                                                                          | A törlés után                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| M-17, M-25 (SPEC-000, `2026-08-26-spec000-kiertekeles.md` 5.4, M-25 szekció)                                                                                                                                     | a `minimax` `serverTools[web_search].available: false` és `clientToolName: 'WebSearch'` bizonyítéka   | marad, a leíró hivatkozza (`server-tools.ts:7-31`) |
| M-16, M-23 (ugyanott, M-23 szekció)                                                                                                                                                                              | a `models[MiniMax-M3].imageInput: known false` bizonyítéka                                            | marad                                              |
| M-16, M-17, M-23, M-25 a `recommendedAgentTools` adatban                                                                                                                                                         | az MCP eszköz ajánlásának indoklása                                                                   | a mezővel együtt törlődik                          |
| M-03, M-09, M-10, M-19, M-37, M-38 (SPEC-000 `:157, 199, 206, 267-271, 393-402`, PLAN-000 `:51, 106, 112`, `2026-08-26-spec000-meresi-jegyzokonyv.md:51, 121, 129`, `2026-08-28-parhuzamossagi-korlat.md:29-31`) | a provider tool hívásának, streamjének, `Stop` hookjának és kérésszámának mérése saját mérő eszközzel | marad; nem a lánc része                            |
| `2026-08-26-agent-sdk-minimax.md:166-178` ("In-process MCP tool")                                                                                                                                                | az SDK API leírása, a `minimax` `mcp_servers` eldobásának hatása                                      | O-12                                               |
| `2026-08-26-agent-tools.md` (teljes fájl)                                                                                                                                                                        | a `coding_plan` és a Firecrawl végpontok kutatása, a lánc indoklása                                   | O-12                                               |

### 7.2 Ami csak a láncé

A SPEC-001 3. szekciójának `agent-tools` sorai és 51 ... 55. kritériuma, a SPEC-002 5.10 ... 5.18
szekciója és a 4., 6. szekció példái, a PLAN-002 F3 ... F5 fázisa, a PLAN-004 `:87-97, 368-369`
sorai, a SPEC-003 `:287` sora, a SPEC-004 `:752` sora, a SPEC-008 `:21` ("huszonegy mezője") és
`:386` sora, a szabálykönyv 6. szekciójának elnevezési példái és 12. szekciójának két provider
buktatója, a megmaradó csomagok `CLAUDE.md` hivatkozásai, a toolchain research `:120-121` sora.
Ezek kezelése O-11, O-14.

---

## 8. A törlés sorrendje

Minden lépés után a kilenc kapu zöld (szabálykönyv 8. szekció). A sorrendet a függőségi irány
dönti el: előbb a fogyasztó, utána a szolgáltató.

1. **A hét csomag**, felülről lefelé, egy lépésben is lehet, mert termékkód nem importálja őket:
   `agent-tool-bundle`, a három `tool-*`, a két kliens, a `mcp-tool-kit`; vele a réteg térkép hét
   sora, a `turbo.json` négy env neve és a `bun.lock`. A `check:graph` a hiányzó csomagot nem
   jelzi, a térkép fölösleges sorát az O-16 szerinti ellenőrzés dönti el.
2. **A `core` árva exportjai** az O-10 válasza szerint (a `browser-safe-imports.spec.ts:4`
   hivatkozással együtt).
3. **Az `agentTools` mező, egy atomi lépésben**: a `protocol` séma, a `db` típus és guard, az
   `apps/server` sodródás védelem, az `apps/web` szerkesztő és alapérték, és minden tesztfixtúra a
   `db`, `protocol`, `engine`, `apps/server`, `apps/web` alatt; ugyanebben a lépésben az 5. szekció
   O-1 ... O-3 szerinti tárolt adat kezelése. Szétbontani nem lehet: a sodródás védelem a két oldal
   kölcsönös értékadhatóságát a `typecheck` kapun őrzi, és az `apps/web` a `protocol` típusán fordul.
4. **A `recommendedAgentTools` leíró mező és a két provider adata**, a `engine` tesztfixtúráinak
   `recommendedAgentTools: knownFact([])` soraival.
5. **A `provider-capability` `AgentToolId` és `AgentToolRecommendation` típusa**, a barrellel; a 3.
   és 4. lépés után nincs fogyasztója.
6. **Dokumentáció** az O-11 ... O-16 szerint, és a csomag `CLAUDE.md` `## Fájlok` táblák ugyanabban
   a commitban, amelyik a fájlkészletet változtatja (szabálykönyv 6. szekció).
7. **Zárás**: a merge kapu (kilenc kapu, 8 shard e2e, `coverage:e2e:report`); az e2e küszöb a fedett
   kód törlése miatt a ratchet szabály szerint, tételes levezetéssel követheti a mért értéket
   (szabálykönyv 8. szekció).

---

## 9. Tesztelés

- A törölt kódhoz tartozó tesztek a kóddal együtt törlődnek; a lefedettség 100 százalék marad, a
  `coverage.exclude` nem bővül.
- Az 5. szekció választott opciója saját tesztet kap, valós `:memory:` adatbázison: az A és C opció
  migrációja egy `agentTools` kulcsos `workflow_node` sorra (felső szintű és `settings` alatti út);
  a B és C opció tűrése egy `agentTools` kulcsos configra a `protocol` olvasó sémáján, és a mentési
  séma elutasítása ugyanarra.
- A szerkesztő e2e tesztje (`node-inspector.spec.ts:704-720`) a csoport eltűnését állítja
  (`toBeAttached({ attached: false })`), ha az O-5 válasza nem ad helyettesítő választót.
- Regressziós teszt a 11. szekció greppes kritériumaira, a `greppable-invariants` mintájára, ha a user
  az O-16-ban gépi őrt kér.

---

## 10. Kockázatok

| Kockázat                                                                    | Kezelés                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A 3. lépés atomi commitja nagy                                              | a lépés részletes leírással `sonnet` `high` végrehajtásra megy, az ellenőrzés `opus`  |
| Egy régi adatbázisban `agentTools` kulcs marad, ami a felületen nem látszik | az 5. szekció választott opciója; a B opció mellett a kulcs a mentésig a kliensben él |
| A `bun.lock` kézi szerkesztése                                              | tilos; a `bun install` állítja elő, a `--frozen-lockfile` ellenőrzés a 7. lépésben    |
| Egy történeti research fájl módosítása egy mérés bizonyító erejét rontja    | az O-12 és O-13 válasza dönti el; a nyers kimenet átírása nélkül                      |
| A `minimax` lépés kereső nélkül marad                                       | kimondott következmény (3.4), O-6                                                     |

---

## 11. Elfogadási kritériumok

### A csomagok

1. A hét csomag könyvtára nem létezik: `git ls-files packages/tool-minimax-web-search
packages/tool-minimax-understand-image packages/tool-firecrawl-web-fetch packages/minimax-client
packages/firecrawl-client packages/mcp-tool-kit packages/agent-tool-bundle` kimenete üres.
2. `git ls-files '*/package.json' | wc -l` a gyökér nélkül 19 (13 `packages`, 2 `apps`, 3 `tooling`,
   1 `tools`), és a szabálykönyv 6. szekciója ezt a számot írja.
3. A `PACKAGE_LAYER` térkép bejegyzéseinek száma a workspace csomagszámmal egyezik, a fejléc
   kommentje (`package-layer.ts:3, 5`) a frissített számot írja; `bun run check:graph` zöld.
4. `git grep -n -E "@easter-workflow-builder/(tool-minimax-web-search|tool-minimax-understand-image|tool-firecrawl-web-fetch|minimax-client|firecrawl-client|mcp-tool-kit|agent-tool-bundle)" -- ':!docs/research'` nulla találat; a `docs/research` alatti találat csak az O-12, O-13 szerint megtartott fájlokban áll.
5. `bun install --frozen-lockfile` nulla kilépési kóddal fut, és a `bun.lock` nem tartalmazza a hét
   `packages/...` bejegyzést.

### Az `agentTools` fogalom

6. `git grep -n -E "agentTools|AgentToolId|AgentToolRecommendation|recommendedAgentTools|RecommendedAgentTools|agent-tool-id|recommended-agent-tools|agent-tool-recommendation" -- ':!docs'` nulla találat, kivéve az O-4 szerint megtartott `graph-snapshot-document-v1-fixture.json:55` sort és az 5. szekció választott opciójának kódját és tesztjét (a migráció SQL-je, a tűrő séma).
7. `git grep -n -E "understand_image|web_fetch|mcp__agent-tools" -- ':!docs'` nulla találat, kivéve az O-15 szerint megtartott helyeket.
8. `git grep -n -i -E "firecrawl|MINIMAX_API_BASE_URL|MINIMAX_TIMEOUT_MS" -- ':!docs'` nulla találat; a `turbo.json` `MINIMAX_API_KEY` sora megvan.
9. A `ProviderCapabilityDescriptor` típusnak nincs `recommendedAgentTools` mezője, és mindkét
   provider leírója a `typecheck` kapun fordul.
10. A `minimax` leíró `serverTools` értéke bájtra azonos a `6009603` állapotával
    (`git diff 6009603 -- packages/provider-minimax/src/tool-support/server-tools.ts` üres), és a
    `build-agent-step-options.ts:101` sora változatlan.
11. A `node-config-drift-protection` téma a mező nélkül zöld, és egy szándékosan csak az egyik oldalra
    visszaírt `agentTools` mező a `typecheck` kapun elbukik (a rontás a PR leírásában).

### A tárolt adat (a választott opció szerint)

12. Az O-1 ... O-3 válasza szerinti viselkedés egy-egy valós `:memory:` adatbázison futó teszttel
    igazolt, a 9. szekció szerint; a pillanatkép soron módosítás nem fut.

### A szerkesztő

13. A "Beépített agent eszközök" csoport nincs a DOM-ban (e2e), vagy az O-5 válasza szerinti elem áll
    a helyén, unit és e2e teszttel.

### Dokumentáció és kapuk

14. A 7. szekció minden hivatkozása az O-11 ... O-16 válasza szerint kezelve; a megmaradó csomagok
    `CLAUDE.md` fájljaiban a 3.1 minta nulla találatot ad.
15. A kilenc kapu nulla kilépési kóddal fut; a merge kapu (8 shard e2e, `coverage:e2e:report`) a PR
    fején zöld, a fedetlen tételek száma egyik metrikán sem nő.
16. Gondolatjel (em dash) a módosított fájlokban nincs: `git diff --name-only 6009603 | xargs grep -lP "\x{2014}"` üres.

---

## 12. Nyitott kérdések

Egyik sem zárható le tippeléssel. A "mi a viselkedés addig" minden tételnél: a SPEC-011 végrehajtása
nem indul, a mai kód és dokumentáció változatlan.

| #    | Kérdés                                                                                                                                                                                                                                                    | Opciók                                                                                                                                                                                                                                                          | Mi zárná le                                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| O-1  | A mentett gráfok (`workflow_node.config`) `agentTools` kulcsa                                                                                                                                                                                             | (a) adatmigráció `json_remove`-val (5. A); (b) olvasó oldali tűrés (5. B); (c) mindkettő (5. C); (d) semmi (5. D)                                                                                                                                               | user döntés                                                       |
| O-2  | A régi futások pillanatképe (megváltoztathatatlan, a kulcs benne marad, mérve)                                                                                                                                                                            | (a) a futás nézet vetítése eldobja a kulcsot (5. C); (b) a `protocol` `NodeConfigSchema` tűri (5. B); (c) a régi futás rajza a hibás mező útvonalával jelenik meg (mai hibaág); (d) a régi futások csak a workflow végleges törlésével tűnnek el                | user döntés                                                       |
| O-3  | A `db` guard az ismeretlen kulcsot ma tűri, és a `replaceGraph` tárolja (mérve)                                                                                                                                                                           | (a) marad (a HTTP úton a mentési séma szigorú); (b) a SPEC-011 a `db` guardot is szigorítja minden ismeretlen kulcsra; (c) csak az `agentTools` kulcsot utasítja el                                                                                             | user döntés                                                       |
| O-4  | A lenyomat fixtúra `agentTools` sora (`graph-snapshot-document-v1-fixture.json:55`); a fixtúra már ma sem érvényes `NodeConfig` (nincs `onUnhandledError`, mérve)                                                                                         | (a) marad, mint történeti dokumentum; (b) a sor törlődik, a lenyomat literál újraszámolva                                                                                                                                                                       | user döntés                                                       |
| O-5  | Kell-e a szerkesztőben a gyári eszközökre választó a törölt csoport helyett                                                                                                                                                                               | (a) nem, a szabad szöveges `allowedTools`/`disallowedTools` marad; (b) jelölőnégyzet a `WebSearch` és a `WebFetch` névre, ami az `allowedTools` listát írja; (c) más elem (a user írja le)                                                                      | user döntés; (b) vagy (c) esetén a design system elem ellenőrzése |
| O-6  | A `minimax` lépés kereső és képértelmezés nélkül marad (3.4); a `WebFetch` viselkedése MiniMax ellen nem mért                                                                                                                                             | (a) elfogadva, mérés nélkül; (b) új mérés a `WebFetch`-re MiniMax ellen (valódi API hívás, user engedéllyel); (c) a `WebFetch` a `minimax` leíróban tiltva, amíg nincs mérés                                                                                    | user döntés                                                       |
| O-7  | A gyári eszköz engedélye a `claude-subscription` lépésben (a pinelt verzió viselkedése nem ellenőrzött)                                                                                                                                                   | (a) a lépés készítőjének dolga az `allowedTools` vagy a `permissionMode` mezőn (mai állapot); (b) mérés a pinelt SDK-val hamis agent nélkül nem lehetséges, valódi hívás kell, user engedéllyel                                                                 | user döntés                                                       |
| O-8  | A "csak a gyári claude tool-ok maradnak" kiterjed-e a `mcpServers` mezőre (külső MCP szerver, SPEC-009 hatókör, ma csak olvasható a szerkesztőben)                                                                                                        | (a) nem, marad; (b) igen, a mező is törlendő (a SPEC-011 bővül)                                                                                                                                                                                                 | user döntés                                                       |
| O-9  | Kiterjed-e az `emit_output_tool` strukturált kimenet stratégiára, ami egy in-process `emit_output` eszközt feltételez (SPEC-000 M-10, M-19; ma nincs bekötve)                                                                                             | (a) nem, marad mint jövőbeli motor eszköz; (b) igen, a stratégia törlendő, csak az `sdk_output_format` marad                                                                                                                                                    | user döntés                                                       |
| O-10 | A `core` árván maradó exportjai (`postJson`, `getBinary`, `BinaryPayload`, `readBaseUrl`, `readTimeoutMs`, a teljes `image-source` tárgykör)                                                                                                              | (a) törlés, a gyökér `CLAUDE.md` 3. szekciója szerint ("Remove imports/variables/functions that YOUR changes made unused"); (b) megtartás                                                                                                                       | user megerősítés                                                  |
| O-11 | A történeti spec és plan dokumentumok (SPEC-001, SPEC-002, PLAN-002, PLAN-004 és a SPEC-003, SPEC-004, SPEC-008 egy-egy sora)                                                                                                                             | (a) a szakaszok törlése; (b) a szöveg marad, a fejlécbe "SPEC-011 felülírta" megjegyzés; (c) az élő szabályt hordozó sorok átírása (SPEC-003 4.4 tábla, SPEC-008 mezőszám), a végrehajtási történet marad megjegyzéssel                                         | user döntés                                                       |
| O-12 | A szöveges research fájlok: `2026-08-26-agent-tools.md` (teljes egészében a láncé), `2026-08-26-agent-sdk-minimax.md:166-178`, `2026-08-27-spec002-migracio-zaras.md`, `2026-08-26-toolchain.md:120-121`, `2026-09-25-kepernyokep-vedelem-hatokor.md:192` | (a) csak a lánc indoklását adó mondatok törlődnek, a provider mérési tények maradnak; (b) a teljes MCP eszköz szekciók és az `agent-tools.md` törlődik, a provider tények maradnak; (c) a research történeti, változatlan, egy "SPEC-011 törölte" megjegyzéssel | user döntés                                                       |
| O-13 | A nyers mérési artefaktumok (`docs/research/2026-10-21-spec010-blokkolo-meresek/` alatti log, diff, `.masolat`, 8 fájl, 60 találat)                                                                                                                       | (a) változatlan (a nyers kimenet átírása a mérést hamisítaná); (b) törlés                                                                                                                                                                                       | user döntés                                                       |
| O-14 | A szabálykönyv elnevezési példái (`.claude/CLAUDE.md:232, 262-268`) és két provider buktatója (`:1446-1451`, a forrásuk a törölt csomagok `CLAUDE.md` fájlja)                                                                                             | (a) a példák a megmaradó csomagokra cserélve, a két buktató törölve; (b) a buktatók maradnak történeti tanulságként, forrásként a research fájllal                                                                                                              | user döntés                                                       |
| O-15 | A transcript példa eszközneve (`run-event-row-summary.spec.ts:463-482`, `mcp__agent-tools__web_search`) és a mért pixel értékek ugyanezzel a névvel (`2026-09-23-transcript-panel-meresek.md:253, 295-302`)                                               | (a) a teszt példa egy semleges MCP névre cserélve, a research mérés változatlan; (b) mindkettő változatlan; (c) mindkettő cserélve (a mérés újrafuttatásával)                                                                                                   | user döntés                                                       |
| O-16 | Gépi őr a 11. szekció greppes kritériumaira                                                                                                                                                                                                               | (a) nincs, a kritérium a PR leírásban futtatott parancs; (b) regressziós teszt a `greppable-invariants` mintájára                                                                                                                                               | user döntés                                                       |

---

## 13. Kapcsolódó dokumentumok

- [`../research/2026-10-26-eszkoz-lanc-torles.md`](../research/2026-10-26-eszkoz-lanc-torles.md)
- [`../research/2026-08-26-agent-tools.md`](../research/2026-08-26-agent-tools.md)
- [`../research/2026-08-26-spec000-kiertekeles.md`](../research/2026-08-26-spec000-kiertekeles.md)
- [`SPEC-000-provider-wire-measurement.md`](SPEC-000-provider-wire-measurement.md)
- [`SPEC-002-csomag-architektura.md`](SPEC-002-csomag-architektura.md)
- [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md)
- [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md)
- [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md)
- [`../plan/PLAN-011-eszkoz-lanc-torles.md`](../plan/PLAN-011-eszkoz-lanc-torles.md)
