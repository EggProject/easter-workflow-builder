// Barrel: csak nevesített újraexport (SPEC-002 6.6 6. szabálya). A csomag téma mappánként
// bővül, ahogy a SPEC-003 végrehajtási lépései elkészülnek.

// database-file: az adatbázis fájl helyének feloldása, env változó néven.
export { ENV_EASTER_DB_FILE } from './database-file/environment-variable-name.ts';
export { resolveDatabaseFilePath } from './database-file/resolve-database-file-path.ts';
export { defaultDatabaseFilePath } from './database-file/default-database-file-path.ts';
export { ensureDatabaseDirectory } from './database-file/ensure-database-directory.ts';

// sqlite-connection: az adatbázis kapcsolat megnyitása, tranzakció, zárás.
export { openDatabase } from './sqlite-connection/open-database.ts';
export type { DatabaseContext } from './sqlite-connection/database-context.ts';
