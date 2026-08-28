/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői és a "nincs felülírás" provider szintek a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.4), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { resolveNodeProviders } from './resolve-node-providers.ts';

// A megosztott `AgentStepConfig` mezői, a lépés szintű `providerId` nélkül. Az
// `as const` const assertion, nem type assertion: a szűk literál típusokra
// (`sessionMode: 'isolated'`) van szükség, hogy a szórás mindkét helyen
// illeszkedjen (`.claude/CLAUDE.md` 5.).
const AGENT_SETTINGS = {
  promptTemplate: 'kerdes',
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
} as const;

function agentStep(providerId: ProviderId | null): ExecutableNodeConfig {
  return { type: 'agent_step', ...AGENT_SETTINGS, providerId, onUnhandledError: 'fail_run' };
}

function joinAiSynthesis(providerId: ProviderId | null): ExecutableNodeConfig {
  return {
    type: 'join',
    mode: 'ai_synthesis',
    settings: { ...AGENT_SETTINGS, providerId },
    onUnhandledError: 'fail_run',
  };
}

const START: ExecutableNodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };

describe('resolveNodeProviders', () => {
  it('a globális alapértelmezést minden node megkapja, az agent jellegűeket is beleértve', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', START],
      ['a', agentStep(null)],
      ['j', joinAiSynthesis(null)],
    ]);

    expect(resolveNodeProviders(configsById, 'minimax', null)).toStrictEqual({
      kind: 'ok',
      value: new Map([
        ['start', 'minimax'],
        ['a', 'minimax'],
        ['j', 'minimax'],
      ]),
    });
  });

  it('a workflow felülírás erősebb a globális alapértelmezésnél', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', START],
    ]);

    expect(resolveNodeProviders(configsById, 'minimax', 'claude-subscription')).toStrictEqual({
      kind: 'ok',
      value: new Map([['start', 'claude-subscription']]),
    });
  });

  it('az agent_step lépés felülírása a legerősebb', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['a', agentStep('claude-subscription')],
    ]);

    expect(resolveNodeProviders(configsById, 'minimax', 'minimax')).toStrictEqual({
      kind: 'ok',
      value: new Map([['a', 'claude-subscription']]),
    });
  });

  it('az ai_synthesis módú join settings alobjektumának providerId mezője is lépés szintű felülírás', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['j', joinAiSynthesis('claude-subscription')],
    ]);

    expect(resolveNodeProviders(configsById, 'minimax', null)).toStrictEqual({
      kind: 'ok',
      value: new Map([['j', 'claude-subscription']]),
    });
  });

  it('a merge módú join nem hordoz lépés szintű felülírást', () => {
    const merge: ExecutableNodeConfig = { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' };
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['j', merge],
    ]);

    expect(resolveNodeProviders(configsById, 'minimax', null)).toStrictEqual({
      kind: 'ok',
      value: new Map([['j', 'minimax']]),
    });
  });

  it('egyetlen szint nélkül no_default_provider hibát ad', () => {
    const configsById: ReadonlyMap<string, ExecutableNodeConfig> = new Map<string, ExecutableNodeConfig>([
      ['start', START],
    ]);

    expect(resolveNodeProviders(configsById, null, null)).toStrictEqual({
      kind: 'error',
      message: 'Nincs feloldható provider egyik szinten sem (no_default_provider).',
    });
  });
});
