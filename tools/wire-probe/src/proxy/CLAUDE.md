# tools/wire-probe/src/proxy

## Mi ez a mappa

A logoló reverse proxy belső rétege: a rögzített HTTP tranzakció típusa, a tranzakció lemezre
írása sorszámozott JSON fájlokba, és a titok-maszkoló segédfüggvények. Ide **nem** tartozik a
HTTP szerver felállítása, a kérés upstreamre továbbítása vagy a streamelt válasz darabolása
(ez a `../proxy.ts` belépési pontban van), és nem tartozik ide egyetlen mérési eset logikája
sem (az a `../cases/` alatt van).

## Fájlok

| Fájl          | Tartalom                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `types.ts`    | `RecordedTransaction` és `StreamEventRecord` típusok                                                |
| `mask.ts`     | header- és szöveg-maszkoló segédfüggvények (`maskHeaders`, `maskSecretValue`, `redactKnownSecrets`) |
| `recorder.ts` | `TransactionRecorder`: egy tranzakció maszkolt, sorszámozott JSON fájlba írása                      |

## Függőségi irány

A `recorder.ts` a `./mask.ts`-től és a `./types.ts`-től függ, valamint a `node:fs` és
`node:path` beépített moduloktól. Ez a mappa a `../harness/`-tól és a `../cases/`-től **tilos**
hogy függjön: ez a legalsó réteg, a `../probe.ts` és a `../harness/runner.ts` fogyasztja
(utóbbi kizárólag a `redactKnownSecrets` függvényt a `meta.json` átfésüléséhez).

## Szabályok

- `RecordedTransaction.responseBody` és `streamEvents` szemantikája dokumentált: nem stream válasznál `responseBody` az érték, `streamEvents` `null`; stream válasznál fordítva. A kettő egyikét sosem szabad `undefined`-ként kihagyni, mindig explicit `null`.
- Maszkolás sorrendje kötött: előbb a névalapú header-maszkolás (`maskHeaders`, csak `authorization` és `x-api-key`), utána a teljes szerializált szöveg átfésülése a ténylegesen ismert titkokra (`redactKnownSecrets`). Nyers, maszkolatlan tranzakció sosem íródik lemezre.
- `maskSecretValue` a hossz- és utolsó-4-karakter-megtartó maszkot ad, nem teljes törlést, hogy a rögzített tranzakcióból azonosítható maradjon, melyik kulcsról van szó.

## Kapcsolódó dokumentumok

- [`../../../../docs/spec/SPEC-000-provider-wire-measurement.md`](../../../../docs/spec/SPEC-000-provider-wire-measurement.md)
- [`../../../../docs/research/2026-08-26-agent-sdk-minimax.md`](../../../../docs/research/2026-08-26-agent-sdk-minimax.md)
