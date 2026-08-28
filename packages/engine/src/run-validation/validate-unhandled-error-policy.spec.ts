/* eslint-disable unicorn/no-null -- az `onUnhandledError` tárolt alakja `UnhandledErrorPolicy | null`, ahol a `null` a "nincs beállítva" állapot (SPEC-003 4.3, SPEC-004 8.3), nem helyőrző `undefined` */
import { describe, expect, it } from 'vitest';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateUnhandledErrorPolicy } from './validate-unhandled-error-policy.ts';

const FAIL_RUN: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const FAIL_BRANCH: ExecutableNodeConfig = {
  type: 'join',
  mode: 'merge',
  settings: {},
  onUnhandledError: 'fail_branch',
};
const MISSING: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: null };

describe('validateUnhandledErrorPolicy', () => {
  it('mindkét beállított politikára zöld', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', FAIL_RUN],
      ['j', FAIL_BRANCH],
    ]);

    expect(validateUnhandledErrorPolicy(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('hiányzó politikára unhandled_error_policy_missing hibát ad', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', MISSING],
    ]);

    expect(validateUnhandledErrorPolicy(configsById)).toStrictEqual({
      kind: 'error',
      message: 'A(z) start node configjában nincs onUnhandledError érték beállítva (unhandled_error_policy_missing).',
    });
  });
});
