import { describe, expect, it } from 'vitest';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateErrorHandlerBackoff } from './validate-error-handler-backoff.ts';

const START: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

// A `maxAttempts`/`backoffMs` párt közvetlenül veszi át, hogy a tesztek
// hívásai ne lépjék át az `unicorn/max-nested-calls` hármas mélységét.
function mapOf(maxAttempts: number, backoffMs: readonly number[]): ReadonlyMap<string, ExecutableNodeConfig> {
  return new Map<string, ExecutableNodeConfig>([
    ['eh', { type: 'error_handler', maxAttempts, backoffMs, handledErrorKinds: [], onUnhandledError: 'fail_run' }],
  ]);
}

describe('validateErrorHandlerBackoff', () => {
  it('pontosan maxAttempts - 1 elemre zöld', () => {
    expect(validateErrorHandlerBackoff(mapOf(3, [100, 200]))).toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
  });

  it('hosszabb listára is zöld, mert a küszöb alsó korlát', () => {
    expect(validateErrorHandlerBackoff(mapOf(2, [100, 200, 300]))).toStrictEqual({
      kind: 'ok',
      value: undefined,
    });
  });

  it('egyetlen kísérletnél az üres lista is elég', () => {
    expect(validateErrorHandlerBackoff(mapOf(1, []))).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('nem error_handler node-okat átugorja', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', START],
    ]);

    expect(validateErrorHandlerBackoff(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('rövid listára insufficient_backoff_list hibát ad, a két számot megnevezve', () => {
    expect(validateErrorHandlerBackoff(mapOf(4, [100]))).toStrictEqual({
      kind: 'error',
      message:
        'A(z) eh error_handler node backoffMs listája 1 elemű, de a maxAttempts (4) legalább 3 elemet igényel (insufficient_backoff_list).',
    });
  });
});
