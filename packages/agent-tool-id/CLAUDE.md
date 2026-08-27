# packages/agent-tool-id

## Mi ez a mappa

Az egyetlen `AgentToolId` union típus, ami a workflow lépéshez kapcsolható, saját folyamatban
futó (in-process) MCP eszközök közös szótára. A `packages/providers` csomag szétbontásából
jött létre (SPEC-002 5.4 szekció). Ide **nem** tartozik az eszköz teljes MCP neve
(`mcp__<szerver>__<eszköz>`): az a szervernév ismeretét igényli, tehát az
`@easter-workflow-builder/agent-tool-bundle` csomagban van.

## Fájlok

| Mappa            | Felelősség                                    |
| ---------------- | --------------------------------------------- |
| `agent-tool-id/` | az `AgentToolId` union típus, típus-only fájl |

Egy téma, egyetlen fájllal. Ez nem a régi, fájlonkénti konvenció maradványa: a csomagnak
egyetlen témája van, mert egyetlen szótárat hordoz.

## Függőségi irány

Nincs workspace függősége, L0 réteg (SPEC-002 4. szekció). Két, egymástól független fa
használja: az `@easter-workflow-builder/provider-capability` (az `AgentToolRecommendation`
miatt) és az `@easter-workflow-builder/agent-tool-bundle`. Ha a szótár a
`provider-capability` csomagban maradna, az eszköz-összeállítónak a teljes képességleíró
típusrétegtől kellene függnie, ami rossz irányú függés lenne.

## Szabályok

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.4 szekció
