/**
 * Nullázható szám mező és a natív `<input type="number">` értéke közötti
 * oda-vissza leképezés, a `nullable-text-field-value.ts` mintájára. A
 * `fromNumberFieldValue` szándékosan nem szűri ki az érvénytelen (NaN)
 * bevitelt: a `NodeConfigSchema.safeParse` ezt a `node-inspector` saját
 * mezőnkénti hibajelzésén keresztül veti el, ugyanúgy, mint a
 * `graph-editor` `validateGraphForSave` mentés előtti kapuja.
 */
export function toNumberFieldValue(value: number | null): string {
  return value === null ? '' : String(value);
}

export function fromNumberFieldValue(value: string): number | null {
  if (value.trim() === '') {
    // eslint-disable-next-line unicorn/no-null -- a `node-config` séma nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem `undefined`-et (SPEC-005 protokoll alak).
    return null;
  }
  return Number(value);
}
