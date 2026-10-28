# A SPEC-000 mérések megismétlése a MiniMax-M3.1-Flash modellel

|              |                                                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dátum        | 2026-10-28                                                                                                                                                                  |
| Bemenet      | [`../spec/SPEC-013-flash-es-haiku.md`](../spec/SPEC-013-flash-es-haiku.md) O-2 és O-7, [`2026-10-27-flash-es-haiku.md`](2026-10-27-flash-es-haiku.md) 9. szekció            |
| Mérő eszköz  | `tools/wire-probe` (proxy plusz harness), a pinelt `@anthropic-ai/claude-agent-sdk` (a beágyazott Claude Code verziója a `meta.json` és az `init` üzenet szerint `2.1.245`) |
| Valódi hívás | igen, a `minimax` provider ellen (`https://api.minimax.io/anthropic`), a Claude provider ellen semmi                                                                        |
| Kimenet      | a `packages/provider-minimax` leíró mezői, a SPEC-013 O-7 lezárása                                                                                                          |

A mérések nyers artefaktumai (`tools/wire-probe/artifacts/`) a `.gitignore` szerint nem kerülnek gitbe; ez
a fájl a megfigyeléseket és a belőlük levont leíró értékeket rögzíti. A mérési azonosítók a leíróban
`M-xx-flash` alakban állnak (a SPEC-000 eredeti eset száma plusz `-flash`), a horgonyuk ennek a fájlnak a 3.
szekciója.

---

## 1. Engedély és korlát

- **A user engedélye (2026-10-28):** "A MiniMax élő nézet delta eseményeihez (és a többi Flash adathoz)
  újra kell futtatni a MiniMax méréseket Flash-sel, kis valódi hívásokkal (egy kör, rövid prompt, alacsony
  effort). Futhatnak?" Válasz: "Igen, futhatnak".
- **A user korábbi korlátja:** "ugy hajtsd meg a minimax api-t hogy nincs vegtelen tokenem!". Ezért minden
  eset egyszer futott, a közös alapbeállítás `effort: 'low'` (a harness `buildBaseOptions` függvénye), a
  prompt a SPEC-000 rövid alapkérdése, és a nagy token igényű esetek nem futottak (5. szekció).
- **Második engedély (2026-10-28):** a `toolChoice.accepted` lezárására egy `any` és egy `none` eset ("Igen,
  futhatnak", alacsony tokennel); eredménye a 3. szekció M-34-flash pontjában.
- **Újrapróbálkozás** csak egyértelmű saját hibánál történt (3. szekció M-01 és M-34).

---

## 2. Mérési terv

A futtatott esetek a leíró azon mezőit célozzák, amiket a motor olvas (`streaming.sse`, `serverTools`,
`toolChoice`, `structuredOutput`, `modelsEndpoint.calledBySdk`), plusz a kis költségű, egy hívásos eseteket.

| Eset  | Fut? | Mit zár le                                                                                       | Indok, ha nem fut                                                                              |
| ----- | ---- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| M-01  | igen | `thinking.wireShape`, `outputConfig*`, `anthropicBetaHeaders` (suffix nélkül)                    |                                                                                                |
| M-02  | nem  |                                                                                                  | az M-03 első kérése ugyanazt mutatja, egy hívás megtakarítva                                   |
| M-03  | igen | `structuredOutput.strategies[0]`, `toolChoice.sdkSendsForcedChoice`, `thinking.streamEventTypes` |                                                                                                |
| M-04  | nem  |                                                                                                  | a `max` effort a legdrágább kimenetet adja; az `effort` drótalakját az M-01 és az M-26 mutatja |
| M-05  | igen | `streaming.sse`, `thinking.wireShape`, `thinking.sendsBudgetTokens`                              |                                                                                                |
| M-06  | igen | `thinking.sendsBudgetTokens`                                                                     |                                                                                                |
| M-09  | igen | `streaming.sse`, `streaming.toolInputDelta`, `streaming.sdkReassemblesToolInput`                 |                                                                                                |
| M-11  | igen | `clientModelIdentifier` (a suffix levágása a dróton), `anthropicBetaHeaders`                     |                                                                                                |
| M-12  | igen | `modelsEndpoint.calledBySdk`                                                                     |                                                                                                |
| M-17  | igen | `serverTools`, `toolChoice.sdkSendsForcedChoice`                                                 |                                                                                                |
| M-23  | igen | `models[0].imageInput`                                                                           |                                                                                                |
| M-26  | igen | `structuredOutput.outputConfigAlwaysSent` (effort nélkül), a kliens alap effortja                |                                                                                                |
| M-34  | igen | `toolChoice.rejectionBehaviour`, `toolChoice.accepted` (második kör)                             |                                                                                                |
| M-35  | igen | `modelsEndpoint.directHttpReachable`, `listedModelCount`, `models[0].listedByModelsEndpoint`     |                                                                                                |
| M-36  | igen | passzív leltár a kör artefaktumain (`calledBySdk`, rate limit headerek)                          |                                                                                                |
| többi | nem  |                                                                                                  | 5. szekció, becsült token igénnyel                                                             |

---

## 3. Eredmények esetenként

A token számok a válasz `usage` mezőjéből, kérésenként összeadva valók. A fő (`full`) kérés bemenete a
`claude_code` preset rendszerprompt és a 25 beépített eszköz miatt kérésenként körülbelül 74 000 token; ugyanazon
az előtagon belül a második kérés bemenete túlnyomórészt `cache_read_input_tokens` lett.

### M-01-flash Alap body és header leltár

- **Első kísérlet, saját hiba:** a háttérben indított proxy a bash hívás végén leállt, a CLI a
  `127.0.0.1:8787` címet nem érte el (`api_retry`, `error_status: null`), upstream kérés nem ment ki. A proxy
  azóta ugyanabban a hívásban indul és áll le, mint a mérés. A második futás:
- A fő kérés kulcsai: `context_management`, `max_tokens`, `messages`, `metadata`, `model`, `output_config`,
  `stream`, `system`, `thinking`, `tools`; `model: "MiniMax-M3.1-Flash"`, `thinking: {"type":"adaptive"}`,
  `output_config: {"effort":"low"}`, `stream: true`, nincs `tool_choice`. HTTP 200.
- `anthropic-beta`: `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `thinking-token-count-2026-05-13`,
  `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05`, `mid-conversation-system-2026-04-07`,
  `effort-2025-11-24`.
- A háttér (cím generáló) kérés: nincs `thinking` mező, `output_config: {"effort":"high","format":{"type":"json_schema",...}}`
  és a header listában `structured-outputs-2025-12-15` is. A streamje `thinking` blokkot ad:
  `content_block_start` (`thinking`), `thinking_delta`, `signature_delta`, `content_block_stop`.

### M-03-flash `tool_choice` az `outputFormat` záró fázisában

- Három kérés (háttér, eszköz hívás, `StructuredOutput` hívás), mindegyik HTTP 200; egyikben sincs `tool_choice`.
- A fő kérések eszköz listájában `StructuredOutput` áll; a modell előbb a `mcp__measure__echo`, majd a
  `StructuredOutput` eszközt hívta. A `result` `subtype: success`, `num_turns: 3`, kitöltött
  `structured_output` (`{"label":"teszt","count":4}`).
- A harmadik kérés streamje a fő kérésben is `thinking` blokkot adott (`thinking_delta`, `signature_delta`).

### M-05-flash `thinking` bekapcsolva

- `Options.thinking: {type:'adaptive'}`: a kimenő mező `{"type":"adaptive"}`, `budget_tokens` kulcs nélkül, HTTP 200.
- `effort: 'low'` mellett a válasz `thinking` blokk nélküli (egyetlen `text` blokk); a thinking esemény típusokat
  az M-01 háttér kérése és az M-03 fő kérése mutatja.
- Az SDK a részleges üzeneteket `stream_event` alakban adja tovább (`message_start`, `content_block_start`,
  `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`).

### M-06-flash `thinking` kikapcsolva

- (a) `Options.thinking: {type:'disabled'}` és (b) `MAX_THINKING_TOKENS=0`: a fő kérésből **mindkét esetben
  hiányzik a `thinking` mező**, `budget_tokens` sincs; HTTP 200, a válasz `4`.
- Következmény: a dokumentált `400` (`thinking: disabled`, research `2026-10-27-flash-es-haiku.md` 2. szekció)
  ezen az úton nem áll elő, mert a kliens a mezőt nem küldi. A leíró `byModelFamily` értéke (`['adaptive']`) a
  dokumentációra épül, nem változik; a motor `disabled` elutasítása ettől konzervatív (6. szekció 1. kérdés).

### M-09-flash Tool argumentum streaming

- A `tool_use` blokk `content_block_start` eseményében az `input` üres objektum, utána 38 `input_json_delta`.
- A `partial_json` darabok összefűzése, az `assistant` üzenet `tool_use.input` mezője és a tool callback által
  ténylegesen kapott argumentum bájtra egyezik.
- A `result` `subtype: success`.

### M-11-flash `[1m]` suffix kezelése

- (a) `model: 'MiniMax-M3.1-Flash[1m]'`: a dróton `model: "MiniMax-M3.1-Flash"`, suffix nélkül; a header lista az
  M-01 listája plusz `context-1m-2025-08-07` (a `claude-code-20250219` után). HTTP 200.
- (b) suffix nélkül: a header listában nincs `context-1m-2025-08-07`, a body ugyanaz.

### M-12-flash Nem-Messages végpontok

- Az indulás alatt egyetlen nem-Messages kérés ment ki: `HEAD /anthropic/api/hello` (404). `GET /v1/models` és
  `POST /v1/messages/count_tokens` nem ment ki.
- A `supportedModels()` hat elemet adott, köztük a `MiniMax-M3.1-Flash` azonosítót.

### M-17-flash Szerver oldali tool

- A fő kérés a `WebSearch` kliens eszközt hívta; a kliens ehhez külön kérést küldött
  `tools: [{"type":"web_search_20250305","name":"web_search"}]` és `tool_choice: {"type":"auto"}` mezővel.
- **Ennek a kérésnek a streamje `server_tool_use` és `web_search_tool_result` blokkot tartalmazott**, a
  `tool_result` valódi találati linkeket hozott, és a záró válasz ezekre épült. A `result` `subtype: success`,
  `num_turns: 2`, a `maxTurns: 3` korlát nem szakította meg, ezért az M-25 nem kellett.

### M-23-flash Kép bemenet felismerhető tartalommal

- A kimenő `messages[].content[]` egy `image` blokkot hordozott (`base64`, `image/png`). HTTP 200.
- A válasz szövege `Piros.`: a modell a 256x256 pixeles, tiszta piros kép színét megnevezte. Egy futás, egy minta.

### M-26-flash `Options.effort` nélkül és `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`

- (a) `Options.effort` nélkül: a fő kérésben is áll `output_config`, értéke `{"effort":"high"}`; a kliens
  alapértéke tehát `high` (a MiniMax Claude Code lapjának állítása, research `2026-10-27-flash-es-haiku.md` 2.
  szekció, ezen a pinelt CLI-n mérve).
- (b) `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1`: ugyanaz az `output_config`.

### M-34-flash `tool_choice` közvetlen HTTP hívással

- **Első kísérlet, saját hiba:** `max_tokens: 16` mellett mindkét válasz (HTTP 200) csak `thinking` blokkot
  tartalmazott, `stop_reason: max_tokens`, mert a Flash mindig gondolkodik; a kérdés így nem dőlt el. A keret 512
  lett (`tools/wire-probe/src/cases/m-34.ts`).
- **Első kör (512 tokenes keret).** (a) `tool_choice: {"type":"any"}`: HTTP 200, a válasz egy `noop` `tool_use`
  blokk, `stop_reason: tool_use`. (b) `tool_choice: {"type":"tool","name":"noop"}`: HTTP 200, a válasz szöveg,
  `tool_use` blokk nélkül, `stop_reason: end_turn`. A kényszerítést a szolgáltatás nem utasította el és nem is
  tartotta be: csendben eldobta.
- **Második kör (user engedély 2026-10-28, ugyanaz a keret, ugyanaz az `any` kérés, egy futás).** A `m-34.ts` két
  új kérést kapott: (c) `tool_choice: {"type":"none"}` az eszköz hívását kérő prompttal (`Hívd meg a noop eszközt.`),
  és (d) `tool_choice: {"type":"auto"}` kontrollként az (a) promptjával (`Mondj egy szót.`), hogy a modell saját
  döntése elválasztható legyen. Mind a négy kérés HTTP 200; a (b) is újra futott.

  | Kérés                 | `stop_reason` | Tartalom blokkok                                                    | Be/ki token |
  | --------------------- | ------------- | ------------------------------------------------------------------- | ----------- |
  | (a) `any`             | `end_turn`    | `thinking`, `text` ("Alma."), **nincs `tool_use`**                  | 433 / 70    |
  | (b) `tool`            | `end_turn`    | `thinking`, `text` ("Béke."), nincs `tool_use`                      | 177 / 279   |
  | (c) `none`            | `end_turn`    | `thinking`, `text` (a `noop` eszköz nem elérhető, nincs `tool_use`) | 214 / 482   |
  | (d) `auto` (kontroll) | `end_turn`    | `thinking`, `text` ("Fény."), nincs `tool_use`                      | 177 / 147   |

- **Értékelés.** Az `any` kérés ugyanazzal a törzzsel az első körben `tool_use` blokkot adott, a másodikban
  szöveget: a kikényszerítés tehát nem determinisztikus, a második minta szerint nem betartott (a `tool` értékkel
  együtt: a `rejectionBehaviour` `silently_dropped` állítást a (b) második mintája is erősíti). A `none` kérésben
  nincs `tool_use`, de a prompt kifejezetten az eszközt kérte és a modell azt írta, hogy az eszköz nem elérhető; erre
  az ágra nincs `auto` kontroll (ugyanazzal a prompttal), tehát egy mintából a betartás nem választható el a modell
  saját döntésétől. A `toolChoice.accepted` ezért `unknown` marad, a `reason` mező a fentieket rögzíti. További
  futás nem volt (user korlát).

### M-35-flash `GET /v1/models` közvetlen HTTP hívással

- HTTP 200, a törzs `data`, `first_id`, `last_id`, `has_more` mezőkkel; a `data` 9 elemű, elemenként
  `created_at`, `display_name`, `id`, `type`. A `MiniMax-M3.1-Flash` szerepel benne.

### M-36-flash Header és végpont leltár (passzív)

- A kör 42 rögzített tranzakciója (a két első kísérleten kívül): 27 `POST /v1/messages`, 13 `HEAD /api/hello`,
  1 `GET /v1/models`, 1 `GET /` (a proxy indulásának első, azóta kivett ellenőrzése). Státusz: 200 és 404.
- A válasz headerek uniójában nincs `retry-after` és nincs `ratelimit` részszöveget tartalmazó header; 429 nem
  érkezett. A `rateLimits` két header mezője ezért `unknown` marad.
- Az SDK egyik futásban sem hívta a `/v1/models` végpontot.

---

## 4. A leíró mezői

**Lezárva a Flash mérésekkel (`known`):**

| Mező                                                | Érték                                                                            | Bizonyíték                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------- |
| `streaming.sse`                                     | `true`                                                                           | M-05-flash, M-09-flash        |
| `streaming.toolInputDelta`                          | `input_json_delta`                                                               | M-09-flash                    |
| `streaming.sdkReassemblesToolInput`                 | `true`                                                                           | M-09-flash                    |
| `thinking.wireShape`                                | `{"type":"adaptive"}`                                                            | M-01-flash, M-05-flash        |
| `thinking.sendsBudgetTokens`                        | `false`                                                                          | M-05-flash, M-06-flash        |
| `thinking.streamEventTypes`                         | `content_block_start`, `thinking_delta`, `signature_delta`, `content_block_stop` | M-01-flash, M-03-flash        |
| `structuredOutput.strategies[0].usable`             | `true`                                                                           | M-03-flash                    |
| `structuredOutput.strategies[0].blockingWireDetail` | `null`                                                                           | M-03-flash                    |
| `structuredOutput.strategies[0].observedRoundTrips` | `[3]`                                                                            | M-03-flash                    |
| `structuredOutput.outputConfigAlwaysSent`           | `true`                                                                           | M-01-flash, M-26-flash        |
| `structuredOutput.outputConfigWireField`            | `output_config.effort`                                                           | M-01-flash, M-26-flash        |
| `toolChoice.rejectionBehaviour`                     | `silently_dropped`                                                               | M-34-flash                    |
| `toolChoice.sdkSendsForcedChoice`                   | `false`                                                                          | M-03-flash, M-17-flash        |
| `serverTools` (`web_search_20250305`)               | `available: true`, `clientToolName: 'WebSearch'`                                 | M-17-flash                    |
| `models[0].imageInput`                              | `true`                                                                           | M-23-flash                    |
| `models[0].listedByModelsEndpoint`                  | `true`                                                                           | M-35-flash                    |
| `models[0].clientModelIdentifier`                   | változatlan `MiniMax-M3.1-Flash[1m]`, plusz mérési bizonyíték                    | M-11-flash (a doksik mellett) |
| `modelsEndpoint.directHttpReachable`                | `true`                                                                           | M-35-flash                    |
| `modelsEndpoint.calledBySdk`                        | `false`                                                                          | M-12-flash, M-36-flash        |
| `modelsEndpoint.listedModelCount`                   | `9`                                                                              | M-35-flash                    |
| `anthropicBetaHeaders`                              | az M-11-flash (a) listája (8 elem, `context-1m-2025-08-07`-tel)                  | M-01-flash, M-11-flash        |

**A motor következménye.** A `streaming.sse` `known` `true`, tehát egy `minimax` lépés
`includePartialMessages: true` mellett fut, és az élő nézet delta eseményeket kap (SPEC-013 O-7 lezárva). A
`serverTools` `known`, a `web_search` elérhető, tehát a `WebSearch` nem kerül tiltólistára és a
`serverToolAvailabilityUnproven` jelölés `false`. Egy strukturált kimenetű `minimax` lépés `maxTurns` alsó
korlátja 3 (`insufficient_max_turns` alatta). Védelem: `apps/server/src/minimax-flash-capabilities/` és a
`packages/provider-minimax` `descriptor.spec.ts`.

**Lefuttatva, de el nem döntve (`unknown`, saját indoklással):**

- `thinking.interleavedSignatureRequired`: a stream `signature_delta` eseményt ad, de hogy a thinking blokkot
  signature-rel vissza kell-e küldeni, egyik futásból sem dönthető el (blokkoló: M-05, kiterjesztett alakban).
- `toolChoice.accepted`: 3. szekció M-34-flash, két kör: az `any` két mintája ellentmond, a `none` egy mintája kontroll
  nélkül nem dönt (blokkoló: M-34).

**Nem futott, változatlanul `unknown`:** `effectiveContextWindowOnWire` (M-20), `maxOutputTokensWireCeiling`
(M-22), `videoInput` (SDK típusfelület), `structuredOutput.defaultStrategy` (M-19), a `promptCaching` minden
mezője (M-08, M-15, M-24, M-33), `streaming.streamDisableable` (M-24), a `rateLimits` mezői (M-18, M-36: 429
nélkül; RPM és TPM: nincs mérési eset), a `concurrency` mért mezői (M-31, M-39).

---

## 5. Nem futtatott esetek, becsült token igénnyel

**Döntés (koordinátor, a user korlátja alapján):** ezek az esetek nem futnak: "ugy hajtsd meg a minimax api-t hogy
nincs vegtelen tokenem" (user). A hozzájuk tartozó mezők `unknown` maradnak, a költség alább becsült, nem mért.

A becslés a 3. szekció mért kérés méretéből (fő kérés körülbelül 74 000 bemenő token, a második kérés ugyanazon
előtagon túlnyomórészt cache olvasás) és az eset SPEC-000 leírásából számolt nagyságrend, **nem mért** érték.

| Eset                                     | Mit zárna le                                                       | Becsült igény                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| M-20                                     | `effectiveContextWindowOnWire`                                     | legfeljebb 8 kérés, kérésenként körülbelül 150 000 és 1 000 000 bemenő token között: összesen több millió token |
| M-22                                     | `maxOutputTokensWireCeiling`                                       | 4 lekérdezés, körülbelül 0,3 millió bemenő token (a kimenet rövid prompt mellett kicsi)                         |
| M-13, M-28                               | auto-compact viselkedés (nem leíró mező)                           | a compact eléréséig növekvő kontextus: több millió token                                                        |
| M-19                                     | `structuredOutput.defaultStrategy`                                 | 10 lekérdezés, lekérdezésenként 2-3 kérés: körülbelül 1,5-2 millió bemenő token, cache nélkül számolva          |
| M-10                                     | strukturált kimenet `Stop` hookkal                                 | ismételt lekérdezések, körülbelül 0,5-1 millió token                                                            |
| M-31                                     | `concurrency.measuredSubagentCap`, `observedMaxConcurrentRequests` | 1 lekérdezés, 3 egyidejű subagenttel, körülbelül 5-8 kérés: 0,4-0,6 millió token (párhuzamossági mérés)         |
| M-39                                     | `concurrency.measuredMaxConcurrentSteps`, a 429 headerek           | fokozatos ramp az első 429-ig, a dokumentált limit szerint akár több száz kérés: több tíz millió token          |
| M-15, M-24, M-33, M-08                   | a `promptCaching` mért mezői, `streamDisableable`                  | 13 lekérdezés, körülbelül 1 millió bemenő token, ebből a nagy része cache olvasás lenne                         |
| M-02, M-04, M-14, M-32                   | a futtatottak mellé további bizonyíték                             | lekérdezésenként körülbelül 74 000 token, összesen 8 lekérdezés                                                 |
| M-07, M-21, M-27, M-29, M-30, M-37, M-38 | CLI env viselkedés és kérésszám (nem leíró mező, SPEC-013 3.3)     | lekérdezésenként körülbelül 74 000 token, összesen 16 lekérdezés                                                |

A `promptCaching` dokumentációs mezői (`explicitBreakpointLimit`, `ttlSeconds`, `minimumInputTokens`) méréssel
nem zárhatók le, ehhez a Flash-re vonatkozó forrás kell.

---

## 6. Token felhasználás és titok keresés

**Felhasználás (a `usage` mezőkből, a 9 lekérdezéses eset fő és háttér kéréseivel):** 749 524 nem cache-elt
bemenő token, 375 854 cache olvasott bemenő token, 2 420 kimenő token. Az első kör két M-34 kísérletének
közvetlen hívásai ehhez kérésenként néhány száz tokent adnak. Az M-12 és az M-35 nem küldött Messages kérést.

**A második M-34 kör (3. szekció):** négy közvetlen hívás, összesen 1 001 bemenő és 978 kimenő token, cache nélkül
(a 3. szekció táblája a kérésenkénti számokkal). A teljes új felhasználás tehát kb. ezer bemenő és ezer kimenő token.

**Titok keresés a futás után** (a kulcs értékét a `node --env-file` töltötte be, a keresés csak darabszámot
írt ki, pozitív kontrollal igazolva, hogy a módszer egy beírt értéket megtalál): az artefaktumokban 0 fájl, a
worktree-ben (`node_modules` és `.git` nélkül) 0 fájl, a proxy naplójában 0 sor, a git történetben a `main`-hez
képest 0 commit. A keresés a második M-34 kör után, a commit után is lefutott, ugyanezekkel a számokkal (0, 0, 0,
0; a pozitív kontroll 1).

---

## 7. A mérő eszköz változásai

- A modell azonosító a `tools/wire-probe/src/harness/minimax-model.ts` két konstansa (`MiniMax-M3.1-Flash`,
  `MiniMax-M3.1-Flash[1m]`), minden eset ezt használja (SPEC-013 O-2: a mérő eszköz most áll át).
- A közös alapbeállítás `effort: 'low'` (`buildBaseOptions`); az effort hiányát mérő M-26 a
  `buildBaseOptionsWithoutEffort` függvényt használja.
- Az M-34 közvetlen hívásainak `max_tokens` kerete 512 (3. szekció M-34-flash); a második körben két új kérést
  kapott: `none` (az eszköz hívását kérő prompttal) és `auto` kontroll.

---

## 8. A user kérdései és a döntések

1. **A `disabled` thinking elutasítása: marad.** A user soha nem kapcsolja ki a thinkinget ("soha nem kapcsoljuk
   ki", 2026-10-27). A motor viselkedése változatlan: egy `disabled` beállítású Flash lépést a futás indításakor
   `thinking_mode_unsupported` hibával elutasít. Az M-06-flash megfigyelése (a kliens ilyenkor a mezőt el sem
   küldi) a döntést nem érinti, a leíró `byModelFamily` értéke `['adaptive']` marad.
2. **A `toolChoice.accepted` lezárása: futott, nem döntött.** A 3. szekció M-34-flash második köre után a mező
   `unknown` marad (az `any` két mintája ellentmond, a `none` kontroll nélkül nem dönt); a user korlátja miatt
   további futás nincs.
3. **A nem futott esetek (5. szekció): nem futnak** a user token korlátja miatt, a mezőik `unknown` maradnak, a
   becsült költség az 5. szekcióban áll.
4. **Az `M-xx-flash` bizonyíték azonosító konvenció elfogadva** (az eredeti eset száma plusz `-flash`, horgony:
   ennek a fájlnak a 3. szekciója, `measurement-document.ts`).
