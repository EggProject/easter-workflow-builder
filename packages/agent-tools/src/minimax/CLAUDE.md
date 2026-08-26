# packages/agent-tools/src/minimax

## Mi ez a mappa

A MiniMax kereső és képértelmező végpont drótszintű alakja: útvonalak, válasz típusok,
typeguardok és a közös hívó. Ide **nem** tartozik környezeti változó olvasás, MCP eszköz
definíció és képforrás kezelés.

## Fájlok

| Fájl                        | Tartalom                                                 |
| --------------------------- | -------------------------------------------------------- |
| `endpoint-path.ts`          | `PATH_SEARCH`, `PATH_VLM`                                |
| `base-response.ts`          | `MiniMaxBaseResponse`, `MiniMaxEnvelope`                 |
| `is-minimax-envelope.ts`    | `isMiniMaxEnvelope` typeguard                            |
| `call-minimax.ts`           | `callMiniMax`, a közös hívó a `base_resp` ellenőrzésével |
| `search-response.ts`        | `MiniMaxSearchResult`, `MiniMaxSearchResponse`           |
| `is-search-response.ts`     | `isSearchResponse` typeguard                             |
| `format-search-response.ts` | `formatSearchResponse`                                   |
| `vlm-response.ts`           | `MiniMaxVlmResponse`                                     |
| `is-vlm-response.ts`        | `isVlmResponse` typeguard                                |

Minden viselkedést hordozó fájl mellett `*.test.ts` van, a lefedettség kizárás nélkül teljes.

## Függőségi irány

A `../config`, a `../http` és a `../result` rétegtől, valamint a `typeguards` csomag
`isRecord` guardjától függ.

## Szabályok

**A HTTP státusz nem hibajelzés.** A mérésünk szerint hibás API kulcsra is HTTP 200 érkezik,
és a hiba csak a `base_resp.status_code` mezőben látszik, ezért minden válasz először a
`callMiniMax` burkoló ellenőrzésén megy át.

**A végpontok nincsenek hivatalos doksiban.** A MiniMax dokumentációja csak az MCP eszköz
szintjét írja le, a nyers útvonalakat nem, ezért itt minden mezőnév mögött saját, élő mérés
áll, nem doksi. Új mezőt csak mérés után szabad felvenni.

## Kapcsolódó dokumentumok

- [`../../../../docs/research/2026-08-26-agent-tools.md`](../../../../docs/research/2026-08-26-agent-tools.md)
