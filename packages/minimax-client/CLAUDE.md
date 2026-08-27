# packages/minimax-client

## Mi ez a mappa

MiniMax HTTP kliens: konfiguráció feloldás, a `base_resp` burkoló kezelése, a kereső és a
képértelmező válaszok szűkítése és formázása. A `packages/agent-tools` csomag szétbontásából
jött létre (SPEC-002 5.10 szekció). Ide **nem** tartozik az MCP eszköz definíció: a
`web_search` és az `understand_image` eszköz külön csomagokban áll
(`@easter-workflow-builder/tool-web-search`, `@easter-workflow-builder/tool-understand-image`).

## Fájlok

| Mappa             | Felelősség                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `minimax-config/` | a beállítás feloldása: a konfiguráció típusa, a feloldó, a változónevek és az alapértelmezések |
| `envelope/`       | a MiniMax `base_resp` burkolója és a rá szűkítő guard                                          |
| `call-minimax/`   | a hívás maga, a két végpont útvonalával együtt                                                 |
| `search/`         | a kereső válasz alakja, szűkítése és formázása                                                 |
| `vlm/`            | a képértelmező válasz alakja és szűkítése                                                      |

A `minimax-config/minimax-config.ts`, az `envelope/base-response.ts` és a
`search/search-response.ts`, `vlm/vlm-response.ts` típus-only fájl, nincs hozzájuk `.spec.ts`
(SPEC-002 6.3 pont).

## Miért ez a felosztás

Ez a csomag a példa arra, amiért a régi `agent-tools/src/minimax` mappanév rossz volt: abból
nem derült ki, mi van benne. A `search`, a `vlm` és az `envelope` névből viszont igen.

## Függőségi irány

Az `@easter-workflow-builder/http-client`, az `@easter-workflow-builder/env-reader`, az
`@easter-workflow-builder/result` és az `@easter-workflow-builder/typeguards` csomagtól függ,
L2 réteg (SPEC-002 4. szekció). A barrel újraexportálja az `EnvironmentReader` és a
`FetchFunction` típust, mert megjelennek a `resolveMiniMaxConfig` és a `callMiniMax` saját
publikus szignatúrájában (SPEC-002 6.6 pont 7. szabálya).

## Szabályok

**A hibajelzés NEM a HTTP státuszban van.** A mérés szerint hibás API kulcsra is HTTP 200
érkezik, és a hiba csak a `base_resp.status_code` mezőben látszik. Ezért a `callMiniMax`
minden választ először a burkolón enged át, mielőtt sikeresnek minősítené.

**`resolveMiniMaxConfig` paraméter nélkül olvassa a kulcsot.** A korábban tervezett, a
képértelmezéshez szánt külön Coding Plan token végül nem valósult meg (T-002-17): a saját
mérés szerint ugyanaz a pay-as-you-go platform kulcs mindkét MiniMax végponton
`status_code: 0` értéket adott, tehát a mérés a külön kulcsot nem igazolta. A
`resolveMiniMaxConfig` ezért a paraméter helyett közvetlenül a `MINIMAX_API_KEY` változót
olvassa, és mindkét hívó (`tool-web-search`, `tool-understand-image`) ugyanabból a változóból
dolgozik.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.10 szekció
- [`../../docs/research/2026-08-26-agent-tools.md`](../../docs/research/2026-08-26-agent-tools.md): a végpontok saját mérése
