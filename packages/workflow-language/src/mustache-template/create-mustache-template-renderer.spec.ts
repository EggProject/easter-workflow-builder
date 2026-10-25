import Mustache from 'mustache';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createMustacheTemplateRenderer } from './create-mustache-template-renderer.ts';

// A teszt a valódi `mustache@4.2.0` könyvtáron fut, mock nélkül. A minták a PLAN-010
// F0 mérésből jönnek: `docs/research/2026-10-21-spec010-blokkolo-meresek.md` 3. szekció.

// A modul szintű állapot a gyártó függvény hívása előtt (SPEC-010 16. szekció 11., 12.).
const originalEscape = Mustache.escape;
const originalTemplateCache = Mustache.templateCache;

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

/**
 * Valós alakú `RunContext`: minden kulcs jelen van, a hatókörön kívüli mező
 * `undefined`, az `input` és a `steps` JSON alakú adat (SPEC-010 5.1, M-106).
 */
function runContext(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  const input: unknown = {
    tema: 'Kód: <a href="x">\'&/`=',
    s: '&<>"\'/`=',
    items: ['a', 'b'],
    elemek: ['x', 'y'],
    ures: [],
    szam: 42,
    igaz: true,
    semmi: jsonNull,
    tomb: ['a', 1, jsonNull, { k: 'v' }],
    szerzo: { nev: 'Anna', kor: 30, cim: { varos: 'Pécs' } },
    csoportok: [
      { nev: 'g1', tagok: ['t1', 't2'] },
      { nev: 'g2', tagok: [] },
    ],
  };
  const steps: unknown = { 'node-1': { summary: 'kesz' } };
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

function missing(name: string): { readonly kind: 'error'; readonly message: string } {
  return { kind: 'error', message: `hiányzó név a sablonban: ${name}` };
}

describe('createMustacheTemplateRenderer: escape és szöveggé alakítás (SPEC-010 6.1, 6.5)', () => {
  const renderer = createMustacheTemplateRenderer();

  it.each(['&', '<', '>', '"', "'", '/', '`', '='])('a %s karakter változatlanul átjut (16. szekció 9.)', (char) => {
    expect(renderer.render('{{v}}', { v: char })).toStrictEqual({ kind: 'ok', value: char });
  });

  it('a három behelyettesítési alak ugyanazt adja (16. szekció 10.)', () => {
    expect(renderer.render('{{input.s}}|{{{input.s}}}|{{& input.s}}', runContext())).toStrictEqual({
      kind: 'ok',
      value: '&<>"\'/`=|&<>"\'/`=|&<>"\'/`=',
    });
  });

  it.each([
    ['input.szam', '42'],
    ['input.igaz', 'true'],
    ['input.semmi', 'null'],
    ['input.tomb', '["a",1,null,{"k":"v"}]'],
    ['input.szerzo', '{"nev":"Anna","kor":30,"cim":{"varos":"Pécs"}}'],
    ['input.ures', '[]'],
  ])('a(z) %s mindhárom alakban %s (16. szekció 16., 57.)', (name, expected) => {
    expect(renderer.render(`{{${name}}}|{{{${name}}}}|{{& ${name}}}`, runContext())).toStrictEqual({
      kind: 'ok',
      value: `${expected}|${expected}|${expected}`,
    });
  });

  it('a globális Mustache.escape ugyanaz a referencia, és továbbra is HTML escape-el (16. szekció 11.)', () => {
    createMustacheTemplateRenderer().render('{{input.s}}', runContext());
    expect(Mustache.escape).toBe(originalEscape);
    expect(Mustache.escape('<')).toBe('&lt;');
  });

  it('a modul szintű gyorsítótár változatlan, és a sablon nem kerül bele (16. szekció 12.)', () => {
    const template = '{{input.szam}}';
    const fresh = createMustacheTemplateRenderer();
    expect(fresh.compile(template)).toStrictEqual({ kind: 'ok', value: undefined });
    fresh.render(template, runContext());
    expect(Mustache.templateCache).toBe(originalTemplateCache);
    // A könyvtár kulcsa a sablon és a határolók (`mustache.mjs` 511. sor).
    expect(Mustache.templateCache?.get(`${template}:{{:}}`)).toBeUndefined();
  });
});

describe('createMustacheTemplateRenderer: compile (SPEC-010 6.2, 9.5)', () => {
  const renderer = createMustacheTemplateRenderer();

  it('érvényes sablonra ok', () => {
    expect(renderer.compile('Szia {{input.tema}} {{#input.elemek}}{{.}}{{/input.elemek}}')).toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
  });

  it.each([
    ['Szia {{input.tema', 'le nem zárt tag a sablonban (pozíció: 17)'],
    [
      'x {{/ez itt egy hosszu TITKOS mondat a sablonbol 789}} y',
      'meg nem nyitott szakasz lezárása a sablonban (pozíció: 2)',
    ],
    ['{{#input.elemek}}a{{/input.masik}}', 'le nem zárt szakasz a sablonban (pozíció: 18)'],
    ['elotte {{#TITKOS nyito szoveg 222}}a', 'le nem zárt szakasz a sablonban (pozíció: 36)'],
    ['{{=ez_a_teljes_TITKOS_szoveg_444_idezve_lesz=}}', 'érvénytelen határoló csere a sablonban'],
  ])('a %s sablon saját magyar leírást kap, a sablon szövege nélkül (16. szekció 13., 33.)', (template, message) => {
    const outcome = renderer.compile(template);
    expect(outcome).toStrictEqual({ kind: 'error', message });
    expect(JSON.stringify(outcome)).not.toContain('TITKOS');
    expect(JSON.stringify(outcome)).not.toContain('input.elemek');
  });

  it('a render a fordítási hibát ugyanígy írja le', () => {
    expect(renderer.render('Szia {{input.tema', runContext())).toStrictEqual({
      kind: 'error',
      message: 'le nem zárt tag a sablonban (pozíció: 17)',
    });
  });
});

describe('createMustacheTemplateRenderer: a 6.4 táblázat a szűkítés mellett (SPEC-010 6.4, 6.6)', () => {
  const renderer = createMustacheTemplateRenderer();

  it.each([
    ['{{input.tema}}', runContext(), 'Kód: <a href="x">\'&/`='],
    ['{{#input.elemek}}- {{.}}{{/input.elemek}}', runContext(), '- x- y'],
    ['{{^input.ures}}nincs{{/input.ures}}', runContext(), 'nincs'],
    ['{{^input.nemletezik}}nincs{{/input.nemletezik}}', runContext(), 'nincs'],
    ['{{^input.elemek}}nincs{{/input.elemek}}', runContext(), ''],
    ['{{> nev}}', runContext(), ''],
    ['a{{>nev}}b{{> ../../etc/passwd}}{{> input}}', runContext(), 'ab'],
    ['  {{> x}}\nsor', runContext(), 'sor'],
    ['{{=<% %>=}}<% input.szam %>', runContext(), '42'],
    ['{{#input.csoportok}}{{nev}}:{{#tagok}}{{.}},{{/tagok}};{{/input.csoportok}}', runContext(), 'g1:t1,t2,;g2:;'],
    ['{{#input.elemek}}{{.}}{{input.szam}}{{/input.elemek}}', runContext(), 'x42y42'],
    ['{{#input.szerzo}}{{nev}} {{kor}} {{cim.varos}}{{/input.szerzo}}', runContext(), 'Anna 30 Pécs'],
    ['{{steps.node-1.summary}}', runContext(), 'kesz'],
    ['{{input.elemek.length}}', runContext(), '2'],
    ['{{item.nev}}#{{itemIndex}}', runContext({ item: { nev: 'e1' }, itemIndex: 0 }), 'e1#0'],
    ['{{iteration}}', runContext({ iteration: 2 }), '2'],
    ['{{#joinInputs}}[{{.}}]{{/joinInputs}}', runContext({ joinInputs: ['a', { k: 1 }] }), '[a][{"k":1}]'],
    [
      '{{error.kind}}: {{error.message}}',
      runContext({ error: { kind: 'timeout', message: 'lejárt' } }),
      'timeout: lejárt',
    ],
  ])('%s', (template, view, expected) => {
    expect(renderer.render(template, view)).toStrictEqual({ kind: 'ok', value: expected });
  });
});

describe('createMustacheTemplateRenderer: a hiányzó név (SPEC-010 6.7, O-4, O-10)', () => {
  const renderer = createMustacheTemplateRenderer();

  it.each([
    ['{{input.nemletezik}}', 'input.nemletezik'],
    ['{{{input.nemletezik}}}', 'input.nemletezik'],
    ['{{& input.szerzo.nemletezik}}', 'input.szerzo.nemletezik'],
    ['{{#input.elemek}}{{nincs}}{{/input.elemek}}', 'nincs'],
    ['{{item}}', 'item'],
    ['{{itemIndex}}', 'itemIndex'],
    ['{{error.kind}}', 'error.kind'],
    ['{{input.tema.length}}', 'input.tema.length'],
  ])('a sima változó tag %s hibát ad, a nevet idézve (16. szekció 58., 60.)', (template, name) => {
    expect(renderer.render(template, runContext())).toStrictEqual(missing(name));
  });

  it.each([
    ['{{#input.nemletezik}}x{{/input.nemletezik}}', ''],
    ['{{^input.nemletezik}}x{{/input.nemletezik}}', 'x'],
    ['{{#item}}x{{/item}}{{^item}}nincs elem{{/item}}', 'nincs elem'],
    ['{{#input.tema.length}}x{{/input.tema.length}}', ''],
  ])('a szakasz és a fordított szakasz %s hiba nélküli (16. szekció 58., 60.)', (template, expected) => {
    expect(renderer.render(template, runContext())).toStrictEqual({ kind: 'ok', value: expected });
  });
});

class Szerzo {
  readonly nev = 'Anna';
}

function nonJson(name: string): { readonly kind: 'error'; readonly message: string } {
  return { kind: 'error', message: `nem JSON értékre mutató név a sablonban: ${name}` };
}

// Saját mező nélküli objektum, aminek a prototípusa egy másik sima objektum.
const inheritedOnly: unknown = Object.create({ nev: 'Anna' });

describe('createMustacheTemplateRenderer: szigorú kiírás (SPEC-010 6.5, user döntés 2026-10-25)', () => {
  const renderer = createMustacheTemplateRenderer();

  it.each([
    ['Map', new Map([['nev', 'Anna']])],
    ['Date', new Date(0)],
    ['osztálypéldány', new Szerzo()],
    ['BigInt', 1n],
    ['Symbol', Symbol('x')],
    ['Uint8Array', new Uint8Array([1])],
    ['nem sima prototípusú objektum', inheritedOnly],
  ])('a %s érték mindhárom változó tag alakon a nevet megnevező hibát ad', (_name, value) => {
    const view = { input: { szerzo: value } };
    for (const template of ['a {{input.szerzo}} b', 'a {{{input.szerzo}}} b', 'a {{& input.szerzo}} b']) {
      expect(renderer.render(template, view)).toStrictEqual(nonJson('input.szerzo'));
    }
  });

  it('a pont név és a szakasz belseje is a kért nevet nevezi meg', () => {
    expect(renderer.render('{{.}}', new Map())).toStrictEqual(nonJson('.'));
    expect(
      renderer.render('{{#input.elemek}}{{.}}{{/input.elemek}}', { input: { elemek: [new Date(0)] } }),
    ).toStrictEqual(nonJson('.'));
  });

  it('a null prototípusú objektum sima objektum, JSON szövegként íródik', () => {
    const szerzo: unknown = Object.assign(Object.create(null), { nev: 'Anna' });
    expect(renderer.render('{{input.szerzo}}', { input: { szerzo } })).toStrictEqual({
      kind: 'ok',
      value: '{"nev":"Anna"}',
    });
  });

  it('a szakasz a nem JSON értéken a könyvtár útján marad, hiba nélkül', () => {
    expect(renderer.render('{{#input.szerzo}}x{{/input.szerzo}}', { input: { szerzo: new Map() } })).toStrictEqual({
      kind: 'ok',
      value: 'x',
    });
  });
});

const circularObject: Record<string, unknown> = {};
circularObject['self'] = circularObject;

const circularArray: unknown[] = [];
circularArray.push({ back: circularArray });

describe('createMustacheTemplateRenderer: mélyen szigorú kiírás (SPEC-010 6.5, user döntés 2026-10-25)', () => {
  const renderer = createMustacheTemplateRenderer();
  const TAGS = ['a {{input.v}} b', 'a {{{input.v}}} b', 'a {{& input.v}} b'] as const;

  // Minden alak, ami a beágyazott értéknél hibát ad: a nem JSON típusok, a nem véges szám és a körkörösség.
  const NESTED_VALUES: readonly (readonly [string, unknown])[] = [
    ['Map', new Map()],
    ['Date', new Date(0)],
    ['osztálypéldány', new Szerzo()],
    ['BigInt', 1n],
    ['Symbol', Symbol('x')],
    ['függvény', () => 1],
    ['Uint8Array', new Uint8Array([1])],
    ['undefined', undefined],
    ['NaN', NaN],
    ['végtelen', Infinity],
  ];

  it.each(NESTED_VALUES)(
    'a tömbben, az objektumban és több szint mélyen álló %s a nevet megnevező hibát ad',
    (_name, nested) => {
      for (const v of [[nested], { k: nested }, { a: [1, { b: [[nested]] }] }]) {
        for (const template of TAGS) {
          expect(renderer.render(template, { input: { v } })).toStrictEqual(nonJson('input.v'));
        }
      }
    },
  );

  it.each([NaN, Infinity, -Infinity])('a felső szintű %s is a nevet megnevező hibát ad', (v) => {
    for (const template of TAGS) {
      expect(renderer.render(template, { input: { v } })).toStrictEqual(nonJson('input.v'));
    }
  });

  it.each([
    ['körkörös sima objektum', circularObject],
    ['körkörös tömb', circularArray],
  ])('a %s a nevet megnevező hibát ad, tartalék mondat nélkül', (_name, v) => {
    for (const template of TAGS) {
      expect(renderer.render(template, { input: { v } })).toStrictEqual(nonJson('input.v'));
    }
  });

  it('a mélyen beágyazott tiszta JSON és a közös hivatkozás átmegy (ellenpélda)', () => {
    const shared = { k: [1] };
    const v = { a: [1, { b: [['x', jsonNull, true, { c: { d: [0.5] } }]] }], x: shared, y: shared };
    for (const template of TAGS) {
      expect(renderer.render(template, { input: { v } })).toStrictEqual({
        kind: 'ok',
        value: 'a {"a":[1,{"b":[["x",null,true,{"c":{"d":[0.5]}}]]}],"x":{"k":[1]},"y":{"k":[1]}} b',
      });
    }
  });

  it('a szakasz a beágyazott nem JSON értéken is a könyvtár útján marad, hiba nélkül', () => {
    expect(renderer.render('{{#input.v}}x{{/input.v}}', { input: { v: [new Map()] } })).toStrictEqual({
      kind: 'ok',
      value: 'x',
    });
  });
});

describe('createMustacheTemplateRenderer: kivétel nem hagyja el a függvényt (SPEC-010 6.2)', () => {
  const renderer = createMustacheTemplateRenderer();

  it('az ismeretlen kivétel (a vizsgálat közben dobó Proxy) a tartalék mondat, a szöveg nélkül', () => {
    const throwing: unknown = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new TypeError('TITKOS a proxy hibája');
        },
      },
    );
    const outcome = renderer.render('{{v}}', { v: throwing });
    expect(outcome).toStrictEqual({ kind: 'error', message: 'a sablon nem renderelhető' });
    expect(JSON.stringify(outcome)).not.toContain('TITKOS');
  });

  it('nem objektum nézeten a sima tag hiányzó név, a szakasz üres', () => {
    expect(renderer.render('{{x}}', undefined)).toStrictEqual(missing('x'));
    expect(renderer.render('{{.}}', 'szoveg')).toStrictEqual({ kind: 'ok', value: 'szoveg' });
    expect(renderer.render('{{#x}}y{{/x}}', 7)).toStrictEqual({ kind: 'ok', value: '' });
  });
});

/**
 * A beépített metódusok, amiket a gyári név feloldás elér és meghív (research 3.
 * szekció (8)); a csapda csak a renderelés idejére számol.
 */
const TRAP_TARGETS: readonly (readonly [object, string, string])[] = [
  [Array, 'fromAsync', 'Array.fromAsync'],
  [Array, 'from', 'Array.from'],
  [Array.prototype, 'map', 'Array.prototype.map'],
  [Array.prototype, 'toString', 'Array.prototype.toString'],
  [Object.prototype, 'toString', 'Object.prototype.toString'],
  [Object.prototype, 'valueOf', 'Object.prototype.valueOf'],
  [Object.prototype, 'hasOwnProperty', 'Object.prototype.hasOwnProperty'],
  [Object, 'keys', 'Object.keys'],
  [String.prototype, 'toString', 'String.prototype.toString'],
  [String.prototype, 'valueOf', 'String.prototype.valueOf'],
];

// A F0 támadó sablon lista mind a harminc eleme (research 3. szekció (8), `p8-run.mjs`).
const ATTACKS: readonly (readonly [string, string | undefined])[] = [
  ['{{toString}}', 'toString'],
  ['{{constructor}}', 'constructor'],
  ['{{input.constructor.name}}', 'input.constructor.name'],
  ['{{input.constructor.constructor.name}}', 'input.constructor.constructor.name'],
  ['{{#constructor}}x{{/constructor}}', undefined],
  ['{{input.__proto__}}', 'input.__proto__'],
  ['{{input.tema.constructor.name}}', 'input.tema.constructor.name'],
  ['{{steps.x.map}}', 'steps.x.map'],
  ['{{input.items.constructor.fromAsync}}', 'input.items.constructor.fromAsync'],
  ['{{#input.items.constructor.fromAsync}}x{{/input.items.constructor.fromAsync}}', undefined],
  ['{{input.items.map}}', 'input.items.map'],
  ['{{#input.items.map}}x{{/input.items.map}}', undefined],
  ['{{{input.constructor}}}', 'input.constructor'],
  ['{{& input.toString}}', 'input.toString'],
  ['{{input.hasOwnProperty}}', 'input.hasOwnProperty'],
  ['{{input.valueOf}}', 'input.valueOf'],
  ['{{input.__proto__.constructor.name}}', 'input.__proto__.constructor.name'],
  ['{{#input.constructor.constructor}}return 1{{/input.constructor.constructor}}', undefined],
  ['{{#input}}{{constructor.name}}{{/input}}', 'constructor.name'],
  ['{{#input.items}}{{constructor.name}}{{/input.items}}', 'constructor.name'],
  ['{{#input.items}}{{length}}{{/input.items}}', 'length'],
  ['{{#input.tema}}{{length}}{{/input.tema}}', 'length'],
  ['{{steps.node-1.constructor.name}}', 'steps.node-1.constructor.name'],
  ['{{item.constructor}}', 'item.constructor'],
  ['{{input.trapFn}}', 'input.trapFn'],
  ['{{#input.trapFn}}x{{/input.trapFn}}', undefined],
  ['{{{input.trapFn}}}', 'input.trapFn'],
  ['{{#input.szerzo}}{{toString}}{{valueOf}}{{/input.szerzo}}', 'toString'],
  ['{{input.items.constructor.from}}', 'input.items.constructor.from'],
  ['{{input.constructor.keys}}', 'input.constructor.keys'],
];

describe('createMustacheTemplateRenderer: a F0 támadó sablon lista (SPEC-010 6.6, 16. szekció 14.)', () => {
  const calls: string[] = [];
  let isArmed = false;
  const restorers: (() => void)[] = [];
  const view = runContext();
  const input = view['input'];
  if (typeof input === 'object' && input !== null) {
    // Csapda függvény a nézetben, saját tulajdonságként (a `RunContext` ilyet nem hordozhat).
    Object.defineProperty(input, 'trapFn', {
      enumerable: true,
      value: () => {
        if (isArmed) {
          calls.push('input.trapFn');
        }
        return 'TRAP';
      },
    });
  }

  function renderArmed(render: () => unknown): unknown {
    calls.length = 0;
    isArmed = true;
    try {
      return render();
    } finally {
      isArmed = false;
    }
  }

  beforeAll(() => {
    for (const [owner, key, label] of TRAP_TARGETS) {
      const descriptor = Object.getOwnPropertyDescriptor(owner, key);
      const original: unknown = descriptor?.value;
      if (descriptor === undefined || typeof original !== 'function') {
        throw new TypeError(`nincs csapdázható metódus: ${label}`);
      }
      Object.defineProperty(owner, key, {
        configurable: true,
        writable: true,
        enumerable: false,
        value: function trapped(this: unknown, ...arguments_: unknown[]): unknown {
          if (isArmed) {
            calls.push(label);
          }
          const result: unknown = Reflect.apply(original, this, arguments_);
          return result;
        },
      });
      restorers.push(() => {
        Object.defineProperty(owner, key, descriptor);
      });
    }
  });

  afterAll(() => {
    for (const restore of restorers) {
      restore();
    }
  });

  it('kontrollként: a gyári Writer a nézet függvényét meghívja, tehát a csapda számol', () => {
    const output = renderArmed(() => new Mustache.Writer().render('{{input.trapFn}}', view));
    expect(output).toBe('TRAP');
    expect(calls).toContain('input.trapFn');
  });

  it.each(ATTACKS)('%s: üres vagy hiányzó név, függvényhívás nélkül', (template, missingName) => {
    const renderer = createMustacheTemplateRenderer();
    const outcome = renderArmed(() => renderer.render(template, view));
    expect(outcome).toStrictEqual(missingName === undefined ? { kind: 'ok', value: '' } : missing(missingName));
    // Nulla `Array.fromAsync` hívás: nem keletkezik promise, tehát kezeletlen elutasítás sem.
    expect(calls).toStrictEqual([]);
  });

  it('a getter nem fut le, és a neve hiányzó név', () => {
    let getterCalls = 0;
    const withGetter = {
      get titok() {
        getterCalls += 1;
        return 'x';
      },
    };
    expect(createMustacheTemplateRenderer().render('{{titok}}', withGetter)).toStrictEqual(missing('titok'));
    expect(getterCalls).toBe(0);
  });
});
