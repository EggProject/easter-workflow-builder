/**
 * Nullázható szöveg mező és a natív `<input>`/`<textarea>` értéke közötti
 * oda-vissza leképezés (SPEC-005 protokoll alak: a hiányzó szöveges mező a
 * dróton `null`, nem `undefined`). Az üres (vagy csak szóközből álló)
 * beviteli érték `null`-ra képződik vissza - ez a "nincs beállítva" jelölés
 * a `node-inspector` minden nullázható szöveg mezőjén.
 */
export function toTextFieldValue(value: string | null): string {
  return value ?? '';
}

export function fromTextFieldValue(value: string): string | null {
  if (value.trim() === '') {
    // eslint-disable-next-line unicorn/no-null -- a `node-config` séma nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem `undefined`-et (SPEC-005 protokoll alak).
    return null;
  }
  return value;
}
