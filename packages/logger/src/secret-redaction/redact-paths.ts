/**
 * A pino `redact` opciójának útvonal listája (első védelmi réteg, SPEC-006
 * 7.4 1. pont). A pino path szintaxisa case sensitive, és a kötőjelet
 * tartalmazó kulcshoz szögletes zárójel kell
 * (https://github.com/pinojs/pino/blob/main/docs/redaction.md#path-syntax:
 * "paths are case sensitive", `a["b-c"].d`).
 *
 * A `.claude/CLAUDE.md` 11. szekció szerint a `node:http` mindig kisbetűs
 * fejlécnevet ad (`req.headers.authorization`), de a listában a kanonikus,
 * ember írta alak is szerepel arra az esetre, ha a naplózott objektum nem
 * közvetlenül a Node fejléc objektuma. A `*` egy szintnyi wildcard.
 */
export const REDACT_PATHS: readonly string[] = [
  'authorization',
  'Authorization',
  'headers.authorization',
  'headers.Authorization',
  '*.authorization',
  '*.Authorization',
  '["x-api-key"]',
  '["X-Api-Key"]',
  'headers["x-api-key"]',
  'headers["X-Api-Key"]',
  '*["x-api-key"]',
  '*["X-Api-Key"]',
];
