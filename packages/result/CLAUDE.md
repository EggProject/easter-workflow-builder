# packages/result

## Mi ez a mappa

A kétállapotú `Outcome<TValue>` eredménytípus és a hozzá tartozó szűkítő typeguard, hogy a
rétegek kivétel helyett hibaágat adjanak vissza. A `packages/agent-tools` csomag
szétbontásából jött létre (SPEC-002 5.1 szekció). Ide **nem** tartozik az MCP `tools/call`
válasz alakja (`ToolCallResult`) és annak konstruktorai: azok MCP protokoll specifikusak, a
helyük a `@easter-workflow-builder/mcp-tool-kit`.

## Fájlok

| Mappa      | Felelősség                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------------- |
| `outcome/` | az `Outcome<TValue>` típus és a rá szűkítő `isOkOutcome` typeguard, a hozzá tartozó `.spec.ts`-sel |

Az `outcome/outcome.ts` típus-only fájl, nincs hozzá `.spec.ts` (SPEC-002 6.3 pont).

## Függőségi irány

Nincs workspace függősége, L0 réteg (SPEC-002 4. szekció). Erre a csomagra épül szinte minden
más csomag, amelyik nem dob kivételt: `env-reader`, `http-client`, `minimax-client`,
`firecrawl-client`, `image-source`, a három `tool-*` csomag.

## Szabályok

**A csomag egyetlen rétege sem dob kivételt a hívó felé.** A tool hibája nem szakíthatja meg
az agent futását: az agentnek el kell tudnia dönteni, hogy megpróbál valami mást. Az
`isOkOutcome` typeguard nélkül a `value` mező nem olvasható, mert a hibaágon nem létezik.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.1 szekció
