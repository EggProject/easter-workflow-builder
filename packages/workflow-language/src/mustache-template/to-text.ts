/**
 * A behelyettesített érték szöveggé alakítása (SPEC-010 6.5, O-5): a szöveg
 * változatlan, a szám, a logikai érték és a `null` `String(value)`, a tömb és az
 * objektum `JSON.stringify(value)` alakot kap. A sablon kontextusa a `RunContext`
 * JSON adata, tehát más érték ide nem érkezik (6.5 utolsó bekezdése).
 */
export function toText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }
  return JSON.stringify(value);
}
