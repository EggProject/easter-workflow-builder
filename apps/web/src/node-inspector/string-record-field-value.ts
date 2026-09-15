/**
 * `Record<string, string>` mező és egy `kulcs=érték` soronkénti listát
 * hordozó `<textarea>` értéke közötti oda-vissza leképezés. A
 * `sub_workflow` node `inputMapping` mezőjének egyetlen fogyasztója. Egy
 * `=` jel nélküli vagy üres kulcsú sor figyelmen kívül marad - a
 * `NodeConfigSchema.safeParse` a végleges alakot úgyis ellenőrzi.
 */
export function toStringRecordFieldValue(value: Readonly<Record<string, string>>): string {
  return Object.entries(value)
    .map(([key, entryValue]) => `${key}=${entryValue}`)
    .join('\n');
}

export function fromStringRecordFieldValue(value: string): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const line of value.split('\n')) {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const entryValue = line.slice(separatorIndex + 1).trim();
    if (key.length > 0) {
      result[key] = entryValue;
    }
  }
  return result;
}
