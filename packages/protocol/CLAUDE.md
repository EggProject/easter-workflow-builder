# packages/protocol

## Mi ez a mappa

A REST és SSE kontraktus egyetlen forrása. Az `apps/server` és az `apps/web` ugyanebből a
csomagból veszi a Zod sémákat és a belőlük következtetett típusokat, nem duplikálja őket
(SPEC-005). A csomag épül: a téma mappák a SPEC-005 spec és a PLAN-006 terv lépései szerint
készülnek.

## Fájlok

| Mappa/fájl            | Tartalom                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/http-route/`     | az `API_BASE_PATH` és a `STREAM_PATH` konstans, a 26 végpont útvonal sablonja, és a paraméter behelyettesítő tiszta függvény                |
| `src/protocol-error/` | a `ProtocolErrorCode` szótár, a `ProtocolErrorBody` séma, a HTTP státusz leképezés, és a Zod hiba lista fordítása a boríték alakra          |
| `src/workflow/`       | a node típus felsorolás, a workflow rekord, a gráf dokumentum, a létrehozás, a módosítás, a teljes gráf csere és a törlés kérés/válasz      |
| `src/run/`            | a futás és a lépés futás állapot felsorolása, a futás rekord, az indítás, a listázás, a megszakítás, az újraindítás és a pillanatkép alakja |
| `src/transcript/`     | az esemény origin és kind felsorolás, a run_event drótszintű rekordja, a kurzoros lekérdezés kérése és a lapja                              |
| `src/index.ts`        | barrel, csak nevesített újraexport                                                                                                          |

## Függőségi irány

A `protocol` a `core` csomagtól és a `zod` külső csomagtól függhet, mástól nem, L1 réteg
(SPEC-002 4. szekció: "a `protocol` L1, mert csak a `core` csomagtól függhet"; SPEC-005 3.4
szekció). A `db` (L2), a `provider-capability` (L1, azonos réteg) és az `engine` (L5) importja
tilos.

## Szabályok

A `src/` alatti mappaszerkezet a téma szerinti konvenciót követi, a részletek a lenti SPEC-005
hivatkozásban. Minden bejövő Zod séma `z.strictObject`, minden kimenő séma `.readonly()`,
`.default()` és `.transform()` tilos, `.parse(` tilos (csak `.safeParse(`), és a csomag nem nyit
hálózatot (SPEC-005 7.3, 7.4, 10.1). A `providerId` a dróton egyszerű szöveg (`z.string()`), nem
zárt felsorolás: a `ProviderId` unió a `provider-capability` csomagban él, amit a `protocol`
azonos rétegen állva nem importálhat (SPEC-005 F-23).

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-005-api-protokoll.md`](../../docs/spec/SPEC-005-api-protokoll.md)
- [`../../docs/plan/PLAN-006-api-protokoll.md`](../../docs/plan/PLAN-006-api-protokoll.md)
- [`../../docs/spec/SPEC-001-monorepo-toolchain.md`](../../docs/spec/SPEC-001-monorepo-toolchain.md), 3. szekció
- [`../../docs/spec/SPEC-002-csomag-architektura.md`](../../docs/spec/SPEC-002-csomag-architektura.md), 4. és 6. szekció
