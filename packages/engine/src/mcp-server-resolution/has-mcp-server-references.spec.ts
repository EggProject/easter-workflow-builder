/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import { hasMcpServerReferences } from './has-mcp-server-references.ts';

const CONFIG: AgentStepConfig = {
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
  mcpServers: {},
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  sessionMode: 'isolated',
  structuredOutput: null,
};

const REFERENCE = { github: { envBindings: {}, authEnvName: null } };

describe('hasMcpServerReferences', () => {
  it('hivatkozás mező nélkül, üres rekorddal és hivatkozás nélküli agent definíciókkal: false', () => {
    expect(hasMcpServerReferences(CONFIG)).toBe(false);
    expect(hasMcpServerReferences({ ...CONFIG, mcpServerReferences: {} })).toBe(false);
    expect(
      hasMcpServerReferences({
        ...CONFIG,
        agents: { a: { description: 'd', prompt: 'p' }, b: { mcpServerReferences: {} }, c: 'nem rekord' },
      }),
    ).toBe(false);
  });

  it('a lépés nem üres hivatkozás rekordja: true', () => {
    expect(hasMcpServerReferences({ ...CONFIG, mcpServerReferences: REFERENCE })).toBe(true);
  });

  it('egy agent definíció nem üres hivatkozás rekordja: true', () => {
    expect(hasMcpServerReferences({ ...CONFIG, agents: { a: { mcpServerReferences: REFERENCE } } })).toBe(true);
  });

  it('egy agent definíció nem rekord hivatkozás mezője nem hivatkozás (az alakot a resolveOutgoingAgents dönti el)', () => {
    expect(hasMcpServerReferences({ ...CONFIG, agents: { a: { mcpServerReferences: ['github'] } } })).toBe(false);
  });
});
