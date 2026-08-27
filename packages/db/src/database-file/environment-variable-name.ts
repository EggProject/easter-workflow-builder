/**
 * Az adatbázis fájl helyét megadó környezeti változó NEVE. Az érték útvonalat
 * tartalmaz, nem titkot (SPEC-003 10.1 szekció), de a modul csak a nevet
 * ismeri: az értéket minden hívás az `EnvironmentReader` paraméterből olvassa,
 * a modul maga sosem tárol beolvasott értéket.
 */
export const ENV_EASTER_DB_FILE = 'EASTER_DB_FILE';
