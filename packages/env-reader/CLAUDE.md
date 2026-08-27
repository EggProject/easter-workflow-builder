# packages/env-reader

## Mi ez a mappa

Környezeti változó olvasás típusosan, alapértelmezéssel és hibaággal. A `packages/agent-tools`
csomag szétbontásából jött létre (SPEC-002 5.8 szekció). **Nem tud egyetlen konkrét
szolgáltatásról sem**: a konkrét változóneveket (`MINIMAX_API_KEY`, `FIRECRAWL_BASE_URL`) és a
konkrét alapértelmezéseket annál a kliensnél tartjuk, amelyik használja őket.

## Fájlok

| Mappa                 | Felelősség                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| `environment-reader/` | a beolvasó rekord típusa és a rá épülő két olvasó (`readBaseUrl`, `readTimeoutMs`), a két `.spec.ts`-sel |

Az `environment-reader/environment-reader.ts` típus-only fájl, nincs hozzá `.spec.ts`
(SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/result` csomagtól függ (a `readTimeoutMs` `Outcome`-ot ad), L1
réteg (SPEC-002 4. szekció). Erre a csomagra épül az `@easter-workflow-builder/minimax-client`
és az `@easter-workflow-builder/firecrawl-client`.

## Szabályok

**Nincs `dotenv`.** A `.env` fájl betöltése a futtató környezet dolga, a csomag csak egy sima,
csak olvasható rekordot (`EnvironmentReader`) vár paraméterként, nem a `process.env`-et
közvetlenül.

**Hiányzó vagy üres változó nem hiba, értelmezhetetlen érték igen.** A `readBaseUrl` a
megadott alapértelmezésre esik vissza hiányzó vagy üres érték esetén; a `readTimeoutMs`
ugyanígy tesz hiányzó értékre, de egy elgépelt, nem pozitív egész timeout hibaágat ad, mert az
csendben nem cserélhető le az alapértelmezésre.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.8 szekció
