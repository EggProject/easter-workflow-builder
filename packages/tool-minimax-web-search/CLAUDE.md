# packages/tool-minimax-web-search

## Mi ez a mappa

A `web_search` MCP eszköz definíciója: Zod séma, leírás, és a MiniMax kereső hívása. A
`packages/agent-tools` csomag szétbontásából jött létre (SPEC-002 5.14 szekció). Ide **nem**
tartozik a MiniMax HTTP hívás, a válasz szűkítés és formázás: azok a
`@easter-workflow-builder/minimax-client` csomagban vannak, ez a csomag csak séma, leírás és a
hibaágak megfogalmazása az agent felé.

## Fájlok

| Mappa              | Felelősség                                                                 |
| ------------------ | -------------------------------------------------------------------------- |
| `web-search-tool/` | a gyártófüggvény, a hozzá tartozó `.spec.ts`, és a szűk függőség interfész |

A `web-search-tool/web-search-tool-dependencies.ts` típus-only fájl, nincs hozzá `.spec.ts`
(SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/mcp-tool-kit`, az `@easter-workflow-builder/minimax-client` és az
`@easter-workflow-builder/core` csomagtól függ (az utóbbitól az `Outcome` szűkítő guard miatt),
plusz a `@anthropic-ai/claude-agent-sdk` és a `zod` külső csomagtól, L3 réteg (SPEC-002 4.
szekció). A `FetchFunction` és az `EnvironmentReader` típust a
`@easter-workflow-builder/minimax-client` barreljéből veszi, nem közvetlenül a `core`
csomagból (SPEC-002 6.6 pont 7. szabálya): a tool nem hív HTTP réteget, csak átadja a
befecskendezett függvényt a kliensnek. Nem függ másik
`tool-*` csomagtól, és nem függ az `@easter-workflow-builder/agent-tool-bundle` csomagtól
(SPEC-002 4. szekció, "Új tiltás").

## Szabályok

**A séma lapos.** Egyetlen kötelező szöveges mező, mert a mérés szerint a MiniMax a tool sémát
nem utasítja vissza újrapróbálkozással, tehát egy bonyolultabb séma azonnali hibát okozna,
javítási lehetőség nélkül.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.14 szekció
