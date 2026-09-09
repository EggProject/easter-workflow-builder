/**
 * `number[]` mező és egy soronkénti listát hordozó `<textarea>` értéke
 * közötti oda-vissza leképezés, a `string-list-field-value.ts` mintájára.
 * Az `error_handler` node `backoffMs` mezője az egyetlen fogyasztója.
 */
export function toNumberListFieldValue(value: readonly number[]): string {
  return value.join('\n');
}

export function fromNumberListFieldValue(value: string): readonly number[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(Number);
}
