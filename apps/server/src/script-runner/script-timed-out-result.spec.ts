import { describe, expect, it } from 'vitest';
import { scriptTimedOutResult } from './script-timed-out-result.ts';

describe('scriptTimedOutResult', () => {
  it('script_timed_out a határidő ezredmásodpercével', () => {
    expect(scriptTimedOutResult(50)).toStrictEqual({
      kind: 'failed',
      errorKind: 'script_timed_out',
      message: 'a szkript nem fejeződött be 50 ms alatt',
    });
  });
});
