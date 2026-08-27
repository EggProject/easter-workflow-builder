# packages/engine

## Mi ez a mappa

DAG scheduler, node végrehajtók, retry policy. **Jelenleg üres váz**, csak egy placeholder
export van benne, hogy a csomag lefordulhasson. A tényleges motor egy későbbi
specifikáció tárgya.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

Az `engine` a `core`, a `db`, az `agent` és a `logger` csomagtól függ ténylegesen (lásd
`package.json`).

**Ellentmondás a SPEC-002-ben, nyitva jelölve.** A SPEC-002 4. szekció "Rétegbesorolás, mind a
32 csomagra" táblázata az `engine`-t és az `agent`-et **azonos** L4 rétegbe sorolja, miközben a
szöveges indoklás ("Az `engine` L4, mert a `db` és az `agent` fölött áll") azt sugallja, hogy az
`engine` szigorúan az `agent` fölött áll. A két állítás egymásnak ellentmond: a táblázat szerint
az `engine -> agent` él azonos rétegen belüli él lenne, ami a 4. szekció saját szabálya szerint
tilos ("Rétegen belüli él nincs"), a szöveg szerint viszont pontosan ez a függés indokolja az
`engine` L4 besorolását. Ez a tényleges, `package.json`-ban is meglévő `engine -> agent` függés
a SPEC-001 óta változatlan, a SPEC-002 hatóköre kifejezetten nem tervezi újra ("Nem tervezi meg
... az `engine`, az `agent` ... csomagok tartalmát"). A T-002-24 gráf ellenőrző ezt az élt a
táblázat szerint jelzi majd - a felbontás (az `agent` rétegszámának csökkentése, vagy a
táblázat/szöveg összhangba hozása) egy jövőbeli specifikáció döntése.

## Szabályok

Ha a csomag valódi tartalmat kap, a `src/index.ts` `IS_ENGINE_PLACEHOLDER` konstansát törölni
kell. A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti
SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
