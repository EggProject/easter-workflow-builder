# packages/agent-tools

## Mi ez a mappa

Három, saját folyamatban futó (in-process) MCP eszköz az Agent SDK-hoz: web keresés, oldal
letöltés és képértelmezés. A csomag **nem** monolit szervert exportál: a hívó lépésenként
kiválasztja, mely eszközöket engedélyezi, és a `createAgentToolBundle` adja hozzá a `query()`
hívás `mcpServers` és `allowedTools` mezőjébe illeszthető alakot.

Ide **nem** tartozik: az Agent SDK futtatása, a workflow lépés modellje, a provider
kiválasztás. A csomag csak eszközöket gyárt, nem futtat agentet.

## Miért van erre szükség

A `minimax` provider Anthropic kompatibilis endpontja két képességet **csendben eldob**: a
szerver oldali keresőt és a kép bemenetet. Mindkét esetben HTTP 200 érkezik, a modell mégis
úgy válaszol, mintha nem kapott volna keresési találatot, illetve képet, tehát a felhasználó
felé forrás nélküli, mégis magabiztos válasz születik. A saját folyamatban futó eszköz ezt
kerüli meg: az MCP kliens oldalon csatlakozik, nem a Messages API kérés törzsén keresztül,
ezért a szolgáltatás eldobó viselkedése nem érinti.

## Fájlok

| Fájl            | Tartalom                                     |
| --------------- | -------------------------------------------- |
| `package.json`  | csomag manifeszt, `typecheck` és `lint`      |
| `tsconfig.json` | a `tooling/tsconfig/node.json` kiterjesztése |
| `src/index.ts`  | barrel, csak újraexport                      |

Az `src/` alatti hét mappa felelőssége:

| Mappa        | Felelősség                                                                 |
| ------------ | -------------------------------------------------------------------------- |
| `config/`    | környezeti változó olvasás, a három eszköz futásidejű konfigurációja       |
| `result/`    | `Outcome<TValue>` eredménytípus és az MCP `ToolCallResult` előállítói      |
| `http/`      | a beépített `fetch` fölötti közös HTTP réteg                               |
| `minimax/`   | a MiniMax kereső és képértelmező végpont drótszintű alakja                 |
| `firecrawl/` | a Firecrawl scrape végpont drótszintű alakja                               |
| `image/`     | a képértelmező eszköz bemenetének feloldása (data URL/HTTP/fájl -> base64) |
| `tools/`     | a három MCP eszköz definíciója és az eszközkészlet összeállítója           |

## Környezeti változók

| Változó                       | Kinek kell             | Alapértelmezés                                 |
| ----------------------------- | ---------------------- | ---------------------------------------------- |
| `MINIMAX_API_KEY`             | web keresés            | nincs, hiánya esetén az eszköz hibát ad        |
| `MINIMAX_CODING_PLAN_API_KEY` | képértelmezés          | nincs, hiánya esetén az eszköz hibát ad        |
| `MINIMAX_API_BASE_URL`        | mindkét MiniMax eszköz | a nemzetközi MiniMax endpont                   |
| `MINIMAX_TIMEOUT_MS`          | mindkét MiniMax eszköz | önkényes, mert nincs rá dokumentált forrás     |
| `FIRECRAWL_BASE_URL`          | oldal letöltés         | a felhasználó helyi Firecrawl példánya         |
| `FIRECRAWL_TIMEOUT_MS`        | oldal letöltés         | a Firecrawl dokumentált scrape alapértelmezése |

A konkrét értékek és az indoklásuk a `src/config/default-config-value.ts` fájlban vannak,
mindegyik mellett megjelölve, hogy dokumentált vagy önkényes.

## Függőségi irány

Az `agent-tools` a `providers` (az `AgentToolId` szótár miatt) és a `typeguards` csomagtól
függ, valamint az `@anthropic-ai/claude-agent-sdk` és a `zod` külső csomagoktól. Semmilyen
más workspace csomagtól nem függ, és egyetlen workspace csomag sem függhet tőle úgy, hogy az
kört okozna.

## Szabályok

**Nincs `axios` és nincs `dotenv`.** A HTTP réteg a Node 26 beépített `fetch` függvényét
használja, a környezeti változók pedig paraméterként érkeznek, a `tools/wire-probe` mintájára.

**Nincs újrapróbálkozás.** Erre nincs dokumentált MiniMax vagy Firecrawl szabály, tippelni
pedig tilos. A hibát az eszköz visszaadja az agentnek, aki dönthet a folytatásról.

**Minden hibaág az agenthez jut, nem kivételként.** Hiányzó környezeti változó, nem elérhető
szolgáltatás, ismeretlen válasz alak: mind `isError: true` jelzésű, magyarázó szöveges válasz.

**A séma lapos.** Csak kötelező szöveges mezők, nincs felsorolás, tömb és beágyazott objektum,
mert a visszautasított tool séma nem eredményez újrapróbálkozást.

**Ismeretlen képformátum nem tippelhető el.** A referencia implementáció ismeretlen
kiterjesztés és ismeretlen `content-type` esetén JPEG-et feltételezett, ami néma hibához
vezetett volna: az `image/` mappa ilyenkor hibaágat ad, ami megnevezi a támogatott
formátumokat.

## Kapcsolódó dokumentumok

- [`../../docs/research/2026-08-26-agent-tools.md`](../../docs/research/2026-08-26-agent-tools.md): a végpontok saját mérése
- [`../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../docs/research/2026-08-26-agent-sdk-minimax.md): In-process MCP tool szekció
- [`../../docs/research/2026-08-26-spec000-kiertekeles.md`](../../docs/research/2026-08-26-spec000-kiertekeles.md), 5.4 szekció: a szerver oldali kereső eldobása
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció: csomagtérkép
