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

  it('REGRESSZIÓ: az optional névtérre épülő kifejezést elutasítja, a mezőnevet és a szöveg literált nem (O-23, PLAN-010 T-010-21 A-5)', () => {
    const sentence = 'az optional névtér nem használható, mert az opcionális típusok ki vannak kapcsolva (pozíció: 0)';
    expect(evaluator.compile('optional.of(1)')).toStrictEqual({ kind: 'error', message: sentence });
    expect(evaluator.compile('optional.none()')).toStrictEqual({ kind: 'error', message: sentence });
    expect(evaluator.compile('optional')).toStrictEqual({ kind: 'error', message: sentence });
    expect(evaluator.compile('input.optional')).toStrictEqual({ kind: 'ok', value: undefined });
    expect(evaluator.compile('"optional"')).toStrictEqual({ kind: 'ok', value: undefined });
  });
});

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

class Szerzo {
  readonly nev = 'Anna';
}

/**
 * Valós alakú `RunContext`: a motor `buildRunContext` kimenetének alakja, minden
 * kulcs jelen van, a hatókörön kívüli mező `undefined`, az `input` és a `steps`
 * JSON adat (SPEC-010 5.1, M-106; research 2. szekció 1. bekezdés).
 */
function runContext(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const input: unknown = JSON.parse(
    '{"pontszam":72,"darab":3,"tema":"x","elemek":[{"nev":"alma","aktiv":true},{"nev":"korte","aktiv":false},{"nev":"szilva","aktiv":true}]}',
  );
  const steps: unknown = JSON.parse(
    '{"ellenorzes":{"kesz":false},"kötőjeles-azonosító":{"mezo":"érték","mező":"ékezetes kulcs"},"llm-1":{"text":"válasz"}}',
  );
  return {
    input,
    steps,
    item: undefined,
    itemIndex: undefined,
    iteration: undefined,
    joinInputs: undefined,
    error: undefined,
    ...overrides,
  };
}

function ok(value: unknown): { readonly kind: 'ok'; readonly value: unknown } {
  return { kind: 'ok', value };
}

describe('createCelExpressionEvaluator: evaluate, a 7.3 bemeneti leképezés (16. szekció 19. ... 21.)', () => {
  const evaluator = createCelExpressionEvaluator();

  it('a felső szintű undefined mező null: az item == null a fan_out hatókörön kívül true', () => {
    expect(evaluator.evaluate('item == null', runContext())).toStrictEqual(ok(true));
    expect(evaluator.evaluate('error == null && joinInputs == null', runContext())).toStrictEqual(ok(true));
  });

  it('az itemIndex és az iteration CEL int: az iteration + 1 és az itemIndex % 2 kiértékelhető', () => {
    expect(evaluator.evaluate('iteration + 1', runContext({ iteration: 2 }))).toStrictEqual(ok(3));
    expect(evaluator.evaluate('itemIndex % 2', runContext({ itemIndex: 3 }))).toStrictEqual(ok(1));
  });

  it('minden más érték változatlan: az adatbeli szám double', () => {
    expect(evaluator.evaluate('input.darab + 1.0', runContext())).toStrictEqual(ok(4));
    expect(evaluator.evaluate('input.darab + 1', runContext())).toStrictEqual(
      failure('a művelet ezekre az operandus típusokra nem értelmezett (pozíció: 0)'),
    );
    expect(evaluator.evaluate('input.darab > 1', runContext())).toStrictEqual(ok(true));
    expect(evaluator.evaluate('item.nev', runContext({ item: { nev: 'e1' } }))).toStrictEqual(ok('e1'));
  });
});

describe('createCelExpressionEvaluator: evaluate, a 7.4 normalizálás a valódi könyvtáron (16. szekció 22., 61.)', () => {
  const evaluator = createCelExpressionEvaluator();
  const notFinite = failure('a kifejezés eredményében nem véges szám áll, ami JSON-ban nem ábrázolható');
  const notSafe = failure('a kifejezés eredményében a biztonságos tartományon kívüli egész szám áll');
  const notJson = failure('a kifejezés eredményében nem JSON érték áll');

  it.each([
    ['"szöveg"', 'szöveg'],
    ['true', true],
    ['null', jsonNull],
  ])('string, boolean, null változatlan: %s', (expression, value) => {
    expect(evaluator.evaluate(expression, runContext())).toStrictEqual(ok(value));
  });

  it('a véges double változatlan', () => {
    expect(evaluator.evaluate('1.5 + 2.5', runContext())).toStrictEqual(ok(4));
  });

  it.each(['0.0 / 0.0', 'double("NaN")', '1.0 / 0.0', '-1.0 / 0.0'])('a NaN és a végtelen hiba: %s', (expression) => {
    expect(evaluator.evaluate(expression, runContext())).toStrictEqual(notFinite);
  });

  it('a biztonságos int szám, a nem biztonságos hiba', () => {
    expect(evaluator.evaluate('1 + 2', runContext())).toStrictEqual(ok(3));
    expect(evaluator.evaluate('9007199254740991', runContext())).toStrictEqual(ok(Number.MAX_SAFE_INTEGER));
    expect(evaluator.evaluate('9007199254740993', runContext())).toStrictEqual(notSafe);
    expect(evaluator.evaluate('9223372036854775807', runContext())).toStrictEqual(notSafe);
  });

  it.each([
    ['uint', '1u'],
    ['bytes', 'b"abc"'],
    ['időbélyeg', 'timestamp("2026-01-01T00:00:00Z")'],
    ['időtartam', 'duration("1s")'],
    ['típus érték', 'type(1)'],
  ])('a nem JSON eredmény hiba: %s', (_name, expression) => {
    expect(evaluator.evaluate(expression, runContext())).toStrictEqual(notJson);
  });

  it('a kontextusból érkező Map és osztálypéldány hiba', () => {
    const withMap = runContext({ input: { m: new Map([['a', 1]]) } });
    const withInstance = runContext({ item: new Szerzo() });
    expect(evaluator.evaluate('input.m', withMap)).toStrictEqual(notJson);
    expect(evaluator.evaluate('item', withInstance)).toStrictEqual(
      failure('az adat egy értékének típusa a kifejezésben nem kezelhető (például saját constructor kulcsú objektum)'),
    );
  });

  it('a lista és a map rekurzívan normalizált', () => {
    expect(evaluator.evaluate('[1, 2, 3]', runContext())).toStrictEqual(ok([1, 2, 3]));
    expect(evaluator.evaluate('{"a": dyn(1), "b": dyn([2, 3]), "c": dyn({"d": "e"})}', runContext())).toStrictEqual(
      ok({ a: 1, b: [2, 3], c: { d: 'e' } }),
    );
    expect(evaluator.evaluate('[dyn(1), dyn("a"), dyn(1u)]', runContext())).toStrictEqual(notJson);
    expect(evaluator.evaluate('{"a": [0.0 / 0.0]}', runContext())).toStrictEqual(notFinite);
  });

  it('a kontextusból visszaadott lista és map új érték, a bemenet nem módosul', () => {
    const context = runContext();
    const outcome = evaluator.evaluate('input', context);
    expect(outcome).toStrictEqual(ok(context['input']));
    expect(outcome.kind === 'ok' && outcome.value).not.toBe(context['input']);
  });

  it('a nem string kulcsú map literál kulcsa string, ütközésnél csendes adatvesztéssel (O-8)', () => {
    expect(evaluator.evaluate('{1: "a"}', runContext())).toStrictEqual(ok({ '1': 'a' }));
    expect(evaluator.evaluate('{true: "a"}', runContext())).toStrictEqual(ok({ true: 'a' }));
    expect(evaluator.evaluate('{1u: "a"}', runContext())).toStrictEqual(ok({ '1': 'a' }));
    expect(evaluator.evaluate('{dyn(1): "a", dyn("1"): "b"}', runContext())).toStrictEqual(ok({ '1': 'b' }));
  });

  it('a map literál constructor, __proto__ és prototype kulcsa eltűnik (O-8)', () => {
    for (const key of ['constructor', '__proto__', 'prototype']) {
      expect(evaluator.evaluate(`{"${key}": 1, "a": 2}`, runContext())).toStrictEqual(ok({ a: 2 }));
    }
  });

  // Regresszió (O-15, research 10.2): a `[1]` + n darab `.map(x, [x, x])` eredménye a
  // könyvtárban közös hivatkozású szerkezet. A normalizálás régen fává bontotta, ami
  // n = 25-nél a folyamatot leállította. A teszt nem időt mér: a szerkezet állítja,
  // hogy a két testvér ugyanaz a tömb (a fává bontás minden szinten két külön
  // másolatot adna), és az első, kis n állítás a régi kódon már bukik, mielőtt a nagy
  // n kiértékelése elindulna.
  it.each([3, 200])('a közös hivatkozás megmarad, nincs exponenciális kibontás (n = %i)', (n) => {
    const outcome = evaluator.evaluate(`[1]${'.map(x, [x, x])'.repeat(n)}`, runContext());
    if (outcome.kind !== 'ok' || !Array.isArray(outcome.value)) {
      throw new TypeError('ok lista eredményt vártunk');
    }
    expect(outcome.value).toHaveLength(1);
    let level: unknown = outcome.value[0];
    for (let depth = 0; depth < n; depth += 1) {
      if (!Array.isArray(level)) {
        throw new TypeError(`a(z) ${String(depth)}. szinten listát vártunk`);
      }
      expect(level).toHaveLength(2);
      expect(level[0]).toBe(level[1]);
      level = level[0];
    }
    expect(level).toBe(1);
  });
});

describe('createCelExpressionEvaluator: evaluate, a 7.5 három példa valós alakú RunContext értéken (16. szekció 26.)', () => {
  const evaluator = createCelExpressionEvaluator();

  it('branch: string', () => {
    expect(evaluator.evaluate('input.pontszam >= 50.0 ? "magas" : "alacsony"', runContext())).toStrictEqual(
      ok('magas'),
    );
  });

  it('fan_out: JSON tömb', () => {
    expect(evaluator.evaluate('input.elemek.filter(e, e.aktiv).map(e, e.nev)', runContext())).toStrictEqual(
      ok(['alma', 'szilva']),
    );
  });

  it('loop: boolean, a loop saját iteration értéke a lefutásszám (O-11)', () => {
    expect(
      [0, 1, 2, 3].map((iteration) => evaluator.evaluate('iteration < 3', runContext({ iteration }))),
    ).toStrictEqual([ok(true), ok(true), ok(true), ok(false)]);
  });
});

describe('createCelExpressionEvaluator: evaluate, hiányzó kulcs, index alak, saját constructor kulcs (16. szekció 24., 25.)', () => {
  const evaluator = createCelExpressionEvaluator();

  it('a hiányzó kulcs hibaág, a has() védett alak nem', () => {
    expect(evaluator.evaluate('input.hianyzo', runContext())).toStrictEqual(
      failure('a hivatkozott kulcs nem létezik (pozíció: 6)'),
    );
    expect(evaluator.evaluate('steps["nincs"].x', runContext())).toStrictEqual(
      failure('a hivatkozott kulcs nem létezik (pozíció: 0)'),
    );
    expect(evaluator.evaluate('has(input.hianyzo)', runContext())).toStrictEqual(ok(false));
    expect(evaluator.evaluate('has(input.prioritas) ? input.prioritas : "normal"', runContext())).toStrictEqual(
      ok('normal'),
    );
    expect(evaluator.evaluate('has(item.x)', runContext())).toStrictEqual(ok(false));
  });

  it('a kötőjeles azonosító index alakja működik, az ékezetes mezőnév csak index alakban', () => {
    expect(evaluator.evaluate('steps["kötőjeles-azonosító"].mezo', runContext())).toStrictEqual(ok('érték'));
    expect(evaluator.evaluate('steps["kötőjeles-azonosító"]["mező"]', runContext())).toStrictEqual(
      ok('ékezetes kulcs'),
    );
    expect(evaluator.evaluate('steps["llm-1"].text', runContext())).toStrictEqual(ok('válasz'));
    expect(evaluator.evaluate('steps["kötőjeles-azonosító"].mező', runContext())).toStrictEqual(
      failure('váratlan karakter a kifejezésben (pozíció: 32)'),
    );
  });

  it('a saját constructor kulcsú objektum minden rá hivatkozó kifejezést buktat, a többi lépés olvasható (O-7)', () => {
    const steps: unknown = JSON.parse('{"a":{"x":1},"b":{"tema":"x","constructor":"saját"}}');
    const unsupported = failure(
      'az adat egy értékének típusa a kifejezésben nem kezelhető (például saját constructor kulcsú objektum)',
    );
    expect(evaluator.evaluate('steps["b"].tema', runContext({ steps }))).toStrictEqual(unsupported);
    expect(evaluator.evaluate('steps["a"].x', runContext({ steps }))).toStrictEqual(ok(1));
    const input: unknown = JSON.parse('{"tema":"x","constructor":"saját"}');
    expect(evaluator.evaluate('input.tema', runContext({ input }))).toStrictEqual(unsupported);
    expect(evaluator.evaluate('has(input.tema)', runContext({ input }))).toStrictEqual(unsupported);
  });

  it('a prototípus lánc nem érhető el', () => {
    for (const expression of ['input.constructor', 'input.__proto__', 'input.toString', 'input["constructor"]']) {
      expect(evaluator.evaluate(expression, runContext()).kind).toBe('error');
    }
    expect(evaluator.evaluate('has(input.constructor)', runContext())).toStrictEqual(ok(false));
  });
});

describe('createCelExpressionEvaluator: evaluate, a futásidejű hibakódok saját mondata (SPEC-010 9.5, O-9)', () => {
  const evaluator = createCelExpressionEvaluator();

  it.each([
    ['1 / 0', 'nullával osztás a kifejezésben (pozíció: 0)'],
    ['1 % 0', 'nullával vett maradék a kifejezésben (pozíció: 0)'],
    ['9223372036854775807 + 1', 'a számítás túllépi a számtípus tartományát (pozíció: 0)'],
    ['[1][5]', 'a lista index a lista tartományán kívül esik (pozíció: 0)'],
    ['int("x")', 'az érték nem alakítható int típusra (pozíció: 0)'],
    ['uint(-1)', 'az érték nem alakítható uint típusra (pozíció: 0)'],
    ['double("x")', 'az érték nem alakítható double típusra (pozíció: 0)'],
    ['bool("x")', 'az érték nem alakítható bool típusra (pozíció: 0)'],
    ['timestamp("x")', 'érvénytelen időbélyeg a kifejezésben (pozíció: 0)'],
    ['duration("x")', 'érvénytelen időtartam a kifejezésben (pozíció: 0)'],
    ['"a".matches("(")', 'érvénytelen reguláris kifejezés (pozíció: 0)'],
    ['input.tema && true', 'a logikai operátor logikai értéket vár (pozíció: 6)'],
    ['input.tema ? 1 : 2', 'a feltételes kifejezés feltétele logikai értéket vár (pozíció: 6)'],
    ['{1: "a"}.map(k, k)', 'a változó értéke nem a várt típusú'],
    ['dyn(1).size()', 'a függvény ezekre az argumentum típusokra nem értelmezett (pozíció: 0)'],
    ['nemDeklaralt', 'nem deklarált változó a kifejezésben (pozíció: 0)'],
    ['1 +', 'váratlan jel a kifejezésben (pozíció: 3)'],
  ])('%s', (expression, message) => {
    expect(evaluator.evaluate(expression, runContext())).toStrictEqual(failure(message));
  });

  it('a hibaleírás a kifejezés és az adat darabját nem idézi (16. szekció 33.)', () => {
    const context = runContext({ input: { TITKOS_ADAT: 'TITKOS_ERTEK' } });
    // A második elem a kód saját mondata: így az eset a 33. kritérium kódjaihoz kötött
    // (unknown_variable, no_such_key, unexpected_character).
    for (const [expression, codeSentence] of [
      ['TITKOS_VALTOZO == 1', 'nem deklarált változó a kifejezésben'],
      ['input.TITKOS_KULCS_NEV', 'a hivatkozott kulcs nem létezik'],
      ['steps["nincs-ilyen-TITKOS"]', 'a hivatkozott kulcs nem létezik'],
      ['steps["TITKOS-azonosító"].mező', 'váratlan karakter a kifejezésben'],
      ['input.TITKOS_ADAT + 1', 'a művelet ezekre az operandus típusokra nem értelmezett'],
    ] as const) {
      const outcome = evaluator.evaluate(expression, context);
      expect(outcome.kind === 'error' ? outcome.message.startsWith(`${codeSentence} (pozíció: `) : false).toBe(true);
      expect(JSON.stringify(outcome)).not.toContain('TITKOS');
    }
  });
});

describe('createCelExpressionEvaluator: evaluate egyetlen bemenetre sem dob kivételt (16. szekció 23.)', () => {
  const evaluator = createCelExpressionEvaluator();

  it('furcsa kifejezésre és furcsa kontextusra sem', () => {
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const throwingGetter = {
      get input(): unknown {
        throw new Error('TITKOS');
      },
    };
    const contexts: readonly unknown[] = [undefined, jsonNull, 'szöveg', 1n, [], runContext(), throwingGetter];
    for (const context of contexts) {
      for (const expression of ['', ' ', '\0', '}}}', ')'.repeat(1000), 'input', 'input.x.y', '\u{D800}']) {
        expect(() => evaluator.evaluate(expression, context)).not.toThrow();
      }
    }
    expect(evaluator.evaluate('input', runContext({ input: circular }))).toStrictEqual({
      kind: 'error',
      message: 'a kifejezés nem dolgozható fel',
      unexpectedErrorType: 'TypeError',
    });
    expect(evaluator.evaluate('input', throwingGetter)).toStrictEqual({
      kind: 'error',
      message: 'a kifejezés nem dolgozható fel',
      unexpectedErrorType: 'Error',
    });
  });

  // Regresszió: a körkörös adat korábban a verem kifutásán bukott, és a kivétel
  // típusa a futtató állapotától függött; a normalizálás bemelegítése után
  // `RangeError` jött `TypeError` helyett (research 2026-10-28 cel-korkoros-bemenet).
  it('a körkörös kontextus a bemelegített normalizálás után is TypeError', () => {
    const warmEvaluator = createCelExpressionEvaluator();
    const nested = runContext();
    for (let index = 0; index < 10_000; index += 1) {
      warmEvaluator.evaluate('input', nested);
    }
    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    expect(warmEvaluator.evaluate('input', runContext({ input: circular }))).toStrictEqual({
      kind: 'error',
      message: 'a kifejezés nem dolgozható fel',
      unexpectedErrorType: 'TypeError',
    });
  });
});
