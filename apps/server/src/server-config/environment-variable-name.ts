/**
 * A szerver konfigurációs env változóinak neve (SPEC-006 4.2, 12. szekció
 * O-1, O-2, O-4). Mindegyiknek alapértéke van a `default-server-config.ts`
 * fájlban, forrással (SPEC-012 4.2); az `EASTER_LOG_DIRECTORY` értéke fájl
 * útvonal előtag, nem könyvtár (a napló `<érték>.1.log`, research 2., M-142).
 */
export const ENV_SERVER_PORT = 'EASTER_SERVER_PORT';
export const ENV_LOG_DIRECTORY = 'EASTER_LOG_DIRECTORY';
export const ENV_LOG_ROTATION_SIZE = 'EASTER_LOG_ROTATION_SIZE';
export const ENV_LOG_ROTATION_FREQUENCY = 'EASTER_LOG_ROTATION_FREQUENCY';
export const ENV_LOG_RETAINED_FILE_COUNT = 'EASTER_LOG_RETAINED_FILE_COUNT';

/**
 * A fejlesztői CORS origin (SPEC-006 5.7): NEM kötelező, és alapértéke
 * szándékosan nincs (SPEC-012 4.2): ha hiányzik, a szerver egyetlen CORS
 * fejlécet sem küld (5.7 1. pont, AC8 "nincs konfigurált origin" esete), azt
 * alapértékkel nem kapcsoljuk be.
 */
export const ENV_STREAM_DEV_ORIGIN = 'EASTER_STREAM_DEV_ORIGIN';

/**
 * A napló szint (SPEC-006 7.2): NEM kötelező. Hiányában a pino dokumentált
 * `'info'` alapértéke érvényesül (M-26), ezért itt nincs szám vagy szint
 * literál.
 */
export const ENV_LOG_LEVEL = 'EASTER_LOG_LEVEL';

/**
 * Az SSE életben tartó jelzés gyakorisága, milliszekundumban (SPEC-006 6.6,
 * 12. szekció O-3). Alapértéke a `default-server-config.ts` fájlban áll
 * (SPEC-012 4.2, research 10.1).
 */
export const ENV_STREAM_KEEP_ALIVE_INTERVAL_MS = 'EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS';

/**
 * A skill könyvtár gyökere (SPEC-009 5.1, O-9): kötelező, alapérték nélkül
 * (a SPEC-009 5.1 kimondott döntése, a SPEC-012 4.2 "minden értéknek van
 * alapértéke" szabályának egyetlen kivétele). A gyökér egy plugin gyökér: a
 * skillek a `<gyökér>/skills/<név>/` alatt állnak.
 */
export const ENV_SKILL_LIBRARY_DIRECTORY = 'EASTER_SKILL_LIBRARY_DIRECTORY';

/**
 * A ZIP feltöltés három korlátja (SPEC-009 5.4 6. pont, O-34): a feltöltött
 * törzs mérete, a kicsomagolt összméret (mindkettő bájtban) és a bejegyzések
 * száma. Alapértékük a `default-server-config.ts` fájlban áll, forrással.
 */
export const ENV_SKILL_MAX_ARCHIVE_BYTES = 'EASTER_SKILL_MAX_ARCHIVE_BYTES';
export const ENV_SKILL_MAX_UNPACKED_BYTES = 'EASTER_SKILL_MAX_UNPACKED_BYTES';
export const ENV_SKILL_MAX_ENTRY_COUNT = 'EASTER_SKILL_MAX_ENTRY_COUNT';
