# Claude Agent SDK + MiniMax kutatás, 2026-08-26

Ez a fájl a SPEC-000 bemenete. Két része van: **megerősített tények** (hivatalos doksi
vagy OpenAPI séma) és **nyitott kérdések**, amiket drótszintű méréssel kell eldönteni.
A nyitott kérdéseket TILOS tippeléssel lezárni.

---

## 1. Agent SDK, megerősített tények

Csomag: `@anthropic-ai/claude-agent-sdk@0.3.245`, ESM, `engines.node >=18`,
peer: `zod ^4.0.0`, `@anthropic-ai/sdk >=0.93.0`, `@modelcontextprotocol/sdk ^1.29.0`.
Platform-specifikus natív bináris optional dependencyként (linux-x64, linux-arm64,
linux-x64-musl, linux-arm64-musl, darwin-x64, darwin-arm64, win32-x64, win32-arm64).

### `query()`

```ts
function query(args: { prompt: string | AsyncIterable<SDKUserMessage>; options?: Options }): Query;
```

`Query` = `AsyncGenerator<SDKMessage, void>` + metódusok: `interrupt`, `setPermissionMode`,
`setModel`, `setMaxThinkingTokens`, `initializationResult`, `supportedCommands`,
`supportedModels`, `supportedAgents`, `mcpServerStatus`, `getContextUsage`, `readFile`,
`reconnectMcpServer`, `toggleMcpServer`, `setMcpServers`, `streamInput`, `stopTask`,
`rewindFiles`, `close`.

### `Options` fontosabb mezői

| Mező                                             | Leírás                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `systemPrompt`                                   | `string` vagy `{ type:'preset', preset:'claude_code', append?, excludeDynamicSections? }` |
| `allowedTools` / `disallowedTools`               | tool allow/deny, szkópolt szabályokkal (`"Bash(rm *)"`)                                   |
| `permissionMode`                                 | `default` / `acceptEdits` / `plan` / `dontAsk` / `auto` / a mindent-engedő mód            |
| `canUseTool`                                     | permission callback, **csak akkor hívódik, ha a permission flow promptig jut**            |
| `mcpServers`                                     | `Record<string, McpServerConfig>`: stdio / sse / http / sdk                               |
| `hooks`                                          | `Partial<Record<HookEvent, HookCallbackMatcher[]>>`                                       |
| `agents`                                         | `Record<string, AgentDefinition>`, programozott subagentek                                |
| `settingSources`                                 | `('user'\|'project'\|'local')[]`                                                          |
| `skills`                                         | `string[] \| 'all'`, fájlrendszerből töltődnek (`SKILL.md`)                               |
| `maxTurns`, `maxBudgetUsd`                       | limitek                                                                                   |
| `model`, `fallbackModel`, `effort`, `thinking`   | modell és reasoning                                                                       |
| `cwd`, `env`, `additionalDirectories`            | futtatási környezet                                                                       |
| `resume`, `forkSession`, `continue`, `sessionId` | session kezelés                                                                           |
| `includePartialMessages`, `includeHookEvents`    | streaming és observability                                                                |
| `outputFormat`                                   | `{ type:'json_schema', schema }`                                                          |
| `sandbox`                                        | OS szintű sandbox, lásd lent                                                              |
| `persistSession`, `sessionStore`                 | perzisztencia                                                                             |
| `maxThinkingTokens`                              | **deprecated**, `thinking` váltja ki                                                      |

### `SDKMessage` union (real-time UI-hoz)

- `system` (`subtype: 'init'` hozza a `session_id`, `tools`, `mcp_servers`, `slash_commands`,
  `skills` listát; további subtype-ok: compact boundary, informational)
- `assistant`, `user`
- `stream_event` (`SDKPartialAssistantMessage`), csak `includePartialMessages: true` esetén.
  Mezői: `{ type:'stream_event', event: RawMessageStreamEvent, parent_tool_use_id, uuid, session_id }`
- `result` (`subtype`: `success`, `error_max_turns`, `error_max_budget_usd`,
  `error_during_execution`, `error_max_structured_output_retries`)
- observability: `SDKHookStartedMessage` / `SDKHookProgressMessage` / `SDKHookResponseMessage`
  (`includeHookEvents: true`), `SDKInformationalMessage`, `SDKCommandsChangedMessage`,
  `SDKRateLimitEvent`, `SDKContextUsage`

### Az `SDKMessage` ágak drótalakja és a normalizáláshoz használt mezők

A fenti felsorolás az SDK **típusneveit** adja. A `run_event` tábla normalizálásához
(SPEC-003 6.2 és 6.4 szekció) a `type` és a `subtype` mező tényleges **értéke** kell, ezt a
pinelt csomag saját típusdefiníciója rögzíti szó szerint. Forrás:
https://unpkg.com/@anthropic-ai/claude-agent-sdk@0.3.245/sdk.d.ts (8347 sor; a
`tools/wire-probe/node_modules` alá telepített példány ezzel bájtra egyező).

| SDK típus                    | `type`             | `subtype`                                                                                                  |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| `SDKSystemMessage`           | `system`           | `init`                                                                                                     |
| `SDKAssistantMessage`        | `assistant`        | nincs                                                                                                      |
| `SDKUserMessage`             | `user`             | nincs                                                                                                      |
| `SDKPartialAssistantMessage` | `stream_event`     | nincs                                                                                                      |
| `SDKResultSuccess`           | `result`           | `success`                                                                                                  |
| `SDKResultError`             | `result`           | `error_during_execution`, `error_max_turns`, `error_max_budget_usd`, `error_max_structured_output_retries` |
| `SDKHookStartedMessage`      | `system`           | `hook_started`                                                                                             |
| `SDKHookProgressMessage`     | `system`           | `hook_progress`                                                                                            |
| `SDKHookResponseMessage`     | `system`           | `hook_response`                                                                                            |
| `SDKInformationalMessage`    | `system`           | `informational`                                                                                            |
| `SDKCommandsChangedMessage`  | `system`           | `commands_changed`                                                                                         |
| `SDKRateLimitEvent`          | `rate_limit_event` | nincs                                                                                                      |

Két pontosítás a fenti, típusnév szerinti felsoroláshoz képest:

1. **Az öt observability üzenet `type` mezője `system`**, nem saját top-level típus; kizárólag a
   `subtype` különbözteti meg őket a `system` `init` üzenettől. Egyedül az `SDKRateLimitEvent`
   visel saját top-level `type` értéket (`rate_limit_event`).
2. **Az `SDKContextUsage` nem `SDKMessage` ág.** A 0.3.245 `SDKMessage` uniójában nem szerepel; a
   típus az `SDKAssistantMessage.context_usage` opcionális mezőjének az alakja. `context_usage`
   értékű `type` vagy `subtype` a csomagban nem létezik (a `get_context_usage` egy control request
   subtype, nem SDKMessage). Ezért erre a `SPEC-003` 6.4 listájában szereplő `sdk_context_usage`
   `kind` értékre ebben az SDK verzióban nincs leképezés.

A normalizálás által olvasott mezők, ugyanebből a forrásból:

- `session_id: string` és `uuid: UUID` mind a fenti ágon; az `SDKUserMessage`-en mindkettő
  **opcionális** (`uuid?`, `session_id?`).
- `parent_tool_use_id: string | null` az `assistant`, a `user` és a `stream_event` ágon.
- `num_turns: number` és `total_cost_usd: number` a `result` ágon.
- `usage`: a `result` ágon top-level mező (`NonNullableUsage`), az `assistant` ágon a beágyazott
  Anthropic `Message` objektumon (`message.usage`, `BetaMessage`).

Az asszisztens üzenet `message.content` **tömb**, elemei `type` diszkriminátorú content blokkok, és
a `tool_use` blokk `id`, `name` és `input` mezőt hordoz. Elsődleges forrás:
https://unpkg.com/@anthropic-ai/sdk@0.120.0/resources/beta/messages/messages.d.ts
(`BetaToolUseBlock`, `BetaMessage.content: Array<BetaContentBlock>`, `BetaMessage.usage: BetaUsage`).
Megerősítés: https://docs.claude.com/en/docs/agents-and-tools/tool-use/handle-tool-calls
("`id`: A unique identifier for this particular tool use block", `name`, `input`) és
https://docs.claude.com/en/docs/build-with-claude/streaming
(`{"type":"tool_use","id":"toolu_01T1x1fJ34qAmk2tNTrN7Up6","name":"get_weather","input":{}}`).

A négy `usage` mezőnév (`input_tokens`, `output_tokens`, `cache_read_input_tokens`,
`cache_creation_input_tokens`) ugyanebben a `BetaUsage` definícióban áll, megerősítve a
https://docs.claude.com/en/docs/build-with-claude/prompt-caching oldal "Tracking cache performance"
JSON példájával és a fenti streaming oldal `message_start` eseményével.

### Session kezelés

- `continue: true` legutóbbi session folytatása
- `resume: sessionId` konkrét session folytatása
- `resume: sessionId, forkSession: true` másolatból új session, az eredeti érintetlen
- `sessionId` kézzel megadható UUID
- Segédfüggvények: `listSessions`, `getSessionMessages`, `getSessionInfo`, `renameSession`, `tagSession`
- Fájlok: `~/.claude/projects/<encoded-cwd>/*.jsonl`, `$CLAUDE_CONFIG_DIR` felülírja
- `persistSession: false` kikapcsolja a lemezre írást

### Hookok

Események (TypeScript SDK): `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`,
`UserPromptSubmit`, `UserPromptExpansion`, `MessageDisplay`, `Stop`, `StopFailure`,
`SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`, `PermissionRequest`,
`PermissionDenied`, `SessionStart`, `SessionEnd`, `Notification`, `Setup`, `TeammateIdle`,
`TaskCreated`, `TaskCompleted`, `Elicitation`, `ElicitationResult`, `ConfigChange`,
`InstructionsLoaded`, `WorktreeCreate`, `WorktreeRemove`, `CwdChanged`, `FileChanged`,
`DirectoryAdded`.

Callback: `(input, toolUseId, { signal }) => HookJSONOutput`. Döntés a `hookSpecificOutput`
mezőn keresztül (`permissionDecision`, `updatedInput`, `additionalContext`), illetve a
közös `decision` / `reason` / `continue` mezőkkel.

**A `Stop` hook `decision: "block"` + `reason` kombinációval visszaküldi az agentet dolgozni.**
A `stop_hook_active` input mező jelzi, ha már egy blokkolás miatt fut, ezzel védhető a loop.
Ez a mechanizmus a projektben a kötelező `emit_output` tool kikényszerítésére szolgál.

### In-process MCP tool

```ts
const t = tool('name', 'desc', { arg: z.string() }, async ({ arg }) => ({
  content: [{ type: 'text', text: '...' }],
}));
const server = createSdkMcpServer({ name: 'my-tools', tools: [t] });
// options: { mcpServers: { "my-tools": server }, allowedTools: ["mcp__my-tools__name"] }
```

Tool név minta: `mcp__<szerver>__<tool>`, wildcard: `"mcp__github__*"`.
Az MCP kliens oldalon csatlakozik, **nem** a Messages API `mcp_servers` mezőjén keresztül,
ezért a MiniMax `mcp_servers` eldobása minket nem érint.

### Skillek

Kizárólag fájlrendszerből (`SKILL.md`): `~/.claude/skills/`, `<cwd>/.claude/skills/` és
szülő könyvtárak, plusz `additionalDirectories`. Nincs programozott regisztrációs API.
Ha a `settingSources` explicit be van állítva, `'project'` és `'user'` kell bele, különben
a skillek nem töltődnek be. A `skills` opció szűri, melyiket hívhatja a modell.

### `sandbox`

OS szintű sandbox a Bash parancsokhoz. macOS: Seatbelt (`sandbox-exec`).
Linux/WSL2: bubblewrap + network namespace, `socat` proxy.
Mezők: `enabled`, `failIfUnavailable`, `autoAllowBashIfSandboxed`, `excludedCommands`,
`allowUnsandboxedCommands`, `network`, `filesystem`, `ignoreViolations`,
`enableWeakerNestedSandbox`, `ripgrep`.

---

## 2. MiniMax Anthropic-kompatibilis endpoint, megerősített tények

Base URL: `https://api.minimax.io/anthropic` (nemzetközi) /
`https://api.minimaxi.com/anthropic` (Kína). A két régió külön fiók és külön kulcs,
kereszthasználatnál 401.
Auth: `Authorization: Bearer <kulcs>` (elsőbbség) vagy `x-api-key: <kulcs>`.
Nincs GroupId paraméter ezen az endpointon.

### Modellek

| Modell       | Kontextus | Max output                    | Kép/videó | Thinking                |
| ------------ | --------- | ----------------------------- | --------- | ----------------------- |
| `MiniMax-M3` | 1 000 000 | ajánlott 131 072, max 524 288 | igen      | opcionális (`adaptive`) |

`[1m]` suffix (`MiniMax-M3[1m]`): **nem MiniMax paraméter**, a Claude Code kliens saját
konvenciója. Hogy a kliens leválasztja-e a kérés előtt: nyitott kérdés, lásd Q9.

Rate limit: 200 RPM / 10M TPM.

### `thinking` (OpenAPI séma, szó szerint)

```yaml
thinking:
  type: object
  properties:
    type: { type: string, enum: [disabled, adaptive], default: disabled }
```

- **Nincs `enabled`, nincs `budget_tokens`.**
- M3: alapból ki, `adaptive` kapcsolja be.
- Stream: `content_block_start` `{type:"thinking"}` blokkal, `thinking_delta` deltákkal,
  záró `signature_delta`, majd `content_block_stop`.
- Nincs `redacted_thinking`.
- M3-nál interleaved thinking: a thinking blokkokat a `signature`-rel együtt vissza kell
  adni a következő körben, különben megszakad a reasoning lánc.

### Paraméter támogatás

| Paraméter                                                                                 | Státusz                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `model`, `messages`, `system`, `stream`, `tools`, `metadata`, `thinking`, `cache_control` | támogatott                                                         |
| `temperature`                                                                             | támogatott, tartomány **[0, 2]**, default 1                        |
| `top_p`                                                                                   | támogatott, [0, 1], default 0.95                                   |
| `service_tier`                                                                            | `standard` (default) / `priority` (1.5x ár)                        |
| `tool_choice`                                                                             | **CSAK `auto` és `none`.** Nincs `any`, nincs `{type:"tool",name}` |
| `top_k`, `stop_sequences`, `mcp_servers`, `context_management`, `container`               | csendben eldobva                                                   |
| `output_format` / `json_schema`                                                           | **nem létezik a sémában**                                          |

### Strukturált kimenet: nincs

- Anthropic-kompatibilis endpoint: nincs `output_format`.
- OpenAI-kompatibilis `chatcompletion_v2`: van `response_format`, de csak
  `MiniMax-Text-01` támogatja. M3 csendben eldobja.
  https://github.com/MiniMax-AI/MiniMax-M2.5/issues/4
- OpenAI Responses `/v1/responses`: `text.format.type` enum csak `[text]`.
- A szokásos kerülőút (kényszerített `tool_choice`) **nem járható**, mert csak `auto`/`none`.

### Prompt caching

Két rendszer: automatikus/passzív és explicit `cache_control`
(`{"type":"ephemeral"}`). Explicit cache TTL 5 perc,
találatnál megújul, max 4 breakpoint kérésenként, 20 blokkos lookback, minimum 512 input token.
Hierarchia: `tools` → `system` → `messages`.
`usage` mezők: `cache_creation_input_tokens`, `cache_read_input_tokens`.
**M3-nál az automatikus/passzív cache a dokumentált út, az explicit `cache_control` M3-on nem
megerősített.**

### Hibaformátum

Anthropic-kompatibilis: `{"type":"error","request_id":"req_...","error":{"type":...,"message":...}}`
400 `invalid_request_error`, 401 `authentication_error`, 403 `permission_error`,
404 `not_found_error`, 413 `request_too_large`, 429 `rate_limit_error`,
500 `api_error`, 529 `overloaded_error`.
A natív (nem Anthropic) végpontokon ehelyett `base_resp.status_code` jön
(1000 unknown, 1002 rate limit, 1004 not authorized, 1008 insufficient balance,
1013 internal, 1027 output sensitive, 2013 invalid params, 2049 invalid API key,
2056 usage limit, 5 órás gördülő ablak).
`Retry-After` header: nincs dokumentálva.

### Szerver oldali tool

Béta `web_search` (`{"type":"web_search_20250305","name":"web_search"}`), 0,01 USD/kérés,
csak az Anthropic Messages endpointon.

---

## 3. Nem-Anthropic endpoint, megerősített tények

Kulcs doksi: https://code.claude.com/docs/en/llm-gateway-protocol

- A Claude Code `POST /v1/messages?beta=true`, `POST /v1/messages/count_tokens`,
  `GET /v1/models`, `HEAD /api/hello` végpontokat hívja.
- Továbbítandó headerek: `anthropic-version`, `anthropic-beta`.
- Alapelv: a beta képességek header + body mező **párban** utaznak. Ha az egyik fele
  hiányzik, kemény 400 lesz belőle.
- A body mezők listája **nyílt és verziónként bővül**. Ezért az SDK verziót pinelni kell,
  és minden frissítés előtt regressziót futtatni.
- Retry viselkedés: a `thinking` mező, a thinking signature és a beszélgetés közbeni
  system message elutasítását a Claude Code automatikus retryval kezeli, **de a retry a
  hibaszövegre illeszt**. A `context_management` és a tool séma elutasítása **nem** retry-zik.
- Nem-first-party base URL esetén automatikusan kikapcsol: fine-grained tool streaming;
  a tool search eager loadingra esik vissza.

### Releváns env változók

| Változó                                                                            | Hatás                                                     |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `ANTHROPIC_BASE_URL`                                                               | endpoint felülírás                                        |
| `ANTHROPIC_AUTH_TOKEN`                                                             | `Authorization: Bearer` érték                             |
| `ANTHROPIC_API_KEY`                                                                | `x-api-key` érték                                         |
| `ANTHROPIC_MODEL`                                                                  | session induló modell                                     |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` / `_OPUS_MODEL` / `_HAIKU_MODEL` / `_FABLE_MODEL` | alias feloldás                                            |
| `ANTHROPIC_SMALL_FAST_MODEL`                                                       | **deprecated**, helyette `ANTHROPIC_DEFAULT_HAIKU_MODEL`  |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`                                         | leveszi a pre-release képességeket és body mezőiket       |
| `ENABLE_TOOL_SEARCH`                                                               | `false` / `true` / `auto:N`                               |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING=1`                                 | **kerülendő** custom base URL mellett                     |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1`                                          | **kerülendő**, fix budget alakot kényszerít               |
| `API_TIMEOUT_MS`                                                                   | API timeout, default 10 perc                              |
| `MAX_THINKING_TOKENS`                                                              | `0` = thinking ki                                         |
| `DISABLE_PROMPT_CACHING=1`                                                         | prompt cache ki                                           |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW`                                                  | auto-compact ablak, csak csökkenteni tud                  |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`                                       | telemetria, error reporting, feature flag, auto-update ki |

### Ismert MiniMax + Claude Code problémák (nem hivatalos, GitHub issue)

- `output_config` (`effort` + `json_schema` format) háttérkérésekben dokumentáltan 400-at dob,
  de a saját M3 mérésünk szerint ez M3 ellen nem reprodukálódott (mind a 79 mért kérés HTTP 200):
  https://github.com/MiniMax-AI/MiniMax-M2.5/issues/28
- `"invalid message role: system (2013)"` hiba beszélgetés közbeni system message-nél
  dokumentált, de a saját M3 mérésünk szerint ez M3 ellen nem hibázik (HTTP 200):
  https://github.com/MiniMax-AI/MiniMax-M2.7/issues/43
- Az `/anthropic` endpoint 200K contextet jelent 1M helyett, ezért túl korai compaction:
  https://github.com/MiniMax-AI/MiniMax-M2.7/issues/46
- Tool-láncban a modell nem adja tovább megbízhatóan az előző tool kimenetét:
  https://github.com/MiniMax-AI/MiniMax-M3/issues/19
- Végtelen retry loop timeoutnál:
  https://github.com/MiniMax-AI/MiniMax-M2.7/issues/44

---

## 4. Nyitott kérdések, kizárólag méréssel eldönthetők

Ezek a SPEC-000 mérési eseteinek forrása. Egyik sem zárható le tippeléssel.

| #   | Kérdés                                                                                                                        | Miért számít                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Q1  | Az `outputFormat` kliens oldali szintetikus `StructuredOutput` toolt injektál, vagy natív `output_config.format` mezőt küld?  | Ha natív, MiniMax ellen 400                           |
| Q2  | Használ-e az `outputFormat` záró fázisában kényszerített `tool_choice`-t?                                                     | MiniMax csak `auto`/`none`-t fogad                    |
| Q3  | Kimegy-e `output_config` akkor is, ha nem állítunk `effort`-ot?                                                               | Ez dönti el, használható-e a MiniMax egyáltalán       |
| Q4  | Milyen JSON-t küld az SDK `thinking: {type:'adaptive'}` és `{type:'disabled'}` esetén?                                        | A MiniMax enum szűk                                   |
| Q5  | Az SDK indít-e háttér modellhívást (session cím), és az mit küld?                                                             | Dokumentált 400 forrás                                |
| Q6  | Melyik env kapcsoló mit vesz le ténylegesen a bodyból?                                                                        | A provider env blokk tartalma ebből áll össze         |
| Q7  | Küld-e a MiniMax `input_json_delta`-t a tool argumentumokhoz, és ha nem, az SDK helyesen rakja-e össze a tool inputot?        | A real-time UI és a tool hívás helyessége múlik rajta |
| Q8  | A `Stop` hook `decision: "block"` mechanizmus működik-e MiniMax ellen, és mennyi kör kell a kötelező tool kikényszerítéséhez? | Ez az alapértelmezett strukturált kimenet utunk       |
| Q9  | A `[1m]` suffixet a kliens leválasztja-e a modellnévről a kérés előtt?                                                        | Rossz modellnév = 404                                 |
| Q10 | Mit ad vissza a `GET /v1/models` a MiniMax endpointon?                                                                        | A Kapcsolat teszt gomb ebből tölti a modell-listát    |
| Q11 | Mekkora kontextusablakot jelent az endpoint, és mikor indul auto-compact?                                                     | Korai compaction elrontja a hosszú workflow-kat       |
| Q12 | Küld-e az SDK `anthropic-beta` headert, és melyeket?                                                                          | Header és body párban utazik, fél pár = 400           |
