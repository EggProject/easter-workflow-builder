# SPEC-000: Provider drótszintű mérés

|         |                                                                                                                  |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Státusz | tervezet                                                                                                         |
| Dátum   | 2026-08-26                                                                                                       |
| Bemenet | [`../research/2026-08-26-agent-sdk-minimax.md`](../research/2026-08-26-agent-sdk-minimax.md) 4. szekció (Q1-Q12) |
| Kimenet | `ProviderCapabilityDescriptor` típusterv + kitöltött `minimax` leíró                                             |

---

## 1. Cél és hatókör

### Amit eldönt

- A research fájl Q1-Q12 nyitott kérdéseit drótszintű megfigyeléssel lezárja, vagy explicit `unknown` státuszra teszi indoklással.
- Eldönti, hogy a két strukturált kimenet stratégia (`emit_output` in-process MCP tool + `Stop` hook, illetve az SDK `outputFormat` opciója) közül melyik használható a `minimax` providerrel, és melyik lesz az alapértelmezett.
- Meghatározza a `minimax` provider backend config blokkjába kötelezően bekerülő env változók listáját, és azt, hogy melyik env kapcsoló mit vesz le ténylegesen a kimenő HTTP kérésből.
- Rögzíti a `ProviderCapabilityDescriptor` típus szerkezetét: minden képességmező mellé bizonyíték hivatkozás és explicit ismeretlen állapot.

### Amit NEM dönt el

- Nem implementálja a provider réteget, nem ír provider config fájlt, nem ír TypeScript kódot a `tools/wire-proxy/` mérőeszközön kívül.
- Nem építi a háromszintű provider választó UI-t (globális alapértelmezés, workflow felülírás, lépés felülírás), és nem dönt a perzisztencia sémáról azon túl, hogy a DB csak env változó NEVET tárol.
- Nem méri drótszinten a `claude-subscription` providert, mert az first-party base URL-t és bejelentkezésen alapuló hitelesítést használ, lásd 7. szekció.
- Nem teljesítmény- vagy minőségmérés: nem hasonlít modellkimeneteket, nem mér latenciát, nem mér költséget.
- Nem dönt a workflow futtató architektúrájáról, csak a provider képességleíró tartalmáról.

## 2. Miért kell

A Q1-Q12 kérdések egyike sem dönthető el dokumentációból, mert a kockázat mindkét oldalon a nem dokumentált részletekben van. Az `output_config` (`effort` + `json_schema` format) háttérkérésekben dokumentáltan 400-at dob ([GitHub #28](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/28)), viszont sehol nincs leírva, hogy az Agent SDK mikor küldi ki ezt a mezőt: csak `outputFormat` vagy `effort` beállításakor, vagy mindig. A MiniMax `tool_choice` mezője csak `auto` és `none` értéket fogad, tehát a strukturált kimenet szokásos kerülőútja (kényszerített tool hívás) nem járható, és nem tudjuk dokumentációból, hogy az SDK `outputFormat` záró fázisa használ-e kényszerítést. A Claude Code LLM gateway protokoll kimondja, hogy a body mezők listája nyílt és verziónként bővül, valamint hogy a beta képességek header és body mező párban utaznak, tehát a fél pár kemény 400-at okoz. Ezért a képességleíró minden mezőjének a forrása vagy egy rögzített HTTP tranzakció, vagy hivatalos dokumentáció, más nem elfogadható.

## 3. Mérési környezet

### A proxy szerepe és elhelyezkedése

Logoló reverse proxy: HTTP szerver a fejlesztői gépen, loopback interfészen. Az SDK `Options.env` mezőjén keresztül kap a natív Claude Code gyerekfolyamat `ANTHROPIC_BASE_URL` értéket, ami a proxyra mutat; a proxy upstreamje `https://api.minimax.io/anthropic`. Kód helye: `tools/wire-proxy/`, implementációja külön feladat, nem ennek a specnek a tárgya.

Követelmények a proxyval szemben:

- A kérés törzsét bájtszinten változatlanul továbbítja. Nem normalizál JSON-t, nem rendez kulcsot, nem tömörít újra.
- A `host` headert az upstream hosztjára állítja, minden más bejövő headert változatlanul továbbít. A rögzítés az eredeti, bejövő headerkészletet menti, nem a továbbítottat.
- Minden útvonalat kiszolgál, nem csak a `POST /v1/messages`-t (`GET /v1/models`, `HEAD /api/hello`, `POST /v1/messages/count_tokens` is a proxyn megy át).
- Streamnél minden SSE eventet külön sorként rögzít, monoton időbélyeggel, a nyers `event:` és `data:` sorokkal együtt. Nem parszolja át és nem tömöríti össze őket.
- Nem retry-zik, nem módosít státuszkódot, nem nyel el hibát. A hibás válasz is artefaktum.
- A loopback portot nem drótozzuk be a specbe: a futtatáskor választott port a `meta.json`-ba kerül.

### Artefaktumok

Gyökér: `docs/measurements/2026-08-26-minimax/`. Mérési esetenként egy alkönyvtár (`M-01/`, `M-02/`, ...), tranzakciónként egy sorszámozott alkönyvtár:

| Fájl                   | Tartalom                                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `meta.json`            | mérési eset azonosító, SDK verzió, modell, upstream URL, proxy port, futtatás kezdő és záró időbélyege, az esetre beállított `Options` mezők és env változók |
| `request.headers.json` | a bejövő kérés headerei, maszkolva                                                                                                                           |
| `request.body.json`    | a kérés törzse szó szerint                                                                                                                                   |
| `response.meta.json`   | HTTP státuszkód, válasz headerek, időzítés                                                                                                                   |
| `response.body.json`   | nem stream válasz törzse szó szerint                                                                                                                         |
| `stream.ndjson`        | stream válasznál soronként egy SSE event: `{ "t": <ms>, "raw": "<sor>" }`                                                                                    |
| `sdk-messages.ndjson`  | az SDK oldali `SDKMessage` folyam ugyanahhoz a futáshoz, hogy a drót és az SDK nézet összevethető legyen                                                     |

### Maszkolás

- Az `authorization` és `x-api-key` headerek értéke `REDACTED`-re cserélődik.
- A `MINIMAX_API_KEY` env változó értékének minden előfordulása minden rögzített szövegben `REDACTED`-re cserélődik, még a lemezre írás előtt, memóriában.
- Nyers, maszkolatlan artefaktum soha nem íródik lemezre. Nincs `raw/` mentés, amit később törölni kellene.
- A kulcs csak env változóból jön, a mérési konfigban sem szerepel literálként.

### Mi kerül gitbe

| Bemegy                                                          | Nem megy be                               |
| --------------------------------------------------------------- | ----------------------------------------- |
| `docs/measurements/2026-08-26-minimax/**` maszkolt artefaktumai | proxy futásidejű naplója                  |
| `meta.json` a beállításokkal                                    | bármi, ami a kulcs értékét tartalmazhatja |
| `tools/wire-proxy/` forrás                                      | `.env` fájl                               |

`.gitignore` bejegyzés kell a proxy naplójára és a `.env` fájlra. A commit előtt kötelező ellenőrzés: a mérési könyvtárban a `MINIMAX_API_KEY` értékére futtatott keresés nulla találatot ad.

## 4. Mérési esetek

### Kérdés és eset megfeleltetés

| Kérdés                                                                                                                         | Esetek                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Q1 `outputFormat` drótalakja                                                                                                   | M-02                                                     |
| Q2 kényszerített `tool_choice` a záró fázisban                                                                                 | M-03                                                     |
| Q3 `output_config` `effort` nélkül is                                                                                          | M-01, M-04                                               |
| Q4 `thinking` JSON alakja                                                                                                      | M-05, M-06                                               |
| Q5 háttér modellhívás                                                                                                          | M-07                                                     |
| Q6 env kapcsolók hatása a bodyra                                                                                               | M-08, M-14                                               |
| Q7 `input_json_delta` tool argumentumokhoz                                                                                     | M-09                                                     |
| Q8 `Stop` hook `decision: "block"`                                                                                             | M-10                                                     |
| Q9 `[1m]` suffix                                                                                                               | M-11                                                     |
| Q10 `GET /v1/models`                                                                                                           | M-12                                                     |
| Q11 kontextusablak és auto-compact                                                                                             | M-13                                                     |
| Q12 `anthropic-beta` header                                                                                                    | M-14                                                     |
| Descriptor kiegészítő mezők                                                                                                    | M-15, M-16, M-17, M-18                                   |
| Q8 kiegészítés: `Stop` hook kikényszerítés emit_output említése nélkül                                                         | M-19                                                     |
| Q11 kiegészítés: kontextusablak szerver oldali felső korlátja                                                                  | M-20                                                     |
| Q5 kiegészítés: `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` tényleges hatása                                                          | M-21                                                     |
| Q11 kiegészítés: `CLAUDE_CODE_MAX_OUTPUT_TOKENS` felső korlátja                                                                | M-22                                                     |
| M-16 kiegészítés: kép bemenet felismerhető tartalommal                                                                         | M-23                                                     |
| `promptCaching` kiegészítés: cache írás igazolása stream nélküli móddal                                                        | M-24                                                     |
| `serverTools` kiegészítés: web_search magasabb `maxTurns` mellett                                                              | M-25                                                     |
| A felhasználó tényleges indító parancsának env változói: `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`                                    | M-26                                                     |
| A felhasználó tényleges indító parancsának env változói: `CLAUDE_CODE_DISABLE_FAST_MODE`                                       | M-27                                                     |
| A felhasználó tényleges indító parancsának env változói: `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` + `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | M-28                                                     |
| A felhasználó tényleges indító parancsának env változói: `ANTHROPIC_DEFAULT_HAIKU_MODEL` suffix nélkül                         | M-29                                                     |
| A felhasználó tényleges indító parancsának env változói: `API_TIMEOUT_MS`                                                      | M-30                                                     |
| A felhasználó tényleges indító parancsának env változói: `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`                                | M-31                                                     |
| A felhasználó tényleges indító parancsa, mind a 12 env változóval együtt                                                       | M-32                                                     |
| `promptCaching.mode` kiegészítés: implicit és explicit szétválasztási kísérlet                                                 | M-33                                                     |
| `toolChoice.rejectionBehaviour` (nyitva maradt capability mező)                                                                | M-34                                                     |
| `listedByModelsEndpoint` (nyitva maradt capability mező)                                                                       | M-35                                                     |
| `rateLimits.retryAfterHeader`, `rateLimits.rateLimitHeaders` (nyitva maradt capability mezők) -- passzív elemzés               | M-36                                                     |
| `videoInput` (nyitva maradt capability mező)                                                                                   | nincs mérési eset -- lásd a szöveges indoklást M-25 után |
| Task #31: lépésenkénti kérésszám és időtartam, egyszerű és összetett lépésen                                                   | M-37, M-38                                               |
| Task #31: `concurrency`/`rateLimits` kiegészítés -- szándékos konkurrencia ramp az első 429-ig                                 | M-39                                                     |

### Közös alapbeállítás

Minden eset ebből indul, az eltéréseket az eset sorolja fel:

```
Options: {
  model: 'MiniMax-M3',
  systemPrompt: { type: 'preset', preset: 'claude_code' },
  maxTurns: 1,
  includePartialMessages: true,
  persistSession: false,
  env: {
    ANTHROPIC_BASE_URL: 'http://127.0.0.1:<port>/anthropic',
    ANTHROPIC_AUTH_TOKEN: <MINIMAX_API_KEY értéke>,
  },
}
prompt: rövid, tool nélkül megválaszolható kérdés
```

Az SDK verziót a mérés idejére pinelni kell, a pontos verzió a `meta.json`-ba kerül. Az `Options` olyan mezőinek konkrét értékét, aminek az enumját a research fájl nem rögzíti (`effort`, `thinking`), a mérés előtt a telepített `@anthropic-ai/claude-agent-sdk` típusdefiníciójából kell kiolvasni. Tippelni tilos, a kiolvasott értékek a `meta.json`-ba kerülnek.

### M-01 Alap body és header leltár

- **Eltérés**: nincs, ez a referencia futás.
- **Futtatás**: egy `query()`, egy kör.
- **Megfigyelés**: a rögzített `request.body.json` top-level kulcsainak teljes felsorolása. Jelen van-e `output_config`, `effort`, `tool_choice`, `thinking`, `context_management`, `container`, `top_k`, `stop_sequences`, `mcp_servers`. A `tools` tömb elemeinek `name` és `type` értéke. A `request.headers.json` teljes headerlistája, kiemelve az `anthropic-version` és `anthropic-beta`. A válasz HTTP kódja.
- **Következtetés**: ez a diff referencia minden további esethez. Ha az `output_config` már itt megjelenik, Q3 azonnal eldőlt, és a `minimax` provider csak akkor használható, ha valamelyik env kapcsoló leveszi (M-08).

### M-02 `outputFormat` drótalakja

- **Eltérés**: `outputFormat: { type: 'json_schema', schema: <kétmezős objektum séma, egy string és egy number mezővel> }`.
- **Futtatás**: egy `query()`.
- **Megfigyelés**: (a) van-e `output_config` vagy más, sémát hordozó top-level kulcs a bodyban, és ha van, a pontos JSON; (b) megjelenik-e a `tools` tömbben olyan elem, aminek az `input_schema`-ja a megadott sémával egyezik, és mi a neve; (c) a válasz HTTP kódja, 400 esetén az `error.type` és `error.message` szó szerint.
- **Következtetés**: Q1. Ha a séma a `tools` tömbben utazik, az `outputFormat` stratégia elvben járható MiniMax ellen; ha natív body mezőben, akkor nem, és a `structuredOutput.strategies[sdk_output_format].usable` `false`.

### M-03 `tool_choice` az `outputFormat` záró fázisában

- **Eltérés**: M-02 beállításai, plusz egy `createSdkMcpServer` in-process tool, amit a prompt kikényszerít, `allowedTools: ['mcp__measure__<toolnév>']`, `maxTurns` több körre engedve, `permissionMode` olyan értéken, ami nem nyit permission promptot.
- **Futtatás**: egy `query()`, több körrel, amíg `result` üzenet nem érkezik.
- **Megfigyelés**: minden kimenő kérés `tool_choice` mezője: hiányzik, vagy `{"type":"auto"}`, vagy `{"type":"none"}`, vagy `{"type":"any"}`, vagy `{"type":"tool","name":...}`. Külön kiemelve az utolsó kérés, ami a strukturált kimenetet zárja. Minden kérés HTTP kódja.
- **Következtetés**: Q2. Ha bármelyik kérésben `any` vagy `tool` típusú `tool_choice` megy ki, az `outputFormat` stratégia MiniMax ellen nem használható, mert a provider csak `auto` és `none` értéket fogad.

### M-04 `output_config` és `effort` kapcsolata

- **Eltérés**: két futás. (a) `effort` a típusdefinícióból kiolvasott legalacsonyabb értéken, `outputFormat` nélkül. (b) `effort` a legmagasabb értéken, `outputFormat` nélkül.
- **Futtatás**: futásonként egy `query()`.
- **Megfigyelés**: diff az M-01 bodyhoz. Melyik body mezőben jelenik meg az `effort` érték, és megjelenik-e vele `output_config` burkoló. A válasz HTTP kódja, 400 esetén az `error.message` szó szerint.
- **Következtetés**: Q3 másik fele, és az `effort` descriptor mező `wireField` értéke.

### M-05 `thinking` bekapcsolva

- **Eltérés**: `model: 'MiniMax-M3'`, `thinking` az SDK típusdefiníciója szerinti bekapcsolt vagy adaptív értékre állítva.
- **Futtatás**: egy `query()`, streamelve.
- **Megfigyelés**: a rögzített request body `thinking` mezője pontosan milyen JSON (kulcsok és értékek szó szerint, van-e `budget_tokens`), és a válasz HTTP kódja. A stream `content_block_start` eventjei között van-e `{"type":"thinking"}`, a delták `delta.type` értékei, és megjelenik-e záró `signature_delta`.
- **Következtetés**: Q4 első fele. Ha a body `thinking` mezője a MiniMax enumján (`disabled`, `adaptive`) kívüli értéket vagy `budget_tokens` kulcsot tartalmaz, a válasz HTTP kódja dönti el, hogy a provider elutasítja vagy eldobja.

### M-06 `thinking` kikapcsolva

- **Eltérés**: két futás, mindkettő `model: 'MiniMax-M3'`. (a) `thinking` az SDK szerinti kikapcsolt értékre állítva, explicit `thinking` opcióval. (b) `thinking` opció nélkül, `MAX_THINKING_TOKENS=0` env változóval.
- **Futtatás**: futásonként egy `query()`, streamelve.
- **Megfigyelés**: van-e egyáltalán `thinking` kulcs a bodyban mindkét futásnál, és ha igen, a pontos JSON. A válasz HTTP kódja. Diff az (a) és (b) futás `thinking` mezője között: a `MAX_THINKING_TOKENS=0` env változó ugyanazt a JSON alakot állítja elő, mint az explicit `thinking` opció, vagy eltérő alakot, vagy egyáltalán nem hat a mezőre.
- **Következtetés**: Q4 második fele, és annak rögzítése, hogy a `MAX_THINKING_TOKENS=0` env változó a `thinking` mezőn keresztül vagy attól függetlenül fejti-e ki a hatását M3-on.

### M-07 Háttér modellhívások

- **Eltérés**: négy futás. (a) alap. (b) `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. (c) `ANTHROPIC_DEFAULT_HAIKU_MODEL` egy létező MiniMax modellre állítva. (d) `ANTHROPIC_DEFAULT_HAIKU_MODEL` beállítás nélkül, `persistSession: true`.
- **Futtatás**: futásonként egy `query()`, a proxy minden tranzakciót rögzít, nem csak az elsőt.
- **Megfigyelés**: hány külön `POST /v1/messages` kérés megy ki egy `query()` alatt. Melyik kérés `messages` tartalma nem a felhasználói promptból származik (például session cím generálás). Ezeknek a kéréseknek a `model` mezője szó szerint: alias vagy konkrét modellnév. Ezeknek a kéréseknek a body top-level kulcsai és a válasz HTTP kódja külön, mert a research szerint az `output_config` háttérkérésekben dob 400-at.
- **Következtetés**: Q5. Ha a háttérhívás alias modellnévvel megy ki, a provider env blokkjába kötelezően bekerülnek az alias feloldó változók.

### M-08 Env kapcsoló mátrix

- **Eltérés**: futásonként egyetlen env változó eltérés az M-01 alaphoz képest: `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`, `ENABLE_TOOL_SEARCH=false`, `DISABLE_PROMPT_CACHING=1`, `MAX_THINKING_TOKENS=0`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. Azonos prompt, azonos modell.
- **Futtatás**: futásonként egy `query()`.
- **Megfigyelés**: strukturált diff az M-01 `request.body.json` és `request.headers.json` fájljaihoz: mely top-level body kulcsok tűnnek el vagy jelennek meg, hogyan változik az `anthropic-beta` header vesszővel tagolt értéklistája, hány `cache_control` blokk megy ki, mennyi a `tools` tömb hossza, és változik-e a kimenő kérések darabszáma.
- **Következtetés**: Q6. Az eredmény egy táblázat: env változó -> eltávolított body mezők és header elemek. Ebből áll össze a `minimax` provider kötelező env blokkja.

### M-09 Tool argumentum streaming

- **Eltérés**: egy `createSdkMcpServer` in-process tool, aminek több argumentuma van, köztük egy hosszú string, hogy több delta keletkezzen. `allowedTools` erre a toolra szűkítve, `includePartialMessages: true`, `permissionMode` olyan értéken, ami nem nyit permission promptot.
- **Futtatás**: egy `query()`, a prompt kikényszeríti a tool hívást.
- **Megfigyelés**: a `stream.ndjson`-ban a `content_block_start` event `{"type":"tool_use"}` blokkjának `input` mezője üres objektum-e vagy már a teljes argumentum. A rákövetkező `content_block_delta` eventek `delta.type` értéke: van-e `input_json_delta`. Ha nincs, milyen alakban érkezik az argumentum. Ezután bájtszintű összehasonlítás: az `sdk-messages.ndjson` `assistant` üzenetében szereplő tool input JSON megegyezik-e azzal, amit a tool callback ténylegesen megkapott.
- **Következtetés**: Q7. A `streaming.toolInputDelta` és `streaming.sdkReassemblesToolInput` mezők. Eltérés esetén a real-time UI nem építhet a `stream_event` folyamra, csak a lezárt `assistant` üzenetre.

### M-10 `Stop` hook kikényszerítés

- **Eltérés**: `mcpServers` egy `emit_output` toolt szolgáltató in-process szerverrel, `allowedTools: ['mcp__workflow__emit_output']`, `hooks: { Stop: [...] }`, ahol a callback `decision: 'block'` és `reason` értéket ad vissza, ha az `emit_output` még nem futott le, és a `stop_hook_active` input mezőt figyelve nem blokkol újra végtelenül. `maxTurns` felső korláttal.
- **Futtatás**: ismételt `query()` hívások azonos prompttal. Az ismétlésszámot a futtatáskor rögzítjük a `meta.json`-ban, a spec nem ír elő értéket.
- **Megfigyelés**: hány `POST /v1/messages` kérés kell, amíg az `emit_output` lefut, futásonként. A blokkolás `reason` szövege milyen szerepű üzenetként jelenik meg a következő kérés `messages` tömbjében: `user` vagy `system` role. Ez azért kritikus, mert a research szerint a beszélgetés közbeni `system` role MiniMaxnál `invalid message role: system (2013)` hibát ad. A `result` üzenet `subtype` értéke futásonként. A sikerarány és a körszám eloszlása.
- **Következtetés**: Q8. Ez dönti el, hogy az alapértelmezett strukturált kimenet stratégia tartható-e MiniMax ellen, és `structuredOutput.defaultStrategy` értékét.

### M-11 `[1m]` suffix kezelése

- **Eltérés**: két futás. (a) `model: 'MiniMax-M3[1m]'`. (b) `model: 'MiniMax-M3'`.
- **Futtatás**: futásonként egy `query()`.
- **Megfigyelés**: a kimenő body `model` mezője szó szerint, benne van-e a `[1m]` suffix. A válasz HTTP kódja, 404 esetén az `error.message` szó szerint. Ha a suffix leválasztódik, változik-e bármi más a bodyban az (b) futáshoz képest.
- **Következtetés**: Q9. Ha a suffix kimegy a dróton, a provider modell-listája nem tartalmazhat suffixes azonosítót.

### M-12 Nem-Messages végpontok

- **Eltérés**: nincs a `query()` szinten. A mérés az SDK indulási fázisát és a `supportedModels()` metódust célozza.
- **Futtatás**: `query()` indítás, `initializationResult()` és `supportedModels()` hívás, majd `close()`.
- **Megfigyelés**: milyen útvonalakra érkezik kérés a proxyra (`GET /v1/models`, `HEAD /api/hello`, `POST /v1/messages/count_tokens`), mindegyikre a HTTP kód és a válasz törzs szó szerint. A `GET /v1/models` válaszában milyen modellazonosítók szerepelnek, és van-e köztük olyan, ami a research modelltáblázatában nincs. A `supportedModels()` visszatérése összevetve a drótválasszal.
- **Következtetés**: Q10. Ez dönti el, hogy a Kapcsolat teszt gomb tölthet-e modell-listát az endpointról, vagy a config fájlba drótozott listát kell használnia.

### M-13 Kontextusablak és auto-compact

- **Eltérés**: egyetlen session, `persistSession: true`, `maxTurns` magas korláton, `model: 'MiniMax-M3'`, a promptok ismétlődő, nagy méretű szöveget adnak a beszélgetéshez.
- **Futtatás**: körök addig, amíg az SDK `system` üzenete compact boundary subtype-tal meg nem jelenik, vagy a kérés `413 request_too_large` hibát nem kap.
- **Megfigyelés**: a `POST /v1/messages/count_tokens` kérések és válaszaik, ha az SDK küld ilyet. A `usage.input_tokens` értéke a compact előtti utolsó sikeres válaszban. A `SDKContextUsage` üzenet mezői ugyanabban a pillanatban. Az a token szám, aminél a compact elindul, és ez hogyan viszonyul a research szerinti 1 000 000 kontextushoz és a GitHub issue-ban leírt 200K jelentéshez.
- **Következtetés**: Q11 és a `models[].effectiveContextWindowOnWire` mező. Ha az endpoint 200K-t jelent, a `CLAUDE_CODE_AUTO_COMPACT_WINDOW` nem segít, mert az csak csökkenteni tud.

### M-14 `anthropic-beta` header leltár

- **Eltérés**: három futás. (a) alap. (b) `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`. (c) `ENABLE_TOOL_SEARCH=false`.
- **Futtatás**: futásonként egy `query()`, azonos prompttal.
- **Megfigyelés**: az `anthropic-beta` header pontos, vesszővel tagolt értéklistája kérésenként, elemekre bontva. Az `anthropic-version` header értéke. Minden eltűnő header elemhez: melyik body mező tűnik el vele együtt. Minden kérés HTTP kódja, mert a header és body fél pár a research szerint 400-at okoz.
- **Következtetés**: Q12. Az `anthropicBetaHeaders` mező, és annak megerősítése, hogy a `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` valóban párban veszi le a headert és a body mezőt.

### M-15 Prompt caching drótalak

- **Eltérés**: két futás azonos, hosszú system prompttal, közvetlenül egymás után. Harmadik futás `DISABLE_PROMPT_CACHING=1` mellett.
- **Futtatás**: futásonként egy `query()`.
- **Megfigyelés**: hány `cache_control` blokk megy ki, és melyik szekcióban (`tools`, `system`, `messages`), a `{"type":"ephemeral"}` alak szó szerint. A válasz `usage` objektumában a `cache_creation_input_tokens` és `cache_read_input_tokens` értéke az első és a második futásnál. A harmadik futásnál eltűnik-e minden `cache_control` blokk.
- **Következtetés**: a `promptCaching` mező `mode`, `explicitBreakpointLimit` és `usageFields` értékei mérésből, nem csak dokumentációból.

### M-16 Kép bemenet

- **Eltérés**: `model: 'MiniMax-M3'`, a prompt streaming input módban egy base64 kódolt kép content blockot tartalmaz.
- **Futtatás**: egy `query()`.
- **Megfigyelés**: a kimenő `messages[].content[]` elem típusa és mezői szó szerint. A válasz HTTP kódja, 400 esetén az `error.message`. A válasz szövege utal-e a kép tényleges tartalmára.
- **Következtetés**: a `models[].imageInput` mező M3-ra. A videó bemenet külön kérdés: a research modelltáblázata összevont kép és videó oszlopot használ, külön videó bizonyíték nincs. Ha az SDK-ból nem állítható elő videó content blokk, a `models[].videoInput` mező `unknown` marad, és ezt a mérés jegyzőkönyve rögzíti.

### M-17 Szerver oldali tool

- **Eltérés**: olyan prompt, ami webkeresést igényelne, `allowedTools` a webkeresést engedve.
- **Futtatás**: egy `query()`.
- **Megfigyelés**: a kimenő `tools` tömbben van-e olyan elem, aminek `type` mezője szerver oldali tool típust jelöl (a research szerint a MiniMax béta `web_search` típusa `web_search_20250305`), vagy az SDK kliens oldali toolként intézi, tool nevet küldve `input_schema`-val. A válasz HTTP kódja, és a stream tartalmaz-e szerver oldali tool eredmény blokkot.
- **Következtetés**: a `serverTools` mező. Ha az SDK kliens oldalon oldja meg, a MiniMax béta `web_search` a mi utunkon nem is aktiválódik, és a mező `available: false` lesz mérési bizonyítékkal.

### M-18 Hiba és rate limit header leltár

- **Eltérés**: nincs. Passzív gyűjtés az összes fenti eset artefaktumából.
- **Futtatás**: nincs külön futás. A többi eset lezárása után elemzés.
- **Megfigyelés**: minden rögzített `response.meta.json` headerkészletének halmaza. Van-e `retry-after`, van-e bármilyen `ratelimit` alstringet tartalmazó header. Minden 4xx és 5xx válasz törzse: Anthropic alakú `{"type":"error","request_id":...,"error":{...}}` objektum, vagy natív `base_resp.status_code` alak. Az `error.type` értékek halmaza a hozzájuk tartozó HTTP kódokkal.
- **Következtetés**: a `rateLimits.retryAfterHeader` és `rateLimits.rateLimitHeaders` mezők. Ha a mérés alatt nem keletkezik 429-es válasz, ezek a mezők `unknown` állapotban maradnak, becslés nélkül.

### M-19 `Stop` hook kikényszerítés emit_output említése nélkül

- **Eltérés**: az M-10 megismétlése úgy, hogy a prompt **nem említi** az `emit_output` toolt (`"Számold ki mennyi 2+2."`). A `Stop` hook `decision: 'block'` ága ugyanúgy be van kötve, `stop_hook_active` loop-védelemmel, plusz egy kemény felső korláttal a blokkolások számára, hogy a mérés ne ragadjon be végtelen ciklusba.
- **Futtatás**: 10 ismételt `query()` hívás azonos, triviálisan rövid prompttal, a sikerarányhoz.
- **Megfigyelés**: futásonként aktiválódott-e a blokkoló ág, hány blokkolásra és hány körre volt szükség, sikerült-e végül az `emit_output` meghívása, és a `reason` szöveg milyen `role`-lal jelenik meg a következő kimenő kérés `messages` tömbjében. A 10 futásra vetített sikerarány.
- **Következtetés**: Q8 lezárása arra az ágra, amit az M-10 nem tudott megmérni, mert ott a prompt maga utasította a modellt a tool hívására.

### M-20 Kontextusablak szerver oldali felső korlátja bináris kereséssel

- **Eltérés**: `model: 'MiniMax-M3[1m]'`, növekvő méretű prompt, bináris kereséssel (nem lineáris növeléssel), legfeljebb 8 kérésben, kb. 150 000 token körüli becsült kiinduló mérettel. A kimenő `max_tokens` minimális (`CLAUDE_CODE_MAX_OUTPUT_TOKENS` env alacsony értéken), hogy a bemenet mérete uralja a költséget, ne a kimenet.
- **Futtatás**: legfeljebb 8, egymást bináris kereséssel követő `query()` hívás.
- **Megfigyelés**: a legnagyobb sikeres kérés mért `usage.input_tokens` értéke, és az első hibás kérés HTTP státusza (pl. `413 request_too_large`).
- **Következtetés**: Q11 szerver oldali fele -- mennyi kontextust szolgál ki ténylegesen az endpoint, a kliens oldali 200 000-es feltételezéstől függetlenül.

### M-21 `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` tényleges hatása

- **Eltérés**: egyetlen env eltérés az alaphoz képest: `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`.
- **Futtatás**: egy `query()`.
- **Megfigyelés**: eltűnik-e a session cím generáló ("thin") kérés, és eltűnik-e vele a `DesignSync` tool (ami a `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` kapcsolónál M-07/M-08 szerint eltűnt).
- **Következtetés**: eldönti, hogy a célzottabb kapcsoló használható-e a durvább (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`) helyett a `minimax` provider env blokkjában.

### M-22 `CLAUDE_CODE_MAX_OUTPUT_TOKENS` felső korlátja

- **Eltérés**: négy futás, növekvő `CLAUDE_CODE_MAX_OUTPUT_TOKENS` értékkel (a kliens alapértéke körüli, a MiniMax dokumentált ajánlott és max értéke mentén). A prompt rövid választ vált ki, mert a kimenő `max_tokens` mező értéke és a HTTP kód érdekes, nem a tényleges generálás hossza.
- **Futtatás**: futásonként egy `query()`, legfeljebb 4 futás.
- **Megfigyelés**: a kimenő body `max_tokens` mezőjének értéke és a válasz HTTP kódja értékenként.
- **Következtetés**: Q11 kiegészítés -- konkrét felső korlát a `CLAUDE_CODE_MAX_OUTPUT_TOKENS`-re a `minimax` providernél, mérési bizonyítékkal.

### M-23 Kép bemenet felismerhető tartalommal

- **Eltérés**: az M-16 megismétlése úgy, hogy az érvénytelenül kicsi (1x1 pixeles) teszt PNG helyett a harness programozottan generál egy legalább 256x256 pixeles, egyszínű (tiszta piros) PNG-t, és a prompt megkérdezi a modellt, milyen színt lát.
- **Futtatás**: egy `query()`, streaming input módban egy base64 kódolt kép content blockkal.
- **Megfigyelés**: a válasz szövege utal-e ténylegesen a kép piros színére, vagy ugyanazt az "nem látok képet" választ adja, mint az M-16.
- **Következtetés**: eldönti, hogy az M-16 "nem látok képet" válasza a kép érvénytelen mérete miatt volt-e, vagy a MiniMax valóban eldobja a kép content blockot.

### M-24 Prompt cache írás igazolása stream nélküli móddal

- **Eltérés**: az M-15 megismétlése `stream: false` móddal, hogy a nem stream `usage` objektumban látszódjon a `cache_creation_input_tokens`. Ha a telepített SDK `Options` típusa nem enged stream nélküli hívást, ez a `meta.json`-ban és a jegyzőkönyvben megfigyelésként rögzül, és a proxy oldali rögzített kérés `stream` mezőjéből olvasható ki, mi ment ki ténylegesen.
- **Futtatás**: az M-15 (a) és (b) futásának megismétlése, közvetlenül egymás után.
- **Megfigyelés**: a kimenő body `stream` mezőjének értéke, és hogy a válasz egyetlen JSON törzsként vagy SSE eseménysorként érkezik-e. Ha SSE marad, a `cache_creation_input_tokens` mező jelenléte a `message_start` esemény `message.usage` objektumában (nem csak a `message_delta` eseményekben, amit az M-15 vizsgált).
- **Következtetés**: a `promptCaching.usageFields` mező kiegészítése, vagy annak rögzítése, hogy a nem stream `usage` objektum ezzel az SDK verzióval nem érhető el.

### M-25 Szerver oldali tool magasabb `maxTurns` mellett

- **Eltérés**: az M-17 megismétlése magasabb `maxTurns` értékkel, hogy a limit ne szakítsa meg a `web_search` folyamatot, mielőtt eldőlne, hogy az ténylegesen lefutott-e szerver oldalon.
- **Futtatás**: egy `query()`.
- **Megfigyelés**: keletkezik-e `server_tool_use` vagy `web_search_tool_result` blokk a válaszban a magasabb korlát mellett, és a `result` üzenet subtype-ja (`success` vagy `error_max_turns`).
- **Következtetés**: a `serverTools` mező kiegészítése -- eldönti, hogy az M-17-nél megfigyelt hiányzó eredményblokk a `maxTurns: 3` limit korai megszakítása miatt volt-e, vagy a MiniMax a `web_search_20250305` toolt ténylegesen sosem futtatja le.

### M-26 `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` hatása

- **Eltérés**: két futás. (a) alap, a leíró meglévő env blokkja szerint (csak `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`). (b) `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1`. `Options.effort` egyik futásban sincs explicit beállítva.
- **Futtatás**: futásonként egy `query()`, azonos prompttal.
- **Megfigyelés**: a kimenő body `output_config` mezője szó szerint mindkét futásnál, kérésenként (thin és full külön). Van-e `output_config` a `full` kérésben mindkét esetben, és ha van, milyen mezőkkel. A válasz HTTP kódja.
- **Következtetés**: eldönti, hogy a felhasználó által ténylegesen használt kapcsolónak van-e egyáltalán mérhető hatása M3 ellen, a leírónk jelenlegi `effort` kockázat-jelölése mellett.

### M-27 `CLAUDE_CODE_DISABLE_FAST_MODE` hatása

- **Eltérés**: két futás. (a) alap. (b) `CLAUDE_CODE_DISABLE_FAST_MODE=1`.
- **Futtatás**: futásonként egy `query()`, azonos prompttal.
- **Megfigyelés**: diff a két futás `request.body.json` és `request.headers.json` fájljai között (mint M-08): top-level body kulcsok, `anthropic-beta` header lista, kérésszám. A kliens oldali `SDKMessage` folyam típus szerinti eloszlása is rögzítve, mert a jelenség lokális (kliens oldali) is lehet, nem csak drótszintű.
- **Következtetés**: mi tűnik el vagy jelenik meg a bodyban, a headerekben, vagy a kérések számában a fast mode kikapcsolásakor.

### M-28 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` és `CLAUDE_CODE_AUTO_COMPACT_WINDOW` együtt

- **Eltérés**: az M-13 mintájára, egyetlen session, `persistSession: true`, `[1m]` suffixes modell (mint a felhasználó parancsában), `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` és `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000` együtt beállítva. Rövidre fogva (legfeljebb 8 kör), hogy ne égessünk feleslegesen.
- **Futtatás**: körök egy streaming input generátorból, amíg a kör limit vagy a belső időkorlát el nem éri.
- **Megfigyelés**: van-e compact boundary jellegű `system` üzenet a rögzített `SDKMessage` folyamban, és ha igen, milyen `usage.input_tokens` értéknél. A `result.modelUsage[...].contextWindow` értéke.
- **Következtetés**: hol indul a compact ezzel a két kapcsolóval, és mekkora `contextWindow` értékkel dolgozik a kliens.

### M-29 `ANTHROPIC_DEFAULT_HAIKU_MODEL` suffix nélkül, `ANTHROPIC_DEFAULT_SONNET_MODEL`/`ANTHROPIC_DEFAULT_OPUS_MODEL` suffixszel

- **Eltérés**: `Options.model: 'MiniMax-M3[1m]'`, env: `ANTHROPIC_DEFAULT_SONNET_MODEL='MiniMax-M3[1m]'`, `ANTHROPIC_DEFAULT_OPUS_MODEL='MiniMax-M3[1m]'`, `ANTHROPIC_DEFAULT_HAIKU_MODEL='MiniMax-M3'` (suffix nélkül). `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` NINCS beállítva, hogy a thin (háttér) kérés lefusson és összevethető legyen a full kéréssel.
- **Futtatás**: egy `query()`.
- **Megfigyelés**: a thin és a full kérés `model` mezője szó szerint, és az `anthropic-beta` header `context-1m-2025-08-07` elemének jelenléte mindkét kérésben külön-külön.
- **Következtetés**: melyik kérésbe melyik modellnév kerül, és hogy a kliens a két kérést egyformán vagy eltérően kezeli-e, amikor a fő és a háttér modell suffix tekintetében szétválik.

### M-30 `API_TIMEOUT_MS` hatása

- **Eltérés**: két futás. (a) alap. (b) `API_TIMEOUT_MS=3000000`.
- **Futtatás**: futásonként egy `query()`, azonos rövid prompttal, nincs megvárva a 3 000 000 ms.
- **Megfigyelés**: a kimenő kérés headerei között a kliens saját HTTP kliense (Stainless) által küldött időkorlát jellegű header (ha van ilyen a header leltárban) értéke mindkét futásnál.
- **Következtetés**: mérhető-e ésszerű idő alatt a beállítás hatása anélkül, hogy a teljes időkorlátot megvárnánk.

### M-31 `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` konkurrens subagentekkel

- **Eltérés**: `Options.agents` néhány triviális, programozottan definiált subagenttel, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3`, olyan prompt, ami az összes subagent egyidejű, egyetlen üzeneten belüli elindítására utasítja a modellt, `permissionMode` a toolt ténylegesen engedélyező módon (lásd `sdk-constants.ts`).
- **Futtatás**: egy `query()`, magasabb `maxTurns` korláttal.
- **Megfigyelés**: a proxy artefaktumaiból az adott futás időablakában induló `POST /v1/messages` kérések kezdő és záró időpontja (`timestamp` + `durationMs`), és ezekből sweep-line módszerrel a legnagyobb egyidejűleg nyitva lévő kérésszám.
- **Következtetés**: hány egyidejű kérés megy ki ténylegesen a proxyn a cap alatt, és ez hogyan viszonyul a beállított `3` értékhez.

### M-32 A teljes felhasználói parancs env változói együtt

- **Eltérés**: egy futás, a felhasználó indító parancsának mind a 12 env változójával egyszerre (`API_TIMEOUT_MS`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `CLAUDE_CODE_DISABLE_FAST_MODE`, `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, plusz a proxyra mutató `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`). Az `Options.model` szándékosan NINCS beállítva, hogy a kliens env-alapú (`ANTHROPIC_MODEL`) modellfeloldása mérhető legyen.
- **Futtatás**: egy `query()`, rövid prompttal.
- **Megfigyelés**: a kimenő body teljes mezőkészlete és a fejléc leltár, mint egy "felhasználói beállítás" alapállapot referenciaként a többi eset mellé.
- **Következtetés**: van-e a 12 változó együttes hatásának olyan eleme, ami külön-külön mérve nem jelentkezett (pl. két kapcsoló egymást erősítő vagy egymást felülíró hatása).

### M-33 `promptCaching.mode` -- implicit és explicit szétválasztási kísérlet

- **Eltérés**: három futás, streaming input módban egy felhasználói üzenettel, aminek szöveg content blokkjára a harness SAJÁT, explicit `cache_control: {type:'ephemeral'}` jelölést tesz (az SDK a system promptra és a tools tömbre magától is tesz töréspontot, erre a harness nem hat rá közvetlenül -- ez az egyetlen pont, ahol a hívó fél saját maga adhat hozzá töréspontot). (a) és (b) azonos tartalommal, közvetlenül egymás után, cache bekapcsolva. (c) ugyanaz `DISABLE_PROMPT_CACHING=1` mellett.
- **Futtatás**: futásonként egy `query()`.
- **Megfigyelés**: a kimenő `messages[].content[]` blokkok közül melyiken van `cache_control` jelen mindhárom futásnál, külön a system/tools szekciótól. A válasz `usage` mezőjében a `cache_read_input_tokens` érték.
- **Következtetés**: küld-e az SDK egyáltalán a hívó fél által megjelölt `cache_control` blokkot változatlanul, és a `DISABLE_PROMPT_CACHING` kapcsoló csak a saját (SDK generálta) töréspontokat veszi-e le, vagy a hívó fél sajátját is.

### M-34 `toolChoice.rejectionBehaviour` közvetlen HTTP hívással

- **Eltérés**: nincs `query()`. Két közvetlen HTTP hívás (Node natív `fetch`, a proxyn keresztül, hogy a nyers tranzakció automatikusan, maszkolva rögzüljön) a `/v1/messages` végpontra, minimális bodyval és egy triviális toollal. (a) `tool_choice: {"type":"any"}`. (b) `tool_choice: {"type":"tool","name":"noop"}`.
- **Futtatás**: két HTTP kérés.
- **Megfigyelés**: mindkét kérés HTTP státuszkódja, a válasz törzse szó szerint (hibaüzenet vagy sikeres `message` objektum), és hogy a válasz tartalmaz-e `tool_use` blokkot.
- **Következtetés**: mi történik, ha a MiniMax `auto`/`none` szűk enumján kívüli `tool_choice` értéket kap -- elutasítja HTTP 400-zal, vagy elfogadja és figyelmen kívül hagyja.

### M-35 `listedByModelsEndpoint` közvetlen HTTP hívással

- **Eltérés**: nincs `query()`. Egy közvetlen `GET /v1/models` HTTP hívás (Node natív `fetch`, a proxyn keresztül) a MiniMax végpontra.
- **Futtatás**: egy HTTP kérés.
- **Megfigyelés**: a válasz HTTP kódja és a `data` tömb szerkezete (mezők, darabszám). A konkrét modellazonosítók közül csak a hatókörben lévő `MiniMax-M3` nevezhető meg a jegyzőkönyvben és bármely jelentésben, a CLAUDE.md szerint.
- **Következtetés**: milyen alakban listázza a végpont a modelleket, és szerepel-e köztük a `MiniMax-M3`.

### M-36 Rate limit header leltár (M-26 ... M-35 kör)

- **Eltérés**: nincs. Passzív gyűjtés az M-26 ... M-35 kör összes artefaktumából, az M-18 mintájára.
- **Futtatás**: nincs külön futás.
- **Megfigyelés**: az M-26 ... M-35 kör rögzített `response.meta.json` headerkészleteinek uniója, van-e `retry-after` vagy `ratelimit` alstringet tartalmazó header.
- **Következtetés**: kiegészíti-e ez a kör az M-18 eredményét, vagy a mező `unknown` marad.

### M-37 Lépésenkénti kérésszám és időtartam -- egyszerű lépés

- **Eltérés**: a `minimax` provider végleges env blokkja szerint (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, hogy a cím generáló háttérkérés ne torzítsa a kérésszámot), plusz egy in-process tool, amit a prompt pontosan egyszer kényszerít ki.
- **Futtatás**: 3, egymást szekvenciálisan követő `query()`, azonos beállítással, a szórás megfigyeléséhez.
- **Megfigyelés**: futásonként a proxy artefaktumaiból az időablakba eső `POST /v1/messages` kérések száma, és a `query()` teljes falóra időtartama.
- **Következtetés**: egy tipikus, egy tool hívást tartalmazó agent lépés kérésszáma és időtartama -- ez az alap a lépésenkénti kérésráta számításához (Task #31).

### M-38 Lépésenkénti kérésszám és időtartam -- összetett lépés

- **Eltérés**: az M-37 mintája, két láncolt in-process toollal (a második tool bemenete az első kimenetétől függ), hogy a modellnek több kört kelljen megtennie.
- **Futtatás**: 3, egymást szekvenciálisan követő `query()`.
- **Megfigyelés**: mint M-37.
- **Következtetés**: a kérésszám/időtartam szórása egy tipikusnál összetettebb lépésen, hogy a lépésenkénti kérésráta becslésének legyen alsó és felső sávja (Task #31).

### M-39 Egyidejű lépések rate limitig -- konkurrencia ramp

- **Eltérés a SPEC-000 7. szekció eredeti döntéséhez képest**: a 7. szekció "Ha a mérés alatt nem keletkezik 429-es válasz" sora eredetileg kimondta, hogy szándékos rate limit kimerítést nem végzünk. A Task #31 ezt tudatosan felülírja: a `provider_concurrency_limit` tábla alapértelmezéséhez mért adat kell, ezért ez a mérés kifejezetten a limit megkereséséért indul.
- **Eltérés**: nincs `Options` szintű eltérés az M-37-hez képest a lépés maga (`DEFAULT_PROMPT`, `maxTurns: 1`, tool nélkül, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`), viszont a `run()` egyszerre, `Promise.allSettled`-del indít `N` egyidejű, önálló `query()` hívást, ahol `N` a `WIRE_PROBE_M39_STAGE_SIZE` env változóból jön.
- **Futtatás**: fokozatonként egy `node src/probe.ts M-39` hívás, a fokozatok sorozatát és a leállási feltételt (első 429, vagy a mérőgép memóriakorlátja) a hívó bash szkript vezérli, nem a case. Ez azért fontos, hogy egy esetleges OOM csak az adott fokozat adatait vigye el, a korábbi fokozatokét ne.
- **Megfigyelés**: a proxy artefaktumaiból az időablakba eső összes `POST /v1/messages` tranzakció HTTP státuszkódja. Az első 429 esetén a teljes, maszkolt tranzakció (státusz, headerek, törzs) külön fájlba másolva (`artifacts/harness/M-39/stage-<N>-first-429.json`).
- **Következtetés**: hány egyidejű agent lépésnél jelenik meg az első 429, és mi a válasz pontos alakja (van-e `retry-after` vagy `ratelimit` jellegű header) -- ez zárja le vagy nyitja tovább a `rateLimits.retryAfterHeader`/`rateLimitHeaders` mezőt, és ez adja a `provider_concurrency_limit` alapértelmezés mérési alapját.

### `videoInput` -- miért nincs hozzá mérési eset

A telepített `@anthropic-ai/claude-agent-sdk@0.3.245` a `SDKUserMessage.message` mezőt az `@anthropic-ai/sdk` `MessageParam` típusán keresztül tipizálja. Ennek `ContentBlockParam` uniója (`@anthropic-ai/sdk/resources/messages/messages.d.ts`) `TextBlockParam | ImageBlockParam | DocumentBlockParam | ...` -- nincs benne `video` variáns. Az `ImageBlockParam.source` (`Base64ImageSource`) `media_type` mezője zárt unió: `'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'`, videó MIME típus nem írható bele. A projekt szabályai tiltják az `any`/`as` használatát, tehát ez a típuskorlát nem kerülhető meg típusbiztosan. Mivel a `ContentBlockParam` unió maga sem tartalmaz videó variánst, típusbiztos módon `as`/`any` nélkül nem állítható elő olyan streaming input üzenet, ami videó content blokkot hordozna -- a mező emiatt `unknown` marad, blokkoló: a telepített SDK típusfelülete.

## 5. A `ProviderCapabilityDescriptor` típus terve

### Alapelvek

- Minden képességmező háromállapotú burkolóban van: `known` bizonyítékkal, vagy `unknown` indoklással és a blokkoló mérési eset azonosítójával. Nincs olyan mező, aminek az értékét tippelés tölti ki.
- A `known` ág legalább egy bizonyítékot megkövetel a típusrendszer szintjén (nem üres tuple), tehát bizonyíték nélküli állítás nem fordul le.
- Nincs `any`, nincs `as`. A leíró objektum literál `satisfies` operátorral kapcsolódik a típushoz.
- A modellazonosító és a modellcsalád generikus paraméter, hogy a `minimax` és a `claude-subscription` leíró külön, szűk literál uniókkal dolgozzon.

### Bizonyíték és háromállapotú mező

```ts
/** Mérési eset azonosító a 4. szekcióból. */
type MeasurementId = `M-${string}`;

/** Bizonyíték: mérés, hivatalos dokumentáció, vagy a research fájl egy szekciója. */
type EvidenceRef =
  | { readonly kind: 'measurement'; readonly id: MeasurementId }
  | { readonly kind: 'doc'; readonly url: string }
  | { readonly kind: 'research'; readonly section: string };

/** Nem üres bizonyítéklista: a known ág bizonyíték nélkül nem fordul le. */
type EvidenceList = readonly [EvidenceRef, ...EvidenceRef[]];

/**
 * Minden képességmező burkolója. Az `unknown` ág nem hiba, hanem érvényes
 * és kötelező állapot mindaddig, amíg a mérés le nem zárul.
 */
type Fact<TValue> =
  | { readonly state: 'known'; readonly value: TValue; readonly evidence: EvidenceList }
  | { readonly state: 'unknown'; readonly reason: string; readonly blockedBy: readonly MeasurementId[] };

/** Typeguard, hogy a fogyasztó oldal ne olvashasson értéket ismeretlen mezőből. */
function isKnown<TValue>(fact: Fact<TValue>): fact is Extract<Fact<TValue>, { readonly state: 'known' }> {
  return fact.state === 'known';
}
```

### Mezőcsoportok

```ts
/** Strukturált kimenet: a projekt két stratégiája. */
type StructuredOutputStrategyId = 'emit_output_tool' | 'sdk_output_format';

interface StructuredOutputStrategy {
  readonly id: StructuredOutputStrategyId;
  /** Használható-e ezzel a providerrel. */
  readonly usable: Fact<boolean>;
  /** Ha nem használható: melyik konkrét drótrészlet blokkolja. `null`, ha nincs blokkoló. */
  readonly blockingWireDetail: Fact<string | null>;
  /** Hány modellkör kellett a kikényszerítéshez a mérésben. */
  readonly observedRoundTrips: Fact<readonly number[]>;
}

interface StructuredOutputCapability {
  readonly strategies: readonly StructuredOutputStrategy[];
  readonly defaultStrategy: Fact<StructuredOutputStrategyId>;
  /** Q3: kimegy-e `output_config` akkor is, ha nem kérünk strukturált kimenetet. */
  readonly outputConfigAlwaysSent: Fact<boolean>;
  /** Q3: melyik body mezőben utazik az `effort`, ha egyáltalán. */
  readonly outputConfigWireField: Fact<string | null>;
}

/** `tool_choice`: a MiniMax szűk enumja miatt külön mező. */
type ToolChoiceValue = 'auto' | 'none' | 'any' | 'tool';

interface ToolChoiceCapability {
  /** Amit a provider elfogad. */
  readonly accepted: Fact<readonly ToolChoiceValue[]>;
  /** Mi történik a nem támogatott értékkel. */
  readonly rejectionBehaviour: Fact<'http_400' | 'silently_dropped'>;
  /** Q2: küld-e az SDK kényszerített értéket bármelyik fázisban. */
  readonly sdkSendsForcedChoice: Fact<boolean>;
}

/** Thinking, modellcsaládonként. A bontás a típus általános része marad, mert más
 *  provider több modellcsaládot is hozhat; a `minimax` leírónak jelenleg egyetlen
 *  családja van, `M3`. */
type ThinkingMode = 'disabled' | 'adaptive' | 'always_on';

interface ThinkingCapability<TFamilyId extends string> {
  readonly byModelFamily: Readonly<Record<TFamilyId, Fact<readonly ThinkingMode[]>>>;
  /** Q4: a kimenő `thinking` mező pontos JSON alakja, szó szerint. */
  readonly wireShape: Fact<string>;
  /** Küld-e az SDK `budget_tokens` kulcsot, amit a provider sémája nem ismer. */
  readonly sendsBudgetTokens: Fact<boolean>;
  /** M3 interleaved: vissza kell-e adni a thinking blokkot signature-rel. */
  readonly interleavedSignatureRequired: Fact<boolean>;
  /** A stream thinking eventjeinek típusai. */
  readonly streamEventTypes: Fact<readonly string[]>;
}

interface EffortCapability {
  /** Elfogadja-e a provider a kérést, ha az `effort` be van állítva. */
  readonly accepted: Fact<boolean>;
  /** Melyik body mezőben jelenik meg. `null`, ha nem megy ki a dróton. */
  readonly wireField: Fact<string | null>;
}

type PromptCacheMode = 'none' | 'implicit' | 'explicit' | 'implicit_and_explicit';

interface PromptCachingCapability {
  readonly mode: Fact<PromptCacheMode>;
  readonly explicitBreakpointLimit: Fact<number>;
  readonly ttlSeconds: Fact<number>;
  readonly minimumInputTokens: Fact<number>;
  /** A válasz `usage` objektumában megfigyelt cache mezők nevei. */
  readonly usageFields: Fact<readonly string[]>;
  /** Az env változó, amivel a kliens oldali cache jelölés kikapcsolható. */
  readonly disableEnvVar: Fact<string | null>;
  /**
   * M-33: kimegy-e a hívó fél által kézzel rakott `cache_control` blokk akkor is,
   * ha a `disableEnvVar` be van állítva. Ha igen, a kapcsoló csak az SDK saját
   * töréspontjait veszi le, tehát a prompt cache egy része a hívó fél kezében marad.
   */
  readonly callerBreakpointSurvivesDisable: Fact<boolean>;
}

interface StreamingCapability {
  readonly sse: Fact<boolean>;
  /** Q7: milyen alakban érkezik a tool argumentum. */
  readonly toolInputDelta: Fact<'input_json_delta' | 'whole_input_in_content_block_start' | 'other'>;
  /** Q7: az SDK helyesen rakja-e össze a tool inputot. Bájtszintű összevetés eredménye. */
  readonly sdkReassemblesToolInput: Fact<boolean>;
  /** Nem-first-party base URL mellett az SDK kikapcsolja. */
  readonly fineGrainedToolStreaming: Fact<boolean>;
  /**
   * M-24: kikapcsolható-e a kimenő kérés `stream` mezője. SDK szintű tulajdonság,
   * nem a provideré. Ha nem, a nem stream válasz `usage` objektuma ezen az úton
   * nem figyelhető meg, ami a `promptCaching.usageFields` mérését korlátozza.
   */
  readonly streamDisableable: Fact<boolean>;
}

interface ServerToolDescriptor {
  /** A body `tools[].type` értéke, ahogy a dróton megjelenne. */
  readonly wireType: string;
  readonly name: string;
  /** Elérhető-e a mi hívási utunkon, nem elméletben. */
  readonly available: Fact<boolean>;
}

interface ModelDescriptor<TModelId extends string, TFamilyId extends string> {
  /** A modell azonosítója úgy, ahogy a kimenő body `model` mezőjében megjelenik. */
  readonly id: TModelId;
  readonly family: TFamilyId;
  /**
   * M-11, M-29, M-32: amit a kliensnek ténylegesen át kell adni (`Options.model`
   * vagy `ANTHROPIC_MODEL`). Eltérhet az `id` mezőtől, mert a `[1m]` suffix a
   * dróton lekerül, viszont a kliens oldali kontextusablakot és a
   * `context-1m-2025-08-07` beta header jelenlétét ez vezérli.
   */
  readonly clientModelIdentifier: Fact<string>;
  /** Dokumentált kontextusablak. */
  readonly contextWindow: Fact<number>;
  /**
   * Q11: amit az endpoint ténylegesen kiszolgál, mérésből. **Alsó korlát**: a
   * legnagyobb sikeresen kiszolgált teljes bemeneti token szám
   * (`usage.input_tokens` + `usage.cache_read_input_tokens`), nem a pontos határ.
   */
  readonly effectiveContextWindowOnWire: Fact<number>;
  readonly maxOutputTokensRecommended: Fact<number>;
  readonly maxOutputTokensHard: Fact<number>;
  /**
   * M-22: a kimenő body `max_tokens` mezőjének kliens oldali felső korlátja. A
   * Claude Code a saját modelltáblájának cap értékére vágja le a
   * `CLAUDE_CODE_MAX_OUTPUT_TOKENS` ennél nagyobb értékét is, ezért a provider
   * dokumentált korlátja fölé nem lehet menni.
   */
  readonly maxOutputTokensWireCeiling: Fact<number>;
  readonly imageInput: Fact<boolean>;
  readonly videoInput: Fact<boolean>;
  /** Q10: szerepel-e a `GET /v1/models` válaszában. */
  readonly listedByModelsEndpoint: Fact<boolean>;
}

/**
 * M-12, M-35: a `GET /v1/models` végpont. Külön mezőcsoport, mert a "lekérhető" és
 * az "az SDK le is kéri" két különböző dolog, és a Kapcsolat teszt gomb terve
 * pontosan ezen a különbségen áll.
 */
interface ModelsEndpointCapability {
  /** Válaszol-e a végpont közvetlen, SDK-n kívüli HTTP hívásra. */
  readonly directHttpReachable: Fact<boolean>;
  /** Meghívja-e az SDK saját maga ezt az útvonalat a mért konfigurációban. */
  readonly calledBySdk: Fact<boolean>;
  /** A válasz `data` tömbjének hossza, ha a végpont válaszolt. */
  readonly listedModelCount: Fact<number>;
}

/**
 * M-31: kliens oldali párhuzamosság. Providerenkénti mező, mert a megfigyelt
 * egyidejű kérésszám közvetlenül a provider percenkénti kérés korlátjába számít bele.
 */
interface ConcurrencyCapability {
  /** Az env változó, ami a kliens belső subagent párhuzamosságát korlátozza. */
  readonly subagentCapEnvVar: Fact<string | null>;
  /** A fenti env változó értéke, amivel a megfigyelés készült. */
  readonly measuredSubagentCap: Fact<number>;
  /**
   * A megfigyelt legnagyobb egyidejűleg nyitva lévő kimenő kérésszám egyetlen
   * `query()` alatt. A subagentek kérésein felül az orchestrátor saját kérése is
   * beleszámít.
   */
  readonly observedMaxConcurrentRequests: Fact<number>;
}

interface RateLimitBucket<TModelId extends string> {
  readonly appliesTo: readonly TModelId[];
  readonly requestsPerMinute: Fact<number>;
  readonly tokensPerMinute: Fact<number>;
}

interface RateLimitCapability<TModelId extends string> {
  readonly buckets: readonly RateLimitBucket<TModelId>[];
  /** Küld-e a provider `Retry-After` headert 429-nél. */
  readonly retryAfterHeader: Fact<string | null>;
  /** Minden megfigyelt rate limit jellegű header neve. */
  readonly rateLimitHeaders: Fact<readonly string[]>;
}

/**
 * Env követelmény. A DB soha nem tárol titkot: ha `secret: true`,
 * csak a `name` kerül perzisztálásra, az érték futásidőben a process env-ből jön.
 */
interface EnvRequirement {
  readonly name: string;
  readonly source: 'literal' | 'process_env_passthrough';
  /** Csak `literal` forrásnál értelmezett, és csak nem titkos értékre. */
  readonly literalValue?: string;
  readonly secret: boolean;
  readonly purpose: string;
  readonly evidence: EvidenceList;
}

interface ProviderCapabilityDescriptor<TModelId extends string, TFamilyId extends string> {
  readonly id: 'claude-subscription' | 'minimax';
  readonly displayName: string;
  /** Az SDK verzió, amivel a mérés készült. Frissítés előtt regresszió kell. */
  readonly sdkVersionPin: string;
  readonly measuredAt: string;
  readonly requiredEnv: readonly EnvRequirement[];
  /** Env változók, amiket ezzel a providerrel tilos beállítani. */
  readonly disallowedEnv: readonly {
    readonly name: string;
    readonly reason: string;
    readonly evidence: EvidenceList;
  }[];
  readonly structuredOutput: StructuredOutputCapability;
  readonly toolChoice: ToolChoiceCapability;
  readonly thinking: ThinkingCapability<TFamilyId>;
  readonly effort: EffortCapability;
  readonly promptCaching: PromptCachingCapability;
  readonly streaming: StreamingCapability;
  readonly serverTools: Fact<readonly ServerToolDescriptor[]>;
  readonly models: readonly ModelDescriptor<TModelId, TFamilyId>[];
  readonly modelsEndpoint: ModelsEndpointCapability;
  readonly rateLimits: RateLimitCapability<TModelId>;
  readonly concurrency: ConcurrencyCapability;
  /** Q12: a kimenő `anthropic-beta` header elemei. */
  readonly anthropicBetaHeaders: Fact<readonly string[]>;
}
```

### Mezőmagyarázatok

| Mező                                            | Mit ír le                                                                      | Honnan jön                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------- |
| `sdkVersionPin`                                 | melyik SDK verzióval érvényes a leíró, mert a body mezőlista verziónként bővül | `meta.json`                                       |
| `requiredEnv`                                   | a provider config env blokkja, `secret: true` esetén csak a NÉV perzisztálódik | M-08, M-14                                        |
| `disallowedEnv`                                 | amit tilos beállítani, mert rontja a kompatibilitást                           | research 3. szekció                               |
| `structuredOutput.strategies`                   | stratégiánként külön használhatóság és a blokkoló drótrészlet                  | M-02, M-03, M-10                                  |
| `structuredOutput.defaultStrategy`              | melyik lesz a lépések alapértelmezése ennél a providernél                      | M-02, M-03, M-10                                  |
| `structuredOutput.outputConfigAlwaysSent`       | Q3, ez dönti el, használható-e egyáltalán a provider                           | M-01, M-04                                        |
| `toolChoice.accepted`                           | a provider által elfogadott értékek                                            | research 2. szekció, M-03                         |
| `toolChoice.sdkSendsForcedChoice`               | Q2, küld-e az SDK olyat, amit a provider nem fogad                             | M-03                                              |
| `thinking.byModelFamily`                        | modellcsaládonkénti thinking módok                                             | research 2. szekció, M-05, M-06                   |
| `thinking.wireShape`                            | a kimenő JSON pontos alakja, nem parafrázis                                    | M-05, M-06                                        |
| `effort`                                        | elfogadott-e, és melyik body mezőben utazik                                    | M-04                                              |
| `promptCaching`                                 | mód, breakpoint limit, TTL, minimum token, usage mezők                         | research 2. szekció, M-15                         |
| `streaming.toolInputDelta`                      | Q7, a tool argumentum delta alakja                                             | M-09                                              |
| `streaming.streamDisableable`                   | kikapcsolható-e a `stream` a dróton, SDK szintű tulajdonság                    | M-24                                              |
| `serverTools`                                   | ténylegesen elérhető szerver oldali toolok, nem elméleti lista                 | M-17, M-25                                        |
| `models`                                        | kontextus és output limitek, kép/videó bemenet, listázottság                   | research 2. szekció, M-12, M-13, M-16, M-20, M-23 |
| `models[].maxOutputTokensWireCeiling`           | a kimenő `max_tokens` kliens oldali vágása, a provider korlátjától függetlenül | M-22                                              |
| `models[].clientModelIdentifier`                | amit a kliensnek át kell adni, ha az az `id` mezőtől eltér (`[1m]` suffix)     | M-11, M-29, M-32                                  |
| `promptCaching.callerBreakpointSurvivesDisable` | a hívó fél saját `cache_control` blokkját levágja-e a `disableEnvVar`          | M-33                                              |
| `modelsEndpoint`                                | a `GET /v1/models` elérhetősége közvetlen hívással, és hogy az SDK hívja-e     | M-12, M-35                                        |
| `concurrency`                                   | a subagent korlát env változó, és a mellette megfigyelt egyidejű kérésszám     | M-31                                              |
| `rateLimits`                                    | dokumentált bucketek plusz a megfigyelt headerek                               | research 2. szekció, M-18, M-36                   |
| `anthropicBetaHeaders`                          | Q12, a header elemek, párban a body mezőkkel                                   | M-14                                              |

### A `minimax` leíró jelen állapota

A leíró objektum literál `satisfies ProviderCapabilityDescriptor<MiniMaxModelId, MiniMaxFamilyId>` alakban íródik, ahol `MiniMaxModelId = 'MiniMax-M3'`, `MiniMaxFamilyId = 'M3'`. A mérés lezárása előtti állapot:

| Mező                                                    | Állapot | Érték / indok                                                                                                                          | Bizonyíték                 |
| ------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `id`, `displayName`                                     | known   | `'minimax'`                                                                                                                            | konfigdöntés               |
| `sdkVersionPin`                                         | known   | a mérés `meta.json`-jából                                                                                                              | M-01                       |
| `requiredEnv[ANTHROPIC_BASE_URL]`                       | known   | `literal`, `https://api.minimax.io/anthropic`, `secret: false`                                                                         | research 2. szekció        |
| `requiredEnv[ANTHROPIC_AUTH_TOKEN]`                     | known   | `process_env_passthrough` a `MINIMAX_API_KEY` névből, `secret: true`                                                                   | research 2. és 3. szekció  |
| `requiredEnv` további elemei                            | unknown | az env kapcsoló mátrix eredményéből áll össze                                                                                          | blokkolja M-08, M-14, M-07 |
| `disallowedEnv`                                         | known   | `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING`, `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`, mindkettő kerülendő custom base URL mellett | research 3. szekció        |
| `structuredOutput.strategies[emit_output_tool].usable`  | unknown | a `Stop` hook viselkedése MiniMax ellen nem ismert                                                                                     | blokkolja M-10             |
| `structuredOutput.strategies[sdk_output_format].usable` | unknown | a séma drótalakja nem ismert                                                                                                           | blokkolja M-02, M-03       |
| `structuredOutput.defaultStrategy`                      | unknown | a két stratégia mérése után dől el                                                                                                     | blokkolja M-02, M-03, M-10 |
| `structuredOutput.outputConfigAlwaysSent`               | unknown | Q3                                                                                                                                     | blokkolja M-01, M-04       |
| `toolChoice.accepted`                                   | known   | `['auto','none']`                                                                                                                      | research 2. szekció        |
| `toolChoice.rejectionBehaviour`                         | unknown | 400 vagy csendes eldobás, nem mértük                                                                                                   | blokkolja M-03             |
| `toolChoice.sdkSendsForcedChoice`                       | unknown | Q2                                                                                                                                     | blokkolja M-03             |
| `thinking.byModelFamily.M3`                             | known   | `['disabled','adaptive']`, alapból ki                                                                                                  | research 2. szekció        |
| `thinking.wireShape`                                    | unknown | Q4, az SDK által küldött JSON nem ismert                                                                                               | blokkolja M-05, M-06       |
| `thinking.sendsBudgetTokens`                            | unknown | a provider sémájában nincs `budget_tokens`, de az SDK küldhet                                                                          | blokkolja M-05             |
| `thinking.interleavedSignatureRequired`                 | known   | M3-nál a thinking blokkot signature-rel vissza kell adni                                                                               | research 2. szekció        |
| `thinking.streamEventTypes`                             | known   | `content_block_start` thinking blokkal, `thinking_delta`, `signature_delta`, `content_block_stop`                                      | research 2. szekció        |
| `effort.accepted`                                       | unknown | az `output_config` 400 kockázata miatt kritikus                                                                                        | blokkolja M-04             |
| `effort.wireField`                                      | unknown | nem ismert, melyik body mezőben utazik                                                                                                 | blokkolja M-04             |
| `promptCaching.mode`                                    | known   | `implicit_and_explicit`                                                                                                                | research 2. szekció        |
| `promptCaching.explicitBreakpointLimit`                 | known   | 4                                                                                                                                      | research 2. szekció        |
| `promptCaching.ttlSeconds`                              | known   | 300                                                                                                                                    | research 2. szekció        |
| `promptCaching.minimumInputTokens`                      | known   | 512                                                                                                                                    | research 2. szekció        |
| `promptCaching.usageFields`                             | known   | `cache_creation_input_tokens`, `cache_read_input_tokens`                                                                               | research 2. szekció        |
| `promptCaching.disableEnvVar`                           | known   | `DISABLE_PROMPT_CACHING`                                                                                                               | research 3. szekció        |
| `streaming.sse`                                         | known   | `true`                                                                                                                                 | research 2. szekció        |
| `streaming.toolInputDelta`                              | unknown | Q7                                                                                                                                     | blokkolja M-09             |
| `streaming.sdkReassemblesToolInput`                     | unknown | Q7                                                                                                                                     | blokkolja M-09             |
| `streaming.fineGrainedToolStreaming`                    | known   | `false`, nem-first-party base URL mellett az SDK kikapcsolja                                                                           | research 3. szekció        |
| `serverTools`                                           | unknown | a béta `web_search` elérhetősége a mi hívási utunkon nem ismert                                                                        | blokkolja M-17             |
| `models[].contextWindow`, `maxOutputTokens*`            | known   | a research modelltáblázata szerint                                                                                                     | research 2. szekció        |
| `models[].effectiveContextWindowOnWire`                 | unknown | Q11, a 200K kontra 1M ellentmondás nyitott                                                                                             | blokkolja M-13             |
| `models[MiniMax-M3].imageInput`                         | unknown | a research táblázata összevont kép és videó oszlopot használ, külön kép bizonyíték nincs                                               | blokkolja M-16             |
| `models[MiniMax-M3].videoInput`                         | unknown | ugyanaz az összevont oszlop, külön videó bizonyíték nincs                                                                              | blokkolja M-16             |
| `models[].listedByModelsEndpoint`                       | unknown | Q10                                                                                                                                    | blokkolja M-12             |
| `rateLimits.buckets`                                    | known   | M3: 200 RPM / 10M TPM                                                                                                                  | research 2. szekció        |
| `rateLimits.retryAfterHeader`                           | unknown | a `Retry-After` nincs dokumentálva, mérés kell                                                                                         | blokkolja M-18             |
| `rateLimits.rateLimitHeaders`                           | unknown | a megfigyelt headerlista a mérésből jön                                                                                                | blokkolja M-18             |
| `anthropicBetaHeaders`                                  | unknown | Q12                                                                                                                                    | blokkolja M-14             |

## 6. Elfogadási kritériumok

1. A `tools/wire-proxy/` mérőeszköz egyetlen paranccsal újrafuttatható, és a futás után minden mérési esethez létezik a 3. szekcióban felsorolt fájlkészlet a `docs/measurements/2026-08-26-minimax/M-<n>/` alatt.
2. Mind a 18 mérési esethez (M-01 ... M-18) létezik legalább egy rögzített HTTP tranzakció, vagy a `meta.json`-ban indoklás, hogy miért nem volt reprodukálható.
3. A Q1-Q12 táblázat minden sora lezárt: vagy konkrét mérési eset azonosítóval és megfigyeléssel eldöntve, vagy explicit `unknown` státusszal és indoklással. Tippelt lezárás nincs.
4. A mérési könyvtárban a `MINIMAX_API_KEY` értékére futtatott szöveges keresés nulla találatot ad, és minden rögzített `authorization` és `x-api-key` header értéke `REDACTED`.
5. A `.gitignore` kizárja a proxy naplóját és a `.env` fájlt, a maszkolt artefaktumok viszont commitolva vannak.
6. A `ProviderCapabilityDescriptor` típus szigorú TypeScript beállítással fordul, nincs benne `any`, nincs `as`, a leíró objektum `satisfies` operátorral kapcsolódik.
7. A `Fact<T>` `known` ága nem üres bizonyítéklistát követel a típusrendszer szintjén, tehát bizonyíték nélküli `known` mező nem fordul le. Ezt egy szándékosan hibás minta fordítási hibája igazolja.
8. Az `isKnown` typeguard nélkül a `value` mező nem olvasható, ezt a típusellenőrző igazolja.
9. Minden `evidence` elem feloldható: a `measurement` típusú hivatkozás létező M azonosítóra mutat a 4. szekcióban, a `doc` típusú elérhető URL-re, a `research` típusú a research fájl létező szekciójára.
10. A kitöltött `minimax` leíróban egyetlen mező sem `known` állapotú a 4. szekció szerint méréssel eldöntendő kérdésekben, amíg a hozzá tartozó mérés le nem zárult.
11. A `structuredOutput.defaultStrategy` értéke M-02, M-03 és M-10 eredményére hivatkozik, nem feltételezésre. Ha mindkét stratégia használhatatlan, ez a mező `unknown` marad, és a spec eredménye az, hogy a `minimax` provider strukturált kimenetre nem alkalmas.
12. A `requiredEnv` lista minden eleme M-08 vagy M-14 diff táblázatának egy sorára hivatkozik, vagy a research fájl megerősített tényére.

## 7. Kockázatok és amit nem tudunk lezárni ebben a specben

| Kockázat                                                                                                                 | Hatás                                                 | Kezelés                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A proxy közbeiktatása megváltoztatja a transzport paramétereket (protokoll verzió, tömörítés, kapcsolat újrahasznosítás) | a mért viselkedés eltérhet a proxy nélkülitől         | a `meta.json` rögzíti a transzport jellemzőit; a kritikus eseteket proxy nélkül, csak a HTTP kód szintjén ellenőrizzük                                                                                                   |
| Az SDK verzió frissítése bővíti a body mezőlistát                                                                        | a lezárt Q kérdések újranyílnak                       | `sdkVersionPin` a leíróban, és minden SDK frissítés előtt a teljes M-01 ... M-18 sor újrafuttatása                                                                                                                       |
| A MiniMax szerver oldalon változtat, dokumentáció nélkül                                                                 | a leíró csendben elavul                               | a `measuredAt` mező és a mérés újrafuttathatósága; a Kapcsolat teszt gomb eltérés esetén jelez                                                                                                                           |
| A `claude-subscription` provider drótszinten nem mérhető ezzel az eszközzel                                              | erre a providerre nincs azonos minőségű bizonyíték    | ott a leíró az SDK oldali `SDKMessage` folyamból és a hivatalos dokumentációból töltődik, és ezt az `evidence` mező típusa megkülönbözteti                                                                               |
| Ha a mérés alatt nem keletkezik 429-es válasz                                                                            | a rate limit headerek ismeretlenek maradnak           | a mező `unknown` marad, szándékos rate limit kimerítést ebben a specben nem végzünk -- a Task #31 (M-37 ... M-39, `docs/research/2026-08-28-parhuzamossagi-korlat.md`) ezt a döntést önálló, célzott méréssel írja felül |
| A `[1m]` suffix a research szerint a Claude Code kliens konvenciója, nem MiniMax paraméter                               | nem tudjuk, hogy az SDK ugyanúgy kezeli-e, mint a CLI | M-11 méri, de ha az SDK-ban egyáltalán nem értelmezett, a kérdés a CLI-re nyitva marad                                                                                                                                   |
| A tool-láncban a modell nem adja tovább megbízhatóan az előző tool kimenetét (M3)                                        | hosszú workflow-k adatátadása romolhat                | ez viselkedésbeli megbízhatóság, nem drótszintű kérdés, ebben a specben nem zárható le, külön mérés kell                                                                                                                 |
| Végtelen retry loop timeoutnál                                                                                           | a mérés beragadhat                                    | a proxy nem retry-zik, és minden futásra felső időkorlát van, aminek az értéke a `meta.json`-ba kerül                                                                                                                    |
| Az `Options.effort` és `Options.thinking` enum értékei nincsenek a research fájlban                                      | a mérés előtt nem definiálható a pontos beállítás     | a mérés előtt a telepített SDK típusdefiníciójából kell kiolvasni, és a `meta.json`-ba rögzíteni                                                                                                                         |
