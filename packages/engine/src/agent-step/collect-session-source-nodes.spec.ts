/* eslint-disable unicorn/no-null -- az `AgentStepConfig` és a node config nullázható mezői (`providerId`, `modelId`, `structuredOutput`, `onUnhandledError`, ...) a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3, 4.4), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { collectSessionSourceNodes } from './collect-session-source-nodes.ts';

function agentStepConfig(sessionMode: AgentStepConfig['sessionMode']): AgentStepConfig {
  return {
    promptTemplate: 'prompt',
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
    sessionMode,
    structuredOutput: null,
  };
}

function agentStepNode(sessionMode: AgentStepConfig['sessionMode']): ExecutableNodeConfig {
  return { type: 'agent_step', ...agentStepConfig(sessionMode), onUnhandledError: 'fail_run' };
}

function aiSynthesisJoinNode(sessionMode: AgentStepConfig['sessionMode']): ExecutableNodeConfig {
  return { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig(sessionMode), onUnhandledError: 'fail_run' };
}

const mergeJoinNode: ExecutableNodeConfig = {
  type: 'join',
  mode: 'merge',
  settings: {},
  onUnhandledError: 'fail_run',
};

const branchNode: ExecutableNodeConfig = {
  type: 'branch',
  expression: 'x',
  branches: [],
  defaultBranchKey: null,
  onUnhandledError: 'fail_run',
};

describe('collectSessionSourceNodes', () => {
  it('az agent_step node session forrás, isolated módban is', () => {
    const result = collectSessionSourceNodes(new Map([['a', agentStepNode('isolated')]]));

    expect(result.sourceNodeIds).toStrictEqual(new Set(['a']));
    expect(result.continuedNodeIds).toStrictEqual(new Set());
  });

  it('a continued módú agent_step mindkét halmazba bekerül', () => {
    const result = collectSessionSourceNodes(new Map([['a', agentStepNode('continued')]]));

    expect(result.sourceNodeIds).toStrictEqual(new Set(['a']));
    expect(result.continuedNodeIds).toStrictEqual(new Set(['a']));
  });

  it('az ai_synthesis módú join a settings alobjektum sessionMode értékét viszi', () => {
    const result = collectSessionSourceNodes(
      new Map([
        ['j1', aiSynthesisJoinNode('continued')],
        ['j2', aiSynthesisJoinNode('isolated')],
      ]),
    );

    expect(result.sourceNodeIds).toStrictEqual(new Set(['j1', 'j2']));
    expect(result.continuedNodeIds).toStrictEqual(new Set(['j1']));
  });

  it('a merge módú join és a nem agent node egyik halmazba sem kerül be', () => {
    const result = collectSessionSourceNodes(
      new Map<string, ExecutableNodeConfig>([
        ['j', mergeJoinNode],
        ['b', branchNode],
      ]),
    );

    expect(result.sourceNodeIds).toStrictEqual(new Set());
    expect(result.continuedNodeIds).toStrictEqual(new Set());
  });

  it('üres gráfra üres halmazokat ad', () => {
    const result = collectSessionSourceNodes(new Map());

    expect(result.sourceNodeIds).toStrictEqual(new Set());
    expect(result.continuedNodeIds).toStrictEqual(new Set());
  });
});
