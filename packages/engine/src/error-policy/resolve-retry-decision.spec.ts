import { describe, expect, it } from 'vitest';
import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/db';
import { resolveRetryDecision } from './resolve-retry-decision.ts';

function configOf(
  maxAttempts: number,
  backoffMs: readonly number[],
  handledErrorKinds: readonly string[] = [],
): ErrorHandlerNodeConfig {
  return { type: 'error_handler', maxAttempts, backoffMs, handledErrorKinds, onUnhandledError: 'fail_run' };
}

describe('resolveRetryDecision', () => {
  it('üres handledErrorKinds lista minden hibaosztályt kezel', () => {
    expect(
      resolveRetryDecision({
        config: configOf(3, [100, 200]),
        failedErrorKind: 'provider_call_failed',
        failedAttempt: 1,
      }),
    ).toStrictEqual({ kind: 'retry', backoffMs: 100, nextAttempt: 2 });
  });

  it('nem üres, illeszkedő lista esetén eljár', () => {
    expect(
      resolveRetryDecision({
        config: configOf(3, [100, 200], ['provider_call_failed', 'agent_result_not_success']),
        failedErrorKind: 'agent_result_not_success',
        failedAttempt: 2,
      }),
    ).toStrictEqual({ kind: 'retry', backoffMs: 200, nextAttempt: 3 });
  });

  it('nem üres, nem illeszkedő lista esetén unhandled_error_kind', () => {
    expect(
      resolveRetryDecision({
        config: configOf(3, [100, 200], ['provider_call_failed']),
        failedErrorKind: 'template_render_failed',
        failedAttempt: 1,
      }),
    ).toStrictEqual({ kind: 'unhandled_error_kind' });
  });

  it('attempt egyenlő maxAttempts esetén attempts_exhausted', () => {
    expect(
      resolveRetryDecision({
        config: configOf(2, [100]),
        failedErrorKind: 'provider_call_failed',
        failedAttempt: 2,
      }),
    ).toStrictEqual({ kind: 'attempts_exhausted' });
  });

  it('attempt nagyobb mint maxAttempts esetén is attempts_exhausted', () => {
    expect(
      resolveRetryDecision({
        config: configOf(2, [100]),
        failedErrorKind: 'provider_call_failed',
        failedAttempt: 5,
      }),
    ).toStrictEqual({ kind: 'attempts_exhausted' });
  });

  it('hiányzó backoff elemre missing_backoff, kitalált szám nélkül', () => {
    expect(
      resolveRetryDecision({
        config: configOf(4, []),
        failedErrorKind: 'provider_call_failed',
        failedAttempt: 1,
      }),
    ).toStrictEqual({ kind: 'missing_backoff' });
  });
});
