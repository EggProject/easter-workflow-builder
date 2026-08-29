# packages/protocol

## Mi ez a mappa

A REST és SSE kontraktus egyetlen forrása. Az `apps/server` és az `apps/web` ugyanebből a
csomagból veszi a Zod sémákat és a belőlük következtetett típusokat, nem duplikálja őket
(SPEC-005). A csomag épül: a téma mappák a SPEC-005 spec és a PLAN-006 terv lépései szerint
készülnek.

## Fájlok

| Mappa/fájl        | Tartalom                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `src/http-route/` | az `API_BASE_PATH` és a `STREAM_PATH` konstans, a 26 végpont útvonal sablonja, és a paraméter behelyettesítő tiszta függvény |
| `src/index.ts`    | barrel, csak nevesített újraexport                                                                                           |

## Függőségi irány

A `protocol` a `core` csomagtól és a `zod` külső csomagtól függhet, mástól nem, L1 réteg
(SPEC-002 4. szekció: "a `protocol` L1, mert csak a `core` csomagtól függhet"; SPEC-005 3.4
szekció). A `db` (L2) és az `engine` (L5) importja tilos.

## Szabályok

A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti SPEC-005
hivatkozásban. Minden bejövő Zod séma `z.strictObject`, minden kimenő séma `.readonly()`,
`.default()` és `.transform()` tilos, `.parse(` tilos (csak `.safeParse(`), és a csomag nem nyit
hálózatot (SPEC-005 7.3, 7.4, 10.1).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-005-api-protokoll.md`](../../docs/spec/SPEC-005-api-protokoll.md)
- [`../../docs/plan/PLAN-006-api-protokoll.md`](../../docs/plan/PLAN-006-api-protokoll.md)
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
