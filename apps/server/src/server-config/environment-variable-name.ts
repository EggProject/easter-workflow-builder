/**
 * A szerver konfigurációs env változóinak neve (SPEC-006 4.2, 12. szekció
 * O-1, O-2, O-4). Mindegyik kötelező, alapérték nélkül - a spec egyikre sem
 * ad dokumentált forrásból származó számot vagy sztringet.
 */
export const ENV_SERVER_PORT = 'EASTER_SERVER_PORT';
export const ENV_LOG_DIRECTORY = 'EASTER_LOG_DIRECTORY';
export const ENV_LOG_ROTATION_SIZE = 'EASTER_LOG_ROTATION_SIZE';
export const ENV_LOG_ROTATION_FREQUENCY = 'EASTER_LOG_ROTATION_FREQUENCY';
export const ENV_LOG_RETAINED_FILE_COUNT = 'EASTER_LOG_RETAINED_FILE_COUNT';

/**
 * A fejlesztői CORS origin (SPEC-006 5.7): NEM kötelező. Ha hiányzik, a
 * szerver egyetlen CORS fejlécet sem küld (5.7 1. pont, AC8 "nincs
 * konfigurált origin" esete) - ez eltér az O-1 nyitott kérdés "mindkettő
 * kötelező" megfogalmazásától, lásd a válasz jelentésében a nyitott
 * ellentmondás bejegyzést.
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
 * 12. szekció O-3). Kötelező, alapérték nélkül: a Node négy dokumentált
 * időkorlátja közül egyik sem erre a célra való (M-13, M-14), tehát nincs
 * dokumentált forrásból származó szám, amire hivatkozhatnánk.
 */
export const ENV_STREAM_KEEP_ALIVE_INTERVAL_MS = 'EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS';
