import { describe, expect, it } from 'vitest';
import { errorCodeOf } from './error-code-of.ts';

describe('errorCodeOf', () => {
  it('a szöveg code mezőt adja', () => {
    const error = Object.assign(new Error('x'), { code: 'ENOENT' });
    expect(errorCodeOf(error)).toBe('ENOENT');
  });

  it('code mező nélkül, nem szöveg code-dal és nem objektumra undefined', () => {
    expect(errorCodeOf(new Error('x'))).toBeUndefined();
    expect(errorCodeOf({ code: 2 })).toBeUndefined();
    expect(errorCodeOf('ENOENT')).toBeUndefined();
  });
});
