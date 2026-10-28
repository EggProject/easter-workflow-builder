/**
A titok helyére kerülő jelölő (SPEC-012 5.2, szabálykönyv 9. szekció).
*/
export const REDACTED = 'REDACTED';

/**
 * A titkok minden előfordulása `REDACTED`-re cserélődik a szövegben, még a
 * kiírás előtt, memóriában. A hosszabb érték előbb, hogy egy másik értéket
 * tartalmazó titok ne maradjon részben olvasható. Üres érték nem titok.
 */
export function maskSecrets(text: string, secretValues: readonly string[]): string {
  const longestFirst = secretValues.toSorted((left, right) => right.length - left.length);
  let masked = text;
  for (const secret of longestFirst) {
    if (secret !== '') {
      masked = masked.split(secret).join(REDACTED);
    }
  }
  return masked;
}
