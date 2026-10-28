/* eslint-disable unicorn/no-null -- az `AgentStepConfig` elhagyható mezői a tárolt JSON-ban `null` értékkel jelzik a hiányt (SPEC-003 4.4) */
import type { Options, SdkPluginConfig } from '@anthropic-ai/claude-agent-sdk';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { buildAgentStepOptions } from '@easter-workflow-builder/engine';
import { describe, expect, it } from 'vitest';
import { buildAgentQueryRunner } from './build-agent-query-runner.ts';

describe('buildAgentQueryRunner', () => {
  it('AgentQueryRunner alakú objektumot ad, valós SDK hívás nélkül (a query csak run()-on hívódna)', () => {
    const runner = buildAgentQueryRunner();
    expect(typeof runner.run).toBe('function');
  });
});

/**
 * A motor kimenő `thinking` mezője a pinelt SDK `Options['thinking']` típusának (`ThinkingConfig`)
 * felel meg (SPEC-013 5.3, AC13). A motor az SDK-tól nem függ, a két típus csak itt látszik együtt;
 * a hozzárendelés a `typecheck` kapun bukik, ha a motor újra szöveget adna (a korábbi hiba: a
 * `'adaptive'` szöveg `.type` mezője `undefined`, az SDK egyik ágba sem lépett).
 */
describe('a motor thinking mezője az SDK ThinkingConfig alakja', () => {
  const config: AgentStepConfig = {
    promptTemplate: 'prompt',
    providerId: null,
    modelId: 'modell',
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
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
  };

  it.each(['adaptive', 'disabled'] as const)('a(z) %s mód SDK objektumként megy ki', (mode) => {
    const options = buildAgentStepOptions({
      config,
      decisions: {
        model: { outgoingModel: 'modell', modelIdentifierUnproven: false },
        structuredOutput: undefined,
        thinking: mode,
        effort: undefined,
        disallowedServerTools: { disallowedTools: [], serverToolAvailabilityUnproven: false },
        includePartialMessages: false,
      },
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: { mode: 'isolated' },
      skillLibrary: { rootDirectory: '/skillek', pluginName: 'skillek', skillNames: [] },
    });

    const sdkThinking: Options['thinking'] = options.thinking;
    expect(sdkThinking).toStrictEqual({ type: mode });
  });
});

/**
 * A motor kimenő `plugins` és `skills` mezőjének elemei a pinelt SDK típusainak felelnek meg
 * (SPEC-009 5.1, 5.3): a `plugins` eleme `SdkPluginConfig`, a `skills` eleme az `Options['skills']`
 * lista ágának eleme. A motor listái `readonly` tömbök, ezért az elemek hozzárendelése a típusszintű
 * ellenőrzés; a `typecheck` kapun bukik, ha a motor alakja eltér.
 */
describe('a motor skill mezői az SDK Options alakjai', () => {
  it('a plugins eleme SdkPluginConfig, a skills eleme szöveg', () => {
    const options = buildAgentStepOptions({
      config: {
        promptTemplate: 'prompt',
        providerId: null,
        modelId: 'modell',
        effort: null,
        thinking: null,
        allowedTools: [],
        disallowedTools: [],
        permissionMode: null,
        maxTurns: null,
        maxBudgetUsd: null,
        systemPrompt: null,
        agents: {},
        skills: ['alfa'],
        mcpServers: {},
        cwd: null,
        additionalDirectories: [],
        sandbox: null,
        sessionMode: 'isolated',
        structuredOutput: null,
      },
      decisions: {
        model: { outgoingModel: 'modell', modelIdentifierUnproven: false },
        structuredOutput: undefined,
        thinking: undefined,
        effort: undefined,
        disallowedServerTools: { disallowedTools: [], serverToolAvailabilityUnproven: false },
        includePartialMessages: false,
      },
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: { mode: 'isolated' },
      skillLibrary: { rootDirectory: '/skillek', pluginName: 'skillek', skillNames: ['alfa'] },
    });

    const plugin: SdkPluginConfig | undefined = options.plugins?.[0];
    const skill: Extract<Options['skills'], readonly string[]>[number] | undefined = options.skills?.[0];
    expect([plugin, skill]).toStrictEqual([{ type: 'local', path: '/skillek' }, 'skillek:alfa']);
  });
});

/**
 * Az izolációs mezők (SPEC-009 7.1, O-20 (a), AC22) a pinelt SDK `Options` típusának felelnek meg: a
 * `settingSources` üres listája `SettingSource[]`, a `strictMcpConfig` `boolean`.
 */
describe('a motor izolációs mezői az SDK Options alakjai', () => {
  it('a settingSources üres lista, a strictMcpConfig true', () => {
    const options = buildAgentStepOptions({
      config: {
        promptTemplate: 'prompt',
        providerId: null,
        modelId: 'modell',
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
        cwd: null,
        additionalDirectories: [],
        sandbox: null,
        sessionMode: 'isolated',
        structuredOutput: null,
      },
      decisions: {
        model: { outgoingModel: 'modell', modelIdentifierUnproven: false },
        structuredOutput: undefined,
        thinking: undefined,
        effort: undefined,
        disallowedServerTools: { disallowedTools: [], serverToolAvailabilityUnproven: false },
        includePartialMessages: false,
      },
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: { mode: 'isolated' },
      skillLibrary: { rootDirectory: '/skillek', pluginName: 'skillek', skillNames: [] },
    });

    const settingSources: Options['settingSources'] = [...options.settingSources];
    const strictMcpConfig: Options['strictMcpConfig'] = options.strictMcpConfig;
    expect([settingSources, strictMcpConfig]).toStrictEqual([[], true]);
  });
});
