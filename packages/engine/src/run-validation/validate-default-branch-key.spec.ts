/* eslint-disable unicorn/no-null -- a `defaultBranchKey` tárolt alakja `string | null`, ahol a `null` a "nincs alapértelmezett ág" állapot (SPEC-003 4.3), nem helyőrző `undefined` */
import { describe, expect, it } from 'vitest';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateDefaultBranchKey } from './validate-default-branch-key.ts';

function branchConfig(defaultBranchKey: string | null): ExecutableNodeConfig {
  return {
    type: 'branch',
    expression: 'ertek',
    branches: [
      { key: 'bal', label: 'Bal' },
      { key: 'jobb', label: 'Jobb' },
    ],
    defaultBranchKey,
    onUnhandledError: 'fail_run',
  };
}

const START: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

describe('validateDefaultBranchKey', () => {
  it('a branches listában szereplő alapértelmezésre zöld', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['b', branchConfig('jobb')],
    ]);

    expect(validateDefaultBranchKey(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('a null alapértelmezés megengedett', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['b', branchConfig(null)],
    ]);

    expect(validateDefaultBranchKey(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('nem branch node-okat átugorja', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', START],
    ]);

    expect(validateDefaultBranchKey(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('ismeretlen alapértelmezésre branch_key_unknown hibát ad', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['b', branchConfig('kozepe')],
    ]);

    expect(validateDefaultBranchKey(configsById)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) b branch node defaultBranchKey értékét (kozepe) a branches lista nem tartalmazza (branch_key_unknown).',
    });
  });
});
