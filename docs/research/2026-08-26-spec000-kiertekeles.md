# SPEC-000 kiértékelés: Q1-Q12 lezárása

| | |
|---|---|
| Dátum | 2026-08-26 |
| Bemenet | [`2026-08-26-agent-sdk-minimax.md`](2026-08-26-agent-sdk-minimax.md) 4. szekció, [`SPEC-000`](../spec/SPEC-000-provider-wire-measurement.md), [`mérési jegyzőkönyv`](2026-08-26-spec000-meresi-jegyzokonyv.md) |
| Kimenet | `src/providers/*.ts` képességleírók |
| SDK | `@anthropic-ai/claude-agent-sdk@0.3.245`, CLI `cc_version=2.1.245` (a billing headerből) |
| Mérési alap | 113 rögzített proxy tranzakció, ebből 79 `POST /v1/messages` (mind HTTP 200) és 34 `HEAD /api/hello` (mind HTTP 404) |

A jegyzőkönyv nyers megfigyeléseit nem ismétlem meg, csak hivatkozom rájuk. Ahol a jegyzőkönyvön
túl saját artefaktum-ellenőrzést végeztem, azt a "saját ellenőrzés" jelölés mutatja.

Lezárva: 10 kérdés (Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q9, Q10, Q12). Nyitva: 2 kérdés (Q8, Q11).

---

## 1. Q1-Q12 lezárása

### Q1: az `outputFormat` szintetikus toolt injektál, vagy natív `output_config.format`-ot küld?

**Válasz: mindkét alak létezik a dróton, de eltérő célra. A felhasználói `outputFormat` kliens
oldali szintetikus toolként megy ki.**

| Alak | Hol jelenik meg | Séma forrása |
|---|---|---|
| `tools[].name = "StructuredOutput"`, `input_schema` = a kért séma | a fő kérésben, M-02 és M-03 | az `Options.outputFormat.schema` |
| natív `output_config.format.type = "json_schema"` | kizárólag a session cím generáló kérésben | fix `{title: string}` séma |

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

| Alak | Darab |
|---|---|
| `{"effort":"high"}` | 45 |
| `{"effort":"high","format":{...title séma...}}` | 32 |
| `{"effort":"low"}` | 1 (M-04 a) |
| `{"effort":"max"}` | 1 (M-04 b) |

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

| Beállítás | Kimenő `thinking` | Eset |
|---|---|---|
| nincs explicit `thinking` (alap) | `{"type":"adaptive"}` a fő kérésben, a cím kérésben nincs | M-01 |
| `thinking: {type:'adaptive'}` | `{"type":"adaptive"}` | M-05 |
| `thinking: {type:'disabled'}` | a kulcs **nem megy ki** | M-06 a |
| `MAX_THINKING_TOKENS=0` | a kulcs **nem megy ki**, plusz `context_management` is eltűnik | M-06 b, M-08 |

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

| Env változó | kérésszám | eltűnő body kulcs | eltűnő `anthropic-beta` elem | egyéb |
|---|---|---|---|---|
| `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` | 2 | `context_management` | `thinking-token-count-2026-05-13`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05` | `cache_control` marad 3 |
| `ENABLE_TOOL_SEARCH=false` | 2 | nincs | nincs | nincs mérhető hatás |
| `DISABLE_PROMPT_CACHING=1` | 2 | nincs | nincs | `cache_control` 3 -> 0 |
| `MAX_THINKING_TOKENS=0` | 2 | `thinking`, `context_management` | **nincs** | aszimmetrikus pár |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` | **1** | nincs | nincs | a cím kérés eltűnik, `tools` 25 -> 24 (`DesignSync` kiesik) |

Két kiemelés:

1. **`MAX_THINKING_TOKENS=0` aszimmetrikus:** leveszi a `thinking` és `context_management` body
   mezőket, de a hozzájuk tartozó beta headereket a headerben hagyja. A research 3. szekciója
   szerint a fél pár kemény 400-at okoz. MiniMax ellen ez **nem okozott hibát** (HTTP 200), mert a
   MiniMax az ismeretlen headert eldobja. Egy szigorúbb gateway ellen ez 400 lenne.
2. **`ENABLE_TOOL_SEARCH=false` nem mérhető:** a hivatalos leírás szerint a tool search amúgy is
   ki van kapcsolva, ha `ANTHROPIC_BASE_URL` nem first-party hosztra mutat
   (https://code.claude.com/docs/en/env-vars), tehát a beállítás redundáns, nem hatástalan.

**Tervezési következmény:** a `minimax` provider `env` blokkjába kötelezően bekerülő elemek a 4.
szekcióban.

### Q7: küld-e a MiniMax `input_json_delta`-t, és jól rakja-e össze az SDK?

**Válasz: igen és igen.**

M-09: a `content_block_start` `{"type":"tool_use"}` blokk `input` mezője a start pillanatában üres
objektum, majd `input_json_delta` delták érkeznek. A tool callback ténylegesen megkapott
argumentuma (`a.tool-callback-input.json`, 1960 karakteres `body` mezővel) és az
`sdk-messages.ndjson` assistant `tool_use` blokkjának `input` mezője JSON string szinten bájtazonos.

**Tervezési következmény:** a real-time transcript panel **építhet** a `stream_event` folyamra,
nem kell megvárnia a lezárt `assistant` üzenetet. Ez a UI szempontjából a legjobb kimenetel.

### Q8: működik-e a `Stop` hook `decision: "block"` kikényszerítés? NEM DÖNTHETŐ EL

**Válasz: nyitva marad. A mérés csak a happy pathot igazolta, a kikényszerítő mechanizmust nem.**

M-10 mindhárom futása sikeres (`subtype: success`, `num_turns: 2`, 3-3 kérés), és mindháromban
lefutott az `emit_output`. **De a blokkoló ág egyszer sem aktiválódott**: a `reason` szöveg egyetlen
kimenő kérés `messages` tömbjében sem jelenik meg. Az ok a case forrásában látszik
(`tools/wire-probe/src/cases/M-10.ts`): a prompt szó szerint `"Számold ki mennyi 2+2, majd hívd meg
a mcp__workflow__emit_output toolt az eredménnyel."`, tehát a modell utasításra hívta meg a toolt,
nem a hook kényszerítette rá.

Amit a mérés **mégis** hozott, és Q8 szempontjából fontos: a `role: "system"` mid-conversation
üzenet a MiniMax M3 ellen **nem hibázik**. Az M-10 run-1 2. és 3. kérésében a `messages` tömb
utolsó eleme `role: "system"` (tartalma az agent típusok listája, illetve
`<total_tokens>...</total_tokens>`), és a válasz HTTP 200 (saját ellenőrzés:
`00003-1787706973670.json`, `00004-1787706975166.json`). Az SDK a
`mid-conversation-system-2026-04-07` beta headert küldi hozzá. A research által idézett
[GitHub #43](https://github.com/MiniMax-AI/MiniMax-M2.7/issues/43)
`invalid message role: system (2013)` hiba tehát M3 ellen nem reprodukálódott.

**Tervezési következmény:** az `emit_output_tool` stratégia `usable` mezője `unknown` marad, mert a
kikényszerítés bizonyítatlan. Az alapértelmezett stratégia ezért nem ez lesz. A `role: "system"`
kockázat viszont mérési bizonyítékkal cáfolható, tehát ha a hook későbbi mérésben blokkol, a
`reason` szövegének továbbítása nem fog önmagában elhasalni.

### Q9: leválasztja-e a kliens a `[1m]` suffixet?

**Válasz: igen, a dróton, de a suffixnek két érdemi kliens oldali hatása van.**

| | `model: 'MiniMax-M3[1m]'` | `model: 'MiniMax-M3'` |
|---|---|---|
| wire `model` mező | `"MiniMax-M3"` | `"MiniMax-M3"` |
| `anthropic-beta` | tartalmazza a `context-1m-2025-08-07` elemet | nem tartalmazza |
| kliens oldali `modelUsage.contextWindow` | **1000000** | **200000** |
| `modelUsage.maxOutputTokens` | 32000 | 32000 |
| HTTP kód | 200 | 200 |

Saját ellenőrzés a `result` üzenet `modelUsage` mezőjéből (`M-11/a-with-suffix.sdk-messages.ndjson`
kontra `b-without-suffix`). Ez a hivatalos leírással egyezik: `"If the ID doesn't start with
claude- but contains [1m], in any casing, and Claude Code can't resolve it to a Claude model,
Claude Code assumes a 1M window for it"` (https://code.claude.com/docs/en/model-config).

**Tervezési következmény:** a suffix nem 404 kockázat, hanem a kontextusablak kliens oldali
vezérlője. Ha 1M kontextussal akarunk dolgozni, a `[1m]` suffixes azonosítót kell a modellnek
átadni. A SPEC-000 hatóköre szerint a `minimax` leíró modell-listája kizárólag `MiniMax-M3`, ezért
a suffix használata külön döntés, lásd 4. szekció.

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

### Q11: mekkora kontextusablakot jelent az endpoint, mikor indul auto-compact? RÉSZBEN NYITVA

**Válasz: a kliens oldali feltételezés mért és dokumentált, a szerver oldali valóság nem.**

Mért, kliens oldali oldal (saját ellenőrzés az összes `result.modelUsage` mezőn, 33 futás):
`contextWindow: 200000`, `maxOutputTokens: 32000`, `canonicalModel: "minimax-m3"`,
`provider: "firstParty"`. A kimenő body `max_tokens` mezője **mind a 79 kérésben 32000**.

Ez pontosan a dokumentált viselkedés: `"Claude Code defaults to 32000 for model IDs it doesn't
recognize, such as gateway-specific names"` (https://code.claude.com/docs/en/env-vars,
`CLAUDE_CODE_MAX_OUTPUT_TOKENS`).

Amit **nem** tudunk: M-13 nem érte el a compact határt. Mindössze 3 kérés ment ki, a záró
`usage.input_tokens` 32915, `413 request_too_large` nem fordult elő, compact boundary `system`
üzenet nem keletkezett. `POST /v1/messages/count_tokens` egyszer sem ment ki, tehát a kliens nem is
kérdezte meg az endpointot a token számról.

**Tervezési következmény:** a MiniMax dokumentált 1 000 000 kontextusa és a dokumentált 131 072
ajánlott output token **nem érvényesül** alapbeállítással. A kliens 200 000 / 32 000 értékekkel
tervez. Ez javítható a `[1m]` suffixszel (kontextus) és a `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
változóval (output), de konkrét értéket csak külön mérés után adunk, lásd 3. szekció.

### Q12: küld-e az SDK `anthropic-beta` headert, és melyeket?

**Válasz: igen, kérésfajtánként eltérő listát.**

| Kérés | `anthropic-beta` elemek |
|---|---|
| cím generáló (thin) | `claude-code-20250219`, `interleaved-thinking-2025-05-14`, `thinking-token-count-2026-05-13`, `context-management-2025-06-27`, `prompt-caching-scope-2026-01-05`, `mid-conversation-system-2026-04-07`, `effort-2025-11-24`, `structured-outputs-2025-12-15` |
| fő kérés | ugyanaz, `structured-outputs-2025-12-15` nélkül |
| `[1m]` suffixszel | mindkettő plusz `context-1m-2025-08-07` |

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

| Kérdés | Státusz |
|---|---|
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` valóban leveszi-e MiniMax ellen | **nem mértük.** Dokumentált, de nálunk a `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` volt az, ami levette |
| miért veszi le a `NONESSENTIAL_TRAFFIC` is a cím kérést | a hivatalos leírás felsorolása (auto-update, telemetria, error reporting, `/feedback`, release notes, gateway model discovery, availability check, feature flag) **nem említi** a cím generálást. A mért hatás tehát dokumentálatlan mellékhatás |
| indít-e az SDK más háttérhívást hosszabb sessionben | nem mértük. A `costs` doksi említ `"Conversation summarization"` háttérfeladatot a `--resume`-hoz, ez a mi 1-2 körös futásainkban nem aktiválódott |
| miért `MiniMax-M3` a cím kérés modellje | mért tény, hogy az, de a fallback szabály nincs dokumentálva. Ha egy jövőbeli SDK verzió `claude-haiku-*` alias nevet küldene ki, a MiniMax 404-et adna |

### Kockázat

| Kockázat | Mértéke a mérésből |
|---|---|
| **Költség** | minden `query()` +1 kérés. A 32 cím kérés mérhető input tokenje 799 körül van, output 15 körül. Egy hosszú workflow-ban lépésenként egy ilyen kérés, ez lineárisan skálázódik a lépésszámmal |
| **Rate limit** | az M3 dokumentált limitje 200 RPM. A cím kérés **duplázza** a kérésszámot, tehát a tényleges lépés-átbocsátás a fele a névlegesnek |
| **Hibalehetőség** | ez az egyetlen kérés, ami natív `output_config.format` mezőt küld. A MiniMax M3 ma HTTP 200-zal fogadja, de a [GitHub #28](https://github.com/MiniMax-AI/MiniMax-M2.5/issues/28) issue szerint pont ez a mező dobott 400-at. Ha a MiniMax M3-on is szigorít, **minden `query()` első kérése elhasal**, miközben a fő kérés jó lenne |
| **Adatszivárgás** | a felhasználói prompt teljes szövege kimegy egy második kérésben is. Ha valaha nem ugyanaz a provider szolgálja ki a háttérhívást, a prompt egy másik szolgáltatóhoz kerülne |

A hibalehetőség és a rate limit együtt indokolja, hogy a cím kérést a `minimax` providernél
alapból kikapcsoljuk.

---

## 3. Nyitva maradt kérdések

1. **Q8: a `Stop` hook `decision: "block"` kikényszerítés.** Javasolt mérés: **M-19**. Az M-10
   megismétlése úgy, hogy a prompt **nem említi** az `emit_output` toolt (például "Számold ki
   mennyi 2+2."). Megfigyelés: aktiválódik-e a blokkoló ág, a `reason` szöveg milyen `role`-lal
   kerül a következő kérés `messages` tömbjébe, hány kör kell, és mennyi a sikerarány 10 futáson.
2. **Q11 szerver oldali fele: mennyi kontextust szolgál ki ténylegesen az endpoint.** Javasolt
   mérés: **M-20**. `model: 'MiniMax-M3[1m]'`, egyetlen session, addig növelt promptmérettel, amíg
   a `413 request_too_large` meg nem érkezik vagy a 200 000 tokent át nem lépi a sikeres kérés.
   Megfigyelés: a legnagyobb sikeres `usage.input_tokens`, és hogy a compact hol indul.
3. **A `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` tényleges hatása.** Javasolt mérés: **M-21**. Egy
   futás ezzel az egyetlen env eltéréssel. Megfigyelés: eltűnik-e a cím kérés, és eltűnik-e vele a
   `DesignSync` tool (ami a `NONESSENTIAL_TRAFFIC` kapcsolónál eltűnt). Ez dönti el, hogy a
   célzottabb kapcsolót használhatjuk-e a durvább helyett.
4. **A `CLAUDE_CODE_MAX_OUTPUT_TOKENS` felső korlátja MiniMax ellen.** Javasolt mérés: **M-22**.
   Futások növekvő értékekkel, a MiniMax dokumentált ajánlott 131 072 és hard 524 288 értékei
   mentén. Megfigyelés: a kimenő `max_tokens` mező értéke és a válasz HTTP kódja. Konkrét
   javasolt érték addig nincs, amíg ez nem fut le.
5. **M-16 kép bemenet érvénytelen tesztképpel.** A mérés 1x1 pixeles PNG-t küldött, és a modell
   `"Nem látok képet a beszélgetésben."` választ adott. Ebből **nem** dönthető el, hogy a MiniMax
   eldobta a képet, vagy a modell egy egypixeles képről nem tud mit mondani. Javasolt mérés:
   **M-23**, felismerhető tartalmú képpel (például egy nagy, egyszínű négyzet ismert színnel).
6. **Prompt cache létrehozás igazolása.** M-15 egyik futásában sem jelent meg
   `cache_creation_input_tokens` a stream `message_delta` eventjeiben, csak
   `cache_read_input_tokens`. Javasolt mérés: **M-24**, a nem stream `usage` objektum rögzítése
   (`stream: false` kérés), hogy a cache írás igazolható legyen.
7. **Rate limit és hiba headerek.** A mérés alatt nulla 429 és nulla 5xx keletkezett, ezért
   `retry-after` és `ratelimit` jellegű header nem figyelhető meg. Javasolt mérés: **nincs.**
   Szándékos rate limit kimerítést nem végzünk, a mező `unknown` marad.
8. **Szerver oldali `web_search` tényleges lefutása.** M-17 nyolc kérése között három olyan van,
   ami csak a `web_search_20250305` toolt küldi, de egyik válasz sem tartalmaz `server_tool_use`
   vagy `web_search_tool_result` blokkot. Javasolt mérés: **M-25**, magasabb `maxTurns` értékkel,
   hogy a limit ne zavarjon bele. Bár a 4. szekció döntése ettől független, lásd lent.

---

## 4. Tervezési következmények

### 4.1 A `minimax` provider kötelező `env` blokkja

| Változó | Érték | Miért | Bizonyíték |
|---|---|---|---|
| `ANTHROPIC_BASE_URL` | `https://api.minimax.io/anthropic` | endpoint | research 2. szekció |
| `ANTHROPIC_AUTH_TOKEN` | `MINIMAX_API_KEY` process env átvétel, **csak a NÉV perzisztálódik** | auth | research 2. és 3. szekció |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | `1` | **ez a mérésben igazoltan levette a session cím generáló kérést**, ezzel felezi a kérésszámot és megszünteti az egyetlen natív `output_config.format` kockázatot | M-07 b, M-08 |
| `DISABLE_PROMPT_CACHING` | **nem állítjuk be** | a `cache_control` blokkok kimennek és a MiniMax fogadja őket, a cache olcsóbbá teszi a hosszú workflow-t | M-08, M-15 |

**Amit szándékosan nem teszünk bele:**

- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`: MiniMax ellen nincs rá szükség (minden kérés 200),
  viszont levenné a `context_management` mezőt, ami az M3 interleaved thinking takarítását végzi.
- `MAX_THINKING_TOKENS=0`: aszimmetrikus (body mezőt vesz le, headert nem), és kikapcsolná az M3
  adaptív thinkingjét.
- `ENABLE_TOOL_SEARCH=false`: mérhetetlen hatás, custom base URL mellett amúgy is kikapcsolt.
- `CLAUDE_CODE_MAX_OUTPUT_TOKENS`: **konkrét értéket nem adunk**, amíg az M-22 mérés le nem fut.
- Alias feloldó változók (`ANTHROPIC_DEFAULT_HAIKU_MODEL` stb.): nem kötelezőek, mert a dróton
  soha nem jelent meg alias név.

**Tiltott változók** (research 3. szekció): `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING`,
`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING`.

### 4.2 Alapértelmezett strukturált kimenet stratégia

**Az alapértelmezés `sdk_output_format` legyen.**

| | `sdk_output_format` | `emit_output_tool` |
|---|---|---|
| végigfutott MiniMax ellen | **igen**, M-03, `subtype: success`, kitöltött `structured_output` | igen, M-10, 3/3 futás |
| kényszerítés bizonyított | nem is kell, a tool leírása elég | **nem**, a blokkoló ág sosem futott |
| kényszerített `tool_choice` kimegy-e | nem, 79/79 kérésben | nem releváns |
| séma validáció | az SDK végzi, `error_max_structured_output_retries` result subtype létezik | saját kód |

Indoklás: a `sdk_output_format` mellett mérési bizonyíték áll a teljes láncra, az
`emit_output_tool` mellett csak a happy pathra. Az `emit_output_tool` `usable` mezője ezért
`unknown` marad, nem `false`: a mechanizmus lehet hogy működik, csak nem mértük.

**Kötelező kísérő beállítás:** `maxTurns` legalább 2. Az M-02 futás azért esett
`error_max_turns`-be, mert `maxTurns: 1` mellett a `StructuredOutput` tool hívása külön kört
igényel. Ez a lépés-futtató alapértelmezésébe be kell épüljön.

### 4.3 Letiltandó UI vezérlők a `minimax` provider választásakor

| Vezérlő | Miért |
|---|---|
| `tool_choice` `any` és `tool` opció | a MiniMax csak `auto`/`none` értéket fogad, és az SDK sem küld mást. A UI ne kínálja fel |
| `thinking` fix budget (`budget_tokens`) | a MiniMax sémájában nincs ilyen kulcs, az SDK sem küldi. Csak `adaptive` és `disabled` maradhat |
| `WebSearch` tool engedélyezése | **kritikus**, lásd 4.4 |
| modell-lista lekérés az endpointról | nincs `GET /v1/models` hívás, a lista config fájlból jön (Q10) |
| kép csatolás | Q11 nyitott: az M-16 mérés érvénytelen tesztképpel futott. A vezérlő addig letiltva vagy figyelmeztetéssel |

### 4.4 A `WebSearch` tool tiltása a `minimax` providerrel

**Ez a mérés második legfontosabb, önálló megállapítása, és nem szerepel a Q1-Q12 listán.**

Saját ellenőrzés (M-17, `00019-1787707009344.json`): a Claude Code `WebSearch` toolja egy beágyazott
alkérést indít **ugyanarra a base URL-re**, `system` promptja `"You are an assistant for performing
a web search tool use"`, `tools` tömbje egyetlen elem:
`{"type":"web_search_20250305","name":"web_search","max_uses":8}`, `tool_choice: {"type":"auto"}`.

A MiniMax ezt a szerver oldali toolt **csendben eldobja**: HTTP 200, de a válaszban nincs
`server_tool_use` és nincs `web_search_tool_result` blokk. A modell ehelyett a saját tudásából
válaszol. A rögzített válasz szó szerint felajánlja, hogy `"searches for more specific
information"`, tehát a felhasználó felé úgy néz ki, mintha keresés történt volna.

**Következmény: a `WebSearch` toolt a `minimax` providernél a `disallowedTools` listára kell tenni.**
Nem hibázik, hanem hallgatólagosan hamis, forrás nélküli választ ad, ami a projekt
"minden állítást validálni kell" alapelvével összeegyeztethetetlen.

### 4.5 Költségjelentés

A `result.total_cost_usd` és a `modelUsage` **first-party árazással** számol
(`provider: "firstParty"`, `canonicalModel: "minimax-m3"`). Az M-13 futás triviális prompttal
`0.213 USD` költséget jelentett. **Ez az érték a `minimax` providernél nem használható.** A
workflow futtató UI vagy elrejti, vagy saját, MiniMax árazású számítást használ. Konkrét árat
ebbe a dokumentumba nem írunk, mert nem mértük.

### 4.6 SDK verzió pinelés

A leírók `sdkVersionPin` mezője `0.3.245`. A mérésből látszik, hogy a body mezőlista bővül
(`output_config`, `context_management` a research fájl írásakor még nem volt megerősítve
kimenőként). Minden SDK frissítés előtt az M-01 ... M-18 sor újrafuttatandó, és a jelen
dokumentum Q1-Q12 lezárásai újranyitandók.
