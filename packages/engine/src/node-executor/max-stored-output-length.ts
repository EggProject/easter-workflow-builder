/**
 * A `fan_out` kifejezése tárolandó eredményének legnagyobb engedett hossza: a
 * `JSON.stringify` eredményének `length` értéke, UTF-16 kódegységben (a
 * `16 777 215` a `2^24 - 1`). Termékdöntés (SPEC-010 15. szekció O-18, user
 * döntés 2026-10-25): a mért összeomlási pont negyede, research
 * `2026-10-21-spec010-blokkolo-meresek.md` 12. szekció.
 */
export const MAX_STORED_OUTPUT_LENGTH = 16_777_215;
