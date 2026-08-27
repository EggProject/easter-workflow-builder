# packages/core

## Mi ez a mappa

A workspace legalsó, szolgáltatásfüggetlen alaprétege: eredménytípus, környezeti változó
olvasás, vékony HTTP réteg és képforrás feloldás. Egyetlen konkrét szolgáltatásról sem tud,
nincs benne végpont útvonal, változónév vagy alapértelmezés. Nem tartozik ide adatbázis séma
és UI.

A csomag négy tárgykörre tagolódik, tárgykörönként egy `src/` alatti mappával. A `http-client`
és az `image-source` tárgykör több témát fog össze, ezért kétszintű: `src/<tárgykör>/<téma>/`.

## Fájlok

| Mappa                                | Tartalom                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `src/result/outcome/`                | a kétállapotú `Outcome<TValue>` típus és az `isOkOutcome` szűkítő guard          |
| `src/env-reader/environment-reader/` | az `EnvironmentReader` típus, a `readBaseUrl` és a `readTimeoutMs` olvasó        |
| `src/http-client/request/`           | a befecskendezett `fetch` típusa, a JSON POST, a bináris GET és a bináris válasz |
| `src/http-client/error-description/` | hibaüzenet előállítása egy elbukott hívásból, a kérésküldéstől függetlenül is    |
| `src/image-source/media-type/`       | a kép média típusa `Content-Type` fejlécből és fájlkiterjesztésből               |
| `src/image-source/data-url/`         | a befecskendezett fájlolvasó típusa és a kép feloldása base64 data URL alakra    |
| `src/index.ts`                       | barrel, csak nevesített újraexport                                               |

Típus-only fájlok, nincs hozzájuk `.spec.ts` (SPEC-002 6.3): `outcome.ts`,
`environment-reader.ts`, `fetch-function.ts`, `binary-payload.ts`, `image-media-type.ts`,
`read-file-function.ts`.

## Függőségi irány

A `core` egyetlen workspace csomagtól sem függ, L0 réteg (SPEC-002 4. szekció). Ez a legalsó
csomag a függőségi gráfban, minden más termékcsomag ebből építkezhet. Külső csomagot sem
használ: se `axios`, se `dotenv`, a Node beépített `fetch` és `Buffer` a teljes eszközkészlet.

## Szabályok

Konkrét szolgáltatás végpontja, környezeti változó neve vagy alapértelmezése nem kerülhet ide,
azok a kliens csomagokban vannak (`minimax-client`, `firecrawl-client`). A `src/` alatti
mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4., 5. és 6. szekció
