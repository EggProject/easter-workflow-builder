/* eslint-disable unicorn/no-null -- a `defaultBranchKey` tárolt alakja `string | null` (SPEC-003 4.3), nem helyőrző `undefined` */
import { describe, expect, it } from 'vitest';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';
import { validateReservedBranchKeys } from './validate-reserved-branch-keys.ts';

function branchConfig(keys: readonly string[]): WellFormedNodeConfig {
  return {
    type: 'branch',
    expression: 'ertek',
    branches: keys.map((key) => ({ key, label: key })),
    defaultBranchKey: null,
    onUnhandledError: 'fail_run',
  };
}

const START: WellFormedNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

describe('validateReservedBranchKeys', () => {
  it('saját nevű ágakra zöld', () => {
    const configsById: ReadonlyMap<string, WellFormedNodeConfig> = new Map<string, WellFormedNodeConfig>([
      ['b', branchConfig(['bal', 'jobb'])],
    ]);

    expect(validateReservedBranchKeys(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('nem branch node-okat átugorja', () => {
    const configsById: ReadonlyMap<string, WellFormedNodeConfig> = new Map<string, WellFormedNodeConfig>([
      ['start', START],
    ]);

    expect(validateReservedBranchKeys(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it.each(['continue', 'exit', 'approved', 'rejected', 'exhausted', 'on_error'])(
    'a %s fenntartott kulcsra reserved_branch_key_misuse hibát ad',
    (reservedKey) => {
      const configsById: ReadonlyMap<string, WellFormedNodeConfig> = new Map<string, WellFormedNodeConfig>([
        ['b', branchConfig(['bal', reservedKey])],
      ]);

      expect(validateReservedBranchKeys(configsById)).toStrictEqual({
        kind: 'error',
        message: `A(z) b branch node ${reservedKey} kulcsa fenntartott branch_key érték (reserved_branch_key_misuse).`,
      });
    },
  );
});
