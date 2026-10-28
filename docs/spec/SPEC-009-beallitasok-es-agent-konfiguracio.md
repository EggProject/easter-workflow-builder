# SPEC-009: Beállítások és agent konfiguráció

|             |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Státusz     | tervezet, 2026-10-26, frissítve 2026-10-28; **végrehajtásra kész, a mérésből következő három nyitott kérdéssel (14.9: O-44, O-45, O-46)**: a 14.1 ... 14.6 szekció kérdései és a 14.7 szekció O-31, O-33 és O-34 sora a user 2026-10-26-i, az O-32, O-41 és O-43 sora a user 2026-10-28-i döntésével lezárva; az O-35 ... O-40 forrásból, az O-42 (a lépés MCP mezőjének tárolt alakja) a kód olvasásából hozott technikai döntéssel lezárva (2026-10-28); a 4. szekció blokkoló mérései (M-136, M-139) 2026-10-28-án lefutottak (PLAN-012 T-012-3, T-012-4)                                                                                                                                                                |
| Dátum       | 2026-10-26                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Előzmény    | [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md) (4.4, 4.13, 4.14, 6.6, 11.), [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md) (4.2 D és E), [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) (`:35`, `:274`, `:484`, `:682`), [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) (5.2, 5.11, 54. és 60. kritérium), [`SPEC-011-eszkoz-lanc-torles.md`](SPEC-011-eszkoz-lanc-torles.md) (bemergelve a `main`-be, PR #61, `ba6d424`), [`SPEC-012-helyi-inditas-es-valodi-proba.md`](SPEC-012-helyi-inditas-es-valodi-proba.md) (PR #63, `986399a`), [`SPEC-013-flash-es-haiku.md`](SPEC-013-flash-es-haiku.md) (PR #64, `5b1188d`) |
| Bemenet     | [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md) (a hatókör hiányleltár, H-01 ... H-42), [`../research/2026-10-26-spec-009-forrasok.md`](../research/2026-10-26-spec-009-forrasok.md) (a döntésekhez gyűjtött források)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Kimenet     | a `/settings` képernyő bővítése (globális provider, kapcsolat teszt, párhuzamossági korlát, delta kapcsoló, skill könyvtár, központi MCP szerver lista), a workflow szintű provider utólagos módosítása, a lépés `skills` és MCP mezőjének szerkesztése, a két mező bekötése az SDK `query()` hívásig, a futás izolációja, a greppes invariáns (9) tiltásának feloldása                                                                                                                                                                                                                                                                                                                                                     |
| Előfeltétel | a korábban "helyi indítás, valódi próba és a kimenő környezet javítása" ideiglenes néven jelölt spec: ez a [`SPEC-012-helyi-inditas-es-valodi-proba.md`](SPEC-012-helyi-inditas-es-valodi-proba.md), **teljesítve**, bemergelve a `main`-be (PR #63, `986399a`; O-21, O-29; 7.2 szekció)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Terv        | [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

**A számozás megfeleltetése.** A spec és a terv sorszáma ennél a specnél elválik: a
`PLAN-009-graf-szerkeszto-es-futas-nezet.md` a **SPEC-008** terve (a számozás a PLAN-004b miatt
tolódott el), a **SPEC-009** terve a `PLAN-012-beallitasok-es-agent-konfiguracio.md`, mert a PLAN-010 a
SPEC-010-é, a PLAN-011 a SPEC-011-é. PLAN-009 néven SPEC-009 terv nincs és nem is lesz.

**Kiindulási állapot.** A SPEC-011 bemergelve (`ba6d424`): az `agentTools` mező, az `enabledEngineHooks`
mező, az `emit_output_tool` stratégia és a hét in-process eszköz csomag nem létezik; az agent lépés a
gyári Claude eszközöket használja, a lépés `allowedTools` és `disallowedTools` szabad szöveges mezője
marad, és az `mcpServers` mező marad (SPEC-011 3.2 és O-8: "A mező marad, a SPEC-009-ben lesz
konfigurálva és bekötve", user döntés 2026-10-26). Csak a gyári Claude eszközök maradnak (user döntés
2026-10-26, "csak a gyari claude tool-ok maradnak", a SPEC-011-ben végrehajtva). Azóta bemergelve a
SPEC-012 (`986399a`: a kimenő `Options.env` a szerver teljes környezete a tiltott változók nélkül, a
helyi indítási út, a valódi próba eszköz) és a SPEC-013 (`5b1188d`: a `minimax` modell a
`MiniMax-M3.1-Flash`, a kulcs `ANTHROPIC_AUTH_TOKEN` vagy `ANTHROPIC_API_KEY` néven is érkezhet). A
workspace 19 csomagból áll (`.claude/CLAUDE.md` 6. szekció); ez a spec új csomagot nem vezet be. A 2.1
szekció fájl és sor hivatkozásai a `main` `5b1188d` fején (a branch `origin/main` bemergelése után)
olvasva.

**A döntések forrása.** A 14.1 ... 14.6 szekció minden lezárt sora és a 14.7 szekció O-31, O-33 és
O-34 sora "user döntés 2026-10-26" forrású, az O-32, O-41 és O-43 sora "user döntés 2026-10-28"
forrású, a user szavaival. Az O-35 ... O-40 sor technikai kérdés, amit a 2026-10-28-i forrásgyűjtés
(`../research/2026-10-26-spec-009-forrasok.md` 7. és 8. szekció) dönt el; a user kifejezett elvárása
szerint ("ha egy alapértékre nincs forrás, keresd meg az iparági ajánlást") a zip korlátok számai is
forrásból jönnek, nem a usertől. Az O-42 technikai tervezési pont, amit a kód olvasása dönt el
(research 9. szekció). Nyitott kérdés nincs.

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
   providerenkénti párhuzamossági korlát, a delta perzisztálás kapcsoló, a skill könyvtár, a központi
   MCP szerver lista (O-31) és a visszavonás módosító választó (változatlan).
2. **A provider választás három szintje teljessé válik** (`.claude/CLAUDE.md` 9. szekció): a globális
   alapértelmezés a Beállítások képernyőn, a workflow szintű felülírás létrehozáskor **és utólag** (a
   "Workflow szerkesztése" modális, O-3), a lépés szintű felülírás a beállítás panelen (ma is). A
   "Kapcsolat teszt" gomb a provider választó komponens része mindenhol (O-2).
3. **A kapcsolat teszt `mode` mezője megszűnik** (O-1, H-19): egy út marad.
4. **A skill feltöltés (ZIP csomag), tárolás és betöltés** az SDK-ba (H-04), és a lépés `skills`
   mezőjének szerkesztése.
5. **Az MCP szerver konfiguráció**: központi MCP szerver lista a Beállításokon (O-31), a lépés név
   szerint hivatkozik rá (H-05), a bekötés az SDK `Options.mcpServers` mezőjéig (H-07), és a környezeti
   változók **név hozzárendelése**, ami a lépésen felülírható (O-18, O-31).
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
- **A kimenő `Options.env` javítása, a helyi indítási út, a valódi provider próba** (H-40, H-42): a
  SPEC-012 végrehajtotta (PR #63, `986399a`; 7.2 szekció, O-21, O-29). Ez a spec csak hivatkozik rá, és
  a kimenő környezetet egyetlen izolációs változóval egészíti ki (O-39).
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

### 2.1 A kód mai állapota (a `main` `5b1188d` fején olvasva)

| Tény                                                                                                                                                                                                                                                                                                                         | Forrás                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `/settings` képernyő egyetlen kártyát és egyetlen `preference-row` sort tart, a visszavonás módosító `SelectField` választóval; hálózati kérés nincs                                                                                                                                                                       | `apps/web/src/settings-screen/settings-screen.tsx:17-21, 43, 48-79`                                                                                                                                                                   |
| A módosító választó `localStorage`-ban él (`eggGraphEditorUndoModifier`)                                                                                                                                                                                                                                                     | `apps/web/src/graph-editor/undo-modifier-storage.ts:11`                                                                                                                                                                               |
| A globális alapértelmezés a DB egysoros `app_setting.default_provider_id` oszlopa, nullázható, a migráció nem tölti ki                                                                                                                                                                                                       | `packages/db/src/app-setting/app-setting.ts:28-40`; SPEC-003 4.13                                                                                                                                                                     |
| A `PUT /api/settings` részleges frissítés: `defaultProviderId?: string`, `persistStreamDeltas?: boolean`; a `defaultProviderId` nem nullázható                                                                                                                                                                               | `packages/protocol/src/settings/settings-record.ts`; `apps/server/src/settings-endpoint/update-settings.ts:18-49`                                                                                                                     |
| A web a `GET /api/settings` útvonalat egy helyen hívja (az örökölt provider szöveghez), a `PUT`-ot sehol                                                                                                                                                                                                                     | `apps/web/src/graph-editor/GraphEditorScreen.tsx:454`; hiányleltár 4. szekció                                                                                                                                                         |
| A workflow `PATCH` útvonala a `providerId` mezőt elfogadja (`null` is), a web az átnevezésnél nem küldi                                                                                                                                                                                                                      | `packages/protocol/src/workflow/workflow-record.ts:59`; `apps/server/src/workflow-endpoint/update-workflow.ts:27-38`; `apps/web/src/workflow-list/rename-workflow-modal.tsx:57`                                                       |
| A létrehozó modális a providert a `GET /api/providers` válaszából kínálja                                                                                                                                                                                                                                                    | `apps/web/src/workflow-list/create-workflow-modal.tsx:49, 67`                                                                                                                                                                         |
| A feloldás sorrendje: lépés, workflow, globális, különben `no_default_provider`                                                                                                                                                                                                                                              | `packages/engine/src/provider-resolution/resolve-effective-provider.ts:16-34`                                                                                                                                                         |
| A kapcsolat teszt útvonala kész (`POST /api/providers/:providerId/connection-test`), a web nem hívja                                                                                                                                                                                                                         | `packages/protocol/src/http-route/route-table.ts:62-65`; `apps/server/src/provider-endpoint/test-provider-connection.ts:17-30`                                                                                                        |
| A kapcsolat teszt két `mode` értéke (`sdk_model_list`, `minimal_query`) ugyanazt a minimális `query()` hívást futtatja; a komment szerint "nem elfogadott végállapot"                                                                                                                                                        | `packages/engine/src/engine-port/create-engine.ts:170-206`; `packages/engine/src/capability-policy/resolve-connection-test-mode.ts:23-27`; `packages/protocol/src/provider/connection-test-response.ts`                               |
| A párhuzamossági korlát három útvonala kész, a web nem hívja; alapérték nincs, sor híján nincs korlát; a javaslat a leíró mért értéke                                                                                                                                                                                        | `route-table.ts:70-78`; `packages/db/src/provider-concurrency/provider-concurrency.ts:17-29`; `packages/engine/src/concurrency-gate/create-concurrency-gate.ts:78-82`; SPEC-003 11.                                                   |
| A delta kapcsoló a futás indításakor befagy a `workflow_run.persisted_stream_deltas` oszlopba                                                                                                                                                                                                                                | `packages/db/src/workflow-run/workflow-run.ts:51`; `.claude/CLAUDE.md` 10. szekció 3. pont                                                                                                                                            |
| A `skills` mező (`readonly string[] \| 'all' \| null`) és az `mcpServers` mező (`Record<string, StorableMcpServer>`) a szerkesztőben csak olvasható                                                                                                                                                                          | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:71-72`; `apps/web/src/node-inspector/AgentStepConfigFields.tsx:21, 280-291`; `apps/web/src/node-inspector/agent-definition-field-table.ts:35, 92-102`          |
| A `StorableMcpServer` három ága: `stdio {command, args, envNames}`, `sse {url, authEnvName}`, `http {url, authEnvName}`; értéket soha nem tárol; a `stdio` ágon az `envNames` az átadandó változók neve, a név a szerver környezetében és az alfolyamatban azonos                                                            | `packages/db/src/workflow-graph/agent-step-config/storable-mcp-server.ts`; `packages/protocol/src/node-config/storable-mcp-server.ts`                                                                                                 |
| A motor a `skills` mezőt átadja (ha nem `null`), az `mcpServers` mezőt kihagyja ("a mező bekötése a SPEC-009 hatóköre (SPEC-011 3.2)")                                                                                                                                                                                       | `packages/engine/src/agent-step/build-agent-step-options.ts:91-94, 115`; `packages/engine/CLAUDE.md:432-434`                                                                                                                          |
| A motor `settingSources`, `strictMcpConfig` és `plugins` opciót nem ad át                                                                                                                                                                                                                                                    | `packages/engine/src/agent-step/agent-step-options.ts:32-` (a típusban nincs ilyen mező)                                                                                                                                              |
| A kimenő `Options.env` a `buildOutgoingEnvironment` kimenete: a szerver teljes környezete (`ProcessEnvironmentPort.readAll`), a provider `disallowedEnv[]` nevei kiszűrve, plusz a `requiredEnv[]` blokk ráírva (SPEC-012 3.1); a `claude-subscription` tiltott listája a hitelesítési sorrend szerint bővült (SPEC-012 3.2) | `packages/engine/src/provider-environment/build-outgoing-environment.ts:26-45`; `packages/engine/src/engine-port/process-environment-port.ts:7-13`; `packages/provider-claude-subscription/src/environment/disallowed-environment.ts` |
| A `requiredEnv[]` forrásai között áll a `process_env_alternatives`: a `minimax` kulcsa az `ANTHROPIC_AUTH_TOKEN` vagy az `ANTHROPIC_API_KEY` szerver oldali névből jön (ha mindkettő áll, az `ANTHROPIC_AUTH_TOKEN` nyer), és `ANTHROPIC_AUTH_TOKEN` néven megy ki; a `minimax` modellje a `MiniMax-M3.1-Flash` (SPEC-013)   | `packages/provider-capability/src/environment/environment-requirement.ts:40`; `packages/provider-minimax/src/environment/required-environment.ts`; `packages/engine/src/provider-environment/resolve-required-environment-value.ts`   |
| A greppes invariáns (9) tiltja a `skill-upload` és az `mcp-server-config` téma mappát az `apps/web/src` alatt                                                                                                                                                                                                                | `apps/web/src/greppable-invariants/greppable-invariants.spec.ts:313-317`; SPEC-008 54. kritérium (`:1521`)                                                                                                                            |
| A szerver kérés törzs olvasója korlát nélkül gyűjti a törzset és JSON-ként értelmezi                                                                                                                                                                                                                                         | `apps/server/src/http-server/read-json-request-body.ts`                                                                                                                                                                               |
| Skill vagy MCP szerver tábla nincs a DB-ben                                                                                                                                                                                                                                                                                  | `packages/db/src` téma mappái (app-setting, provider-concurrency, human-approval, run-event, step-run, workflow-graph, workflow-run, graph-snapshot)                                                                                  |
| A helyi indítás a gyökér `dev`, `dev:server`, `dev:web` és `start:server` scriptjével megy (SPEC-012 4.1); az `apps/server` csomag saját scriptje továbbra is csak `typecheck` és `lint`                                                                                                                                     | gyökér `package.json` `scripts`; `apps/server/package.json` `scripts`                                                                                                                                                                 |

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

| Tény                                                                                                                                                                                                                                                                                                                                                                                                         | d.ts                                     | Megerősítés                                                                                                                                                                                                                          | Állapot                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcpServers?: Record<string, McpServerConfig>`; az unió `McpStdioServerConfig \| McpSSEServerConfig \| McpHttpServerConfig \| McpSdkServerConfigWithInstance`                                                                                                                                                                                                                                                | `:1755`, `:1091`                         | TS referencia; anthropics/claude-agent-sdk-typescript #247 (<https://github.com/anthropics/claude-agent-sdk-typescript/issues/247>)                                                                                                  | ellenőrzött                                                                                                                                                                                                                                           |
| stdio: `type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string>`; sse: `type: 'sse'; url; headers?`; http: `type: 'http'; url; headers?`                                                                                                                                                                                                                                              | `:1190-1194`, `:1173-1177`, `:1058-1062` | TS referencia; ugyanaz az issue                                                                                                                                                                                                      | ellenőrzött                                                                                                                                                                                                                                           |
| Az MCP eszköz neve `mcp__<szerver>__<eszköz>`; a szerver nevében a `[a-zA-Z0-9_-]` halmazon kívüli minden karakter (a `.` és a szóköz is) `_`-re cserélődik                                                                                                                                                                                                                                                  | `:3805`, `:3224`                         | MCP oldal ("Tool naming convention", a `.` és a szóköz példaként); a telepített `sdk.d.ts:3805` megjegyzése a teljes szabályt mondja ki; két harmadik fél megerősítés (`docs/research/2026-10-26-spec-009-forrasok.md` 10.3 szekció) | ellenőrzött (telepített d.ts, két harmadik fél megerősítés; a hivatalos doksi csak példát ad)                                                                                                                                                         |
| `strictMcpConfig?: boolean`: csak az `mcpServers` szerverei, a `.mcp.json`, a user beállítás és a plugin szerverei nélkül; a claude.ai fiókhoz kötött MCP connectorokat is letiltja, amiket a `settingSources: []` nem                                                                                                                                                                                       | `:2058-2063`                             | TS referencia Options tábla; `claude-code-features` oldal ("claude.ai MCP connectors"); anthropics/claude-agent-sdk-python #853                                                                                                      | ellenőrzött                                                                                                                                                                                                                                           |
| `settingSources?: ('user' \| 'project' \| 'local')[]`; kihagyva **mindhárom** betöltődik; `[]` az izolációs mód; a `CLAUDE.md` betöltéséhez `'project'` kell; a skillek a `user` és `project` forrásból jönnek                                                                                                                                                                                               | `:2004-2014`, `:7817`                    | TS referencia; `claude-code-features`; Skills oldal ("Skills not loaded: settingSources excludes user and project")                                                                                                                  | ellenőrzött, a d.ts mérvadó                                                                                                                                                                                                                           |
| A `settingSources` **nem vezérli** a managed policy beállítást, a `~/.claude.json` konfigot, az auto memory-t, a claude.ai MCP connectorokat és a `sandbox.credentials` bejegyzéseket                                                                                                                                                                                                                        |                                          | `claude-code-features` ("What settingSources does not control")                                                                                                                                                                      | részben ellenőrzött: az auto memory és a `CLAUDE_CONFIG_DIR` áthelyezés három forrással (`docs/research/2026-10-26-spec-009-forrasok.md` 10.4 szekció), a többi tétel egy hivatalos forrás                                                            |
| `skills?: string[] \| 'all'`; kihagyva "not skills off", a CLI alapértelmezése érvényes; a lista a saját skillnél a **könyvtárnév**, plugin skillnél `plugin:skill`; "context filter, not a sandbox"; a `Skill` eszközt nem kell az `allowedTools`-ba tenni; érvénytelen név (üres, zárójel, vessző, vezérlő karakter, szóközzel kiegészített, joker) esetén a `query()` a folyamat indítása előtt hibát dob | `:2015-2037`                             | Skills oldal; a GitHub CHANGELOG 0.2.120 ("Added `skills` option") (<https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md>)                                                                              | ellenőrzött                                                                                                                                                                                                                                           |
| Skillt programból regisztrálni nem lehet, csak fájlrendszerről: "The SDK doesn't provide a programmatic API for registering them"                                                                                                                                                                                                                                                                            | (nincs ilyen opció a d.ts-ben)           | Skills oldal; <https://code.claude.com/docs/en/agent-sdk/claude-code-features>                                                                                                                                                       | részben ellenőrzött                                                                                                                                                                                                                                   |
| `plugins?: { type: 'local'; path: string }[]`; a plugin skillt, agentet, hookot, MCP szervert hozhat; a plugin skill neve `<plugin>:<skill>`; a `skills/<név>/SKILL.md` könyvtár elrendezés; a `.claude-plugin/plugin.json` manifeszt elhagyható                                                                                                                                                             | `:1800-1818`, `:4533-4546`               | Plugins oldal ("Plugin structure reference"); Skills oldal ("or use the `plugins` option to load skills from a specific path")                                                                                                       | mérve (M-136, `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2.): a plugin neve a manifeszt `name` mezője, manifeszt nélkül a gyökér könyvtárneve; a skill neve `<plugin>:<könyvtárnév>`; abszolút és a `cwd`-hez relatív útvonal is működik |
| Plugin skillnél a frontmatter `name` az utolsó parancs szakaszt cseréli (`/my-plugin:fancy`)                                                                                                                                                                                                                                                                                                                 |                                          | <https://code.claude.com/docs/en/skills> ("How a skill gets its command name")                                                                                                                                                       | egy hivatalos forrás; **a pinelt verzióban mérve nem áll**: az `init`, a `slash_commands` és a modell listázása a könyvtárnevet mutatja, a frontmatter néven álló `skills` bejegyzés hatástalan (M-136, research 2. szekció 3. pont)                  |
| A `SKILL.md` `name` mezője: 1-64 karakter, kisbetű, szám, kötőjel, nem kezdődik/végződik kötőjellel, nincs `--`, **egyezik a szülő könyvtár nevével**; a `description` kötelező, 1-1024 karakter; tiltott szavak a névben: "anthropic", "claude"                                                                                                                                                             |                                          | <https://agentskills.io/specification>; <https://claude.com/docs/skills/how-to>; <https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview>                                                                        | ellenőrzött (három forrás)                                                                                                                                                                                                                            |
| `env` megadva **teljesen lecseréli** az alfolyamat környezetét, nem olvad össze a `process.env`-vel; kihagyva örököl                                                                                                                                                                                                                                                                                         | `:1478-1498`                             | TS referencia Options `env` sora; `sdk.mjs` `Cn=ne?{...ne}:{...process.env}`; CHANGELOG 0.2.113 és 0.3.149                                                                                                                           | ellenőrzött (három forrás)                                                                                                                                                                                                                            |
| A hitelesítési precedencia: felhő provider változók, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`, `apiKeyHelper`, `CLAUDE_CODE_OAUTH_TOKEN`, profil/föderáció, a `/login` előfizetéses OAuth (utolsó); az `apiKeyHelper` beállításból jön, a `/login` hitelesítő adata Keychainben vagy `~/.claude/.credentials.json` fájlban (`CLAUDE_CONFIG_DIR` alatt) áll                                                |                                          | <https://code.claude.com/docs/en/authentication>                                                                                                                                                                                     | egy hivatalos forrás                                                                                                                                                                                                                                  |
| `additionalDirectories?: string[]`; a doksi szerint `--add-dir`-ként megy, és `'project'` forrással az ottani `.claude/skills/` is betöltődik                                                                                                                                                                                                                                                                | `:1379`                                  | Skills oldal                                                                                                                                                                                                                         | egy hivatalos forrás                                                                                                                                                                                                                                  |
| `Query.supportedModels(): Promise<ModelInfo[]>` és `Query.mcpServerStatus(): Promise<McpServerStatus[]>` élő `Query` objektumon                                                                                                                                                                                                                                                                              | `:2528`, `:2540`, `:1098-1139`           | TS referencia Query szekció (`supportedModels()`, `mcpServerStatus()`); két harmadik fél összefoglaló; a telepített `sdk.d.ts:2528,2540` (`docs/research/2026-10-26-spec-009-forrasok.md` 10.2 szekció)                              | ellenőrzött                                                                                                                                                                                                                                           |
| A `node:zlib` ZIP API (`ZipFile`, `ZipEntry`, `ZipBuffer`) a Node 26.8.0-ban jelent meg, kísérleti (Stability 1.0); a rögzített Node `26.7.0`                                                                                                                                                                                                                                                                |                                          | <https://nodejs.org/api/zlib.html>; <https://nodejs.org/en/blog/release/v26.8.0>; <https://github.com/nodejs/node/pull/64339>; `docs/research/2026-08-26-toolchain.md`                                                               | ellenőrzött (három forrás)                                                                                                                                                                                                                            |

### 2.3 Amit ezekből NEM következtetünk

- (Lezárva 2026-10-28, M-136, `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció.) A plugin út skillje `settingSources: []`
  mellett az `init` `skills` tömbjében `<plugin>:<könyvtárnév>` alakban megjelenik (a tömb a `skills`
  opciótól függetlenül a teljes felfedezett lista); a `skills` lista a könyvtárnevet fogadja, a
  frontmatter `name` eltérésnél hatástalan; a `skills` elhagyásakor a plugin skillek (és a CLI beépített
  skilljei) a modell elé kerülnek és hívhatók.
- (Lezárva 2026-10-28, M-139, `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 3. szekció.) A stdio MCP szerver alfolyamata a CLI **teljes**
  környezetét örökli (a `PATH`, a `HOME` és minden más változó, a provider kulcsát is), és erre íródik rá
  a saját `env` mezője; a CLI környezetén kívüli szülő változó nem jut el hozzá.
- (Lezárva 2026-10-28, PLAN-012 T-012-2.) Hogy az MCP szerver nevében melyik karakter cserélődik
  `_`-re: a `[a-zA-Z0-9_-]` halmazon kívüli minden (2.2, `docs/research/2026-10-26-spec-009-forrasok.md`
  10.3 szekció); a mentési szabály szűk marad (6.1), mert a csere ütközést okozhatna.
- Hogy a `settingSources: []` mellett az előfizetéses bejelentkezés él: a hivatalos doksi szó szerint nem
  mondja ki; a forrás kép a 7.1 szekcióban áll. A döntés forrásból meghozva (O-38, lezárva): a
  megerősítés a PLAN-012 valódi próbája, a user engedélyével.

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
5. **MCP szerverek**: a központi MCP szerver lista (6.2, O-31): szerverenként egy sor, hozzáadás és
   szerkesztés `Modal`-ban, törlés megerősítéssel, akkor is, ha egy lépés hivatkozik rá (O-43).
6. **Gráf szerkesztő**: a visszavonás módosító választó, változatlan (SPEC-008 O-31, O-32).

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

**Eredmény (2026-10-28, PLAN-012 T-012-3 és T-012-4, valódi API hívás nélkül, helyi csonkkal):** a
részletek, a táblák és a mérő eszközök: `docs/research/2026-10-28-spec-009-blokkolo-meresek.md`. Röviden:

- **M-136.** A `plugins` út `settingSources: []` mellett működik. Az `init` `skills` tömbje
  `<plugin>:<könyvtárnév>` alakban hordozza a plugin skilleket, de **nem szűrt**: a `skills` opciótól
  függetlenül a teljes felfedezett lista, a CLI beépített skilljeivel együtt; az engedélyezést a modellnek
  küldött listázás és a `Skill` eszköz eredménye mutatja. A `skills: ['<plugin>:<könyvtárnév>']` lista
  elfogadott. (1) Egyező névnél a skill betöltődik. (2) Eltérő frontmatter `name` mellett az SDK a
  **könyvtárnevet** fogadja: a frontmatter néven álló bejegyzés (teljes és puszta alakban is) a skillt
  elrejti. (3) A `skills` elhagyásakor a `plugins` skilljei elérhetők a modellnek, és a CLI beépített
  skilljei is. A manifeszt nélküli plugin neve a gyökér könyvtárának neve. A puszta név a lista elemeként
  az azonos nevű beépített skillt is engedélyezi; a `'all'` a beépítetteket is; a `[]` mindent elrejt; a
  nem létező, de érvényes alakú név nem ad indítási hibát.
- **M-139.** Helyi stdio és http MCP csonk az `mcpServers` úton `connected` (az `init` `mcp_servers`
  tömbjében és a `mcpServerStatus()` válaszában); sikertelen kapcsolatnál `failed`, a futás ettől nem
  bukik. A stdio alfolyamat a CLI teljes környezetét örökli (`PATH`, `HOME` és minden más, a provider
  kulcsát is), a saját `env` mezője erre íródik rá. A http `headers.Authorization` minden kérésen
  megérkezik, és a `mcpServerStatus()` `config` mezője szó szerint visszaadja.

**Kikerült mérések (user döntés 2026-10-26):**

- **M-137** (a mai `Options.env` hatása): kikerült, mert a hivatalos doksi, a telepített d.ts és a
  futásidejű kód leírja (2.2 szekció), és a javítás a SPEC-012-ben elkészült (7.2).
- **M-138** (a `claude-subscription` hitelesítés izolációs módban): a 7.1 szekció forrásai alapján
  eldönthető, ezért kikerült (O-38, lezárva, technikai döntés forrásból). A megerősítés a PLAN-012
  T-012-12a lépése: a SPEC-012 valódi próba eszköze (`bun run probe:real-provider`) az izolációs
  opciókkal, kizárólag a user kifejezett engedélyével (SPEC-012 5.3).
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
  load skills from a specific path"); az M-136 igazolja. A `plugins` csak akkor kerül az `Options`-ba,
  ha a lépés `skills` mezője nem `null` (O-40, lezárva).
- **Feltöltés:** egyetlen **ZIP csomag** (O-11), a skill neve a **feltöltéskor megadott név** (O-12); az
  egyetlen `SKILL.md` önálló feltöltése nincs, azt a felhasználó becsomagolja. Azonos nevű skill
  feltöltése felülírja a régit, megerősítéssel (`Modal`, O-16). A kicsomagolás követelményei az 5.4
  szekcióban.
- **REST:** három új útvonal a `packages/protocol` route táblájában: a skillek listája (név, leírás a
  frontmatterből, méret, módosítás ideje), egy skill feltöltése és egy skill törlése. A feltöltés
  nyers bináris törzs (`Content-Type: application/zip`), a név az útvonal paramétere (O-36, lezárva):
  `PUT /api/skills/:name`; a törzs korlátja az 5.4 6. pontja. A sémák a `protocol` négy írási szabálya szerint (`z.strictObject`,
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
`skills` (SPEC-008 `:413-415`, 60. kritérium) ugyanígy szerkeszthetővé válik. A `null` jelentése: a
lépés nem használ feltöltött skillt, a motor sem `plugins`, sem `skills` opciót nem ad (O-40, lezárva).

### 5.3 A lista elemeinek alakja

Az M-136 szerint (`docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció) a betöltés plugin úton (O-10) a skillt `<plugin>:<könyvtárnév>` néven
ismeri, ahol a plugin neve a skill könyvtár gyökerének `.claude-plugin/plugin.json` `name` mezője, vagy
manifeszt nélkül a gyökér könyvtárneve. **A tárolt alak a puszta név**, a feltöltéskor megadott név (a
könyvtárnév, O-12), mert a plugin neve szerver oldali részlet; **a motor `<plugin>:<név>` alakban adja
át**. A puszta név átadása nem elfogadható: a mérés szerint az azonos nevű CLI beépített skillt is
engedélyezi (például `simplify`). A tárolt `'all'` állapotot a motor a skill könyvtár neveinek explicit
`<plugin>:<név>` listájára fordítja, mert az SDK `'all'` értéke a CLI beépített skilljeit is engedélyezi;
ez az 5.2 "minden feltöltött skill" jelentésének megvalósítása. A frontmatter `name` a listán
hatástalan, tehát a tárolt név nem függ tőle (O-37).

### 5.4 A ZIP csomag kicsomagolásának követelményei (O-11)

A követelmények a **kicsomagoló kódra** és a szerver végpontjára szólnak, függetlenül a zip kezelő
könyvtártól; a zip kezelő a `yauzl` (O-33, lezárva). Mindegyik elutasítás az egész feltöltést utasítja el (nem hagy ki csendben
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
4. **`SKILL.md` és elrendezés** (O-35, lezárva). A skill gyökere vagy a zip gyökere (ott áll a
   `SKILL.md`), vagy, ha a zip gyökerében nincs `SKILL.md`, pontosan egy legfelső szintű mappa, és
   minden bejegyzés ebben a mappában áll; a mappa nevét a rendszer lecsípi, a skill neve a feltöltéskor
   megadott név. Pontosan egy `SKILL.md` kötelező a skill gyökerében. Hiánya, több példánya, olvashatatlan YAML frontmatter, üres `description` vagy a
   `description` 1024 karakter fölött: elutasítás (az Agent Skills specifikáció és a platform doksi
   szerint a `description` kötelező, nem üres, legfeljebb 1024 karakter, 2.2).
5. **Név.** A feltöltéskor megadott név szabálya a dokumentált `name` szabály (2.2): 1-64 karakter,
   kisbetű, szám és kötőjel, nem kezdődik vagy végződik kötőjellel, nincs `--`, nem tartalmazza az
   "anthropic" és "claude" szót. Ha a frontmatter `name` mezője meg van adva és eltér a megadott
   névtől: elutasítás, a hibaüzenet megnevezi mindkét nevet; ha hiányzik: elfogadva, a feltöltött
   tartalom nem módosul (O-37, lezárva).
6. **Méret és fájlszám** (O-34, lezárva; a források a research 7. szekciójában). A bejegyzés deklarált
   és tényleges kicsomagolt mérete egyezzen (a `yauzl` `validateEntrySizes` opciója, alapból
   bekapcsolva, zip bomba és hazudó fejléc ellen). A korlátok alapértéke a kódban áll (a SPEC-012 4.2
   mintája: forrásolt alapérték, env változóval felülírható; a változók neve a PLAN-012-ben rögzül):

   | Korlát                                        | Alapérték               | Forrás                                                                                                                                                                                                                           |
   | --------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | a kicsomagolt fájlok összmérete               | 30 000 000 bájt (30 MB) | az Anthropic Skills API korlátja: "Maximum Skill upload size: 30 MB (all files combined, uncompressed)" (research 7.1); a decimális MB a szigorúbb olvasat, a bináris (30 MiB) mellett is a korláton belül marad                 |
   | a feltöltött törzs (a zip) mérete             | 30 000 000 bájt         | levezetett: a zip a kicsomagolt tartalom plusz a fejlécek; a törzs olvasó a korláton túl olvasást megszakítja (research 7.4)                                                                                                     |
   | a bejegyzések száma (fájl és könyvtár együtt) | 1024                    | SEI CERT IDS04-J megfelelő megoldása (`TOOMANY = 1024`); a Sonar S5042 mintája 10000-et ad, a kettő közül a szigorúbb, mert egy skill jellemzően néhány fájl (research 7.2)                                                      |
   | tömörítési arány                              | nincs külön korlát      | a kicsomagolás közben számolt összméret a kicsomagolást a korlátnál megállítja (CERT IDS04-J módszere); a Sonar arány küszöbét a Sonar maga "rather arbitrarily" választottnak mondja, és ép fájlokat is blokkolt (research 7.3) |

   A számolás a kicsomagolás közben, a ténylegesen kiírt bájtokon fut (nem a fejléc deklarált értékén),
   és a korlát átlépésekor az egész feltöltés elutasítva.

7. **Titkosított bejegyzés és nem támogatott tömörítési módszer** elutasítva.
8. **Mód.** A zip Unix mód bitjei nem érvényesülnek: a fájlokat a szerver az alapértelmezett
   jogosultsággal hozza létre.
9. **Atomi csere.** A kicsomagolás egy ideiglenes könyvtárba megy, az ellenőrzések után kerül a végleges
   helyre, felülíráskor a régi skill teljes cseréjével; hiba esetén a régi skill érintetlen, és nem marad
   félig kicsomagolt könyvtár.
10. **Törlés.** A skill törlése a skill könyvtárát teljesen eltávolítja; a név nem tartalmazhat útvonal
    elemet (a 5. pont szabálya miatt a törlő végpont sem léphet ki a gyökérből).

**A hibák megjelenése: pontos ok (O-41, user döntés 2026-10-28).** Minden elutasítás saját
hibaosztályt kap, ami a SPEC-005 8.5 zárt szótárát bővíti, és a felület okonként saját magyar
mondatot mutat (a meglévő `protocol-error-class-message` minta, kimerítő `Record` leképezéssel). A
mondat az okot nevezi meg, a szerver `message` szövegét nem idézi és nem elemzi (SPEC-007 8.4); a
`message` mezőben a részletek (például az 5. pont két neve) a naplózás és a REST kliensek számára
maradnak.

| 5.4 pont                                                                | Hibaosztály                             | A mondat tárgya                                                           |
| ----------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| a törzs nem nyitható meg ZIP csomagként (a `yauzl` `fromBuffer` hibája) | `skill_archive_unreadable`              | a fájl nem érvényes ZIP csomag                                            |
| 1. bejegyzés típus                                                      | `skill_archive_entry_type_unsupported`  | a csomag nem támogatott bejegyzést (például szimbolikus linket) tartalmaz |
| 2. útvonal                                                              | `skill_archive_unsafe_path`             | egy bejegyzés útvonala tiltott (abszolút, `..`, visszaper, NUL)           |
| 3. ütközés                                                              | `skill_archive_path_collision`          | két bejegyzés útvonala azonos, vagy csak kis-nagybetűben tér el           |
| 4. elrendezés                                                           | `skill_archive_layout_invalid`          | a gyökérben nincs `SKILL.md`, és nem pontosan egy legfelső mappa van      |
| 4. `SKILL.md` hiánya                                                    | `skill_manifest_missing`                | "Hiányzik a SKILL.md" (a user példája)                                    |
| 4. több `SKILL.md`                                                      | `skill_manifest_duplicate`              | a skill gyökerében több `SKILL.md` áll                                    |
| 4. frontmatter (olvashatatlan YAML, üres vagy túl hosszú `description`) | `skill_manifest_invalid`                | a `SKILL.md` fejléce hibás                                                |
| 5. a megadott név szabálya                                              | `skill_name_invalid`                    | a megadott név nem felel meg a névszabálynak                              |
| 5. a frontmatter `name` eltér                                           | `skill_name_mismatch`                   | a `SKILL.md` neve eltér a megadott névtől                                 |
| 6. kicsomagolt összméret és törzs méret                                 | `skill_archive_too_large`               | "A csomag túl nagy" (a user példája)                                      |
| 6. bejegyzések száma                                                    | `skill_archive_too_many_entries`        | a csomag túl sok fájlt tartalmaz                                          |
| 6. deklarált és tényleges méret eltér                                   | `skill_archive_entry_size_mismatch`     | a csomag egy bejegyzése sérült                                            |
| 7. titkosított bejegyzés                                                | `skill_archive_entry_encrypted`         | a csomag titkosított bejegyzést tartalmaz                                 |
| 7. nem támogatott tömörítési módszer                                    | `skill_archive_compression_unsupported` | a csomag nem támogatott tömörítést használ                                |

**A kód és a sodródás védelem.** A tizenöt osztály `unprocessable` kódot kap, a SPEC-005 8.3
táblázat "a tárolt vagy a küldött dokumentum nem dolgozható fel" sorának mintájára (a
`malformed_graph_document` precedense). Az osztályok **szerver oldaliak** (`apps/server`
`skill-endpoint`), nem a motor `EngineErrorKind` uniójának tagjai, tehát az `apps/server`
`error-class-drift-protection` típusszintű ága (`Exclude<ProtocolErrorClass, EngineErrorKind>`, ma
pontosan `'already_decided'`, `error-class-drift-protection.spec.ts:26-30`) az `already_decided`
mintájára a tizenöt osztály uniójával bővül, és a futásidejű ág (`!isEngineErrorKind` szűrés,
`:32-36`) listája ugyanígy. Hogy a szerver oldali lista és a szótár ne sodródhasson, a `skill-endpoint`
a tizenöt osztályt egyetlen `as const` táblában deklarálja, és a típusszintű ág erre a táblára
hivatkozik. A `skill_not_found`, a `mcp_server_not_found` és a `missing_mcp_server_env` ezzel szemben
motor oldali osztály (a futás indításának ellenőrzése), tehát a meglévő részhalmaz szabály alá esik, és
a szerver motor validációs listájába kerül (`map-outcome-message-to-error-code.ts`,
`ENGINE_VALIDATION_ERROR_CLASSES`, `unprocessable`). A SPEC-005 8.5 "a mezőút (`invalid_request`) nem
kap strukturált mezőt" mondata ettől nem változik a mentés útjain: a feltöltés hibái nem mezőút
hibák, hanem a 8.5 szótárába eső osztályok.

---

## 6. Az MCP szerver konfiguráció

### 6.1 A tárolt alak és a név hozzárendelés (O-18, O-31)

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

**A központi definíció tárolt alakja** (új tábla, 6.2; a `db` és a `protocol` saját típusa). A
lépés régi `mcpServers` mezőjének `StorableMcpServer` típusa **nem változik** (O-42, 6.2); a
központi definíció a mai három ágból indul, és a `stdio` ágon az `envBindings` mezővel bővül, ami ott
az alapértelmezett hozzárendelés. A "Ma" oszlop a mai `StorableMcpServer` alakja:

| Ág            | Ma                                                                                                                            | Új                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stdio`       | `{ type, command, args, envNames }`; az `envNames` az átadandó változók neve, azonos névvel a szerver környezetében           | `{ type, command, args, envNames, envBindings }`; az `envNames` a **deklarált** nevek listája; az `envBindings` kötelező mező, `Readonly<Record<string, string>>`: deklarált név -> szerver oldali név. Egy deklarált név hiányzó bejegyzése = azonos név |
| `sse`, `http` | `{ type, url, authEnvName }`; az `authEnvName` az `Authorization` fejléc értékét adó szerver oldali változó neve, vagy `null` | változatlan alak; az `Authorization` fejléc az egyetlen deklarált hely, a hozzárendelése az `authEnvName` maga, a felülírás az `authEnvName` felülírása                                                                                                   |

**Visszafelé olvashatóság (kötelező, O-42).** Egy régi gráf és egy régi pillanatkép változatlanul
olvasható marad (`.claude/CLAUDE.md` 10. szekció 2. pont: a pillanatkép megváltoztathatatlan). Ezt az
O-42 (b) döntése adja: a lépés régi `mcpServers` mezője, a `StorableMcpServer` és a guardja bájtra
változatlan, a lépés új hivatkozás mezője elhagyható, és a hiánya az olvasó és a mentő oldalon sem
hiba (a zárt kulcslista guard a hiányzó kulcsot nem tiltja, research 9.1.3). Az `envBindings` csak a
központi definícióban áll, aminek nincs régi sora, ezért ott kötelező. A `protocol` és a `db` oldal
kölcsönös értékadhatóságát az `apps/server` `node-config-drift-protection` témája őrzi
(`.claude/CLAUDE.md` 5. szekció).

**A nevek szabálya.** A szerver oldali és a deklarált név környezeti változó név alakú (a pontos
mintát a PLAN-012 a meglévő `ENV_*` nevek és a `requiredEnv[]` szabály alapján rögzíti, szám és minta
kitalálása nélkül). Az MCP szerver **neve** (a `mcpServers` kulcsa) az eszköznév előtagja
(`mcp__<szerver>__<eszköz>`), és az SDK a `[a-zA-Z0-9_-]` halmazon kívüli jeleket `_`-re cseréli (2.2);
a mentési szabály ezért szűk: a név kizárólag ASCII betűből, számból, `_` és
`-` jelből áll, ami a cserét kizárja, és két különböző név sem ütközhet cserével.

### 6.2 A szerkesztés helye (O-31)

**Döntés (user döntés 2026-10-26: "nem lehet a feluleten megadni mcp-hez es ahol hasznaljuk ott felul
irhato lenne, mert lehet van mondjuk 3 accountom", és "Név hozzárendelés felülírással"):** az MCP
szerverek **központi listája a Beállításokon** áll (3.1 5. kártya). Egy központi definíció: név (a
`mcpServers` kulcsa, 6.1 névszabály), típus, `command` és `args` vagy `url`, a deklarált változó nevek,
és az alapértelmezett hozzárendelés (deklarált név -> szerver oldali név, illetve az `authEnvName`). A
lépés (és az agent definíció) **név szerint hivatkozik** a központi definícióra, és a név
hozzárendelést **felülírhatja**. Így három fiókhoz egy definíció és három lépés három felülírása
tartozik, a definíció ismétlése nélkül. Ez az O-17 korábbi (a) válaszát ("lépésenként, a meglévő
mezőn") felülírja, a user 2026-10-26-i szavai szerint.

**Következmények:**

- A központi definíciók a DB-ben állnak (új tábla, migráció, `check:db-drift` kapu; 9. szekció); titok
  ott sem: csak nevek.
- **A lépés hivatkozása új, elhagyható mezőben áll (O-42, (b), technikai döntés a kódból,
  2026-10-28; research 9. szekció).** A mező (munkanév: `mcpServerReferences`; a végleges nevet a
  T-012-10 rögzíti, és ugyanabban a commitban vezeti át ide és a SPEC-003 4.4-be) kulcsa a központi
  definíció neve (6.1 névszabály), értéke a lépés felülírása, kizárólag nevekkel (a `stdio` ágon
  deklarált név -> szerver oldali név, a `sse` és `http` ágon az `authEnvName` felülírása; a pontos
  mezők a T-012-10 dolga, a 6.4 feloldási sorrend szerint). A mező hiánya és az üres rekord
  ugyanazt jelenti: a lépés nem hivatkozik MCP szerverre.
- **A régi `mcpServers` mező** típusa, guardja és protokoll sémája változatlan. A felület soha nem írt
  bele nem üres értéket (a kezdő config `{}`, a mező csak olvasható), a REST út viszont menthetett
  ilyet, és a motor ma sem adja át (research 9.1.8 ... 9.1.10). Ez a viselkedés marad: a beállítás
  panel csak olvashatóan mutatja (a `SPEC_009_SCOPE_REASON` helyett a régi, a futás által nem
  használt alakot megnevező szöveggel, AC26), a motor nem képezi le, a mentési séma változatlanul
  elfogadja.
- A SPEC-011 O-8 ("A mező marad, a SPEC-009-ben lesz konfigurálva és bekötve") ezzel nem ütközik: a
  lépés MCP konfigurációja a SPEC-009-ben kap felületet és bekötést, a hivatkozás mezőn át; a régi
  mező marad.
- **Az agent definíció** `mcpServers` bejegyzése az `agents` szűkítetlen rekordjában áll
  (`Readonly<Record<string, unknown>>` a `db` és a `protocol` oldalán, `.claude/CLAUDE.md` 5.
  szekció), tehát az O-42 a guardját és a sodródás védelmét nem érinti; a hivatkozás formáját a
  felület mezőtáblája (T-012-23) és a motor leképezése (T-012-11) adja, az SDK név alakja szerint
  (`AgentMcpServerSpec`, telepített `sdk.d.ts:59, 120`).
- **Hivatkozott központi definíció törlése (O-43, user döntés 2026-10-28):** a törlés megengedett akkor
  is, ha egy lépés hivatkozik rá; a futás indítása az új `mcp_server_not_found` hibaosztállyal bukik,
  saját magyar mondattal, a skill törlés (O-13) mintájára (6.4).

A Beállítások kártyája szerverenként egy sort mutat (név, típus, `command` és `args`, vagy `url`, és a
deklarált változók az alapértelmezett hozzárendelésükkel); a hozzáadás és a szerkesztés `Modal`-ban, a
törlés megerősítéssel. Az `args` és a deklarált változó nevek egyértékű lista (`tag-input`, O-19). A
lépés beállítás panelje a központi listából választ, és deklarált változónként mutatja az
alapértelmezett hozzárendelést és a felülírását.

**A szerver oldali név kiválasztása: listából (O-32, user döntés 2026-10-28).** A felület a szerver
gépen beállított env változók **neveit** sorolja fel, értéket soha, és a hozzárendelés szerver oldali
neve (a központi definíció alapértelmezésében és a lépés felülírásában is) ebből a listából választható
(`SelectField`). A listát egy új, csak neveket adó útvonal adja a `protocol` route táblában; a válasz
séma kizárólag név tömböt hordoz, az útvonal neve a PLAN-012 T-012-11-ben rögzül. A kimondott kockázat
(a lista a szerver környezetének minden nevét kiadja) a 11. szekcióban áll. Egy kiválasztott, de azóta
eltűnt név a futás indításakor `missing_mcp_server_env` hibát ad (6.4).

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

| A központi definíció ága                       | SDK alak                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `stdio {command, args, envNames, envBindings}` | `{ type: 'stdio', command, args, env: { <deklarált név>: <érték> ... } }`, ahol az érték a `processEnvironment` port olvasása a **feloldott szerver oldali néven** |
| `sse {url, authEnvName}`                       | `{ type: 'sse', url, headers: { Authorization: <érték> } }`, `null` névnél fejléc nélkül                                                                           |
| `http {url, authEnvName}`                      | `{ type: 'http', url, headers: { Authorization: <érték> } }`, `null` névnél fejléc nélkül                                                                          |

**Mérve (M-139, `docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 3. szekció).** A `stdio` és a `http` sor alakja `connected` állapotot ad. A
`stdio` `env` mező **ráíródik** a CLI környezetére, nem helyettesíti: a gyerek a deklarált neveken túl a
motor teljes kimenő környezetét (`Options.env`, SPEC-012 3.1) is megkapja, a `PATH` és a `HOME`
változóval együtt, tehát a `PATH` és a `HOME` külön átadása nem kell. A deklarált név értéke felülírja a
CLI környezetének azonos nevű változóját. Hogy a gyerek a deklarált neveken kívül mit kaphat, nyitott
kérdés (O-45, 14.9). A `mcpServerStatus()` `config` mezője a `http` és az `sse` `Authorization` értékét
szó szerint visszaadja, ezért a motor ezt a választ nem naplózza és nem írja eseménybe (AC19). Az `sse`
sort a mérés nem vizsgálta. Sikertelen kapcsolatnál (`failed`) a futás nem bukik (O-46, 14.9).

**A lépés hivatkozásának feloldása.** A motor a lépés hivatkozás mezőjének (6.2, O-42) minden kulcsát
a központi definíciók portján oldja fel; a régi `mcpServers` mező értékét nem képezi le (6.2). Ha egy
hivatkozott név nincs a központi listában (a definíciót törölték, O-43), a futás indítása **megnevezett
hibával** bukik: új `mcp_server_not_found` hibaosztály, saját magyar mondattal, ami megnevezi a lépést
és a hiányzó MCP szerver nevét (a `skill_not_found` mintája, O-13).

**A szerver oldali név feloldása** deklarált változónként, sorrendben: (1) a lépés felülírása; (2) a
központi definíció alapértelmezett hozzárendelése (O-31); (3) a deklarált név maga. Az `authEnvName` értéke a teljes
`Authorization` fejléc érték (a `storable-mcp-server.ts` dokumentációja szerint), előtag nélkül.

**Hiányzó szerver oldali változó.** Ha a feloldott szerver oldali név a `processEnvironment` porton
`null`-t ad, a futás indítása **megnevezett hibával** bukik: új `missing_mcp_server_env` hibaosztály,
saját magyar mondattal (a felhasználó a lépést vagy a hozzárendelést javítja, nem a providert), amely
megnevezi az MCP szervert, a deklarált nevet és a **szerver oldali nevet**, értéket soha (a
`missing_provider_env` mintája, `resolve-required-environment-value.ts`). Az érték nem kerül sem a
pillanatképbe, sem a `run_event` táblába, sem a naplóba. Mindkét új hibaosztály (`mcp_server_not_found`
és `missing_mcp_server_env`) a `ProtocolErrorClass` zárt szótárát bővíti, a sodródás védelemmel (motor
oldali osztály, tehát a meglévő részhalmaz szabály alá esik, 5.4 "A kód és a sodródás védelem").

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
a kimondott mondat harmadik fél forrásban áll. **O-38, lezárva (technikai döntés forrásból,
2026-10-28):** az 1. és 2. állítás egy-egy elsődleges forrással és két-két megerősítéssel áll (research
1.1, 1.2), ez a projekt bizonyíték szabályának megfelel (gyökér `CLAUDE.md` 1.), tehát az M-138 mérés
kiesik. A maradék korlátot (a kimondott mondat harmadik féltől való) a PLAN-012 T-012-12a lépése zárja: a
SPEC-012 valódi próba eszköze az izolációs opciókkal fut le a `claude-subscription` providerrel,
kizárólag a user kifejezett engedélyével (SPEC-012 5.3); engedély nélkül a lépés nyitva marad, és a
PLAN-012 zárása ezt kimondja.

**Ami az izolációs módban is érvényes marad** (a `claude-code-features` oldal "What settingSources does
not control" táblája): a managed policy beállítás, a `~/.claude.json` konfig, az auto memory és a
`sandbox.credentials` bejegyzések. A claude.ai MCP connectorokat a `strictMcpConfig: true` zárja ki.

**Az auto memory (O-39, lezárva, technikai döntés forrásból, 2026-10-28):** a kimenő `env` blokk
`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` értéket kap minden agent lépésnél és a kapcsolat tesztnél. Ok: az
O-20 (a) döntés célja, hogy a lépés ne lássa a szerver gép saját Claude állapotát, az auto memory pedig
a `settingSources` értékétől függetlenül betöltődik; a hivatalos izolációs recept a kettőt együtt írja
elő ("set `settingSources: []` plus `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` in `env`",
`claude-code-features` oldal), és a változó jelentését az env-vars és a memory oldal is kimondja ("Set
to `1` to disable auto memory ... Claude does not create or load auto memory files"; research 8.). A
változó a SPEC-012 3.1 összeállítás ráírás lépése után kerül a blokkba, tehát a szerver környezetében
álló más érték nem nyer. A managed policy beállítás és a `~/.claude.json` továbbra is érvényes (a
doksi szerint ezeket a `settingSources` sem vezérli); erre forrásolt kapcsoló nincs.

### 7.2 A kimenő `Options.env` (O-21, H-40): a SPEC-012 végrehajtotta

**Döntés (user döntés 2026-10-26, "Teljes környezet, tiltott változók nélkül"):** a kimenő `env` = a szerver
`process.env`-je, **a provider tiltott változói (`disallowedEnv[]`) kiszűrve**, plusz a provider saját
változói (`requiredEnv[]`). A javítás a SPEC-012-ben készült el (PR #63, `986399a`): a
`buildOutgoingEnvironment` a `ProcessEnvironmentPort.readAll` teljes környezetéből indul, kiszűri a
tiltott neveket, és ráírja a `requiredEnv[]` blokkot (SPEC-012 3.1); a `claude-subscription` tiltott
listája a hitelesítési sorrend szerint bővült (SPEC-012 3.2). A SPEC-013 (`5b1188d`) a `minimax`
kulcsát `process_env_alternatives` forrásra állította: az `ANTHROPIC_AUTH_TOKEN` vagy az
`ANTHROPIC_API_KEY` szerver oldali névből jön, és `ANTHROPIC_AUTH_TOKEN` néven megy ki.

**A SPEC-009 hatása a kimenő környezetre:** kizárólag az O-39 változója (7.1). Az MCP szerverek
változói **nem** a lépés `Options.env` blokkjába kerülnek, hanem a stdio szerver saját `env` mezőjébe
(6.4); a lépés kimenő környezete ettől nem bővül.

---

## 8. A tiltás feloldása és az átvezetések

| Hely                                                                                                                            | Változás                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/greppable-invariants/greppable-invariants.spec.ts:313-317`                                                        | az `outOfScopeThemeNames` halmaz és az állítása törlődik; a (9) címe a `@xyflow/react` szűkítésre rövidül                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| SPEC-008 54. kritérium (`:1521`)                                                                                                | a tiltó mondat helyett: "a `skill-upload` és az `mcp-server-config` téma a SPEC-009 hatóköre, lásd ott"                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| SPEC-008 60. kritérium (`:1530`), 5.2 táblák (`:396-397`, `:413-415`)                                                           | a `skills` és az `mcpServers` "olvasható" helyett "szerkeszthető, SPEC-009 5.2 és 6.2"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| SPEC-008 `:36`, `:37`, `:423`, `:782`, `:790`                                                                                   | a "SPEC-009 hatóköre" mondatok a megvalósult állapotra hivatkoznak                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| SPEC-007 `:35`, `:274`, `:484`, `:682`                                                                                          | ugyanígy; a `:274` (két topnav bejegyzés) és a `:484` (két útvonal) elavult állítása javul (H-22)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `AgentStepConfigFields.tsx:21` és `agent-definition-field-table.ts:35` (`SPEC_009_SCOPE_REASON`)                                | a felhasználónak látható "a SPEC-009 hatóköre" szöveg és a `readonly` vezérlő megszűnik                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `build-agent-step-options.ts:91-94`, `packages/engine/CLAUDE.md:432-434`                                                        | a komment és a szakasz a 6.3 döntés és a megvalósult bekötés szerint                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| SPEC-003 4.4 (`AgentStepConfig`), új szekció a központi MCP definícióra, `packages/db/CLAUDE.md`, `packages/protocol/CLAUDE.md` | a lépés új, elhagyható hivatkozás mezője, a régi `mcpServers` mező változatlan, csak olvasható szerepe (6.2, O-42); a központi definíció tábla a `stdio` ág `envBindings` mezőjével (6.1)                                                                                                                                                                                                                                                                                                                                                                                     |
| SPEC-005 4.2 D és E, 8.3, 8.5                                                                                                   | a `connection-test` válasz `mode` mező nélkül (O-1); a három skill útvonal (a feltöltés nyers bináris törzzsel, O-36); a központi MCP definíció útvonalai (O-31); a csak neveket adó env név útvonal (O-32); az új hibaosztályok a 8.5 szótárában: a motor oldali `skill_not_found`, `mcp_server_not_found` és `missing_mcp_server_env`, plusz az 5.4 tizenöt feltöltési osztálya; a 8.3 táblázatban a feltöltési osztályok `unprocessable` sora; a 8.5 "a mezőút nem kap strukturált mezőt" mondatának kimondott kivétele a skill feltöltésre (O-41, user döntés 2026-10-28) |
| SPEC-004 (a `testProviderConnection` `mode` leírása)                                                                            | a `mode` törlése                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| SPEC-006 4. szekció                                                                                                             | a skill könyvtár env változója és a feltöltés korlátainak alapértéke és felülíró env változója (5.4 6. pont, O-34)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `.claude/CLAUDE.md` 9. szekció                                                                                                  | a "Kapcsolat teszt" gomb mondata: a provider választó része mindenhol, "örökölt" választásnál tiltott (O-2); 13. szekció új sor a SPEC-009-re; 4. szekció a nem ellenőrzött jelölés konvenció alkalmazása a 2.3 szekcióra. Az 5. szekció `ProtocolErrorClass` bekezdése és a 11. szekció "Ismert okokra saját mondat" pontja az O-41 és O-43 szerint 2026-10-28-án átvezetve (PLAN-012 T-012-5)                                                                                                                                                                               |
| `docs/research/2026-10-26-hatokor-hianyleltar.md`                                                                               | minden tétel gazdája és döntése kitöltve (7. szekció, lezáró commit SHA-val)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `docs/research/2026-08-26-toolchain.md`                                                                                         | a `yauzl` és a `@types/yauzl` rögzített verziója (O-33), két forrással (research 7.5), a bevezetés commitjában                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## 9. Hova kerül a kód

| Csomag              | Téma (új vagy bővülő)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/protocol` | `skill` (új: lista, feltöltés, törlés sémái), `mcp-server-definition` (új: a központi definíció sémái, a `stdio` ágon az `envBindings`), egy új téma a csak neveket adó env név útvonal válasz sémájának (O-32; a neve a T-012-11-ben rögzül), `provider` (a `mode` törlése), `node-config` (a lépés új, elhagyható hivatkozás mezője, O-42; a `StorableMcpServer` változatlan), `protocol-error` (új hibaosztályok: `skill_not_found`, `mcp_server_not_found`, `missing_mcp_server_env` és az 5.4 tizenöt feltöltési osztálya)                                                                                                                   |
| `packages/engine`   | `agent-step` (`mcpServers` a hivatkozás mezőből, `plugins`, `settingSources`, `strictMcpConfig`, `skills` előtag), `provider-environment` (az O-39 változója a kimenő blokkban), `run-validation` (hiányzó skill, `skill_not_found`, O-13; hiányzó központi MCP definíció, `mcp_server_not_found`, O-43; hiányzó szerver oldali változó, `missing_mcp_server_env`, O-18), `engine-error` (a három új `EngineErrorKind`), `engine-port` (kapcsolat teszt `mode` nélkül; új port a skill könyvtárhoz és a központi MCP definíciókhoz), `capability-policy` (a `resolve-connection-test-mode` törlése)                                               |
| `packages/db`       | `workflow-graph/agent-step-config` (a lépés új, elhagyható hivatkozás mezője a guarddal, O-42; a `StorableMcpServer` és a régi `mcpServers` mező változatlan); új téma a központi MCP definícióra (tábla, repository, migráció, `check:db-drift`, a `drizzle.config.ts` fájllistája)                                                                                                                                                                                                                                                                                                                                                              |
| `apps/server`       | `skill-endpoint` (új, a `yauzl` függőséggel, a tizenöt feltöltési hibaosztály egyetlen táblában), `mcp-server-definition-endpoint` (új), a csak neveket adó env név útvonal kezelője (új, O-32), `server-config` (a skill könyvtár útvonala és a zip korlátok alapértéke, O-34), `http-server` (nyers bináris törzs korláttal, O-36), `route-registry`, `error-mapping` (a feltöltési osztályok `unprocessable` kódra, a három motor osztály a motor validációs listájában), `error-class-drift-protection` (a szerver oldali feltöltési osztályok a típusszintű `Exclude` ágban, O-41), `node-config-drift-protection` (a hivatkozás mező, O-42) |
| `packages/ui`       | az átemelt elemek: `Switch` (O-7), `FileUpload` és `Empty` (O-15), `TagInput` (O-19), bájtazonos CSS-sel (SPEC-007 precedens)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web`          | `settings-screen` (bővül), `skill-upload` (új), `mcp-server-config` (új: a központi lista kártyája, a lépés hivatkozás mezője, a szerver oldali név választó a csak neveket adó útvonal listájából, O-32), a provider választó bővítése a "Kapcsolat teszt" gombbal, `workflow-list` ("Workflow szerkesztése" modális, O-3), `node-inspector` (a két mező; a régi `mcpServers` csak olvasható), `protocol-error-message` (az új hibaosztályok magyar mondatai, O-41, O-43)                                                                                                                                                                        |

A skill könyvtár a fájlrendszeren áll (O-9), ezért a skillhez nincs tábla. Az O-31 döntés miatt a
központi MCP definíciók **új DB táblában** állnak (migráció, `check:db-drift` kapu), és a lépés tárolt
alakja a JSON dokumentum egy új, elhagyható mezőjével bővül (O-42). Új workspace csomag nincs (a 19 marad, a
`package-layer.ts` réteg térképe nem változik); a `yauzl` és a `@types/yauzl` az `apps/server`
függősége.

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
- **Sodródás védelem**: az új hibaosztályok az `error-class-drift-protection` témában (a tizenöt
  szerver oldali feltöltési osztály a típusszintű `Exclude` ágban, a három motor oldali osztály a
  részhalmaz szabály alatt); a lépés hivatkozás mezője a `node-config-drift-protection` témában, a
  régi gráf és pillanatkép tesztjével (research 9.5).

---

## 11. Kockázatok

| Kockázat                                                                        | Kezelés                                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A doksi újabb SDK verziót ír le, mint a pinelt `0.3.245`                        | a d.ts mérvadó, a mérések a pinelt verzióval futnak (4.)                                                     |
| Az izolációs mód elveszi a `claude-subscription` hitelesítést                   | forrásból nem várható (7.1, O-38 lezárva); a PLAN-012 T-012-12a valódi próbája a user engedélyével ellenőrzi |
| A feltöltött ZIP rosszindulatú (útvonal bejárás, szimbolikus link, zip bomba)   | 5.4 követelmények, mindegyikre teszt; a korlátok forrásolt alapértékkel (5.4 6. pont, O-34)                  |
| A skill futtatható scripteket hordoz                                            | kimondott korlát: a skill "context filter, not a sandbox" (d.ts `:2028`), a szerver `127.0.0.1`-re köt       |
| A skill könyvtárat a fájlrendszeren bárki írhatja, aki a szerver gépen dolgozik | ugyanaz                                                                                                      |
| Egy MCP szerver neve ütközik a gyári vagy a plugin MCP nevével                  | a `strictMcpConfig: true` (O-20) kizárja a többi forrást                                                     |
| A szerver oldali változó név lista (O-32 (a)) az env összes nevét kiadja        | csak nevek, értékek soha; a szerver `127.0.0.1`-re köt; a lista a user 2026-10-28-i döntése (O-32)           |
| A kimenő `env` hibája (H-40)                                                    | a SPEC-012 javította (`986399a`); a PLAN-012 előfeltétele teljesült                                          |

---

## 12. Elfogadási kritériumok

### Beállítások képernyő

1. A `/settings` képernyő a 3.1 hat kártyáját mutatja egymás alatt, kártya a kártyában nélkül; a módosító
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
11. A ZIP feltöltés az 5.4 minden pontját betartja: minden elutasítási ágra szintetikus zip teszt, ami
    a válasz törzsében az 5.4 táblázat saját hibaosztályát és az `unprocessable` kódot állítja, a
    sikeres feltöltés a skill könyvtárban `skills/<név>/...` alakban áll, az atomi csere hibánál a régit
    érintetlenül hagyja (szerver unit teszt ideiglenes könyvtárral); a felület mind a tizenöt osztályra
    saját magyar mondatot mutat (O-41; unit a leképezésre, e2e legalább a "túl nagy" és a "hiányzó
    `SKILL.md`" esetre).
12. A skill neve a feltöltéskor megadott név, a névszabály (5.4 5. pont), a frontmatter `name`
    eltérésének elutasítása és hiányának elfogadása (O-37), a két elfogadott elrendezés (O-35) és a
    korlátok (5.4 6. pont: a 30 000 000 bájtos összméret és törzs, az 1024 bejegyzés, mindegyik a
    határon és eggyel fölötte) teszttel rögzítve.
13. Az agent lépés `Options` objektuma tartalmazza a `plugins` bejegyzést a skill könyvtárra, ha a
    `skills` mező nem `null`, és nem tartalmazza, ha `null` (O-40), és a `skills` lista elemei az 5.3 szerinti alakban mennek ki (motor unit
    teszt).
14. A törölt, de hivatkozott skillre a futás indítása `skill_not_found` hibát ad, és a felület saját
    magyar mondatot mutat (motor unit, szerver végponttól végpontig, e2e).
15. A lépés és az agent definíció `skills` mezője szerkeszthető, módválasztóval és `Checkbox` listával
    (unit és e2e a mentés `PUT` törzsével).

### MCP

16. A lépés és az agent definíció MCP hivatkozása szerkeszthető: a központi listából választ, és a
    hozzárendelés felülírása mindhárom ágra (a `stdio` deklarált nevei, a `sse` és `http` `authEnvName`
    mezője); a szerver oldali név a csak neveket adó útvonal listájából választható, és a válasz értéket
    soha nem hordoz (O-32); a mentés `PUT` törzse a hivatkozás mezőt (O-42) nevekkel hordozza, értéket
    nem, és a régi `mcpServers` értéket változatlanul visszaküldi (e2e).
17. A központi MCP lista a Beállításokon szerkeszthető (hozzáadás, szerkesztés, törlés), a lépés név
    szerint hivatkozik rá, és a lépés felülírása felülírja a központi alapértelmezett hozzárendelést
    (O-31); a hivatkozott definíció törlése megengedett, és utána a futás indítása `mcp_server_not_found`
    hibát ad, a felület saját magyar mondatával (O-43; motor unit teszt, szerver REST teszt valós
    `:memory:` adatbázison és e2e).
18. A motor a 6.4 táblázat mindhárom sorát leképezi, a három szintű feloldás sorrendje teszttel rögzítve,
    a hiányzó szerver oldali névre `missing_mcp_server_env` hibát ad a névvel, értékkel soha (motor unit
    teszt minden ágra).
19. Az env érték nem jelenik meg a `run_event` táblában, a pillanatképben és a naplóban (szerver
    végponttól végpontig, a `MINIMAX_API_KEY` precedens mintájára greppes ellenőrzéssel a kimeneten).
20. Egy régi gráf és pillanatkép (a hivatkozás mező nélkül, üres és nem üres régi `mcpServers`
    értékkel) változatlanul olvasható a `readGraph`, a `readGraphSnapshot`, a protokoll olvasó sémái és a
    motor indítási ellenőrzése úton, és a régi `mcpServers` érték nem kerül a kimenő `Options`-ba; a v1
    pillanatkép fixtúra lenyomat tesztje változatlanul zöld; a `node-config-drift-protection` zöld
    (O-42, research 9.5).
21. A `build-agent-step-options.ts` kommentje és a `packages/engine` `CLAUDE.md` a 6.3 döntést mondja ki;
    `git grep -n "bekötése a SPEC-009 hatóköre" -- packages apps` nulla találat.

### Izoláció és környezet

22. Az agent lépés `Options` objektuma minden lépésnél tartalmazza a `settingSources: []` és a
    `strictMcpConfig: true` mezőt (motor unit teszt, szerver végponttól végpontig).
23. A kimenő `env` blokk minden agent lépésnél és a kapcsolat tesztnél `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`
    értéket hordoz, a szerver környezetében álló más érték mellett is (O-39; unit teszt az `Options.env`
    blokkon).
24. A SPEC-012 bemergelve (teljesült, `986399a`); ez a spec a kimenő `env` blokkot kizárólag az O-39
    szerinti egy változóval egészíti ki (unit teszt: a blokk a SPEC-012 3.1 kimenete plusz ez az egy név).

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
- **Egy deklarált név hiányzó hozzárendelése = azonos név** (6.1, 6.4 (3)); a régi gráf és pillanatkép
  olvashatóságát az O-42 (b) adja (`.claude/CLAUDE.md` 10. szekció 2. pont).
- **A technikai kérdések forrásból eldöntve** (2026-10-28): O-35 (elrendezés), O-36 (átvitel), O-37
  (frontmatter név), O-38 (az M-138 kiváltása), O-39 (auto memory), O-40 (`skills: null`); a források a
  research 7. és 8. szekciójában. Az O-42 (a lépés MCP mezőjének tárolt alakja) a kódból eldöntve, a
  research 9. szekciójában.

---

## 14. Nyitott kérdések és döntések

A 14.1 ... 14.6 szekció kérdéseit a user 2026-10-26-án megválaszolta; a sorok **"Lezárva"** jelöléssel a
táblában maradnak, hogy a döntés és az indok nyomon követhető legyen. A 14.7 szekció kérdései a
2026-10-26-i döntésekből következtek; mind lezárva: az O-31, O-33 és O-34 a user 2026-10-26-i, az
O-32, O-41 és O-43 a user 2026-10-28-i döntésével (a 14.8 szekció kérdéseire adott válaszok), az
O-35 ... O-40 forrásból, az O-42 a kódból hozott technikai döntéssel (2026-10-28). **Nyitott kérdés: a 14.9 szekció
három sora (O-44, O-45, O-46)**, a 4. szekció méréseiből (2026-10-28).

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
| O-17 | Hol konfigurálható az MCP szerver           | (a) lépésenként, a meglévő `mcpServers` mezőn; (b) globális MCP könyvtár a Beállításokon, a lépés név szerint hivatkozik; (c) mindkettő                                                                                                    | **Lezárva, felülírva**: az eredeti (a) válaszát (user döntés 2026-10-26) a user ugyanaznapi újabb döntése felülírta, lásd O-31: központi lista a Beállításokon, a lépés név szerint hivatkozik és a hozzárendelést felülírhatja (a (b) opció a felülírással). Hatás: 6.2.                                                                                                                                                                                                                                                                                                                                                                      |
| O-18 | Az MCP szerver környezeti változói          | az eredeti kérdés: (a) új `missing_mcp_server_env` osztály saját mondattal; (b) a `missing_provider_env` újrahasználata; **új irány (user)**: a felületen megadható, és ott felülírható, ahol használjuk ("lehet van mondjuk 3 accountom") | **Lezárva**, "Név hozzárendelés felülírással" (user döntés 2026-10-26): a titok értéke a szerver környezetében áll (például `GITHUB_TOKEN_CEG`, `GITHUB_TOKEN_SAJAT`); az MCP szerver deklarálja a változó neveit, amiket a folyamata vár; a felületen az egyes változókhoz azt választod ki, melyik szerver oldali változó NÉV kerüljön bele; a hozzárendelés a lépésben felülírható. A titok szabály marad (a DB csak nevet tárol). Hiányzó szerver oldali változónál a futás indítása új `missing_mcp_server_env` hibával bukik, saját magyar mondattal. Hatás: 6.1, 6.4, AC16 ... AC20. A definíció helye: O-31, a név kiválasztása: O-32. |
| O-19 | Az `args` és a változó név listák vezérlője | (a) a design system `tag-input` átemelése; (b) `TextAreaField`, soronként egy érték                                                                                                                                                        | **Lezárva**, (a) (user döntés 2026-10-26). Hatás: 3.4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### 14.4 Izoláció

| #    | Kérdés                                                  | Opciók                                                                                                              | Állapot és döntés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-20 | Lássa-e a lépés a szerver gép saját Claude beállításait | (a) nem: `settingSources: []` és `strictMcpConfig: true`; (b) igen, mint ma; (c) csak a `project` forrás            | **Lezárva**, (a) (user döntés 2026-10-26). A feltétel (az M-138) **forrásból eldöntve**: a `settingSources` a hivatalos doksi szerint a beállítás fájlokat vezérli, a `/login` hitelesítés Keychainben vagy `.credentials.json` fájlban áll, az SDK nem ad `--bare` kapcsolót (7.1). A mérés kikerül, **korlátozással**: a "az előfizetéses bejelentkezés él" mondat csak harmadik fél forrásban áll kimondva; a megerősítés az O-38 kérdés. Hatás: 7.1, AC22.                                        |
| O-21 | Mi kerüljön a kimenő `env` blokkba                      | (a) az M-137 eredményéig semmi; utána egy megnevezett zárt lista; (b) a teljes `process.env` a tiltott nevek nélkül | **Lezárva**, "Teljes környezet, tiltott változók nélkül" (user döntés 2026-10-26): a kimenő `env` = a szerver `process.env`-je, a provider tiltott változói (`disallowedEnv[]`) kiszűrve, plusz a provider saját változói. A user rámutatott, hogy a hivatalos doksi ezt leírja, ezért az M-137 mérés **kikerült**. A mai kódban ez **hiba**; a javítás helye egy külön, elsőként végrehajtandó kis spec, a SPEC-009 csak hivatkozik rá. Hatás: 7.2, AC24. Végrehajtva: SPEC-012, PR #63 (`986399a`). |

### 14.5 Mérés jóváhagyás

| #    | Kérdés                                                        | Opciók                                                | Állapot és döntés                                                                                                                                                                                                                         |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-22 | Futhat-e valódi `claude-subscription` hívás az M-138 méréshez | (a) igen, egy rövid lépés; (b) nem, az O-20 (b) marad | **Lezárva**: nem szükséges, mert az O-20 forrásból eldöntve (a user feltétele: "csak ha az O-20 forrásból nem dönthető el"). Ha a user az O-38-ra mérést kér, a hívás jóváhagyása akkor kerül elő, az első, külön spec valódi próbájában. |

### 14.6 A hiányleltár többi tételének besorolása

| #    | Tétel                                                        | Opciók                                                                                        | Állapot és döntés                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| O-23 | H-13 `script` csomópont végrehajtása                         | (a) saját spec; (b) SPEC-009                                                                  | **Lezárva**: saját spec, később (user döntés 2026-10-26). Gazda: "külön spec: szkript csomópont" (ideiglenes név).                                                                                                                                                       |
| O-24 | H-17 strukturált kimenet séma szerinti ellenőrzése           | (a) saját spec; (b) SPEC-009                                                                  | **Lezárva**: saját spec (user döntés 2026-10-26). Gazda: "külön spec: strukturált kimenet séma ellenőrzés" (ideiglenes név).                                                                                                                                             |
| O-25 | H-12 `StartInputField.valueKind` értékkészlete               | (a) saját spec a futás bemenet típusaira; (b) a mező törlése; (c) SPEC-009                    | **Lezárva**: saját kis spec (user döntés 2026-10-26). Gazda: "külön spec: Start bemenet valueKind" (ideiglenes név).                                                                                                                                                     |
| O-26 | H-11 `join` `merge` `settings`                               | (a) marad a SPEC-004 O-6 gazdájánál; (b) a mező elrejtése a szerkesztőből                     | **Lezárva**: a mező **kikerül a felületről és az adatszerkezetből**, egy külön kis javító PR-ban, nem a SPEC-009-ben (user döntés 2026-10-26). Gazda: "külön kis javító PR: join merge settings törlése". A SPEC-004 O-6 lezárása ennek a PR-nak a dolga.                |
| O-27 | H-18 `error_handler` várakozás nem szakítható meg            | (a) hibajavítás regressziós teszttel, saját kis PR-ben; (b) SPEC-009                          | **Lezárva**: hibajavítás most, külön PR (user döntés 2026-10-26). Gazda: "külön PR: error_handler megszakítható várakozás".                                                                                                                                              |
| O-28 | H-20 `readRunEvents` útvonal web fogyasztó nélkül            | (a) a SPEC-005 kimondja, hogy nem felületi útvonal, és marad; (b) törlés; (c) felület épül rá | **Lezárva**, (a): az útvonal marad, a SPEC-005 kimondja, hogy nem felületi útvonal (user döntés 2026-10-26). Gazda: ugyanaz a kis javító PR, mint az O-26.                                                                                                               |
| O-29 | H-42 nincs helyi indítási út, és nincs valódi provider próba | (a) saját kis spec; (b) SPEC-009 része                                                        | **Lezárva**: saját kis spec, **elsőként végrehajtva** (user döntés 2026-10-26); ide kerül az O-21 kimenő `env` javítása is. Gazda: "külön spec: helyi indítás, valódi próba és a kimenő környezet javítása" (ideiglenes név). Végrehajtva: SPEC-012, PR #63 (`986399a`). |
| O-30 | H-23, H-24, H-25 elavult kommentek és doksik                 | (a) egy önálló doksi javító PR; (b) a PLAN-012 átvezetési lépése                              | **Lezárva**: önálló javító PR (user döntés 2026-10-26). Gazda: "külön PR: elavult kommentek és doksik".                                                                                                                                                                  |

### 14.7 A 2026-10-26-i döntésekből következő kérdések

| #    | Kérdés                                                                                                                         | Opciók                                                                                                                                                                                                                                        | Állapot és döntés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O-31 | Hol áll az MCP szerver **definíciója**, ha a név hozzárendelés felülírható a használat helyén (az O-17 és az O-18 feszültsége) | (a) központi MCP szerver definíció a Beállításokon, a lépés név szerint hivatkozik rá és felülírhatja a hozzárendelést; (b) lépésenkénti definíció a hozzárendeléssel együtt; (c) mindkettő                                                   | **Lezárva**, (a) (user döntés 2026-10-26: "nem lehet a feluleten megadni mcp-hez es ahol hasznaljuk ott felul irhato lenne, mert lehet van mondjuk 3 accountom", és "Név hozzárendelés felülírással"): központi MCP lista a felületen, a lépésen a név hozzárendelés felülírható; az MCP szerverhez env változó NEVEK listája tartozik, titok soha nem kerül DB-be. Hatás: 3.1, 6.1, 6.2, 6.4, 9., AC17; új DB tábla és migráció; az O-17 (a) felülírva; a lépés mező alakja az O-42.                                                                      |
| O-32 | Hogyan adható meg a **szerver oldali változó neve** a hozzárendelésnél                                                         | (a) lista a szerver környezetének változó neveiből (új, csak neveket adó végpont, értéket soha); (b) szabad szövegű mező, a hiányzó változót a futás indítása jelzi                                                                           | **Lezárva**, (a) (user döntés 2026-10-28: listából választja a user): a felület a szerver gépen beállított env változók NEVEIT sorolja fel, értéket soha, és ebből választ; új, csak neveket adó végpont. Hatás: 6.2, 9., AC16, AC17; PLAN-012 T-012-11, T-012-23.                                                                                                                                                                                                                                                                                         |
| O-33 | Melyik **zip kezelő** csomagolja ki a feltöltést                                                                               | (a) `node:zlib` ZIP API (kísérleti, a rögzített Node-ban nincs); (b) `yauzl`; (c) más jelölt                                                                                                                                                  | **Lezárva**, (b) `yauzl` (user döntés 2026-10-26). A verzió élő registryből és egy második forrásból: `yauzl` `3.4.0` (függősége `pend` `~1.2.0`, `engines.node >=12`), `@types/yauzl` `3.4.0` (research 7.5); a `docs/research/2026-08-26-toolchain.md` fájlba a bevezetés commitjában kerül (8. szekció). Használat: `lazyEntries: true` (a README szerint a sok bejegyzéses zip memóriáját ez tartja kézben), `validateEntrySizes: true`, `strictFileNames: true` (a visszaper tiltása, 5.4 2. pont). Hatás: 5.4, 9.                                    |
| O-34 | Mik a zip **korlátai**                                                                                                         | (a) kötelező konfiguráció alapérték nélkül; (b) szám a specben; (c) korlát nélkül                                                                                                                                                             | **Lezárva** (user döntés 2026-10-26: a korlátokra forrást kell keresni, nem a usertől kérni): forrásolt alapérték a kódban, env változóval felülírható (a SPEC-012 4.2 mintája): kicsomagolt összméret 30 000 000 bájt (Anthropic Skills API), törzs 30 000 000 bájt (levezetett), legfeljebb 1024 bejegyzés (SEI CERT IDS04-J), külön tömörítési arány korlát nincs (5.4 6. pont, research 7.).                                                                                                                                                           |
| O-35 | A zip **belső elrendezése**                                                                                                    | (a) a `SKILL.md` a zip gyökerében; (b) pontosan egy legfelső szintű mappa; (c) mindkettő                                                                                                                                                      | **Lezárva**, (c) (technikai döntés forrásból, 2026-10-28): az Anthropic Skills API mindkettőt elfogadja ("Must include a `SKILL.md` file at the upload root (or at the top of a single enclosing folder)"), a claude.ai feltöltés a mappás alakot írja elő; a (c) mindkét forrás szerint készült zipet elfogadja (research 7.6). Hatás: 5.4 4. pont, AC12.                                                                                                                                                                                                 |
| O-36 | A feltöltés **átviteli alakja**                                                                                                | (a) JSON törzs base64 tartalommal; (b) nyers bináris törzs (`application/zip`), a név útvonal paraméter                                                                                                                                       | **Lezárva**, (b) (technikai döntés forrásból, 2026-10-28): a base64 négy karaktert ír minden három bájtra (RFC 4648 4.), tehát a törzs korlát a zip méretétől elcsúszna; a nyers törzsre a 30 000 000 bájtos korlát közvetlenül a zip méretére szól, és a `yauzl` a pufferből olvas (`fromBuffer`). Az Anthropic Skills API is bináris (multipart) feltöltést használ, nem base64 JSON-t (research 7.7). Útvonal: `PUT /api/skills/:name`; új route fajta a `protocol` route táblában és az `apps/server` `http-server` témában. Hatás: 5.1, 8., 9.        |
| O-37 | Mi történik, ha a `SKILL.md` frontmatter `name` mezője **eltér** a megadott névtől, vagy hiányzik                              | (a) eltérés: elutasítás; hiány: elfogadva; (b) a rendszer átírja; (c) figyelmen kívül hagyja                                                                                                                                                  | **Lezárva**, (a) (technikai döntés forrásból, 2026-10-28): az Agent Skills specifikáció és az Anthropic doksi szerint a `name` egyezik a könyvtárnévvel (research 3.4), a könyvtárnév a megadott név (O-12), tehát az eltérő `name` a specifikációt sértő skillt adna; a Claude Code a hiányzó `name` helyett a könyvtárnevet használja (research 3.3); a feltöltött tartalmat nem módosítjuk. Az M-136 második esete méri, mit tesz az SDK eltérésnél (a szabály ettől nem függ). Hatás: 5.4 5. pont, AC12.                                               |
| O-38 | Elfogadhatók-e a 7.1 forrásai az **M-138 mérés kiváltására**                                                                   | (a) igen; (b) nem, valódi hívással                                                                                                                                                                                                            | **Lezárva**, (a) (technikai döntés forrásból, 2026-10-28): a két állítás egy elsődleges forrással és két megerősítéssel áll, ez a gyökér `CLAUDE.md` 1. szekció bizonyíték szabálya; a maradék korlátot a PLAN-012 T-012-12a valódi próbája zárja, kizárólag a user engedélyével (7.1). Az O-22 ezzel nem nyílik újra.                                                                                                                                                                                                                                     |
| O-39 | Kapcsolja-e ki a rendszer az **auto memory**-t is                                                                              | (a) igen, `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`; (b) nem                                                                                                                                                                                        | **Lezárva**, (a) (technikai döntés forrásból, 2026-10-28): az O-20 (a) user döntés célját (a lépés ne lássa a gép saját Claude állapotát) a `settingSources: []` az auto memory-ra nem teljesíti; a hivatalos izolációs recept a változót előírja, a jelentését két további hivatalos oldal kimondja (research 8.). Hatás: 7.1, AC23, AC24.                                                                                                                                                                                                                |
| O-40 | A `skills: null` jelentése és a `plugins` opció feltétele                                                                      | (a) `null`: nincs `plugins`; (b) a `plugins` mindig megy                                                                                                                                                                                      | **Lezárva**, (a) (technikai döntés forrásból, 2026-10-28): a `skills` elhagyásakor a d.ts szerint "not skills off", a CLI alapértelmezése dönt (`sdk.d.ts:2015-2037`), ami nem ellenőrzött; az (a) ettől nem függ, és a három tárolt állapot ("nincs beállítva", "minden", lista) egyértelmű jelentést kap. Hatás: 5.1, 5.2, AC13.                                                                                                                                                                                                                         |
| O-41 | A skill feltöltés hibáinak **felületi megjelenése**                                                                            | (a) okonként saját magyar mondat (a hibaosztály szótár szerver oldali osztályokkal bővül, a 2026-09-26-i szótár szabály módosul); (b) egy általános mondat a meglévő `invalid_request` kóddal; (c) zárt `reason` mező a szótártól függetlenül | **Lezárva**, (a) (user döntés 2026-10-28: pontos ok, például "A csomag túl nagy", "Hiányzik a SKILL.md"): a SPEC-005 8.5 zárt szótára az 5.4 tizenöt szerver oldali feltöltési osztályával bővül, a kliens a meglévő `protocol-error-class-message` minta szerint saját magyar mondatot rendel hozzájuk; ez a 2026-09-26-i szótár szabály kimondott bővítése. Hatás: 5.4, 8., 9., AC11; PLAN-012 T-012-8, T-012-24.                                                                                                                                        |
| O-42 | A lépés MCP mezőjének **tárolt alakja** a központi lista mellett (O-31)                                                        | (a) a meglévő `mcpServers` mező értéke név hivatkozás plusz felülírás lesz; (b) új mező a hivatkozásnak, a meglévő `mcpServers` csak olvasható marad                                                                                          | **Lezárva**, (b) (technikai döntés a kódból, 2026-10-28, PLAN-012 T-012-5a; research 9. szekció): a pillanatkép megváltoztathatatlan, a REST út nem üres régi `mcpServers` értéket is menthetett, tehát az (a) a régi és az új alak unióját követelné a `db`, a `protocol` és a felület minden rétegében; a (b)-ben a régi mező és a sodródás védelme bájtra változatlan, az új mező elhagyható, és a zárt kulcslista guard a hiányát eleve elfogadja, halott ág nélkül. Hatás: 6.1, 6.2, 6.4, 9., 13., AC16, AC20; PLAN-012 T-012-10, T-012-11, T-012-23. |
| O-43 | Törölhető-e egy **központi MCP szerver**, amire lépés hivatkozik                                                               | (a) igen, a futás indítása megnevezett hibával bukik (a skill törlés O-13 mintája); (b) nem, amíg lépés hivatkozik rá                                                                                                                         | **Lezárva**, (a) (user döntés 2026-10-28): a törlés hivatkozás mellett is megengedett, a workflow indítása az új `mcp_server_not_found` hibaosztállyal és saját magyar mondattal bukik (a `skill_not_found` mintája). Hatás: 3.1, 6.2, 6.4, 9., AC17; PLAN-012 T-012-10, T-012-11, T-012-23, T-012-24.                                                                                                                                                                                                                                                     |

### 14.8 Kérdések a usernek (megválaszolva 2026-10-28)

A három kérdés a PLAN-012 T-012-5 lépésében ment ki, az ajánlott válasz az első. **Mindhárom kérdésre
a user az ajánlott választ adta (2026-10-28)**; a döntések a 14.7 szekció O-32, O-41 és O-43 sorában
állnak. A kérdések szövege a nyomon követhetőség miatt marad.

1. **O-32. Hogyan adod meg, melyik titkot (szerver oldali változót) kapja egy MCP szerver?**
   - **Listából választod (ajánlott).** A felület felsorolja a szerver gépen beállított változók nevét
     (az értéküket soha), és te kiválasztod a megfelelőt; elgépelni nem lehet.
   - **Begépeled a nevet.** Nincs lista, bármit beírhatsz; ha elírod, csak a workflow indításakor kapsz
     hibát.
2. **O-41. Ha egy skill feltöltése nem sikerül, milyen hibaüzenetet látsz?**
   - **Pontos okot (ajánlott).** Például "A csomag túl nagy" vagy "Hiányzik a SKILL.md"; azonnal tudod,
     mit javíts.
   - **Egy általános üzenetet.** "A feltöltés nem sikerült"; az okot neked kell kitalálnod.
3. **O-43. Törölhetsz-e egy MCP szervert a Beállításokban, ha egy workflow lépése még használja?**
   - **Igen, és a workflow indításakor szól a rendszer (ajánlott).** Ugyanígy működik, mint a skill
     törlése: a törlés megy, a lépés indításakor megnevezett hiba jelzi, mit kell pótolni.
   - **Nem, amíg használja valami.** A törlés tiltott, amíg minden hivatkozó lépésből ki nem veszed.

### 14.9 A mérésből következő kérdések (nyitva, 2026-10-28)

A sorok az M-136 és az M-139 eredményéből jönnek (`docs/research/2026-10-28-spec-009-blokkolo-meresek.md` 4. szekció); mindhárom termékdöntés, a user
válaszára vár.

| #    | Kérdés                                                                                                                                                                                                                          | Opciók (ajánlott elsőként)                                                                                                                                                                                                                                                          | Mi a viselkedés addig                                                         | Mi zárná le                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| O-44 | A `skills: null` ("nincs beállítva") lépésen a CLI beépített skilljei (például `simplify`, `claude-api`, `init`, `security-review`) a modell elé kerülnek és hívhatók (M-136 3b), a lista és a `'all'` mód (5.3) ezeket elrejti | (a) a `null` jelentése "skill nélkül": a motor `skills: []` opciót ad, `plugins` nélkül; (b) marad az O-40 (a): sem `plugins`, sem `skills`, a beépítettek elérhetők                                                                                                                | az O-40 (a) és az AC13 szerint (nincs `plugins`, nincs `skills`)              | a user döntése; az AC13 átírása                                |
| O-45 | A stdio MCP szerver folyamata a motor teljes kimenő környezetét örökli (M-139 3. pont): a provider kulcsát és a szerver környezetének minden változóját, a "három fiók" esetben a másik két fiók tokenjét is                    | (a) a szerver egy saját indító programon át indítja a stdio parancsot, ami a gyereknek csak a deklarált neveket, a `PATH` és a `HOME` változót adja (a d.ts-ben nincs opció az öröklés kikapcsolására); (b) kimondott kockázatként elfogadjuk, a felület és a dokumentáció kimondja | a 6.4 leképezés változatlan; a stdio gyerek a teljes kimenő környezetet kapja | a user döntése; (a) esetén a 6.3, 6.4 és a 9. szekció bővítése |
| O-46 | Egy hivatkozott MCP szerver sikertelen kapcsolódásánál (`failed`) a futás nem bukik, az agent az eszközei nélkül fut (M-139 2. pont)                                                                                            | (a) a motor a kapcsolódás állapotát a `mcpServerStatus()` válaszából ellenőrzi, és `failed` állapotnál a lépés megnevezett hibával bukik (új hibaosztály, saját magyar mondattal); (b) marad: a lépés fut, az állapot csak az SDK `init` üzenetében látszik                         | a lépés fut, a sikertelen szerver eszközei hiányoznak                         | a user döntése                                                 |

---

## 15. Kapcsolódó dokumentumok

- [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md)
- [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md)
- [`../research/2026-10-26-spec-009-forrasok.md`](../research/2026-10-26-spec-009-forrasok.md)
- [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md), 5.2, 5.11, 54. és 60. kritérium
- [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md), 4.4, 4.13, 4.14, 6.6, 11.
- [`SPEC-011-eszkoz-lanc-torles.md`](SPEC-011-eszkoz-lanc-torles.md), 3.2 és O-8
