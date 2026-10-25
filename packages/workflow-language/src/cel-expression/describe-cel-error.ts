import { isCelError } from './is-cel-error.ts';

/**
 * A fordítás (`parse` és `check`) hibakódjai saját magyar mondatra képezve
 * (SPEC-010 7.2, 9.5, O-9). A kódok a telepített csomag forrásából jönnek
 * (`lib/parser.js`, `lib/macros.js`, `lib/operators.js`, `lib/type-checker.js`);
 * a mondat a kifejezés darabját (azonosítót, mezőnevet, literált) nem idézi.
 * A futásidejű kódok a T-010-10 lépésben kerülnek ide.
 */
const SENTENCES: ReadonlyMap<string, string> = new Map([
  ['unexpected_character', 'váratlan karakter a kifejezésben'],
  ['unexpected_token', 'váratlan jel a kifejezésben'],
  ['expected_token', 'hiányzó vagy rossz helyen álló jel a kifejezésben'],
  ['reserved_identifier', 'foglalt szó áll azonosítóként a kifejezésben'],
  ['invalid_number', 'érvénytelen szám a kifejezésben'],
  ['invalid_integer', 'érvénytelen egész szám a kifejezésben'],
  ['invalid_hex_integer', 'érvénytelen hexadecimális egész szám a kifejezésben'],
  ['invalid_exponent', 'érvénytelen kitevő a kifejezésben'],
  ['newline_in_string', 'sortörés áll egy egyszeres idézőjeles szövegben'],
  ['unterminated_string', 'le nem zárt szöveg a kifejezésben'],
  ['unterminated_triple_quoted_string', 'le nem zárt háromszoros idézőjeles szöveg a kifejezésben'],
  ['bytes_unicode_escape', 'bájt literálban nem állhat Unicode escape'],
  ['invalid_unicode_escape', 'érvénytelen Unicode escape a kifejezésben'],
  ['invalid_unicode_surrogate', 'érvénytelen Unicode helyettesítő pár a kifejezésben'],
  ['invalid_hex_escape', 'érvénytelen hexadecimális escape a kifejezésben'],
  ['invalid_octal_escape', 'az oktális escape pontosan három számjegyből áll'],
  ['octal_escape_out_of_range', 'tartományon kívüli oktális escape a kifejezésben'],
  ['invalid_escape_sequence', 'érvénytelen escape a kifejezésben'],
  ['limit_exceeded', 'a kifejezés túllépi a nyelv beépített szerkezeti korlátját'],
  ['expression_must_be_string', 'a kifejezés nem szöveg'],
  ['invalid_macro_argument', 'érvénytelen makró argumentum a kifejezésben'],
  ['unknown_variable', 'nem deklarált változó a kifejezésben'],
  ['no_such_overload', 'a művelet ezekre az operandus típusokra nem értelmezett'],
  ['no_matching_overload', 'a függvény ezekre az argumentum típusokra nem értelmezett'],
  ['invalid_logical_operand', 'a logikai operátor logikai értéket vár'],
  ['invalid_condition_type', 'a feltételes kifejezés feltétele logikai értéket vár'],
  ['incompatible_ternary_branches', 'a feltételes kifejezés két ága eltérő típusú'],
  ['heterogeneous_list_element', 'a lista literál elemei eltérő típusúak'],
  ['heterogeneous_map_key', 'a map literál kulcsai eltérő típusúak'],
  ['heterogeneous_map_value', 'a map literál értékei eltérő típusúak'],
  ['invalid_index_type', 'érvénytelen index típus a kifejezésben'],
  ['cannot_index_type', 'ez az érték nem indexelhető'],
  ['invalid_comprehension_range', 'a makró listát vagy mapet vár'],
]);

// A nem ismert kód és a nem CEL kivétel leírása: a könyvtár szövege ekkor sem kerül ki.
const FALLBACK_SENTENCE = 'a kifejezés nem dolgozható fel';

/**
 * A CEL hiba saját magyar leírása (SPEC-010 9.5): a `code` mező szerinti mondat,
 * plusz a `range` mezőből vett karakter eltolás, ahol van. A könyvtár `summary`
 * és `message` szövege nem kerül ki, mert a kifejezés darabját idézi (research
 * 2. szekció (4b)). A hibaosztály nevét a hívó teszi hozzá (6.2).
 */
export function describeCelError(error: unknown): string {
  if (!isCelError(error)) {
    return FALLBACK_SENTENCE;
  }
  const sentence = SENTENCES.get(error.code) ?? FALLBACK_SENTENCE;
  return error.range === undefined ? sentence : `${sentence} (pozíció: ${String(error.range.start)})`;
}
