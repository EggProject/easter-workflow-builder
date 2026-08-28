import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Az `app_setting` tábla egyetlen sorának elsődleges kulcsa. A `CHECK (id = 1)`
 * (lent) ezt kényszeríti ki adatbázis szinten (F-15), a repository réteg
 * (`app-setting-repository.ts`) minden olvasás/írás ugyanezt az azonosítót
 * használja.
 */
export const APP_SETTING_ROW_ID = 1;

/**
 * Az `app_setting` tábla (SPEC-003 4.13 szekció): egysoros tábla a globális
 * alapértelmezéseknek. A `CHECK (id = 1)` az egysorosságot kényszeríti ki
 * (F-15, a Drizzle 0.45.2 `check(name, sql)` API-ja a tábla extra
 * configjában).
 *
 * **A migráció egyetlen sort sem szúr be** (41. kritérium): a tábla üresen
 * indul, a sort az első `setDefaultProvider` vagy `setPersistStreamDeltas`
 * hívás hozza létre, upsert alakban (`app-setting-repository.ts`).
 *
 * **A `persist_stream_deltas` az egyetlen oszlop ebben a specben, aminek
 * séma szintű, szállított alapértéke van** (`.default(false)`, F-28): ez a
 * 6. user döntés (SPEC-003 6.6 szekció), nem kitalált konfigurációs érték.
 * Az üres táblán olvasó `readSettings` ugyanezt a hamis értéket adja vissza,
 * hogy a viselkedés megegyezzen akkor is, ha még nincs sor.
 *
 * A `default_provider_id` nullázható, és a migráció nem tölti ki: nincs
 * mérésünk vagy user döntésünk, ami megmondaná, melyik provider legyen az
 * alapértelmezett (SPEC-003 4.13 szekció).
 */
export const appSettingTable = sqliteTable(
  'app_setting',
  {
    id: integer('id').primaryKey(),
    defaultProviderId: text('default_provider_id'),
    persistStreamDeltas: integer('persist_stream_deltas', { mode: 'boolean' }).notNull().default(false),
    updatedAtMs: integer('updated_at_ms', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => [check('app_setting_id_check', sql`${table.id} = 1`)],
);
