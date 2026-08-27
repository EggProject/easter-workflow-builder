/* eslint-disable unicorn/no-null -- a pillanatkép dokumentum parsolt JSON-ból jön, ahol a `null` valódi adat (`description`, `sourceHandle`, ...); az `undefined` nem éli túl a JSON oszlopot */
import { describe, expect, it } from 'vitest';
import { canonicalizeSnapshotDocument } from './canonicalize-snapshot-document.ts';
import { computeSnapshotHash } from './compute-snapshot-hash.ts';

function canonicalText(value: unknown): string {
  const outcome = canonicalizeSnapshotDocument(value);
  if (outcome.kind !== 'ok') {
    throw new Error(`a kanonizálásnak sikerülnie kellene: ${outcome.message}`);
  }
  return outcome.value;
}

function errorMessage(value: unknown): string {
  const outcome = canonicalizeSnapshotDocument(value);
  if (outcome.kind !== 'error') {
    throw new Error('a kanonizálásnak hibaágat kellene adnia');
  }
  return outcome.message;
}

/**
 * A SPEC-003 5.6 táblázatának első hét, adatbázis tábla nélkül is futtatható
 * tesztje (47. és 49. elfogadási kritérium). A nyolcadik sor (a beszúrt sorokra
 * vonatkozó `sha256(document) = hash` egyezés) a `workflow_run` beszúrási utat
 * igényli, ezért nem itt áll.
 */
describe('canonicalizeSnapshotDocument', () => {
  it('azonos kanonikus szöveget és lenyomatot ad kétféle kulcs-beszúrási sorrendre', () => {
    const first = { version: 1, sdkVersionPin: '0.3.245', workflow: { id: 'w1', name: 'A' } };
    const second = { workflow: { name: 'A', id: 'w1' }, sdkVersionPin: '0.3.245', version: 1 };

    expect(canonicalText(first)).toBe(canonicalText(second));
    expect(computeSnapshotHash(canonicalText(first))).toBe(computeSnapshotHash(canonicalText(second)));
  });

  it('ugyanerre a két objektumra a JSON.stringify kimenete eltér', () => {
    // A teszt nem üres: a `JSON.stringify` nem determinizmusa (F-26) valóban
    // létezik, tehát a kanonizálás nem felesleges réteg.
    const first = { version: 1, sdkVersionPin: '0.3.245', workflow: { id: 'w1', name: 'A' } };
    const second = { workflow: { name: 'A', id: 'w1' }, sdkVersionPin: '0.3.245', version: 1 };

    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second));
  });

  it('az egész indexű kulcsokat is UTF-16 sorrendben írja ki', () => {
    // A `JSON.stringify` ugyanerre `{"9":2,"10":1,"a":3}` alakot ad (F-26).
    expect(canonicalText({ '10': 1, '9': 2, a: 3 })).toBe('{"10":1,"9":2,"a":3}');
    expect(JSON.stringify({ '10': 1, '9': 2, a: 3 })).toBe('{"9":2,"10":1,"a":3}');
  });

  it('a kulcsrendezés az alapértelmezett sort UTF-16 sorrendjét adja', () => {
    // A SPEC-003 2. szekciójában rögzített, futtatott ellenőrzés sorrendje:
    // `['b','a','€','A','aa']` rendezve `['A','a','aa','b','€']`.
    expect(canonicalText({ b: 1, a: 2, '€': 3, A: 4, aa: 5 })).toBe('{"A":4,"a":2,"aa":5,"b":1,"€":3}');
  });

  it('rekurzívan rendez: a beágyazott és a tömbben álló objektum kulcsai sem számítanak', () => {
    const first = { config: { b: 1, a: 2 }, nodes: [{ y: 4, x: 3 }] };
    const second = { nodes: [{ x: 3, y: 4 }], config: { a: 2, b: 1 } };

    expect(canonicalText(first)).toBe('{"config":{"a":2,"b":1},"nodes":[{"x":3,"y":4}]}');
    expect(canonicalText(second)).toBe(canonicalText(first));
  });

  it('a tömb elemsorrend tartalom: megfordítása megváltoztatja a lenyomatot', () => {
    const forward = computeSnapshotHash(canonicalText({ nodes: ['a', 'b'] }));
    const reversed = computeSnapshotHash(canonicalText({ nodes: ['b', 'a'] }));

    expect(forward).not.toBe(reversed);
  });

  it('whitespace nélkül, a primitíveket a JSON.stringify alakjában adja ki', () => {
    expect(canonicalText({ n: null, t: true, f: false, s: 'á"\n', z: -0, e: 1e30 })).toBe(
      String.raw`{"e":1e+30,"f":false,"n":null,"s":"á\"\n","t":true,"z":0}`,
    );
    expect(canonicalText([])).toBe('[]');
    expect(canonicalText({})).toBe('{}');
    expect(canonicalText(null)).toBe('null');
    expect(canonicalText('szöveg')).toBe('"szöveg"');
  });

  it('a null prototípusú objektumot sima objektumnak veszi', () => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- az `Object.create` deklarált visszatérési típusa `any`, az annotáció szűkíti
    const bare: Record<string, unknown> = Object.create(null);
    bare['b'] = 1;
    bare['a'] = 2;

    expect(canonicalText(bare)).toBe('{"a":2,"b":1}');
  });

  it('átengedi a körmentes, többször hivatkozott részfát', () => {
    const shared = { a: 1 };

    expect(canonicalText({ left: shared, right: shared })).toBe('{"left":{"a":1},"right":{"a":1}}');
  });
});

describe('canonicalizeSnapshotDocument, non_canonicalizable_value hibaágak', () => {
  it('nem véges számra hibázik', () => {
    expect(errorMessage(NaN)).toContain('non_canonicalizable_value');
    expect(errorMessage(Infinity)).toContain('nem véges szám');
    expect(errorMessage({ a: -Infinity })).toContain('non_canonicalizable_value');
  });

  it('párosítatlan surrogate stringre hibázik', () => {
    expect(errorMessage('\u{D800}')).toContain('párosítatlan surrogate');
    expect(errorMessage(['\u{D800}'])).toContain('non_canonicalizable_value');
  });

  it('undefined mezőértékre, bigintre, symbolra és függvényre hibázik', () => {
    expect(errorMessage({ a: undefined })).toContain('undefined');
    expect(errorMessage(undefined)).toContain('non_canonicalizable_value');
    expect(errorMessage(1n)).toContain('bigint');
    expect(errorMessage(Symbol('s'))).toContain('symbol');
    expect(errorMessage(() => 1)).toContain('function');
  });

  it('nem sima objektumra hibázik', () => {
    class SnapshotLike {
      readonly id = 'n1';
    }

    expect(errorMessage(new Date(0))).toContain('nem sima objektum');
    expect(errorMessage(new Map())).toContain('non_canonicalizable_value');
    expect(errorMessage(new Set())).toContain('non_canonicalizable_value');
    expect(errorMessage(new SnapshotLike())).toContain('non_canonicalizable_value');
    // eslint-disable-next-line unicorn/new-for-builtins, sonarjs/no-primitive-wrappers -- a becsomagolt primitív pontosan az az eset, amit a szűrőnek el kell utasítania
    expect(errorMessage(new String('a'))).toContain('non_canonicalizable_value');
  });

  it('körkörös hivatkozásra hibázik', () => {
    const cyclic: Record<string, unknown> = { name: 'gyökér' };
    cyclic['self'] = cyclic;

    expect(errorMessage(cyclic)).toContain('körkörös hivatkozás');

    const cyclicArray: unknown[] = [];
    cyclicArray.push(cyclicArray);

    expect(errorMessage(cyclicArray)).toContain('körkörös hivatkozás');
  });
});
