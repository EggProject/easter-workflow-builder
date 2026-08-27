# packages/tool-understand-image

## Mi ez a mappa

Az `understand_image` MCP eszköz definíciója: Zod séma, leírás, a kép feloldása és a MiniMax
képértelmező hívása. A `packages/agent-tools` csomag szétbontásából jött létre (SPEC-002 5.16
szekció). Ide **nem** tartozik a kép base64 data URL alakra hozása (az a
`@easter-workflow-builder/image-source` csomagban van) és a MiniMax HTTP hívás (az a
`@easter-workflow-builder/minimax-client` csomagban van).

## Fájlok

| Mappa                    | Felelősség                                                                 |
| ------------------------ | -------------------------------------------------------------------------- |
| `understand-image-tool/` | a gyártófüggvény, a hozzá tartozó `.spec.ts`, és a szűk függőség interfész |

A mappa neve az eszköz neve (`understand_image`), nem a benne álló gyártófüggvényé
(`createImageUnderstandingTool`), a SPEC-002 6.1 pont 4. szabálya szerint. A
`understand-image-tool/understand-image-tool-dependencies.ts` típus-only fájl, nincs hozzá
`.spec.ts` (SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/image-source`, az `@easter-workflow-builder/mcp-tool-kit`, az
`@easter-workflow-builder/minimax-client` és az `@easter-workflow-builder/result` csomagtól
függ, plusz a `@anthropic-ai/claude-agent-sdk` és a `zod` külső csomagtól, L3 réteg (SPEC-002 4.
szekció). A `FetchFunction` és az `EnvironmentReader` típust a
`@easter-workflow-builder/minimax-client`, a `ReadFileFunction` típust a
`@easter-workflow-builder/image-source` barreljéből veszi (SPEC-002 6.6 pont 7. szabálya). Nem
függ másik `tool-*` csomagtól, és nem függ az `@easter-workflow-builder/agent-tool-bundle`
csomagtól (SPEC-002 4. szekció, "Új tiltás").

## Szabályok

**A `resolveMiniMaxConfig` paraméter nélküli alakot hívja.** A korábban tervezett, külön Coding
Plan token végül nem valósult meg (T-002-17): a hívás közvetlenül a `MINIMAX_API_KEY`
változóból dolgozik.

**Ismeretlen képformátum nem tippelhető el.** Ismeretlen kiterjesztés és ismeretlen
`content-type` esetén a `@easter-workflow-builder/image-source` hibaágat ad, ami megnevezi a
támogatott formátumokat, nem feltételez egy alapértelmezettet.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.16 szekció
