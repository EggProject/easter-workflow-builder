import { describe, expect, it } from 'vitest';
import { isWithinRoot } from './is-within-root.ts';

describe('isWithinRoot', () => {
  it('a gyökér alatti útvonal benne van', () => {
    expect(isWithinRoot('/a/b', '/a/b/c.txt', false)).toBe(true);
    expect(isWithinRoot('/a/b', '/a/b/c/d', false)).toBe(true);
  });

  it('a közös előtagú testvér könyvtár nincs benne', () => {
    expect(isWithinRoot('/a/b', '/a/bc/d', true)).toBe(false);
    expect(isWithinRoot('/a/b', '/a', true)).toBe(false);
  });

  it('a gyökér maga csak isRootAllowed mellett elfogadott', () => {
    expect(isWithinRoot('/a/b', '/a/b', true)).toBe(true);
    expect(isWithinRoot('/a/b', '/a/b', false)).toBe(false);
  });

  it('az elválasztóra végződő gyökér (/) alatt minden abszolút útvonal benne van', () => {
    expect(isWithinRoot('/', '/etc/passwd', false)).toBe(true);
    expect(isWithinRoot('/', '/', false)).toBe(false);
  });
});
