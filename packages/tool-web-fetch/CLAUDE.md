# packages/tool-web-fetch

## Mi ez a mappa

A `web_fetch` MCP eszköz definíciója: Zod séma, leírás, és a Firecrawl scrape hívása. A
`packages/agent-tools` csomag szétbontásából jött létre (SPEC-002 5.15 szekció). Ide **nem**
tartozik a Firecrawl HTTP hívás, a válasz szűkítés és formázás: azok a
`@easter-workflow-builder/firecrawl-client` csomagban vannak.

## Fájlok

| Mappa             | Felelősség                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| `web-fetch-tool/` | a gyártófüggvény, a hozzá tartozó `.spec.ts`, és a szűk függőség interfész |

A `web-fetch-tool/web-fetch-tool-dependencies.ts` típus-only fájl, nincs hozzá `.spec.ts`
(SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/firecrawl-client`, az `@easter-workflow-builder/mcp-tool-kit` és
az `@easter-workflow-builder/result` csomagtól függ, plusz a `@anthropic-ai/claude-agent-sdk`
és a `zod` külső csomagtól, L3 réteg (SPEC-002 4. szekció). A `FetchFunction` és az
`EnvironmentReader` típust a `@easter-workflow-builder/firecrawl-client` barreljéből veszi
(SPEC-002 6.6 pont 7. szabálya), ezért az `@easter-workflow-builder/http-client` és az
`@easter-workflow-builder/env-reader` **nem** szerepel a függőségei között. Nem függ másik
`tool-*` csomagtól, és nem függ az `@easter-workflow-builder/agent-tool-bundle` csomagtól
(SPEC-002 4. szekció, "Új tiltás").

## Szabályok

**A `postJson` hívás nem itt van.** A tényleges Firecrawl hívás a
`@easter-workflow-builder/firecrawl-client` csomag `scrape-call` témájában áll
(`scrapePage`), ez a csomag csak séma, leírás és a hibaágak megfogalmazása az agent felé.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.15 szekció
