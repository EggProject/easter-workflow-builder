/* eslint-disable unicorn/no-null -- a node config nullázható mezői a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateJoinMergeSettings } from './validate-join-merge-settings.ts';

function joinMerge(settings: Readonly<Record<string, unknown>>): ExecutableNodeConfig {
  return { type: 'join', mode: 'merge', settings, onUnhandledError: 'fail_run' };
}

const START: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const JOIN_AI_SYNTHESIS: ExecutableNodeConfig = {
  type: 'join',
  mode: 'ai_synthesis',
  settings: {
    promptTemplate: 'osszegzes',
    providerId: null,
    modelId: null,
    effort: null,
    thinking: null,
    allowedTools: [],
    disallowedTools: [],
    permissionMode: null,
    maxTurns: null,
    maxBudgetUsd: null,
    systemPrompt: null,
    agents: {},
    skills: null,
    mcpServers: {},
    enabledEngineHooks: [],
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    agentTools: [],
    sessionMode: 'isolated',
    structuredOutput: null,
  },
  onUnhandledError: 'fail_run',
};

describe('validateJoinMergeSettings', () => {
  it('üres settings rekordra zöld', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['j', joinMerge({})],
    ]);

    expect(validateJoinMergeSettings(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('nem join node-okat átugorja', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', START],
    ]);

    expect(validateJoinMergeSettings(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('az ai_synthesis módú join settings rekordjára nem vonatkozik', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['j', JOIN_AI_SYNTHESIS],
    ]);

    expect(validateJoinMergeSettings(configsById)).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('ismeretlen kulcsokra unsupported_join_merge_setting hibát ad, a kulcsokat megnevezve', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['j', joinMerge({ strategy: 'concat', separator: '\n' })],
    ]);

    expect(validateJoinMergeSettings(configsById)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) j join node merge módja ismeretlen beállítási kulcsot hordoz: strategy, separator (unsupported_join_merge_setting).',
    });
  });
});
