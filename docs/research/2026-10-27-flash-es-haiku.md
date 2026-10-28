# A MiniMax-M3.1-Flash csere, a két kulcsnév és a thinking átadás: források és tények

|              |                                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dátum        | 2026-10-27                                                                                                                                           |
| Kimenet      | [`../spec/SPEC-013-flash-es-haiku.md`](../spec/SPEC-013-flash-es-haiku.md)                                                                           |
| Módszer      | hivatalos dokumentáció (Exa keresés és letöltés, plusz `curl` a `.md` alakra), a telepített, pinelt SDK forrásának olvasása, npm registry lekérdezés |
| Valódi hívás | **nem történt.** Minden állítás dokumentumból vagy a telepített forrásból származik; ahol ez kevés, a sor "nem ellenőrzött" jelölést kap             |

A szabálykönyv 4. szekciója szerint minden tény mellé elsődleges forrás és két független megerősítés
kell. Ahol a megerősítés ugyanattól a kiadótól jön (MiniMax saját lapjai), az az oszlopban így áll.

---

## 1. A user döntései (2026-10-27), szó szerint

1. "megváltozott a model név": a MiniMax modell a `MiniMax-M3.1-Flash`, a `MiniMax-M3` HELYÉRE lép.
2. A MiniMax kulcs a `.env` fájlban `ANTHROPIC_API_KEY` és `ANTHROPIC_AUTH_TOKEN` néven is működjön
   ("Mindkettő működjön").
3. A Claude próbához a legolcsóbb modell kell: `claude-haiku-5-5`, a Claude katalógusba felvéve.
4. Utána valódi próba fut mindkét providerrel (`bun run probe:real-provider`), alacsony tokennel.

**A 2026-10-27-i második döntéskör** (a SPEC-013 11. szekciója): a `claude-haiku-5-5` kikerült a
hatókörből (a user: "miert kell a haiku"; a Claude próba előfizetéssel fut, nem tokenár alapon), nincs SDK
frissítés, a Claude próba a katalógusban álló `claude-haiku-4-5`-tel fut. A 3. és 4. szekció a
`claude-haiku-5-5`-ről megállapításként marad, a hatókörbe nem tartozik.

---

## 2. MiniMax-M3.1-Flash

| Tény                                                         | Érték                                                                                                                              | Elsődleges forrás                                                                           | Megerősítés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Megjelenés                                                   | 2026-10-19                                                                                                                         | <https://www.minimax.io/blog/minimax-m31f>                                                  | <https://7minai.com/how-to-use-minimax-m3-1-flash/>, <https://www.typingmind.com/guide/minimax/MiniMax-M3.1-Flash>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| API azonosító                                                | `MiniMax-M3.1-Flash`                                                                                                               | <https://platform.minimax.io/docs/api-reference/text-anthropic-api> ("Supported Models")    | <https://platform.minimax.io/docs/guides/text-generation>, <https://wokey.ai/models/MiniMax-M3.1-Flash>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Claude Code kliens azonosító                                 | `MiniMax-M3.1-Flash[1m]` (`ANTHROPIC_MODEL` és a három `ANTHROPIC_DEFAULT_*_MODEL`)                                                | <https://platform.minimax.io/docs/m-plan/claude-code>                                       | <https://platform.minimax.io/docs/token-plan/claude-code> (MiniMax, ugyanaz a kiadó). **Két független megerősítés (2026-10-27, Exa letöltés, a lapok szövegét olvasva):** <https://pchalasani.github.io/claude-code-tools/integrations/alt-llm-providers/> (a `ccmm` shell függvény `ANTHROPIC_MODEL` és mindhárom `ANTHROPIC_DEFAULT_*_MODEL` értéke `MiniMax-M3.1-Flash[1m]`, a `[1m]` utótagot 1 milliós kontextus jelzésként magyarázza) és <https://www.digitalapplied.com/blog/run-minimax-m3-1-flash-inside-claude-code-setup> (a `settings.json` példa ugyanezt a négy változót ugyanerre az értékre állítja). A két lap szerzője a MiniMaxtól és egymástól független; a leíró `known` mezője ezzel az elsődleges forrásra plusz két független megerősítésre épül                                                                             |
| Kontextus ablak                                              | 1 000 000                                                                                                                          | text-anthropic-api ("Supported Models")                                                     | text-generation guide, 7minai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Kimenő token, ajánlott / felső                               | 131 072 / 524 288                                                                                                                  | <https://platform.minimax.io/docs/api-reference/text-chat-openai> (`max_completion_tokens`) | <https://platform.minimax.cn/docs/api-reference/text-chat-openai>, 7minai, wokey                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Thinking                                                     | mindig gondolkodik; `thinking` elhagyva és `{"type":"adaptive"}` mellett be, `{"type":"disabled"}` mellett `400`, a hibakód `2013` | text-anthropic-api ("Thinking Control" tábla és a hibaszöveg)                               | <https://platform.minimax.io/docs/api-reference/text-openai-api>, m-plan/claude-code ("always enables thinking and cannot turn it off"), 7minai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `MAX_THINKING_TOKENS=0`                                      | a Flash-re nincs hatása, a modell gondolkodik                                                                                      | m-plan/claude-code ("How to adjust thinking depth")                                         | nincs második forrás: **nem ellenőrzött** a "nincs hatása" rész, a 400 kockázat a 6. szekcióban                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Effort                                                       | `output_config.effort`: `low`, `medium`, `high`, `xhigh`, `max`; elhagyva `max`; `none` `400`                                      | text-anthropic-api ("Thinking Depth Control")                                               | text-generation guide (protokollonkénti mezőtábla), text-openai-api (`reasoning_effort`), 7minai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Claude Code alap effort, ha `CLAUDE_CODE_EFFORT_LEVEL` nincs | `high`                                                                                                                             | m-plan/claude-code                                                                          | nincs második forrás: **nem ellenőrzött**, a pinelt CLI-n nem mérve                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `service_tier`                                               | a Flash nem támogatja                                                                                                              | text-anthropic-api                                                                          | text-openai-api, 7minai                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tool_choice`                                                | az Anthropic kompatibilis lap paraméter táblája "Fully supported" jelölést ad                                                      | text-anthropic-api                                                                          | **ellentmondás:** a feladat bemenete szerint a "mai doksi szerint csak `auto`"; ezt az olvasott lapokon nem találtam. A leíró mezője mindkét esetben `unknown` (SPEC-013 3.2), a mérés dönt                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Kép és videó bemenet                                         | a lap szerint `M3.1-Flash / M3 only` támogatott                                                                                    | text-anthropic-api ("Messages Field Support")                                               | 7minai, typingmind. **A repó saját M-23 mérése az M3-ra az ellenkezőjét adta** (a kép kimegy, a szolgáltatás eldobja), tehát a dokumentáció és a mérés ütközik; a Flash mezője `unknown`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Rate limit                                                   | 200 RPM, 10 000 000 TPM, egy sorban az M3-mal (a MiniMax lapján)                                                                   | <https://platform.minimax.io/docs/guides/rate-limits>                                       | **Nincs két független megerősítés, a leíró mezői `unknown`.** Keresés (Exa, 2026-10-27): a <https://platform.minimax.cn/docs/guides/rate-limits> ugyanaz a kiadó (a kínai lap a számokat a feltöltött (fizető) fiók soraként adja, a szabad fióknak 20 RPM és 1 000 000 TPM áll, a `.io` lap ezt a megkülönböztetést nem tartalmazza); az Alibaba Cloud Model Studio lapja (<https://help.aliyun.com/en/model-studio/minimax-m3-1-flash>) ugyanezt a két számot a saját, "China (Beijing)" szolgáltatására írja, ami nem a MiniMax API limitje; az OrcaRouter két bejegyzése (<https://www.orcarouter.ai/blog/minimax-m3-1-flash-release-date>, <https://www.orcarouter.ai/blog/minimax-m3-1-flash-vs-deepseek-v4-flash>) a MiniMax lapjának táblázatát idézi, egy kiadó, másodlagos. Független, a MiniMax lapjától nem származó forrás nem található |
| Ár (USD / 1M token)                                          | 0.15 bemenet, 0.60 kimenet                                                                                                         | 7minai (a MiniMax árlapjára hivatkozva)                                                     | wokey, typingmind. Az ár a leíróban nem szerepel, csak a "legolcsóbb" kérdéshez tájékoztató                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Az Anthropic kompatibilis kulcs neve                         | a Claude Code lapok `ANTHROPIC_AUTH_TOKEN`-t írnak, az SDK lap `ANTHROPIC_API_KEY`-t                                               | m-plan/claude-code, token-plan/claude-code                                                  | text-anthropic-api ("Configure Environment Variables"); a curl példa `Authorization: Bearer` fejlécet használ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

---

## 3. claude-haiku-5-5 (megállapítás, a hatókörön kívül)

| Tény                   | Érték                                                                                                                  | Elsődleges forrás                                                          | Megerősítés                                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| API azonosító          | `claude-haiku-5-5`, dátum utótag és külön alias nélkül                                                                 | <https://platform.claude.com/docs/en/models/haiku-5-5/overview>            | <https://platform.claude.com/docs/en/models/overview>, <https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide> |
| Megjelenés             | 2026-10-07                                                                                                             | haiku-5-5 overview                                                         | models overview (retirement sor: "Not sooner than October 7, 2027")                                                           |
| Kontextus / max output | 1M / 128K                                                                                                              | haiku-5-5 overview                                                         | models overview, <https://platform.claude.com/docs/en/build-with-claude/context-windows>                                      |
| Kép bemenet            | igen ("Text and images → text")                                                                                        | haiku-5-5 overview                                                         | models overview ("All current models support text and image input")                                                           |
| Thinking               | adaptív, alapból be; `disabled` `high` effort vagy alatta megengedett                                                  | <https://platform.claude.com/docs/en/models/haiku-5-5/whats-new-haiku-5-5> | haiku-5-5 overview, models overview                                                                                           |
| Alap effort            | `medium`                                                                                                               | haiku-5-5 overview                                                         | models overview                                                                                                               |
| Ár (USD / 1M token)    | "From $0.10" bemenet, "From $0.50" kimenet                                                                             | haiku-5-5 overview                                                         | models overview. A katalógus többi modelljének árát ez a fájl nem ellenőrizte; a "legolcsóbb" a user döntése                  |
| Claude Code minimum    | "Use v2.1.293 or later with Haiku 5.5"                                                                                 | <https://code.claude.com/docs/en/model-config>                             | lásd 4. szekció                                                                                                               |
| `[1m]` utótag          | nincs: a lap szerint a natív 1M ablakos modelleknél az `[1m]` alias hatástalan, a Haiku 5.5 azonosítója utótag nélküli | model-config, migration-guide                                              | context-windows ("1M is the default: you don't need a beta header")                                                           |

---

## 4. A pinelt SDK által csomagolt Claude Code verzió (megállapítás: blokkoló lenne a claude-haiku-5-5-re)

**Telepített forrás olvasása (2026-10-27).** A repó a `@anthropic-ai/claude-agent-sdk@0.3.245`-öt pineli.
A telepített csomag `manifest.json` fájljának `version` mezője `2.1.245`, a natív bináris
(`@anthropic-ai/claude-agent-sdk-linux-arm64@0.3.245`) beágyazott `VERSION` konstansa szintén `2.1.245`.
A bináris karakterláncai között a `claude-haiku-` előtagú azonosítók közül csak a `claude-haiku-4-5`
család szerepel, a `claude-haiku-5-5` nem.

**npm registry (2026-10-27).** A `https://registry.npmjs.org/@anthropic-ai/claude-agent-sdk` dokumentum
`claudeCodeVersion` mezője a `0.3.245`-nél `2.1.245`, a `0.3.293`-nál `2.1.293` (megjelent
2026-10-07). Megerősítés: a `0.3.293` csomag `manifest.json` fájlja `"version": "2.1.293"` mind az
`unpkg.com`, mind a `cdn.jsdelivr.net` tükrön. A `latest` dist-tag a lekérdezéskor `0.3.311`.

**A szerver elutasít.** A Claude Code hibareferenciája szerint a túl régi kliens kérését az API `400`
válasszal, `claude_code_version_too_old` hibakóddal utasítja el, a modellenként a szerver által ellenőrzött
minimum alapján (<https://code.claude.com/docs/en/errors>, "Claude Code does not support this model").
Megerősítés: <https://koromo.io/blog/claude-code-does-not-support-this-model/>,
<https://claude-media.com/articles/claude-code-does-not-support-this-model> (mindkettő kimondja, hogy az
Agent SDK csomagba ágyazott CLI-t az SDK csomag frissítése cseréli).

**Következmény.** A pinelt `0.3.245` mellett egy `claude-haiku-5-5` lépés a szerver oldali `400`
miatt nem futhat le. A legkisebb SDK verzió, ami legalább `2.1.293`-as Claude Code-ot csomagol, a
`0.3.293`. A szabálykönyv 9. szekciója szerint SDK frissítés előtt a SPEC-000 mérései regresszióként
futnak, ami valódi MiniMax hívás. A user döntése (SPEC-013 O-1): nincs SDK frissítés, a
`claude-haiku-5-5` nem kerül be.

---

## 5. A két kulcsnév a Claude Code-ban

- `ANTHROPIC_API_KEY`: `X-Api-Key` fejléc; beállítva felülírja a Claude előfizetést
  (<https://code.claude.com/docs/en/env-vars>).
- `ANTHROPIC_AUTH_TOKEN`: az `Authorization` fejléc értéke `Bearer ` előtaggal (env-vars).
- Hitelesítési sorrend: 2. `ANTHROPIC_AUTH_TOKEN`, 3. `ANTHROPIC_API_KEY`
  (<https://code.claude.com/docs/en/authentication>, "Authentication precedence"). Megerősítés: a
  repó korábbi forrásolt összefoglalója (`RESEARCH_AUTH_PRECEDENCE`, SPEC-012 2.2) és a MiniMax Claude
  Code lapja, ami a beállítás előtt mindkét változó törlését kéri, mert "They take priority over the
  settings file".
- A repó saját M-34 és M-35 mérése `x-api-key` fejléccel közvetlen hívásra `200` választ kapott a MiniMax
  ellen (`2026-08-26-spec000-kiertekeles.md` 6.9, 6.10). **A CLI-n át `ANTHROPIC_API_KEY`-vel a MiniMax
  felé nincs mérés.** A projekt minden eddigi CLI-s MiniMax futása `ANTHROPIC_AUTH_TOKEN`-nel ment
  (SPEC-012 O-1, a wire-probe O-20).
- Mindkettő beállítva: a CLI viselkedése (melyik fejléc megy ki, van-e figyelmeztetés) **nem mérve**.
  SPEC-013 4.2 ezért úgy dönt, hogy a kimenő környezetben csak egy név áll.

---

## 6. A thinking út a pinelt SDK-ban (telepített forrás olvasása, nem mérés)

1. **Az SDK a `thinking` opciót objektumként olvassa.** A `sdk.mjs` a `thinking` opcióra
   `switch(thinking.type)` ágakat futtat (`adaptive`, `enabled`, `disabled`), és ebből képez CLI kapcsolót
   (`--thinking adaptive|disabled`, `--max-thinking-tokens`). A `sdk.d.ts` szerint a típus `ThinkingConfig`
   objektum (`{ type: 'adaptive' }` stb.).
2. **Mellékes lelet: a motor szöveget ad át.** A `packages/engine` `AgentStepOptions.thinking` mezője
   `ThinkingMode` szöveg (`'adaptive'`), amit a `build-agent-step-options.ts` változatlanul tesz az
   `Options.thinking` mezőbe. Egy szöveg `.type` mezője `undefined`, tehát az SDK egyik ágba sem lép, és
   a lépés thinking beállítása **nem jut el a CLI-ig**. A user döntése szerint ebben a körben javítandó
   (SPEC-013 O-5, 5. szekció, a forrás pontos helye a 10.3 alatt); a valódi próbát nem érinti, mert ott a
   lépés `thinking` mezője `null`.
3. **A CLI alapértéke.** A natív bináris beágyazott forrása szerint thinking beállítás nélkül a CLI
   `{type:"adaptive"}` konfigurációval indul; egy beállítás hamis értékénél `disabled`-del (a minifikált
   kódból a beállítás neve nem állapítható meg; a MiniMax lap az `alwaysThinkingEnabled`-et nevezi meg,
   **nem ellenőrzött**, hogy ez az). A kéréshez `{type:"disabled"}` csak akkor kerül, ha a konfiguráció `disabled`, a provider
   first party, és a modell a CLI szerint thinking képes; ha a modell a CLI szerint nem thinking képes, a
   mező elmarad. A Flash a 2. szekció szerint elhagyott mezővel és `adaptive` értékkel is gondolkodik,
   tehát az alapút nem ad `400`-at. Hogy a CLI a `MiniMax-M3.1-Flash[1m]` azonosítót thinking képesnek
   tekinti-e, **nem mérve**: az M3-ra az M-01 az `adaptive` alakot mérte.
4. **Ami `disabled`-et válthat ki:** a lépés `disabled` beállítása (ma a 2. pont hibája miatt el sem
   jut), a `MAX_THINKING_TOKENS=0` (a `minimax` tiltott listáján áll), és az `alwaysThinkingEnabled: false`
   felhasználói beállítás (a szerver környezetén kívüli Claude Code beállítás, a projekt nem állítja).

---

## 7. A motor viselkedése `unknown` mezővel (a repó forrása)

Egy eszköz nélküli, strukturált kimenet nélküli `agent_step` lépésnél (a próba lépése) a
`validateAgentStepCapabilities` sorrendje: modellválasztás (`requireModelSelection`), modellazonosító
(`validateModelId`), thinking (`resolveThinkingMode`: a lépés `null` értékénél `omit`), effort
(`resolveEffortInclusion`: `null`-nál `omit`), kényszerített `tool_choice` kockázat (`unknown` mezőknél
nincs hiba), strukturált kimenet (nem kért). Egyik `unknown` mező sem buktatja a lépést; a hatásuk:

| Leíró mező `unknown`                     | Hatás                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| `models[].clientModelIdentifier`         | a wire azonosító megy a kliensnek (`[1m]` nélkül), `modelIdentifierUnproven: true`       |
| `streaming.sse`                          | `includePartialMessages: false`: az élő nézet nem kap delta eseményt ettől a providertől |
| `serverTools`                            | nincs tiltás, `serverToolAvailabilityUnproven: true`                                     |
| `concurrency.measuredMaxConcurrentSteps` | nincs párhuzamossági javaslat                                                            |
| `modelsEndpoint.calledBySdk`             | a kapcsolat teszt `minimal_query` módon fut                                              |
| `thinking.byModelFamily[család]`         | a lépés thinking beállítása elmarad, hiba nélkül                                         |
| `effort.accepted`                        | a lépés effort beállítása elmarad                                                        |

A modell szintű leíró mezőket (`contextWindow`, `maxOutputTokens*`, `imageInput`, `videoInput`,
`listedByModelsEndpoint`) a motor nem olvassa (a `packages/engine/src` alatt nincs rájuk hivatkozás).

---

## 8. Az ártábla

A pinelt natív bináris karakterláncai között a `minimax` szó csak egy szolgáltatónév listában
(reguláris kifejezés) fordul elő, modell ártábla bejegyzésként nem; a `2026-09-23-sdk-koltseg-becsles.md`
2.2 szekciójában leírt tartalék ág tehát a `MiniMax-M3.1-Flash`-re is érvényes. Ez a `RunEventRow`
magyarázó mondatának cseréjét támasztja alá (SPEC-013 3.5).

---

## 9. Nem ellenőrzött pontok összesítve

1. A pinelt CLI a `MiniMax-M3.1-Flash[1m]` azonosítóból a dróton utótag nélküli azonosítót küld-e
   (az M3-ra M-11 mérte).
2. A pinelt CLI a Flash-nél küld-e `thinking` mezőt, és milyen alakban (6. szekció 3. pont).
3. A `tool_choice`, a strukturált kimenet, a cache, a streaming, a szerver eszközök, a béta fejlécek és a
   párhuzamosság a Flash-nél (az M3 mérései nem vihetők át, SPEC-013 3.2).
4. A CLI viselkedése, ha `ANTHROPIC_API_KEY` és `ANTHROPIC_AUTH_TOKEN` egyszerre áll a környezetében.
5. A Claude Code alap effort értéke a pinelt CLI-n (a MiniMax lap `high`-ot ír).

---

## 10. A második döntéskör forrásai (2026-10-27)

### 10.1 A pinelt CLI ismeri a `claude-haiku-4-5` azonosítót

Telepített forrás olvasása, `grep -a` a pinelt natív binárison
(`@anthropic-ai/claude-agent-sdk-linux-arm64@0.3.245`, `claude` fájl, beágyazott `VERSION` `2.1.245`, 4.
szekció): a `claude-haiku-4-5` karakterlánc 93-szor fordul elő (57 sorban), köztük a modell választó
listájában (`value:"haiku",label:"Haiku",description:"Haiku 4.5 ..."`), a modell azonosító leképezésben
(`claude-haiku-4-5` -> `claude-haiku-4-5-20251001`) és az ismert modellek halmazában. A
`claude-haiku-5` karakterlánc nulla találat (a 4. szekció megállapításával egyezik). A katalógus
bejegyzés (`packages/provider-claude-subscription`) már tartalmazza a `claude-haiku-4-5`-öt, tehát a
Claude próba ehhez nem igényel kódváltozást a leíróban.

### 10.2 A `claude-haiku-4-5` az effort paramétert nem támogatja (SPEC-013 O-6)

| Forrás                                                                                                                                          | Állítás                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <https://platform.claude.com/docs/en/build-with-claude/effort> (elsődleges; a lap `supportedModels` listája, `.md` alakban letöltve 2026-10-27) | a támogatott modellek listájában a Haiku családból csak a `claude-haiku-5-5` áll, a `claude-haiku-4-5` nem                                                                            |
| <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5>                                           | "Claude Haiku 5.5 is the first Haiku model with effort levels", és az effort "replaces the thinking budget (`budget_tokens`) that Claude Haiku 4.5 used"                              |
| a pinelt CLI bináris (10.1), saját olvasás                                                                                                      | az effort támogatást eldöntő függvény a `claude-haiku-4-5` azonosítóra `false` értéket ad (`n==="claude-haiku-4-5")return!1`, a `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` ellenőrzése előtt) |

Következmény: a `claude-subscription` próba lépése `effort` nélkül fut (SPEC-013 6.). A
`claude-subscription` leíró `effort.accepted` mezője provider szintű `known` `true` (a `DOC_EFFORT`
bizonyítékkal), modellre nem bont; ez a SPEC-013 9. szekciójában javaslatként áll, nem e spec hatóköre.
Hogy a pinelt CLI egy `claude-haiku-4-5` lépés effort beállítását elhagyja-e vagy elküldi, **nem mért**.

A MiniMax próba `effort: 'low'` értékének forrása a 2. szekció "Effort" sora (text-anthropic-api
"Thinking Depth Control": `low`, `medium`, `high`, `xhigh`, `max`), a leíró `effort.accepted` mezője a
Flash-re `known` `true` (SPEC-013 3.2). Hogy a pinelt CLI a `MiniMax-M3.1-Flash[1m]` azonosítóra kiküldi-e
az effortot, **nem mért** (az M3-ra az M-04 és az M-26 mérte); a valódi próba ezt nem rögzíti, mert a
próba a kimenő kérés törzsét nem naplózza.

### 10.3 A thinking átadás helyes alakja (SPEC-013 O-5)

Telepített forrás olvasása, `@anthropic-ai/claude-agent-sdk@0.3.245`:

- `sdk.d.ts` 1698. sor: `thinking?: ThinkingConfig;` az `Options` típusban; 8116. sor:
  `export declare type ThinkingConfig = ThinkingAdaptive | ThinkingEnabled | ThinkingDisabled;`, ahol
  `ThinkingAdaptive = { type: 'adaptive'; display?: 'summarized' | 'omitted' }`,
  `ThinkingDisabled = { type: 'disabled' }`, `ThinkingEnabled = { type: 'enabled'; budgetTokens?: number; ... }`.
- `sdk.mjs`: a `thinking` opciót `switch(rt.type){case"adaptive":...case"enabled":...case"disabled":...}`
  ágakkal olvassa (egy találat); szöveg értéknél egyik ág sem fut, és a `maxThinkingTokens` ágra sem
  lép, mert az csak a `thinking` hiányában fut.

A motor leképezése ezért: `adaptive` -> `{ type: 'adaptive' }`, `disabled` -> `{ type: 'disabled' }`; az
`always_on`-nak nincs SDK ága, a mező elmarad (SPEC-013 5.2).

---

## 11. Kiinduló állapot (PLAN-014 T-014-1)

- A branch `feat/spec-013-flash-es-haiku`, a kiinduló fej `cbd9583`, ami a friss `origin/main`
  (`986399a`) leszármazottja; a munkakönyvtár tiszta.
- A kilenc kapu a kiinduló fejen (a spec átvezetésével együtt) nulla kilépési kóddal futott; a `test`
  kapu 616 tesztfájl, 6452 teszt, 100 százalék lefedettség mind a négy metrikán.

---

## 12. Adverzariális átvizsgálás és kritérium tábla (PLAN-014 T-014-11)

Független átvizsgálás (`opus`, `medium`) a `fa0502e..8fab0e5` commitokon, a SPEC-013 ellen. Talált és
javított tételek:

| Tétel                                                                                                                                                                 | Kezelés                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `thinking.interleavedSignatureRequired` `known` értékének nincs forrásolt sora a 2. szekcióban                                                                      | `unknown` lett (M-05), a SPEC-013 3.2 sora átvezetve                                                                                                                          |
| A `tools/wire-probe` harness a teljes `process.env`-et adta a CLI-nek, így egy `ANTHROPIC_API_KEY` is kimehetett, és a `meta.json` maszkolása ezt a nevet nem ismerte | a CLI környezetéből mindkét név kikerül, a `meta.json` mindkét név értékét maszkolja; greppes teszt az `environment.spec.ts`-ben                                              |
| A `tools/wire-probe` az üres értéket hiányzónak veszi, a szerver beállítottnak                                                                                        | a szerver is hiányzónak veszi (második review, lásd 14. szekció); SPEC-013 4.3 és 4.7 átírva                                                                                  |
| A szabálykönyv 9. szekciójának képesség mondata és titok mondata az előző modell és egy kulcsnév szerint állt                                                         | átírva a SPEC-013 3.2, 3.3, 4. szerint                                                                                                                                        |
| A `packages/engine` `CLAUDE.md` típusfájl száma és a `provider-environment` sor elavult                                                                               | javítva                                                                                                                                                                       |
| A `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` indoklása a forrásnál többet állított (a `budget_tokens` elutasítása)                                                       | a mondat a dokumentált részre szűkítve                                                                                                                                        |
| A `promptCaching.mode` blokkoló listája eltért a spec sorától                                                                                                         | a spec mondja ki, hogy a már `unknown` mező a saját listáját tartja                                                                                                           |
| A `disallowedEnv` és `requiredEnv` M-xx bizonyítékai                                                                                                                  | a SPEC-013 3.3 kimondja: CLI viselkedést mértek, modelltől független tényként maradnak                                                                                        |
| A `clientModelIdentifier` és a rate limit egy kiadó lapjain áll                                                                                                       | lezárva (2026-10-27, user kérés): a `clientModelIdentifier` két független megerősítést kapott (2. szekció), a rate limit mezők `unknown`-ra álltak (2. szekció, SPEC-013 3.2) |

**Kritérium tábla.**

| AC   | Bizonyíték                                                                                                                                                       |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1  | `git grep -n "MiniMax-M3" -- packages apps tooling`: a `MiniMax-M3.1-Flash`-en kívül egyetlen találat, a v1 pillanatkép fixtúra (3.6 kivétel)                    |
| AC2  | `packages/provider-minimax/src/descriptor/descriptor.spec.ts` "pontosan egy modell, a Flash azonosítóval és családdal"                                           |
| AC3  | `descriptor.spec.ts` known és unknown blokkja; `packages/provider-registry` `provider-registry.spec.ts` (bizonyíték kényszer, mérési azonosító nélküli `reason`) |
| AC4  | `apps/server/src/minimax-flash-capabilities/minimax-flash-capabilities.spec.ts` (AC4)                                                                            |
| AC5  | ugyanott (AC5); `apps/server/measurement/run-probe.spec.ts` minimax kérés: `MiniMax-M3.1-Flash[1m]`                                                              |
| AC6  | `provider-outgoing-environment.spec.ts` (AC6); `build-outgoing-environment.spec.ts` alternatív név eset                                                          |
| AC7  | `provider-outgoing-environment.spec.ts` (AC7); `resolve-required-environment-value.spec.ts` "mindkettő áll: a name nyer"                                         |
| AC8  | `provider-outgoing-environment.spec.ts` (AC8); `resolve-required-environment-value.spec.ts` "egyik sem áll"                                                      |
| AC9  | `provider-outgoing-environment.spec.ts` claude-subscription tiltott nevek                                                                                        |
| AC10 | `collect-secret-environment-values.spec.ts` két új esete                                                                                                         |
| AC11 | `provider-environment-drift-protection.spec.ts` (AC11)                                                                                                           |
| AC12 | `create-workflow-modal.spec.tsx`, `list-providers.spec.ts`, `provider-summary.spec.ts`, `apps/web/e2e/workflow-list.spec.ts`                                     |
| AC13 | `build-agent-step-options.spec.ts` (a régi kódon bukott), `apps/server/src/engine-assembly/build-agent-query-runner.spec.ts` (`Options['thinking']` típus)       |
| AC14 | `build-probe-graph.spec.ts`, `run-probe.spec.ts`                                                                                                                 |
| AC15 | `.claude/CLAUDE.md` 9. szekció                                                                                                                                   |
| AC16 | ez a fájl, `README.md`, a két `.env.example`, a csomag `CLAUDE.md`-k                                                                                             |
| AC17 | a merge kapu a PR leírásában                                                                                                                                     |
| AC18 | a 13. szekció (lezárva, `succeeded`)                                                                                                                             |
| AC19 | nyitva: a Claude próba nem futott (user döntés: "minimaxxal próbáld")                                                                                            |

---

## 13. A valódi MiniMax próba eredménye (SPEC-013 AC18, 2026-10-27)

**Engedély.** A user kifejezett engedélye, csak a `minimax` provider, egyetlen futás; a
`claude-subscription` próba (AC19) nem futott, a user döntése szerint ("minimaxxal próbáld") nyitva marad.

**Parancs.** A repó gyökeréből a `package.json` `probe:real-provider` scriptjének tényleges parancsa, a
`--env-file-if-exists=.env` helyett a user `.env` fájljára mutató `--env-file=<útvonal>` kapcsolóval (a fájl
tartalmát nem nyitottuk meg; egyetlen kulcsot tartalmaz, `ANTHROPIC_AUTH_TOKEN`):
`node --env-file=<a user .env útvonala> apps/server/measurement/real-provider-probe.ts minimax`. Modell és
effort a `build-probe-graph.ts` alapértéke (`MiniMax-M3.1-Flash`, `effort: 'low'`). Fej: `7b96c20`.

**Eredmény (a próba maszkolt összegzése, változatlanul).**

| Mező               | Érték       |
| ------------------ | ----------- |
| `providerId`       | `minimax`   |
| `runStatus`        | `succeeded` |
| `stepStatus`       | `succeeded` |
| `resultSubtype`    | `success`   |
| `numTurns`         | 1           |
| `outputTextLength` | 130         |

Kilépési kód 0, a falióra idő 8,5 másodperc (`time`, a szerver indításától a leállásig). Hiba nem történt,
újrapróbálkozás nem volt, összesen egy futás.

**Amit a próba összegzése nem tartalmaz, ezért NEM ELLENŐRZÖTT:** a dróton kiment modellazonosító (hogy a pinelt
CLI a `MiniMax-M3.1-Flash[1m]` azonosítóból utótag nélkülit küldött-e, 9. szekció 1. pont), a `thinking` és az
`effort` mező kimenő alakja (9. szekció 2. pont és 10.2), a token felhasználás és a költség. A `runProbe`
összegzése ezeket nem adja ki, és a próba a kimenő kérés törzsét nem naplózza (10.2). Annyi igazolt, hogy a
`MiniMax-M3.1-Flash` modellel, `effort: 'low'` mellett, alacsony tokennel a teljes lánc (szerver indítás,
futás, `agent_step` egy fordulóval) hiba nélkül lefutott, tehát a MiniMax a kérést `400` nélkül fogadta (a
`thinking: disabled` és a nem ismert modellazonosító kockázata, SPEC-013 9., ebben az egy futásban nem
jelentkezett).

**A `clientModelIdentifier` és a `[1m]` utótag.** A leíró `known` mezője ettől nem változik; hogy a próba a
dróton mit küldött, az továbbra is nem mért.

**Titok keresés a futás után.** A user `.env` fájljában álló token értékére a worktree-ben (`node_modules`
nélkül), a próba teljes kimenetében és a git történetben (`git log -S`) futtatott keresés: 0 találat mindhárom
helyen. Az érték sehová nem íródott ki.

---

## 14. A második review javításai (2026-10-27)

**Módszer.** Exa keresés és letöltés (2026-10-27), a lapok szövegét olvasva. A gyökér `CLAUDE.md` 1. szabálya
szerint egy `known` mezőhöz elsődleges forrás plusz két, a MiniMaxtól független megerősítés kell. A
függetlenség itt a **kiadó** szerinti: a 7minai, a Wokey és a FounderMag saját szövege szerint a MiniMax
dokumentációját olvasta, tehát a **származás** nem független. A Cloudflare AI docs lapja egy hosztoló szolgáltató
saját modell lapja, a TypingMind és az LLMTR katalógus lap. Erősebb függetlenséget (például saját mérést) egyik
forrás sem ad.

### 14.1 A `known` Flash mezők megerősítései

| Mező                                   | Érték                  | Független megerősítés (2 / mező)                                                                                                 | Mit olvastam a lapokon                                                                                                                                                     |
| -------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contextWindow`                        | 1 000 000              | <https://developers.cloudflare.com/ai/models/minimax/m3.1-flash/>, <https://www.typingmind.com/guide/minimax/MiniMax-M3.1-Flash> | Cloudflare: "Context Window 1,000,000 tokens"; TypingMind: "Context Window 1,000,000 tokens"                                                                               |
| `maxOutputTokensRecommended`           | 131 072                | <https://7minai.com/how-to-use-minimax-m3-1-flash/>, <https://wokey.ai/models/MiniMax-M3.1-Flash>                                | 7minai: "524,288 tokens (131,072 recommended)"; Wokey: "recommends a 131,072-token output budget and permits up to 524,288"                                                |
| `maxOutputTokensHard`                  | 524 288                | <https://wokey.ai/models/MiniMax-M3.1-Flash>, <https://www.typingmind.com/guide/minimax/MiniMax-M3.1-Flash>                      | Wokey: "Max output 524,288 tokens"; TypingMind: "Max Output 524,288 tokens" (az LLMTR lapja is: "at most 524,288 tokens")                                                  |
| `thinking.byModelFamily['M3.1-Flash']` | `['adaptive']`         | <https://wokey.ai/models/MiniMax-M3.1-Flash>, <https://7minai.com/how-to-use-minimax-m3-1-flash/>                                | Wokey: "The upstream rejects none and thinking.type=disabled"; 7minai: "Trying to disable thinking returns HTTP 400" (az LLMTR lapja is, `thinking: disabled` `400`)       |
| `effort.accepted`                      | `true`                 | <https://developers.cloudflare.com/ai/models/minimax/m3.1-flash/>, <https://wokey.ai/models/MiniMax-M3.1-Flash>                  | Cloudflare: `reasoning_effort` enum `low, medium, high, xhigh, max`; Wokey: "Effort accepts low, medium, high, xhigh and max"                                              |
| `effort.wireField`                     | `output_config.effort` | <https://7minai.com/how-to-use-minimax-m3-1-flash/>, <https://foundermag.co/tutorials/minimax-m3-1-flash-api-getting-started/>   | 7minai: táblázat és curl példa az Anthropic-kompatibilis úton `output_config.effort`; FounderMag: "`output_config.effort` takes `low`, `medium`, `high`, `xhigh` or `max`" |

A `clientModelIdentifier` két független megerősítése a 2. szekcióban áll, változatlanul. A
`fineGrainedToolStreaming` és a `subagentCapEnvVar` kliens oldali mező, a PR előtt is így állt, nem érintett.

### 14.2 Amit a keresés nem erősített meg, vagy ütközik

1. **A Vercel AI Gateway lapja** (<https://vercel.com/ai-gateway/models/minimax-m3.1-flash>) 1 048 576 kontextus
   ablakot és 1 048 576 maximális kimenetet ír. Ez a gateway több szolgáltatóját összefogó érték, nem a MiniMax API
   limitje, és a MiniMax lapjai, a Cloudflare, a TypingMind, a Wokey és az LLMTR 1 000 000 / 524 288 értéket adnak.
   A leíró értéke a MiniMax API-ra vonatkozik, ezért nem változik; az eltérés itt rögzítve van.
2. **Az Alibaba Cloud Model Studio lapja** 1 000 000 token kontextust ad, de saját szolgáltatásra, nem a MiniMax API-ra
   (a rate limit sornál ugyanez az érv, 2. szekció).
3. A rate limit mezők (`requestsPerMinute`, `tokensPerMinute`) a 2. szekció szerint `unknown` maradnak: független
   forrás nincs. **Újdonság:** a `blockedBy` üres lett, mert az M-18 és az M-36 header leltár mérés, nem az RPM és a
   TPM értékét zárja le; a `reason` kimondja, hogy független forrás hiányzik (SPEC-013 3.2).
4. **Nem ellenőrzött** marad a `MAX_THINKING_TOKENS=0` hatása a Flash-re (a MiniMax Claude Code lapja szerint nincs
   hatása, második forrás nincs), és az, hogy az M-06, M-07, M-08 és M-21 mérés eredménye a Flash-re is igaz-e (az
   M3-ra mérték). A `disallowedEnv` és a `requiredEnv` indoklásai ezt kimondják.

### 14.3 Az üres kulcs érték (hiba, javítva)

Egy üres `ANTHROPIC_AUTH_TOKEN=` `.env` sor és egy érvényes `ANTHROPIC_API_KEY` mellett a szerver az üres sztringet
vette beállított értéknek, és üres Bearer tokent küldött. A `resolveRequiredEnvironmentValue` ma a `null` mellett az
üres sztringet is átlépi, ahogy a `tools/wire-probe` is. Regressziós teszt: a
`resolve-required-environment-value.spec.ts` három új esete (a régi kódon mind a három elbukott).
