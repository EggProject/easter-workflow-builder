/**
 * A kicsomagolás ideiglenes mappáinak (és a csere `previous` mappájának)
 * előtagja a skill könyvtár gyökerében, a `skills` mappán kívül, hogy a lista
 * ne lássa őket (SPEC-009 5.1). Az indulási takarítás ugyanezen az előtagon
 * ismeri fel a maradékot.
 */
export const STAGING_PREFIX = '.staging-';
