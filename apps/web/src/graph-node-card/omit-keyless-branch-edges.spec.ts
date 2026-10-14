/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput/WorkflowEdgeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-005 protokoll alak) */
import type { NodeConfig, WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { omitKeylessBranchEdges } from './omit-keyless-branch-edges.ts';

const BRANCH_CONFIG: NodeConfig = {
  type: 'branch',
  expression: 'input.kind',
  branches: [
    { key: 'igen', label: 'Igen' },
    { key: 'nem', label: 'Nem' },
  ],
  defaultBranchKey: 'nem',
  onUnhandledError: null,
};

const AGENT_STEP_CONFIG: NodeConfig = {
  type: 'agent_step',
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
  onUnhandledError: null,
};

const ERROR_HANDLER_CONFIG: NodeConfig = {
  type: 'error_handler',
  maxAttempts: 3,
  backoffMs: [1000],
  handledErrorKinds: ['timeout'],
  onUnhandledError: null,
};

const FAN_OUT_CONFIG: NodeConfig = {
  type: 'fan_out',
  itemsExpression: 'items',
  branchLabelTemplate: '{{item}}',
  onUnhandledError: null,
};

function node(id: string, type: WorkflowNodeInput['type'], config: NodeConfig): WorkflowNodeInput {
  return { id, type, label: id, positionX: 0, positionY: 0, config };
}

function edge(id: string, sourceNodeId: string, branchKey: string | null): WorkflowEdgeInput {
  return { id, sourceNodeId, targetNodeId: 'n-cel', sourceHandle: branchKey, targetHandle: null, branchKey };
}

const NODES: readonly WorkflowNodeInput[] = [
  node('n-branch', 'branch', BRANCH_CONFIG),
  node('n-agent', 'agent_step', AGENT_STEP_CONFIG),
  node('n-handler', 'error_handler', ERROR_HANDLER_CONFIG),
];

function keptEdgeIds(nodes: readonly WorkflowNodeInput[], edges: readonly WorkflowEdgeInput[]): string[] {
  return omitKeylessBranchEdges(nodes, edges).map((kept) => kept.id);
}

describe('omitKeylessBranchEdges', () => {
  it('a branch forrású, null kulcsú élt elhagyja', () => {
    expect(keptEdgeIds(NODES, [edge('e-regi', 'n-branch', null)])).toEqual([]);
  });

  it('a branch forrású, kulcsos élt megtartja', () => {
    expect(keptEdgeIds(NODES, [edge('e-igen', 'n-branch', 'igen'), edge('e-nem', 'n-branch', 'nem')])).toEqual([
      'e-igen',
      'e-nem',
    ]);
  });

  it('a branches listában nem szereplő kulcsú, branch forrású élt is megtartja', () => {
    expect(keptEdgeIds(NODES, [edge('e-ismeretlen', 'n-branch', 'talan')])).toEqual(['e-ismeretlen']);
  });

  it('az agent_step null kulcsú élét megtartja', () => {
    expect(keptEdgeIds(NODES, [edge('e-agent', 'n-agent', null)])).toEqual(['e-agent']);
  });

  it('az error_handler null kulcsú élét megtartja, a kulcsos on_error élével együtt', () => {
    expect(keptEdgeIds(NODES, [edge('e-tovabb', 'n-handler', null), edge('e-hiba', 'n-handler', 'on_error')])).toEqual([
      'e-tovabb',
      'e-hiba',
    ]);
  });

  it('a csomópont listában nem szereplő forrás null kulcsú élét megtartja', () => {
    expect(keptEdgeIds(NODES, [edge('e-arva', 'n-nincs', null)])).toEqual(['e-arva']);
  });

  it('a forrás típusát a csomópont type mezője adja, nem a config.type', () => {
    const mismatched: readonly WorkflowNodeInput[] = [
      node('n-branch-tipus', 'branch', FAN_OUT_CONFIG),
      node('n-agent-tipus', 'agent_step', BRANCH_CONFIG),
    ];
    expect(
      keptEdgeIds(mismatched, [
        edge('e-branch-tipus', 'n-branch-tipus', null),
        edge('e-agent-tipus', 'n-agent-tipus', null),
      ]),
    ).toEqual(['e-agent-tipus']);
  });

  it('vegyes listán csak a kulcs nélküli elágazás élt hagyja el, a sorrendet megtartja', () => {
    const edges = [
      edge('e-agent', 'n-agent', null),
      edge('e-regi', 'n-branch', null),
      edge('e-igen', 'n-branch', 'igen'),
      edge('e-tovabb', 'n-handler', null),
    ];
    expect(keptEdgeIds(NODES, edges)).toEqual(['e-agent', 'e-igen', 'e-tovabb']);
  });

  it('üres él listára üres listát ad', () => {
    expect(keptEdgeIds(NODES, [])).toEqual([]);
  });
});
