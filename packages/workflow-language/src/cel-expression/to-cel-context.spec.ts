import { describe, expect, it } from 'vitest';
import { toCelContext } from './to-cel-context.ts';

// A `unicorn/no-null` miatt a JSON `null` értéket elemzés adja.
const jsonNull: unknown = JSON.parse('null');

describe('toCelContext (SPEC-010 7.3)', () => {
  it('a felső szintű undefined mező null, mind a hét névre', () => {
    expect(toCelContext({})).toStrictEqual({
      input: jsonNull,
      steps: jsonNull,
      item: jsonNull,
      itemIndex: jsonNull,
      iteration: jsonNull,
      joinInputs: jsonNull,
      error: jsonNull,
    });
  });

  it('a nem objektum kontextus minden neve null', () => {
    for (const context of [undefined, jsonNull, 'szöveg', 7, ['input']]) {
      expect(Object.values(toCelContext(context))).toStrictEqual(Array.from({ length: 7 }, () => jsonNull));
    }
  });

  it('az itemIndex és az iteration egész értéke BigInt', () => {
    const celContext = toCelContext({ itemIndex: 0, iteration: 2 });
    expect(celContext['itemIndex']).toBe(0n);
    expect(celContext['iteration']).toBe(2n);
  });

  it('a nem egész számláló és a más nevű egész változatlan', () => {
    const celContext = toCelContext({ itemIndex: 1.5, iteration: '2', input: 3 });
    expect(celContext['itemIndex']).toBe(1.5);
    expect(celContext['iteration']).toBe('2');
    expect(celContext['input']).toBe(3);
  });

  it('minden más érték változatlan, ugyanaz a referencia, és a bemenet nem módosul', () => {
    const input = { darab: 3, elemek: [1] };
    const steps = { 'node-1': { kesz: true } };
    const item = { nev: 'e1' };
    const joinInputs = ['a'];
    const error = { kind: 'timeout', message: 'lejárt' };
    const context = { input, steps, item, itemIndex: 0, iteration: undefined, joinInputs, error, extra: 1 };
    const celContext = toCelContext(context);
    expect(celContext['input']).toBe(input);
    expect(celContext['steps']).toBe(steps);
    expect(celContext['item']).toBe(item);
    expect(celContext['joinInputs']).toBe(joinInputs);
    expect(celContext['error']).toBe(error);
    expect(Object.keys(celContext)).toStrictEqual([
      'input',
      'steps',
      'item',
      'itemIndex',
      'iteration',
      'joinInputs',
      'error',
    ]);
    expect(context.itemIndex).toBe(0);
    expect(context.iteration).toBeUndefined();
  });
});
