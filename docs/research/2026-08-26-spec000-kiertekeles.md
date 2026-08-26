# SPEC-000 kiértékelés: Q1-Q12 lezárása

|             |                                                                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dátum       | 2026-08-26                                                                                                                                                                                                                                                      |
| Bemenet     | [`2026-08-26-agent-sdk-minimax.md`](2026-08-26-agent-sdk-minimax.md) 4. szekció, [`SPEC-000`](../spec/SPEC-000-provider-wire-measurement.md), [`mérési jegyzőkönyv`](2026-08-26-spec000-meresi-jegyzokonyv.md)                                                  |
| Kimenet     | `src/providers/*.ts` képességleírók                                                                                                                                                                                                                             |
| SDK         | `@anthropic-ai/claude-agent-sdk@0.3.245`, CLI `cc_version=2.1.245` (a billing headerből)                                                                                                                                                                        |
| Mérési alap | M-01 ... M-18: 113 rögzített proxy tranzakció, ebből 79 `POST /v1/messages` (mind HTTP 200) és 34 `HEAD /api/hello` (mind HTTP 404). M-19 ... M-25: külön munkamenet, lásd a 3. szekciót. M-26 ... M-36: harmadik munkamenet, 50 tranzakció, lásd a 6. szekciót |

A jegyzőkönyv nyers megfigyeléseit nem ismétlem meg, csak hivatkozom rájuk. Ahol a jegyzőkönyvön
túl saját artefaktum-ellenőrzést végeztem, azt a "saját ellenőrzés" jelölés mutatja.

Lezárva mind a 12 kérdés (Q1 ... Q12). Az M-19 ... M-25 kiegészítő mérések a két utolsó nyitott
kérdést (Q8, Q11) is lezárták, lásd a 3. szekciót. Az M-26 ... M-36 kör a felhasználó tényleges
indító parancsának env változóit mérte, a 4. szekció nyitott mezői közül kettőt lezárt
(`toolChoice.rejectionBehaviour`, `listedByModelsEndpoint`), a maradék háromnak pontosította az
indoklását, és négy új leíró mezőt hozott be, lásd a 6. szekciót. Ami a leíróban `unknown` maradt, az nem kérdés-szintű, hanem mezőszintű hiány, a 4. szekció sorolja fel a blokkoló megnevezésével.

---

## 1. Q1-Q12 lezárása

### Q1: az `outputFormat` szintetikus toolt injektál, vagy natív `output_config.format`-ot küld?

**Válasz: mindkét alak létezik a dróton, de eltérő célra. A felhasználói `outputFormat` kliens
oldali szintetikus toolként megy ki.**

| Alak                                                              | Hol jelenik meg                           | Séma forrása                     |
| ----------------------------------------------------------------- | ----------------------------------------- | -------------------------------- |
| `tools[].name = "StructuredOutput"`, `input_schema` = a kért séma | a fő kérésben, M-02 és M-03               | az `Options.outputFormat.schema` |
| natív `output_config.format.type = "json_schema"`                 | kizárólag a session cím generáló kérésben | fix `{title: string}` séma       |

Bizonyíték: M-02 fő kérés (`tools/wire-probe/artifacts/00006-1787706777349.json`). A tool leírása
szó szerint: `"Use this tool to return your final response in the requested structured format. You
MUST call this tool exactly once at the end of your response to provide the structured output."`
Az `input_schema` bájtra a case által kért `{label: string, count: number}` séma. A fő kérés
`output_config`-ja `{"effort":"high"}`, séma nélkül.

Saját ellenőrzés: a 79 `POST /v1/messages` közül 32 hordoz `output_config.format`-ot, és **mind a
32 esetben** a system prompt a `"You are naming a coding session"` szöveggel kezdődik, a `tools`
tömb üres. Egyetlen olyan kérés sincs, ahol a felhasználó által kért séma natív mezőben utazna.

**Tervezési következmény:** az `sdk_output_format` stratégia elvben járható MiniMax ellen, mert a
séma tool alakban megy ki, amit a MiniMax `tools` tömbje elfogad. A natív `output_config.format`
csak a cím generáló kérésben jelenik meg, és a MiniMax azt HTTP 200-zal, csendben eldobva
fogadja (lásd 2. szekció).

### Q2: használ-e az SDK kényszerített `tool_choice`-t?

**Válasz: nem. Kényszerített érték a teljes mérésben egyszer sem ment ki.**

Saját ellenőrzés a 79 `POST /v1/messages` teljes halmazán: `tool_choice` kulcs **4 kérésben** van
jelen, mind a négy értéke szó szerint `{"type":"auto"}`, és mind a négy a `WebSearch` tool belső
alkéréseihez tartozik (M-17: `00019-1787707009344.json`, `00022-1787707027097.json`,
`00023-1787707027740.json`, `00024-1787707027963.json`). `{"type":"any"}` és
`{"type":"tool","name":...}` alak nem fordul elő. A jegyzőkönyv M-03-ra állapította meg a
`tool_choice` hiányát; a teljes halmazon a kép ennyiben pontosabb, de a következtetés ugyanaz.

**Kulcsbizonyíték a záró fázisra:** az M-03 futás `result` üzenete `subtype: success`,
`num_turns: 4`, és tartalmaz kitöltött `structured_output` mezőt:
`{"label":"echo teszt result: identity function, returned input unchanged","count":1}`
(`tools/wire-probe/artifacts/harness/M-03/a.sdk-messages.ndjson`). Tehát az `outputFormat`
stratégia MiniMax ellen **végigfutott**, kényszerítés nélkül, pusztán a tool leírásában lévő
"MUST call this tool" utasítás erejével.

**Tervezési következmény:** a MiniMax `auto`/`none` enum korlátja nem blokkolja az SDK-t, mert az
SDK sosem lép ki ebből a halmazból. A `toolChoice.sdkSendsForcedChoice` mező `false`.

### Q3: kimegy-e `output_config` `effort` beállítás nélkül is?

**Válasz: igen, mindig. A 79 kérésből 79 hordoz `output_config`-ot.**

Saját ellenőrzés, `output_config` alakok eloszlása:

| Alak                                            | Darab      |
| ----------------------------------------------- | ---------- |
| `{"effort":"high"}`                             | 45         |
| `{"effort":"high","format":{...title séma...}}` | 32         |
| `{"effort":"low"}`                              | 1 (M-04 a) |
| `{"effort":"max"}`                              | 1 (M-04 b) |

Az `effort` **soha nem top-level kulcs**, mindig `output_config.effort`. Alapértéke `"high"` akkor
is, ha a case nem állít `effort`-öt. A cím generáló kérés `effort`-je akkor is `"high"`, ha a fő
kérésé `low` vagy `max` (M-04).

Az M-08 mind az öt env kapcsolója közül **egyik sem** vette le az `output_config` mezőt.

**Tervezési következmény:** a research által idézett
[GitHub #28](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/28) 400-as hiba **M3 ellen nem
reprodukálódott**: mind a 79 kérés HTTP 200. Az `output_config` nem blokkolja a MiniMax
használatát, de nincs rá kapcsoló sem, tehát ha a MiniMax a jövőben szigorít, nincs kliens oldali
kikerülés. Ez regressziós kockázat, nem jelenlegi hiba.

### Q4: milyen JSON-t küld az SDK `thinking` beállításokra?

**Válasz: `{"type":"adaptive"}` bekapcsolva, és a mező teljes hiánya kikapcsolva. `budget_tokens`
soha nem megy ki.**

| Beállítás                        | Kimenő `thinking`                                              | Eset         |
| -------------------------------- | -------------------------------------------------------------- | ------------ |
| nincs explicit `thinking` (alap) | `{"type":"adaptive"}` a fő kérésben, a cím kérésben nincs      | M-01         |
| `thinking: {type:'adaptive'}`    | `{"type":"adaptive"}`                                          | M-05         |
| `thinking: {type:'disabled'}`    | a kulcs **nem megy ki**                                        | M-06 a       |
| `MAX_THINKING_TOKENS=0`          | a kulcs **nem megy ki**, plusz `context_management` is eltűnik | M-06 b, M-08 |

Ez pontosan egyezik a hivatalos leírással: `"Set to 0 to disable thinking on the Anthropic API ...
on third-party providers, 0 omits the thinking parameter instead"`
(https://code.claude.com/docs/en/env-vars).

Stream oldal (M-05): `content_block_start` `{"type":"thinking"}` blokkal, `thinking_delta`
delták, záró `signature_delta`, `content_block_stop`. Egyezik a research 2. szekciójával.

**Tervezési következmény:** a `thinking` mező drótalakja a MiniMax `[disabled, adaptive]` enumján
belül van, `budget_tokens` nélkül. Nincs szükség kikerülésre. A `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`
továbbra is tiltott, mert az fix budget alakot kényszerítene.

### Q5: indít-e az SDK háttér modellhívást, és az mit küld?

**Válasz: igen. Minden `query()` egy session cím generáló kérést indít, ugyanarra a base URL-re,
ugyanazzal a modellel. Ez a mérés legfontosabb megfigyelése, külön szekciót kap (lásd 2.).**

Bizonyíték (saját ellenőrzés, `tools/wire-probe/artifacts/00002-1787706770143.json`): a kérés
system promptja szó szerint tartalmazza a `"You are naming a coding session so the user can pick
it out of a long list of sessions."` mondatot, a user üzenet `<session>...</session>` tagbe
csomagolja a felhasználói promptot, az `output_config.format.schema` pedig
`{"type":"object","properties":{"title":{"type":"string"}},"required":["title"],"additionalProperties":false}`.
A válasz szó szerint `{"title": "Kettő meg kettő kérdés"}` text blokkban, HTTP 200.

A `model` mező a cím kérésben is szó szerint `"MiniMax-M3"`, akkor is, ha
`ANTHROPIC_DEFAULT_HAIKU_MODEL` nincs beállítva (M-07 a, `meta.json` env blokkja ellenőrizve:
csak `ANTHROPIC_BASE_URL` és `ANTHROPIC_AUTH_TOKEN` van beállítva). **Alias modellnév a dróton
egyszer sem jelent meg**, a 79 kérés mind `"MiniMax-M3"`.

**Tervezési következmény:** az alias feloldó env változók (`ANTHROPIC_DEFAULT_HAIKU_MODEL` stb.)
ebben a konfigurációban **nem kötelezőek**, mert a fallback a session modelljére esik. Beállításuk
viszont ártalmatlan és védekezés a jövőbeli SDK viselkedésváltozás ellen.

### Q6: melyik env kapcsoló mit vesz le a bodyból?

**Válasz: mért mátrix, M-08 és M-14 kereszt-validálva.**

| Env változó                                  | kérésszám | eltűnő body kulcs                | eltűnő `anthropic-beta` elem                                                                          | egyéb                                                       |
| -------------------------------------------- | --------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`   | 2         | `context_management`             | `thinking-token-count-2026-05-13`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05` | `cache_control` marad 3                                     |
| `ENABLE_TOOL_SEARCH=false`                   | 2         | nincs                            | nincs                                                                                                 | nincs mérhető hatás                                         |
| `DISABLE_PROMPT_CACHING=1`                   | 2         | nincs                            | nincs                                                                                                 | `cache_control` 3 -> 0                                      |
| `MAX_THINKING_TOKENS=0`                      | 2         | `thinking`, `context_management` | **nincs**                                                                                             | aszimmetrikus pár                                           |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | **1**     | nincs                            | nincs                                                                                                 | a cím kérés eltűnik, `tools` 25 -> 24 (`DesignSync` kiesik) |

Két kiemelés:

1. **`MAX_THINKING_TOKENS=0` aszimmetrikus:** leveszi a `thinking` és `context_management` body
   mezőket, de a hozzájuk tartozó beta headereket a headerben hagyja. A research 3. szekciója
   szerint a fél pár kemény 400-at okoz. MiniMax ellen ez **nem okozott hibát** (HTTP 200), mert a
   MiniMax az ismeretlen headert eldobja. Egy szigorúbb gateway ellen ez 400 lenne.
2. **`ENABLE_TOOL_SEARCH=false` nem mérhető:** a hivatalos leírás szerint a tool search amúgy is
   ki van kapcsolva, ha `ANTHROPIC_BASE_URL` nem first-party hosztra mutat
   (https://code.claude.com/docs/en/env-vars), tehát a beállítás redundáns, nem hatástalan.

**Tervezési következmény:** a `minimax` provider `env` blokkjába kötelezően bekerülő elemek az
5.1 szekcióban. Az M-21 ezt a mátrixot egy sorral bővíti: a `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`
szintén 1 kérésre viszi le a kérésszámot, de a `tools` tömb nála 25 elemű marad (3. szekció).

### Q7: küld-e a MiniMax `input_json_delta`-t, és jól rakja-e össze az SDK?

**Válasz: igen és igen.**

M-09: a `content_block_start` `{"type":"tool_use"}` blokk `input` mezője a start pillanatában üres
objektum, majd `input_json_delta` delták érkeznek. A tool callback ténylegesen megkapott
argumentuma (`a.tool-callback-input.json`, 1960 karakteres `body` mezővel) és az
`sdk-messages.ndjson` assistant `tool_use` blokkjának `input` mezője JSON string szinten bájtazonos.

**Tervezési következmény:** a real-time transcript panel **építhet** a `stream_event` folyamra,
nem kell megvárnia a lezárt `assistant` üzenetet. Ez a UI szempontjából a legjobb kimenetel.

### Q8: működik-e a `Stop` hook `decision: "block"` kikényszerítés? LEZÁRVA

**Válasz: igen. Az M-19 10 futásból 10-ben aktiválta a blokkoló ágat, és a `reason` szöveg
`role: "user"` üzenetként megy ki, nem `system`-ként.**

M-10 önmagában nem tudta eldönteni: mindhárom futása sikeres volt (`subtype: success`,
`num_turns: 2`, 3-3 kérés), de a blokkoló ág egyszer sem aktiválódott, mert a prompt szó szerint
`"Számold ki mennyi 2+2, majd hívd meg a mcp__workflow__emit_output toolt az eredménnyel."`
(`tools/wire-probe/src/cases/M-10.ts`), tehát a modell utasításra hívta meg a toolt.

M-19 ugyanezt a hookot futtatta olyan prompttal, ami **nem említi** a toolt (`"Számold ki mennyi
2+2."`). Eredmény: 10/10 `success`, futásonként pontosan `blockCount=1`, és mind a 10 futás
`num_turns` értéke **3** (saját ellenőrzés a `run-1` ... `run-10.sdk-messages.ndjson` `result`
üzenetein), szemben az M-10 kikényszerítés nélküli 2 körével. A blokkolás tehát
determinisztikusan pontosan egy plusz modellkörbe kerül.

Drótszintű bizonyíték (saját ellenőrzés, `tools/wire-probe/artifacts/00004-1787737239994.json`):
a 3. kérés `messages` tömbje 4 elemű, az utolsó eleme szó szerint

```json
{
  "role": "user",
  "content": [
    {
      "type": "text",
      "text": "Stop hook feedback:\nAz emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel.",
      "cache_control": { "type": "ephemeral" }
    }
  ]
}
```

A Claude Code tehát `Stop hook feedback:` előtaggal, `user` role-lal továbbítja a hook `reason`
szövegét. A `role: "system"` mid-conversation üzenet külön kérdés, és a MiniMax M3 ellen az sem
hibázik: az M-10 run-1 2. és 3. kérésében a `messages` utolsó eleme `role: "system"` (az agent
típusok listája, illetve `<total_tokens>...</total_tokens>`), a válasz HTTP 200 (saját ellenőrzés:
`00003-1787706973670.json`, `00004-1787706975166.json`), az SDK a
`mid-conversation-system-2026-04-07` beta headert küldi hozzá. A research által idézett
[GitHub #43](https://github.com/MiniMax-AI/MiniMax-M2.7/issues/43)
`invalid message role: system (2013)` hiba M3 ellen nem reprodukálódott.

**Tervezési következmény:** az `emit_output_tool` stratégia `usable` mezője `known: true`,
`blockingWireDetail` mezője `known: null`, `observedRoundTrips` mezője `known: [3]`. A stratégia
tehát bizonyítottan használható, de az alapértelmezés így is az `sdk_output_format` marad, lásd
5.2. A `role: "system"` kockázat ezt a stratégiát fel sem tudja érinteni, mert a hook szövege
`user` role-lal utazik.

### Q9: leválasztja-e a kliens a `[1m]` suffixet?

**Válasz: igen, a dróton, de a suffixnek két érdemi kliens oldali hatása van.**

|                                          | `model: 'MiniMax-M3[1m]'`                    | `model: 'MiniMax-M3'` |
| ---------------------------------------- | -------------------------------------------- | --------------------- |
| wire `model` mező                        | `"MiniMax-M3"`                               | `"MiniMax-M3"`        |
| `anthropic-beta`                         | tartalmazza a `context-1m-2025-08-07` elemet | nem tartalmazza       |
| kliens oldali `modelUsage.contextWindow` | **1000000**                                  | **200000**            |
| `modelUsage.maxOutputTokens`             | 32000                                        | 32000                 |
| HTTP kód                                 | 200                                          | 200                   |

Saját ellenőrzés a `result` üzenet `modelUsage` mezőjéből (`M-11/a-with-suffix.sdk-messages.ndjson`
kontra `b-without-suffix`). Ez a hivatalos leírással egyezik: `"If the ID doesn't start with
claude- but contains [1m], in any casing, and Claude Code can't resolve it to a Claude model,
Claude Code assumes a 1M window for it"` (https://code.claude.com/docs/en/model-config).

**Tervezési következmény:** a suffix nem 404 kockázat, hanem a kontextusablak kliens oldali
vezérlője. Ha 1M kontextussal akarunk dolgozni, a `[1m]` suffixes azonosítót kell a modellnek
átadni. A SPEC-000 hatóköre szerint a `minimax` leíró modell-listája kizárólag `MiniMax-M3`, ezért
a suffix használata külön döntés, lásd 5.1. Az M-20 után ez a döntés megszületett: a suffixes
azonosítót használjuk.

### Q10: mit ad vissza a `GET /v1/models` a MiniMax endpointon?

**Válasz: nem tudjuk, mert az SDK egyszer sem hívta meg.**

A teljes mérés 113 tranzakciójában kizárólag két útvonal fordul elő: `POST /anthropic/v1/messages`
(79x, HTTP 200) és `HEAD /anthropic/api/hello` (34x, HTTP 404). Sem `GET /v1/models`, sem
`POST /v1/messages/count_tokens` nem ment ki, M-12 saját futása alatt sem.

A `supportedModels()` visszatérése **helyi adat**: a listában `default`, `opus[1m]`, `sonnet`,
`sonnet[1m]`, `haiku` és `MiniMax-M3` szerepel, ahol a `default` `resolvedModel` mezője
`claude-opus-5[1m]`, tehát a lista a helyi Claude Code konfigurációt tükrözi, nem a MiniMax
endpointot. A `MiniMax-M3` bejegyzés `description` mezője `"Custom model"`.

**Tervezési következmény:** a "Kapcsolat teszt" gomb **nem tölthet modell-listát** a
`supportedModels()`-ből, mert az a felhasználó helyi Claude Code beállításait keveri be. A
modell-listát a provider config fájlba kell drótozni. A kapcsolat teszt maga egy minimális
`query()` hívás lehet, mert az SDK csak `POST /v1/messages`-t használ. A `HEAD /api/hello` 404
nem hiba: a MiniMax nem implementálja, és ez nem akadályozza a működést.

### Q11: mekkora kontextusablakot jelent az endpoint, mikor indul auto-compact? LEZÁRVA

**Válasz: a kliens 200 000 / 32 000 értékkel tervez, a szerver viszont bizonyítottan legalább
1 046 827 bemeneti tokent szolgál ki. A kliens oldali max output token 128 000-nél elvágódik.**

Kliens oldal (saját ellenőrzés az összes `result.modelUsage` mezőn, 33 futás):
`contextWindow: 200000`, `maxOutputTokens: 32000`, `canonicalModel: "minimax-m3"`,
`provider: "firstParty"`. A kimenő body `max_tokens` mezője az M-01 ... M-18 sorozat **mind a 79
kérésében 32000**. Ez a dokumentált viselkedés: `"Claude Code defaults to 32000 for model IDs it
doesn't recognize, such as gateway-specific names, and lowers values above a model's cap to the
cap"` (https://code.claude.com/docs/en/env-vars, `CLAUDE_CODE_MAX_OUTPUT_TOKENS`).

Szerver oldal (M-20, `model: 'MiniMax-M3[1m]'`, bináris keresés). Saját ellenőrzés a rögzített
tranzakciók `message_delta.usage` objektumán. A "teljes bemeneti token" oszlop **számított
érték**: `usage.input_tokens` + `usage.cache_read_input_tokens`, mert a cache-ből olvasott tokenek
is a kontextusablakot foglalják.

| Töltelék karakter | `messages` karakter | HTTP    | `input_tokens` | `cache_read_input_tokens` | teljes bemeneti token     | karakter/token |
| ----------------- | ------------------- | ------- | -------------- | ------------------------- | ------------------------- | -------------- |
| 600 000           | 621 368             | 200     | 266 699        | 128                       | 266 827                   | 2,33           |
| 1 200 000         | 1 221 368           | 200     | 1 483          | 505 344                   | 506 827                   | 2,41           |
| 2 400 000         | 2 421 368           | 200     | 986 667        | 160                       | 986 827                   | 2,45           |
| 2 550 000         | 2 571 368           | 200     | 61 483         | 985 344                   | **1 046 827**             | 2,46           |
| 2 700 000         | -                   | **400** | -              | -                         | kb. 1 108 000 (számított) | -              |

Tranzakciók: `00003-1787737784634.json`, `00006-1787737788764.json`, `00009-1787737825279.json`,
`00023-1787737855251.json`. A 400-as válasz szövege szó szerint: `"API Error: 400 invalid params,
context window exceeds limit (2013)"`. A 2 700 000 karakteres sor token értéke **nem mért, hanem
számított**: a legnagyobb két sikeres kérésből adódó 2,46 karakter/token aránnyal skálázva.

Három számszerű következtetés:

1. A szolgáltatás **igazoltan kiszolgált 1 046 827 bemeneti tokent**. Ez a mért alsó korlát, nem a
   pontos határ: a valódi határ 1 046 827 és kb. 1 108 000 között van, a bináris keresés a
   `MAX_REQUESTS=8` korlát miatt állt le, nem konvergencia miatt.
2. Ez **5,2-szerese** annak a 200 000-es `contextWindow` értéknek, amivel a kliens suffix nélkül
   tervez. Suffix nélkül tehát az auto-compact a ténylegesen elérhető ablak kevesebb mint
   ötödénél indulna el, feleslegesen.
3. A `[1m]` suffixszel a kliens 1 000 000-rel tervez, ami már csak 4,5 százalékkal marad el a mért
   értéktől. **Figyelmeztetés:** az M-20 a `[1m]` suffixszel futott, tehát a
   `context-1m-2025-08-07` beta header jelen volt. Hogy a szolgáltatás e header nélkül is
   kiszolgálna-e 200 000 fölött, nem mértük.

Max output token (M-22, saját ellenőrzés a kimenő `max_tokens` mezőn):

| `CLAUDE_CODE_MAX_OUTPUT_TOKENS` | kimenő `max_tokens` | HTTP |
| ------------------------------- | ------------------- | ---- |
| 4096                            | 4096                | 200  |
| 32000                           | 32000               | 200  |
| 131072                          | **128000**          | 200  |
| 524288                          | **128000**          | 200  |

A vágás **kliens oldali**: a kérés HTTP 200-at kap, tehát nem a MiniMax utasítja el. A MiniMax
dokumentált 131 072 ajánlott és 524 288 hard output korlátja ezen az SDK verzión **nem érhető el**.

**Tervezési következmény:** a `models[MiniMax-M3].effectiveContextWindowOnWire` mező
`known: 1046827`, a `maxOutputTokensWireCeiling` mező `known: 128000`. A dokumentált 1 000 000
kontextus és 131 072 / 524 288 output korlát a leíróban megmarad, de mellette ott áll a mért
valóság. A modellazonosító megválasztása és a `CLAUDE_CODE_MAX_OUTPUT_TOKENS` kezelése: 5.1.

### Q12: küld-e az SDK `anthropic-beta` headert, és melyeket?

**Válasz: igen, kérésfajtánként eltérő listát.**

| Kérés               | `anthropic-beta` elemek                                                                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cím generáló (thin) | `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `thinking-token-count-2026-05-13`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05`, `mid-conversation-system-2026-04-07`, `effort-2025-11-24`, `structured-outputs-2025-12-15` |
| fő kérés            | ugyanaz, `structured-outputs-2025-12-15` nélkül                                                                                                                                                                                                              |
| `[1m]` suffixszel   | mindkettő plusz `context-1m-2025-08-07`                                                                                                                                                                                                                      |

`anthropic-version` minden kérésben `2023-06-01`, nem változik.

A `structured-outputs-2025-12-15` és `effort-2025-11-24` header nevek **az Anthropic saját
dokumentációjában nem szerepelnek** a jelenlegi beta enumban (ellenőrizve:
https://platform.claude.com/docs/en/api/models/list). A `context-1m-2025-08-07` viszont
dokumentált. Ez nem hiba, csak azt jelenti, hogy a két header a Claude Code kliens belső
konvenciója, és a body mezőpárjuk (`output_config.effort`, `output_config.format`) a stabil,
dokumentált felület.

**Tervezési következmény:** a MiniMax minden ismeretlen headert csendben eldob, HTTP 200. A
`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` szigorúbb gateway ellen lenne szükséges, MiniMax ellen
nem. Használatának ára viszont van: leveszi a `context_management` mezőt, ami az M3 interleaved
thinking takarítását végzi.

---

## 2. A két kérés jelensége

### Amit tudunk

Minden `query()` **két** különálló `POST /v1/messages`-t generál, kivéve ha
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` van beállítva.

Az első ("thin") kérés **bizonyítottan session cím generálás**. Nem következtetés, hanem a rögzített
artefaktum tartalma:

- system prompt: `"You are naming a coding session so the user can pick it out of a long list of
sessions. The title is a name for what the session is about, not a sentence describing the task:
a short noun phrase of two to five words..."`
- user üzenet: a felhasználói prompt `<session>...</session>` tagbe csomagolva
- `output_config.format.schema`: `{title: string}`, `additionalProperties: false`
- `tools: []`, üres tömb, de a kulcs jelen van
- válasz: `{"title": "Kettő meg kettő kérdés"}`

Ez konzisztens a hivatalos leírással: `ANTHROPIC_DEFAULT_HAIKU_MODEL` = `"The model to use for
haiku, or background functionality"` (https://code.claude.com/docs/en/model-config), és
`CLAUDE_CODE_DISABLE_TERMINAL_TITLE` = `"In Agent SDK and claude -p sessions, this also skips the
background small/fast-model request that generates the session title"`
(https://code.claude.com/docs/en/env-vars).

A minta mind a 32 cím kérésben azonos, és minden mérési esetnél megjelenik.

### Amit nem tudunk

| Kérdés                                                                 | Státusz                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` valóban leveszi-e MiniMax ellen | **igen, M-21 mérte.** 2 helyett 1 kérés megy ki. A `DesignSync` toolt viszont nem veszi le, ezért mégsem ezt a kapcsolót választjuk, lásd 5.1                                                                                                    |
| miért veszi le a `NONESSENTIAL_TRAFFIC` is a cím kérést                | a hivatalos leírás felsorolása (auto-update, telemetria, error reporting, `/feedback`, release notes, gateway model discovery, availability check, feature flag) **nem említi** a cím generálást. A mért hatás tehát dokumentálatlan mellékhatás |
| indít-e az SDK más háttérhívást hosszabb sessionben                    | nem mértük. A `costs` doksi említ `"Conversation summarization"` háttérfeladatot a `--resume`-hoz, ez a mi 1-2 körös futásainkban nem aktiválódott                                                                                               |
| miért `MiniMax-M3` a cím kérés modellje                                | mért tény, hogy az, de a fallback szabály nincs dokumentálva. Ha egy jövőbeli SDK verzió `claude-haiku-*` alias nevet küldene ki, a MiniMax 404-et adna                                                                                          |

### Kockázat

| Kockázat          | Mértéke a mérésből                                                                                                                                                                                                                                                                                                                  |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Költség**       | minden `query()` +1 kérés. A 32 cím kérés mérhető input tokenje 799 körül van, output 15 körül. Egy hosszú workflow-ban lépésenként egy ilyen kérés, ez lineárisan skálázódik a lépésszámmal                                                                                                                                        |
| **Rate limit**    | az M3 dokumentált limitje 200 RPM. A cím kérés **duplázza** a kérésszámot, tehát a tényleges lépés-átbocsátás a fele a névlegesnek                                                                                                                                                                                                  |
| **Hibalehetőség** | ez az egyetlen kérés, ami natív `output_config.format` mezőt küld. A MiniMax M3 ma HTTP 200-zal fogadja, de a [GitHub #28](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/28) issue szerint pont ez a mező dobott 400-at. Ha a MiniMax M3-on is szigorít, **minden `query()` első kérése elhasal**, miközben a fő kérés jó lenne |
| **Adatszivárgás** | a felhasználói prompt teljes szövege kimegy egy második kérésben is. Ha valaha nem ugyanaz a provider szolgálja ki a háttérhívást, a prompt egy másik szolgáltatóhoz kerülne                                                                                                                                                        |

A hibalehetőség és a rate limit együtt indokolja, hogy a cím kérést a `minimax` providernél
alapból kikapcsoljuk.

---

## 3. Az M-19 ... M-25 kiegészítő mérések kiértékelése

Nyers megfigyelések: a [mérési jegyzőkönyv](2026-08-26-spec000-meresi-jegyzokonyv.md)
"M-19 - M-25 kiegészítő mérések" szakasza. Itt csak a kiértékelés áll.

### M-19: a `Stop` hook blokkoló ága működik, és `user` role-lal utazik

**Megfigyelés:** 10/10 futás `success`, futásonként pontosan egy blokkolás, mind a 10 futás
`num_turns` értéke 3.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-19/run-1.meta.json` ... `run-10.meta.json`
és a hozzájuk tartozó `.sdk-messages.ndjson` fájlok; drótszinten
`tools/wire-probe/artifacts/00004-1787737239994.json`.

**Következtetés és tervezési következmény:** lásd a lezárt Q8 blokkot az 1. szekcióban. Az
`emit_output_tool` stratégia mostantól bizonyított.

### M-20: a szolgáltatás legalább 1 046 827 bemeneti tokent szolgál ki

**Megfigyelés:** 2 550 000 karakternyi töltelékkel HTTP 200, 2 700 000 karaktertől
`400 invalid params, context window exceeds limit (2013)`.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-20/probe-1-chars600000.meta.json` ...
`probe-8-chars2550000.meta.json`, `search-state.json`; drótszinten
`00003-1787737784634.json`, `00006-1787737788764.json`, `00009-1787737825279.json`,
`00023-1787737855251.json`.

**Következtetés és tervezési következmény:** a részletes token átszámítás és a három számszerű
következtetés a lezárt Q11 blokkban van az 1. szekcióban. A lényeg: a mérés **karakterben** zárult
le, a leíróba **tokenben** számított érték került, és a nyers alap a `usage.input_tokens` plusz
`usage.cache_read_input_tokens` összeg.

### M-21: a célzottabb env kapcsoló kevesebbet vesz le, ezért nem ezt választjuk

**Megfigyelés:** `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` mellett 1 kérés megy ki 2 helyett (a
session cím generáló kérés eltűnik), de a `tools` tömb 25 elemű marad, benne a `DesignSync`
toollal. A `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` ugyanezt az 1 kérést hagyja meg, de a
`tools` tömb ott 24 elemű, `DesignSync` nélkül.

**Bizonyíték:** `tools/wire-probe/artifacts/00002-1787737359743.json` (M-21) kontra
`00030-1787706928603.json` (M-08 `NONESSENTIAL_TRAFFIC`) kontra `00003-1787706771598.json`
(M-01 alap). Saját ellenőrzés, `message_delta.usage.input_tokens`:

| Futás                                 | `tools` hossz | hiányzó tool | `input_tokens` |
| ------------------------------------- | ------------- | ------------ | -------------- |
| M-01 alap                             | 25            | -            | 26 339         |
| M-21 `DISABLE_TERMINAL_TITLE=1`       | 25            | -            | 26 693         |
| M-08 `DISABLE_NONESSENTIAL_TRAFFIC=1` | 24            | `DesignSync` | 24 022         |

**Mi az a `DesignSync`?** Saját ellenőrzés a tool leírásán (`00002-1787737359743.json`,
`tools[]`, `name: "DesignSync"`, 3 724 karakteres `description`): a tool a felhasználó
claude.ai/design design-system projektjeit olvassa és írja, **a felhasználó claude.ai
bejelentkezésén keresztül** (`list_projects`, `get_file`, `create_project`, `write_files`,
`delete_files` metódusokkal).

**Következtetés:** a `DesignSync` két okból nem kívánatos a `minimax` providernél. Egy: kérésenként
mért 2 317 input token pluszt jelent (26 339 mínusz 24 022), ami minden lépésre rárakódik. Kettő,
és ez a súlyosabb: egy harmadik fél modelljének adna a kezébe olyan toolt, ami a felhasználó
claude.ai fiókjában ír és töröl. A workflow futtatónak egyikre sincs szüksége.

A `DesignSync` eltűnése a `NONESSENTIAL_TRAFFIC` kapcsolónál **dokumentálatlan mellékhatás**: a
hivatalos leírás (https://code.claude.com/docs/en/env-vars) a kapcsolóhoz auto-update, telemetria,
error reporting, `/feedback`, release notes, gateway model discovery, availability check, plugin
`command` háttérfuttatás és feature flag lekérés letiltását sorolja fel, a
"Features that need feature-flag fetching" szekció felsorolása pedig **nem tartalmazza** a
`DesignSync` toolt. A hatás mért, nem dokumentált.

**Tervezési következmény:** a `minimax` provider env blokkjában marad a
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`. A `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` szigorúan
gyengébb: ugyanazt az egy hatást adja, a `DesignSync` levételét viszont nem. Részletes indoklás:
5.1.

### M-22: a kimenő `max_tokens` kliens oldalon 128 000-nél elvágódik

**Megfigyelés:** 4096 és 32000 változatlanul megy ki, 131072 és 524288 egyaránt 128000-re
képződik le, minden kérés HTTP 200.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-22/max-output-tokens-4096.meta.json` ...
`-524288.meta.json`; drótszinten `00004`/`00005`, `00007`/`00008`, `00010`/`00011`,
`00013`/`00014-1787737...json`.

**Következtetés:** a vágás kliens oldali, mert a kérés 200-at kap. A dokumentált szabály
(`"lowers values above a model's cap to the cap"`, https://code.claude.com/docs/en/env-vars) a
Claude Code **saját** modelltáblájának cap értékére vág, nem a provider dokumentált korlátjára:
a MiniMax dokumentált 131 072 ajánlott és 524 288 hard értéke ezen az SDK verzión elérhetetlen.

**Tervezési következmény:** `models[MiniMax-M3].maxOutputTokensWireCeiling` mező felvétele a
típusba, értéke `known: 128000`. Az env blokk ajánlása: 5.1.

### M-23: a képet az SDK kiküldi, a szolgáltatás dobja el

**Megfigyelés:** érvényes, 256x256 pixeles, tiszta piros PNG mellett is `"Nincs kép."` a válasz,
HTTP 200.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-23/a.meta.json`, drótszinten
`tools/wire-probe/artifacts/00003-1787737383569.json`. Saját ellenőrzés a kimenő body
`messages[0].content` tömbjén: **3 elemű**, és a harmadik eleme

```json
{
  "type": "image",
  "source": { "type": "base64", "media_type": "image/png", "data": "iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8x..." }
}
```

1 136 karakteres base64 adattal. A base64 dekódolva 851 bájt, érvényes PNG aláírással, az IHDR
chunk szerint 256x256, 8 bites, 2-es (truecolor RGB) színtípus, az első IDAT scanline pixelei
`255, 0, 0`.

**Következtetés, és ez a kulcs:** a kép content blokk **ott van a kimenő kérésben**. Nem az SDK és
nem a harness dobja el, hanem a szolgáltatás: a kérés HTTP 200-at kap, a modell mégis azt állítja,
hogy nincs kép. Ez gyökeresen más következtetés, mint amit az M-16 alapján lehetett volna levonni,
és a leíróban is máshogy jelöljük: nem `unknown` (nem tudjuk, mi történt), hanem `known: false`
(tudjuk, hogy a képbemenet ezen az úton nem működik).

**Tervezési következmény:** `models[MiniMax-M3].imageInput` mező `known: false`, bizonyíték M-23
és M-16. A kép csatolás UI vezérlő a `minimax` providernél letiltva, nem figyelmeztetéssel, hanem
véglegesen.

### M-24: a `stream` nem kapcsolható ki, de a cache írás máshonnan igazolódott

**Megfigyelés:** a kimenő body `stream` mezője mind a 4 kérésben `true`, és sem a
`message_start.message.usage`, sem a `message_delta.usage` objektum nem tartalmaz
`cache_creation_input_tokens` kulcsot.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-24/a-first.meta.json`,
`b-second-immediately-after.meta.json`. A telepített SDK típusa: saját ellenőrzés a
`tools/wire-probe/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` fájlon, az `Options`
típusban (1369. sor) **nincs `stream` mező**, a `stream` szó csak az `includeHookEvents`,
`includePartialMessages` és a `result` üzenet doksijában fordul elő, mind a kliens oldali
`SDKMessage` kiadásra vonatkozik.

**Következtetés, két részben.** Egy: `stream: false` kérés ezzel az SDK verzióval nem állítható
elő, tehát a nem stream `usage` objektum ezen az úton **elvi okból** megfigyelhetetlen. A
`promptCaching.usageFields` mező ezért marad `['cache_read_input_tokens']`, és ez nem a mérés
hiánya, hanem az SDK felületének korlátja.

Kettő, és ez az M-24 legfontosabb hozadéka: a cache írás igazolásához **nem is kellett** a nem
stream `usage`. Az M-20 bináris keresés véletlenül megadta. A 8. probe (`00023-1787737855251.json`)
`cache_read_input_tokens` értéke **985 344**, közvetlenül a 7. probe után, ami majdnem azonos
prefixű töltelékkel futott. Ekkora cache olvasás csak úgy állhat elő, ha a megelőző kérés beírta a
cache-t. A cache írás tehát megtörténik, csak a szolgáltatás nem jelenti külön mezőben.

Ami továbbra sem eldönthető: hogy az **explicit** `cache_control` breakpointoknak van-e önálló
hatásuk. Az M-15 (c) futásban nulla `cache_control` blokk mellett is `cache_read_input_tokens: 128`
jött vissza, ami implicit cache olvasást bizonyít, viszont a `cache_read` érték 3 és 0 breakpoint
mellett **azonos** volt.

**Tervezési következmény:** új `streaming.streamDisableable` mező a típusban, értéke `known: false`
mindkét providernél (SDK szintű tulajdonság). A `promptCaching.mode` mező `unknown` marad, de az
indoklás megváltozik: már nem a cache írás bizonyítatlansága a blokkoló, hanem az implicit és az
explicit mód szétválaszthatatlansága.

### M-25: a szerver oldali `web_search` valóban nem fut le

**Megfigyelés:** `maxTurns: 12` mellett a futás `result` subtype-ja `success` (nem
`error_max_turns`), 7 kérés ment ki, mind HTTP 200, és egyik stream válaszban sincs
`server_tool_use` vagy `web_search_tool_result` blokk.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-25/a.meta.json`, drótszinten
`00002-1787737402733.json` ... `00008-1787737418290.json`. Saját ellenőrzés: a 7 tranzakció
`streamEvents` mezőjében a `server_tool_use` és a `web_search_tool_result` alstring előfordulása
**0**. Három kérés `tools` tömbje egyetlen elemű, `web_search_20250305` típussal.

**Következtetés:** az M-17-nél megfigyelt hiányzó eredményblokk **nem** a `maxTurns: 3` korai
megszakítása miatt volt. A MiniMax a `web_search_20250305` szerver oldali toolt elfogadja a
kérésben, de sosem futtatja le.

**Tervezési következmény:** a `serverTools[web_search].available` mező `known: false` marad, most
már M-17 és M-25 bizonyítékkal. Az 5.4 szekció `WebSearch` tiltása változatlanul érvényes, immár
kereszt-validált alapon.

---

## 4. Ami továbbra is nyitva marad

Kérdés szinten nincs nyitott tétel: Q1 ... Q12 mind lezárt. Ami nyitva maradt, az mezőszintű, és a
leíróban `unknown` állapotban van, a blokkoló megnevezésével. Az M-26 ... M-36 kör ebből a
listából kettőt lezárt: a `toolChoice.rejectionBehaviour` mezőt az M-34 (`known: 'silently_dropped'`,
6.9), a `models[MiniMax-M3].listedByModelsEndpoint` mezőt pedig az M-35 (`known: true`, 6.10).
Mindkettőt SDK-n kívüli, közvetlen HTTP hívás zárta le, tehát a korábbi "a SPEC-000 hatókörén
kívül" indoklás megszűnt: a spec 4. szekciója az M-34 és M-35 esetekkel bővült.

| Leíró mező                                                          | Mi hiányzik pontosan                                                                                                                                                                                                                              | Miért nem pótolható a jelenlegi eszközzel                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `promptCaching.mode`                                                | annak eldöntése, hogy az explicit `cache_control` breakpointoknak van-e a jelentett `cache_read_input_tokens` értékben megjelenő önálló hatásuk. Az implicit olvasás (M-15 c) és a cache írás (M-20 8. probe) igazolt, a kettő szétválasztása nem | a szolgáltatás egyetlen mért válaszban sem küld `cache_creation_input_tokens` mezőt, az SDK `Options` típusa pedig nem enged `stream: false` kérést (M-24), tehát nincs olyan `usage` objektum, amiben a cache írás külön látszana. Az M-33 a hívó fél saját töréspontjával sem tudta szétválasztani a két módot: a `cache_read` mind a három futásban 128 |
| `models[MiniMax-M3].videoInput`                                     | egy kimenő videó content blokk és a rá adott válasz                                                                                                                                                                                               | a blokkoló a telepített SDK típusfelülete, nem a szolgáltatás: a `ContentBlockParam` unióban nincs videó variáns, az `ImageBlockParam.source.media_type` pedig zárt unió, és a projekt tiltja az `any` és `as` használatát (6.12). Lezárná: egy videó variánst is tartalmazó SDK verzió és az arra épített, M-23 mintájú mérés                             |
| `rateLimits.retryAfterHeader`, `rateLimits.rateLimitHeaders`        | egy 429-es válasz és a hozzá tartozó headerek                                                                                                                                                                                                     | két független körben (M-18: 113 tranzakció, M-36: 50 tranzakció) nulla 429 és nulla 5xx keletkezett. Szándékos rate limit kimerítést **nem végzünk**, ez döntés, nem hiány                                                                                                                                                                                 |
| `claude-subscription` minden drótszintű mezője                      | drótszintű mérés a first-party úton                                                                                                                                                                                                               | a SPEC-000 1. szekciója szerint ez a provider nincs hatókörben: first-party base URL-t és bejelentkezésen alapuló hitelesítést használ, a logoló proxy nem iktatható be                                                                                                                                                                                    |
| `claude-subscription` `models[claude-opus-5].clientModelIdentifier` | az, hogy a puszta azonosító vagy a `[1m]` suffixes alak adja-e a leíróban szereplő 1M ablakot                                                                                                                                                     | az Opus 1M ablaka előfizetés függő (Max, Team és Enterprise csomagon automatikus, Pro csomagon usage credit kell), tehát a válasz fiókfüggő, és first-party úton nem mértük a kliens által feltételezett `contextWindow` értéket                                                                                                                           |

Három olyan tétel, ami nem leíró mező, de nyitva maradt, és a jövőbeli regressziónál számít:

1. **A kontextusablak pontos határa.** A bináris keresés a `MAX_REQUESTS=8` kemény korlát miatt
   állt le, 150 000 karakternyi rés maradt a legnagyobb sikeres (2 550 000) és a legkisebb hibás
   (2 700 000) méret között. A leíróban ezért a mért **alsó korlát** áll, nem a határ.
2. **A `context-1m-2025-08-07` beta header szerepe.** Az M-20 a `[1m]` suffixszel futott, tehát
   ezzel a headerrel. Hogy a szolgáltatás e header nélkül is kiszolgálna-e 200 000 fölött, nem
   mértük. Ez azért fontos, mert az 5.1 ajánlás a suffixes modellazonosítóra épül.
3. **A `CLAUDE_CODE_MAX_CONTEXT_TOKENS` alternatíva.** A hivatalos leírás szerint suffix nélküli,
   fel nem oldható modellazonosítónál ez a változó közvetlenül állítja a feltételezett ablakot,
   suffixes azonosítónál viszont önmagában nem hat
   (https://code.claude.com/docs/en/model-config). Elvben ez pontosabb lenne a `[1m]` suffixnél,
   de nem mértük, és a deklarálandó számra csak mért alsó korlátunk van. Részletek: 6.4.

---

## 5. Tervezési következmények

### 5.1 A `minimax` provider kötelező `env` blokkja és a modellazonosító

**Ez a végleges env blokk.** Az M-26 ... M-36 kör a felhasználó indító parancsának mind a 12
változóját megmérte, és **egyetlen új változót sem tett kötelezővé**: amelyiknek volt mérhető
hatása, az vagy már bent volt, vagy a hatása nem indokolja a beállítást. A körönkénti indoklás a 6. szekcióban áll, az összesítés az alábbi második táblázatban.

| Változó                                    | Érték                                                                | Miért                                                                                                                                                                                                                                                                                                                                                                   | Bizonyíték                |
| ------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `ANTHROPIC_BASE_URL`                       | `https://api.minimax.io/anthropic`                                   | endpoint                                                                                                                                                                                                                                                                                                                                                                | research 2. szekció       |
| `ANTHROPIC_AUTH_TOKEN`                     | `MINIMAX_API_KEY` process env átvétel, **csak a NÉV perzisztálódik** | auth                                                                                                                                                                                                                                                                                                                                                                    | research 2. és 3. szekció |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1`                                                                  | levette a session cím generáló kérést, ezzel felezi a kérésszámot és megszünteti az egyetlen natív `output_config.format` kockázatot, **ezen felül a `DesignSync` toolt is**. A hivatalos felsorolás szerint a "gateway model discovery" letiltása is idetartozik, ami egybevág azzal, hogy a mérés alatt egyetlen `GET /v1/models` sem ment ki az SDK-tól (M-12, M-36) | M-07 b, M-08, M-21, M-35  |
| `DISABLE_PROMPT_CACHING`                   | **nem állítjuk be**                                                  | a `cache_control` blokkok kimennek és a MiniMax fogadja őket, a cache olcsóbbá teszi a hosszú workflow-t. Az M-33 óta azt is tudjuk, hogy a kapcsoló amúgy sem venné le a saját, kézzel rakott töréspontjainkat, csak az SDK sajátjait                                                                                                                                  | M-08, M-15, M-20, M-33    |

Modellazonosító, nem env változó, de a config blokk része: `Options.model` értéke
`MiniMax-M3[1m]` (lásd lent és 6.4). A dróton ebből `MiniMax-M3` lesz.

**A felhasználó indító parancsának 12 változója, mezőnként, a mi döntésünkkel:**

| Változó                                                          | Mért hatás                                                                                           | Döntés és indok                                                                                                                                                                              |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_BASE_URL`                                             | endpoint                                                                                             | **kell**, ez a provider definíciója                                                                                                                                                          |
| `ANTHROPIC_AUTH_TOKEN`                                           | auth                                                                                                 | **kell**, csak a név perzisztálódik                                                                                                                                                          |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`                     | 2 kérés helyett 1, `tools` 25 helyett 24 (M-08, M-21, M-32)                                          | **kell**, lásd fent                                                                                                                                                                          |
| `ANTHROPIC_MODEL=MiniMax-M3[1m]`                                 | a kliens ebből is feloldja a modellt, `Options.model` nélkül is, a suffix ugyanúgy hat (M-32)        | **nem kell**, mert az `Options.model` utat használjuk: a lépés szintű modellfelülírás így hívási paraméter, nem env manipuláció. Az M-32 igazolja, hogy az env út is járható, ha valaha kell |
| `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_OPUS_MODEL` | a dróton alias modellnév egyszer sem jelent meg (M-05, M-07, M-29)                                   | **nem kell**, a fallback a session modelljére esik. Beállításuk ártalmatlan, védekezés jövőbeli SDK viselkedésváltozás ellen                                                                 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL=MiniMax-M3`                       | a háttérkérésből kimarad a `context-1m-2025-08-07` header, ha itt suffix nélküli az azonosító (M-29) | **nem kell**, mert a háttérkérést a `NONESSENTIAL_TRAFFIC` kapcsoló amúgy is levágja. Ha valaki mégis beállítja, suffixszel tegye, különben a két kérés eltérő ablak feltételezéssel fut     |
| `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1`                             | **semmilyen drótszintű eltérés**, a body bájtazonos (M-26)                                           | **nem kell**, hatástalan ezen a kliensverzión, M3 ellen (6.1)                                                                                                                                |
| `CLAUDE_CODE_DISABLE_FAST_MODE=1`                                | drótszinten semmi, kliens oldalon sűrűbb `SDKMessage` folyam (M-27)                                  | **nem kell**, drótszintű hatása nincs (6.2)                                                                                                                                                  |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50`                             | nem figyelhető meg, a session meg sem közelítette a küszöböt (M-28)                                  | **nem kell**, mérhető hatás nélkül nem állítunk be értéket (6.3)                                                                                                                             |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000`                        | ugyanaz, a `contextWindow: 1000000` a `[1m]` suffixből jön, nem ebből (M-28)                         | **nem kell**, a kontextusablakot a modellazonosító állítja (6.3)                                                                                                                             |
| `API_TIMEOUT_MS=3000000`                                         | `x-stainless-timeout` 600 helyett 3000 (M-30)                                                        | **nem kell**, nincs mérés a 10 perces alapérték elégtelenségéről, és megalapozatlan értéket nem javaslunk (6.5)                                                                              |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3`                         | a korlát tartott, a kimenő kérésszám csúcsa 4 (M-31)                                                 | **nem kell a provider blokkban**, mert nem provider tulajdonság: a workflow motor párhuzamosság kezeléséhez tartozik (5.6)                                                                   |

**Az env blokk végső döntése: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, nem
`CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`.** A célzottabb kapcsoló ugyanazt az egy hatást adja
(a cím kérés eltűnik), de szigorúan kevesebbet: a `DesignSync` tool nála bent marad a `tools`
tömbben. Az M-21 mért különbsége kérésenként 2 317 input token (26 693 kontra 24 022), és a
`DesignSync` az a tool, ami a felhasználó claude.ai fiókjában olvas, ír és töröl a felhasználó
bejelentkezésén keresztül. Egy harmadik fél modelljének ilyen toolt átadni nem indokolható, a
workflow futtatónak pedig nincs rá szüksége. Részletes elemzés: 3. szekció, M-21.

Az ára: a `NONESSENTIAL_TRAFFIC` a dokumentáció szerint auto-update, telemetria, error reporting,
`/feedback`, release notes, gateway model discovery, availability check, plugin `command`
háttérfuttatás és feature flag lekérés letiltását is magával hozza
(https://code.claude.com/docs/en/env-vars). Headless workflow futtatóban ezek egyike sem kell.

**Modellazonosító: `MiniMax-M3[1m]`.** A suffix nem 404 kockázat, mert a kimenő body `model`
mezője mindkét esetben `MiniMax-M3` (M-11, M-29, M-32), viszont a kliens oldali `contextWindow`
értéket 200 000-ről 1 000 000-re emeli. Az M-20 mérés szerint a szolgáltatás legalább 1 046 827
bemeneti tokent kiszolgál, tehát suffix nélkül az auto-compact a ténylegesen elérhető ablak
kevesebb mint ötödénél indulna el. Egy nyitott kockázat marad: az M-20 a suffixszel, tehát a
`context-1m-2025-08-07` beta header jelenlétében futott, a header nélküli viselkedést nem mértük
(4. szekció, 2. pont).

**A config réteg két azonosítót tárol.** Az M-29 megmutatta, hogy a suffix feloldása kérésenként
történik, és nem a `model` stringen jelenik meg, hanem a beta headeren (6.4). Ezért a leíróban a
wire azonosító (`models[].id = 'MiniMax-M3'`, ez szerepel a `GET /v1/models` listában is, M-35) és
a kliensnek átadott azonosító (`models[].clientModelIdentifier = 'MiniMax-M3[1m]'`) külön mező. A
UI és a perzisztencia a wire azonosítót mutatja, a kliensnek a suffixes alak megy. A dokumentált
alternatívát (`CLAUDE_CODE_MAX_CONTEXT_TOKENS` suffix nélküli azonosítóval) a 6.4 szekció írja le,
azt mérés nélkül nem vezetjük be.

**Amit szándékosan nem teszünk bele:**

- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`: MiniMax ellen nincs rá szükség (minden kérés 200),
  viszont levenné a `context_management` mezőt, ami az M3 interleaved thinking takarítását végzi.
- `MAX_THINKING_TOKENS=0`: aszimmetrikus (body mezőt vesz le, headert nem), és kikapcsolná az M3
  adaptív thinkingjét.
- `ENABLE_TOOL_SEARCH=false`: mérhetetlen hatás, custom base URL mellett amúgy is kikapcsolt.
- `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1`: szigorúan gyengébb a fenti kapcsolónál, lásd fent.
- `CLAUDE_CODE_MAX_OUTPUT_TOKENS`: **alapból nem állítjuk be**, marad a kliens 32 000-es
  alapértéke. Ha egy lépésnek hosszú kimenet kell, a mérésből az adódik, hogy **128 000 fölé nincs
  értelme állítani**: 131 072 és 524 288 egyaránt 128 000-re vágódik a dróton (M-22). Ez nem
  ingyenes: a hivatalos leírás szerint `"Increasing this value reduces the effective context
window available before auto-compaction triggers"`
  (https://code.claude.com/docs/en/env-vars), tehát a nagyobb output a kontextusablakból vesz el.
- Alias feloldó változók (`ANTHROPIC_DEFAULT_HAIKU_MODEL` stb.): nem kötelezőek, mert a dróton
  soha nem jelent meg alias név. Ha mégis beállítja valaki, a suffixet ott is tartani kell (M-29).
- `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT`, `CLAUDE_CODE_DISABLE_FAST_MODE`,
  `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `API_TIMEOUT_MS`,
  `ANTHROPIC_MODEL`: mind a hat mérve (M-26 ... M-32), és egyik sem indokolja a beállítást. A
  mezőnkénti indoklás a fenti második táblázatban áll.
- `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY`: nem állítjuk be. A modell-listát saját HTTP
  hívással kérjük le (5.3, 6.10), nem a kliens `/model` választóján keresztül, és a kötelező
  `NONESSENTIAL_TRAFFIC` kapcsoló amúgy is letiltja.

**Tiltott változók** (research 3. szekció): `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING`,
`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`.

### 5.2 Alapértelmezett strukturált kimenet stratégia

**Mindkét stratégia bizonyítottan használható. Az alapértelmezés így is `sdk_output_format`.**

|                                      | `sdk_output_format`                                                        | `emit_output_tool`                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| végigfutott MiniMax ellen            | **igen**, M-03, `subtype: success`, kitöltött `structured_output`          | **igen**, M-19, 10/10 futás `success`                                             |
| kikényszerítés bizonyított           | nem is kell, a tool leírása elég                                           | **igen**, M-19: 10/10 futásban aktiválódott a `decision: "block"` ág              |
| megfigyelt körszám                   | `num_turns: 4` (M-03)                                                      | `num_turns: 3`, ebből 1 kör kizárólag a hook blokkolása (M-19 kontra M-10 2 köre) |
| kényszerített `tool_choice` kimegy-e | nem, 79/79 kérésben                                                        | nem releváns                                                                      |
| séma validáció                       | az SDK végzi, `error_max_structured_output_retries` result subtype létezik | saját kód                                                                         |
| `role: "system"` kockázat            | nem érinti                                                                 | nem érinti: a hook `reason` szövege `role: "user"` üzenetként megy ki (M-19)      |

**A saját `emit_output` stratégia mostantól bizonyított**, a leíróban `usable: known true`,
`observedRoundTrips: known [3]`. Az alapértelmezés mégis az `sdk_output_format` marad, három
okból: nem igényel `Stop` hookot a lépés futtatóban, a séma validációt az SDK végzi saját kód
helyett, és nem ír elő determinisztikus plusz modellkört (az M-19 mind a 10 futásában pontosan
egy blokkolás kellett, tehát a kikényszerítés ára mindig egy extra kör).

Az `emit_output_tool` innentől nem "nem mértük" státuszú tartalék, hanem működő alternatíva: ha
egy jövőbeli SDK verzió elrontja az `outputFormat` láncot, van hova váltani, mérési bizonyítékkal.

**Kötelező kísérő beállítás:** `maxTurns` legalább 2. Az M-02 futás azért esett
`error_max_turns`-be, mert `maxTurns: 1` mellett a `StructuredOutput` tool hívása külön kört
igényel. Ez a lépés-futtató alapértelmezésébe be kell épüljön. Az `emit_output_tool` ágon a
mért igény `maxTurns` legalább 3.

**Amit az M-34 megváltoztat ezen a képen.** Eddig hallgatólagosan arra támaszkodtunk, hogy ha egy
jövőbeli SDK verzió mégis kényszerített `tool_choice` értéket küldene, azt a MiniMax 400-zal
jelezné, tehát azonnal kiderülne. Az M-34 szerint ez nem igaz: a `{"type":"any"}` és a
`{"type":"tool",...}` érték is HTTP 200-at kap, a szolgáltatás **csendben eldobja** (6.9). Ennek
három következménye van erre a szekcióra: a lépés futtatónak kötelező a `result` üzenet
`subtype` mezőjét **és** a `structured_output` mező meglétét ellenőriznie, mert a HTTP siker
önmagában nem jelent kitöltött kimenetet; az `emit_output_tool` tartalék értéke nő, mert az a
kikényszerítést `Stop` hookon és `user` role-ú üzeneten át végzi (M-19), ami a `tool_choice`
mezőtől független; és az SDK frissítési regressziónak explicit módon ellenőriznie kell a kimenő
`tool_choice` értékeket, mert magától már nem derülne ki (5.7).

### 5.3 Letiltandó UI vezérlők a `minimax` provider választásakor

| Vezérlő                                      | Miért                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tool_choice` `any` és `tool` opció          | a MiniMax ezt az értéket **csendben eldobja**, nem utasítja el: HTTP 200 jön, `tool_use` blokk nélkül (M-34, 6.9). Emiatt a tiltás **szigorúbban indokolt**, mint korábban gondoltuk: nincs hibaüzenet, ami a felhasználót figyelmeztetné, a kényszerítés egyszerűen nem történik meg                                    |
| `thinking` fix budget (`budget_tokens`)      | a MiniMax sémájában nincs ilyen kulcs, az SDK sem küldi. Csak `adaptive` és `disabled` maradhat                                                                                                                                                                                                                          |
| `WebSearch` tool engedélyezése               | **kritikus**, lásd 5.4                                                                                                                                                                                                                                                                                                   |
| modell-lista **az SDK-n keresztül**          | az SDK nem hívja a `GET /v1/models` útvonalat (M-12, M-36), a `supportedModels()` pedig helyi Claude Code konfigurációt ad vissza. A lista a config fájlból jön, és saját HTTP hívással ellenőrizhető (M-35, 6.10)                                                                                                       |
| kép csatolás                                 | **véglegesen letiltva.** Az M-23 bizonyította, hogy a kép content blokk kimegy a dróton (256x256 piros PNG, 1 136 karakteres base64), a szolgáltatás HTTP 200-at ad, a modell mégis azt állítja, hogy nincs kép. Nem figyelmeztetés kell, hanem tiltás: a felhasználó máskülönben azt hinné, hogy a modell látta a képet |
| max output token 128 000 fölé                | a kliens úgyis 128 000-re vágja (M-22). A UI ne engedjen olyan értéket beállítani, ami csendben elvész                                                                                                                                                                                                                   |
| kép csatolás (ismétlés a teljesség kedvéért) | lásd fent, M-23                                                                                                                                                                                                                                                                                                          |
| videó csatolás                               | nincs is ilyen vezérlő: az SDK típusfelületéből videó content blokk nem állítható elő (6.12)                                                                                                                                                                                                                             |

**Amit kifejezetten NEM tiltunk le: az `effort` vezérlőt.** A korábbi óvatosság alapja az volt,
hogy az `output_config` mező 400-at okozhat. Az M-04 szerint `low` és `max` értékkel egyaránt
HTTP 200 jön, az M-26 szerint pedig a mező akkor is kimegy, ha senki nem kéri, és nincs kapcsoló,
ami levenné (6.1). Az `effort` tehát nem kockázati vezérlő, hanem használható beállítás. Ami
marad: ha a MiniMax a jövőben szigorít az `output_config` mezőre, nincs kliens oldali kikerülés,
és ez minden lépést érintene. Ez regressziós kockázat, amit a Kapcsolat teszt jelez, nem UI tiltás
kérdése.

### 5.4 A `WebSearch` tool tiltása a `minimax` providerrel

**Ez a mérés második legfontosabb, önálló megállapítása, és nem szerepel a Q1-Q12 listán.**

Saját ellenőrzés (M-17, `00019-1787707009344.json`): a Claude Code `WebSearch` toolja egy beágyazott
alkérést indít **ugyanarra a base URL-re**, `system` promptja `"You are an assistant for performing
a web search tool use"`, `tools` tömbje egyetlen elem:
`{"type":"web_search_20250305","name":"web_search","max_uses":8}`, `tool_choice: {"type":"auto"}`.

A MiniMax ezt a szerver oldali toolt **csendben eldobja**: HTTP 200, de a válaszban nincs
`server_tool_use` és nincs `web_search_tool_result` blokk. A modell ehelyett a saját tudásából
válaszol. A rögzített válasz szó szerint felajánlja, hogy `"searches for more specific
information"`, tehát a felhasználó felé úgy néz ki, mintha keresés történt volna.

Az M-25 kizárta az egyetlen alternatív magyarázatot: `maxTurns: 12` mellett a futás `success`
subtype-tal zárult, a `maxTurns` tehát nem szakította félbe, és a 7 kérés egyikének stream
válaszában sincs eredményblokk. A jelenség nem a mérés artefaktuma.

**Következmény: a `WebSearch` toolt a `minimax` providernél a `disallowedTools` listára kell tenni.**
Nem hibázik, hanem hallgatólagosan hamis, forrás nélküli választ ad, ami a projekt
"minden állítást validálni kell" alapelvével összeegyeztethetetlen.

### 5.5 Költségjelentés

A `result.total_cost_usd` és a `modelUsage` **first-party árazással** számol
(`provider: "firstParty"`, `canonicalModel: "minimax-m3"`). Az M-13 futás triviális prompttal
`0.213 USD` költséget jelentett. **Ez az érték a `minimax` providernél nem használható.** A
workflow futtató UI vagy elrejti, vagy saját, MiniMax árazású számítást használ. Konkrét árat
ebbe a dokumentumba nem írunk, mert nem mértük.

Az M-28 ugyanezt a suffixes azonosítóval is megerősítette: ott a `canonicalModel` értéke
`"minimax-m3[1m]"`, a jelentett költség `0.497899 USD` egyetlen, 999 SDKMessage-es futásra. A
suffix tehát a költségszámítás kulcsát is megváltoztatja, de a first-party árazás ettől még
first-party marad.

### 5.6 Párhuzamos ágak és kérésszám

**Az M-31 a kliens belső subagent párhuzamosságát méri, nem a workflow motorét.**
`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3` mellett a korlát tartott, és a legnagyobb egyidejű
kimenő kérésszám 4 volt: egy orchestrátor kérés plusz három subagent kérés (6.6). Ebből három
tervezési következmény adódik.

1. **A workflow motor párhuzamos ágai külön `query()` hívások**, tehát rájuk ez a korlát nem hat.
   A motornak **saját, explicit párhuzamossági korlátja** kell legyen, és ezt a UI-n is látni kell,
   különben a felhasználó nem tudja, mennyi kérés megy ki egyszerre.
2. **A kimenő kérésszám felső becslése**: párhuzamos ág szám szorozva (1 plusz a subagent korlát),
   lépésenként. A session cím generáló kérés nálunk nincs benne, mert a
   `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` levágja (5.1), tehát a lépés alapja 1 kérés. Ha egy
   lépés subagenteket indít, a szorzó a fenti korlát plusz egy.
3. **Konkrét ágszámot nem javaslunk.** A MiniMax dokumentált 200 RPM korlátja ebbe a számításba
   tartozik, de nincs dokumentált szabály arra, hány párhuzamos ág fér bele, és 429-es választ két
   mérési körben egyszer sem kaptunk (M-18, M-36), tehát mérési alapunk sincs rá. A leíró azt
   hordozza, amit mértünk: `concurrency.measuredSubagentCap: 3` és
   `concurrency.observedMaxConcurrentRequests: 4`.

Két kapcsoló van dokumentálva erre a területre, és mi csak az egyiket mértük:
`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (alapérték 20) és `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`
(alapérték 10, "Maximum number of read-only tools and subagents that can execute in parallel",
https://code.claude.com/docs/en/env-vars). A kettő egymásra hatását **nem mértük**, ezért arról
nem állítunk semmit.

### 5.7 SDK verzió pinelés

A leírók `sdkVersionPin` mezője `0.3.245`. A mérésből látszik, hogy a body mezőlista bővül
(`output_config`, `context_management` a research fájl írásakor még nem volt megerősítve
kimenőként). Minden SDK frissítés előtt az **M-01 ... M-36** sor újrafuttatandó, és a jelen
dokumentum Q1-Q12 lezárásai újranyitandók.

Két kiegészítő mérés kifejezetten SDK verzióhoz kötött, ezért a frissítési regresszió kötelező
része:

- **M-22**, mert a 128 000-es `max_tokens` vágás a Claude Code kliens modelltáblájából jön, nem a
  providertől. Egy új kliensverzió más cap értéket hozhat.
- **M-24**, mert a `stream` kikapcsolhatatlansága az `Options` típus jelenlegi alakjából
  következik. Ha egy új SDK verzió ad `stream` mezőt, a `promptCaching.mode` mező azonnal
  mérhetővé válik.
- **M-34**, mert az M-34 óta tudjuk, hogy a nem támogatott `tool_choice` érték nem HTTP hibát
  ad, hanem csendben elvész. A frissítési regressziónak ezért explicit módon ellenőriznie kell,
  hogy megy-e ki `auto`/`none` halmazon kívüli érték, mert magától nem derülne ki (6.9).
- **M-30**, mert az `API_TIMEOUT_MS` hatása egyetlen kérés headeréből leolvasható
  (`x-stainless-timeout`), tehát olcsó ellenőrzés, és a kliens alapértékének változása így
  azonnal látszik.

---

## 6. Az M-26 ... M-36 kör kiértékelése

Nyers megfigyelések: a [mérési jegyzőkönyv](2026-08-26-spec000-meresi-jegyzokonyv.md)
"M-26 - M-36 kiegészítő mérés" szakasza. Itt csak a kiértékelés áll.

Ez a kör a felhasználó ténylegesen használt indító parancsának env változóit mérte, és
lezárta a nyitva maradt capability mezők közül azokat, amik egyáltalán mérhetők voltak.
Terjedelme 50 rögzített tranzakció egyetlen proxy processzben: 36 `POST /v1/messages`
(mind HTTP 200), 13 `HEAD /api/hello` (mind HTTP 404) és 1 `GET /v1/models` (HTTP 200,
az M-34 és M-35 saját, SDK-n kívüli hívásaiból).

### 6.1 M-26: az `effort` nem kockázati tényező, és a kapcsoló hatástalan

**Megfigyelés:** a `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1` mellett és nélküle a kimenő
`output_config` **mindkét kérésfajtánál karakterről karakterre azonos**, és nincs eltérés sem a
body top-level kulcsaiban, sem az `anthropic-beta` headerben.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-26/{a-base,b-always-enable-effort}.meta.json`;
drótszinten `00002-1787742422775.json` és `00003-1787742425723.json` kontra
`00005-1787742427896.json` és `00006-1787742428703.json`.

**Következtetés, két részben.** Egy: a kapcsoló ezen a kliensverzión, M3 ellen hatástalan. A
hivatalos leírás szerint a szerepe az, hogy akkor is kimenjen az `effort`, ha a kliens nem ismeri
fel a modellazonosítót effort-képesnek: `"Set to 1 to send the effort parameter with every
request, even when Claude Code does not recognize the model ID as effort-capable"`
(https://code.claude.com/docs/en/env-vars). A mérés szerint az `effort` a `MiniMax-M3`
azonosítóval **amúgy is kimegy**, tehát nincs mit bekapcsolni.

Kettő, és ez a fontosabb: **az `effort` nem kockázati tényező.** Nincs olyan beállítás, ami
leveszi a bodyból (az M-08 öt kapcsolója közül egyik sem, és az M-26 sem), és nincs olyan érték,
amit a MiniMax elutasítana (M-04: `low` és `max` egyaránt HTTP 200). A mért `POST /v1/messages`
kérések egyikében sem keletkezett 400-as válasz.

**Tervezési következmény:** az `effort` végleges státusza `accepted: known true`,
`wireField: known 'output_config.effort'`, M-04 és M-26 bizonyítékkal. **Az effort UI vezérlőt
nem tiltjuk le.** A korábbi óvatosság alapja az volt, hogy az `output_config` a research által
idézett [GitHub #28](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/28) szerint 400-at okozhat;
ez M3 ellen egyszer sem reprodukálódott, és a kapcsolónak nincs is olyan állása, amivel az
`output_config` elkerülhető lenne. A megmaradó kockázat regressziós, nem jelenlegi: ha a MiniMax
szigorít, az `effort` kliens oldalról nem kapcsolható ki. Ezt a Kapcsolat teszt gomb tudja
jelezni, nem egy letiltott UI vezérlő.

### 6.2 M-27: a fast mode kapcsoló hatása kizárólag kliens oldali

**Megfigyelés:** `CLAUDE_CODE_DISABLE_FAST_MODE=1` mellett a dróton nincs eltérés (azonos
`output_config`, `thinking`, `cache_control` darabszám és `anthropic-beta` lista), a kliens oldali
`SDKMessage` folyam viszont eltér: a `thinking_tokens` subtype-ú `system` üzenetek száma 2-ről
24-re, a `stream_event` üzeneteké 10-ről 33-ra nő, változatlan kérésszám mellett.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-27/{a-base,b-disable-fast-mode}.meta.json`
és a hozzájuk tartozó `.sdk-messages.ndjson`; drótszinten `00008-1787742431972.json`,
`00009-1787742436853.json` kontra `00011-1787742438656.json`, `00012-1787742441222.json`.

**Következtetés:** a kapcsoló ezen az úton nem befolyásolja a kimenő kérést. A hivatalos leírás
egysoros (`"Set to 1 to disable fast mode"`, https://code.claude.com/docs/en/env-vars), a mögöttes
viselkedést nem részletezi, ezért a megfigyelt SDKMessage különbség **okára nem adunk
magyarázatot**: az tény, hogy a folyam sűrűbb lesz, az ok nem ellenőrzött.

**Tervezési következmény:** a kapcsoló nem kerül a provider env blokkjába, mert drótszintű hatása
nincs. A transcript panelnek viszont van üzenete: ugyanaz a lépés a kapcsoló állásától függően
eltérő darabszámú `SDKMessage`-t ad, tehát a panel nem építhet arra, hogy egy lépés üzenetszáma
stabil. Ez pufferméretezési és megjelenítési kérdés, nem helyességi.

### 6.3 M-28: a compact kapcsolók hatása nem figyelhető meg, a `contextWindow` a suffixből jön

**Megfigyelés:** `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` és `CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000`
mellett a 999 rögzített `SDKMessage` között **nincs compact boundary** üzenet (a `system` subtype-ok
kizárólag `init`, `status`, `thinking_tokens`), a `result.modelUsage["MiniMax-M3[1m]"].contextWindow`
értéke 1 000 000, a záró `result.usage.input_tokens` pedig 80 987.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-28/a.meta.json` és `a.sdk-messages.ndjson`.

**Következtetés:** a két kapcsoló hatása ebben a mérésben nem figyelhető meg, mert a session meg
sem közelítette a küszöböt. A dokumentált szabály szerint a `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` a
compact ablak százalékát állítja (1 és 100 között, és csak lefelé tud vinni), a
`CLAUDE_CODE_AUTO_COMPACT_WINDOW` pedig 100 000 és 1 000 000 közötti tokenben adja meg magát az
ablakot (https://code.claude.com/docs/en/env-vars). Az 1 000 000-es ablak 50 százaléka 500 000
token, a mért 80 987 ennek a hatoda. A `contextWindow: 1000000` érték **nem** a két kapcsolóból
származik, hanem a `[1m]` suffixből: az M-11 (b) suffix nélküli futása 200 000-et jelentett.

**Tervezési következmény:** egyik változó sem kerül a kötelező env blokkba, mert egyik sem mutatott
mérhető hatást, a kontextusablakot pedig a modellazonosító állítja be (5.1). Ha később a compact
viselkedést szabályozni akarjuk, ez a két változó a dokumentált eszköz, de előtte olyan mérés kell,
ami ténylegesen eléri a küszöböt. Konkrét értéket addig nem javaslunk.

### 6.4 M-29: az alias feloldás hat, csak nem a `model` stringen

**Megfigyelés:** `Options.model: 'MiniMax-M3[1m]'` és `ANTHROPIC_DEFAULT_HAIKU_MODEL='MiniMax-M3'`
(suffix nélkül) mellett a kimenő body `model` mezője mindkét kérésben `"MiniMax-M3"`, az
`anthropic-beta` header viszont **eltér a két kérés között**: a háttérkérésben nincs
`context-1m-2025-08-07` elem, a fő kérésben van.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-29/a.meta.json`; drótszinten
`00018-1787742458818.json` (thin) kontra `00019-1787742459888.json` (full). Kontrollként az M-11 (a)
futás, ahol nem volt haiku felülírás: ott mindkét kérés (`00006-1787706958183.json`,
`00007-1787706958835.json`) hordozta a headert.

**Következtetés:** a `[1m]` suffix feloldása **kérésenként**, a kérés szerepéhez rendelt
modellazonosítóból történik, és nem a `model` stringen jelenik meg, hanem a beta headeren és a
kliens oldali kontextusablak feltételezésen. Ez egyezik a dokumentált szabállyal: `"If the ID
doesn't start with claude- but contains [1m], in any casing, and Claude Code can't resolve it to a
Claude model, Claude Code assumes a 1M window for it"` (https://code.claude.com/docs/en/model-config).

**Tervezési következmény:** a config rétegnek **két külön azonosítót** kell hordoznia:

| Mező                                                           | Érték            | Hol jelenik meg                                                        |
| -------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| wire azonosító (`models[].id`)                                 | `MiniMax-M3`     | a kimenő body `model` mezője, és a `GET /v1/models` lista eleme (M-35) |
| kliensnek átadott azonosító (`models[].clientModelIdentifier`) | `MiniMax-M3[1m]` | `Options.model` (M-11) vagy `ANTHROPIC_MODEL` (M-32)                   |

Válasz a feltett kérdésre: **igen, a config rétegnek a suffixes alakot kell használnia**, de csak
azon a felületen, amit a kliensnek ad át. A leíróba ezért került be a `models[].clientModelIdentifier`
mező. Ha valaki a háttérkérés modelljét külön, suffix nélkül állítja be, az M-29 szerint a két kérés
eltérő ablak feltételezéssel fut; a mi konfigurációnkban ez nem áll elő, mert a
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` a háttérkérést levágja.

**Dokumentált alternatíva, amit nem választunk, de rögzítünk.** A
`CLAUDE_CODE_MAX_CONTEXT_TOKENS` változó pontosan erre a helyzetre való, de a suffixes azonosítóval
együtt nem működik: `"If the ID doesn't start with claude- but contains [1m] ... Claude Code assumes
a 1M window for it and the variable doesn't apply on its own"`, míg suffix nélküli, fel nem oldható
azonosítónál `"the variable applies directly and proactive compaction continues at the declared
window"` (https://code.claude.com/docs/en/model-config). Elvben tehát a suffix nélküli azonosító
plusz egy deklarált ablak pontosabb lenne. Két okból nem ezt választjuk: az M-20 a szolgáltatás
1 046 827 tokenes teljesítményét **a suffixszel, tehát a `context-1m-2025-08-07` header
jelenlétében** mérte, header nélkül nem mértünk 200 000 fölött; és a deklarálandó szám csak mért
alsó korlátunk van, pontos határunk nincs. Ha valaha váltani akarunk, előbb mérés kell: suffix
nélküli azonosító plusz `CLAUDE_CODE_MAX_CONTEXT_TOKENS`, és annak ellenőrzése, hogy a szolgáltatás
a beta header nélkül is kiszolgál-e 200 000 fölött.

### 6.5 M-30: az `API_TIMEOUT_MS` egyetlen headerből leolvasható

**Megfigyelés:** az `x-stainless-timeout` header értéke `600` az alapfutásban, és `3000`
`API_TIMEOUT_MS=3000000` mellett, mindkét kérésfajtában.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-30/{a-base,b-api-timeout-3000000}.meta.json`;
drótszinten `00021-1787742461622.json`, `00022-1787742462310.json` kontra
`00024-1787742465473.json`, `00025-1787742465901.json`.

**Következtetés:** a header a beállított időkorlátot másodpercben hordozza, és a `600` alapérték
egyezik a dokumentált 600 000 ms alapértékkel (`"Timeout for API requests in milliseconds
(default: 600000, or 10 minutes; maximum: 2147483647)"`,
https://code.claude.com/docs/en/env-vars). A beállítás hatása tehát **egyetlen kéréssel
ellenőrizhető**, nem kell megvárni az időkorlátot.

**Tervezési következmény:** az `API_TIMEOUT_MS` **nem kerül** a kötelező env blokkba. Nincs olyan
mérésünk, ami a 10 perces alapérték elégtelenségét mutatná, konkrét értéket pedig megalapozatlanul
nem javaslunk. Ha egy hosszú lépés ebbe ütközik, a beállítás olcsón ellenőrizhető a headeren, és a
dokumentált maximum 2 147 483 647 ms, ami fölött a kérések azonnal hibáznak.

### 6.6 M-31: a subagent korlát tartott, a csúcs a korlát plusz egy

**Megfigyelés:** `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=3` mellett a futás időablakában 10 kérés
esett, a sweep-line módszerrel számolt legnagyobb egyidejű kérésszám **4**: egy orchestrátor kérés
és pontosan három subagent kérés átfedésben.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-31/a.meta.json`; drótszinten a
`00028-1787742478371.json` orchestrátor kérés átfedése a `00029-1787742478940.json`,
`00030-1787742479080.json` és `00031-1787742479148.json` subagent kérésekkel (a három subagent
kérés `system` promptja szó szerint a case-ben definiált subagent prompt).

**Következtetés:** a korlát tartott, és a kimenő kérésszám csúcsa a korlát plusz egy, mert az
orchestrátor saját kérése is nyitva van közben. A negyedik subagentet a modell aszinkron indította,
ezért nem lett belőle egyidejű negyedik subagent kérés; a pontos ütemezési logika ebből a mérésből
nem rekonstruálható, ezt nem is állítjuk.

**Tervezési következmény:** lásd az 5.6 szekciót, a párhuzamos ágak kezelését ez a mérés alapozza
meg. A leíróba a `concurrency` mezőcsoport került: `subagentCapEnvVar`,
`measuredSubagentCap: 3`, `observedMaxConcurrentRequests: 4`.

### 6.7 M-32: a 12 változó együtt sem hoz új hatást

**Megfigyelés:** a felhasználó teljes indító parancsával **1** kérés ment ki (a háttérkérés
hiányzik), a body `model` mezője `"MiniMax-M3"` úgy, hogy `Options.model` nem volt beállítva, a
`tools` tömb 24 elemű (`DesignSync` nélkül), `output_config: {"effort":"high"}`,
`thinking: {"type":"adaptive"}`, `cache_control` 3 blokk, `x-stainless-timeout: 3000`, és az
`anthropic-beta` lista tartalmazza a `context-1m-2025-08-07` elemet.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-32/a.meta.json`; drótszinten
`00038-1787742498281.json`.

**Következtetés:** minden megfigyelt részlet visszavezethető egy külön is mért hatásra (M-08 és
M-21 a kérésszámra és a `DesignSync` tool eltűnésére, M-11 a suffixre, M-30 a timeout headerre,
M-26 az `output_config` alakjára). **Egymást erősítő vagy felülíró, külön nem látott hatás nincs.**
Egy új tény azért van: a modell az `ANTHROPIC_MODEL` env változóból is feloldódik, `Options.model`
nélkül, és a suffix ezen az úton is ugyanúgy viselkedik.

**Tervezési következmény:** a provider env blokk és a lépésenkénti modellválasztás nem ütközik,
mindkét út mért. A projekt az `Options.model` utat használja, mert a lépés szintű felülírás így egy
hívás paramétere, nem env manipuláció. Az M-32 azt igazolja, hogy ha valaha env-en kell átadni, az
is járható.

### 6.8 M-33: a prompt cache részben a hívó fél kezében van

**Megfigyelés:** a harness a felhasználói üzenet szöveg blokkjára maga rakott
`cache_control: {"type":"ephemeral"}` jelölést. A `DISABLE_PROMPT_CACHING=1` futásban a `system`
szekció mindkét SDK generálta töréspontja eltűnt, a hívó fél saját blokkja viszont **kiment**
(3 helyett 1 `cache_control` maradt, nem 0). A `usage.cache_read_input_tokens` mind a három
futásban 128.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-33/{a-explicit-breakpoint-first,b-explicit-breakpoint-second,c-disable-prompt-caching}.meta.json`;
drótszinten `00041-1787742511635.json`, `00044-1787742514059.json`, `00047-1787742517068.json`.

**Következtetés:** a `DISABLE_PROMPT_CACHING` hatóköre az **SDK saját töréspontjaira** szűkül. Ez
nem mond ellent az M-15-nek, hanem pontosítja: ott azért lett 0 a `cache_control` darabszám, mert a
hívó fél nem rakott sajátot. Ami továbbra sem dőlt el: az explicit töréspont önálló hatása, mert a
`cache_read_input_tokens` mind a három futásban azonos.

**Tervezési következmény, két részben.** Egy: a `promptCaching.callerBreakpointSurvivesDisable`
mező `known: true`, tehát a lépés futtató **saját cache töréspontot rakhat** a hosszú, ismétlődő
tartalmakra, és azt a kapcsoló nem veszi le. Kettő: a UI-ban a `DISABLE_PROMPT_CACHING` nem
címkézhető "kikapcsolja a promptgyorsítótárat" jelentéssel, mert csak az SDK töréspontjait veszi
le. A `promptCaching.mode` mező `unknown` marad, az indoklás az M-33-mal bővült.

### 6.9 M-34: a MiniMax csendben eldobja a `tool_choice` kényszerítést, nem utasítja el

**Megfigyelés:** két közvetlen HTTP hívás az SDK megkerülésével. A `{"type":"any"}` és a
`{"type":"tool","name":"noop"}` érték egyaránt **HTTP 200**-at kapott, a válasz `stop_reason`
mezője `end_turn`, a `content` tömb szöveges, `tool_use` blokk egyikben sincs, `error` mező nincs,
és a `base_resp.status_code` a szokásos `0`.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-34/{a-tool-choice-any,b-tool-choice-tool}.json`.

**Következtetés, és ez más, mint amit eddig írtunk:** a MiniMax nem utasítja el a szűk enumján
kívüli `tool_choice` értéket, hanem **csendben eldobja**, és úgy válaszol, mintha `auto` lett volna
beállítva. A `toolChoice.rejectionBehaviour` mező ezért `known: 'silently_dropped'`, nem
`'http_400'`.

**Tervezési következmény a strukturált kimenet stratégiákra:** az addig hallgatólagosan feltételezett
biztonsági háló, hogy "a kényszerítés 400-at adna, tehát azonnal észrevennénk", **nincs meg**. Ha
egy jövőbeli SDK verzió mégis kiküld kényszerített `tool_choice` értéket az `outputFormat` záró
fázisában, az nem HTTP hibaként jelentkezik, hanem abban, hogy a modell nem hívja meg a
`StructuredOutput` toolt. Három konkrét következmény:

1. A lépés futtatónak **kötelező** a `result` üzenet `subtype` mezőjét és a `structured_output`
   meglétét ellenőriznie. A HTTP siker és a `success` subtype együtt sem elég, ha a mező üres.
2. Az `emit_output_tool` tartalék stratégia értéke nő: a kikényszerítés ott `Stop` hookon és
   `user` role-ú üzeneten át hat (M-19), ami a `tool_choice` mezőtől teljesen független.
3. Az SDK frissítési regresszió kap egy explicit ellenőrzést: megy-e ki bármelyik kérésben
   `auto`/`none` halmazon kívüli `tool_choice`. Ez eddig magától kiderült volna egy 400-as
   hibából; most már nem derülne ki.

### 6.10 M-35: a modell-lista lekérhető, csak nem az SDK-n keresztül

**Megfigyelés:** egy közvetlen `GET /v1/models` hívás a MiniMax végpontra **HTTP 200**-at ad. A
válasz `data` tömbje 8 elemű, minden elem `id`, `type: "model"`, `display_name` és `created_at`
mezőkkel, `has_more: false`. A `data[0].id` szó szerint `"MiniMax-M3"`, tehát a hatókörünkben lévő
modell szerepel a listában. A többi elem a hatókörön kívüli MiniMax családtagokat sorolja, ezeket
sem itt, sem máshol nem nevezzük meg.

**Bizonyíték:** `tools/wire-probe/artifacts/harness/M-35/a-get-models.json`; a route eloszlás az
M-36 passzív leltárában.

**Következtetés:** a Q10 válasza pontosodik. Nem az volt a helyzet, hogy a lista nem létezik, hanem
az, hogy **az SDK nem kéri le**. A hivatalos leírás ezt megerősíti: a gateway modell felderítés
külön kapcsolóhoz kötött és alapból ki van kapcsolva (`"Set to 1 to populate the /model picker from
your gateway's /v1/models endpoint ... Off by default"`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY`,
https://code.claude.com/docs/en/env-vars, ugyanez a https://code.claude.com/docs/en/model-config
oldalon is szerepel). A kötelező `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` felsorolása pedig a
gateway modell felderítés letiltását külön is tartalmazza.

**Tervezési következmény, a Kapcsolat teszt gomb terve.** A korábbi terv (5.3, Q10) az volt, hogy a
gomb egyetlen minimális `query()` hívás, és a modell-lista kizárólag a config fájlból jön. Ez
**két lépcsőre módosul**:

1. **Elérhetőség és lista ellenőrzés:** közvetlen `GET {ANTHROPIC_BASE_URL}/v1/models` hívás a mi
   kódunkból, az `ANTHROPIC_AUTH_TOKEN` értékével. Ez megmondja, hogy a végpont él, és hogy a
   konfigurált azonosító (`MiniMax-M3`) szerepel-e a szolgáltatás saját listájában. Ez a lépés
   **nem megy át az SDK-n**, tehát a provider config fájlban a base URL-nek elérhetőnek kell lennie
   a mi HTTP kliensünk számára is.
2. **Tényleges működés:** utána egy minimális `query()`, ahogy eddig, mert a lista megléte nem
   bizonyítja, hogy a Messages végpont a mi body alakunkat elfogadja (az `output_config` és a beta
   headerek miatt ez külön kérdés).

A config fájlba drótozott modell-lista **marad az igazság forrása**, a végpont listája ellenőrzésre
szolgál: ha a konfigurált azonosító hiányzik belőle, a gomb ezt jelzi. A listából más modellt a UI
**nem ajánl fel**, mert a projekt hatóköre egyetlen modell. A leíróban ehhez a `modelsEndpoint`
mezőcsoport került be (`directHttpReachable: true`, `calledBySdk: false`, `listedModelCount: 8`),
és a `models[MiniMax-M3].listedByModelsEndpoint` mező `known: true`.

### 6.11 M-36: a rate limit mezők maradnak ismeretlenek, most már két körből

**Megfigyelés:** az M-26 ... M-35 kör 50 tranzakciójában nincs `429`, nincs `5xx`, és nincs
`retry-after` vagy `ratelimit` alstringet tartalmazó válasz header. A header névunió egyetlen új
eleme az M-18-hoz képest a `set-cookie`.

**Következtetés:** a második, független kör ugyanazt adja, mint az M-18. A `set-cookie` a mérés
szempontjából közömbös: a proxy nem tartja meg a sütit, és a kérések így is HTTP 200-at kapnak.

**Tervezési következmény:** a `rateLimits.retryAfterHeader` és `rateLimitHeaders` mezők `unknown`
maradnak, blokkolójuk mostantól M-18 és M-36. A workflow futtató **nem építhet** `Retry-After`
headerre: ha 429-et kap, saját visszalépési logikát kell használnia. Konkrét várakozási időt vagy
próbálkozás számot nem írunk elő, mert erre sem mérésünk, sem dokumentált szabályunk nincs.

### 6.12 `videoInput`: a blokkoló a típusfelület, nem a szolgáltatás

**Megfigyelés:** mérési eset nem futott. A telepített `@anthropic-ai/sdk` `ContentBlockParam`
uniójában nincs `video` variáns, az `ImageBlockParam.source` `media_type` mezője pedig zárt unió
(`image/jpeg`, `image/png`, `image/gif`, `image/webp`).

**Bizonyíték:** saját ellenőrzés a telepített csomagon,
`tools/wire-probe/node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` 1750. és 95. sor.

**Következtetés:** a projekt tiltja az `any` és az `as` használatát, ezért ebből a típusfelületből
típusbiztosan nem állítható elő videó content blokkot hordozó streaming input üzenet. A mező
blokkolója tehát **a telepített SDK típusfelülete, nem a MiniMax szolgáltatás**, és ezt a
különbséget a leíró indoklásának is tükröznie kell.

**Tervezési következmény:** a `models[MiniMax-M3].videoInput` mező `unknown` marad. Lezárná: egy
olyan SDK verzió, aminek a `ContentBlockParam` uniója videó variánst is tartalmaz, és az arra
épített, az M-23 mintáját követő mérés. A videó csatolás UI vezérlő addig ugyanúgy nem létezik,
ahogy a kép csatolás le van tiltva (5.3).
