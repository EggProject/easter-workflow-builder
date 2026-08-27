# packages/http-client

## Mi ez a mappa

Vékony HTTP réteg a Node beépített `fetch` fölött: JSON POST, bináris GET, hibaleírás. A
`packages/agent-tools` csomag szétbontásából jött létre (SPEC-002 5.9 szekció). **Nem dob, nem
próbálkozik újra**: minden hibaág (hálózati hiba, nem sikeres HTTP státusz, értelmezhetetlen
törzs) `Outcome` hibaágként tér vissza, mert a tool hibája nem szakíthatja meg az agent futását.

## Fájlok

| Mappa                | Felelősség                                                                              |
| -------------------- | --------------------------------------------------------------------------------------- |
| `request/`           | a befecskendezett `fetch` típusa, a JSON POST, a bináris GET és a bináris válasz alakja |
| `error-description/` | ismeretlen típusú hibaobjektum egymondatos leírása egy elbukott hívásból                |

A `request/fetch-function.ts` és a `request/binary-payload.ts` típus-only fájl, nincs hozzájuk
`.spec.ts` (SPEC-002 6.3 pont). A két téma azért válik el, mert a hibaleírót a hívó akkor is
használja, amikor nem ez a réteg küldte a kérést.

## Függőségi irány

Az `@easter-workflow-builder/result` csomagtól függ (az `Outcome<TValue>` eredménytípus
miatt), L1 réteg (SPEC-002 4. szekció). Erre a csomagra épül az `@easter-workflow-builder/
minimax-client`, az `@easter-workflow-builder/firecrawl-client` és az `@easter-workflow-builder/
image-source`.

## Szabályok

**Nincs `axios` és nincs `dotenv`.** A HTTP réteg a Node 26 beépített `fetch` függvényét
használja, ami mindig paraméterként érkezik, hogy a unit teszt hálózat nélkül tudja lefedni
minden hibaágat.

**Nincs újrapróbálkozás.** Erre nincs dokumentált szabály egyetlen hívott szolgáltatásra sem,
tippelni pedig tilos. A hibát a réteg visszaadja a hívónak, aki dönthet a folytatásról.

**Egyetlen konkrét szolgáltatás egyetlen konkrét végpontja sincs benne.** A `PATH_SEARCH`,
`PATH_VLM`, `PATH_SCRAPE` konstansok a megfelelő kliens csomagokban vannak.

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.9 szekció
