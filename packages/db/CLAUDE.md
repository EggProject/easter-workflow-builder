# packages/db

## Mi ez a mappa

Drizzle séma, migrációk, repository-k (SPEC-003). A csomag téma mappánként épül fel; ez a fájl
a végrehajtás alatt folyamatosan bővül, ahogy egy-egy téma mappa elkészül. A barrel
(`src/index.ts`) egészen a `sqlite-connection` téma elkészültéig a korábbi placeholder exportot
adja, mert a SPEC-002 6.6 6. szabálya szerint csak akkor cserélhető valódi exportra, ha van már
valódi, hívható felület mögötte.

## Fájlok

| Mappa            | Tartalom                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `database-file/` | az adatbázis fájl helyének feloldása: `EASTER_DB_FILE` env változó neve, fejlesztői alapértelmezés, könyvtár létrehozása (SPEC-003 10.1 szekció) |
| `src/index.ts`   | jelenleg még a placeholder export, a `sqlite-connection` téma (T-003-9) cseréli valódira                                                         |

A további, a SPEC-003 8. szekciója szerinti téma mappák (`sqlite-connection`, `migration`,
`workflow-graph`, `graph-snapshot`, `workflow-run`, `step-run`, `run-event`, `human-approval`,
`app-setting`, `provider-concurrency`, `run-recovery`) a végrehajtás további lépéseiben
keletkeznek.

## Függőségi irány

A `db` az `@easter-workflow-builder/core`, az `@easter-workflow-builder/logger`, az
`@easter-workflow-builder/typeguards` és az `@easter-workflow-builder/provider-capability`
csomagtól függ (`dependencies`, lásd `package.json`), L2 réteg (SPEC-002 4. szekció). Külső
futásidejű függősége a `drizzle-orm` és a `better-sqlite3`, fejlesztői függősége a
`@types/better-sqlite3` és a `drizzle-kit`, mind a négy literál verzióval rögzítve (SPEC-003
10.4 szekció, T-003-7).

## Szabályok

Titok soha nem kerül ide: a DB csak env változó nevet tárol, sosem értéket (`database-file`
téma: `ENV_EASTER_DB_FILE` a változó neve, az értéket minden hívás az `EnvironmentReader`
paraméterből olvassa). A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi
(SPEC-003 8. szekció), egy szint mélyen, a barrelen kívül más fájl nem áll közvetlenül a
`src/` alatt.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
- [`../../docs/spec/SPEC-003-domain-perzisztencia.md`](../../docs/spec/SPEC-003-domain-perzisztencia.md), 8. és 10. szekció
- [`../../docs/plan/PLAN-003-domain-perzisztencia.md`](../../docs/plan/PLAN-003-domain-perzisztencia.md)
