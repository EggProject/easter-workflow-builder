# packages/image-source

## Mi ez a mappa

Kép feloldása base64 data URL alakra `https` címről, helyi fájlból vagy már kész data URL-ből,
plusz a média típus megállapítása. A `packages/agent-tools` csomag szétbontásából jött létre
(SPEC-002 5.12 szekció). Ide **nem** tartozik a MiniMax képértelmező hívás: a kép előkészítése
és a modell hívása két különböző dolog, az előbbi bármelyik képes providerrel használható, az
utóbbi MiniMax specifikus, a helye a `@easter-workflow-builder/minimax-client`.

## Fájlok

| Mappa         | Felelősség                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| `media-type/` | a támogatott képformátum típusa, és a két megállapító: `Content-Type` fejlécből és fájlkiterjesztésből |
| `data-url/`   | a befecskendezhető fájlolvasó típusa és a kép beolvasása, data URL alakra hozása                       |

A `media-type/image-media-type.ts` és a `data-url/read-file-function.ts` típus-only fájl,
nincs hozzájuk `.spec.ts` (SPEC-002 6.3 pont).

## Függőségi irány

Az `@easter-workflow-builder/http-client` (a letöltés miatt) és az
`@easter-workflow-builder/result` (az `Outcome<TValue>` eredménytípus miatt) csomagtól függ, L2
réteg (SPEC-002 4. szekció). A barrel újraexportálja a `FetchFunction` típust a
`@easter-workflow-builder/http-client` csomagból, mert megjelenik a `resolveImageDataUrl` saját
publikus szignatúrájában (SPEC-002 6.6 pont 7. szabálya).

## Szabályok

**Támogatott formátumok: JPEG, PNG, WebP.** Ismeretlen kép kiterjesztés vagy ismeretlen
`content-type` esetén nem tippelünk: a referencia implementáció ilyenkor JPEG-nek hazudta a
tartalmat, ami néma hibához vezetett volna. Ehelyett hibaágat adunk, ami megnevezi a támogatott
formátumokat.

**A letöltés és a base64 kódolás azért kell, mert a MiniMax képértelmező végpontja a nyers HTTP
címet elutasítja** (saját mérés, `docs/research/2026-08-26-agent-tools.md`).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 5.12 szekció
- [`../../docs/research/2026-08-26-agent-tools.md`](../../docs/research/2026-08-26-agent-tools.md): a végpontok saját mérése
