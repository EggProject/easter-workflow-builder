/**
 * Érték szintű törlő (SPEC-006 7.4 2. pont, második védelmi réteg). A pino
 * `redact` opciója (`redact-paths.ts`) mezőnév alapján dolgozik, tehát nem
 * fogja meg azt az esetet, amikor egy titok egy hibaüzenet SZÖVEGÉBEN áll.
 * Ez a függvény ezért a már szövegesített napló sorban keresi és cseréli a
 * konfigurációból ismert titkokat, a lemezre írás előtt, memóriában.
 *
 * A `String.prototype.replaceAll` string argumentummal literális cserét
 * végez, reguláris kifejezésként nem értelmezi a mintát
 * (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/replaceAll),
 * tehát a titok értékében szereplő speciális karaktert nem kell escape-elni.
 */

export function scrubSecretValues(text: string, secretValues: readonly string[]): string {
  let scrubbed = text;
  for (const secretValue of secretValues) {
    if (secretValue.length === 0) {
      continue;
    }
    // A helyettesítő érték szó szerint ugyanaz, mint a pino `redact` opció
    // dokumentált alapértéke ('[Redacted]', SPEC-006 M-25) - a két réteg
    // kimenete így megkülönböztethetetlen, nem vezetünk be második maszkoló
    // sztringet. Az `unicorn/no-unsafe-string-replacement` szabály miatt a
    // literál közvetlenül itt áll, nem egy külön névvel hivatkozott konstansban.
    scrubbed = scrubbed.replaceAll(secretValue, '[Redacted]');
  }
  return scrubbed;
}
