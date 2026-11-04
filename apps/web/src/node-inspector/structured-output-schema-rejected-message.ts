/**
 * A strukturált kimenet sémájának mentéskori, szerver oldali elutasításának
 * mondata a mező alatt (SPEC-015 5.7). A szerver Ajv szövege a felületre nem
 * jut (`.claude/CLAUDE.md` 11. szekció), ezért a mondat a lehetséges okokat
 * sorolja fel: a séma a draft-07 szerint nem fordítható (hibás vagy
 * ismeretlen kulcsszó, ismeretlen `format`), vagy draft-07-nél újabb `$schema`
 * értéket deklarál.
 */
export const STRUCTURED_OUTPUT_SCHEMA_REJECTED_MESSAGE =
  'A séma érvénytelen: nem draft-07 szerinti JSON Schema, ismeretlen kulcsszót vagy formátumot tartalmaz, vagy draft-07-nél újabb $schema értéket deklarál.';
