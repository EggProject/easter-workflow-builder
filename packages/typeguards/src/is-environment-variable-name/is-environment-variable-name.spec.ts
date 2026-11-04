import { describe, expect, expectTypeOf, it } from 'vitest';
import { isEnvironmentVariableName } from './is-environment-variable-name.ts';

describe('isEnvironmentVariableName', () => {
  it.each(['GITHUB_TOKEN', '_', 'a1', 'github_token_ceg', '__proto__'])('igazat ad a POSIX név alakra: %s', (name) => {
    expect(isEnvironmentVariableName(name)).toBe(true);
  });

  it.each(['', '1ROSSZ', 'A-B', 'A B', 'ÉKEZET', 'ghp-titok'])(
    'hamisat ad a név alakon kívüli szövegre: %j',
    (name) => {
      expect(isEnvironmentVariableName(name)).toBe(false);
    },
  );

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isEnvironmentVariableName(1)).toBe(false);
    expect(isEnvironmentVariableName(undefined)).toBe(false);
  });

  it('szövegre szűkít', () => {
    const value: unknown = 'A';
    if (isEnvironmentVariableName(value)) {
      expectTypeOf(value).toEqualTypeOf<string>();
    }
  });
});
