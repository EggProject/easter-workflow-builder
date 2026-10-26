# packages/core

## Mi ez a mappa

A workspace legalsó, szolgáltatásfüggetlen alaprétege: eredménytípus, a környezeti változó
olvasó típusa, a befecskendezhető `fetch` típusa és a hibaleírók. Egyetlen konkrét szolgáltatásról
sem tud, nincs benne végpont útvonal, változónév vagy alapértelmezés. Nem tartozik ide adatbázis
séma és UI.

A csomag három tárgykörre tagolódik, tárgykörönként egy `src/` alatti mappával, kétszintűen:
`src/<tárgykör>/<téma>/`.

## Fájlok

| Mappa                                | Tartalom                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/result/outcome/`                | a kétállapotú `Outcome<TValue>` típus, a hibaágon opcionális kivétel típusnevet hordozó `OutcomeWithErrorType<TValue>` és az `isOkOutcome` szűkítő guard |
| `src/env-reader/environment-reader/` | az `EnvironmentReader` típus                                                                                                                             |
| `src/http-client/request/`           | a befecskendezett `fetch` típusa                                                                                                                         |
| `src/http-client/error-description/` | hibaüzenet előállítása egy elbukott hívásból, a kérésküldéstől függetlenül is, és egy kivétel típusneve naplózáshoz (`describeErrorType`, üzenet nélkül) |
| `src/index.ts`                       | barrel, csak nevesített újraexport                                                                                                                       |

Típus-only fájlok, nincs hozzájuk `.spec.ts` (SPEC-002 6.3): `outcome.ts`, `outcome-with-error-type.ts`,
`environment-reader.ts`, `fetch-function.ts`.

## Függőségi irány

A `core` egyetlen workspace csomagtól sem függ, L0 réteg (SPEC-002 4. szekció). Ez a legalsó
csomag a függőségi gráfban, minden más termékcsomag ebből építkezhet. Külső csomagot sem
használ: se `axios`, se `dotenv`, a szabványos `fetch` a teljes eszközkészlet.

## Szabályok

Konkrét szolgáltatás végpontja, környezeti változó neve vagy alapértelmezése nem kerülhet ide,
azok a szolgáltatást megvalósító csomagokban vannak. A `src/` alatti
mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti SPEC-002 hivatkozásban.

**Node beépített modult (`node:*`) egyetlen fájl sem importálhat.** A csomag felülete egyetlen
barrel, amit az `apps/web` is érték szinten importál, tehát a barrel minden modulja bekerül a
böngésző modulgráfjába; `vite dev` alatt (tree shaking nélkül) egy `node:` import az egész
frontendet megbuktatja. Az `apps/web/src/browser-safe-imports/` regressziós teszt őrzi.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4., 5. és 6. szekció
