/**
 * Az adatbázis port (SPEC-004 3.2 táblázat, `database` sor): a motorba
 * befecskendezett `DatabaseContext`, ahogy a `db` csomag barrelje exportálja.
 * A típus a `db` csomagban él, itt csak port szerepében újraexportálva, hogy
 * az `engine-port` mappa mind a kilenc portot egy-egy fájlban sorolja fel.
 */
export type { DatabaseContext } from '@easter-workflow-builder/db';
