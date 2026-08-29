import { describe, expect, it } from 'vitest';
import { httpStatusForErrorCode } from './http-status-for-error-code.ts';

describe('httpStatusForErrorCode', () => {
  it.each([
    ['invalid_request', 400],
    ['not_found', 404],
    ['conflict', 409],
    ['unprocessable', 422],
    ['internal', 500],
  ] as const)(
    'a(z) "%s" kódhoz a(z) %i HTTP státuszt rendeli, a SPEC-005 8.2 táblázata szerint (37. kritérium, külön előidéző teszteset)',
    (code, status) => {
      expect(httpStatusForErrorCode(code)).toBe(status);
    },
  );
});
