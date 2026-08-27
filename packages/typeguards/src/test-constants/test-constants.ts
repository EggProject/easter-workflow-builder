/**
 * Megosztott teszt konstansok a bemásolt typeguard specekhez. Minden
 * `../test-constants`-ból importáló `.spec.ts` fájl ide hivatkozik, hogy ne
 * legyen szám literál szórva a tesztekben (`sonarjs/no-magic-numbers`).
 *
 * Az értékeket kizárólag a rájuk hivatkozó spec-ek elvárásaiból vezettük le
 * (lásd az egyes konstansok melletti megjegyzést a levezetéshez), nem
 * kitalálva. Ahol a spec nem szab meg konkrét értéket, ott ez jelölve van.
 */

// --- egész számok ---
export const POSITIVE_INT_ZERO = 0;
export const POSITIVE_INT_ONE = 1;
export const POSITIVE_INT_SMALL = 5;
export const POSITIVE_INT_MEDIUM = 42;
export const NEGATIVE_INT_ONE = -1;
export const NEGATIVE_INT_SMALL = -5;
export const NEGATIVE_INT_MEDIUM = -42;

// --- lebegőpontos számok (mindegyiknek van törtrésze, hogy isFloat igazat adjon rá) ---
export const POSITIVE_FLOAT_TINY = 0.0000001;
export const POSITIVE_FLOAT_SMALL = 0.5;
export const POSITIVE_FLOAT_MEDIUM = 7.25;
export const POSITIVE_FLOAT_TYPICAL = 2.5;
export const POSITIVE_FLOAT_LARGE = 12_345.6789;
export const NEGATIVE_FLOAT_SMALL = -0.5;
export const NEGATIVE_FLOAT_MEDIUM = -7.25;
export const NEGATIVE_FLOAT_LARGE = -12_345.6789;

// A `is-constructor.spec.ts` és `is-string-resolver.spec.ts` a primitívek
// elutasítását ellenőrzi egy általános float értékkel, a fenti skálától
// függetlenül.
export const TEST_NUMBER_FLOAT = 9.75;

// Az `is-function.spec.ts`, `is-function-return-any.spec.ts`, `is-string.spec.ts`
// és `is-numeric.spec.ts` egy tetszőleges, nem-boolean, nem-string számot vár
// a "false" ágakhoz - a név szerint 123.
export const MAGIC_NUMBER_123 = 123;

// --- tömbhosszak ---
// `is-date-array.spec.ts`: a 3 elemű tömb és a `toBe(true)` elvárás rögzíti,
// hogy MEDIUM = 3.
export const ARRAY_LENGTH_MEDIUM = 3;
// `is-date-array.spec.ts` ugyanitt: a hossz-ellenőrzés eredménye a tesztben
// már a nem-Date elem miatt hamis, függetlenül a konkrét számtól - a konkrét
// értéket (2) csak a teszt tömbjének tényleges hossza indokolja, a spec nem
// köti ki külön. NEM EGYÉRTELMŰ, dokumentálva.
export const ARRAY_LENGTH_SMALL = 2;
// `is-instanceof.spec.ts`: a szűrt `dates` tömb pontosan 1 elemű, ezt a
// `toHaveLength` állítás rögzíti.
export const ARRAY_LENGTH_SINGLE = 1;

// `is-numeric.spec.ts`: a névre szűkített `Number(TEST_STRING_NUMERIC)` a
// közvetlenül fölötte szereplő `'123'` literállal van összevetve.
export const TEST_STRING_NUMERIC = '123';

// --- dátum/időbélyeg konstansok (is-valid-date.spec.ts) ---
// A megjegyzés a specben explicit "1970-01-01 00:00:00 UTC"-t ír, ez a Unix
// epoch nulla milliszekundumban.
export const TIMESTAMP_UNIX_EPOCH = 0;
// A specben csak "// timestamp" megjegyzés áll, konkrét dátumhoz nem köti -
// bármely érvényes, véges milliszekundum-érték megfelel. NEM EGYÉRTELMŰ,
// dokumentálva: tetszőleges érvényes időbélyeget választottunk.
export const TIMESTAMP_EPOCH = 1_690_000_000_000;
// Az ECMAScript specifikáció szerint a Date +/-100 000 000 napot (Y1970-től)
// tud ábrázolni, ami +/-8 640 000 000 000 000 ezredmásodperc - ezen kívül a
// Date invalid.
// Forrás: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
// ("A Date object can represent a maximum of ±8,640,000,000,000,000 milliseconds")
export const TIMESTAMP_MAX_DATE = 8_640_000_000_000_000;
export const TIMESTAMP_MIN_DATE = -8_640_000_000_000_000;

// `new Date(year, month, day)` hívásban a hónap 0-indexelt (0 = január), ez
// az ECMAScript/MDN dokumentált viselkedése.
// Forrás: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
// ("month: Integer value representing the month, beginning with 0 for January to 11 for December")
export const DATE_YEAR_2023 = 2023;
export const DATE_MONTH_APRIL = 3;
export const DATE_DAY_15 = 15;
