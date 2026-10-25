import { describe, expect, it } from 'vitest';
import { createCelExpressionEvaluator } from './create-cel-expression-evaluator.ts';

// A teszt a valódi `@marcbachmann/cel-js@8.0.0` könyvtáron fut, mock nélkül. A minták a
// PLAN-010 F0 mérésből jönnek: `docs/research/2026-10-21-spec010-blokkolo-meresek.md`
// 2. szekció (1), (2) és (4b) pont.

function failure(message: string): { readonly kind: 'error'; readonly message: string } {
  return { kind: 'error', message };
}

describe('createCelExpressionEvaluator: compile (SPEC-010 7.2, 16. szekció 18.)', () => {
  const evaluator = createCelExpressionEvaluator();

  it.each([
    'input.pontszam >= 50.0 ? "magas" : "alacsony"',
    'input.elemek.filter(e, e.aktiv).map(e, e.nev)',
    'iteration < 3',
    'steps["ellenorzes"].kesz == false',
    'has(input.opcionalis) && input.opcionalis > 1.0',
    'item == null || itemIndex % 2 == 0',
    'size(joinInputs) > 0 && error.kind != ""',
    'input.darab + 1',
  ])('érvényes kifejezésre ok: %s', (expression) => {
    expect(evaluator.compile(expression)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it.each([
    ['1 +', 'váratlan jel a kifejezésben (pozíció: 3)'],
    ['input.(', 'hiányzó vagy rossz helyen álló jel a kifejezésben (pozíció: 6)'],
    ['1 ? 2', 'hiányzó vagy rossz helyen álló jel a kifejezésben (pozíció: 5)'],
    ['`', 'váratlan karakter a kifejezésben (pozíció: 0)'],
    ['"TITKOS_SZOVEG', 'le nem zárt szöveg a kifejezésben (pozíció: 0)'],
    ['"""TITKOS', 'le nem zárt háromszoros idézőjeles szöveg a kifejezésben (pozíció: 0)'],
    ["'a\nb'", 'sortörés áll egy egyszeres idézőjeles szövegben (pozíció: 2)'],
    [String.raw`"\q"`, 'érvénytelen escape a kifejezésben (pozíció: 1)'],
    [String.raw`"\u12"`, 'érvénytelen Unicode escape a kifejezésben (pozíció: 1)'],
    [String.raw`"\uD800"`, 'érvénytelen Unicode helyettesítő pár a kifejezésben (pozíció: 1)'],
    [String.raw`"\xZZ"`, 'érvénytelen hexadecimális escape a kifejezésben (pozíció: 1)'],
    [String.raw`"\12"`, 'az oktális escape pontosan három számjegyből áll (pozíció: 1)'],
    [String.raw`"\777"`, 'tartományon kívüli oktális escape a kifejezésben (pozíció: 1)'],
    [String.raw`b"\u00e9"`, 'bájt literálban nem állhat Unicode escape (pozíció: 2)'],
    ['0x', 'érvénytelen hexadecimális egész szám a kifejezésben (pozíció: 0)'],
    ['1e+', 'érvénytelen kitevő a kifejezésben (pozíció: 3)'],
    ['package', 'foglalt szó áll azonosítóként a kifejezésben (pozíció: 0)'],
    ['input.x.exists(1, true)', 'érvénytelen makró argumentum a kifejezésben (pozíció: 15)'],
  ])('szintaktikai hiba a parse-ból: %j', (expression, message) => {
    expect(evaluator.compile(expression)).toStrictEqual(failure(message));
  });

  it.each([
    ['step.x', 'nem deklarált változó a kifejezésben (pozíció: 0)'],
    ['stepsx == 1', 'nem deklarált változó a kifejezésben (pozíció: 0)'],
    ['input.a == titokNeve', 'nem deklarált változó a kifejezésben (pozíció: 11)'],
  ])('nem deklarált változó az env.check-ből: %s', (expression, message) => {
    expect(evaluator.compile(expression)).toStrictEqual(failure(message));
  });

  it.each([
    ['has(1)', 'érvénytelen makró argumentum a kifejezésben (pozíció: 4)'],
    ['input && 1', 'a logikai operátor logikai értéket vár (pozíció: 0)'],
    ['1 + "a"', 'a művelet ezekre az operandus típusokra nem értelmezett (pozíció: 0)'],
    ['size(1)', 'a függvény ezekre az argumentum típusokra nem értelmezett (pozíció: 0)'],
    ['1 ? 2 : 3', 'a feltételes kifejezés feltétele logikai értéket vár (pozíció: 0)'],
    ['true ? 1 : "a"', 'a feltételes kifejezés két ága eltérő típusú (pozíció: 0)'],
    ['[1, "a"]', 'a lista literál elemei eltérő típusúak (pozíció: 4)'],
    ['{1: 1, "a": 1}', 'a map literál kulcsai eltérő típusúak (pozíció: 7)'],
    ['{1: 1, 2: "a"}', 'a map literál értékei eltérő típusúak (pozíció: 10)'],
    ['[1][true]', 'érvénytelen index típus a kifejezésben (pozíció: 0)'],
    ['"a".x', 'ez az érték nem indexelhető (pozíció: 4)'],
    ['1.all(x, true)', 'a makró listát vagy mapet vár (pozíció: 0)'],
  ])('típushiba az env.check-ből: %s', (expression, message) => {
    expect(evaluator.compile(expression)).toStrictEqual(failure(message));
  });

  it.each([
    ['300 egymásba ágyazott zárójel', `${'('.repeat(300)}1${')'.repeat(300)}`, 250],
    ['260 egymásba ágyazott lista literál', `${'['.repeat(260)}1${']'.repeat(260)}`, 250],
    ['300 tagú mezőlánc', `input${'.a'.repeat(300)}`, 503],
  ])('a maxDepth túllépése limit_exceeded hibaág: %s', (_name, expression, position) => {
    expect(evaluator.compile(expression)).toStrictEqual(
      failure(`a kifejezés túllépi a nyelv beépített szerkezeti korlátját (pozíció: ${String(position)})`),
    );
  });

  it.each([
    ['240 egymásba ágyazott zárójel', `${'('.repeat(240)}1${')'.repeat(240)}`],
    ['300 egymás utáni unáris mínusz (a maxDepth nem általános AST mélység)', `${'-'.repeat(300)}1`],
    ['300 tagú összeadás lánc', Array.from({ length: 300 }, () => '1').join(' + ')],
  ])('a korlát alatt ok: %s', (_name, expression) => {
    expect(evaluator.compile(expression)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a hibaleírás a kifejezés darabját nem idézi (O-9)', () => {
    for (const expression of ['TITKOS_VALTOZO == 1', '"TITKOS_LITERAL" +', 'input.(TITKOS', '"TITKOS']) {
      const outcome = evaluator.compile(expression);
      expect(outcome.kind).toBe('error');
      expect(JSON.stringify(outcome)).not.toContain('TITKOS');
    }
  });

  it('egyetlen bemenetre sem dob kivételt', () => {
    for (const expression of ['', ' ', '\0', '}}}', ')'.repeat(1000), '"'.repeat(3), '\\', '\u{D800}']) {
      expect(() => evaluator.compile(expression)).not.toThrow();
    }
  });
});
