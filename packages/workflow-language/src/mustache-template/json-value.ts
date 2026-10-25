/**
 * Egy JSON-ban ábrázolható érték (SPEC-010 6.5): szöveg, véges szám, logikai
 * érték, `null`, tömb vagy sima objektum, a beágyazott elemekre is érvényesen.
 * Típus-only fájl, az `is-json-value.ts` guard szűkít rá.
 */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue };
