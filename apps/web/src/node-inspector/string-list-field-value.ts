/**
 * `string[]` mező és egy soronkénti listát hordozó `<textarea>` értéke
 * közötti oda-vissza leképezés (`allowedTools`, `disallowedTools`,
 * `additionalDirectories`, `handledErrorKinds` és hasonló listás mezők
 * közös szerkesztő mintája a `node-inspector` témában).
 */
export function toStringListFieldValue(value: readonly string[]): string {
  return value.join('\n');
}

export function fromStringListFieldValue(value: string): readonly string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
