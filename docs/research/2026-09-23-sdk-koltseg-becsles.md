# Az SDK `total_cost_usd` értékének jelentése a két providernél

Dátum: 2026-09-23. SDK verzió (pinelve): `@anthropic-ai/claude-agent-sdk@0.3.245`, a natív CLI a
`@anthropic-ai/claude-agent-sdk-linux-arm64@0.3.245` csomag `claude` binárisa.

**Kiváltó ok.** A user 2026-09-23-i döntése ("Költség külön mezőként is látszódjon") visszavonta a
SPEC-008 37. elfogadási kritériumának költség tiltását: az `sdk_result` sor költsége a transcript
összesítő sorában és a kinyitott nézetben is megjelenik. Előtte el kellett dönteni, mit jelent a
szám a projekt két providere (`claude-subscription`, `minimax`) mellett, hogy a felület ne mutassa
félrevezetően. Ez a fájl a döntés bizonyítéka; a felirat, ami belőle következik, a 7. szekcióban áll.

## 1. Verdikt

| Provider                 | Mit jelent a `total_cost_usd`                                                                                                                                                                                                                                                 | Megerősítés                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `minimax` (`MiniMax-M3`) | **Nem a valós költség.** Az SDK ártáblájában a modellre nincs sor, ezért a beépített tartalék díjtétellel számol (millió tokenenként $5 bemenet, $25 kimenet, $0,50 cache olvasás, $6,25 cache írás), ami a hivatalos árlistán Claude Opus modellek listaára, nem MiniMax ár. | telepített forrás (2.), hivatalos doksi (3.), saját mérés 122/122 (4.) |
| `claude-subscription`    | **Listaáras becslés, nem számla.** Az SDK a beépített Claude ártáblából számol; előfizetésnél a szám a hivatalos doksi szerint a számlázás szempontjából nem releváns.                                                                                                        | telepített forrás (2.1), hivatalos doksi (3.1, 3.2); saját mérés nincs |

Egyik providernél sem a ténylegesen fizetett összeg, tehát a felület mindkét esetben becslésként
nevezi meg (7. szekció).

## 2. Első forrás: a telepített, pinelt SDK

### 2.1 A típusdeklaráció (`sdk.d.ts`)

- A `result` üzenet `total_cost_usd` mezőjének JSDoc-ja (a két `result` ágon, a 4616. és a 4666.
  sor körül) kumulált, **becsült** USD költségnek nevezi, és kimondja, hogy nem számla ("An
  estimate, not a billing statement").
- A `ModelUsage.canonicalModel` mező (1297. sor körül) a dokumentáció szerint az a kanonikus modell
  azonosító, amivel az árkeresés történik; a `provider` mező az API szolgáltató típusa.
- A `modelPricing` beállítás (5530. sor körül) szerint a szám alapból listaáron számol, szerződéses
  ár csak menedzselt beállításból jöhet. A projekt ilyet nem állít be.

### 2.2 A CLI árkeresése (a natív bináris beágyazott forrása)

A `claude` bináris beágyazott JavaScript forrásában (visszakereshető: a bináris bájtjaiban a
`tengu_unknown_model_cost` karakterláncra keresve) az árkereső függvény sorrendje:

1. a kanonikus modell azonosító pontos egyezése a beépített ártáblában, amit a beágyazott modell
   katalógus tölt fel (Claude modellek);
2. a globális konfiguráció `additionalModelCostsCache` gyorsítótára;
3. ha egyik sem talál, `tengu_unknown_model_cost` telemetria eseményt küld, és az alapértelmezett
   fő modell árával, annak hiányában egy beépített konstanssal számol. A konstans:
   `inputTokens: 5`, `outputTokens: 25`, `promptCacheWriteTokens: 6.25`,
   `promptCacheWrite1hTokens: 10`, `promptCacheReadTokens: 0.5`, `webSearchRequests: 0.01`.

Ugyanez a bináris a `/cost` kijelzésben ismeretlen modell használatakor a "costs may be inaccurate
due to usage of unknown models" megjegyzést fűzi az összeghez, tehát a CLI maga is pontatlannak
jelöli a számot ebben az esetben.

### 2.3 Ami a pinelt verzióban NINCS

A hivatalos doksi (3.1) egy `costBasis` mezőt ír le (`list`, `managed`, `unknown`), ami pontosan
megmondaná, hogy egy modell ára ismeretlen volt. **A pinelt 0.3.245-ben ez a mező nem létezik**
(a `sdk.d.ts` és a `sdk.mjs` fájlban nulla találat, és a SPEC-000 artefaktumaiban sincs), a doksi
szerint újabb Claude Code verziót igényel. A felület ezért nem építhet rá.

## 3. Második forrás: a hivatalos dokumentáció

### 3.1 Agent SDK, költségkövetés

<https://code.claude.com/docs/en/agent-sdk/cost-tracking>: a `total_cost_usd` és a `costUSD`
kliens oldali becslés, nem mérvadó számlázási adat; az SDK a buildkor beágyazott ártáblából
számolja, és eltérhet a valódi számlától, többek között ha a telepített SDK verzió nem ismeri fel a
modellt. Független keresztellenőrzés a 2.2 olvasatára: ugyanez a lap az `inference_geo: "us"`
esetre 1,1-es szorzót ír le, és a bináris árszámoló függvénye pontosan ezt a szorzót alkalmazza.

### 3.2 Claude Code, költségek

<https://code.claude.com/docs/en/costs>: a Claude Code a dollár összeget helyben, token számokból,
listaáron számolja; a Claude Max és Pro előfizetőknél a használat az előfizetés része, ezért a
munkamenet költség szám a számlázás szempontjából nem releváns. A `claude-subscription` provider
pontosan ez az eset (Claude Code bejelentkezés, szabálykönyv 9. szekció).

### 3.3 Hivatalos árlista

<https://platform.claude.com/docs/en/about-claude/pricing>: a Claude Opus 5, 4.8, 4.7, 4.6 és 4.5
sora $5 bemenet, $6,25 (5 perces) és $10 (1 órás) cache írás, $0,50 cache találat, $25 kimenet per
millió token, tehát bájtra a 2.2 tartalék konstansa. A MiniMax-M3 költségét az SDK így Claude
listaáron adja meg.

## 4. Saját mérés: a SPEC-000 artefaktumai újraszámolva

A `tools/wire-probe/artifacts/harness/*/*.sdk-messages.ndjson` fájlok minden `result` üzenetének
minden `modelUsage` bejegyzésére (122 bejegyzés, kulcs `MiniMax-M3` vagy `MiniMax-M3[1m]`,
`provider: "firstParty"`, mind a pinelt 0.3.245-tel rögzítve) újraszámolva:

`(inputTokens*5 + outputTokens*25 + cacheReadInputTokens*0.5 + cacheCreationInputTokens*6.25) / 1e6 + webSearchRequests*0.01`

**Mind a 122 bejegyzésnél pontosan egyezik a `costUSD` értékkel** (eltérés < 1e-9), és a
`total_cost_usd` minden `result` üzenetben a bejegyzések összege. Két példa a kiértékelés 5.5
szekciójából: M-13 (`40286`, `462`, `256` token) pontosan `0.213108`, M-28 (`88358`, `1572`, `33618`
token) pontosan `0.497899`.

Korlát: a `cacheCreationInputTokens` minden bejegyzésben `0`, tehát a $6,25 cache írási díjtételt
csak a forrás (2.2) és a doksi (3.3) igazolja, a mérés nem. A `claude-subscription` providerre a
repóban nincs drótszintű mérés (a SPEC-000 kizárólag MiniMax ellen mért).

## 5. A kijelzés kerekítése

A bináris `/cost` kijelzője a dollár összeget `$` előtaggal, fél dollár felett két, alatta (és
pontosan fél dollárnál) négy tizedesre írja. A felület ugyanezt a szabályt követi, hogy a szám a
CLI kimenetével közvetlenül összevethető legyen; saját tizedes szám nincs.

## 6. A stream esemény és a felhasználói fordulat szöveges mezői

A transcript sor a SPEC-008 7.1 szerint az `sdk_stream_event` sorban a részleges szöveget, az
`sdk_user` sorban a felhasználói fordulatot mutatja. A mezők:

- **Stream delta.** A fenti artefaktumokban a `content_block_delta` alfajták: `thinking_delta`
  (3480), `text_delta` (468), `signature_delta` (169), `input_json_delta` (69). A szöveg a
  `delta.text`, a `delta.thinking` és a `delta.partial_json` mezőben áll; a `signature_delta`
  aláírása nem szöveg. Ugyanezt írja a hivatalos streaming doksi
  (<https://platform.claude.com/docs/en/build-with-claude/streaming>, "Content block delta types").
  A többi eseménynek (`message_start`, `content_block_start`, `content_block_stop`,
  `message_delta`, `message_stop`) nincs szöveges deltája, ezért a sor az esemény típusát nevezi
  meg.
- **Felhasználói fordulat.** A mért `user` üzenetekben a `message.content` `text` blokkokat vagy
  `tool_result` blokkokat hordoz, az utóbbi `content` mezője szöveg vagy `text` blokkok listája. A
  sor ezek szövegét fűzi össze.

## 7. Következmény a felületre

- **Egyetlen, provider független felirat: "Költség (SDK becslés)".** A 4. és a 3.2 szekció szerint
  egyik providernél sem a valós költség, tehát a legóvatosabb felirat mindkettőre igaz. Provider
  szerinti eltérő felirathoz a sornak tudnia kellene a providert, de a `RunEventRecord` nem hordozza,
  a `costBasis` mező a pinelt SDK-ban nincs (2.3), és a `modelUsage` kulcsából való találgatás
  kitalált szabály lenne.
- **Az összesítő sorban** a design system `.accordion__meta` szlotjában, **a kinyitott nézetben**
  külön, megnevezett mezőként áll, egy mondatos magyarázattal: az SDK beépített ártáblájából számolt
  becslés, nem számla; MiniMax provider mellett nem a valós költség, Claude előfizetésnél a
  számlázás szempontjából nem releváns.
- A motor és az adatbázis döntése változatlan: normalizált, összegezhető költség oszlop továbbra
  sincs (SPEC-003, SPEC-004 F-8), a szám kizárólag a nyers `payload` mezőből kerül kijelzésre.

## 8. Ami nem megerősített

- **A `claude-subscription` providerre nincs saját mérés.** A verdikt ott a telepített forrásra
  (2.1) és a hivatalos doksira (3.1, 3.2) épül. Mi zárná le: egy drótszintű futás a
  `claude-subscription` providerrel, és a `result` üzenet `modelUsage` bejegyzésének újraszámolása
  a 4. szekció módszerével.
- **Melyik tartalék ág számolt a MiniMax-M3-ra** (az alapértelmezett fő modell ára vagy a beépített
  konstans), a mérésből nem dönthető el, mert a kettő ugyanazt a díjtételt adja. A feliratot ez nem
  befolyásolja.
- **SDK frissítés után** a `costBasis` mező (2.3) megjelenhet; ha igen, a felirat providerenként
  pontosítható. Addig a viselkedés a fenti, egységes felirat.
