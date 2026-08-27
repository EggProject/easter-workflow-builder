# packages/db

## Mi ez a mappa

Drizzle séma, migrációk, repository-k. **Jelenleg üres váz**, csak egy placeholder export
van benne, hogy a csomag lefordulhasson. A tényleges séma egy későbbi specifikáció tárgya.

## Fájlok

| Fájl           | Tartalom                                              |
| -------------- | ----------------------------------------------------- |
| `src/index.ts` | placeholder export, csak hogy a csomag lefordulhasson |

## Függőségi irány

A `db` a `core` és a `logger` csomagtól függ ma ténylegesen (lásd `package.json`), L2 réteg
(SPEC-002 4. szekció: "a `db` ... L2, mert a `protocol`, a `core` és a `logger` fölött áll") -
tehát a `protocol` csomagtól is függhetne, ha a séma ezt igényelné, de ma nem függ tőle.

## Szabályok

Titok soha nem kerül ide: a DB csak env változó nevet tárol, sosem értéket. Ha a csomag valódi
tartalmat kap, a `src/index.ts` `IS_DB_PLACEHOLDER` konstansát törölni kell. A `src/` alatti
mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti SPEC-002 hivatkozásban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
