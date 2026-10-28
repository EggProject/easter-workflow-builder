/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) és a hivatkozás `authEnvName` mezője valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig, McpServerDefinitionRecord } from '@easter-workflow-builder/db';
import type { ProcessEnvironmentPort } from '../engine-port/process-environment-port.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
import { validateMcpServerReferences } from './validate-mcp-server-references.ts';

function agentStepConfig(mcpServerReferences: AgentStepConfig['mcpServerReferences']): AgentStepConfig {
  return {
    promptTemplate: 'prompt',
    providerId: null,
    modelId: 'modell-1',
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
    // A régi mező nem üres értéke a motor ellenőrzésében hatástalan (SPEC-009 6.2, research 9.5 5. pont).
    mcpServers: { regi: { type: 'stdio', command: 'regi-parancs', args: [], envNames: ['NINCS_BEALLITVA'] } },
    ...(mcpServerReferences !== undefined && { mcpServerReferences }),
    cwd: null,
    additionalDirectories: [],
    sandbox: null,
    sessionMode: 'isolated',
    structuredOutput: null,
  };
}

const NO_OVERRIDE = { envBindings: {}, authEnvName: null };

const DOCS: McpServerDefinitionRecord = {
  name: 'docs',
  definition: { type: 'http', url: 'http://127.0.0.1:4100/mcp', authEnvName: 'DOCS_AUTH' },
};

function environmentOf(values: Readonly<Record<string, string>>): ProcessEnvironmentPort {
  const entries = new Map(Object.entries(values));
  return { read: (name) => entries.get(name) ?? null, readAll: () => values };
}

const OK = { kind: 'ok', value: undefined };

describe('validateMcpServerReferences', () => {
  it('a régi mezőt hordozó, hivatkozás nélküli lépés és a nem agent node zöld', () => {
    const configs = new Map<string, ExecutableNodeConfig>([
      ['regi', { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig(undefined) }],
      ['start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }],
    ]);

    expect(validateMcpServerReferences(configs, [], environmentOf({}))).toStrictEqual(OK);
  });

  it('a feloldható hivatkozás zöld', () => {
    const configs = new Map<string, ExecutableNodeConfig>([
      ['a1', { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig({ docs: NO_OVERRIDE }) }],
    ]);

    expect(validateMcpServerReferences(configs, [DOCS], environmentOf({ DOCS_AUTH: 'x' }))).toStrictEqual(OK);
  });

  it('a join ai_synthesis lépés törölt definícióra mutató hivatkozására mcp_server_not_found hibát ad', () => {
    const configs = new Map<string, ExecutableNodeConfig>([
      [
        'szintezis',
        {
          type: 'join',
          mode: 'ai_synthesis',
          settings: agentStepConfig({ torolt: NO_OVERRIDE }),
          onUnhandledError: 'fail_run',
        },
      ],
    ]);

    expect(validateMcpServerReferences(configs, [DOCS], environmentOf({}))).toStrictEqual({
      kind: 'error',
      message:
        'A(z) szintezis csomópont a(z) "torolt" MCP szerverre hivatkozik, ami nincs a központi MCP szerver listában (mcp_server_not_found).',
    });
  });

  it('a hiányzó szerver oldali változóra missing_mcp_server_env hibát ad', () => {
    const configs = new Map<string, ExecutableNodeConfig>([
      ['a1', { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig({ docs: NO_OVERRIDE }) }],
    ]);

    expect(validateMcpServerReferences(configs, [DOCS], environmentOf({}))).toStrictEqual({
      kind: 'error',
      message:
        'A(z) a1 csomópont "docs" MCP szerverének Authorization fejlécéhez rendelt "DOCS_AUTH" szerver oldali env változó nincs beállítva (missing_mcp_server_env).',
    });
  });
});
