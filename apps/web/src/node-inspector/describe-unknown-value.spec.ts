import { describe, expect, it } from 'vitest';
import { describeUnknownValue } from './describe-unknown-value.ts';

describe('describeUnknownValue', () => {
  it('a hiányzó értéket "(nincs megadva)" szöveggel jelöli', () => {
    expect(describeUnknownValue(undefined)).toBe('(nincs megadva)');
  });

  it('egy sztringet változatlanul ad vissza', () => {
    expect(describeUnknownValue('szöveg')).toBe('szöveg');
  });

  it('egy tömböt JSON alakban mutat', () => {
    expect(describeUnknownValue(['a', 'b'])).toBe('["a","b"]');
  });

  it('egy objektumot JSON alakban mutat', () => {
    expect(describeUnknownValue({ a: 1 })).toBe('{"a":1}');
  });

  it('egy számot JSON alakban mutat', () => {
    expect(describeUnknownValue(5)).toBe('5');
  });
});
