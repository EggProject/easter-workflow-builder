# SPEC-009: Beállítások és agent konfiguráció

|          |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Státusz  | tervezet, 2026-10-26; jóváhagyásra vár; a 14. szekció minden nyitott kérdése a user döntésére vár, a 4. szekció blokkoló mérései még nem futottak                                                                                                                                                                                                                                                                                                                                                      |
| Dátum    | 2026-10-26                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Előzmény | [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md) (4.4, 4.13, 4.14, 6.6, 11.), [`SPEC-005-api-protokoll.md`](SPEC-005-api-protokoll.md) (4.2 D és E), [`SPEC-007-frontend-alkalmazas.md`](SPEC-007-frontend-alkalmazas.md) (`:35`, `:274`, `:484`, `:682`), [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md) (5.2, 5.11, 54. és 60. kritérium), SPEC-011 (az in-process eszköz lánc törlése, a `feat/spec-011-eszkoz-lanc-torles` ágon) |
| Bemenet  | [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md) (a hatókör hiányleltár, H-01 ... H-42)                                                                                                                                                                                                                                                                                                                                                                |
| Kimenet  | a `/settings` képernyő bővítése (globális provider, kapcsolat teszt, párhuzamossági korlát, delta kapcsoló, skill könyvtár), a workflow szintű provider utólagos módosítása, a lépés `skills` és `mcpServers` mezőjének szerkesztése, a két mező bekötése az SDK `query()` hívásig, a greppes invariáns (9) tiltásának feloldása                                                                                                                                                                       |
| Terv     | [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md)                                                                                                                                                                                                                                                                                                                                                                                       |

**A számozás megfeleltetése.** A spec és a terv sorszáma ennél a specnél elválik: a
`PLAN-009-graf-szerkeszto-es-futas-nezet.md` a **SPEC-008** terve (a számozás a PLAN-004b miatt
tolódott el), a **SPEC-009** terve a `PLAN-012-beallitasok-es-agent-konfiguracio.md`, mert a PLAN-010 a
SPEC-010-é, a PLAN-011 a SPEC-011-é. PLAN-009 néven SPEC-009 terv nincs és nem is lesz.

**Kiindulási állapot.** A spec úgy íródik, mintha a SPEC-011 már végre lenne hajtva: az `agentTools`
mező, az `enabledEngineHooks` mező, az `emit_output_tool` stratégia és a hét in-process eszköz csomag
nem létezik; az agent lépés a gyári Claude eszközöket használja, a lépés `allowedTools` és
`disallowedTools` szabad szöveges mezője marad, és az `mcpServers` mező marad (SPEC-011 3.2 és O-8:
"A mező marad, a SPEC-009-ben lesz konfigurálva és bekötve", user döntés 2026-10-26). A `main`
mai fején ezek még léteznek; a PLAN-012 előfeltétele a SPEC-011 bemergelése.

---

## 1. Cél és hatókör

A SPEC-007 és a SPEC-008 több helyen "a SPEC-009 hatóköre" megjelöléssel halasztott munkát
(SPEC-007 `:35`, `:274`, `:484`, `:682`; SPEC-008 `:21`, `:36`, `:37`, `:396-397`, `:413-415`, `:423`,
`:782`, `:790`, `:1416`, 54. és 60. kritérium), de a SPEC-009 fájl sosem készült el (hiányleltár H-21). Ez a
spec ezt a hiányt zárja: a halasztott munkát egy helyre gyűjti, és a döntést igénylő pontokat
nyitott kérdésként a user elé teszi.

### Amit eldönt (a 14. szekció válaszaival együtt)

1. **A Beállítások képernyő bővítése** (H-01, H-02, H-03, H-04): a meglévő `/settings` képernyő
   (SPEC-008 5.11, O-31, O-32) bővül, nem cserélődik (SPEC-008 `:782`). Tartalma: a visszavonás
   módosító választó (változatlan), a globális alapértelmezett provider választó a "Kapcsolat
   teszt" gombbal, a providerenkénti párhuzamossági korlát, a delta perzisztálás kapcsoló és a
   skill könyvtár.
2. **A provider választás három szintje teljessé válik** (`.claude/CLAUDE.md` 9. szekció): a globális
   alapértelmezés a Beállítások képernyőn, a workflow szintű felülírás létrehozáskor **és utólag**,
   a lépés szintű felülírás a beállítás panelen (ma is). A "Kapcsolat teszt" gomb a provider
   választó komponens része (`.claude/CLAUDE.md` 9. szekció).
3. **A kapcsolat teszt motor oldali `mode` mezőjének sorsa** (H-19).
4. **A skill feltöltés, tárolás és betöltés** az SDK-ba (H-04), és a lépés `skills` mezőjének
   szerkesztése.
5. **Az MCP szerver konfiguráció**: a lépés `mcpServers` mezőjének szerkesztése (H-05) és a
   bekötése az SDK `Options.mcpServers` mezőjéig (H-07), az env változó nevek feloldásával.
6. **A futás izolációja a szerver gép saját Claude beállításaitól** (`settingSources`,
   `strictMcpConfig`, H-41) és a kimenő `Options.env` csere hatása (H-40).
7. **A greppes invariáns (9) és a SPEC-008 54. kritérium tiltásának feloldása**, a SPEC-008 60.
   kritérium átvezetése.
8. **A hiányleltár többi A, B és D tételének besorolása**: melyik tartozik ide, melyiknek kell saját
   spec (14.6 szekció).

### Amit NEM dönt el (nem cél)

- **Provider CRUD.** Két provider marad, backend TypeScript configban, csak választani lehet
  közülük (`.claude/CLAUDE.md` 9. szekció; hiányleltár H-14, C kategória).
- **Új provider képesség, új mérés a MiniMax ellen.** A SPEC-000 mérései nem futnak újra.
- **Gyári eszköz választó** a szerkesztőben: a SPEC-011 O-5 szerint nincs.
- **A `script` csomópont végrehajtása, a strukturált kimenet séma szerinti ellenőrzése, a
  `StartInputField.valueKind`, a `join` `merge` beállításai, az `error_handler` megszakítható
  várakozása, a `readRunEvents` fogyasztója, a helyi indítási út**: a besorolásuk a 14.6 szekció
  kérdése, a megvalósításuk nem ennek a specnek a része, hacsak a user másképp nem dönt.
- **MCP szerver önálló kapcsolat tesztje.** Az SDK-ban a `Query.mcpServerStatus()` csak élő
  sessionön kérdezhető (telepített `sdk.d.ts:2540`); önálló, session nélküli próba API a d.ts-ben
  nincs. Ha kell, külön kérdés.
- **Titok tárolása.** A DB és a git továbbra is csak env változó **nevet** tárol (`.claude/CLAUDE.md` 7. szekció, SPEC-003 9.3); ez a spec ezt nem lazítja.
- **A CI visszakapcsolása** (H-15).

---

## 2. Megerősített tények, forrással

### 2.1 A kód mai állapota (a `main` `6009603` fején olvasva)

| Tény                                                                                                                                                                  | Forrás                                                                                                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A `/settings` képernyő egyetlen kártyát és egyetlen `preference-row` sort tart, a visszavonás módosító `SelectField` választóval; hálózati kérés nincs                | `apps/web/src/settings-screen/settings-screen.tsx:17-21, 43, 48-79`                                                                                                                                                      |
| A módosító választó `localStorage`-ban él (`eggGraphEditorUndoModifier`)                                                                                              | `apps/web/src/graph-editor/undo-modifier-storage.ts:11`                                                                                                                                                                  |
| A globális alapértelmezés a DB egysoros `app_setting.default_provider_id` oszlopa, nullázható, a migráció nem tölti ki                                                | `packages/db/src/app-setting/app-setting.ts:28-40`; SPEC-003 4.13                                                                                                                                                        |
| A `PUT /api/settings` részleges frissítés: `defaultProviderId?: string`, `persistStreamDeltas?: boolean`; a `defaultProviderId` nem nullázható                        | `packages/protocol/src/settings/settings-record.ts`; `apps/server/src/settings-endpoint/update-settings.ts:18-49`                                                                                                        |
| A web a `GET /api/settings` útvonalat egy helyen hívja (az örökölt provider szöveghez), a `PUT`-ot sehol                                                              | `apps/web/src/graph-editor/GraphEditorScreen.tsx:454`; hiányleltár 4. szekció                                                                                                                                            |
| A workflow `PATCH` útvonala a `providerId` mezőt elfogadja (`null` is), a web az átnevezésnél nem küldi                                                               | `packages/protocol/src/workflow/workflow-record.ts:59`; `apps/server/src/workflow-endpoint/update-workflow.ts:27-38`; `apps/web/src/workflow-list/rename-workflow-modal.tsx:57`                                          |
| A létrehozó modális a providert a `GET /api/providers` válaszából kínálja                                                                                             | `apps/web/src/workflow-list/create-workflow-modal.tsx:49, 67`                                                                                                                                                            |
| A feloldás sorrendje: lépés, workflow, globális, különben `no_default_provider`                                                                                       | `packages/engine/src/provider-resolution/resolve-effective-provider.ts:16-34`                                                                                                                                            |
| A kapcsolat teszt útvonala kész (`POST /api/providers/:providerId/connection-test`), a web nem hívja                                                                  | `packages/protocol/src/http-route/route-table.ts:62-65`; `apps/server/src/provider-endpoint/test-provider-connection.ts:17-30`                                                                                           |
| A kapcsolat teszt két `mode` értéke (`sdk_model_list`, `minimal_query`) ugyanazt a minimális `query()` hívást futtatja; a komment szerint "nem elfogadott végállapot" | `packages/engine/src/engine-port/create-engine.ts:170-206`; `packages/engine/src/capability-policy/resolve-connection-test-mode.ts:23-27`                                                                                |
| A párhuzamossági korlát három útvonala kész, a web nem hívja; alapérték nincs, sor híján nincs korlát; a javaslat a leíró mért értéke                                 | `route-table.ts:70-78`; `packages/db/src/provider-concurrency/provider-concurrency.ts:17-29`; `packages/engine/src/concurrency-gate/create-concurrency-gate.ts:78-82`; SPEC-003 11.                                      |
| A delta kapcsoló a futás indításakor befagy a `workflow_run.persisted_stream_deltas` oszlopba                                                                         | `packages/db/src/workflow-run/workflow-run.ts:51`; `.claude/CLAUDE.md` 10. szekció 3. pont                                                                                                                               |
| A `skills` mező (`readonly string[] \| 'all' \| null`) és az `mcpServers` mező (`Record<string, StorableMcpServer>`) a szerkesztőben csak olvasható                   | `packages/db/src/workflow-graph/agent-step-config/agent-step-config.ts:73-74`; `apps/web/src/node-inspector/AgentStepConfigFields.tsx:336-348`; `apps/web/src/node-inspector/agent-definition-field-table.ts:35, 91-104` |
| A `StorableMcpServer` három ága: `stdio {command, args, envNames}`, `sse {url, authEnvName}`, `http {url, authEnvName}`; értéket soha nem tárol                       | `packages/db/src/workflow-graph/agent-step-config/storable-mcp-server.ts`                                                                                                                                                |
| A motor a `skills` mezőt átadja, az `mcpServers` mezőt kihagyja ("az összeállítás (`apps/server`) dolga lesz")                                                        | `packages/engine/src/agent-step/build-agent-step-options.ts:86-92, 113`                                                                                                                                                  |
| A motor `settingSources`, `strictMcpConfig` és `plugins` opciót nem ad át                                                                                             | `packages/engine/src/agent-step/agent-step-options.ts:33-55` (a típusban nincs ilyen mező)                                                                                                                               |
| A kimenő `Options.env` kizárólag a provider `requiredEnv[]` blokkja; a `claude-subscription` providernek nincs kötelező env változója                                 | `packages/engine/src/provider-environment/build-provider-environment-block.ts:19-43`; `packages/provider-claude-subscription/src/environment/required-environment.ts:3`                                                  |
| A greppes invariáns (9) tiltja a `skill-upload` és az `mcp-server-config` téma mappát az `apps/web/src` alatt                                                         | `apps/web/src/greppable-invariants/greppable-invariants.spec.ts:277, 297-304`; SPEC-008 54. kritérium (`:1521`)                                                                                                          |
| Skill vagy MCP szerver tábla nincs a DB-ben                                                                                                                           | `packages/db/src` téma mappái (app-setting, provider-concurrency, human-approval, run-event, step-run, workflow-graph, workflow-run, graph-snapshot)                                                                     |
| Az `apps/server` csomagnak nincs `dev` vagy `start` scriptje                                                                                                          | `apps/server/package.json` `scripts`: csak `typecheck` és `lint`                                                                                                                                                         |

### 2.2 Az Agent SDK (pinelt verzió: `@anthropic-ai/claude-agent-sdk` `0.3.245`)

A verzió forrása: `docs/research/2026-08-26-toolchain.md:10` és a telepített csomag `package.json:3`.
A d.ts útvonala: `node_modules/.bun/@anthropic-ai+claude-agent-sdk@0.3.245+7b719043580c7622/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`
(rövidítve `sdk.d.ts`). Elsődleges doksi: az Agent SDK TypeScript referencia
(<https://code.claude.com/docs/en/agent-sdk/typescript>), a Skills oldal
(<https://code.claude.com/docs/en/agent-sdk/skills>), az MCP oldal
(<https://code.claude.com/docs/en/agent-sdk/mcp>) és a Plugins oldal
(<https://code.claude.com/docs/en/agent-sdk/plugins>). A doksi a legfrissebb SDK verziót írja le, nem a
pinelt `0.3.245`-öt; a mérvadó a telepített d.ts, a doksi a megerősítés.

| Tény                                                                                                                                                                                                                                                       | d.ts                                     | Megerősítés                                                                                                                                             | Állapot                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `mcpServers?: Record<string, McpServerConfig>`; az unió `McpStdioServerConfig \| McpSSEServerConfig \| McpHttpServerConfig \| McpSdkServerConfigWithInstance`                                                                                              | `:1755`, `:1091`                         | TS referencia; anthropics/claude-agent-sdk-typescript #247 (<https://github.com/anthropics/claude-agent-sdk-typescript/issues/247>)                     | ellenőrzött                 |
| stdio: `type?: 'stdio'; command: string; args?: string[]; env?: Record<string, string>`; sse: `type: 'sse'; url; headers?`; http: `type: 'http'; url; headers?`                                                                                            | `:1190-1194`, `:1173-1177`, `:1058-1062` | TS referencia; ugyanaz az issue                                                                                                                         | ellenőrzött                 |
| Az MCP eszköz neve `mcp__<szerver>__<eszköz>`                                                                                                                                                                                                              | `:3805`, `:3224`                         | MCP oldal ("MCP tools are named `mcp__<server>__<tool>`")                                                                                               | ellenőrzött                 |
| `strictMcpConfig?: boolean`: csak az `mcpServers` szerverei, a `.mcp.json`, a user beállítás és a plugin szerverei nélkül                                                                                                                                  | `:2058-2063`                             | TS referencia Options tábla                                                                                                                             | egy hivatalos forrás        |
| `settingSources?: ('user' \| 'project' \| 'local')[]`; kihagyva **mindhárom** betöltődik; `[]` az izolációs mód; a `CLAUDE.md` betöltéséhez `'project'` kell                                                                                               | `:2004-2014`, `:7817`                    | TS referencia ("CLI defaults"); a Skills oldal egy helyen "user and project" forrást ír alapértelmezésnek, ez eltér a d.ts-től                          | ellenőrzött, a d.ts mérvadó |
| `skills?: string[] \| 'all'`; kihagyva "not skills off", a CLI alapértelmezése érvényes; a lista a `SKILL.md` `name` / könyvtárnév, plugin skillnél `plugin:skill`; "context filter, not a sandbox"; a `Skill` eszközt nem kell az `allowedTools`-ba tenni | `:2015-2037`                             | Skills oldal; a GitHub CHANGELOG 0.2.120 ("Added `skills` option") (<https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md>) | ellenőrzött                 |
| Skillt programból regisztrálni nem lehet, csak fájlrendszerről: "The SDK doesn't provide a programmatic API for registering them"                                                                                                                          | (nincs ilyen opció a d.ts-ben)           | Skills oldal; a <https://code.claude.com/docs/en/agent-sdk/claude-code-features> oldal; független megerősítés csak a CHANGELOG (a mező létezése)        | részben ellenőrzött         |
| `plugins?: { type: 'local'; path: string }[]`; a plugin skillt, agentet, hookot, MCP szervert hozhat; a plugin skill neve `<plugin>:<skill>`; a `skills/<név>/SKILL.md` könyvtár elrendezés; a `.claude-plugin/plugin.json` manifeszt elhagyható           | `:1800-1818`, `:4533-4546`               | Plugins oldal ("Plugin structure reference"); Skills oldal ("or use the `plugins` option to load skills from a specific path")                          | egy hivatalos forrás        |
| `env` megadva **teljesen lecseréli** az alfolyamat környezetét, nem olvad össze a `process.env`-vel; kihagyva örököl                                                                                                                                       | `:1482-1500`                             | TS referencia Options `env` sora                                                                                                                        | egy hivatalos forrás        |
| `additionalDirectories?: string[]`; a doksi szerint `--add-dir`-ként megy, és `'project'` forrással az ottani `.claude/skills/` is betöltődik                                                                                                              | `:1379`                                  | Skills oldal                                                                                                                                            | egy hivatalos forrás        |
| `Query.supportedModels(): Promise<ModelInfo[]>` és `Query.mcpServerStatus(): Promise<McpServerStatus[]>` élő `Query` objektumon                                                                                                                            | `:2528`, `:2540`, `:1098-1139`           | a TS referencia Query szekcióját nem láttuk                                                                                                             | nem ellenőrzött (doksi)     |

### 2.3 Amit ezekből NEM következtetünk

- Hogy a `claude-subscription` lépés `settingSources: []` mellett is bejelentkezett marad. A
  hitelesítés forrása nem a `settings.json`, de ezt egyik forrás sem mondja ki: **nem ellenőrzött**,
  blokkoló mérés (M-138).
- Hogy a mai `Options.env` csere miatt a `claude-subscription` lépés és a kapcsolat teszt elbukik.
  A d.ts szerint a `{}` blokk minden öröklött változót (`PATH`, `HOME`) elvesz; a tényleges hatás
  **nem ellenőrzött**, blokkoló mérés (M-137, hiányleltár H-40).
- Hogy a stdio MCP szerver alfolyamata a CLI környezetét örökli-e a saját `env` mezője mellé: **nem
  ellenőrzött** (M-139).
- Hogy a skill könyvtárnév és a frontmatter `name` szabályai pontosan mik: a Skills oldal "Invalid
  skill name error" szakaszára hivatkozik, amit nem töltöttünk le; **nem ellenőrzött**, a PLAN-012
  F0 lekéri.

---

## 3. A Beállítások képernyő

### 3.1 Elrendezés

A képernyő a meglévő `settings-screen` téma bővítése (SPEC-008 5.11: "bővíti, nem cseréli le"). A
design system mintája az `eggproject-design-admin-app-examples` `settings.html` oldala (`card`
szekció, `card__header`, `card__body`, `card__footer` mentés sávval, `preference-row` sor). A minta
`.layout` szabálya `max-width: 1080px`, ami ütközik a "faltól falig" szabállyal (`.claude/CLAUDE.md` 11. szekció); a teljes szélességhez ez a page-local szabály nem kerül át. A szekciók sorrendje (a
14.1 O-8 válaszáig javaslat):

1. **Provider**: a globális alapértelmezett provider (`SelectField`), alatta a kiválasztott provider
   kötelező env változóinak **neve** (a SPEC-007 `:682` mintája), mellette a "Kapcsolat teszt" gomb.
   Ha nincs alapértelmezés, `warning` `Alert` mondja ki, hogy agent lépés így nem indul
   (`no_default_provider`, SPEC-003 4.13: "a felület az első indulásnál kéri be a választást").
2. **Párhuzamossági korlát**: providerenként egy sor: a beállított érték vagy a "nincs beállított
   párhuzamossági korlát" szöveg (SPEC-003 11.), a leíró javaslata a megjegyzésével, egy szám mező,
   "Mentés" és "Korlát törlése" gomb. **Alapérték nincs**, a mező üresen indul (`.claude/CLAUDE.md` 4. szekció 1. pont).
3. **Futás napló**: a delta perzisztálás kapcsoló (`persistStreamDeltas`), alapból kikapcsolva
   (SPEC-003 6.6), a "csak az ezután indított futásokra hat" mondattal, mert az érték a futás
   indításakor befagy (`.claude/CLAUDE.md` 10. szekció 3. pont).
4. **Skill könyvtár** (5. szekció).
5. **Gráf szerkesztő**: a visszavonás módosító választó, változatlan (SPEC-008 O-31, O-32).

Minden hálózati műveletnek látható várakozás jelzése van (`Button` `isLoading`, `Skeleton` a
betöltéskor; `.claude/CLAUDE.md` 11. szekció). A REST hiba a `danger` `Alert` blokkban jelenik meg, a
hibakódhoz és az ismert hibaosztályhoz rendelt magyar mondattal (SPEC-007 8.4). A gombok `sm`
méretűek, modálison kívül.

### 3.2 A design system elemei

| Elem                              | Design system (`eggproject-design-components`)              | `packages/ui` ma                        | Teendő                                               |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| szekció kártya, preference sor    | `settings.html` page-local `.card`, `.preference-row`       | `apps/web` `settings-screen` (T-009-59) | marad                                                |
| választó                          | `select` (React `Select`)                                   | `select-field/SelectField.tsx`          | marad                                                |
| szám és szöveg mező               | `input` (`.input`, `.field`)                                | `text-field/TextField.tsx`              | marad (`type="number"`)                              |
| kapcsoló                          | `form-controls` `.ctrl__switch`                             | **nincs** (csak `Checkbox`)             | átemelés vagy `Checkbox` (O-7)                       |
| gomb, betöltés állapot            | `button` (`.btn--sm`, `.btn__loader`)                       | `button/Button.tsx` (`isLoading`)       | marad                                                |
| állapot jelvény, figyelmeztetés   | `badge`, `alert`                                            | `badge/`, `alert/`                      | marad                                                |
| értesítés                         | `toast`                                                     | `toast/`                                | marad                                                |
| szerkesztő dialógus               | `modal`                                                     | `modal/Modal.tsx`                       | marad                                                |
| megerősítő dialógus               | `alert-dialog`                                              | **nincs**                               | `Modal` (T-009-52 precedens) vagy átemelés (O-16)    |
| fájl feltöltés                    | `file-upload` (`.dropzone`, `.dropzone-file`)               | **nincs**                               | átemelés (O-15)                                      |
| egyértékű lista (args, env nevek) | `tag-input` (`.tagi`)                                       | **nincs**                               | átemelés (O-19)                                      |
| üres lista                        | `empty` (`.empty`)                                          | **nincs**                               | átemelés vagy szöveg (O-15)                          |
| kulcs-érték sor szerkesztő        | **nincs a design systemben**                                | nincs                                   | nem kell, mert a tárolt alak csak nevet hordoz (6.1) |
| oldalsó beállítás navigáció       | **nincs a design systemben** (csak page-local CSS)          | nincs                                   | nem kerül be (O-8)                                   |
| általános kis kör spinner         | **nincs a design systemben** (csak a `.spin*` logó spinner) | nincs                                   | nem kell, a `Button` `isLoading` elég                |

Forrás: az `eggproject-design-components` skill `components/<név>/` mappái és az
`eggproject-design-admin-app-examples` `examples/settings.html`, 2026-10-26-án betöltve; a
`packages/ui/src` téma mappái a `main` fején.

---

## 4. Blokkoló mérések

A mérések a PLAN-012 F0 fázisában futnak, **amíg nem zöldek, a 6. és a 7. szekció termékkódja nem
íródik**. Mindegyik a pinelt SDK-val, eldobható munkakönyvtárban; a nyers kimenet a `docs/research/`
alá kerül (`.claude/CLAUDE.md` 4. szekció 3. pont). Ahol lehet, valódi API hívás nélkül, a
`tools/wire-probe` mintájára helyi csonk végponttal (`ANTHROPIC_BASE_URL` egy helyi szerverre); ahol
valódi előfizetés kell, ott a user előzetes jóváhagyásával.

| #     | Kérdés                                                                                                                                                                                                                                                          | Valódi API                                                 | Mi dől el belőle |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| M-136 | A `plugins: [{ type: 'local', path }]` úton egy `skills/<név>/SKILL.md` alakú könyvtár skillje megjelenik-e az `init` üzenet `skills` tömbjében `<plugin>:<név>` alakban, `settingSources: []` mellett is, és a `skills: ['<plugin>:<név>']` lista elfogadott-e | nem (helyi csonk)                                          | O-10, 5.3        |
| M-137 | A mai `Options.env` blokk (`claude-subscription` esetén `{}`) mellett elindul-e a CLI alfolyamat, és látja-e a `PATH` és a `HOME` változót                                                                                                                      | nem (helyi csonk)                                          | O-21, H-40       |
| M-138 | A `claude-subscription` lépés `settingSources: []` és `strictMcpConfig: true` mellett hitelesített-e                                                                                                                                                            | **igen**, user jóváhagyással                               | O-20             |
| M-139 | Egy helyi stdio és egy helyi http MCP csonk szerver az `mcpServers` úton `connected` állapotú-e az `init` üzenetben, és a stdio alfolyamat milyen környezetet kap                                                                                               | nem (helyi csonk)                                          | 6.3, O-18        |
| M-140 | A kapcsolat teszt `supportedModels()` ága: hív-e hálózatot, és a két provideren mit ad                                                                                                                                                                          | **igen**, user jóváhagyással, csak ha az O-1 (b) választás | O-1              |

---

## 5. A skill könyvtár

### 5.1 A javasolt alak (a 14.2 kérdések ajánlott válaszaival)

- **Tárolás:** a szerver egy kezelt könyvtárában, a fájlrendszeren (O-9 (a)), mert az SDK skillt
  csak fájlrendszerről tölt (2.2). A könyvtár útvonala kötelező szerver konfiguráció, alapérték
  nélkül (egy új env változó, a neve a PLAN-012-ben rögzül; SPEC-006 4. szekció mintája). A könyvtár
  egy plugin gyökér: `<gyökér>/skills/<név>/SKILL.md`.
- **Betöltés:** a motor minden agent lépésnél `plugins: [{ type: 'local', path: <gyökér> }]` opciót
  ad (O-10 (a)), mert ez a `settingSources` értékétől független út (Skills oldal: "or use the
  `plugins` option to load skills from a specific path"); M-136 igazolja.
- **Feltöltés:** egyetlen `SKILL.md` fájl (O-11 (a)); a skill neve a frontmatter `name` mezője (O-12).
  Azonos nevű skill feltöltése felülírja a régit, megerősítéssel.
- **REST:** három új útvonal a `packages/protocol` route táblájában: a skillek listája (név,
  leírás a frontmatterből, méret, módosítás ideje), egy skill feltöltése (törzs: a `SKILL.md`
  szövege) és egy skill törlése. A sémák a `protocol` négy írási szabálya szerint (`z.strictObject`,
  nincs `.default()` és `.transform()`, `.readonly()` kimenet, `.safeParse()`; `.claude/CLAUDE.md` 5.
  szekció).
- **Törlés hivatkozott skillre:** a törlés megengedett, a futás indítása a hiányzó skillre új
  indítási hibát ad (O-13 (b)); a hibaosztály a `ProtocolErrorClass` zárt szótárát bővíti, a
  sodródás védelemmel (`.claude/CLAUDE.md` 5. szekció).
- **Titok:** a skill fájl nem tartalmazhat titkot (d.ts `:2030-2032`: "Do not store secrets in skill
  files"); a feltöltés felülete ezt kimondja. Gépi ellenőrzés nincs rá, mert tartalom alapú
  titokfelismerésre nincs forrásunk.

### 5.2 A lépés `skills` mezője a szerkesztőben

A mező három állapota a tárolt alak szerint (`agent-step-config.ts:73`): `null` (nincs beállítva: az
SDK nem kap `skills` opciót, a CLI alapértelmezése érvényes, d.ts `:2018-2019`), `'all'` (minden
felfedezett skill) és a lista (a könyvtár skilljeiből választva). A szerkesztő egy `SelectField`
módválasztóval és a könyvtár skilljeinek `Checkbox` listájával dolgozik (O-14). Az agent definíción
belüli `skills` (SPEC-008 `:413-415`, 60. kritérium) ugyanígy szerkeszthetővé válik.

### 5.3 A lista elemeinek alakja

Ha a betöltés plugin úton megy (O-10 (a)), az SDK a skillt `<plugin>:<név>` néven ismeri (Plugins
oldal). A tárolt lista elemei ezért vagy a teljes `<plugin>:<név>` alakot tárolják, vagy a puszta
nevet, és a motor fűzi elé a plugin nevét. Javaslat: a puszta név a tárolt alak, a motor fűzi elé,
mert a plugin neve szerver oldali részlet; ezt az M-136 eredménye erősíti meg vagy veti el.

---

## 6. Az MCP szerver konfiguráció

### 6.1 A szerkesztés helye és alakja

Javaslat (O-17 (a)): **lépésenként**, a beállítás panel meglévő mezőjén, a tárolt `StorableMcpServer`
alakkal, sémaváltás nélkül. A szerkesztő szerverenként egy sort mutat (név, típus, `command` és
`args`, vagy `url` és `authEnvName`, illetve az `envNames` lista); a hozzáadás és a szerkesztés
`Modal`-ban, a törlés megerősítéssel. A tárolt alak csak env változó **nevet** hordoz, ezért
kulcs-érték szerkesztő nem kell: az `args` és az `envNames` egyértékű lista (O-19). A szerver neve
egyben az MCP eszköznév előtagja (`mcp__<szerver>__<eszköz>`, 2.2), ezért a név szabálya a d.ts
`:3805` normalizálását követi; a pontos karakterszabály a PLAN-012 F0-ban lekért forrás szerint.

A greppes invariáns (9) a `skill-upload` és az `mcp-server-config` téma mappát tiltja; a tiltás
feloldódik (8. szekció), a téma mappák nevei ezek maradnak.

### 6.2 A bekötés helye

**Technikai döntés, nem termékkérdés:** a bekötés a **motorban** történik, a
`build-agent-step-options.ts` témájában, a meglévő `processEnvironment` porton át. Az `apps/server`
gazdát a `build-agent-step-options.ts:86-92` komment az `agentTools` miatt nevezte meg (in-process
eszközök példányosítása, amitől a motor nem függhet); a SPEC-011 után ez az ok megszűnik, a
`StorableMcpServer` feloldásához pedig csak env olvasás kell, ami a motor portja már ma
(`build-provider-environment-block.ts`). Ezzel a hiányleltár H-26 ellentmondása zárul; a komment és
a `packages/engine` `CLAUDE.md` átíródik.

### 6.3 A leképezés

| Tárolt ág                         | SDK alak                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `stdio {command, args, envNames}` | `{ type: 'stdio', command, args, env: { <név>: <érték> ... } }` a nevek feloldásával      |
| `sse {url, authEnvName}`          | `{ type: 'sse', url, headers: { Authorization: <érték> } }`, `null` névnél fejléc nélkül  |
| `http {url, authEnvName}`         | `{ type: 'http', url, headers: { Authorization: <érték> } }`, `null` névnél fejléc nélkül |

Az `authEnvName` értéke a teljes `Authorization` fejléc érték (a `storable-mcp-server.ts`
dokumentációja szerint), előtag nélkül. A hiányzó env változó a lépés indításakor hibát ad,
kizárólag a névvel, értéket soha nem írva naplóba vagy eseménybe (a `missing_provider_env`
mintája; a hibaosztály kérdése O-18). Az érték nem kerül sem a pillanatképbe, sem a `run_event`
táblába.

---

## 7. A futás izolációja és a kimenő környezet

1. **`settingSources` és `strictMcpConfig`** (O-20, H-41). Ma a motor egyiket sem adja át, ezért a
   d.ts `:2010` szerint a szerver gép `~/.claude/settings.json`, a `cwd` alatti `.claude/` beállítás és
   `CLAUDE.md`, valamint minden ott felfedezett skill és MCP szerver érvényesül, a workflow-ban
   beállítottakon felül. Javaslat (a): minden agent lépés `settingSources: []` és `strictMcpConfig:
true` opcióval fut, így a lépés pontosan azt látja, amit a workflow beállít (plusz a skill könyvtár
   a plugin úton). Feltétele az M-138.
2. **`Options.env`** (O-21, H-40). A d.ts `:1485` szerint a megadott `env` teljesen lecseréli az
   alfolyamat környezetét. Javaslat: az M-137 eredményéig nincs változtatás; ha a mérés a hiányt
   igazolja, a motor a provider blokk mellé egy **megnevezett, zárt listát** ad át a folyamat
   környezetéből (a lista tartalma a mérés szerint), a `disallowedEnv[]` kizárásával. A teljes
   `process.env` átadása nem javasolt, mert a provider tiltott változói (`disallowedEnv[]`) ma pont
   ettől védenek.

---

## 8. A tiltás feloldása és az átvezetések

| Hely                                                                                             | Változás                                                                                                  |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `apps/web/src/greppable-invariants/greppable-invariants.spec.ts:297-304`                         | az `outOfScopeThemeNames` halmaz és az állítása törlődik; a (9) címe a `@xyflow/react` szűkítésre rövidül |
| SPEC-008 54. kritérium (`:1521`)                                                                 | a tiltó mondat helyett: "a `skill-upload` és az `mcp-server-config` téma a SPEC-009 hatóköre, lásd ott"   |
| SPEC-008 60. kritérium (`:1530`), 5.2 táblák (`:396-397`, `:413-415`)                            | a `skills` és az `mcpServers` "olvasható" helyett "szerkeszthető, SPEC-009 5.2 és 6.1"                    |
| SPEC-008 `:36`, `:37`, `:423`, `:782`, `:790`                                                    | a "SPEC-009 hatóköre" mondatok a megvalósult állapotra hivatkoznak                                        |
| SPEC-007 `:35`, `:274`, `:484`, `:682`                                                           | ugyanígy; a `:274` (két topnav bejegyzés) és a `:484` (két útvonal) elavult állítása javul (H-22)         |
| `AgentStepConfigFields.tsx:24` és `agent-definition-field-table.ts:35` (`SPEC_009_SCOPE_REASON`) | a felhasználónak látható "a SPEC-009 hatóköre" szöveg és a `readonly` vezérlő megszűnik                   |
| `build-agent-step-options.ts:86-92`, `packages/engine/CLAUDE.md`                                 | a komment és a fájltábla a 6.2 döntés szerint                                                             |
| `.claude/CLAUDE.md` 9. szekció                                                                   | a "Kapcsolat teszt" gomb mondata a 14.1 O-2 válasza szerint pontosítva; 13. szekció új sor a SPEC-009-re  |
| `docs/research/2026-10-26-hatokor-hianyleltar.md`                                                | a SPEC-009-hez rendelt tételek gazdája "SPEC-009" és a lezáró commit                                      |

---

## 9. Hova kerül a kód

| Csomag              | Téma (új vagy bővülő)                                                                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/protocol` | `settings` (bővül, ha az O-4 (b)), `skill` (új: lista, feltöltés, törlés sémái), `provider` (az O-1 szerint), `protocol-error` (új hibaosztály, O-13, O-18)                                                                                            |
| `packages/engine`   | `agent-step` (`mcpServers`, `plugins`, `settingSources`, `strictMcpConfig`, `skills` előtag), `run-validation` (hiányzó skill, O-13), `engine-port` (kapcsolat teszt, O-1), `provider-environment` (O-21)                                              |
| `apps/server`       | `skill-endpoint` (új), `server-config` (a skill könyvtár útvonala), `route-registry`, `error-class-drift-protection`                                                                                                                                   |
| `packages/ui`       | az O-7 ... O-16 válasza szerint átemelt elemek, bájtazonos CSS-sel (SPEC-007 precedens)                                                                                                                                                                |
| `apps/web`          | `settings-screen` (bővül), `skill-upload` (új), `mcp-server-config` (új), `provider-select` vagy a meglévő provider választó bővítése a "Kapcsolat teszt" gombbal, `workflow-list` (a workflow szerkesztő modális, O-3), `node-inspector` (a két mező) |

A `packages/db` sémája az O-9 (a) és az O-17 (a) válasz mellett **nem változik**: nincs új tábla, nincs
migráció. Ha a user az O-9 (b) vagy az O-17 (b) opciót választja, a 9. szekció a `db` témával és a
`check:db-drift` kapuval bővül.

---

## 10. Tesztelés

- **Unit** (100 százalék, kizárás nélkül): a leképezés (6.3) ágai, a hiányzó env név ág, a skill
  frontmatter olvasás, a REST kezelők valós `:memory:` adatbázissal és ideiglenes könyvtárral, a
  szerkesztő mezők és a mentési séma.
- **e2e** (`page.route()` mockkal, `.claude/CLAUDE.md` 11. szekció): a Beállítások képernyő minden
  szekciója mindkét témában, 320 és 1440 pixelen; a kapcsolat teszt siker és hiba ága; a
  párhuzamossági korlát beállítás és törlés; a skill feltöltés, felülírás, törlés; a workflow
  provider módosítás; a lépés `skills` és `mcpServers` szerkesztése és a mentés `PUT` törzse.
- **Szerver végponttól végpontig** (a SPEC-010 12.3 mintája, rögzítő `query` porttal, valódi API
  nélkül): a lépés `Options` objektuma tartalmazza a feloldott `mcpServers`, a `plugins`, a
  `settingSources` és a `strictMcpConfig` mezőt, az env érték nem jelenik meg naplóban és eseményben.
- **Sodródás védelem**: az új hibaosztály(ok) az `error-class-drift-protection` témában.

---

## 11. Kockázatok

| Kockázat                                                                        | Kezelés                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A doksi újabb SDK verziót ír le, mint a pinelt `0.3.245`                        | a d.ts mérvadó, a mérések a pinelt verzióval futnak (4.)                 |
| Az izolációs mód elveszi a `claude-subscription` hitelesítést                   | M-138 előtt nincs változtatás (O-20)                                     |
| A skill könyvtárat a fájlrendszeren bárki írhatja, aki a szerver gépen dolgozik | kimondott korlát: a skill "context filter, not a sandbox" (d.ts `:2028`) |
| Egy MCP szerver neve ütközik a gyári vagy a plugin MCP nevével                  | a `strictMcpConfig: true` (O-20 (a)) kizárja a többi forrást             |

---

## 12. Elfogadási kritériumok

### Beállítások képernyő

1. A `/settings` képernyő a 3.1 öt szekcióját mutatja; a módosító választó változatlan (a meglévő
   `settings-screen.spec.tsx` és e2e zöld).
2. A globális provider választó a `GET /api/providers` válaszából épül, a választás `PUT
/api/settings` hívással mentődik, és a válasz után a képernyő az új értéket mutatja (unit és e2e).
3. Alapértelmezés nélkül `warning` `Alert` mondja ki, hogy agent lépés nem indul (e2e).
4. A "Kapcsolat teszt" gomb a provider választó komponens része, a 14.1 O-2 válaszában megnevezett
   minden helyen; sikerre és hibára a design system jelzésével felel, várakozás közben `isLoading`
   (unit és e2e mindkét ágra).
5. A párhuzamossági korlát szekció providerenként mutatja a beállított értéket vagy a "nincs
   beállított párhuzamossági korlát" szöveget és a javaslatot; a mentés `PUT`, a törlés `DELETE`
   hívást küld; a mező nem pozitív egész értékre a mező alatt hibát ad (e2e a mentés `PUT` törzsével
   és a hívás hiányával).
6. A szám mező alapértéke üres: az `apps/web/src` alatt a korlát mezőhöz szám literál alapérték nincs
   (greppes invariáns).
7. A delta kapcsoló a `persistStreamDeltas` értékét mutatja és menti, a "csak új futásra hat" mondattal
   (unit és e2e).
8. A workflow szintű provider utólag módosítható; a `PATCH` törzse a `providerId` mezőt hordozza,
   `null` értékkel is (e2e).

### Skill könyvtár

9. A skill lista, feltöltés és törlés útvonala a `ROUTE_TABLE`-ben áll, a szerver kiszolgálja, a web
   hívja (a hiányleltár route összevetése újrafuttatva: a SPEC-009 útvonalai közül nincs nem hívott).
10. A feltöltött skill a szerver skill könyvtárában `skills/<név>/SKILL.md` alakban áll (szerver unit
    teszt ideiglenes könyvtárral).
11. Az agent lépés `Options` objektuma tartalmazza a `plugins` bejegyzést a skill könyvtárra, és a
    `skills` lista elemei az 5.3 szerinti alakban mennek ki (motor unit teszt).
12. A törölt, de hivatkozott skillre a futás indítása az O-13 szerinti hibát adja, és a felület saját
    magyar mondatot mutat (motor unit, szerver végponttól végpontig, e2e).
13. A lépés és az agent definíció `skills` mezője szerkeszthető (unit és e2e a mentés `PUT` törzsével).

### MCP

14. A lépés és az agent definíció `mcpServers` mezője szerkeszthető, mindhárom ágra; a mentés `PUT`
    törzse a `StorableMcpServer` alakot hordozza, értéket nem (e2e).
15. A motor a 6.3 táblázat mindhárom sorát leképezi, a hiányzó env névre hibát ad a névvel, értékkel
    soha (motor unit teszt minden ágra).
16. Az env érték nem jelenik meg a `run_event` táblában, a pillanatképben és a naplóban (szerver
    végponttól végpontig, a `MINIMAX_API_KEY` precedens mintájára greppes ellenőrzéssel a kimeneten).
17. A `build-agent-step-options.ts` kommentje és a `packages/engine` `CLAUDE.md` a 6.2 döntést
    mondja ki; a "dolga lesz" mondat nem áll a repóban (`git grep -n "dolga lesz" packages/engine`
    nulla találat).

### Izoláció és kapcsolat teszt

18. Az O-20 és az O-21 válasza szerint az `Options` objektuma tartalmazza (vagy nem) a
    `settingSources`, a `strictMcpConfig` és az `env` kiegészítést; a döntés unit teszttel rögzítve.
19. A kapcsolat teszt az O-1 válasza szerint működik; ha az (a), a `ConnectionTestModeSchema` és a
    `resolve-connection-test-mode.ts` nem létezik (`git grep` nulla találat), és a "nem elfogadott
    végállapot" mondat törölve.

### Feloldás és dokumentáció

20. A greppes invariáns (9) nem tilt `skill-upload` és `mcp-server-config` téma mappát, és mindkettő
    létezik az `apps/web/src` alatt.
21. `git grep -n "SPEC-009 hatóköre\|SPEC_009_SCOPE_REASON"` a `docs/spec/SPEC-009-*.md`, a
    `docs/plan/PLAN-012-*.md` és a hiányleltár kivételével nulla találat.
22. A 8. szekció minden sora átvezetve; a szabálykönyv 13. szekciója hivatkozza a SPEC-009-et.
23. A hiányleltár minden SPEC-009 gazdájú tétele lezárva vagy kimondott user döntéssel nyitva, és
    egyetlen tétel sem marad gazda nélkül (PLAN-012 zárási lépése).
24. A kilenc kapu, a teljes e2e és a `coverage:e2e:report` zöld a merge fején, a fedetlen tételek
    száma egyik metrikán sem nő (`.claude/CLAUDE.md` 8. szekció).

---

## 13. Lezárt pontok, amik nem kérdések

- **A bekötés helye a motor** (6.2): technikai döntés, a H-26 ellentmondás feloldása.
- **A skill és az MCP konfiguráció nem tárol titkot**: a meglévő szabály (`.claude/CLAUDE.md` 7.
  szekció) alkalmazása.
- **A párhuzamossági korlátnak nincs alapértéke**: SPEC-003 11. és `.claude/CLAUDE.md` 4. szekció 1.
  pont.

---

## 14. Nyitott kérdések

Minden kérdés a user döntésére vár. Formája: opciók, ajánlott opció indokkal, mi a viselkedés addig,
mi zárná le. A viselkedés addig minden kérdésnél a `main` mai állapota (2.1).

### 14.1 Beállítások és provider

| #   | Kérdés                                                  | Opciók                                                                                                                                         | Ajánlott, indok                                                                                                | Mi zárná le |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| O-1 | A kapcsolat teszt `mode` mezője                         | (a) a `mode` törlése a protokollból és a motorból, egy út marad; (b) valódi `supportedModels()` ág (M-140); (c) marad, ahogy van               | (a): a két ág ma azonos, a mezőnek nincs fogyasztója, a (b) valódi API mérést igényel                          | user döntés |
| O-2 | Hol áll a "Kapcsolat teszt" gomb                        | (a) a provider választó komponens része mindenhol (Beállítások, workflow létrehozás és szerkesztés, lépés felülírás); (b) csak a Beállításokon | (a): a szabálykönyv 9. szekciója szó szerint a komponens részének mondja; az "örökölt" opciónál a gomb tiltott | user döntés |
| O-3 | A workflow szintű provider utólagos módosításának helye | (a) az átnevezés modális "Workflow szerkesztése" modálissá bővül (név, leírás, provider); (b) a gráf szerkesztő fejlécében                     | (a): a `PATCH` útvonal kész, egy modális, a létrehozó modális mintája                                          | user döntés |
| O-4 | Visszaállítható-e a globális alapértelmezés "nincs"-re  | (a) nem, csak választani lehet; (b) igen, a `defaultProviderId` nullázható (protocol és szerver változás)                                      | (a): nincs rá igény a forrásokban, a `no_default_provider` csak az első indulás állapota                       | user döntés |
| O-5 | Az első indulás jelzése                                 | (a) `warning` `Alert` a Beállításokon, és a `no_default_provider` mondata a Beállításokra mutat; (b) kötelező első indulási modális            | (a): nem blokkol, a SPEC-003 4.13 "kéri be" mondatának legkisebb megvalósítása                                 | user döntés |
| O-6 | A párhuzamossági korlát mentése                         | (a) soronként külön "Mentés" és "Korlát törlése"; (b) egy közös mentés a kártya láblécén                                                       | (a): a három útvonal providerenként külön hívás, a hiba soronként jelezhető                                    | user döntés |
| O-7 | A delta kapcsoló vezérlője                              | (a) a design system `.ctrl__switch` átemelése `Switch` komponensként; (b) a meglévő `Checkbox`                                                 | (a): a `settings.html` preference sora kapcsolót használ, és létező design system elem                         | user döntés |
| O-8 | A Beállítások oldal tagolása                            | (a) kártyák egymás alatt egy oldalon; (b) oldalsó navigáció (a design systemben csak page-local CSS)                                           | (a): a meglévő képernyő mintája, a (b) nem létező design system elem                                           | user döntés |

### 14.2 Skill

| #    | Kérdés                                  | Opciók                                                                                                                                         | Ajánlott, indok                                                                                                               | Mi zárná le          |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| O-9  | Hol tárolódik a skill                   | (a) a szerver kezelt könyvtárában, a fájlrendszeren; (b) a DB-ben, futáskor ideiglenes könyvtárba írva                                         | (a): az SDK csak fájlrendszerről tölt, nincs migráció, nincs szinkron                                                         | user döntés          |
| O-10 | Hogyan jut az SDK-hoz                   | (a) `plugins` út egy plugin gyökérrel; (b) `additionalDirectories` és `settingSources: ['project']`; (c) a lépés `cwd` alatti `.claude/skills` | (a): független a `settingSources` értékétől, tehát az O-20 izolációval együtt működik                                         | user döntés és M-136 |
| O-11 | Mit lehet feltölteni                    | (a) egyetlen `SKILL.md`; (b) zip könyvtár segédfájlokkal; (c) mindkettő                                                                        | (a): nincs kicsomagolás, nincs útvonal bejárási kockázat; a (b) később bővíthető                                              | user döntés          |
| O-12 | A skill neve                            | (a) a frontmatter `name` mezője, az SDK névszabálya szerint ellenőrizve; (b) a feltöltéskor megadott név                                       | (a): az SDK a `name` vagy a könyvtárnév szerint keres (d.ts `:2023-2024`), így a kettő nem csúszhat el                        | user döntés          |
| O-13 | Hivatkozott skill törlése               | (a) tiltott, amíg lépés hivatkozik rá; (b) megengedett, a futás indítása hibát ad                                                              | (b): a hivatkozás a gráf JSON-jában van, a tiltáshoz minden gráfot át kellene vizsgálni; az indítási ellenőrzés meglévő minta | user döntés          |
| O-14 | A lépés `skills` mezőjének vezérlője    | (a) `SelectField` módválasztó (nincs beállítva / minden / lista) és `Checkbox` lista; (b) csak `Checkbox` lista                                | (a): a tárolt alak három állapotú, a (b) a `null` és az `'all'` különbségét elveszti                                          | user döntés          |
| O-15 | Fájl feltöltés és üres lista elem       | (a) a design system `file-upload` és `empty` átemelése; (b) `TextAreaField` beillesztéssel és sima szöveg                                      | (a): létező design system elem, a fájl feltöltés a természetes út                                                             | user döntés          |
| O-16 | Megerősítő dialógus (törlés, felülírás) | (a) a meglévő `Modal` (T-009-52 precedens); (b) az `alert-dialog` átemelése                                                                    | (a): már használt minta, nincs új átemelés                                                                                    | user döntés          |

### 14.3 MCP

| #    | Kérdés                                     | Opciók                                                                                                                                  | Ajánlott, indok                                                                               | Mi zárná le |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------- |
| O-17 | Hol konfigurálható az MCP szerver          | (a) lépésenként, a meglévő `mcpServers` mezőn; (b) globális MCP könyvtár a Beállításokon, a lépés név szerint hivatkozik; (c) mindkettő | (a): a tárolt alak kész, nincs sémaváltás és migráció, a SPEC-011 O-8 a mezőt hagyja meg      | user döntés |
| O-18 | A hiányzó MCP env változó hibaosztálya     | (a) új `missing_mcp_server_env` osztály saját magyar mondattal; (b) a meglévő `missing_provider_env` újrahasználata                     | (a): a felhasználó másképp javítja (a lépést, nem a providert), a mondatnak ezt kell mondania | user döntés |
| O-19 | Az `args` és az `envNames` lista vezérlője | (a) a design system `tag-input` átemelése; (b) `TextAreaField`, soronként egy érték                                                     | (a): létező design system elem egyértékű listára; kulcs-érték szerkesztő nem kell             | user döntés |

### 14.4 Izoláció

| #    | Kérdés                                                      | Opciók                                                                                                                              | Ajánlott, indok                                                                                         | Mi zárná le          |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------- |
| O-20 | Lássa-e a lépés a szerver gép saját Claude beállításait     | (a) nem: `settingSources: []` és `strictMcpConfig: true`; (b) igen, mint ma; (c) csak a `project` forrás                            | (a): a futás csak a workflow-ban beállítottat látja, gépfüggetlen és megismételhető; feltétele az M-138 | user döntés és M-138 |
| O-21 | Mi kerüljön a kimenő `env` blokkba a provider változóin túl | (a) az M-137 eredményéig semmi; utána egy megnevezett zárt lista a mérés szerint; (b) a teljes `process.env` a tiltott nevek nélkül | (a): a `disallowedEnv[]` védelem megmarad, szám és lista csak mérésből                                  | user döntés és M-137 |

### 14.5 Mérés jóváhagyás

| #    | Kérdés                                                        | Opciók                                                | Ajánlott, indok                                         | Mi zárná le |
| ---- | ------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- | ----------- |
| O-22 | Futhat-e valódi `claude-subscription` hívás az M-138 méréshez | (a) igen, egy rövid lépés; (b) nem, az O-20 (b) marad | (a): az izoláció hatása forrásból nem dönthető el (2.3) | user döntés |

### 14.6 A hiányleltár többi tételének besorolása

| #    | Tétel                                                                    | Opciók                                                                                                            | Ajánlott, indok                                                                                                        |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| O-23 | H-13 `script` csomópont végrehajtása                                     | (a) saját spec; (b) SPEC-009                                                                                      | (a): futtatási környezet és sandbox döntés, semmi köze a beállításokhoz                                                |
| O-24 | H-17 strukturált kimenet séma szerinti ellenőrzése                       | (a) saját spec; (b) SPEC-009                                                                                      | (a): JSON Schema validátor választás (új függőség, két forrás), motor szintű hiba                                      |
| O-25 | H-12 `StartInputField.valueKind` értékkészlete                           | (a) saját spec a futás bemenet típusaira; (b) a mező törlése; (c) SPEC-009                                        | (a): termékdöntés az értékkészletről, a futás indító űrlapot is érinti                                                 |
| O-26 | H-11 `join` `merge` `settings`                                           | (a) marad a SPEC-004 O-6 gazdájánál; (b) a mező elrejtése a szerkesztőből, amíg nincs szabály                     | (a), és a szerkesztő mutassa ki, hogy ma csak `{}` érvényes: a gazda létezik, a döntés ott vár                         |
| O-27 | H-18 `error_handler` várakozás nem szakítható meg                        | (a) hibajavítás regressziós teszttel, saját kis PR-ben, spec nélkül; (b) SPEC-009                                 | (a): a `run-interrupt` téma kész, csak a jel nincs bekötve; hiba, nem hatókör                                          |
| O-28 | H-20 `readRunEvents` útvonal web fogyasztó nélkül                        | (a) a SPEC-005 kimondja, hogy nem felületi útvonal, és marad; (b) törlés; (c) felület épül rá                     | (a): kiszolgált és tesztelt, a törlés változás haszon nélkül                                                           |
| O-29 | H-42 nincs helyi indítási út a szerverre, és nincs valódi provider próba | (a) saját kis spec (szerver indító script, helyi futtatás leírása, kézi provider próba lépés); (b) SPEC-009 része | (a): a Beállítások képernyő kézi kipróbálásához kell, de más hatókör; a valódi provider próba user jóváhagyást igényel |
| O-30 | H-23, H-24, H-25 elavult kommentek és doksik                             | (a) egy önálló doksi javító PR; (b) a PLAN-012 átvezetési lépése                                                  | (a): független a SPEC-009 tartalmától, kis, gyorsan ellenőrizhető                                                      |

Az "addig" mező a 14.6 minden soránál: a tétel a hiányleltárban marad a jelenlegi gazdával. A "mi
zárná le" mező: a user döntése, utána a hiányleltár gazda mezőjének frissítése.

---

## 15. Kapcsolódó dokumentumok

- [`../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md`](../plan/PLAN-012-beallitasok-es-agent-konfiguracio.md)
- [`../research/2026-10-26-hatokor-hianyleltar.md`](../research/2026-10-26-hatokor-hianyleltar.md)
- [`SPEC-008-graf-szerkeszto-es-futas-nezet.md`](SPEC-008-graf-szerkeszto-es-futas-nezet.md), 5.2, 5.11, 54. és 60. kritérium
- [`SPEC-003-domain-perzisztencia.md`](SPEC-003-domain-perzisztencia.md), 4.4, 4.13, 4.14, 6.6, 11.
- SPEC-011 (`docs/spec/SPEC-011-eszkoz-lanc-torles.md` a `feat/spec-011-eszkoz-lanc-torles` ágon), 3.2 és O-21
