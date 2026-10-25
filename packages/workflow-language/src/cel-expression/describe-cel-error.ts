import { isCelError } from './is-cel-error.ts';

/**
 * A fordítás (`parse` és `check`) és a kiértékelés (`evaluate`) hibakódjai saját
 * magyar mondatra képezve (SPEC-010 7.2, 9.5, O-7, O-9). A kódok a telepített
 * csomag forrásából jönnek (`lib/parser.js`, `lib/macros.js`, `lib/operators.js`,
 * `lib/type-checker.js`, `lib/registry.js`, `lib/functions.js`,
 * `lib/overloads.js`, `lib/optional.js`); a mondat a kifejezés darabját
 * (azonosítót, mezőnevet, literált) és a futás adatát nem idézi.
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
  ['no_such_key', 'a hivatkozott kulcs nem létezik'],
  [
    'unsupported_type',
    'az adat egy értékének típusa a kifejezésben nem kezelhető (például saját constructor kulcsú objektum)',
  ],
  ['division_by_zero', 'nullával osztás a kifejezésben'],
  ['modulo_by_zero', 'nullával vett maradék a kifejezésben'],
  ['numeric_overflow', 'a számítás túllépi a számtípus tartományát'],
  ['index_out_of_bounds', 'a lista index a lista tartományán kívül esik'],
  ['index_out_of_range', 'a szöveg index a szöveg tartományán kívül esik'],
  ['int_conversion_error', 'az érték nem alakítható int típusra'],
  ['uint_conversion_error', 'az érték nem alakítható uint típusra'],
  ['double_conversion_error', 'az érték nem alakítható double típusra'],
  ['bool_conversion_error', 'az érték nem alakítható bool típusra'],
  ['invalid_timestamp', 'érvénytelen időbélyeg a kifejezésben'],
  ['invalid_duration', 'érvénytelen időtartam a kifejezésben'],
  ['invalid_regular_expression', 'érvénytelen reguláris kifejezés'],
  ['invalid_comparison_type', 'ezek az értékek nem hasonlíthatók össze'],
  ['invalid_list_element_type', 'a lista elemei nem megfelelő típusúak'],
  ['list_item_type_mismatch', 'a lista eleme nem a várt típusú'],
  ['field_type_mismatch', 'a mező értéke nem a várt típusú'],
  ['variable_type_mismatch', 'a változó értéke nem a várt típusú'],
  ['incompatible_argument_type', 'a függvény argumentumai nem összeillő típusúak'],
  ['invalid_optional_argument', 'a függvény opcionális értéket vár'],
  ['optional_expected', 'a kifejezés opcionális értéket vár'],
  ['optional_value_missing', 'az opcionális érték hiányzik'],
  ['invalid_context', 'a kiértékelés kontextusa nem objektum'],
]);

// A nem CEL kivétel leírása: a könyvtár szövege ekkor sem kerül ki.
const FALLBACK_SENTENCE = 'a kifejezés nem dolgozható fel';

/**
 * A CEL hiba saját magyar leírása (SPEC-010 9.5): a `code` mező szerinti mondat,
 * plusz a `range` mezőből vett karakter eltolás, ahol van. A táblában nem álló
 * kód a közös mondatot kapja a kóddal (user döntés 2026-10-25); a kód a könyvtár
 * azonosítója, nem a kifejezés darabja. A könyvtár `summary` és `message`
 * szövege nem kerül ki, mert a kifejezés darabját idézi (research 2. szekció
 * (4b)). A hibaosztály nevét a hívó teszi hozzá (6.2).
 */
export function describeCelError(error: unknown): string {
  if (!isCelError(error)) {
    return FALLBACK_SENTENCE;
  }
  const sentence = SENTENCES.get(error.code) ?? `${FALLBACK_SENTENCE} (kód: ${error.code})`;
  return error.range === undefined ? sentence : `${sentence} (pozíció: ${String(error.range.start)})`;
}
