import { describe, expect, it } from 'vitest';
import { httpStatusForErrorCode } from './http-status-for-error-code.ts';

describe('httpStatusForErrorCode', () => {
  it('a SPEC-005 8.2 táblázatának öt leképezését adja (37. kritérium)', () => {
    expect(httpStatusForErrorCode('invalid_request')).toBe(400);
    expect(httpStatusForErrorCode('not_found')).toBe(404);
    expect(httpStatusForErrorCode('conflict')).toBe(409);
    expect(httpStatusForErrorCode('unprocessable')).toBe(422);
    expect(httpStatusForErrorCode('internal')).toBe(500);
  });
});
