/* eslint-disable unicorn/no-null -- az `AgentStepConfig` elhagyható mezői a tárolt JSON-ban `null` értékkel jelzik a hiányt (SPEC-003 4.4), nem helyőrző `undefined`-del */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import { buildAgentStepOptions } from './build-agent-step-options.ts';
import type { SessionBinding } from './session-binding.ts';

function agentStepConfig(overrides: Partial<AgentStepConfig> = {}): AgentStepConfig {
  return {
    promptTemplate: 'prompt',
    providerId: null,
    modelId: 'modell-1',
    effort: null,
    thinking: null,
    allowedTools: ['Read'],
    disallowedTools: ['Bash'],
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
    ...overrides,
  };
}

function decisions(overrides: Partial<AgentStepCapabilityDecisions> = {}): AgentStepCapabilityDecisions {
  return {
    model: { outgoingModel: 'modell-1-kliens', modelIdentifierUnproven: false },
    structuredOutput: undefined,
    thinking: undefined,
    effort: undefined,
    disallowedServerTools: { disallowedTools: [], serverToolAvailabilityUnproven: false },
    includePartialMessages: true,
    ...overrides,
  };
}

const isolated: SessionBinding = { mode: 'isolated' };

describe('buildAgentStepOptions', () => {
  it('a minimális lépés csak a kötelező mezőket küldi ki, persistSession: true értékkel', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions(),
      environmentBlock: { PROVIDER_BASE_URL: 'https://pelda' },
      sessionBinding: isolated,
    });

    expect(options).toStrictEqual({
      model: 'modell-1-kliens',
      allowedTools: ['Read'],
      disallowedTools: ['Bash'],
      additionalDirectories: [],
      agents: {},
      env: { PROVIDER_BASE_URL: 'https://pelda' },
      includePartialMessages: true,
      persistSession: true,
    });
  });

  it('isolated módban nincs resume és nincs forkSession mező', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions(),
      environmentBlock: {},
      sessionBinding: isolated,
    });

    expect(Object.hasOwn(options, 'resume')).toBe(false);
    expect(Object.hasOwn(options, 'forkSession')).toBe(false);
  });

  it('continued módban a resume és a forkSession is kimegy', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({ sessionMode: 'continued' }),
      decisions: decisions(),
      environmentBlock: {},
      sessionBinding: { mode: 'continued', resume: 'session-1', forkSession: true },
    });

    expect(options.resume).toBe('session-1');
    expect(options.forkSession).toBe(true);
  });

  it('a lépés elhagyható mezői kimennek, ha a config beállítja őket', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({
        permissionMode: 'default',
        maxTurns: 5,
        maxBudgetUsd: 2,
        systemPrompt: 'rendszer',
        skills: 'all',
        cwd: '/munka',
        additionalDirectories: ['/adat'],
        agents: { elemzo: {} },
        sandbox: {
          enabled: true,
          failIfUnavailable: false,
          autoAllowBashIfSandboxed: true,
          excludedCommands: [],
          enableWeakerNestedSandbox: false,
        },
      }),
      decisions: decisions({ thinking: 'adaptive', effort: 'high' }),
      environmentBlock: {},
      sessionBinding: isolated,
    });

    expect(options.permissionMode).toBe('default');
    expect(options.maxTurns).toBe(5);
    expect(options.maxBudgetUsd).toBe(2);
    expect(options.systemPrompt).toBe('rendszer');
    expect(options.skills).toBe('all');
    expect(options.cwd).toBe('/munka');
    expect(options.additionalDirectories).toStrictEqual(['/adat']);
    expect(options.agents).toStrictEqual({ elemzo: {} });
    expect(options.sandbox?.enabled).toBe(true);
    expect(options.thinking).toBe('adaptive');
    expect(options.effort).toBe('high');
  });

  it('a leíró szerint nem működő szerver oldali tool kliens neve a lépés tiltólistája mellé kerül', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions({
        disallowedServerTools: { disallowedTools: ['KliensKereses'], serverToolAvailabilityUnproven: false },
      }),
      environmentBlock: {},
      sessionBinding: isolated,
    });

    expect(options.disallowedTools).toStrictEqual(['Bash', 'KliensKereses']);
  });

  it('sdk_output_format stratégiánál outputFormat megy ki, Stop hook nélkül', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({
        structuredOutput: { strategy: 'sdk_output_format', schema: { type: 'object' } },
        enabledEngineHooks: ['emit_output_tool_stop'],
      }),
      decisions: decisions(),
      environmentBlock: {},
      sessionBinding: isolated,
    });

    expect(options.outputFormat).toStrictEqual({ type: 'json_schema', schema: { type: 'object' } });
    expect(options.hooks).toBeUndefined();
  });

  it('emit_output_tool stratégiánál a bekapcsolt Stop hook megy ki, outputFormat nélkül', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({
        structuredOutput: { strategy: 'emit_output_tool', schema: {} },
        enabledEngineHooks: ['emit_output_tool_stop'],
      }),
      decisions: decisions(),
      environmentBlock: {},
      sessionBinding: isolated,
    });

    expect(options.outputFormat).toBeUndefined();
    expect(options.hooks?.Stop).toHaveLength(1);
  });

  it('emit_output_tool stratégia bekapcsolt hook nélkül egyik mezőt sem küldi ki', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({ structuredOutput: { strategy: 'emit_output_tool', schema: {} } }),
      decisions: decisions(),
      environmentBlock: {},
      sessionBinding: isolated,
    });

    expect(options.outputFormat).toBeUndefined();
    expect(options.hooks).toBeUndefined();
  });

  it('ugyanaz a lépés két eltérő leíró döntéssel eltérő Options objektumot ad', () => {
    const config = agentStepConfig();
    const elso = buildAgentStepOptions({
      config,
      decisions: decisions(),
      environmentBlock: { KULCS_NEVE: 'ertek-1' },
      sessionBinding: isolated,
    });
    const masodik = buildAgentStepOptions({
      config,
      decisions: decisions({
        model: { outgoingModel: 'modell-2', modelIdentifierUnproven: true },
        includePartialMessages: false,
        disallowedServerTools: { disallowedTools: ['KliensKereses'], serverToolAvailabilityUnproven: false },
      }),
      environmentBlock: { MASIK_KULCS: 'ertek-2' },
      sessionBinding: isolated,
    });

    expect(elso).not.toStrictEqual(masodik);
    expect(masodik.model).toBe('modell-2');
    expect(masodik.includePartialMessages).toBe(false);
    expect(masodik.disallowedTools).toStrictEqual(['Bash', 'KliensKereses']);
    expect(masodik.env).toStrictEqual({ MASIK_KULCS: 'ertek-2' });
  });
});
