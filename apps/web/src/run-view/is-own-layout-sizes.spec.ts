import { describe, expect, it } from 'vitest';
import { isOwnLayoutSizes } from './is-own-layout-sizes.ts';

describe('isOwnLayoutSizes', () => {
  it('az alapértelmezéssel egyező pár nem saját arány (a korábban minden csatoláskor beírt érték)', () => {
    expect(isOwnLayoutSizes([70, 30], [70, 30])).toBe(false);
  });

  it('az alapértelmezéstől eltérő pár saját arány', () => {
    expect(isOwnLayoutSizes([60, 40], [70, 30])).toBe(true);
    expect(isOwnLayoutSizes([70, 30.5], [70, 30])).toBe(true);
  });
});
