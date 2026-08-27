# packages/mcp-tool-kit

## Mi ez a mappa

Az MCP eszköz építő váz: a `tools/call` válasz alakja (`ToolCallResult`) és a két válasz
konstruktora (`textToolResult`, `errorToolResult`), amit minden eszköz csomag használ. A
`packages/agent-tools` csomag szétbontásából jött létre (SPEC-002 5.13 szekció). Ide **nem**
tartozik egyetlen kész eszköz sem, és nem tartalmazza az in-process MCP szerver nevét sem: a
user kifogása pontosan erre vonatkozott, a váz és a kész tool nem lakhat egy csomagban.

## Fájlok

| Mappa               | Felelősség                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `tool-call-result/` | a válasz alakja (`ToolCallResult`) és a siker/hiba ág két konstruktora, a hozzájuk tartozó `.spec.ts`-sel |

A `tool-call-result/tool-call-result.ts` típus-only fájl, nincs hozzá `.spec.ts` (SPEC-002 6.3
pont). A siker és a hiba ág ugyanannak a válaszalaknak a két esete, ezért nem válik szét külön
témára.

## Függőségi irány

Nincs workspace függősége, L0 réteg (SPEC-002 4. szekció). Erre a csomagra épül a három
`tool-*` csomag.

## Szabályok

**Kivétel helyett hibaágban válaszol az agentnek.** Hiányzó bemenet, elérhetetlen szolgáltatás,
ismeretlen válasz alak: mind `isError: true` jelzésű, magyarázó szöveges válasz, sosem dobott
kivétel. Az index szignatúra nem lazítás, hanem illeszkedés: az MCP séma átengedi az ismeretlen
kulcsokat, és enélkül a hozzárendelés nem fordulna le az Agent SDK `tool()` helperjéhez.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.13 szekció
