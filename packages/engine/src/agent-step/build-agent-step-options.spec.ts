/* eslint-disable unicorn/no-null -- az `AgentStepConfig` elhagyható mezői a tárolt JSON-ban `null` értékkel jelzik a hiányt (SPEC-003 4.4), nem helyőrző `undefined`-del */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import { buildAgentStepOptions } from './build-agent-step-options.ts';
import type { SessionBinding } from './session-binding.ts';
import type { SkillLibrarySnapshot } from '../engine-port/skill-library-snapshot.ts';

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
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
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

const LIBRARY: SkillLibrarySnapshot = {
  rootDirectory: '/var/skillek',
  pluginName: 'skillek',
  skillNames: ['alfa', 'beta'],
};

function optionsFor(skills: AgentStepConfig['skills']): ReturnType<typeof buildAgentStepOptions> {
  return buildAgentStepOptions({
    config: agentStepConfig({ skills }),
    decisions: decisions(),
    environmentBlock: {},
    mcpServers: {},
    sessionBinding: isolated,
    skillLibrary: LIBRARY,
  });
}

describe('buildAgentStepOptions', () => {
  it('a minimális lépés csak a kötelező mezőket küldi ki, persistSession: true értékkel és az izolációs mezőkkel (SPEC-009 O-20, AC22)', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions(),
      environmentBlock: { PROVIDER_BASE_URL: 'https://pelda' },
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
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
      settingSources: [],
      strictMcpConfig: true,
    });
  });

  it('isolated módban nincs resume és nincs forkSession mező', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions(),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(Object.hasOwn(options, 'resume')).toBe(false);
    expect(Object.hasOwn(options, 'forkSession')).toBe(false);
  });

  it('continued módban a resume és a forkSession is kimegy', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({ sessionMode: 'continued' }),
      decisions: decisions(),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: { mode: 'continued', resume: 'session-1', forkSession: true },
      skillLibrary: LIBRARY,
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
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(options.permissionMode).toBe('default');
    expect(options.maxTurns).toBe(5);
    expect(options.maxBudgetUsd).toBe(2);
    expect(options.systemPrompt).toBe('rendszer');
    expect(options.skills).toStrictEqual(['skillek:alfa', 'skillek:beta']);
    expect(options.plugins).toStrictEqual([{ type: 'local', path: '/var/skillek' }]);
    expect(options.cwd).toBe('/munka');
    expect(options.additionalDirectories).toStrictEqual(['/adat']);
    expect(options.agents).toStrictEqual({ elemzo: {} });
    expect(options.sandbox?.enabled).toBe(true);
    expect(options.thinking).toStrictEqual({ type: 'adaptive' });
    expect(options.effort).toBe('high');
  });

  // SPEC-013 5. (O-5): az SDK a `thinking` opciót objektumként olvassa (`ThinkingConfig`,
  // `sdk.mjs` `switch(thinking.type)`); a korábbi szöveg érték a CLI-ig nem jutott el.
  it('a disabled thinking az SDK objektum alakjában megy ki', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions({ thinking: 'disabled' }),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(options.thinking).toStrictEqual({ type: 'disabled' });
  });

  it('az always_on módnak nincs SDK alakja: a thinking mező elmarad', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions({ thinking: 'always_on' }),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(Object.hasOwn(options, 'thinking')).toBe(false);
  });

  it('a leíró szerint nem működő szerver oldali tool kliens neve a lépés tiltólistája mellé kerül', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig(),
      decisions: decisions({
        disallowedServerTools: { disallowedTools: ['KliensKereses'], serverToolAvailabilityUnproven: false },
      }),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(options.disallowedTools).toStrictEqual(['Bash', 'KliensKereses']);
  });

  it('sdk_output_format stratégiánál outputFormat megy ki, hooks mező nélkül', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({
        structuredOutput: { strategy: 'sdk_output_format', schema: { type: 'object' } },
      }),
      decisions: decisions(),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(options.outputFormat).toStrictEqual({ type: 'json_schema', schema: { type: 'object' } });
    expect(Object.hasOwn(options, 'hooks')).toBe(false);
  });

  it('ugyanaz a lépés két eltérő leíró döntéssel eltérő Options objektumot ad', () => {
    const config = agentStepConfig();
    const elso = buildAgentStepOptions({
      config,
      decisions: decisions(),
      environmentBlock: { KULCS_NEVE: 'ertek-1' },
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });
    const masodik = buildAgentStepOptions({
      config,
      decisions: decisions({
        model: { outgoingModel: 'modell-2', modelIdentifierUnproven: true },
        includePartialMessages: false,
        disallowedServerTools: { disallowedTools: ['KliensKereses'], serverToolAvailabilityUnproven: false },
      }),
      environmentBlock: { MASIK_KULCS: 'ertek-2' },
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(elso).not.toStrictEqual(masodik);
    expect(masodik.model).toBe('modell-2');
    expect(masodik.includePartialMessages).toBe(false);
    expect(masodik.disallowedTools).toStrictEqual(['Bash', 'KliensKereses']);
    expect(masodik.env).toStrictEqual({ MASIK_KULCS: 'ertek-2' });
  });
  // SPEC-009 5.1, 5.3, AC13 (M-136, research `2026-10-28-spec-009-blokkolo-meresek.md` 2. szekció).
  describe('skill mezők', () => {
    it('a null skills mellett sem plugins, sem skills mező nem megy ki (O-40 (a))', () => {
      const options = optionsFor(null);

      expect(Object.hasOwn(options, 'plugins')).toBe(false);
      expect(Object.hasOwn(options, 'skills')).toBe(false);
    });

    it('a lista puszta nevei <plugin>:<név> alakban mennek ki, a plugins a gyökérre mutat', () => {
      const options = optionsFor(['beta']);

      expect(options.plugins).toStrictEqual([{ type: 'local', path: '/var/skillek' }]);
      expect(options.skills).toStrictEqual(['skillek:beta']);
    });

    it('az all a könyvtár neveinek explicit listájára fordul, nem az SDK all értékére', () => {
      expect(optionsFor('all').skills).toStrictEqual(['skillek:alfa', 'skillek:beta']);
    });

    it('az üres lista üres skills listát ad, a plugins mezővel', () => {
      const options = optionsFor([]);

      expect(options.plugins).toStrictEqual([{ type: 'local', path: '/var/skillek' }]);
      expect(options.skills).toStrictEqual([]);
    });
  });
  it('a feloldott MCP szervereket változatlanul átadja, a régi mcpServers mezőt nem (SPEC-009 6.4, research 9.5 5. pont)', () => {
    const mcpServers = {
      github: { type: 'stdio', command: 'github-mcp', args: [], env: { GITHUB_TOKEN: 'ertek' } },
      docs: { type: 'http', url: 'https://127.0.0.1:4100/mcp', headers: { Authorization: 'Bearer x' } },
    } as const;
    const config = agentStepConfig({
      mcpServers: { regi: { type: 'stdio', command: 'regi', args: [], envNames: [] } },
    });

    const options = buildAgentStepOptions({
      config,
      decisions: decisions(),
      environmentBlock: {},
      mcpServers,
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(options.mcpServers).toBe(mcpServers);
  });

  it('üres feloldásnál nincs mcpServers mező, akkor sem, ha a régi mező nem üres', () => {
    const options = buildAgentStepOptions({
      config: agentStepConfig({
        mcpServers: { regi: { type: 'http', url: 'https://regi.example', authEnvName: null } },
      }),
      decisions: decisions(),
      environmentBlock: {},
      mcpServers: {},
      sessionBinding: isolated,
      skillLibrary: LIBRARY,
    });

    expect(Object.hasOwn(options, 'mcpServers')).toBe(false);
  });
});
