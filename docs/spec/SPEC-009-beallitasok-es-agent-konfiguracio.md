# SPEC-009: Beállítások és agent konfiguráció

|             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz     | tervezet, 2026-10-26; a 14.1 ... 14.6 szekció kérdései a user 2026-10-26-i döntéseivel lezárva; **nyitott kérdésekkel**: a 14.7 szekció O-31 ... O-41 kérdése a user döntésére vár, a 4. szekció blokkoló mérései (M-136, M-139) még nem futottak                                                                                                                                                                                                                                                                             |
| Dátum       | 2026-10-26                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Előzmény    | [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md) (4.4, 4.13, 4.14, 6.6, 11.), [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md) (4.2 D és E), [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) (`:35`, `:274`, `:484`, `:682`), [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) (5.2, 5.11, 54. és 60. kritérium), [`SPEC-011-eszkoz-lanc-torles.md`](SPEC-011-eszkoz-lanc-torles.md) (bemergelve a `main`-be, PR #61, `ba6d424`) |
| Bemenet     | [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md) (a hatókör hiányleltár, H-01 ... H-42), [`../research/2026-10-26-spec-009-forrasok.md`](../research/2026-10-26-spec-009-forrasok.md) (a döntésekhez gyűjtött források)                                                                                                                                                                                                                                                       |
| Kimenet     | a `/settings` képernyő bővítése (globális provider, kapcsolat teszt, párhuzamossági korlát, delta kapcsoló, skill könyvtár), a workflow szintű provider utólagos módosítása, a lépés `skills` és `mcpServers` mezőjének szerkesztése, a két mező bekötése az SDK `query()` hívásig, a futás izolációja, a greppes invariáns (9) tiltásának feloldása                                                                                                                                                                          |
| Előfeltétel | a **külön spec "helyi indítás, valódi próba és a kimenő környezet javítása"** (ideiglenes név), amit elsőként kell végrehajtani (O-21, O-29; 7.2 szekció)                                                                                                                                                                                                                                                                                                                                                                     |
| Terv        | [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md)                                                                                                                                                                                                                                                                                                                                                                                                              |

**A számozás megfeleltetése.** A spec és a terv sorszáma ennél a specnél elválik: a
`PLAN-009-graf-szerkeszto-es-futas-nezet.md` a **SPEC-008** terve (a számozás a PLAN-004b miatt
tolódott el), a **SPEC-009** terve a `PLAN-012-beallitasok-es-agent-konfiguracio.md`, mert a PLAN-010 a
SPEC-010-é, a PLAN-011 a SPEC-011-é. PLAN-009 néven SPEC-009 terv nincs és nem is lesz.

**Kiindulási állapot.** A SPEC-011 bemergelve (`ba6d424`): az `agentTools` mező, az `enabledEngineHooks`
mező, az `emit_output_tool` stratégia és a hét in-process eszköz csomag nem létezik; az agent lépés a
gyári Claude eszközöket használja, a lépés `allowedTools` és `disallowedTools` szabad szöveges mezője
marad, és az `mcpServers` mező marad (SPEC-011 3.2 és O-8: "A mező marad, a SPEC-009-ben lesz
konfigurálva és bekötve", user döntés 2026-10-26). A 2.1 szekció fájl és sor hivatkozásai a `main`
`ba6d424` fején olvasva.

**A döntések forrása.** A 14. szekció minden lezárt sora "user döntés 2026-10-26" forrású, az askuserquestion
tool-lal feltett kérdésekre adott válaszokból. Ahol a döntésből valami nem következett egyértelműen, az
új, nyitott kérdésként a 14.7 szekcióban áll.

---

## 1. Cél és hatókör

A SPEC-007 és a SPEC-008 több helyen "a SPEC-009 hatóköre" megjelöléssel halasztott munkát
(SPEC-007 `:35`, `:274`, `:484`, `:682`; SPEC-008 `:21`, `:36`, `:37`, `:396-397`, `:413-415`, `:423`,
`:782`, `:790`, `:1416`, 54. és 60. kritérium), de a SPEC-009 fájl sosem készült el (hiányleltár H-21). Ez a
spec ezt a hiányt zárja: a halasztott munkát egy helyre gyűjti.

### Amit eldönt

1. **A Beállítások képernyő bővítése** (H-01, H-02, H-03, H-04): a meglévő `/settings` képernyő
   (SPEC-008 5.11, O-31, O-32) bővül, nem cserélődik (SPEC-008 `:782`). Tartalma, kártyákban egymás
   alatt (O-8): a globális alapértelmezett provider választó a "Kapcsolat teszt" gombbal, a
   providerenkénti párhuzamossági korlát, a delta perzisztálás kapcsoló, a skill könyvtár és a
   visszavonás módosító választó (változatlan).
2. **A provider választás három szintje teljessé válik** (`.claude/CLAUDE.md` 9. szekció): a globális
   alapértelmezés a Beállítások képernyőn, a workflow szintű felülírás létrehozáskor **és utólag** (a
   "Workflow szerkesztése" modális, O-3), a lépés szintű felülírás a beállítás panelen (ma is). A
   "Kapcsolat teszt" gomb a provider választó komponens része mindenhol (O-2).
3. **A kapcsolat teszt `mode` mezője megszűnik** (O-1, H-19): egy út marad.
4. **A skill feltöltés (ZIP csomag), tárolás és betöltés** az SDK-ba (H-04), és a lépés `skills`
   mezőjének szerkesztése.
5. **Az MCP szerver konfiguráció**: a lépés `mcpServers` mezőjének szerkesztése (H-05), a bekötése az
   SDK `Options.mcpServers` mezőjéig (H-07), és a környezeti változók **név hozzárendelése**, ami a
   felhasználás helyén felülírható (O-18).
6. **A futás izolációja a szerver gép saját Claude beállításaitól** (`settingSources: []` és
   `strictMcpConfig: true`, H-41).
7. **A greppes invariáns (9) és a SPEC-008 54. kritérium tiltásának feloldása**, a SPEC-008 60.
   kritérium átvezetése.
8. **A hiányleltár többi tételének besorolása**: melyik kap saját specet vagy PR-t (14.6 szekció).

### Amit NEM dönt el (nem cél)

- **Provider CRUD.** Két provider marad, backend TypeScript configban, csak választani lehet
  közülük (`.claude/CLAUDE.md` 9. szekció; hiányleltár H-14, C kategória).
- **Új provider képesség, új mérés a MiniMax ellen.** A SPEC-000 mérései nem futnak újra.
- **Gyári eszköz választó** a szerkesztőben: a SPEC-011 O-5 szerint nincs.
- **A kimenő `Options.env` javítása, a helyi indítási út, a valódi provider próba** (H-40, H-42): külön
  spec, elsőként végrehajtva (7.2 szekció, O-21, O-29). Ez a spec csak hivatkozik rá.
- **A `script` csomópont, a strukturált kimenet séma szerinti ellenőrzése, a `StartInputField.valueKind`**:
  saját specek (14.6 szekció).
- **A `join` `merge` `settings` mező, az `error_handler` megszakítható várakozása, a `readRunEvents`
  útvonal besorolása, az elavult kommentek és doksik**: külön, kis PR-ok (14.6 szekció).
- **MCP szerver önálló kapcsolat tesztje.** Az SDK-ban a `Query.mcpServerStatus()` csak élő
  sessionön kérdezhető (telepített `sdk.d.ts:2540`); önálló, session nélküli próba API a d.ts-ben
  nincs. Ha kell, külön kérdés.
- **Titok tárolása.** A DB és a git továbbra is csak env változó **nevet** tárol (`.claude/CLAUDE.md` 7. szekció, SPEC-003 9.3); ez a spec ezt nem lazítja.
- **A CI visszakapcsolása** (H-15).

---

## 2. Megerősített tények, forrással

A webes források részletei, idézetekkel: [`../research/2026-10-26-spec-009-forrasok.md`](../research/2026-10-26-spec-009-forrasok.md).

### 2.1 A kód mai állapota (a `main` `ba6d424` fején olvasva)

| Tény                                                                                                                                                                                                                                                              | Forrás                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `/settings` képernyő egyetlen kártyát és egyetlen `preference-row` sort tart, a visszavonás módosító `SelectField` választóval; hálózati kérés nincs                                                                                                            | `apps/web/src/settings-screen/settings-screen.tsx:17-21, 43, 48-79`                                                                                                                                                          |
| A módosító választó `localStorage`-ban él (`eggGraphEditorUndoModifier`)                                                                                                                                                                                          | `apps/web/src/graph-editor/undo-modifier-storage.ts:11`                                                                                                                                                                      |
| A globális alapértelmezés a DB egysoros `app_setting.default_provider_id` oszlopa, nullázható, a migráció nem tölti ki                                                                                                                                            | `packages/db/src/app-setting/app-setting.ts:28-40`; SPEC-003 4.13                                                                                                                                                            |
| A `PUT /api/settings` részleges frissítés: `defaultProviderId?: string`, `persistStreamDeltas?: boolean`; a `defaultProviderId` nem nullázható                                                                                                                    | `packages/protocol/src/settings/settings-record.ts`; `apps/server/src/settings-endpoint/update-settings.ts:18-49`                                                                                                            |
| A web a `GET /api/settings` útvonalat egy helyen hívja (az örökölt provider szöveghez), a `PUT`-ot sehol                                                                                                                                                          | `apps/web/src/graph-editor/GraphEditorScreen.tsx:454`; hiányleltár 4. szekció                                                                                                                                                |
| A workflow `PATCH` útvonala a `providerId` mezőt elfogadja (`null` is), a web az átnevezésnél nem küldi                                                                                                                                                           | `packages/protocol/src/workflow/workflow-record.ts:59`; `apps/server/src/workflow-endpoint/update-workflow.ts:27-38`; `apps/web/src/workflow-list/rename-workflow-modal.tsx:57`                                              |
| A létrehozó modális a providert a `GET /api/providers` válaszából kínálja                                                                                                                                                                                         | `apps/web/src/workflow-list/create-workflow-modal.tsx:49, 67`                                                                                                                                                                |
| A feloldás sorrendje: lépés, workflow, globális, különben `no_default_provider`                                                                                                                                                                                   | `packages/engine/src/provider-resolution/resolve-effective-provider.ts:16-34`                                                                                                                                                |
| A kapcsolat teszt útvonala kész (`POST /api/providers/:providerId/connection-test`), a web nem hívja                                                                                                                                                              | `packages/protocol/src/http-route/route-table.ts:62-65`; `apps/server/src/provider-endpoint/test-provider-connection.ts:17-30`                                                                                               |
| A kapcsolat teszt két `mode` értéke (`sdk_model_list`, `minimal_query`) ugyanazt a minimális `query()` hívást futtatja; a komment szerint "nem elfogadott végállapot"                                                                                             | `packages/engine/src/engine-port/create-engine.ts:170-206`; `packages/engine/src/capability-policy/resolve-connection-test-mode.ts:23-27`; `packages/protocol/src/provider/connection-test-response.ts`                      |
| A párhuzamossági korlát három útvonala kész, a web nem hívja; alapérték nincs, sor híján nincs korlát; a javaslat a leíró mért értéke                                                                                                                             | `route-table.ts:70-78`; `packages/db/src/provider-concurrency/provider-concurrency.ts:17-29`; `packages/engine/src/concurrency-gate/create-concurrency-gate.ts:78-82`; SPEC-003 11.                                          |
| A delta kapcsoló a futás indításakor befagy a `workflow_run.persisted_stream_deltas` oszlopba                                                                                                                                                                     | `packages/db/src/workflow-run/workflow-run.ts:51`; `.claude/CLAUDE.md` 10. szekció 3. pont                                                                                                                                   |
| A `skills` mező (`readonly string[] \| 'all' \| null`) és az `mcpServers` mező (`Record<string, StorableMcpServer>`) a szerkesztőben csak olvasható                                                                                                               | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:71-72`; `apps/web/src/node-inspector/AgentStepConfigFields.tsx:21, 280-291`; `apps/web/src/node-inspector/agent-definition-field-table.ts:35, 92-102` |
| A `StorableMcpServer` három ága: `stdio {command, args, envNames}`, `sse {url, authEnvName}`, `http {url, authEnvName}`; értéket soha nem tárol; a `stdio` ágon az `envNames` az átadandó változók neve, a név a szerver környezetében és az alfolyamatban azonos | `packages/db/src/workflow-graph/agent-step-config/storable-mcp-server.ts`; `packages/protocol/src/node-config/storable-mcp-server.ts`                                                                                        |
| A motor a `skills` mezőt átadja, az `mcpServers` mezőt kihagyja ("a mező bekötése a SPEC-009 hatóköre (SPEC-011 3.2)")                                                                                                                                            | `packages/engine/src/agent-step/build-agent-step-options.ts:67-71, 91`; `packages/engine/CLAUDE.md:432`                                                                                                                      |
| A motor `settingSources`, `strictMcpConfig` és `plugins` opciót nem ad át                                                                                                                                                                                         | `packages/engine/src/agent-step/agent-step-options.ts:32-` (a típusban nincs ilyen mező)                                                                                                                                     |
| A kimenő `Options.env` kizárólag a provider `requiredEnv[]` blokkja; a `claude-subscription` providernek nincs kötelező env változója, a tiltott változója az `ANTHROPIC_BASE_URL`                                                                                | `packages/engine/src/provider-environment/build-provider-environment-block.ts:19-43`; `packages/provider-claude-subscription/src/environment/required-environment.ts`, `disallowed-environment.ts`                           |
| A greppes invariáns (9) tiltja a `skill-upload` és az `mcp-server-config` téma mappát az `apps/web/src` alatt                                                                                                                                                     | `apps/web/src/greppable-invariants/greppable-invariants.spec.ts:277, 299-303`; SPEC-008 54. kritérium (`:1521`)                                                                                                              |
| A szerver kérés törzs olvasója korlát nélkül gyűjti a törzset és JSON-ként értelmezi                                                                                                                                                                              | `apps/server/src/http-server/read-json-request-body.ts`                                                                                                                                                                      |
| Skill vagy MCP szerver tábla nincs a DB-ben                                                                                                                                                                                                                       | `packages/db/src` téma mappái (app-setting, provider-concurrency, human-approval, run-event, step-run, workflow-graph, workflow-run, graph-snapshot)                                                                         |
| Az `apps/server` csomagnak nincs `dev` vagy `start` scriptje                                                                                                                                                                                                      | `apps/server/package.json` `scripts`: csak `typecheck` és `lint`                                                                                                                                                             |

### 2.2 Az Agent SDK (pinelt verzió: `@anthropic-ai/claude-agent-sdk` `0.3.245`)

A verzió forrása: `docs/research/2026-08-26-toolchain.md:10` és a telepített csomag `package.json:3`.
A d.ts útvonala: `node_modules/.bun/@anthropic-ai+claude-agent-sdk@0.3.245+7b719043580c7622/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`
(rövidítve `sdk.d.ts`). Elsődleges doksi: az Agent SDK TypeScript referencia
(<https://code.claude.com/docs/en/agent-sdk/typescript>), a Skills oldal
(<https://code.claude.com/docs/en/agent-sdk/skills>), az MCP oldal
(<https://code.claude.com/docs/en/agent-sdk/mcp>), a Plugins oldal
(<https://code.claude.com/docs/en/agent-sdk/plugins>) és a "Use Claude Code features in the SDK" oldal
(<https://code.claude.com/docs/en/agent-sdk/claude-code-features>). A doksi a legfrissebb SDK verziót
írja le, nem a pinelt `0.3.245`-öt; a mérvadó a telepített d.ts, a doksi a megerősítés.

| Tény                                                                                                                                                                                                                                                                                                                                                                                                         | d.ts                                     | Megerősítés                                                                                                                                                            | Állapot                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `mcpServers?: Record<string, McpServerConfig>`; az unió `McpStdioServerConfig \| McpSSEServerConfig \| McpHttpServerConfig \| McpSdkServerConfigWithInstance`                                                                                                                                                                                                                                                | `:1755`, `:1091`                         | TS referencia; anthropics/claude-agent-sdk-typescript #247 (<https://github.com/anthropics/claude-agent-sdk-typescript/issues/247>)                                    | ellenőrzött                                                   |
| stdio: `type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string>`; sse: `type: 'sse'; url; headers?`; http: `type: 'http'; url; headers?`                                                                                                                                                                                                                                              | `:1190-1194`, `:1173-1177`, `:1058-1062` | TS referencia; ugyanaz az issue                                                                                                                                        | ellenőrzött                                                   |
| Az MCP eszköz neve `mcp__<szerver>__<eszköz>`; a szerver nevében a `.` és a szóköz `_`-re cserélődik                                                                                                                                                                                                                                                                                                         | `:3805`, `:3224`                         | MCP oldal ("Tool naming convention")                                                                                                                                   | egy hivatalos forrás; a teljes karakterhalmaz nem ellenőrzött |
| `strictMcpConfig?: boolean`: csak az `mcpServers` szerverei, a `.mcp.json`, a user beállítás és a plugin szerverei nélkül; a claude.ai fiókhoz kötött MCP connectorokat is letiltja, amiket a `settingSources: []` nem                                                                                                                                                                                       | `:2058-2063`                             | TS referencia Options tábla; `claude-code-features` oldal ("claude.ai MCP connectors"); anthropics/claude-agent-sdk-python #853                                        | ellenőrzött                                                   |
| `settingSources?: ('user' \| 'project' \| 'local')[]`; kihagyva **mindhárom** betöltődik; `[]` az izolációs mód; a `CLAUDE.md` betöltéséhez `'project'` kell; a skillek a `user` és `project` forrásból jönnek                                                                                                                                                                                               | `:2004-2014`, `:7817`                    | TS referencia; `claude-code-features`; Skills oldal ("Skills not loaded: settingSources excludes user and project")                                                    | ellenőrzött, a d.ts mérvadó                                   |
| A `settingSources` **nem vezérli** a managed policy beállítást, a `~/.claude.json` konfigot, az auto memory-t, a claude.ai MCP connectorokat és a `sandbox.credentials` bejegyzéseket                                                                                                                                                                                                                        |                                          | `claude-code-features` ("What settingSources does not control")                                                                                                        | egy hivatalos forrás                                          |
| `skills?: string[] \| 'all'`; kihagyva "not skills off", a CLI alapértelmezése érvényes; a lista a saját skillnél a **könyvtárnév**, plugin skillnél `plugin:skill`; "context filter, not a sandbox"; a `Skill` eszközt nem kell az `allowedTools`-ba tenni; érvénytelen név (üres, zárójel, vessző, vezérlő karakter, szóközzel kiegészített, joker) esetén a `query()` a folyamat indítása előtt hibát dob | `:2015-2037`                             | Skills oldal; a GitHub CHANGELOG 0.2.120 ("Added `skills` option") (<https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md>)                | ellenőrzött                                                   |
| Skillt programból regisztrálni nem lehet, csak fájlrendszerről: "The SDK doesn't provide a programmatic API for registering them"                                                                                                                                                                                                                                                                            | (nincs ilyen opció a d.ts-ben)           | Skills oldal; <https://code.claude.com/docs/en/agent-sdk/claude-code-features>                                                                                         | részben ellenőrzött                                           |
| `plugins?: { type: 'local'; path: string }[]`; a plugin skillt, agentet, hookot, MCP szervert hozhat; a plugin skill neve `<plugin>:<skill>`; a `skills/<név>/SKILL.md` könyvtár elrendezés; a `.claude-plugin/plugin.json` manifeszt elhagyható                                                                                                                                                             | `:1800-1818`, `:4533-4546`               | Plugins oldal ("Plugin structure reference"); Skills oldal ("or use the `plugins` option to load skills from a specific path")                                         | egy hivatalos forrás; az M-136 méri                           |
| Plugin skillnél a frontmatter `name` az utolsó parancs szakaszt cseréli (`/my-plugin:fancy`)                                                                                                                                                                                                                                                                                                                 |                                          | <https://code.claude.com/docs/en/skills> ("How a skill gets its command name")                                                                                         | egy hivatalos forrás                                          |
| A `SKILL.md` `name` mezője: 1-64 karakter, kisbetű, szám, kötőjel, nem kezdődik/végződik kötőjellel, nincs `--`, **egyezik a szülő könyvtár nevével**; a `description` kötelező, 1-1024 karakter; tiltott szavak a névben: "anthropic", "claude"                                                                                                                                                             |                                          | <https://agentskills.io/specification>; <https://claude.com/docs/skills/how-to>; <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>          | ellenőrzött (három forrás)                                    |
| `env` megadva **teljesen lecseréli** az alfolyamat környezetét, nem olvad össze a `process.env`-vel; kihagyva örököl                                                                                                                                                                                                                                                                                         | `:1478-1498`                             | TS referencia Options `env` sora; `sdk.mjs` `Cn=ne?{...ne}:{...process.env}`; CHANGELOG 0.2.113 és 0.3.149                                                             | ellenőrzött (három forrás)                                    |
| A hitelesítési precedencia: felhő provider változók, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `apiKeyHelper`, `CLAUDE_CODE_OAUTH_TOKEN`, profil/föderáció, a `/login` előfizetéses OAuth (utolsó); az `apiKeyHelper` beállításból jön, a `/login` hitelesítő adata Keychainben vagy `~/.claude/.credentials.json` fájlban (`CLAUDE_CONFIG_DIR` alatt) áll                                                |                                          | <https://code.claude.com/docs/en/authentication>                                                                                                                       | egy hivatalos forrás                                          |
| `additionalDirectories?: string[]`; a doksi szerint `--add-dir`-ként megy, és `'project'` forrással az ottani `.claude/skills/` is betöltődik                                                                                                                                                                                                                                                                | `:1379`                                  | Skills oldal                                                                                                                                                           | egy hivatalos forrás                                          |
| `Query.supportedModels(): Promise<ModelInfo[]>` és `Query.mcpServerStatus(): Promise<McpServerStatus[]>` élő `Query` objektumon                                                                                                                                                                                                                                                                              | `:2528`, `:2540`, `:1098-1139`           | a TS referencia Query szekcióját nem láttuk                                                                                                                            | nem ellenőrzött (doksi)                                       |
| A `node:zlib` ZIP API (`ZipFile`, `ZipEntry`, `ZipBuffer`) a Node 26.8.0-ban jelent meg, kísérleti (Stability 1.0); a rögzített Node `26.7.0`                                                                                                                                                                                                                                                                |                                          | <https://nodejs.org/api/zlib.html>; <https://nodejs.org/en/blog/release/v26.8.0>; <https://github.com/nodejs/node/pull/64339>; `docs/research/2026-08-26-toolchain.md` | ellenőrzött (három forrás)                                    |

### 2.3 Amit ezekből NEM következtetünk

- Hogy a plugin út skillje `settingSources: []` mellett az `init` `skills` tömbjében megjelenik, és hogy
  a `skills` listába melyik név kerül (könyvtárnév vagy frontmatter `name`) eltérésük esetén, és hogy a
  `skills` elhagyásakor a plugin skillek elérhetők-e a modellnek: **nem ellenőrzött**, az M-136 méri.
- Hogy a stdio MCP szerver alfolyamata a CLI környezetét (`PATH`, `HOME`) örökli-e a saját `env`
  mezője mellé: **nem ellenőrzött** (M-139).
- Hogy az MCP szerver nevében melyik karakter cserélődik `_`-re a `.` és a szóköz mellett: **nem
  ellenőrzött**; ezért a mentési szabály szűk (6.1).
- Hogy a `settingSources: []` mellett az előfizetéses bejelentkezés él: a hivatalos doksi szó szerint nem
  mondja ki; a forrás kép a 7.1 szekcióban áll, a korlátozott megerősítés miatt az O-38 kérdés.

---

## 3. A Beállítások képernyő

### 3.1 Elrendezés

A képernyő a meglévő `settings-screen` téma bővítése (SPEC-008 5.11: "bővíti, nem cseréli le"). A
tagolás: **kártyák egymás alatt egy oldalon** (O-8), oldalsó navigáció nincs, mert az a design systemben
csak page-local CSS. A design system mintája az `eggproject-design-admin-app-examples` `settings.html`
oldala (`card` szekció, `card__header`, `card__body`, `card__footer` mentés sávval, `preference-row`
sor). A minta `.layout` szabálya `max-width: 1080px`, ami ütközik a "faltól falig" szabállyal
(`.claude/CLAUDE.md` 11. szekció); a teljes szélességhez ez a page-local szabály nem kerül át. Kártya
a kártyában nincs (`.claude/CLAUDE.md` 11. szekció): a kártyán belüli tagolás `accordion` vagy doboz
nélküli, megnevezett csoport. A kártyák sorrendje:

1. **Provider**: a globális alapértelmezett provider (`SelectField`), alatta a kiválasztott provider
   kötelező env változóinak **neve** (a SPEC-007 `:682` mintája), mellette a "Kapcsolat teszt" gomb.
   A választóban **nincs "nincs" opció**: az alapértelmezés csak átállítható, nem törölhető (O-4).
   Ha még nincs alapértelmezés (első indulás), `warning` `Alert` mondja ki, hogy agent lépés így nem
   indul; a `no_default_provider` hibamondat (SPEC-007 8.4) erre a képernyőre mutat (O-5, SPEC-003 4.13:
   "a felület az első indulásnál kéri be a választást"). Kötelező első indulási modális nincs.
2. **Párhuzamossági korlát**: providerenként egy sor: a beállított érték vagy a "nincs beállított
   párhuzamossági korlát" szöveg (SPEC-003 11.), a leíró javaslata a megjegyzésével, egy szám mező,
   és **soronként külön "Mentés" és "Korlát törlése" gomb** (O-6). **Alapérték nincs**, a mező üresen
   indul (`.claude/CLAUDE.md` 4. szekció 1. pont).
3. **Futás napló**: a delta perzisztálás kapcsoló (`persistStreamDeltas`), a design system `Switch`
   komponensével (O-7), alapból kikapcsolva (SPEC-003 6.6), a "csak az ezután indított futásokra hat"
   mondattal, mert az érték a futás indításakor befagy (`.claude/CLAUDE.md` 10. szekció 3. pont).
4. **Skill könyvtár** (5. szekció).
5. **Gráf szerkesztő**: a visszavonás módosító választó, változatlan (SPEC-008 O-31, O-32).

Minden hálózati műveletnek látható várakozás jelzése van (`Button` `isLoading`, `Skeleton` a
betöltéskor; `.claude/CLAUDE.md` 11. szekció). A REST hiba a `danger` `Alert` blokkban jelenik meg, a
hibakódhoz és az ismert hibaosztályhoz rendelt magyar mondattal (SPEC-007 8.4). A gombok `sm`
méretűek, modálison kívül.

### 3.2 A provider választó és a "Kapcsolat teszt" (O-2)

A "Kapcsolat teszt" gomb a provider választó komponens része, tehát **mindenhol megjelenik, ahol a
választó**: a Beállítások képernyőn, a workflow létrehozó és a "Workflow szerkesztése" modálison, és a
lépés felülírás mezőjében. Ahol a választó értéke "örökölt" (nincs explicit provider), a gomb **tiltott**,
és a tiltás oka látszik. A gomb a kiválasztott provider azonosítóval hívja a `POST /api/providers/:id/connection-test`
útvonalat, siker és hiba esetén a design system jelzésével felel, várakozás közben `isLoading`.
A kapcsolat teszt válaszából a `mode` mező megszűnik (O-1): a `ConnectionTestModeSchema`, a motor
`resolve-connection-test-mode.ts` és `connection-test-mode.ts` fájlja törlődik, a `testProviderConnection`
egyetlen úton fut, a "nem elfogadott végállapot" komment és a `packages/engine/CLAUDE.md` ide vonatkozó
szakasza átíródik. Valódi `supportedModels()` ág nincs, ezért az M-140 mérés kikerült.

### 3.3 A workflow szintű provider utólagos módosítása (O-3)

A meglévő átnevezés modális "Workflow szerkesztése" modálissá bővül: név, leírás és provider (a
provider választóval, a "Kapcsolat teszt" gombbal). A `PATCH /api/workflows/:id` törzse a `providerId`
mezőt is hordozza, `null` értékkel is (az "örökölt" választás). A létrehozó modális mintáját követi.

### 3.4 A design system elemei

| Elem                                     | Design system (`eggproject-design-components`)              | `packages/ui` ma                        | Teendő                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| szekció kártya, preference sor           | `settings.html` page-local `.card`, `.preference-row`       | `apps/web` `settings-screen` (T-009-59) | marad                                                                                          |
| választó                                 | `select` (React `Select`)                                   | `select-field/SelectField.tsx`          | marad                                                                                          |
| szám és szöveg mező                      | `input` (`.input`, `.field`)                                | `text-field/TextField.tsx`              | marad (`type="number"`)                                                                        |
| kapcsoló                                 | `form-controls` `.ctrl__switch`                             | **nincs** (csak `Checkbox`)             | **átemelés `Switch` komponensként** (O-7)                                                      |
| gomb, betöltés állapot                   | `button` (`.btn--sm`, `.btn__loader`)                       | `button/Button.tsx` (`isLoading`)       | marad                                                                                          |
| állapot jelvény, figyelmeztetés          | `badge`, `alert`                                            | `badge/`, `alert/`                      | marad                                                                                          |
| értesítés                                | `toast`                                                     | `toast/`                                | marad                                                                                          |
| szerkesztő dialógus, megerősítő dialógus | `modal`                                                     | `modal/Modal.tsx`                       | marad; a megerősítő ablak is a meglévő `Modal` (O-16, T-009-52 precedens)                      |
| fájl feltöltés                           | `file-upload` (`.dropzone`, `.dropzone-file`)               | **nincs**                               | **átemelés** (O-15)                                                                            |
| egyértékű lista (args, változó nevek)    | `tag-input` (`.tagi`)                                       | **nincs**                               | **átemelés** (O-19)                                                                            |
| üres lista                               | `empty` (`.empty`)                                          | **nincs**                               | **átemelés** (O-15)                                                                            |
| jelölőnégyzet lista                      | `checkbox`                                                  | `checkbox/Checkbox.tsx`                 | marad (a skill lista, O-14)                                                                    |
| kulcs-érték sor szerkesztő               | **nincs a design systemben**                                | nincs                                   | nem kell, mert a tárolt alak csak nevet hordoz (6.1); a hozzárendelés sora két választóból áll |
| oldalsó beállítás navigáció              | **nincs a design systemben** (csak page-local CSS)          | nincs                                   | nem kerül be (O-8)                                                                             |
| általános kis kör spinner                | **nincs a design systemben** (csak a `.spin*` logó spinner) | nincs                                   | nem kell, a `Button` `isLoading` elég                                                          |

Az átemelések bájtazonos CSS-sel készülnek (SPEC-007 precedens). Forrás: az
`eggproject-design-components` skill `components/<név>/` mappái és az
`eggproject-design-admin-app-examples` `examples/settings.html`, 2026-10-26-án betöltve; a
`packages/ui/src` téma mappái a `main` fején.

---

## 4. Blokkoló mérések

A mérések a PLAN-012 F0 fázisában futnak, **amíg nem zöldek, az érintett termékkód nem íródik**.
Mindegyik a pinelt SDK-val, eldobható munkakönyvtárban; a nyers kimenet a `docs/research/` alá kerül
(`.claude/CLAUDE.md` 4. szekció 3. pont). Valódi API hívás nincs: helyi csonk végponttal
(`ANTHROPIC_BASE_URL` egy helyi szerverre, a `tools/wire-probe` mintájára).

| #     | Kérdés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Valódi API        | Mi dől el belőle      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------- |
| M-136 | A `plugins: [{ type: 'local', path }]` úton egy `skills/<név>/SKILL.md` alakú könyvtár skillje megjelenik-e az `init` üzenet `skills` tömbjében `<plugin>:<név>` alakban, `settingSources: []` mellett is, és a `skills: ['<plugin>:<név>']` lista elfogadott-e. **Három eset:** (1) a frontmatter `name` egyezik a könyvtárnévvel; (2) a frontmatter `name` **eltér** a könyvtárnévtől: az `init` és a `skills` lista melyik nevet fogadja; (3) a `skills` opció **elhagyva**, de a `plugins` megadva: elérhető-e a skill a modellnek; plusz a `.claude-plugin/plugin.json` nélküli plugin neve | nem (helyi csonk) | O-10, O-37, O-40, 5.3 |
| M-139 | Egy helyi stdio és egy helyi http MCP csonk szerver az `mcpServers` úton `connected` állapotú-e az `init` üzenetben, és a stdio alfolyamat milyen környezetet kap (megkapja-e a `PATH` és a `HOME` változót a saját `env` mezője mellé)                                                                                                                                                                                                                                                                                                                                                          | nem (helyi csonk) | 6.4, O-18             |

**Kikerült mérések (user döntés 2026-10-26):**

- **M-137** (a mai `Options.env` hatása): kikerült, mert a hivatalos doksi, a telepített d.ts és a
  futásidejű kód leírja (2.2 szekció), és a javítás a külön specben van (7.2).
- **M-138** (a `claude-subscription` hitelesítés izolációs módban): a 7.1 szekció forrásai alapján
  eldönthető, ezért kikerült; a döntés megerősítése az O-38 kérdés. Ha a user mégis mérést kér, a
  valódi hívás jóváhagyása (O-22) az első, külön spec valódi próbájában adható meg.
- **M-140** (a kapcsolat teszt `supportedModels()` ága): kikerült, mert az O-1 válasza a `mode` törlése.

---

## 5. A skill könyvtár

### 5.1 A döntött alak

- **Tárolás:** a szerver egy kezelt könyvtárában, a fájlrendszeren (O-9), mert az SDK skillt csak
  fájlrendszerről tölt (2.2). A könyvtár útvonala kötelező szerver konfiguráció, alapérték nélkül (egy
  új env változó, a neve a PLAN-012-ben rögzül; a `EASTER_*` névminta, SPEC-006 4. szekció). A könyvtár
  egy plugin gyökér: `<gyökér>/skills/<név>/SKILL.md`.
- **Betöltés:** a motor `plugins: [{ type: 'local', path: <gyökér> }]` opciót ad az agent lépésnek
  (O-10), mert ez a `settingSources` értékétől független út (Skills oldal: "or use the `plugins` option to
  load skills from a specific path"); az M-136 igazolja. Hogy a `plugins` mikor kerül az `Options`-ba, az
  O-40 kérdése.
- **Feltöltés:** egyetlen **ZIP csomag** (O-11), a skill neve a **feltöltéskor megadott név** (O-12); az
  egyetlen `SKILL.md` önálló feltöltése nincs, azt a felhasználó becsomagolja. Azonos nevű skill
  feltöltése felülírja a régit, megerősítéssel (`Modal`, O-16). A kicsomagolás követelményei az 5.4
  szekcióban.
- **REST:** három új útvonal a `packages/protocol` route táblájában: a skillek listája (név, leírás a
  frontmatterből, méret, módosítás ideje), egy skill feltöltése és egy skill törlése. A feltöltés
  átviteli alakja az O-36 kérdése. A sémák a `protocol` négy írási szabálya szerint (`z.strictObject`,
  nincs `.default()` és `.transform()`, `.readonly()` kimenet, `.safeParse()`; `.claude/CLAUDE.md` 5.
  szekció).
- **Törlés hivatkozott skillre:** a törlés **megengedett** (O-13), a futás indítása a hiányzó skillre
  megnevezett új indítási hibát ad, `skill_not_found` hibaosztállyal és saját magyar mondattal. A motor a
  skill könyvtár tartalmát egy **új porton** át kapja (a skillek nevei és a gyökér útvonal; az
  `apps/server` adja), mert a motor portjain kívül nem érhet a fájlrendszerhez. A hibaosztály a
  `ProtocolErrorClass` zárt szótárát bővíti, az `error-class-drift-protection` szerint (`.claude/CLAUDE.md` 5. szekció).
- **Titok:** a skill fájl nem tartalmazhat titkot (d.ts `:2030-2032`: "Do not store secrets in skill
  files"); a feltöltés felülete ezt kimondja. Gépi ellenőrzés nincs rá, mert tartalom alapú
  titokfelismerésre nincs forrásunk.
- **Kimondott kockázat:** a skill csomag futtatható fájlokat (scripteket) is hordozhat, amiket az agent
  az eszközeivel futtathat; a skill "context filter, not a sandbox" (d.ts `:2028`). A feltöltés a szerver
  gép felhasználójának jogosultságával fut, ezért a felület ezt kimondja, a szerver pedig `127.0.0.1`-re
  köt (`apps/server` `http-server` téma).

### 5.2 A lépés `skills` mezője a szerkesztőben (O-14)

A mező három állapota a tárolt alak szerint (`agent-step-config.ts:71`): `null` (nincs beállítva), `'all'`
(minden feltöltött skill) és a lista (a könyvtár skilljeiből választva). A szerkesztő egy `SelectField`
módválasztóval (nincs beállítva / minden / lista) és a könyvtár skilljeinek `Checkbox` listájával
dolgozik; üres könyvtárnál az átemelt `empty` elem mutatja az üres állapotot. Az agent definíción belüli
`skills` (SPEC-008 `:413-415`, 60. kritérium) ugyanígy szerkeszthetővé válik. A `null` jelentése a
plugin úton az O-40 kérdése.

### 5.3 A lista elemeinek alakja

Ha a betöltés plugin úton megy (O-10), az SDK a skillt `<plugin>:<név>` néven ismeri (Plugins oldal). A
tárolt lista elemei ezért vagy a teljes `<plugin>:<név>` alakot tárolják, vagy a puszta nevet, és a motor
fűzi elé a plugin nevét. Javaslat: a puszta név a tárolt alak, a motor fűzi elé, mert a plugin neve
szerver oldali részlet; ezt az M-136 eredménye erősíti meg vagy veti el. A tárolt név a **feltöltéskor
megadott név** (a könyvtárnév), ami a `skills` lista dokumentált "saját skill" alakja is.

### 5.4 A ZIP csomag kicsomagolásának követelményei (O-11)

A követelmények a **kicsomagoló kódra** és a szerver végpontjára szólnak, függetlenül a zip kezelő
könyvtártól (O-33). Mindegyik elutasítás az egész feltöltést utasítja el (nem hagy ki csendben
bejegyzést), megnevezett hibával, és semmi nem marad a skill könyvtárban.

1. **Bejegyzés típus.** Csak könyvtár és szabályos fájl fogadható el. Szimbolikus link, eszköz fájl,
   FIFO és bármi más típus elutasítva. A típus a zip bejegyzés metaadatából (Unix mód) olvasott; a
   pontos mező és bitkiosztás a PLAN-012 F0-ban a választott könyvtár dokumentációjából kerül ki.
2. **Útvonal.** A bejegyzés neve nem lehet abszolút (`/` vagy meghajtó jel kezdet), nem tartalmazhat `..`
   szegmenst, visszaper (`\`) jelet és NUL bájtot. A kicsomagolás célja a feloldott abszolút útvonal
   alapján a cél könyvtáron belül marad (a fenti névszabály mellett ez a második védvonal). Ha
   a választott könyvtár beépített fájlnév ellenőrzést ad (például a `yauzl` `validateFileName` függvénye), az sem váltja ki a saját
   ellenőrzést.
3. **Ütközés.** Két azonos útvonalú bejegyzés, és két, csak kis-nagybetűben eltérő útvonalú bejegyzés
   elutasítva (a kis-nagybetűt nem érzékeny fájlrendszeren, pl. macOS-en, az egyik felülírná a másikat;
   a fejlesztői gép macOS, `.claude/CLAUDE.md` 12. szekció).
4. **`SKILL.md`.** Pontosan egy `SKILL.md` kötelező a skill gyökerében (a csomag belső elrendezése az
   O-35 kérdése). Hiánya, több példánya, olvashatatlan YAML frontmatter, üres `description` vagy a
   `description` 1024 karakter fölött: elutasítás (az Agent Skills specifikáció és a platform doksi
   szerint a `description` kötelező, nem üres, legfeljebb 1024 karakter, 2.2).
5. **Név.** A feltöltéskor megadott név szabálya a dokumentált `name` szabály (2.2): 1-64 karakter,
   kisbetű, szám és kötőjel, nem kezdődik vagy végződik kötőjellel, nincs `--`, nem tartalmazza az
   "anthropic" és "claude" szót. A frontmatter `name` eltérésének kezelése az O-37 kérdése.
6. **Méret.** A bejegyzés deklarált és tényleges kicsomagolt mérete egyezzen (zip bomba és hazudó
   fejléc ellen); a kicsomagolás közben számolt összes bájt és a fájlszám korlátozott. **A korlátok
   számát nem adjuk meg**: a Claude Code és az Agent SDK doksija nem ad ilyen számot (research 5.7), a
   kérdés az O-34.
7. **Titkosított bejegyzés és nem támogatott tömörítési módszer** elutasítva.
8. **Mód.** A zip Unix mód bitjei nem érvényesülnek: a fájlokat a szerver az alapértelmezett
   jogosultsággal hozza létre.
9. **Atomi csere.** A kicsomagolás egy ideiglenes könyvtárba megy, az ellenőrzések után kerül a végleges
   helyre, felülíráskor a régi skill teljes cseréjével; hiba esetén a régi skill érintetlen, és nem marad
   félig kicsomagolt könyvtár.
10. **Törlés.** A skill törlése a skill könyvtárát teljesen eltávolítja; a név nem tartalmazhat útvonal
    elemet (a 5. pont szabálya miatt a törlő végpont sem léphet ki a gyökérből).

Az új hibaosztályok a feltöltés hibáihoz az O-41 kérdése.

---

## 6. Az MCP szerver konfiguráció

### 6.1 A tárolt alak és a név hozzárendelés (O-17, O-18)

**A fogalmak** (user döntés 2026-10-26, "Név hozzárendelés felülírással"; példa: három GitHub fiók):

- **Deklarált változó név:** az MCP szerver deklarálja, milyen környezeti változókat vár a folyamata
  (például `GITHUB_TOKEN`).
- **Szerver oldali változó név:** a Node szerver környezetének egy változójának **neve** (például
  `GITHUB_TOKEN_CEG`, `GITHUB_TOKEN_SAJAT`), aminek az értéke a deklarált változóba kerül.
- **Hozzárendelés:** a felületen az MCP szerver egyes deklarált változóihoz azt választod ki, melyik
  szerver oldali változó NÉV kerüljön bele. A hozzárendelés **felülírható ott, ahol az MCP szervert
  használjuk** (a lépésben). Így ugyanaz az MCP szerver definíció három fiókkal, három lépés három
  hozzárendelésével használható.

A titok szabály változatlan: a DB és a git csak **nevet** tárol, értéket soha; a hozzárendelés is csak
két nevet köt össze.

**A tárolt alak változása** (a `db` `StorableMcpServer` és a `protocol` párja):

| Ág            | Ma                                                                                                                            | Új                                                                                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stdio`       | `{ type, command, args, envNames }`; az `envNames` az átadandó változók neve, azonos névvel a szerver környezetében           | `{ type, command, args, envNames, envBindings }`; az `envNames` a **deklarált** nevek listája (a meglévő mező, jelentése pontosodik); az `envBindings` új, `Readonly<Record<string, string>>`: deklarált név -> szerver oldali név. Hiányzó bejegyzés = azonos név (a mai viselkedés) |
| `sse`, `http` | `{ type, url, authEnvName }`; az `authEnvName` az `Authorization` fejléc értékét adó szerver oldali változó neve, vagy `null` | változatlan alak; az `Authorization` fejléc az egyetlen deklarált hely, a hozzárendelése az `authEnvName` maga, a felülírás az `authEnvName` felülírása                                                                                                                               |

**Visszafelé olvashatóság (kötelező).** Egy régi gráf és egy régi pillanatkép (`envBindings` nélkül) változatlanul
olvasható marad (`.claude/CLAUDE.md` 10. szekció 2. pont: a pillanatkép megváltoztathatatlan), és az
`envBindings` hiánya az olvasó oldalon nem hiba. A mentési séma és a `db` `isNodeConfig` guard
szerkezeti követelménye ebből következik; a pontos mező opcionalitás a PLAN-012 dolga, az
`apps/server` `node-config-drift-protection` témája szerint (a `protocol` és a `db` oldal kölcsönös
értékadhatósága, `.claude/CLAUDE.md` 5. szekció).

**A nevek szabálya.** A szerver oldali és a deklarált név környezeti változó név alakú (a pontos
mintát a PLAN-012 a meglévő `ENV_*` nevek és a `requiredEnv[]` szabály alapján rögzíti, szám és minta
kitalálása nélkül). Az MCP szerver **neve** (a `mcpServers` kulcsa) az eszköznév előtagja
(`mcp__<szerver>__<eszköz>`), és az SDK a `.` és a szóköz jelet `_`-re cseréli (2.2); mivel a teljes
karakterhalmaz nem ellenőrzött, a mentési szabály szűk: a név kizárólag ASCII betűből, számból, `_` és
`-` jelből áll, ami a cserét kizárja, és két különböző név sem ütközhet cserével.

### 6.2 A szerkesztés helye

Az O-17 válasza: **lépésenként, a meglévő `mcpServers` mezőn**. Az O-18 új iránya ("a felületen
megadható, és ott felülírható, ahol használjuk") ezzel **feszültségben áll**: ha a szerver definíciója is
a lépésben áll, nincs mit felülírni. A feszültség feloldása az **O-31** kérdés (központi definíció a
Beállításokon alapértelmezett hozzárendeléssel és lépés szintű felülírással, vagy lépésenkénti definíció
a hozzárendeléssel együtt). A 6.1 tárolt alak és a 6.4 leképezés mindkét válasz mellett érvényes; az O-31
csak azt dönti el, **hol áll** a definíció és az alapértelmezett hozzárendelés, és **hol áll** a
felülírás. Addig a mai állapot érvényes: a lépés mezője szerkeszthetetlen.

A szerkesztő szerverenként egy sort mutat (név, típus, `command` és `args`, vagy `url`, és a deklarált
változók a hozzárendelésükkel); a hozzáadás és a szerkesztés `Modal`-ban, a törlés megerősítéssel. Az
`args` és a deklarált változó nevek egyértékű lista (`tag-input`, O-19). A hozzárendelés egy deklarált
változónként egy sor: a deklarált név és a szerver oldali név kiválasztása (O-32).

A greppes invariáns (9) a `skill-upload` és az `mcp-server-config` téma mappát tiltja; a tiltás
feloldódik (8. szekció), a téma mappák nevei ezek maradnak.

### 6.3 A bekötés helye

**Technikai döntés, nem termékkérdés:** a bekötés a **motorban** történik, a
`build-agent-step-options.ts` témájában, a meglévő `processEnvironment` porton át. A `StorableMcpServer`
feloldásához csak env olvasás kell, ami a motor portja már ma (`build-provider-environment-block.ts`).
Ezzel a hiányleltár H-26 ellentmondása zárul: a SPEC-011 a komment `agentTools` felét törölte, és az
`mcpServers` felének gazdájaként a SPEC-009-et nevezte meg; a bekötés helye a motor, ezért a
`build-agent-step-options.ts:67-71` komment és a `packages/engine/CLAUDE.md:432` szakasz a megvalósult
állapotra íródik át.

### 6.4 A leképezés

| Tárolt ág                                      | SDK alak                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stdio {command, args, envNames, envBindings}` | `{ type: 'stdio', command, args, env: { <deklarált név>: <érték> ... } }`, ahol az érték a `processEnvironment` port olvasása a **feloldott szerver oldali néven** |
| `sse {url, authEnvName}`                       | `{ type: 'sse', url, headers: { Authorization: <érték> } }`, `null` névnél fejléc nélkül                                                                           |
| `http {url, authEnvName}`                      | `{ type: 'http', url, headers: { Authorization: <érték> } }`, `null` névnél fejléc nélkül                                                                          |

**A szerver oldali név feloldása** deklarált változónként, sorrendben: (1) a lépés hozzárendelése (a
felülírás, O-31 szerinti helyen); (2) az MCP szerver definíciójának alapértelmezett hozzárendelése
(O-31 szerint); (3) a deklarált név maga (a mai viselkedés). Az `authEnvName` értéke a teljes
`Authorization` fejléc érték (a `storable-mcp-server.ts` dokumentációja szerint), előtag nélkül.

**Hiányzó szerver oldali változó.** Ha a feloldott szerver oldali név a `processEnvironment` porton
`null`-t ad, a futás indítása **megnevezett hibával** bukik: új `missing_mcp_server_env` hibaosztály,
saját magyar mondattal (a felhasználó a lépést vagy a hozzárendelést javítja, nem a providert), amely
megnevezi az MCP szervert, a deklarált nevet és a **szerver oldali nevet**, értéket soha (a
`missing_provider_env` mintája, `resolve-required-environment-value.ts`). Az érték nem kerül sem a
pillanatképbe, sem a `run_event` táblába, sem a naplóba. A hibaosztály a `ProtocolErrorClass` zárt
szótárát bővíti, a sodródás védelemmel (motor oldali osztály, tehát a meglévő részhalmaz szabály alá esik).

---

## 7. A futás izolációja és a kimenő környezet

### 7.1 `settingSources` és `strictMcpConfig` (O-20, H-41)

**Döntés (user döntés 2026-10-26):** minden agent lépés `settingSources: []` és `strictMcpConfig: true`
opcióval fut. A lépés így pontosan azt látja, amit a workflow beállít (plusz a skill könyvtár a plugin
úton, 5.1). Ma a motor egyiket sem adja át, ezért a d.ts `:2010` szerint a szerver gép
`~/.claude/settings.json`, a `cwd` alatti `.claude/` beállítás és `CLAUDE.md`, valamint minden ott
felfedezett skill és MCP szerver érvényesül a workflow-ban beállítottakon felül.

**Az M-138 feltétel forrásból vizsgálva** (research 1. szekció). Kérdés: a `settingSources` a hitelesítő
adatok (`~/.claude/.credentials.json`, macOS Keychain, `CLAUDE_CONFIG_DIR`) betöltését érinti-e, vagy csak a
beállítás fájlokat.

1. A `settingSources` a hivatalos doksi szerint a user, project és local **beállítás** forrásokat
   vezérli ("`settingSources` covers user, project, and local settings"; `configuration` oldal; d.ts
   `:2004-2014`).
2. A `/login` előfizetéses hitelesítés tárolója Keychain vagy `~/.claude/.credentials.json`
   (`CLAUDE_CONFIG_DIR` alatt), és a precedencia legalsó, 7. pontja; a beállításból jövő hitelesítés az
   `apiKeyHelper` és a `customApiKeyResponses` (authentication oldal).
3. A telepített `sdk.mjs` nem ad `--bare` kapcsolót, csak `--setting-sources=<lista>` és
   `--strict-mcp-config` megy ki; a hivatalos doksi a `--bare` módot nevezi meg, ami nem olvassa az OAuth
   hitelesítést és a kulcstartót (headless oldal).
4. Harmadik fél, kimondva: az `entireio/cli` `f457d27` commitja szerint az üres forráslista a beállításban
   tárolt hitelesítést (`apiKeyHelper`, `customApiKeyResponses`) viszi el, "Subscription and raw
   ANTHROPIC_API_KEY env-var users were unaffected either way"; az `anthropics/claude-agent-sdk-typescript`
   #392 issue a `.credentials.json` és a `settings.json` különálló voltát mutatja.

**Besorolás:** a döntés forrásból meghozható, ezért az M-138 mérés kikerül, **korlátozással**: a hivatalos
doksi szó szerint nem mondja ki, hogy az előfizetéses bejelentkezés `settingSources: []` mellett is él,
a kimondott mondat harmadik fél forrásban áll. A user megerősítése az **O-38** kérdés. Az O-22 (valódi
`claude-subscription` hívás) csak akkor kerül elő, ha a user az O-38-ra mérést kér, és akkor is az első,
külön spec valódi próbájában.

**Ami az izolációs módban is érvényes marad** (a `claude-code-features` oldal "What settingSources does
not control" táblája): a managed policy beállítás, a `~/.claude.json` konfig, az auto memory és a
`sandbox.credentials` bejegyzések. A claude.ai MCP connectorokat a `strictMcpConfig: true` zárja ki. Az
auto memory kikapcsolása az **O-39** kérdés.

### 7.2 A kimenő `Options.env` (O-21, H-40): külön spec, elsőként

**Tények** (2.2 szekció, research 2): a TS `options.env` az alfolyamat környezetét **teljesen lecseréli**,
nem olvad össze a `process.env`-vel (TS referencia, telepített `sdk.d.ts:1478-1498`, a futásidejű
`sdk.mjs` `Cn=ne?{...ne}:{...process.env}`, CHANGELOG 0.2.113 és 0.3.149); a doksi mintája `{ ...process.env, ... }`.
A hitelesítési precedencia szerint az `ANTHROPIC_API_KEY`, az `ANTHROPIC_AUTH_TOKEN` és a felettük álló
változók felülírják a `/login` (claude-subscription) bejelentkezést (authentication oldal).

**Döntés (user döntés 2026-10-26, "Teljes környezet, tiltott változók nélkül"):** a kimenő `env` = a szerver
`process.env`-je, **a provider tiltott változói (`disallowedEnv[]`) kiszűrve**, plusz a provider saját
változói (`requiredEnv[]`). A `claude-subscription` providernél a tiltott lista legalább a fenti
hitelesítés felülíró változókat tartalmazza (a pontos lista a külön spec dolga, az authentication oldal
precedenciája alapján). Az M-137 mérés ezért kikerült.

**Ez a mai kódban hiba:** a `claude-subscription` lépés üres blokkot küldene (`requiredEnv` üres), tehát
az alfolyamat `PATH` és `HOME` nélkül indulna. **A javítás helye a user döntése szerint egy külön, elsőként
végrehajtandó kis spec** ("helyi indítás, valódi próba és a kimenő környezet javítása", ideiglenes név),
amely a helyi indítási utat (H-42, O-29) és a javítást együtt kezeli, valódi próbával. A SPEC-009
**csak hivatkozik rá**: a PLAN-012 előfeltétele, hogy az bemergelve legyen, és a hiányleltár H-40 és
H-42 tételének gazdája az a spec.

---

## 8. A tiltás feloldása és az átvezetések

| Hely                                                                                             | Változás                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/greppable-invariants/greppable-invariants.spec.ts:277, 299-303`                    | az `outOfScopeThemeNames` halmaz és az állítása törlődik; a (9) címe a `@xyflow/react` szűkítésre rövidül                                                                                                                 |
| SPEC-008 54. kritérium (`:1521`)                                                                 | a tiltó mondat helyett: "a `skill-upload` és az `mcp-server-config` téma a SPEC-009 hatóköre, lásd ott"                                                                                                                   |
| SPEC-008 60. kritérium (`:1530`), 5.2 táblák (`:396-397`, `:413-415`)                            | a `skills` és az `mcpServers` "olvasható" helyett "szerkeszthető, SPEC-009 5.2 és 6.2"                                                                                                                                    |
| SPEC-008 `:36`, `:37`, `:423`, `:782`, `:790`                                                    | a "SPEC-009 hatóköre" mondatok a megvalósult állapotra hivatkoznak                                                                                                                                                        |
| SPEC-007 `:35`, `:274`, `:484`, `:682`                                                           | ugyanígy; a `:274` (két topnav bejegyzés) és a `:484` (két útvonal) elavult állítása javul (H-22)                                                                                                                         |
| `AgentStepConfigFields.tsx:21` és `agent-definition-field-table.ts:35` (`SPEC_009_SCOPE_REASON`) | a felhasználónak látható "a SPEC-009 hatóköre" szöveg és a `readonly` vezérlő megszűnik                                                                                                                                   |
| `build-agent-step-options.ts:67-71`, `packages/engine/CLAUDE.md:432`                             | a komment és a szakasz a 6.3 döntés és a megvalósult bekötés szerint                                                                                                                                                      |
| SPEC-003 4.4 (`StorableMcpServer`), `packages/db/CLAUDE.md`, `packages/protocol/CLAUDE.md`       | az `envBindings` mező és a hozzárendelés (6.1)                                                                                                                                                                            |
| SPEC-005 4.2 D és E, 8.5                                                                         | a `connection-test` válasz `mode` mező nélkül (O-1); a három skill útvonal; az új hibaosztályok (`skill_not_found`, `missing_mcp_server_env`, és az O-41 szerintiek)                                                      |
| SPEC-004 (a `testProviderConnection` `mode` leírása)                                             | a `mode` törlése                                                                                                                                                                                                          |
| SPEC-006 4. szekció                                                                              | a skill könyvtár env változója és a feltöltés korlátai (O-34, O-36 szerint)                                                                                                                                               |
| `.claude/CLAUDE.md` 9. szekció                                                                   | a "Kapcsolat teszt" gomb mondata: a provider választó része mindenhol, "örökölt" választásnál tiltott (O-2); 13. szekció új sor a SPEC-009-re; 4. szekció a nem ellenőrzött jelölés konvenció alkalmazása a 2.3 szekcióra |
| `docs/research/2026-10-26-hatokor-hianyleltar.md`                                                | minden tétel gazdája és döntése kitöltve (7. szekció, lezáró commit SHA-val)                                                                                                                                              |
| `docs/research/2026-08-26-toolchain.md`                                                          | a rögzített zip kezelő könyvtár verziója (O-33 válasza után, két forrással)                                                                                                                                               |

---

## 9. Hova kerül a kód

| Csomag              | Téma (új vagy bővülő)                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/protocol` | `skill` (új: lista, feltöltés, törlés sémái), `provider` (a `mode` törlése), `node-config` (az `envBindings` és a hozzárendelés), `protocol-error` (új hibaosztályok: `skill_not_found`, `missing_mcp_server_env`, az O-41 szerintiek)                                           |
| `packages/engine`   | `agent-step` (`mcpServers`, `plugins`, `settingSources`, `strictMcpConfig`, `skills` előtag), `run-validation` (hiányzó skill, O-13), `engine-port` (kapcsolat teszt `mode` nélkül; új port a skill könyvtárhoz), `capability-policy` (a `resolve-connection-test-mode` törlése) |
| `packages/db`       | `workflow-graph/agent-step-config` (az `envBindings` mező a `StorableMcpServer`-en és a guardon); az O-31 (a) válasza esetén új MCP definíció tábla és migráció, és a `check:db-drift` kapu                                                                                      |
| `apps/server`       | `skill-endpoint` (új), `server-config` (a skill könyvtár útvonala és az O-34 korlátai), `route-registry`, `error-class-drift-protection`, `node-config-drift-protection` (az `envBindings`); az O-31 (a) válasza esetén MCP definíció végpontok                                  |
| `packages/ui`       | az átemelt elemek: `Switch` (O-7), `FileUpload` és `Empty` (O-15), `TagInput` (O-19), bájtazonos CSS-sel (SPEC-007 precedens)                                                                                                                                                    |
| `apps/web`          | `settings-screen` (bővül), `skill-upload` (új), `mcp-server-config` (új), a provider választó bővítése a "Kapcsolat teszt" gombbal, `workflow-list` ("Workflow szerkesztése" modális, O-3), `node-inspector` (a két mező)                                                        |

A `packages/db` sémája az O-9 és az O-17 válasza mellett **nem változik**: nincs új tábla, nincs
migráció (a tárolt alak JSON dokumentum mezője bővül, az `envBindings`). Ha a user az O-31 (a) vagy (c)
opciót választja (központi MCP definíció), a 9. szekció a `db` témával, a migrációval és a
`check:db-drift` kapuval bővül, és a skill könyvtár fájlrendszeri tárolása mellett a definíciók a
DB-ben állnak.

---

## 10. Tesztelés

- **Unit** (100 százalék, kizárás nélkül): a leképezés (6.4) ágai a név feloldás három szintjére, a
  hiányzó szerver oldali név ág, a ZIP kicsomagolás 5.4 minden pontja (szintetikus zip bemenetekkel:
  bejárás, abszolút útvonal, szimbolikus link, ütközés, hiányzó `SKILL.md`, méret eltérés), a skill
  frontmatter olvasás, a REST kezelők valós `:memory:` adatbázissal és ideiglenes könyvtárral, a
  szerkesztő mezők és a mentési séma.
- **e2e** (`page.route()` mockkal, `.claude/CLAUDE.md` 11. szekció): a Beállítások képernyő minden
  kártyája mindkét témában, 320 és 1440 pixelen; a kapcsolat teszt siker és hiba ága és a tiltott állapot
  "örökölt" választásnál; a párhuzamossági korlát beállítás és törlés; a skill feltöltés, felülírás,
  törlés; a workflow provider módosítás; a lépés `skills` és `mcpServers` szerkesztése, a hozzárendelés és
  felülírása, és a mentés `PUT` törzse.
- **Szerver végponttól végpontig** (a SPEC-010 12.3 mintája, rögzítő `query` porttal, valódi API
  nélkül): a lépés `Options` objektuma tartalmazza a feloldott `mcpServers`, a `plugins`, a
  `settingSources` és a `strictMcpConfig` mezőt, az env érték nem jelenik meg naplóban és eseményben.
- **Sodródás védelem**: az új hibaosztályok az `error-class-drift-protection` témában; az `envBindings` a
  `node-config-drift-protection` témában.

---

## 11. Kockázatok

| Kockázat                                                                        | Kezelés                                                                                                |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A doksi újabb SDK verziót ír le, mint a pinelt `0.3.245`                        | a d.ts mérvadó, a mérések a pinelt verzióval futnak (4.)                                               |
| Az izolációs mód elveszi a `claude-subscription` hitelesítést                   | forrásból nem várható (7.1), az O-38 kérdés; a külön spec valódi próbája ellenőrizheti                 |
| A feltöltött ZIP rosszindulatú (útvonal bejárás, szimbolikus link, zip bomba)   | 5.4 követelmények, mindegyikre teszt; a korlátok számát az O-34 adja                                   |
| A skill futtatható scripteket hordoz                                            | kimondott korlát: a skill "context filter, not a sandbox" (d.ts `:2028`), a szerver `127.0.0.1`-re köt |
| A skill könyvtárat a fájlrendszeren bárki írhatja, aki a szerver gépen dolgozik | ugyanaz                                                                                                |
| Egy MCP szerver neve ütközik a gyári vagy a plugin MCP nevével                  | a `strictMcpConfig: true` (O-20) kizárja a többi forrást                                               |
| A szerver oldali változó név lista (O-32 (a)) az env összes nevét kiadja        | csak nevek, értékek soha; a szerver `127.0.0.1`-re köt; az O-32 kérdés                                 |
| A kimenő `env` hibája (H-40) a SPEC-009 előtt él                                | a külön spec elsőként; a PLAN-012 előfeltétele                                                         |

---

## 12. Elfogadási kritériumok

### Beállítások képernyő

1. A `/settings` képernyő a 3.1 öt kártyáját mutatja egymás alatt, kártya a kártyában nélkül; a módosító
   választó változatlan (a meglévő `settings-screen.spec.tsx` és e2e zöld).
2. A globális provider választó a `GET /api/providers` válaszából épül, "nincs" opció nélkül; a választás
   `PUT /api/settings` hívással mentődik, és a válasz után a képernyő az új értéket mutatja (unit és e2e).
3. Alapértelmezés nélkül `warning` `Alert` mondja ki, hogy agent lépés nem indul; a `no_default_provider`
   hibamondat a Beállításokra mutat (e2e).
4. A "Kapcsolat teszt" gomb a provider választó komponens része: a Beállításokon, a workflow létrehozó és
   szerkesztő modálison és a lépés felülírásnál; "örökölt" választásnál tiltott; sikerre és hibára a
   design system jelzésével felel, várakozás közben `isLoading` (unit és e2e mindkét ágra).
5. A párhuzamossági korlát kártya providerenként mutatja a beállított értéket vagy a "nincs beállított
   párhuzamossági korlát" szöveget és a javaslatot; soronként külön mentés `PUT` és törlés `DELETE`
   hívással; a mező nem pozitív egész értékre a mező alatt hibát ad (e2e a mentés `PUT` törzsével és a
   hívás hiányával).
6. A szám mező alapértéke üres: az `apps/web/src` alatt a korlát mezőhöz szám literál alapérték nincs
   (greppes invariáns).
7. A delta kapcsoló a `persistStreamDeltas` értékét mutatja és menti, `Switch` komponenssel, a "csak új
   futásra hat" mondattal (unit és e2e).
8. A "Workflow szerkesztése" modális a nevet, a leírást és a providert szerkeszti; a `PATCH` törzse a
   `providerId` mezőt hordozza, `null` értékkel is (e2e).
9. A kapcsolat teszt `mode` mezője nem létezik: `git grep -n "ConnectionTestMode\|resolveConnectionTestMode"`
   nulla találat, és a "nem elfogadott végállapot" mondat törölve.

### Skill könyvtár

10. A skill lista, feltöltés és törlés útvonala a `ROUTE_TABLE`-ben áll, a szerver kiszolgálja, a web
    hívja (a hiányleltár route összevetése újrafuttatva: a SPEC-009 útvonalai közül nincs nem hívott).
11. A ZIP feltöltés az 5.4 minden pontját betartja: minden elutasítási ágra szintetikus zip teszt, a
    sikeres feltöltés a skill könyvtárban `skills/<név>/...` alakban áll, az atomi csere hibánál a régit
    érintetlenül hagyja (szerver unit teszt ideiglenes könyvtárral).
12. A skill neve a feltöltéskor megadott név, a névszabály (5.4 5. pont) és az O-37 szerinti
    frontmatter kezelés teszttel rögzítve.
13. Az agent lépés `Options` objektuma tartalmazza a `plugins` bejegyzést a skill könyvtárra (az O-40
    szerinti feltétellel), és a `skills` lista elemei az 5.3 szerinti alakban mennek ki (motor unit
    teszt).
14. A törölt, de hivatkozott skillre a futás indítása `skill_not_found` hibát ad, és a felület saját
    magyar mondatot mutat (motor unit, szerver végponttól végpontig, e2e).
15. A lépés és az agent definíció `skills` mezője szerkeszthető, módválasztóval és `Checkbox` listával
    (unit és e2e a mentés `PUT` törzsével).

### MCP

16. A lépés és az agent definíció `mcpServers` mezője szerkeszthető, mindhárom ágra; a mentés `PUT`
    törzse a `StorableMcpServer` alakot az `envBindings` hozzárendeléssel hordozza, értéket nem (e2e).
17. Az O-31 válasza szerinti szerkesztési hely és felülírás működik: a lépés hozzárendelése felülírja az
    alapértelmezettet (motor unit teszt és e2e).
18. A motor a 6.4 táblázat mindhárom sorát leképezi, a három szintű feloldás sorrendje teszttel rögzítve,
    a hiányzó szerver oldali névre `missing_mcp_server_env` hibát ad a névvel, értékkel soha (motor unit
    teszt minden ágra).
19. Az env érték nem jelenik meg a `run_event` táblában, a pillanatképben és a naplóban (szerver
    végponttól végpontig, a `MINIMAX_API_KEY` precedens mintájára greppes ellenőrzéssel a kimeneten).
20. Egy `envBindings` nélküli régi gráf és pillanatkép változatlanul olvasható, és a mai viselkedést adja
    (azonos név); a `node-config-drift-protection` zöld.
21. A `build-agent-step-options.ts` kommentje és a `packages/engine` `CLAUDE.md` a 6.3 döntést mondja ki;
    `git grep -n "bekötése a SPEC-009 hatóköre" -- packages apps` nulla találat.

### Izoláció és környezet

22. Az agent lépés `Options` objektuma minden lépésnél tartalmazza a `settingSources: []` és a
    `strictMcpConfig: true` mezőt (motor unit teszt, szerver végponttól végpontig).
23. Az auto memory kezelése az O-39 válasza szerint (unit teszt az `Options.env` blokkon).
24. A külön spec ("helyi indítás, valódi próba és a kimenő környezet javítása") bemergelve a PLAN-012
    kezdete előtt; ez a spec a kimenő `env` blokkot legfeljebb az O-39 szerinti egy változóval egészíti ki.

### Feloldás és dokumentáció

25. A greppes invariáns (9) nem tilt `skill-upload` és `mcp-server-config` téma mappát, és mindkettő
    létezik az `apps/web/src` alatt.
26. `git grep -n "SPEC-009 hatóköre\|SPEC_009_SCOPE_REASON"` a `docs/spec/SPEC-009-*.md`, a
    `docs/plan/PLAN-012-*.md` és a hiányleltár kivételével nulla találat.
27. A 8. szekció minden sora átvezetve; a szabálykönyv 13. szekciója hivatkozza a SPEC-009-et.
28. A hiányleltár minden tétele gazdával és döntéssel kitöltve, és a SPEC-009 gazdájú tételek lezárva
    vagy kimondott user döntéssel nyitva (PLAN-012 zárási lépése).
29. A kilenc kapu, a teljes e2e és a `coverage:e2e:report` zöld a merge fején, a fedetlen tételek
    száma egyik metrikán sem nő (`.claude/CLAUDE.md` 8. szekció).

---

## 13. Lezárt pontok, amik nem kérdések

- **A bekötés helye a motor** (6.3): technikai döntés, a H-26 ellentmondás feloldása.
- **A skill és az MCP konfiguráció nem tárol titkot**: a meglévő szabály (`.claude/CLAUDE.md` 7.
  szekció) alkalmazása.
- **A párhuzamossági korlátnak nincs alapértéke**: SPEC-003 11. és `.claude/CLAUDE.md` 4. szekció 1.
  pont.
- **Az `envBindings` hiánya = azonos név**: a mai viselkedés megőrzése, a régi gráf és pillanatkép
  olvashatóságának követelménye (`.claude/CLAUDE.md` 10. szekció 2. pont).

---

## 14. Nyitott kérdések és döntések

A 14.1 ... 14.6 szekció kérdéseit a user 2026-10-26-án megválaszolta; a sorok **"Lezárva"** jelöléssel a
táblában maradnak, hogy a döntés és az indok nyomon követhető legyen. A 14.7 szekció kérdései újak: a
döntésekből nem következtek egyértelműen (vagy ellentmondást, vagy új tényt hoztak), ezért a user
döntésére várnak. Formájuk: opciók, ajánlott opció indokkal, mi a viselkedés addig, mi zárná le. Az
"addig" mező minden 14.7 sornál: a mai állapot, ahol a sor mást nem mond.

### 14.1 Beállítások és provider

| #   | Kérdés                                                  | Opciók                                                                                                                                         | Állapot és döntés                                                                                                                |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| O-1 | A kapcsolat teszt `mode` mezője                         | (a) a `mode` törlése a protokollból és a motorból, egy út marad; (b) valódi `supportedModels()` ág (M-140); (c) marad, ahogy van               | **Lezárva**, (a): a `mode` törlődik, egy út marad (user döntés 2026-10-26). Hatás: 3.2, 12. AC9; az M-140 kikerült.              |
| O-2 | Hol áll a "Kapcsolat teszt" gomb                        | (a) a provider választó komponens része mindenhol (Beállítások, workflow létrehozás és szerkesztés, lépés felülírás); (b) csak a Beállításokon | **Lezárva**, (a): a provider választó része mindenhol; "örökölt" választásnál tiltott (user döntés 2026-10-26). Hatás: 3.2, AC4. |
| O-3 | A workflow szintű provider utólagos módosításának helye | (a) az átnevezés modális "Workflow szerkesztése" modálissá bővül (név, leírás, provider); (b) a gráf szerkesztő fejlécében                     | **Lezárva**, (a): a modális bővül (user döntés 2026-10-26). Hatás: 3.3, AC8.                                                     |
| O-4 | Visszaállítható-e a globális alapértelmezés "nincs"-re  | (a) nem, csak választani lehet; (b) igen, a `defaultProviderId` nullázható (protocol és szerver változás)                                      | **Lezárva**, (a): nem állítható vissza (user döntés 2026-10-26). Hatás: 3.1, a `protocol` és a szerver változatlan.              |
| O-5 | Az első indulás jelzése                                 | (a) `warning` `Alert` a Beállításokon, és a `no_default_provider` mondata a Beállításokra mutat; (b) kötelező első indulási modális            | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 3.1, AC3.                                                                      |
| O-6 | A párhuzamossági korlát mentése                         | (a) soronként külön "Mentés" és "Korlát törlése"; (b) egy közös mentés a kártya láblécén                                                       | **Lezárva**, (a): soronként Mentés és Törlés (user döntés 2026-10-26). Hatás: 3.1, AC5.                                          |
| O-7 | A delta kapcsoló vezérlője                              | (a) a design system `.ctrl__switch` átemelése `Switch` komponensként; (b) a meglévő `Checkbox`                                                 | **Lezárva**, (a): a `Switch` átemelése (user döntés 2026-10-26). Hatás: 3.4, AC7.                                                |
| O-8 | A Beállítások oldal tagolása                            | (a) kártyák egymás alatt egy oldalon; (b) oldalsó navigáció (a design systemben csak page-local CSS)                                           | **Lezárva**, (a): kártyák egymás alatt (user döntés 2026-10-26). Hatás: 3.1, AC1.                                                |

### 14.2 Skill

| #    | Kérdés                                  | Opciók                                                                                                                                         | Állapot és döntés                                                                                                                                                                                                                                                                                                                            |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-9  | Hol tárolódik a skill                   | (a) a szerver kezelt könyvtárában, a fájlrendszeren; (b) a DB-ben, futáskor ideiglenes könyvtárba írva                                         | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 5.1; nincs migráció.                                                                                                                                                                                                                                                                       |
| O-10 | Hogyan jut az SDK-hoz                   | (a) `plugins` út egy plugin gyökérrel; (b) `additionalDirectories` és `settingSources: ['project']`; (c) a lépés `cwd` alatti `.claude/skills` | **Lezárva**, (a), az M-136 megerősítésével (user döntés 2026-10-26). Hatás: 5.1, 5.3, 4. szekció M-136; a `plugins` feltétele az O-40.                                                                                                                                                                                                       |
| O-11 | Mit lehet feltölteni                    | (a) egyetlen `SKILL.md`; (b) zip könyvtár segédfájlokkal; (c) mindkettő                                                                        | **Lezárva**, (b): **ZIP csomag** feltölthető, az egyetlen `SKILL.md` helyett (user döntés 2026-10-26). Hatás: 5.4 követelmények (útvonal bejárás, abszolút útvonal és szimbolikus link tiltása, `SKILL.md` ellenőrzés); az új nyitott kérdések: O-33 (zip kezelő), O-34 (korlátok), O-35 (elrendezés), O-36 (átvitel), O-41 (hibaosztályok). |
| O-12 | A skill neve                            | (a) a frontmatter `name` mezője; (b) a feltöltéskor megadott név                                                                               | **Lezárva**, (b): a név a feltöltéskor megadott név, ez lesz a könyvtár neve (user döntés 2026-10-26). Hatás: 5.3, 5.4 5. pont. Az SDK a saját skillt a **könyvtárnév** szerint keresi (2.2), a frontmatter `name` eltérésének kezelése az O-37 kérdés.                                                                                      |
| O-13 | Hivatkozott skill törlése               | (a) tiltott, amíg lépés hivatkozik rá; (b) megengedett, a futás indítása hibát ad                                                              | **Lezárva**, (b): megengedett, a futás indítása megnevezett új hibaosztállyal (`skill_not_found`) bukik (user döntés 2026-10-26). Hatás: 5.1, AC14.                                                                                                                                                                                          |
| O-14 | A lépés `skills` mezőjének vezérlője    | (a) `SelectField` módválasztó (nincs beállítva / minden / lista) és `Checkbox` lista; (b) csak `Checkbox` lista                                | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 5.2, AC15.                                                                                                                                                                                                                                                                                 |
| O-15 | Fájl feltöltés és üres lista elem       | (a) a design system `file-upload` és `empty` átemelése; (b) `TextAreaField` beillesztéssel és sima szöveg                                      | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 3.4.                                                                                                                                                                                                                                                                                       |
| O-16 | Megerősítő dialógus (törlés, felülírás) | (a) a meglévő `Modal` (T-009-52 precedens); (b) az `alert-dialog` átemelése                                                                    | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 3.4.                                                                                                                                                                                                                                                                                       |

### 14.3 MCP

| #    | Kérdés                                      | Opciók                                                                                                                                                                                                                                     | Állapot és döntés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-17 | Hol konfigurálható az MCP szerver           | (a) lépésenként, a meglévő `mcpServers` mezőn; (b) globális MCP könyvtár a Beállításokon, a lépés név szerint hivatkozik; (c) mindkettő                                                                                                    | **Lezárva**, (a): lépésenként, a meglévő mezőn (user döntés 2026-10-26). **Az O-18 új irányával feszültségben áll** (ha a definíció is a lépésben van, nincs mit felülírni): a feloldás az O-31 kérdés. Hatás: 6.2.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| O-18 | Az MCP szerver környezeti változói          | az eredeti kérdés: (a) új `missing_mcp_server_env` osztály saját mondattal; (b) a `missing_provider_env` újrahasználata; **új irány (user)**: a felületen megadható, és ott felülírható, ahol használjuk ("lehet van mondjuk 3 accountom") | **Lezárva**, "Név hozzárendelés felülírással" (user döntés 2026-10-26): a titok értéke a szerver környezetében áll (például `GITHUB_TOKEN_CEG`, `GITHUB_TOKEN_SAJAT`); az MCP szerver deklarálja a változó neveit, amiket a folyamata vár; a felületen az egyes változókhoz azt választod ki, melyik szerver oldali változó NÉV kerüljön bele; a hozzárendelés a lépésben felülírható. A titok szabály marad (a DB csak nevet tárol). Hiányzó szerver oldali változónál a futás indítása új `missing_mcp_server_env` hibával bukik, saját magyar mondattal. Hatás: 6.1, 6.4, AC16 ... AC20. A definíció helye: O-31, a név kiválasztása: O-32. |
| O-19 | Az `args` és a változó név listák vezérlője | (a) a design system `tag-input` átemelése; (b) `TextAreaField`, soronként egy érték                                                                                                                                                        | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 3.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### 14.4 Izoláció

| #    | Kérdés                                                  | Opciók                                                                                                              | Állapot és döntés                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-20 | Lássa-e a lépés a szerver gép saját Claude beállításait | (a) nem: `settingSources: []` és `strictMcpConfig: true`; (b) igen, mint ma; (c) csak a `project` forrás            | **Lezárva**, (a) (user döntés 2026-10-26). A feltétel (az M-138) **forrásból eldöntve**: a `settingSources` a hivatalos doksi szerint a beállítás fájlokat vezérli, a `/login` hitelesítés Keychainben vagy `.credentials.json` fájlban áll, az SDK nem ad `--bare` kapcsolót (7.1). A mérés kikerül, **korlátozással**: a "az előfizetéses bejelentkezés él" mondat csak harmadik fél forrásban áll kimondva; a megerősítés az O-38 kérdés. Hatás: 7.1, AC22. |
| O-21 | Mi kerüljön a kimenő `env` blokkba                      | (a) az M-137 eredményéig semmi; utána egy megnevezett zárt lista; (b) a teljes `process.env` a tiltott nevek nélkül | **Lezárva**, "Teljes környezet, tiltott változók nélkül" (user döntés 2026-10-26): a kimenő `env` = a szerver `process.env`-je, a provider tiltott változói (`disallowedEnv[]`) kiszűrve, plusz a provider saját változói. A user rámutatott, hogy a hivatalos doksi ezt leírja, ezért az M-137 mérés **kikerült**. A mai kódban ez **hiba**; a javítás helye egy külön, elsőként végrehajtandó kis spec, a SPEC-009 csak hivatkozik rá. Hatás: 7.2, AC24.     |

### 14.5 Mérés jóváhagyás

| #    | Kérdés                                                        | Opciók                                                | Állapot és döntés                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-22 | Futhat-e valódi `claude-subscription` hívás az M-138 méréshez | (a) igen, egy rövid lépés; (b) nem, az O-20 (b) marad | **Lezárva**: nem szükséges, mert az O-20 forrásból eldöntve (a user feltétele: "csak ha az O-20 forrásból nem dönthető el"). Ha a user az O-38-ra mérést kér, a hívás jóváhagyása akkor kerül elő, az első, külön spec valódi próbájában. |

### 14.6 A hiányleltár többi tételének besorolása

| #    | Tétel                                                        | Opciók                                                                                        | Állapot és döntés                                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-23 | H-13 `script` csomópont végrehajtása                         | (a) saját spec; (b) SPEC-009                                                                  | **Lezárva**: saját spec, később (user döntés 2026-10-26). Gazda: "külön spec: szkript csomópont" (ideiglenes név).                                                                                                                                        |
| O-24 | H-17 strukturált kimenet séma szerinti ellenőrzése           | (a) saját spec; (b) SPEC-009                                                                  | **Lezárva**: saját spec (user döntés 2026-10-26). Gazda: "külön spec: strukturált kimenet séma ellenőrzés" (ideiglenes név).                                                                                                                              |
| O-25 | H-12 `StartInputField.valueKind` értékkészlete               | (a) saját spec a futás bemenet típusaira; (b) a mező törlése; (c) SPEC-009                    | **Lezárva**: saját kis spec (user döntés 2026-10-26). Gazda: "külön spec: Start bemenet valueKind" (ideiglenes név).                                                                                                                                      |
| O-26 | H-11 `join` `merge` `settings`                               | (a) marad a SPEC-004 O-6 gazdájánál; (b) a mező elrejtése a szerkesztőből                     | **Lezárva**: a mező **kikerül a felületről és az adatszerkezetből**, egy külön kis javító PR-ban, nem a SPEC-009-ben (user döntés 2026-10-26). Gazda: "külön kis javító PR: join merge settings törlése". A SPEC-004 O-6 lezárása ennek a PR-nak a dolga. |
| O-27 | H-18 `error_handler` várakozás nem szakítható meg            | (a) hibajavítás regressziós teszttel, saját kis PR-ben; (b) SPEC-009                          | **Lezárva**: hibajavítás most, külön PR (user döntés 2026-10-26). Gazda: "külön PR: error_handler megszakítható várakozás".                                                                                                                               |
| O-28 | H-20 `readRunEvents` útvonal web fogyasztó nélkül            | (a) a SPEC-005 kimondja, hogy nem felületi útvonal, és marad; (b) törlés; (c) felület épül rá | **Lezárva**, (a): az útvonal marad, a SPEC-005 kimondja, hogy nem felületi útvonal (user döntés 2026-10-26). Gazda: ugyanaz a kis javító PR, mint az O-26.                                                                                                |
| O-29 | H-42 nincs helyi indítási út, és nincs valódi provider próba | (a) saját kis spec; (b) SPEC-009 része                                                        | **Lezárva**: saját kis spec, **elsőként végrehajtva** (user döntés 2026-10-26); ide kerül az O-21 kimenő `env` javítása is. Gazda: "külön spec: helyi indítás, valódi próba és a kimenő környezet javítása" (ideiglenes név).                             |
| O-30 | H-23, H-24, H-25 elavult kommentek és doksik                 | (a) egy önálló doksi javító PR; (b) a PLAN-012 átvezetési lépése                              | **Lezárva**: önálló javító PR (user döntés 2026-10-26). Gazda: "külön PR: elavult kommentek és doksik".                                                                                                                                                   |

### 14.7 Új nyitott kérdések (a 2026-10-26-i döntésekből)

Mindegyik **Nyitva**. Az "addig" mező: a mai állapot (a tervezett funkció még nincs), ahol a sor mást nem mond.

| #    | Kérdés                                                                                                                         | Opciók                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Ajánlott, indok, addig, mi zárná le                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-31 | Hol áll az MCP szerver **definíciója**, ha a név hozzárendelés felülírható a használat helyén (az O-17 és az O-18 feszültsége) | (a) **központi MCP szerver definíció** a Beállításokon (név, típus, `command`, `args` vagy `url`, deklarált változók, alapértelmezett hozzárendelés); a lépés név szerint hivatkozik rá, és felülírhatja a hozzárendelést; (b) **lépésenkénti definíció a hozzárendeléssel együtt**: az O-17 (a) változatlan, nincs migráció, de nincs mit felülírni, három fiókhoz a definíció három lépésben ismétlődik; (c) mindkettő: központi könyvtár, és a lépés vagy hivatkozik rá, vagy saját definíciót hordoz                                                                                 | **Ajánlott (a)**: a user saját szavai ("ahol használjuk ott felülírható") központi definíciót és használati helyet feltételeznek, és a három fiók esete a definíció ismétlése nélkül oldódik meg. Ára: új DB tábla és migráció, `check:db-drift`, a lépés `mcpServers` mezőjének alakja változik (név hivatkozás plusz hozzárendelés felülírás), ami a SPEC-011 O-8 "a mező marad" döntését és az O-17 (a) választ módosítja. Addig: a lépés mezője szerkeszthetetlen; a 6.1 alak mindkét válasznál érvényes. Lezárná: user döntés. |
| O-32 | Hogyan választható ki a **szerver oldali változó neve** a hozzárendelésnél                                                     | (a) lista a szerver környezetének változó neveiből (új, csak neveket adó végpont, értéket soha), `SelectField`-ből választva; (b) szabad szövegű mező (`TextField`), a nevet begépelve, a hiányzó változót csak a futás indítása jelzi                                                                                                                                                                                                                                                                                                                                                   | **Ajánlott (a)**: a user "kiválasztod" szavához illik, és az elgépelés ellen véd. Ára: az env összes változójának **neve** (értéke nem) látszik a felületen és egy új végponton megy át; a szerver `127.0.0.1`-re köt. Addig: nincs hozzárendelés felület. Lezárná: user döntés.                                                                                                                                                                                                                                                    |
| O-33 | Melyik **zip kezelő** csomagolja ki a feltöltést                                                                               | (a) a Node beépített `node:zlib` ZIP API-ja (`ZipFile`, `ZipEntry`): nincs új függőség, de **kísérleti** (Stability 1.0, futásidejű figyelmeztetés), a Node 26.8.0-ban jelent meg, a rögzített Node `26.7.0`-ban nincs, tehát toolchain frissítés kellene; (b) `yauzl` `3.4.0` (+ `@types/yauzl` `3.4.0`): nem kísérleti, beépített fájlnév és méret ellenőrzés, egy függősége van (`pend`); (c) más jelölt (`fflate`, `adm-zip`, `@zip.js/zip.js`)                                                                                                                                      | **Ajánlott (b)**: nem kísérleti, nem igényel Node frissítést, dokumentált védelmek (research 5.). A beépített (a) a Node API stabilizálódása után újra mérlegelhető. Addig: nincs feltöltés. Lezárná: user döntés, utána a rögzített verzió két forrással a `docs/research/2026-08-26-toolchain.md` fájlba (`.claude/CLAUDE.md` 4. szekció 4. pont).                                                                                                                                                                                |
| O-34 | Mik a zip **korlátai**: legnagyobb feltöltött méret, legnagyobb kicsomagolt összméret, legnagyobb fájlszám                     | (a) kötelező szerver konfiguráció, alapérték nélkül (a skill könyvtár útvonalának mintájára, a szám a user döntése); (b) szám a spec-ben (nincs dokumentált forrás és nincs mérés, ezért nem adható); (c) korlát nélkül                                                                                                                                                                                                                                                                                                                                                                  | **Ajánlott (a)**: `.claude/CLAUDE.md` 4. szekció ("nincs dokumentált szabály, nem adsz számot"); a (c) zip bomba ellen nem véd. Addig: nincs feltöltés. Lezárná: user döntés.                                                                                                                                                                                                                                                                                                                                                       |
| O-35 | A zip **belső elrendezése**                                                                                                    | (a) a `SKILL.md` a zip gyökerében; (b) pontosan egy legfelső szintű mappa, abban a `SKILL.md`; (c) mindkettő elfogadott: ha nincs gyökér `SKILL.md`, de pontosan egy legfelső szintű mappa van, azt a rendszer lecsípi (a mappa neve nem számít, a név a feltöltéskor megadott)                                                                                                                                                                                                                                                                                                          | **Ajánlott (c)**: nem von maga után plusz biztonsági követelményt, és a felhasználónak nem kell kitalálnia az elrendezést; az indok gyakorlati, nem forrásolt. Addig: nincs feltöltés. Lezárná: user döntés.                                                                                                                                                                                                                                                                                                                        |
| O-36 | A feltöltés **átviteli alakja**                                                                                                | (a) JSON törzs `{ name, contentBase64, ... }` alakban (a zip bájtjai base64 szövegként): illeszkedik a meglévő `readJsonRequestBody` és a `z.strictObject` sémákhoz, nincs új szerver transzport, de a méret a base64 miatt 4/3-szorosára nő; (b) nyers bináris törzs (`Content-Type: application/zip`), a név útvonal vagy lekérdezés paraméter: új útvonal fajta a route táblában és a `http-server` témában. **Mindkettőnél:** a törzs olvasó ma korlát nélkül olvas (2.1), tehát törzs korlát kell, az O-34 számával együtt                                                          | **Ajánlott (a)**: a legkisebb eltérés a meglévő alakoktól; (b) csak akkor, ha a méret indokolja. Addig: nincs feltöltés. Lezárná: user döntés.                                                                                                                                                                                                                                                                                                                                                                                      |
| O-37 | Mi történik, ha a `SKILL.md` frontmatter `name` mezője **eltér** a feltöltéskor megadott névtől, vagy hiányzik                 | (a) elutasítás, ha van `name` és eltér; hiányzó `name` elfogadott (alapértéke a könyvtárnév, Skills doksi); (b) a rendszer a mezőt a megadott névre írja át vagy beszúrja (a feltöltött tartalom módosul, YAML szerkesztés kell); (c) a rendszer figyelmen kívül hagyja az eltérést, és az M-136 második esete dönt arról, melyik nevet fogadja az SDK                                                                                                                                                                                                                                   | **Ajánlott (a)**: az Agent Skills specifikáció és az Anthropic doksi szerint a név egyezik a könyvtárnévvel, a feltöltött tartalmat nem módosítjuk, a hibaüzenet megmondja a javítást; a (c) a `skills` listát és az SDK nevét elcsúsztathatná. Addig: nincs feltöltés. Lezárná: user döntés, az M-136 második esete megerősíti.                                                                                                                                                                                                    |
| O-38 | Elfogadod-e a 7.1 forrásait az **M-138 mérés kiváltására**                                                                     | (a) igen, az M-138 és az O-22 kiesik; (b) nem, valódi `claude-subscription` hívással igazoljuk a külön spec valódi próbájában (a hívást te hagyod jóvá)                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Ajánlott (a)**: hivatalos scope leírás, a hitelesítési tároló és precedencia, plusz két független megerősítés; a korlát: a kimondott mondat harmadik féltől való. Addig: a mérés kikerült, a PLAN-012 a feltételt jelzi. Lezárná: user döntés.                                                                                                                                                                                                                                                                                    |
| O-39 | Kapcsolja-e ki a rendszer az **auto memory**-t is az izoláció részeként                                                        | (a) igen: `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` a kimenő `env` blokkban, a doksi izolációs receptje szerint; (b) nem                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Ajánlott (a)**: a `settingSources: []` az auto memory-t nem vezérli (`~/.claude/projects/<projekt>/memory/` a rendszer promptba kerül), a doksi a kettőt együtt javasolja a gépfüggetlenséghez; (b) mellett a futás részben gépfüggő marad. A managed policy beállítás és a `~/.claude.json` mindkét esetben érvényes. Addig: nincs hozzáadva. Lezárná: user döntés.                                                                                                                                                              |
| O-40 | A `skills: null` jelentése és a `plugins` opció feltétele                                                                      | (a) a `plugins` csak akkor kerül az `Options`-ba, ha a lépés `skills` mezője nem `null`: a `null` azt jelenti, hogy a lépés nem használ feltöltött skillt; (b) a `plugins` mindig megy, `null` esetén a CLI alapértelmezése dönt (d.ts: "not skills off"), az M-136 harmadik esete szerint                                                                                                                                                                                                                                                                                               | **Ajánlott (a)**: nem függ a nem ellenőrzött CLI alapértelmezéstől, és a három állapot ("nincs beállítva", "minden", lista) egyértelmű jelentést kap. Addig: a tervezet az (a) szerint íródik. Lezárná: user döntés, az M-136 harmadik esete megerősíti.                                                                                                                                                                                                                                                                            |
| O-41 | A skill feltöltés **hibaosztályai**                                                                                            | A `ProtocolErrorClass` zárt szótára ma a motor `EngineErrorKind` uniójának részhalmaza plusz az `already_decided`; a feltöltés hibái szerver oldaliak, nem motor hibák. (a) a szótár bővül szerver oldali osztályokkal (például `skill_package_invalid`, `skill_name_invalid`, `skill_package_too_large`), és a sodródás védelem szabálya kiegészül egy szerver oldali ággal (a 2026-09-26-i szabály módosul); (b) a feltöltés hibái a meglévő `invalid_request` kóddal, általános mondattal mennek; (c) a hibaok a válasz egy új, zárt `reason` mezőjében megy, a szótártól függetlenül | **Ajánlott (a)**: a felhasználó pontos magyar mondatot kap (SPEC-007 8.4 "Ismert okokra saját mondat"), a védelem mintája adott (típusszintű ág a szerver oldali listára). A `skill_not_found` és a `missing_mcp_server_env` motor osztály, ezt nem érinti. Addig: nincs feltöltés. Lezárná: user döntés.                                                                                                                                                                                                                           |

---

## 15. Kapcsolódó dokumentumok

- [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md)
- [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md)
- [`../research/2026-10-26-spec-009-forrasok.md`](../research/2026-10-26-spec-009-forrasok.md)
- [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md), 5.2, 5.11, 54. és 60. kritérium
- [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md), 4.4, 4.13, 4.14, 6.6, 11.
- [`SPEC-011-eszkoz-lanc-torles.md`](SPEC-011-eszkoz-lanc-torles.md), 3.2 és O-8
