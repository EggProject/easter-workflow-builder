/**
 * Maszkoló segédfüggvények a proxy artefaktumaihoz.
 *
 * Kétféle maszkolás van, mert két különböző cél mögötte:
 * - a jól ismert titkos headerek (authorization, x-api-key) értékét hossz- és
 *   utolsó-4-karakter-megtartó maszkkal látjuk el, hogy azonosítható maradjon
 *   melyik kulcsról van szó, de a titok ne szivárogjon;
 *   ez a titok tényleges ÉRTÉKÉNEK ismerete nélkül is működik.
 * - emellett a teljes rögzített szöveget átfésüljük a ténylegesen ismert
 *   titkokra (pl. a MINIMAX_API_KEY env érték), és minden előfordulást
 *   simán "REDACTED"-re cserélünk, biztonsági hálóként, ha a titok
 *   véletlenül máshol (pl. a body-ban) is megjelenne.
 */

const SECRET_HEADER_NAMES = new Set(['authorization', 'x-api-key']);

/** Igaz, ha a header neve a jól ismert titkos headerek egyike (kis- és nagybetűtől függetlenül). */
export function isSecretHeaderName(name: string): boolean {
  return SECRET_HEADER_NAMES.has(name.toLowerCase());
}

/** Hossz- és utolsó-4-karakter-megtartó maszk: pl. "sk-abcd1234" -> "*******1234". */
export function maskSecretValue(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  const visibleSuffix = value.slice(-4);
  return '*'.repeat(value.length - 4) + visibleSuffix;
}

/** Headerkészlet maszkolása: a titkos headerek értéke maszkolva, a többi változatlan. */
export function maskHeaders(headers: Readonly<Record<string, string>>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    masked[name] = isSecretHeaderName(name) ? maskSecretValue(value) : value;
  }
  return masked;
}

/** Egy szövegben minden ismert titok minden előfordulását "REDACTED"-re cseréli. */
export function redactKnownSecrets(text: string, secrets: readonly string[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue;
    }
    result = result.split(secret).join('REDACTED');
  }
  return result;
}
