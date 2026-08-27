import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A `graph_snapshot` tábla (SPEC-003 4.9 szekció). A sort a tartalma
 * azonosítja: a `hash` elsődleges kulcs a `document` oszlopban álló
 * kanonikus szöveg `sha256` lenyomata, 64 karakteres kisbetűs hexadecimális
 * szövegként (F-24, `compute-snapshot-hash.ts`). Azonos gráfhoz azonos
 * dokumentum, azonos dokumentumhoz egyetlen sor tartozik, tetszőleges sok
 * `workflow_run` sor hivatkozhat rá (5.6 szekció, az 5. user döntés).
 *
 * **Ez a szülő tábla, nincs rajta idegen kulcs kifelé.** A `graph_snapshot`
 * nem a futás gyereke, hanem a szülője: a hivatkozást a
 * `workflow_run.graph_snapshot_hash` oszlop hordozza majd (T-003-13), ezért
 * ennek a táblának a `workflow_run` tábla **előtt** kell léteznie.
 *
 * **Nincs hivatkozásszámláló oszlop** (SPEC-003 53. kritérium): a
 * hivatkozottság a `workflow_run` sorokból vezethető le, ezért itt nem
 * duplikáljuk.
 *
 * **A sor beszúrás után soha nem módosul** (5.5 szekció). Ezt két, egymástól
 * független védelem adja: a repository rétegben nincs módosító művelet, és
 * egy adatbázis szintű `BEFORE UPDATE` trigger (`drizzle/0002_...sql`,
 * O-6 kutatás) minden `UPDATE` kísérletet megbuktat.
 */
export const graphSnapshotTable = sqliteTable(
  'graph_snapshot',
  {
    hash: text('hash').primaryKey(),
    documentVersion: integer('document_version').notNull(),
    document: text('document', { mode: 'json' }).$type<unknown>().notNull(),
    firstCapturedAtMs: integer('first_captured_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [index('graph_snapshot_version_idx').on(table.documentVersion)],
);
