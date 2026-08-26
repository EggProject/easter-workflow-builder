# Saját folyamatban futó eszközök: MiniMax kereső, MiniMax képértelmező, Firecrawl

Dátum: 2026-08-26. Hatókör: a `packages/agent-tools` csomag által hívott végpontok
viselkedése. Minden állítás mellett vagy hivatalos dokumentáció URL, vagy saját, ezen a napon
futtatott élő mérés áll. Ami egyikkel sem támasztható alá, az itt nyitott kérdésként szerepel.

## 1. Miért kell egyáltalán saját eszköz

A SPEC-000 mérése (`M-17`, `M-25`) kimutatta, hogy a MiniMax Anthropic kompatibilis
endpontja a szerver oldali `web_search_20250305` toolt elfogadja a kérésben, de sosem futtatja
le: HTTP 200 érkezik, a válaszban nincs `server_tool_use` és nincs `web_search_tool_result`
blokk, a modell mégis válaszol. Ugyanez a helyzet a kép bemenettel (`M-16`, `M-23`): a kép
content blokk kimegy a dróton, a szolgáltatás HTTP 200-at ad, a modell mégis azt állítja, hogy
nem kapott képet. Részletek:
[`2026-08-26-spec000-kiertekeles.md`](2026-08-26-spec000-kiertekeles.md), 5.4 szekció és
`M-23` szekció.

Az Agent SDK saját folyamatban futó (in-process) MCP szervere ezt megkerüli: az MCP kliens
oldalon csatlakozik, nem a Messages API kérés `mcp_servers` mezőjén keresztül
([`2026-08-26-agent-sdk-minimax.md`](2026-08-26-agent-sdk-minimax.md), In-process MCP tool
szekció).

## 2. Dokumentációs helyzet, ellenőrizve

| Kérdés                                                                   | Eredmény                                                                                                                                                                               |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Van hivatalos doksi a `POST /v1/coding_plan/search` nyers HTTP alakjára? | **Nincs.** A platform doksi csak az MCP eszköz szintjét írja le, `query` nevű paraméterrel: <https://platform.minimax.io/docs/token-plan/mcp-guide>                                    |
| Van hivatalos doksi a `POST /v1/coding_plan/vlm` nyers HTTP alakjára?    | **Nincs.** Ugyanaz az oldal az `understand_image` eszközhöz paramétertáblázatot sem ad.                                                                                                |
| Hivatalos MiniMax hibakód lista                                          | Van: <https://platform.minimax.io/docs/api-reference/errorcode>. A `1004` jelentése "not authorized", a `2013` "invalid params", a `1033` "system error". A `0` a siker.               |
| Támogatott képformátumok                                                 | JPEG, PNG, WebP, a hivatalos MCP szerver README-je szerint: <https://github.com/MiniMax-AI/MiniMax-Coding-Plan-MCP>. Méretkorlátot egyik forrás sem dokumentál.                        |
| MiniMax rate limit vagy timeout a két végpontra                          | **Nincs dokumentálva.** A hivatalos rate limit oldal csak LLM, videó, beszéd, kép és zene végpontokat sorol: <https://platform.minimax.io/docs/guides/rate-limits>                     |
| Firecrawl scrape kérés `timeout` mezője                                  | Dokumentált: minimum 1000, alapértelmezés **60000**, maximum 300000 ezredmásodperc: <https://docs.firecrawl.dev/api-reference/endpoint/scrape>                                         |
| Firecrawl self-hosted hitelesítés                                        | `USE_DB_AUTHENTICATION=false` mellett nincs `Authorization` fejléc: <https://docs.firecrawl.dev/contributing/self-host>. A dokumentált alapértelmezett port 3002, a mi példányunk 3222 |
| Firecrawl `formats` mező alakja                                          | `v1`-ben szövegtömb, `v2`-ben objektum elemek is lehetnek benne: <https://docs.firecrawl.dev/migrate-to-v2>                                                                            |

## 3. Saját mérés, 2026-08-26

A méréseket közvetlen `curl` hívással futtattuk a `.env` fájlban lévő
`MINIMAX_API_KEY` értékkel (pay-as-you-go platform kulcs), az `api.minimax.io` gazdagép ellen.

| Mérés                                               | Eredmény                                                                                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/coding_plan/search`, törzs `{"q": "..."}` | HTTP 200, a válasz kulcsai `organic`, `related_searches`, `base_resp`. Az `organic` elemei `title`, `link`, `snippet`, `date` mezőt hordoznak, a `date` gyakran üres string |
| ugyanez, üres `q` értékkel                          | HTTP 200, `base_resp.status_code` **1033** ("system error"). A kliens oldali üres bemenet ellenőrzés tehát indokolt                                                         |
| ugyanez, érvénytelen kulccsal                       | HTTP **200**, `base_resp.status_code` **1004**, üzenet: hiányzó API kulcs. A HTTP státusz tehát nem hibajelzés                                                              |
| `POST /v1/coding_plan/vlm`, base64 data URL képpel  | HTTP 200, `base_resp.status_code` 0, a válasz `content` mezője a modell szöveges elemzése. **Ugyanaz a platform kulcs elég volt**                                           |
| ugyanez, nyers `https://` képcímmel                 | HTTP 200, `base_resp.status_code` **2013**, üzenet: "invalid params, invalid image URL". A képet tehát base64 alakra kell hozni                                             |
| ugyanez, érvénytelen kulccsal                       | HTTP 200, `base_resp.status_code` 1004                                                                                                                                      |

### Következmények a kódra

1. **A hibajelzés a `base_resp` mezőben van, nem a HTTP státuszban.** Ezért a
   `callMiniMax` minden választ először a burkolón enged át.
2. **A képet mindig base64 data URL alakban kell kiküldeni.** A nyers cím elutasításra kerül,
   ezért a `resolveImageDataUrl` letölti és kódolja a képet.
3. **Az üres keresési kifejezés nem a szolgáltatásra bízható**, mert értelmezhetetlen
   rendszerhibát ad vissza.

## 4. Nyitott kérdés: kell-e külön Coding Plan token

A felhasználó felvetése szerint a `/v1/coding_plan/vlm` végpont külön Coding Plan tokent
igényel, ami nem azonos a `.env` fájlban lévő platform kulccsal. **A 3. szekció mérése ezt nem
igazolta**: ugyanaz a pay-as-you-go platform kulcs mindkét végponton HTTP 200-at és
`status_code: 0` értéket adott.

Ettől függetlenül a kód a képértelmezéshez **külön környezeti változót** használ
(`MINIMAX_CODING_PLAN_API_KEY`), a felhasználó kifejezett kérése szerint. Ez akkor is helyes
marad, ha a MiniMax később szétválasztja a két jogosultságot; ha nem válik szét, a felhasználó
ugyanazt az értéket adhatja meg mindkét változónak.

**Ami nyitva marad:** hogy a Coding Plan előfizetés és a pay-as-you-go egyenleg között van-e
elszámolási különbség ezen a két végponton. Erre nincs dokumentált forrás, és mérni sem tudtuk,
mert csak egyféle kulcs áll rendelkezésre.

## 5. Nyitott kérdés: a MiniMax kliens oldali timeout

A MiniMax nem dokumentál timeout értéket ezekre a végpontokra. A kódban szereplő
alapértelmezés ezért **önkényes**, és a `MINIMAX_TIMEOUT_MS` környezeti változóval
felülírható. A Firecrawl esetén ilyen probléma nincs: ott a szolgáltatás saját, dokumentált
scrape alapértelmezése adja a kliens oldali megszakítás idejét is.

Az eszközhívás külső korlátja az Agent SDK oldaláról az `MCP_TOOL_TIMEOUT` környezeti változó
(ezredmásodperc), aminek alapértelmezése a telepített SDK forrása szerint gyakorlatilag
korlátlan (`@anthropic-ai/claude-agent-sdk` `sdk.d.ts`, `createSdkMcpServer` JSDoc).

## 6. Firecrawl, nem mérve

A fejlesztői környezetből a felhasználó helyi Firecrawl példánya nem érhető el, ezért a
sikeres letöltés útját **nem mértük élőben**. Ami igazolt: a hibaág viselkedése unit teszttel
(nem elérhető szolgáltatás, `success: false` válasz, hiányzó markdown tartalom), és a kérés
alakja a hivatkozott hivatalos dokumentáció alapján. A kód a `v1` útvonalat hívja, mert a
felhasználó példánya ezt szolgálja ki; a `v2`-re váltás külön döntés, mert a `formats` mező
alakja eltér.
