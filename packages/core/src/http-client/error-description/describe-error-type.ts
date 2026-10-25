/**
 * Ismeretlen típusú kivétel típusneve naplózáshoz: `Error` példánynál a
 * konstruktor neve (`TypeError`, `RangeError`, egy saját alosztály neve),
 * minden más értéknél a `typeof` eredménye, a `null` értékre `null`. Az
 * üzenetet szándékosan nem olvassa, mert az a kivételt kiváltó adat darabját
 * idézheti (SPEC-010 O-22).
 */
export function describeErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.constructor.name;
  }
  return error === null ? 'null' : typeof error;
}
