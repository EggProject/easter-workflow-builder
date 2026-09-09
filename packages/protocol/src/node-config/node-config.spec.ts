/* eslint-disable unicorn/no-null -- a node config nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { NodeConfigSchema } from './node-config.ts';

const VALID_AGENT_STEP_SETTINGS = {
  promptTemplate: 'Foglald össze: {{input}}',
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
};

describe('NodeConfigSchema', () => {
  it('elfogadja a start node teljes alakját', () => {
    const config = {
      type: 'start',
      inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }],
      onUnhandledError: 'fail_run',
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a start node onUnhandledError null értékét', () => {
    const config = { type: 'start', inputFields: [], onUnhandledError: null };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja az agent_step node teljes alakját', () => {
    const config = { ...VALID_AGENT_STEP_SETTINGS, type: 'agent_step', onUnhandledError: 'fail_branch' };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('az agent_step node agents mezője tetszőleges kulcsú, tetszőleges alakú értéket fogad', () => {
    const config = {
      ...VALID_AGENT_STEP_SETTINGS,
      type: 'agent_step',
      onUnhandledError: null,
      agents: { reviewer: { bármi: 'x' } },
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a branch node teljes alakját', () => {
    const config = {
      type: 'branch',
      expression: 'x > 0',
      branches: [{ key: 'pos', label: 'Pozitív' }],
      defaultBranchKey: null,
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a fan_out node teljes alakját', () => {
    const config = {
      type: 'fan_out',
      itemsExpression: 'items',
      branchLabelTemplate: '{{item}}',
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a join node merge módját, tetszőleges settings alakkal', () => {
    const config = {
      type: 'join',
      mode: 'merge',
      settings: { strategy: 'bármi', extra: [1, 2, 3] },
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a join node script módját', () => {
    const config = {
      type: 'join',
      mode: 'script',
      settings: { source: 'x + 1', runtime: 'expression' },
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a join node ai_synthesis módját', () => {
    const config = {
      type: 'join',
      mode: 'ai_synthesis',
      settings: VALID_AGENT_STEP_SETTINGS,
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('a join node ismeretlen mode értékre elutasít', () => {
    const config = { type: 'join', mode: 'unknown_mode', settings: {}, onUnhandledError: null };
    expect(NodeConfigSchema.safeParse(config).success).toBe(false);
  });

  it('elfogadja a loop node teljes alakját', () => {
    const config = { type: 'loop', maxIterations: 10, continueExpression: 'i < 10', onUnhandledError: null };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a human_approval node teljes alakját, timeoutMs null értékkel', () => {
    const config = {
      type: 'human_approval',
      title: 'Jóváhagyás',
      bodyTemplate: 'Engedélyezed?',
      timeoutMs: null,
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja az error_handler node teljes alakját', () => {
    const config = {
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [1000, 2000, 4000],
      handledErrorKinds: ['timeout'],
      onUnhandledError: 'fail_run',
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a sub_workflow node teljes alakját', () => {
    const config = {
      type: 'sub_workflow',
      targetWorkflowId: 'wf-1',
      inputMapping: { topic: 'parent.topic' },
      onUnhandledError: null,
    };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('elfogadja a script node teljes alakját', () => {
    const config = { type: 'script', source: 'x + 1', runtime: 'expression', onUnhandledError: null };
    expect(NodeConfigSchema.safeParse(config).success).toBe(true);
  });

  it('ismeretlen type értékre elutasít', () => {
    expect(NodeConfigSchema.safeParse({ type: 'unknown_type' }).success).toBe(false);
  });

  it('nem objektum bemenetre elutasít', () => {
    expect(NodeConfigSchema.safeParse('nem objektum').success).toBe(false);
  });
});
