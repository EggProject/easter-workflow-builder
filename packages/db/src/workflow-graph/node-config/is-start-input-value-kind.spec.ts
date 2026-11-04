import { describe, expect, it } from 'vitest';
import { isStartInputValueKind } from './is-start-input-value-kind.ts';
import type { StartInputValueKind } from './start-input-value-kind.ts';

// A SPEC-016 5.1 táblázatának mind a hat értéke. A `StartInputValueKind[]`
// annotáció fordítási idejű állítás is: ha az unió bővül vagy szűkül, ez a
// lista nem maradhat érintetlenül.
const allValueKinds: readonly StartInputValueKind[] = ['text', 'number', 'boolean', 'choice', 'list', 'json'];

describe('isStartInputValueKind', () => {
  it('a hat érték mindegyikére igazat ad', () => {
    expect(allValueKinds.every((valueKind) => isStartInputValueKind(valueKind))).toBe(true);
    expect(allValueKinds).toHaveLength(6);
  });

  it('hamisat ad ismeretlen szövegre, a régi szabad szöveges értékre is', () => {
    expect(isStartInputValueKind('string')).toBe(false);
    expect(isStartInputValueKind('')).toBe(false);
    expect(isStartInputValueKind('Text')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isStartInputValueKind('toString')).toBe(false);
    expect(isStartInputValueKind('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isStartInputValueKind(undefined)).toBe(false);
    expect(isStartInputValueKind(7)).toBe(false);
    expect(isStartInputValueKind({ valueKind: 'text' })).toBe(false);
    expect(isStartInputValueKind(['text'])).toBe(false);
  });
});
