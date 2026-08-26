# SPEC-000 mérési jegyzőkönyv, MiniMax

Dátum: 2026-08-26. SDK verzió (pinelve): `@anthropic-ai/claude-agent-sdk@0.3.245` (`tools/wire-probe/package.json`, ellenőrizve `bun run typecheck` hibátlan futásával). Modell: `MiniMax-M3`, kivéve M-11 (a) futása, ahol `MiniMax-M3[1m]` volt beállítva. Proxy port: `8787` (alapérték, `WIRE_PROBE_PORT` nem volt felülírva egyik futásnál sem). Upstream: `https://api.minimax.io/anthropic`. A proxy 6 különálló processzben futott (a `mcp__workspace__bash` hívások függetlenek), ezért az `artifacts/*.json` fájlok `seq` mezője processzenként 1-től indul újra; minden hivatkozás ezért a teljes fájlnévre (epoch időbélyeggel) mutat, nem a `seq`-re.

Ez a jegyzőkönyv nyers megfigyeléseket rögzít. Nem tartalmaz kiértékelést, nem tölti ki a `ProviderCapabilityDescriptor`-t, az a következő lépés dolga. Ahol egy megfigyelés nem egyértelmű, azt külön jelzem.

Összesítés: 17 eset (M-01 - M-17) valós HTTP forgalmat generált a proxyn keresztül, mindegyikhez van rögzített tranzakció. M-18 spec szerint passzív, nem indít saját kérést, az összes korábbi tranzakcióból elemez.

## Harness javítás a mérés közben (nem mérési eredmény)

Az M-03 első futása harness kivétellel állt le: `Converting circular structure to JSON ... property 'root' closes the circle`. Ez a `tools/wire-probe/src/harness/runner.ts` `describeOptions()` függvényében történt, a `meta.json` összeállításakor, miután a `query()` hívás már sikeresen lefutott (134 SDKMessage már le volt írva az `a.sdk-messages.ndjson`-ba a kivétel pillanatában). Az ok: az `Options.mcpServers` mezőbe ténylegesen átadott, `createSdkMcpServer` által létrehozott élő szerver objektum önmagára mutató `root` mezőt tartalmaz, amit a natív `JSON.stringify` körkörös hivatkozásként utasít el. Ez a harness saját hibája volt, nem mérési eredmény: a hiba a `meta.json` író kódban volt, nem a MiniMax válaszában.

Javítás: `describeOptions()` egy `WeakSet`-alapú ciklus-felismerő replacer-t kapott, ami a körkörös hivatkozást `"[circular]"` placeholderre cseréli, mielőtt a `JSON.stringify` elérné. `bun run typecheck` a javítás után is hibátlan. Az M-03-at ezután újrafuttattam, sikeresen (lásd lent). Ez a javítás minden `mcpServers`-t használó esetet érint (M-03, M-09, M-10, M-17), ezeknél mind sikeresen lefutott a `meta.json` írás a javítás után.

## M-01 Alap body és header leltár

Beállítás: nincs eltérés, referencia futás. Kimenetel: 2 db `POST /v1/messages`, mindkettő HTTP 200. `result` subtype: `success` (17 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-01/a.meta.json`, `tools/wire-probe/artifacts/00002-1787706770143.json` (1. kérés), `tools/wire-probe/artifacts/00003-1787706771598.json` (2. kérés).

Egy `query()` hívás alatt **két** különálló `POST /v1/messages` ment ki, eltérő body-val:

| | 1. kérés (`00002-...json`) | 2. kérés (`00003-...json`) |
|---|---|---|
| top-level kulcsok | `model, messages, system, tools, metadata, max_tokens, output_config, stream` | `model, messages, system, tools, metadata, max_tokens, thinking, context_management, output_config, stream` |
| `tools` tömb hossza | 0 (üres tömb, de a kulcs jelen van) | 25, mind `name` mezővel, egyik elemnek sincs `type` mezője a wire-en |
| `output_config` | `{"effort":"high","format":{"type":"json_schema","schema":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"],"additionalProperties":false}}}` | `{"effort":"high"}` |
| `thinking` | nincs jelen | `{"type":"adaptive"}` |
| `anthropic-beta` (8 vs 7 elem) | `claude-code-20250219, interleaved-thinking-2025-05-14, thinking-token-count-2026-05-13, context-management-2025-06-27, prompt-caching-scope-2026-01-05, mid-conversation-system-2026-04-07, effort-2025-11-24, structured-outputs-2025-12-15` | ugyanaz, `structured-outputs-2025-12-15` nélkül |
| `anthropic-version` | `2023-06-01` | `2023-06-01` |
| HTTP kód | 200 | 200 |

Nincs jelen egyik kérésben sem: `effort` (top-level), `tool_choice`, `container`, `top_k`, `stop_sequences`, `mcp_servers`. `output_config` **mindkét** kérésben jelen van, annak ellenére, hogy az M-01 case nem állít be sem `outputFormat`-ot, sem `effort`-öt.

Teljes header lista (1. kérés): `accept, authorization, content-type, user-agent, x-claude-code-session-id, x-stainless-arch, x-stainless-lang, x-stainless-os, x-stainless-package-version, x-stainless-retry-count, x-stainless-runtime, x-stainless-runtime-version, x-stainless-timeout, anthropic-beta, anthropic-dangerous-direct-browser-access, anthropic-version, x-app, connection, host, accept-encoding, content-length`. Az `authorization` érték a rögzített fájlban maszkolva: `"***...iac4"` (hossz- és utolsó-4-karakter-megtartó maszk, a proxy saját maszkolása, nem a mérés tárgya).

Nem egyértelmű: az 1. kérés célja (üres `tools`, kisebb body) nem derül ki magából a tranzakcióból, csak az, hogy létezik, és hogy `output_config.format.schema` egy `title` mezős sémát hordoz, ami NEM egyezik semmilyen, az M-01 case által kért sémával (az M-01 case nem is kér struktúrált kimenetet). Ez a minta minden más esetnél is megjelent (lásd M-02, M-04, M-07, M-08, M-11, M-14 lent), konzisztensen.

## M-02 `outputFormat` drótalakja

Beállítás: `outputFormat: { type: 'json_schema', schema: {label: string, count: number} }`. Kimenetel: 2 db `POST /v1/messages`, mindkettő HTTP 200, de a harness kivétellel zárult: `Claude Code returned an error result: Reached maximum number of turns (1)`, `result` subtype: `error_max_turns` (93 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-02/a.meta.json`, `tools/wire-probe/artifacts/00005-1787706773070.json`, `tools/wire-probe/artifacts/00006-1787706777349.json`.

Ez SDK kivétel, mérési eredmény, nem harness hiba: az M-02 case a SPEC-000 szerint `maxTurns` felülírás nélkül fut (csak M-03 kap explicit magasabb `maxTurns`-t), tehát a `maxTurns: 1` korlát a közös alapbeállításból jön.

- `output_config` az 1. kérésben: `{"effort":"high","format":{"type":"json_schema","schema":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"],"additionalProperties":false}}}` (ugyanaz a `title`-sémás alak, mint M-01-nél, NEM az M-02 case saját `label`/`count` sémája). `tools` tömb ekkor üres.
- `output_config` a 2. kérésben: `{"effort":"high"}`, séma nélkül. A `tools` tömb 26 elemű: a 25 standard Claude Code tool plusz egy `StructuredOutput` nevű tool, aminek `input_schema`-ja **pontosan** egyezik az M-02 case által megadott sémával: `{"type":"object","properties":{"label":{"type":"string"},"count":{"type":"number"}},"required":["label","count"]}`.
- HTTP kód mindkét kérésnél 200, nincs 400.

Megfigyelés Q1-hez: a kért `outputFormat` séma nem natív `output_config.format` mezőben, hanem egy szintetikus, `StructuredOutput` nevű tool `input_schema`-jaként utazik a `tools` tömbben, a 2. (fő) kérésben.

## M-03 `tool_choice` az `outputFormat` záró fázisában

Beállítás: M-02 alapjai plusz `mcp__measure__echo` in-process tool, `maxTurns: 5`, `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true`. Első futás harness kivétellel állt le (lásd fenti "Harness javítás" szakasz), újrafuttatva a javítás után sikeres volt. Kimenetel (2. futás): 4 db `POST /v1/messages`, mind HTTP 200, `result` subtype: `success` (332 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-03/a.meta.json`, `tools/wire-probe/artifacts/00002-1787706889829.json` .. `00005-1787706894314.json`.

`tool_choice` mező jelenléte mind a 4 kimenő kérésben: **nincs jelen egyikben sem** (`'tool_choice' in requestBody` mind a 4 kérésnél `false`). A 3-4. kérésben a `tools` tömb 27 elemű: a 25 standard tool, plusz `StructuredOutput` (a séma-tool), plusz `mcp__measure__echo`. Az utolsó (4.) kérés `output_config`-ja: `{"effort":"high"}`, `tool_choice` ott sem jelenik meg.

Megfigyelés Q2-höz: ebben a mérésben az SDK egyetlen kérésben sem küldött `tool_choice` mezőt, sem `auto`, sem `any`, sem `tool` típusút, annak ellenére, hogy a prompt explicit tool hívást kért és `outputFormat` is be volt állítva.

## M-04 `output_config` és `effort` kapcsolata

Beállítás: (a) `effort: 'low'`, (b) `effort: 'max'`, `outputFormat` nélkül. Kimenetel: futásonként 2-2 `POST /v1/messages`, mind HTTP 200, `result` subtype mindkét futásnál `success` (40 és 38 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-04/a-effort-low.meta.json`, `.../b-effort-high.meta.json`, tranzakciók: `00012-1787706783653.json`, `00013-1787706784538.json` (a), `00015-1787706786324.json`, `00016-1787706786958.json` (b).

Egyik kérésben sem jelenik meg `effort` top-level body kulcsként. Az 1. (thin) kérésben mindkét futásnál a szokásos `title`-sémás `output_config` megy ki (`effort` benne mindig `"high"`, függetlenül a case-ben beállított `effort` értéktől). A 2. (fő) kérésben:

| Futás | 2. kérés `output_config` |
|---|---|
| a (`effort: 'low'`) | `{"effort":"low"}` |
| b (`effort: 'max'`) | `{"effort":"max"}` |

Megfigyelés: az `effort` a `output_config.effort` mezőben utazik, sosem top-level `effort` kulcsként. HTTP kód mind a 4 kérésnél 200, nincs 400.

## M-05 `thinking` bekapcsolva

Beállítás: `thinking: { type: 'adaptive' }`, streamelve. Kimenetel: 2 `POST /v1/messages`, HTTP 200 mindkettő, `result` subtype `success` (20 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-05/a.meta.json`, `00018-1787706789138.json` (1., nincs thinking), `00019-1787706790418.json` (2., thinking).

A 2. kérés `thinking` mezője szó szerint: `{"type":"adaptive"}`, nincs benne `budget_tokens`. Stream event típusok (`00019-...json` `streamEvents` mezőjéből, `data:` sorok `type` értékei): `message_start, ping, content_block_start (type: "thinking"), delta:thinking_delta, content_block_delta, delta:signature_delta, content_block_stop, content_block_start (type: "text"), delta:text_delta, message_delta, message_stop`. Van `content_block_start` `thinking` típussal, és van záró `signature_delta`.

## M-06 `thinking` kikapcsolva

Beállítás: (a) `thinking: { type: 'disabled' }` explicit, (b) `thinking` opció nélkül, `MAX_THINKING_TOKENS=0` env. Kimenetel: futásonként 2-2 kérés, mind HTTP 200, mindkét futás `result` subtype `success` (10-10 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-06/a-explicit-disabled.meta.json`, `.../b-max-thinking-tokens-env.meta.json`, tranzakciók: `00021-1787706792224.json`, `00022-1787706792580.json` (a), `00024-1787706794828.json`, `00025-1787706795008.json` (b).

`'thinking' in requestBody`: **`false` mind a 4 kérésnél**, mindkét futásban. Sem az (a), sem a (b) futás egyik kérésében nem jelenik meg a `thinking` kulcs egyáltalán (nem `{"type":"disabled"}` alakban megy ki, hanem teljesen hiányzik).

Megfigyelés: (a) és (b) között a `thinking` mező szempontjából **nincs különbség**, mindkettő ugyanahhoz az eredményhez vezet: a mező hiányzik a bodyból. Ez egyszerre válasz a "melyik body mezőt viszi a `MAX_THINKING_TOKENS=0`" kérdésre is: ugyanazt (a mező hiányát), mint az explicit `thinking: {type:'disabled'}` opció.

## M-07 Háttér modellhívások

Beállítás: (a) alap, (b) `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, (c) `ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M3`, (d) `persistSession: true`. Kimenetel: mind HTTP 200, mind `result` subtype `success` (17, 24, 24, 64 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-07/{a-base,b-disable-nonessential-traffic,c-default-haiku-model,d-persist-session}.meta.json`.

| Futás | kérésszám | tranzakciók |
|---|---|---|
| a-base | 2 | `00007-1787706895917.json`, `00008-1787706897979.json` |
| b-disable-nonessential-traffic | **1** | `00010-1787706901895.json` |
| c-default-haiku-model | 2 | `00012-1787706906089.json`, `00013-1787706910973.json` |
| d-persist-session | 2 | `00015-1787706912444.json`, `00016-1787706913482.json` |

`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` mellett csak 1 kérés ment ki (a szokásos 1. "thin" kérés hiányzik). A `c-default-haiku-model` futásban (ahol `ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M3`) mindkét kérés `model` mezője szó szerint `"MiniMax-M3"`, nem jelent meg más alias vagy modellnév. Minden kérés `model` mezője az összes futásban `"MiniMax-M3"` volt, egyik esetben sem jelent meg eltérő (pl. haiku-alias) modellnév a wire-en.

Mind a 4 futásban az 1. kérés `messages` tartalma a felhasználói promptból ered (`"<session>\nMennyi kettő meg kettő?..."`), a 2. kérés (ahol volt) egy `<system-reminder>`-rel kezdődő, a CLAUDE.md-t és projekt kontextust tartalmazó szöveggel bővül, de ugyanahhoz a beszélgetéshez tartozik (nem különálló "session cím generálás" jellegű kérés volt beazonosítható a `messages` tartalma alapján).

Nem egyértelmű: a research által feltételezett, felhasználói szándéktól független "háttér" hívás (pl. session cím generálás, külön modellel) ebben a mérésben nem volt egyértelműen azonosítható; a megfigyelt 2 kérés mintázata (üres `tools` + `title`-sémás `output_config`, majd teli `tools` + valós `thinking`/`context_management`) minden esetnél (M-01, M-04, M-07, M-08, M-11, M-14) konzisztensen megjelenik, de a pontos rendeltetése a rögzített tranzakciókból önmagában nem dönthető el.

## M-08 Env kapcsoló mátrix

Beállítás: 5 futás, egyenként egy env eltérés az M-01 alaphoz képest. Kimenetel: mind HTTP 200, mind `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-08/<ENV_VAR>.meta.json`.

Diff az M-01 megfelelő (thin/full) tranzakciójához (`00002-...json` = thin bázis, `00003-...json` = full bázis):

| Env változó | kérésszám | full kérés: eltűnő body kulcs | eltűnő `anthropic-beta` elem(ek) | `cache_control` darabszám (full) | `tools.length` (full) |
|---|---|---|---|---|---|
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` | 2 | `context_management` | `thinking-token-count-2026-05-13, context-management-2025-06-27, prompt-caching-scope-2026-01-05` | 3 (nincs változás) | 25 (nincs változás) |
| `ENABLE_TOOL_SEARCH=false` | 2 | nincs | nincs | 3 (nincs változás) | 25 (nincs változás) |
| `DISABLE_PROMPT_CACHING=1` | 2 | nincs | nincs | **0** (bázis: 3) | 25 (nincs változás) |
| `MAX_THINKING_TOKENS=0` | 2 | `thinking, context_management` | nincs | 3 (nincs változás) | 25 (nincs változás) |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | **1** (a thin kérés hiányzik) | nincs (a maradék kérés egyébként azonos a bázissal) | nincs | 3 (nincs változás) | **24** (bázis: 25, hiányzik: `DesignSync`) |

Fájlok: `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`: `00018-1787706915494.json` (full), `00019-1787706915646.json` (thin). `ENABLE_TOOL_SEARCH`: `00021-1787706917018.json` (thin), `00022-1787706919335.json` (full). `DISABLE_PROMPT_CACHING`: `00024-1787706921048.json` (thin), `00025-1787706921810.json` (full). `MAX_THINKING_TOKENS`: `00027-1787706923939.json` (full), `00029-1787706924770.json` (thin). `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`: `00030-1787706928603.json` (full, egyetlen kérés).

Megjegyzendő eltérés: `MAX_THINKING_TOKENS=0` levette a `thinking` és `context_management` body kulcsokat, de az `anthropic-beta` headerből NEM vette le a `thinking-token-count-2026-05-13` és `context-management-2025-06-27` elemeket (azok a headerben maradtak, a body mezők viszont eltűntek). Ez a header/body "pár" nem szimmetrikus ennél az env változónál.

## M-09 Tool argumentum streaming

Beállítás: `mcp__measure__record_note` (title, tags, hosszú body) in-process tool, `maxTurns: 3`, `includePartialMessages: true`. Kimenetel: HTTP 200, `result` subtype `success` (65 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-09/a.meta.json`, `a.tool-callback-input.json`, tranzakciók `00002-1787706944060.json`, `00003-1787706954233.json`, `00004-1787706956312.json`.

A tool hívást tartalmazó tranzakcióban a `content_block_start` event `{"type":"tool_use"}` blokkjának `input` mezője **üres objektum** (`{}`) a start pillanatában. A rákövetkező delta típusok között (a `content_block_delta` eventek `delta.type` értékei) szerepel: `thinking_delta, signature_delta, input_json_delta`. Tehát a tool argumentum `input_json_delta` formában érkezik.

Bájtszintű összevetés: a tool callback ténylegesen megkapott argumentuma (`a.tool-callback-input.json`, `title: "napi jegyzet"`, `tags: ["teszt","mérés"]`, `body` hossza 1960 karakter) és az `a.sdk-messages.ndjson` assistant `tool_use` blokkjának `input` mezője **JSON string szinten bájtazonos** (`JSON.stringify(cb) === JSON.stringify(toolUseInput)` igaz, és a `body` mező string szinten is azonos).

## M-10 `Stop` hook kikényszerítés

Beállítás: `emit_output` in-process tool, `Stop` hook `decision: 'block'` visszaadással ha az `emit_output` még nem futott le, `stop_hook_active` figyelve, `maxTurns: 6`, 3 ismétlés. Kimenetel: mindhárom futás HTTP 200 minden kérésnél, `result` subtype mindhárom futásnál `success`, `num_turns: 2`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-10/{run-1,run-2,run-3}.meta.json`.

Mindhárom futásban 3-3 `POST /v1/messages` ment ki (`run-1`: `00002-1787706971980.json`, `00003-1787706973670.json`, `00004-1787706975166.json`; `run-2`: `00006-...`, `00007-...`, `00008-...json`; `run-3`: `00010-...`, `00011-...`, `00012-...json`), és mindhárom futásban az `emit_output` tool ténylegesen meghívódott (`mcp__workflow__emit_output` tool_use blokk jelen van az assistant üzenetekben).

A `Stop` hook blokkoló `reason` szövege ("Az emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel.") **egyetlen kimenő kérésben, egyetlen `messages` elemben sem jelenik meg**, sem az `sdk-messages.ndjson`-ban. Ebből az következik (nem kiértékelés, hanem közvetlen megfigyelés): a `Stop` hook blokkoló ága ebben a mérésben egyszer sem lépett működésbe, mert a modell magától, a hook beavatkozása nélkül meghívta az `emit_output`-ot 2 kör alatt, mielőtt a `Stop` hook egyáltalán blokkolhatott volna.

Ugyanakkor `run-1` 2. és 3. kérésében (`00003-...json`, `00004-...json`) a `messages` tömb **utolsó eleme** `role: "system"` értékű, és tartalma nem a fenti blokkoló szöveg, hanem környezeti jellegű szöveg (pl. "Available agent types for the Agent tool: ..." az 1. ilyen kérésben, illetve egy `<total_tokens>...</total_tokens>` jellegű szöveg a másodikban). Ennek eredete és rendeltetése ebből a mérésből nem állapítható meg egyértelműen; nem a case saját `Stop` hook szövege. HTTP kód ezeknél is 200 volt, tehát a `role: "system"` mid-conversation üzenet MiniMax ellen ebben a konkrét esetben nem okozott hibát.

Nem egyértelmű: mivel a blokkoló ág sosem futott le, a Q8 kérdésre ("a blokkolás reason szövege user vagy system role-lal jelenik meg") ez a mérés nem ad közvetlen választ.

## M-11 `[1m]` suffix kezelése

Beállítás: (a) `model: 'MiniMax-M3[1m]'`, (b) `model: 'MiniMax-M3'`. Kimenetel: mindkét futás HTTP 200 mindkét kérésnél, `result` subtype `success` (17-17 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-11/{a-with-suffix,b-without-suffix}.meta.json`, tranzakciók `00006-1787706958183.json`, `00007-1787706958835.json` (a), `00009-1787706960605.json`, `00010-1787706960957.json` (b).

A kimenő body `model` mezője **mindkét futás mindkét kérésénél** szó szerint `"MiniMax-M3"`. A `[1m]` suffix **nem jelenik meg** a dróton az (a) futásnál sem. Az `anthropic-beta` header viszont eltér: az (a) futásnál tartalmazza a `context-1m-2025-08-07` elemet, a (b) futásnál nem (ez az egyetlen megfigyelt különbség a két futás között, a `model` mezőn kívül minden más body kulcs azonos). Nincs 404, egyik futásban sem.

## M-12 Nem-Messages végpontok

Beállítás: nincs `query()` szintű eltérés, `initializationResult()` + `supportedModels()` hívás, `close()`. Kimenetel: harness hiba nélkül. Artefaktum: `tools/wire-probe/artifacts/harness/M-12/a.lifecycle.json`.

A teljes mérési munkamenet alatt (mind a 6 proxy processz, mind a 113 tranzakció) a proxyra **kizárólag** két útvonalra érkezett kérés: `HEAD /anthropic/api/hello` (34x, mind HTTP 404) és `POST /anthropic/v1/messages` (79x, mind HTTP 200). **Egyetlen `GET /v1/models` vagy `POST /v1/messages/count_tokens` kérés sem ment ki** a teljes mérés alatt, M-12 saját futása alatt sem.

A `supportedModels()` visszatérése (helyi, nem drótszintű adat) 6 elemű listát ad: `default, opus[1m], sonnet, sonnet[1m], haiku, MiniMax-M3`, ahol a `MiniMax-M3` bejegyzés `resolvedModel: "MiniMax-M3"`, `displayName: "MiniMax-M3"`, `description: "Custom model"`. Ez a lista a helyi SDK/CLI konfigurációból származik, nem drótszintű `GET /v1/models` válaszból, mert ilyen kérés nem ment ki.

## M-13 Kontextusablak és auto-compact

Beállítás: `persistSession: true`, `maxTurns: 22`, legfeljebb 20 kör, ismétlődő töltelékszöveggel, 5 perces belső időkorlát. Kimenetel: nem lépte túl az időkorlátot (a teljes futás kb. 18 másodperc alatt lezárult), `timedOut: false`, `result` subtype `success`, `num_turns: 1`. Artefaktum: `tools/wire-probe/artifacts/harness/M-13/a.meta.json`.

Mindössze **3** `POST /v1/messages` ment ki (`00002-1787707051566.json`, `00003-1787707057230.json`, `00004-1787707066903.json`), annak ellenére, hogy a promptgenerátor akár 20 kört is küldhetett volna. A `system` típusú SDKMessage-ök subtype-jai: `init, status, thinking_tokens`. **Nincs compact boundary jellegű `system` üzenet** a 100 rögzített SDKMessage között (a "compact" szó egyetlen előfordulása a lokális `initializationResult()` parancslistájában szereplő `/autocompact` és `/compact` slash parancsnevek, nem tényleges compact esemény).

A záró `result` üzenet `usage` mezője: `input_tokens: 32915, cache_creation_input_tokens: 0, cache_read_input_tokens: 128, output_tokens: 444`. `POST /v1/messages/count_tokens` kérés a teljes mérés alatt egyszer sem ment ki (0 db).

Nem egyértelmű: nem állapítható meg ebből a mérésből, hogy a promptgenerátor miért csak 3 kérés (jellemzően 1 valós kört jelentő, tehát a szokásos "thin + full" pár, plusz még egy) után zárult le, miközben 20 kör lett volna elérhető; a `413 request_too_large` hiba nem fordult elő, tehát a leállás oka nem a kontextusablak túllépése volt.

## M-14 `anthropic-beta` header leltár

Beállítás: (a) alap, (b) `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`, (c) `ENABLE_TOOL_SEARCH=false`. Kimenetel: mind HTTP 200, mind `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-14/{a-base,b-disable-experimental-betas,c-enable-tool-search-false}.meta.json`.

| Futás | full kérés fájl | eltűnő body kulcs (M-01 full bázishoz képest) | eltűnő `anthropic-beta` elem(ek) |
|---|---|---|---|
| a-base | `00033-1787706931339.json` | nincs | nincs |
| b-disable-experimental-betas | `00035-1787706933819.json` | `context_management` | `thinking-token-count-2026-05-13, context-management-2025-06-27, prompt-caching-scope-2026-01-05` |
| c-enable-tool-search-false | `00039-1787706936319.json` | nincs | nincs |

`anthropic-version` mindhárom futás mindkét kérésénél `2023-06-01`, nem változik. Ez a mátrix egyezik az M-08-nál `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` és `ENABLE_TOOL_SEARCH` env változókra kapott eredménnyel (kereszt-validálva, 2 független futásból ugyanaz az eltérés adódott).

## M-15 Prompt caching drótalak

Beállítás: (a) és (b) azonos, hosszú system prompt kiegészítéssel, közvetlenül egymás után, (c) ugyanaz `DISABLE_PROMPT_CACHING=1` mellett. Kimenetel: mind HTTP 200, mind `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-15/{a-first,b-second-immediately-after,c-cache-disabled}.meta.json`.

| Futás | full kérés fájl | `cache_control` blokkszám | szekció | `usage` (message_delta stream eventből) |
|---|---|---|---|---|
| a-first | `00003-1787707038279.json` | 3 | `system:2, messages:1` | `input_tokens:28950, cache_read_input_tokens:128` |
| b-second-immediately-after | `00006-1787707041231.json` | 3 | `system:2, messages:1` | `input_tokens:28950, cache_read_input_tokens:128` |
| c-cache-disabled | `00009-1787707043500.json` | **0** | - | `input_tokens:28950, cache_read_input_tokens:128` |

A `cache_control` blokk alakja szó szerint: `{"type":"ephemeral"}`. A (c) futásnál (`DISABLE_PROMPT_CACHING=1`) a `cache_control` blokkok teljesen eltűnnek a full kérésből (0 db a bázis 3-hoz képest). A válasz `usage`-ban a `cache_creation_input_tokens` mező egyik streamelt `message_delta` eventben sem jelent meg explicit módon (a `cache_read_input_tokens` viszont mindhárom futásnál 128). A "thin" (1.) kérésnél az (a) futásban `cache_read_input_tokens: 128`, a (b) futásnál `cache_read_input_tokens: 768`, a (c) futásnál `cache_read_input_tokens: 128`.

Nem egyértelmű: a válasz `usage` mezőjében nem volt megfigyelhető `cache_creation_input_tokens` kulcs egyik stream eventben sem (csak `cache_read_input_tokens`), ezért nem állapítható meg ebből a mérésből, hogy az (a) futás valóban létrehozott-e cache bejegyzést, vagy a `cache_read_input_tokens: 128` már egy korábbi, session-en kívüli cache találat.

## M-16 Kép bemenet

Beállítás: streaming input módban egy 1x1 pixeles base64 PNG content blokk. Kimenetel: HTTP 200, `result` subtype `success` (73 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-16/a.meta.json`, tranzakciók `00014-1787706989269.json`, `00015-1787706992481.json`.

A kimenő `messages[].content[]` a 2. (fő) kérésben 3 elemű: `{"type":"text",...}` (system-reminder szöveg), `{"type":"text","text":"Milyen színű ez a kép? Egyetlen szóval válaszolj."}`, `{"type":"image","source":{"type":"base64","media_type":"image/png","data_len":92}}` (a `data` mező 92 karakter hosszú base64 string, itt csak a hossza szerepel, nem a teljes érték). HTTP 200, nincs hibaválasz.

Az asszisztens válaszszövege szó szerint: `"Nem látok képet a beszélgetésben."`

## M-17 Szerver oldali tool

Beállítás: webkeresést kérő prompt, `allowedTools: ['WebSearch']`, `maxTurns: 3`. Kimenetel: 8 db `POST /v1/messages`, mind HTTP 200, harness kivétellel zárult: `Claude Code returned an error result: Reached maximum number of turns (3)`, `result` subtype `error_max_turns` (1026 SDKMessage). Artefaktumok: `tools/wire-probe/artifacts/harness/M-17/a.meta.json`, tranzakciók `00017-...json` .. `00024-...json` (8 db, sorban).

A `web_search` tool a kimenő `tools` tömbben **önálló, egyetlen elemű** kérésekben jelenik meg (3 db ilyen kérés: `00019-1787707009344.json`, `00022-1787707027097.json`, `00023-1787707027740.json`), szó szerint: `{"type":"web_search_20250305","name":"web_search","max_uses":8}`. Ez szerver oldali tool típusjelölés (`web_search_20250305`), nincs `input_schema` mezője. A többi kérésben (`00017`, `00018`, `00020`, `00021`, `00024`) a `tools` tömb vagy üres, vagy a 25 standard Claude Code tool, `web_search` nélkül. Egyik stream válaszban sem volt megfigyelhető szerver oldali tool eredmény blokk (`server_tool_use` vagy `web_search_tool_result` string nem fordul elő a rögzített `streamEvents` sorokban).

Nem egyértelmű: a 8 kérésből álló, váltakozó mintázat (üres/teli/csak-web_search tools tömbök felváltva) pontos oka és sorrendi logikája ebből a mérésből nem rekonstruálható egyértelműen, illetve nem derül ki, hogy a `web_search_20250305` tool ténylegesen lefutott-e szerver oldalon (mert nincs eredmény blokk), vagy a `maxTurns: 3` limit megakadályozta a lefutását.

## M-18 Hiba és rate limit header leltár (passzív)

Nincs önálló futás. A teljes mérési munkamenet 113 rögzített tranzakciójából:

- Státuszkód eloszlás: `200`: 79 db, `404`: 34 db. Nincs `429`, nincs `4xx` a `404`-en kívül, nincs `5xx`.
- Az összes megfigyelt válasz header név (unió, teljes munkamenet): `access-control-allow-origin, alb_receive_time, alb_request_id, cache-control, connection, content-length, content-type, date, expires, minimax-request-id, pragma, trace-id, transfer-encoding, vary, x-from, x-mm-request-id, x-session-id`.
- `retry-after` vagy `ratelimit` alstringet tartalmazó header: **nincs egyetlen tranzakcióban sem.**
- A 34 db `404` válasz mindegyike `HEAD /anthropic/api/hello`-ra érkezett, üres törzzsel (`content-length: 18`, de a `HEAD` metódus miatt a proxy `responseBody`-ja `null`; a `content-length` fejléc jelzi, hogy 18 byte törzs tartozna hozzá GET esetén). Nincs Anthropic-alakú (`{"type":"error",...}`) és nincs `base_resp.status_code`-alakú hibatörzs rögzítve, mert egyetlen `POST /v1/messages` sem eredményezett 4xx vagy 5xx választ a teljes mérés alatt.

Mivel a mérés alatt nem keletkezett `429`, a `retry-after` és `ratelimit`-jellegű headerek megléte erről a szolgáltatásról ebből a mérésből nem állapítható meg.

---

# M-19 - M-25 kiegészítő mérések

Dátum: 2026-08-26 (külön munkamenet, a fenti M-01 - M-18 sorozat lezárása után). SDK verzió (pinelve): `@anthropic-ai/claude-agent-sdk@0.3.245`, változatlan. Modell: `MiniMax-M3`, kivéve M-20, ahol `MiniMax-M3[1m]`. Proxy port: `8787`. A `tools/wire-probe/src/cases/M-19.ts` .. `M-25.ts` forrásában a pontos beállítás minden esethez visszakereshető.

## Harness javítás a kiegészítő mérés közben (nem mérési eredmény)

Az M-20 első futása közben derült ki, hogy a `tools/wire-probe/src/harness/runner.ts` `executeQuery()` a `meta.json`-ba az `Options.env`-et szó szerint kiírja (`describeOptions`), az pedig a `buildBaseOptions()` miatt a teljes `process.env`-et tartalmazza. Ez a mérési munkamenet indításához használt `. ~/envrc` a `GITHUB_TOKEN` és `GH_TOKEN` értékét is beteszi a shell környezetbe, ezek a mérés előtti javítás nélkül **nyers szövegként kerültek volna lemezre** minden egyes `meta.json`-ba (ellenőrizve: `tools/wire-probe/artifacts/harness/M-20/probe-1-chars600000.meta.json` korábbi, javítás előtti verziójában mindkét változó nyers értéke jelen volt). A `redactKnownSecrets()` hívás korábban kizárólag a `MINIMAX_API_KEY`-t fésülte át.

Javítás: `runner.ts` az `executeQuery()`-ben a `redactKnownSecrets()` hívásnak mostantól a `process.env.GITHUB_TOKEN` és `process.env.GH_TOKEN` értékét (ha van) is átadja a `MINIMAX_API_KEY` mellett. `bun run typecheck` a javítás után is hibátlan. A javítás előtt már lemezre írt, érintett `meta.json` fájlokat (11 db, mind a korábbi M-01 - M-18 sorozatból) helyben átfésültem (`sed`) `REDACTED`-re -- ez nem mérési eredmény módosítása, csak titok eltávolítás a már rögzített artefaktumból. Ellenőrzés utána: `grep -rl "$GITHUB_TOKEN" tools/wire-probe/artifacts/ docs/` 0 találat.

Emellett az M-20 első (javítás előtti) próbafutása egy második, valódi mérési megfigyelést is hozott a `CLAUDE_CODE_MAX_OUTPUT_TOKENS` méretezéséről -- lásd az M-20 szekció elején.

## M-19 `Stop` hook kikényszerítés emit_output említése nélkül

Beállítás: az M-10 mintája megismételve úgy, hogy a prompt (`"Számold ki mennyi 2+2."`) nem említi az `emit_output` toolt, `stop_hook_active` loop-védelem plusz kemény `MAX_BLOCKS=3` korlát a blokkolásokra, `maxTurns: 8`, 10 ismétlés. Kimenetel: mind a 10 futás `result` subtype `success`, mindegyikben `blockCount=1` és `emitOutputCalled=true` -- **10/10 sikerarány**. Artefaktumok: `tools/wire-probe/artifacts/harness/M-19/run-1.meta.json` .. `run-10.meta.json` (+ `.sdk-messages.ndjson` mindegyikhez).

A `run-1` négy kimenő kérésének (`tools/wire-probe/artifacts/00002-1787737236766.json` .. `00005-1787737242527.json`) vizsgálata: a **3. kérésben** (`00004-1787737239994.json`) a `messages` tömb utolsó eleme `role: "user"`, tartalma szó szerint: `"Stop hook feedback:\nAz emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel."` (`cache_control: {"type":"ephemeral"}` melléklettel). A Claude Code CLI tehát a hook `reason` szövegét egy `"Stop hook feedback:"` előtaggal, **`user` role-lal** küldi ki a dróton, nem `system` role-lal.

A 2. és 4. kérésben (`00003`, `00005`) a `messages` tömb utolsó eleme szintén `role: "system"`, de a tartalma **nem** a Stop hook szövege, hanem ugyanaz a környezeti jellegű szöveg, mint amit az M-10 mérés is rögzített (`"Available agent types for the Agent tool: ..."`, illetve egy `<total_tokens>...</total_tokens>` jellegű szöveg). HTTP kód mind a 4 kérésnél 200.

A `blockCount=1` és `emitOutputCalled=true` mind a 10 futásnál a harness saját (probe.ts kimeneti sorai alapján rögzített) jelzése; a wire szintű `role` ellenőrzést csak `run-1`-re végeztem el részletesen.

## M-20 Kontextusablak felső korlátja bináris kereséssel

Beállítás: `model: 'MiniMax-M3[1m]'`, bináris keresés legfeljebb 8 kérésben, kiinduló cél 600 000 karakter.

**Első próbafutás (elvetve, nem mérési eredmény):** `CLAUDE_CODE_MAX_OUTPUT_TOKENS=16` mellett a `probe-1` `meta.json`-ja `harnessError: "API Error: Claude's response exceeded the 16 output token maximum..."` hibát rögzített, és a proxy tranzakciók (`tools/wire-probe/artifacts/00002-1787737435226.json` .. `00005-...json`) megmutatták, hogy **egyetlen probe alatt négy külön `POST /v1/messages` ment ki** ugyanazzal a hatalmas prompttal -- a CLI a 16 tokenre levágott választ hibaként kezelte és a teljes kérést (a töltelék szöveggel együtt) újraküldte. Ez a harness saját, túl alacsonyra választott `MINIMAL_MAX_OUTPUT_TOKENS` beállítása volt, nem mérési eredmény. Javítás: az érték 256-ra emelve, a case elölről futtatva.

Kimenetel (a javított futás, egyetlen munkamenetben lement mind a 8 kérés): Artefaktumok: `tools/wire-probe/artifacts/harness/M-20/probe-1-chars600000.meta.json` .. `probe-8-chars2550000.meta.json`, `search-state.json`.

| # | targetChars | HTTP | `usage.input_tokens` | `usage.cache_read_input_tokens` | tranzakció |
|---|---|---|---|---|---|
| 1 | 600 000 | 200 | 266699 | 128 | `00003-1787737784634.json` |
| 2 | 1 200 000 | 200 | 1483 | 505344 | `00006-1787737788764.json` |
| 3 | 2 400 000 | 200 | 986667 | 160 | `00009-1787737825279.json` |
| 4 | 4 800 000 | 400 | - | - | (lásd hibaszöveg lent) |
| 5 | 3 600 000 | 400 | - | - | (lásd hibaszöveg lent) |
| 6 | 3 000 000 | 400 | - | - | (lásd hibaszöveg lent) |
| 7 | 2 700 000 | 400 | - | - | (lásd hibaszöveg lent) |
| 8 | 2 550 000 | 200 | 61483 | 985344 | `00023-1787737855251.json` |

A 4 hibás kérés (4., 5., 6., 7.) mindegyikének `harnessError` mezője szó szerint azonos: `"Claude Code returned an error result: API Error: 400 invalid params, context window exceeds limit (2013)"`. A keresés a `MAX_REQUESTS=8` kemény korlát miatt állt le (nem konvergencia miatt): a legnagyobb sikeres méret (2 550 000 karakter) és a legkisebb hibás méret (2 700 000 karakter) között 150 000 karakternyi rés maradt lezáratlanul.

Nem egyértelmű: az `usage.input_tokens` értéke a targetChars mérettel nem monoton nő (266699 -> 1483 -> 986667 -> 61483), miközben az `usage.cache_read_input_tokens` a kis `input_tokens` értékű probe-oknál nagy (505344, illetve 985344). Mivel a töltelék szöveg minden probe-nál ugyanannak az ismétlődő frázisnak a prefixe, ez összefügghet a MiniMax implicit prompt cache viselkedésével, de ennek a mérésnek nem tárgya ennek eldöntése.

## M-21 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` hatása

Beállítás: `env: CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`, egyetlen eltérés az alaphoz képest. Kimenetel: **1 db** `POST /v1/messages` (nem 2), HTTP 200, `result` subtype `success` (22 SDKMessage). Artefaktum: `tools/wire-probe/artifacts/harness/M-21/a.meta.json`, tranzakció: `tools/wire-probe/artifacts/00002-1787737359743.json`.

A kimenő kérés `tools` tömbje 25 elemű, **tartalmazza** a `DesignSync` toolt. Az M-08 mérésben a `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` szintén 1 kérésre vitte le a kérésszámot, de ott a `tools` tömb 24 elemű volt, `DesignSync` nélkül. A session cím generáló ("thin") kérés a `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` kapcsolónál is eltűnt, ugyanúgy mint a `NONESSENTIAL_TRAFFIC` kapcsolónál, de a `DesignSync` tool megmaradt.

## M-22 `CLAUDE_CODE_MAX_OUTPUT_TOKENS` felső korlátja

Beállítás: 4 futás, `CLAUDE_CODE_MAX_OUTPUT_TOKENS` = 4096, 32000, 131072, 524288. Kimenetel: mind HTTP 200 mindkét kérésnél, mind `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-22/max-output-tokens-<érték>.meta.json`.

| env érték | kimenő body `max_tokens` | HTTP |
|---|---|---|
| 4096 | 4096 | 200 |
| 32000 | 32000 | 200 |
| 131072 | **128000** | 200 |
| 524288 | **128000** | 200 |

Tranzakciók: `00004`/`00005-...json` (4096), `00007`/`00008-...json` (32000), `00010`/`00011-...json` (131072), `00013`/`00014-...json` (524288, mind `tools/wire-probe/artifacts/`). A 131072 és az 524288 env érték is ugyanarra a 128000 wire `max_tokens` értékre képződött le; a 4096 és 32000 érték változatlanul, egyezően ment ki.

## M-23 Kép bemenet felismerhető tartalommal

Beállítás: az M-16 mintája, 256x256 pixeles, tiszta piros (RGB 255,0,0) PNG, a harness által programozottan generálva (`zlib.crc32` + `zlib.deflateSync`). Kimenetel: HTTP 200, `result` subtype `success` (22 SDKMessage). Artefaktum: `tools/wire-probe/artifacts/harness/M-23/a.meta.json`.

Az asszisztens válaszszövege szó szerint: `"Nincs kép."`. Ugyanaz a mintázat, mint az M-16 mérésnél (`"Nem látok képet a beszélgetésben."`), most egy érvényes méretű és egyértelmű tartalmú képpel is.

## M-24 Prompt cache írás igazolása stream nélküli móddal

Beállítás: az M-15 (a) és (b) futásának megismétlése. A telepített SDK `Options` típusában nincs `stream` mező (`sdk.d.ts`, `Options.includePartialMessages` doksija csak a kliens oldali `SDKMessage` kiadást szabályozza, a drótra kiküldött kérés `stream` mezőjét nem érinti) -- emiatt tényleges `stream: false` kérést nem lehetett kiváltani. Kimenetel: mindkét futás HTTP 200 mindkét kérésénél, `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-24/a-first.meta.json`, `b-second-immediately-after.meta.json`.

A kimenő body `stream` mezője mind a 4 kérésnél szó szerint `true`. A `responseBody` mind a 4 tranzakciónál `null`, a válasz SSE eseménysorként érkezett (`streamEvents` nem `null`).

| futás | kérés | `usage.input_tokens` | `usage.cache_read_input_tokens` |
|---|---|---|---|
| a-first | thin | 799 | 128 |
| a-first | full | 29299 | 128 |
| b-second | thin | 799 | 128 |
| b-second | full | 29299 | 128 |

A `message_start.message.usage` objektum egyik kérésnél sem tartalmaz `cache_creation_input_tokens` kulcsot (csak `input_tokens`, `output_tokens`, `service_tier`). A `message_delta.usage` objektum sem tartalmaz `cache_creation_input_tokens` kulcsot egyik kérésnél sem.

Nem egyértelmű: a `cache_read_input_tokens` a b (második) futásnál sem nőtt az a (első) futáshoz képest (mindkettő 128) -- ez megegyezik az M-15-nél már rögzített mintával, nem új megfigyelés.

## M-25 Szerver oldali tool magasabb `maxTurns` mellett

Beállítás: az M-17 mintája, `maxTurns: 12` (M-17-nél 3 volt). Kimenetel: HTTP 200 mind a 7 kérésnél, `result` subtype **`success`** (M-17-nél `error_max_turns` volt, 8 kérés után). Artefaktum: `tools/wire-probe/artifacts/harness/M-25/a.meta.json`, tranzakciók: `tools/wire-probe/artifacts/00002-1787737402733.json` .. `00008-1787737418290.json`.

A `web_search_20250305` típusú szerver oldali tool 3 kérésben jelenik meg önálló, egyelemű `tools` tömbben (`00004`, `00006`, `00007`), ugyanúgy mint M-17-nél. **Egyik stream válaszban sem jelent meg `server_tool_use` vagy `web_search_tool_result` blokk**, annak ellenére, hogy a futás sikeresen (`result` subtype: `success`) lezárult, és a `maxTurns` limit nem szakította meg.

## Záró ellenőrzések (M-19 - M-25)

- `grep -rl "$MINIMAX_API_KEY" tools/wire-probe/artifacts/ docs/` (a repo gyökér `.env`-jéből kiolvasott valós kulcsértékkel): **0 találat.**
- `grep -rl "$GITHUB_TOKEN" tools/wire-probe/artifacts/ docs/`: **0 találat** (a javítás előtt 11 fájlban volt jelen, lásd fent).
- `bun run typecheck`: hibátlan a `harness javítás` és a hét új case fájl felvétele után is.

## Záró ellenőrzések

- `grep -r "$MINIMAX_API_KEY" tools/wire-probe/artifacts/ docs/`: **0 találat.**
- Ez a jegyzőkönyv fájl: nem tartalmazza a kulcsot (csak maszkolt mintát, ld. M-01 header szakasz).
- `bun run summary` (`tools/wire-probe/src/summary.ts`) lefutott, esetenként egy sort ad: futás azonosító, ok/HIBA/TIMEOUT, a korrelált proxy tranzakciók HTTP kódjai, a kritikus body mezők (`output_config, thinking, tool_choice, context_management`) jelenléte, az `anthropic-beta` érték(ek), a `result` subtype, az SDKMessage és proxy tranzakció darabszám. Minden M-01 - M-17 sor `[ok]` vagy `[HIBA]` (a `[HIBA]` sorok M-02 és M-17, mindkettő `error_max_turns`, fent részletezve, nem harness hiba). Nincs `TIMEOUT` sor.
- `bun run typecheck`: hibátlan a harness javítás után is.

---

# M-26 - M-36 kiegészítő mérés: a felhasználó tényleges indító parancsa

Dátum: 2026-08-26 (harmadik, külön munkamenet). SDK verzió (pinelve): `@anthropic-ai/claude-agent-sdk@0.3.245`, változatlan (ellenőrizve minden érintett `meta.json` `sdkVersionPin` mezőjében). Modell: `MiniMax-M3`, kivéve M-28/M-29/M-32, ahol a fő modell `MiniMax-M3[1m]`. Proxy port: `8787`, egyetlen processzben futott ehhez a teljes körhöz, ezért az `artifacts/*.json` `seq` mezője 1-től 50-ig egyenletesen nő ebben a körben (proxy leállási log: "rögzített tranzakciók: 50"). Upstream: `https://api.minimax.io/anthropic`. A `tools/wire-probe/src/cases/M-26.ts` .. `M-36.ts` forrásában a pontos beállítás minden esethez visszakereshető.

Ez a mérési kör a felhasználó ténylegesen használt indító parancsának env változóit méri: `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, `CLAUDE_CODE_DISABLE_FAST_MODE`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `ANTHROPIC_DEFAULT_HAIKU_MODEL` (suffix nélkül), `API_TIMEOUT_MS`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, plusz egy referencia futás mind a 12 változóval együtt. Emellett lezárja a hat nyitva maradt capability mezőt, ahol ez mérhető volt.

## M-26 `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` hatása

Beállítás: (a) alap (nincs `Options.effort`, nincs extra env). (b) `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1`, `Options.effort` itt sincs beállítva. Kimenetel: mindkét futás HTTP 200 mindkét kérésénél, `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-26/{a-base,b-always-enable-effort}.meta.json`.

| Futás | thin kérés `output_config` | full kérés `output_config` | tranzakciók |
|---|---|---|---|
| a-base | `{"effort":"high","format":{...title séma...}}` | `{"effort":"high"}` | `00002-1787742422775.json`, `00003-1787742425723.json` |
| b-always-enable-effort | `{"effort":"high","format":{...title séma...}}` | `{"effort":"high"}` | `00005-1787742427896.json`, `00006-1787742428703.json` |

A két futás `output_config` mezője **karakterről karakterre azonos** mindkét kérésfajtánál. Nincs `output_config` mezőn kívüli eltérés sem a body top-level kulcsaiban, sem az `anthropic-beta` headerben (mindkettő a szokásos, M-01-nél rögzített listát hordozza). A `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1` beállítás jelenléte vagy hiánya ebben a mérésben **semmilyen megfigyelhető különbséget nem okozott a dróton**.

## M-27 `CLAUDE_CODE_DISABLE_FAST_MODE` hatása

Beállítás: (a) alap. (b) `CLAUDE_CODE_DISABLE_FAST_MODE=1`. Kimenetel: mindkét futás HTTP 200 mindkét kérésénél, `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-27/{a-base,b-disable-fast-mode}.meta.json`.

Tranzakciók: a-base `00008-1787742431972.json` (thin), `00009-1787742436853.json` (full); b-disable-fast-mode `00011-1787742438656.json` (thin), `00012-1787742441222.json` (full). A négy kérés `output_config`, `thinking` (`{"type":"adaptive"}` a full kérésben), `cache_control` darabszám (3 a full kérésben) és `anthropic-beta` header listája **mind a négy tranzakcióban azonos**. Drótszinten nincs megfigyelhető eltérés.

Ugyanakkor a kliens oldali `SDKMessage` folyam eltér: `a-base.sdk-messages.ndjson` típus szerinti eloszlása `{"system":4,"stream_event":10,"assistant":2,"result":1}`, ezen belül a `system` üzenetek subtype-jai `{"init":1,"status":1,"thinking_tokens":2}`. A `b-disable-fast-mode.sdk-messages.ndjson` eloszlása `{"system":26,"stream_event":33,"assistant":2,"result":1}`, subtype-ok `{"init":1,"status":1,"thinking_tokens":24}`. A `thinking_tokens` típusú `system` üzenetek száma 2-ről 24-re nő, a `stream_event` szám 10-ről 33-ra, miközben a kimenő HTTP kérések száma (2), tartalma és headerei változatlanok.

## M-28 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` és `CLAUDE_CODE_AUTO_COMPACT_WINDOW` együtt

Beállítás: `model: 'MiniMax-M3[1m]'`, `persistSession: true`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000`, legfeljebb 8 kör ismétlődő töltelékszöveggel (az M-13 mintájára, rövidebbre fogva). Kimenetel: `timedOut: false`, `result` subtype `success`, `num_turns: 2`. Artefaktum: `tools/wire-probe/artifacts/harness/M-28/a.meta.json`.

Az `a.sdk-messages.ndjson` 999 SDKMessage-t tartalmaz, típus szerint `{"system":429,"stream_event":563,"assistant":5,"user":1,"result":1}`. A `system` üzenetek subtype-jai kizárólag `init`, `status`, `thinking_tokens` -- **nincs compact boundary jellegű `system` üzenet** (ugyanaz a minta, mint M-13-nál). A záró `result.usage`: `input_tokens:80987, cache_creation_input_tokens:0, cache_read_input_tokens:33490, output_tokens:1562` (ebből `thinking_tokens:959`). A `result.modelUsage["MiniMax-M3[1m]"]` mezője: `contextWindow:1000000, maxOutputTokens:32000, canonicalModel:"minimax-m3[1m]", inputTokens:88358, cacheReadInputTokens:33618, costUSD:0.497899`.

Nem egyértelmű: a `num_turns: 2` -- a promptgenerátor akár 8 kört is küldhetett volna, de a session ugyanúgy 2 valós kör után lezárult, mint M-13-nál (ott 20 lehetséges körből is csak 1 valós kör futott le). A `contextWindow:1000000` érték a `[1m]` suffixből adódik (M-11, M-20 mintájára), nem a két új env kapcsolóból.

## M-29 `ANTHROPIC_DEFAULT_HAIKU_MODEL` suffix nélkül, `ANTHROPIC_DEFAULT_SONNET_MODEL`/`ANTHROPIC_DEFAULT_OPUS_MODEL` suffixszel

Beállítás: `model: 'MiniMax-M3[1m]'`, `ANTHROPIC_DEFAULT_SONNET_MODEL='MiniMax-M3[1m]'`, `ANTHROPIC_DEFAULT_OPUS_MODEL='MiniMax-M3[1m]'`, `ANTHROPIC_DEFAULT_HAIKU_MODEL='MiniMax-M3'` (suffix nélkül), `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` nincs beállítva. Kimenetel: HTTP 200 mindkét kérésnél, `result` subtype `success` (17 SDKMessage). Artefaktum: `tools/wire-probe/artifacts/harness/M-29/a.meta.json`, tranzakciók `00018-1787742458818.json` (thin), `00019-1787742459888.json` (full).

A kimenő body `model` mezője **mindkét kérésnél** szó szerint `"MiniMax-M3"` (a suffix egyik kérésben sem jelenik meg a body szinten, egyezik az M-11 mintával). Az `anthropic-beta` header viszont **eltér a két kérés között**: a thin kérés (`00018`) listájában **nincs** `context-1m-2025-08-07` elem, a full kérésében (`00019`) **van**.

Összevetve az M-11 (a) futásával, ahol a teljes session `model: 'MiniMax-M3[1m]'` volt, **külön haiku env override nélkül**: ott mind a thin (`00006-1787706958183.json`), mind a full (`00007-1787706958835.json`) kérés `anthropic-beta` listája tartalmazta a `context-1m-2025-08-07` elemet, saját ellenőrzéssel megerősítve. Az M-29 és az M-11 (a) közötti egyetlen tervezett eltérés az `ANTHROPIC_DEFAULT_HAIKU_MODEL` suffix nélküli beállítása.

## M-30 `API_TIMEOUT_MS` hatása

Beállítás: (a) alap. (b) `API_TIMEOUT_MS=3000000`. Kimenetel: mindkét futás HTTP 200 mindkét kérésénél, `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-30/{a-base,b-api-timeout-3000000}.meta.json`.

| Futás | tranzakció | kérés headerei közt `x-stainless-timeout` |
|---|---|---|
| a-base | `00021-1787742461622.json` (thin) | `600` |
| a-base | `00022-1787742462310.json` (full) | `600` |
| b-api-timeout-3000000 | `00024-1787742465473.json` (thin) | `3000` |
| b-api-timeout-3000000 | `00025-1787742465901.json` (full) | `3000` |

A `x-stainless-timeout` header értéke a `600` alapértékről `3000`-re változik, amikor `API_TIMEOUT_MS=3000000`. A `600` a dokumentált 600000 ms (10 perc) alapérték ezredmásodperc helyett másodpercben kifejezve, a `3000` pedig a beállított 3000000 ms másodpercben. Nem kellett megvárni a teljes időkorlátot: a hatás azonnal látszott a kimenő kérés headerében.

## M-31 `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` konkurrens subagentekkel

Beállítás: négy programozottan definiált, triviális subagent (`echo-a` .. `echo-d`, `model: 'inherit'`), `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3`, prompt, ami mind a négy subagent egyidejű indítására utasítja a modellt egyetlen üzenetben, `maxTurns: 20`, `permissionMode: 'bypassPermissions'` + `allowDangerouslySkipPermissions: true`. Kimenetel: `result` subtype `success` (192 SDKMessage). Artefaktum: `tools/wire-probe/artifacts/harness/M-31/a.meta.json`.

A futás időablakában 10 db `POST /v1/messages` tranzakció esett, sweep-line módszerrel számolt legnagyobb egyidejű darabszám: **4**. Saját ellenőrzés a tranzakciók `system` promptja és időzítése alapján (`durationMs`, `timestamp`): a `00028-1787742478371.json` tranzakció (a fő session orchestrátor kérése, `system` promptja `"You are an interactive agent that helps users with software..."`, indulás +953ms, időtartam 11113ms) átfedésben van három subagent-worker kéréssel: `00029-1787742478940.json`, `00030-1787742479080.json`, `00031-1787742479148.json` (mindhárom `system` promptja szó szerint `"Válaszolj egyetlen mondattal arra a kérdésre, amit a felhasználó feltesz..."`, ez a case-ben definiált subagent prompt), indulásuk +11292ms, +11694ms, +10940ms körül, egymással és a `00028`-cal is átfedésben (a `00028` +12066ms-ig tart). Ez pontosan 1 orchestrátor + 3 egyidejű subagent kérés = 4 összesen. Negyedik, egyidejű **subagent** kérés nem fordult elő ebben az ablakban.

Nem egyértelmű: a promptban mind a négy subagent (`echo-a` .. `echo-d`) indítását kértük, de csak 3 subagent-worker kérés futott egyidejűleg; a 00032/00033/00034/00035/00036 tranzakciók `"Async agent launched succ..."` és `"<retrieval_status>success</retrieval_status>"` tartalmú tool eredményeket hordoznak, ami arra utal, hogy a modell néhány subagentet háttérben (aszinkron) indított, nem feltétlenül mind a négyet szinkron, egyidejű HTTP kérésként. A pontos ütemezési logika ebből a mérésből nem rekonstruálható teljesen.

## M-32 A teljes felhasználói parancs env változói együtt

Beállítás: egy futás, `Options.model` nincs beállítva, env: `API_TIMEOUT_MS=3000000, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1, ANTHROPIC_MODEL=MiniMax-M3[1m], ANTHROPIC_DEFAULT_SONNET_MODEL=MiniMax-M3[1m], ANTHROPIC_DEFAULT_OPUS_MODEL=MiniMax-M3[1m], ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M3, CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000, CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50, CLAUDE_CODE_DISABLE_FAST_MODE=1, CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3`, plusz a proxyra mutató `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`. Kimenetel: HTTP 200, `result` subtype `success` (24 SDKMessage). Artefaktum: `tools/wire-probe/artifacts/harness/M-32/a.meta.json`.

Csak **1** `POST /v1/messages` ment ki (`00038-1787742498281.json`) -- a thin (cím generáló) kérés hiányzik, egyezik a `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` korábban rögzített hatásával (M-07, M-08, M-21). A kimenő body `model` mezője `"MiniMax-M3"`, annak ellenére, hogy az `Options.model` SDK mező nem volt beállítva -- a kliens tehát az `ANTHROPIC_MODEL=MiniMax-M3[1m]` env változóból oldotta fel a modellt (a suffix a body szinten itt is lekerül, egyezik M-11-gyel). A `tools` tömb hossza **24** (a `DesignSync` hiányzik, egyezik M-08/M-21-gyel). `output_config: {"effort":"high"}`, `thinking: {"type":"adaptive"}`, `cache_control` darabszám 3, `x-stainless-timeout: 3000`, az `anthropic-beta` lista tartalmazza a `context-1m-2025-08-07` elemet.

## M-33 `promptCaching.mode` -- implicit és explicit szétválasztási kísérlet

Beállítás: három futás, streaming input módban egy felhasználói üzenettel, aminek szöveg content blokkjára a harness saját, explicit `cache_control: {"type":"ephemeral"}` jelölést tesz. (a) és (b) azonos tartalom, közvetlenül egymás után, cache bekapcsolva. (c) ugyanaz `DISABLE_PROMPT_CACHING=1` mellett. Kimenetel: mind HTTP 200, mind `result` subtype `success`. Artefaktumok: `tools/wire-probe/artifacts/harness/M-33/{a-explicit-breakpoint-first,b-explicit-breakpoint-second,c-disable-prompt-caching}.meta.json`.

| Futás | full kérés tranzakció | `cache_control` darabszám és helye | `usage.cache_read_input_tokens` (full) |
|---|---|---|---|
| a-explicit-breakpoint-first | `00041-1787742511635.json` | 3: `system` 2 blokkja + a felhasználói üzenet 1 blokkja | 128 |
| b-explicit-breakpoint-second | `00044-1787742514059.json` | 3: ugyanaz a minta | 128 |
| c-disable-prompt-caching | `00047-1787742517068.json` | **1**: kizárólag a felhasználói üzenet blokkja, a `system` mindhárom blokkja `cache_control` nélkül | 128 |

Saját ellenőrzés a `messages[].content[]` tömbön mindhárom full kérésben: a felhasználó által (a harness kódjában) explicit módon rárakott `cache_control` blokk **mindhárom futásban jelen van**, a (c) futásban is, annak ellenére, hogy a `DISABLE_PROMPT_CACHING=1` env változó a `system` szekció mindkét (a-ban és b-ben meglévő) `cache_control` blokkját eltávolította. A `tools` tömbben egyik futásban sincs `cache_control` blokk.

A thin kérésekben (`00040`, `00043`, `00046`) a `cache_control` darabszám mindhárom futásban 0. A `usage.cache_read_input_tokens` mező a thin kérésekben: (a) `128`, (b) nincs jelen a mezők közt (a `usage` objektum ekkor `input_tokens`, `output_tokens`, `service_tier` mezőket tartalmazott csak), (c) `4736`.

Nem egyértelmű: a (c) futás thin kérésének `cache_read_input_tokens:4736` értéke jelentősen magasabb, mint az (a)/(b) futásoké; ennek oka ebből a mérésből nem állapítható meg (lehet a session-en kívüli, korábbi mérésekből származó implicit cache találat, mert a thin kérés system promptja rögzített, ismétlődő szöveg minden mérési esetben).

## M-34 `toolChoice.rejectionBehaviour` közvetlen HTTP hívással

Beállítás: két közvetlen HTTP hívás (Node natív `fetch`, a proxyn keresztül), `model: 'MiniMax-M3'`, `max_tokens: 16`, egy `noop` nevű, üres sémájú tool. (a) `tool_choice: {"type":"any"}`. (b) `tool_choice: {"type":"tool","name":"noop"}`. Kimenetel: mindkét kérés HTTP 200. Artefaktumok: `tools/wire-probe/artifacts/harness/M-34/{a-tool-choice-any,b-tool-choice-tool}.json`.

A válasz mindkét esetben `type:"message"`, `stop_reason:"end_turn"`, és **szöveges** `content` tömböt tartalmaz, `tool_use` blokk egyikben sincs. (a) válasza szó szerint `"Asztal."`, (b) válasza szó szerint `"Alma"`. A `usage` mindkét válaszban `input_tokens:266, cache_read_input_tokens:128`. Nincs `error` mező, nincs `base_resp.status_code` eltérés a szokásos `0`-tól.

## M-35 `listedByModelsEndpoint` közvetlen HTTP hívással

Beállítás: egy közvetlen `GET /v1/models` HTTP hívás (Node natív `fetch`, a proxyn keresztül) a MiniMax végpontra. Kimenetel: HTTP 200. Artefaktum: `tools/wire-probe/artifacts/harness/M-35/a-get-models.json`.

A válasz `data` tömbje 8 elemű, minden elem `id`, `type:"model"`, `display_name`, `created_at` mezőkkel, a válasz `has_more: false`. A `data[0].id` mezője szó szerint `"MiniMax-M3"`. A CLAUDE.md szerint a MiniMax családból kizárólag a `MiniMax-M3` nevezhető meg dokumentumban -- a maradék 7 elem a hatókörön kívüli MiniMax családtagokat sorolja fel (ezek konkrét azonosítóit ez a jegyzőkönyv nem ismétli meg), köztük "-highspeed" végződésű variánsokat is.

## M-36 Rate limit header leltár (M-26 - M-35 kör, passzív)

Nincs önálló futás. Az M-26 - M-35 kör teljes 50 tranzakciójából (ugyanaz a proxy processz, `seq` 1-50):

- Útvonal eloszlás: `POST /anthropic/v1/messages`: 36, `HEAD /anthropic/api/hello`: 13, `GET /anthropic/v1/models`: 1 (ez az M-35 saját hívása).
- Státuszkód eloszlás: `200`: 37, `404`: 13 (mind a `HEAD /api/hello` hívások). Nincs `429`, nincs egyéb `4xx`, nincs `5xx`.
- Válasz header névunió: `access-control-allow-origin, alb_receive_time, alb_request_id, cache-control, connection, content-length, content-type, date, expires, minimax-request-id, pragma, set-cookie, trace-id, transfer-encoding, vary, x-from, x-mm-request-id, x-session-id`. A `set-cookie` új elem az M-18 korábbi header-uniójához képest (ott nem szerepelt).
- `retry-after` vagy `ratelimit`/`rate-limit` alstringet tartalmazó header: **nincs egyetlen tranzakcióban sem**, ugyanaz az eredmény, mint M-18-nál.

Mivel ebben a körben sem keletkezett `429`, a `retry-after` és `ratelimit`-jellegű headerek megléte továbbra sem állapítható meg.

## `videoInput` -- típusrendszer alapú vizsgálat, mérési eset nélkül

Saját ellenőrzés a telepített csomagokon: `tools/wire-probe/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` a `SDKUserMessage.message` mezőt az `@anthropic-ai/sdk` `MessageParam` típusán keresztül tipizálja (import `from '@anthropic-ai/sdk/resources'`). A `tools/wire-probe/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` fájlban a `ContentBlockParam` unió (1750. sor) szó szerint `TextBlockParam | ImageBlockParam | DocumentBlockParam | SearchResultBlockParam | ThinkingBlockParam | RedactedThinkingBlockParam | ToolUseBlockParam | ToolResultBlockParam | ServerToolUseBlockParam | WebSearchToolResultBlockParam | WebFetchToolResultBlockParam | CodeExecutionToolResultBlockParam | BashCodeExecutionToolResultBlockParam | TextEditorCodeExecutionToolResultBlockParam | ToolSearchToolResultBlockParam | ContainerUploadBlockParam` -- nincs benne `video` variáns. Az `ImageBlockParam.source` (`Base64ImageSource`, 95. sor) `media_type` mezője szó szerint `'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'` zárt unió, videó MIME típus nem írható bele típusbiztosan.

Mivel a projekt szabályai tiltják az `any` és `as` használatát, ebből a típusfelületből típusbiztos módon nem állítható elő videó content blokkot hordozó streaming input üzenet. Nem futott mérési eset, a mező blokkolója a telepített SDK típusfelülete, nem a MiniMax szolgáltatás.

## Záró ellenőrzések (M-26 - M-36)

- `grep -rl "$(grep -oP '(?<=MINIMAX_API_KEY=).*' .env)" tools/wire-probe/artifacts/ docs/` (repo gyökérből futtatva): **0 találat.**
- `bun run typecheck`: hibátlan a tizenegy új case fájl (`M-26.ts` .. `M-36.ts`) és a `cases/index.ts` regisztráció felvétele után is.
- A jelen szakasz szövege nem tartalmazza a hatókörön kívüli MiniMax modellazonosítókat (M-35), a CLAUDE.md előírása szerint.
