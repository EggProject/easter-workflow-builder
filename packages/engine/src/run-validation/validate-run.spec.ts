/* eslint-disable unicorn/no-null -- a pillanatkép és a node config nullázható mezői (`branchKey`, `description`, `defaultBranchKey`, `timeoutMs`, `providerId`, `onUnhandledError`) a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3, 4.4, 5.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { GraphSnapshotDocument, NodeType, SnapshotEdge, SnapshotNode } from '@easter-workflow-builder/db';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { validateRun } from './validate-run.ts';
import type { ValidatedRun } from './validated-run.ts';

function node(id: string, type: NodeType, config: unknown): SnapshotNode {
  return { id, type, label: id, position: { x: 0, y: 0 }, config, effectiveProviderId: 'minimax' };
}

function edge(id: string, sourceNodeId: string, targetNodeId: string, branchKey: string | null = null): SnapshotEdge {
  return { id, sourceNodeId, targetNodeId, sourceHandle: null, targetHandle: null, branchKey };
}

function documentOf(nodes: readonly SnapshotNode[], edges: readonly SnapshotEdge[]): GraphSnapshotDocument {
  return {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: 'wf', name: 'teszt', description: null },
    nodes,
    edges,
  };
}

function replacingNode(nodes: readonly SnapshotNode[], replacement: SnapshotNode): readonly SnapshotNode[] {
  return nodes.map((current) => (current.id === replacement.id ? replacement : current));
}

function replacingEdge(edges: readonly SnapshotEdge[], replacement: SnapshotEdge): readonly SnapshotEdge[] {
  return edges.map((current) => (current.id === replacement.id ? replacement : current));
}

function expectOk(outcome: Outcome<ValidatedRun>): ValidatedRun {
  if (outcome.kind === 'error') {
    throw new Error(`A validáció váratlanul hibára futott: ${outcome.message}`);
  }
  return outcome.value;
}

// Az `AgentStepConfig` mezői a lépés szintű `providerId` nélkül. Az `as const`
// const assertion, nem type assertion.
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

function agentStepConfig(providerId: ProviderId | null): unknown {
  return { type: 'agent_step', ...AGENT_SETTINGS, providerId, onUnhandledError: 'fail_run' };
}

function branchConfig(branchKeys: readonly string[], defaultBranchKey: string | null): unknown {
  return {
    type: 'branch',
    expression: 'ertek',
    branches: branchKeys.map((key) => ({ key, label: key })),
    defaultBranchKey,
    onUnhandledError: 'fail_run',
  };
}

const START_CONFIG = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const FAN_OUT_CONFIG = {
  type: 'fan_out',
  itemsExpression: 'elemek',
  branchLabelTemplate: 'elem',
  onUnhandledError: 'fail_run',
};
const JOIN_MERGE_CONFIG = { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' };
const HUMAN_APPROVAL_CONFIG = {
  type: 'human_approval',
  title: 'Jóváhagyás',
  bodyTemplate: 'szoveg',
  timeoutMs: null,
  onUnhandledError: 'fail_run',
};
const ERROR_HANDLER_CONFIG = {
  type: 'error_handler',
  maxAttempts: 2,
  backoffMs: [100],
  handledErrorKinds: [],
  onUnhandledError: 'fail_run',
};
const SUB_WORKFLOW_CONFIG = {
  type: 'sub_workflow',
  targetWorkflowId: 'wf-gyerek',
  inputMapping: {},
  onUnhandledError: 'fail_run',
};

// Az érvényes referencia gráf: nyolc node típus, egy fan-out hatókör, ami a
// `join` node-on szabályosan zár, egy `branch` elágazás, egy hibaág és egy
// terminális `sub_workflow` lépés.
function baseNodes(): readonly SnapshotNode[] {
  return [
    node('start', 'start', START_CONFIG),
    node('f', 'fan_out', FAN_OUT_CONFIG),
    node('a', 'agent_step', agentStepConfig(null)),
    node('j', 'join', JOIN_MERGE_CONFIG),
    node('b', 'branch', branchConfig(['bal', 'jobb'], 'bal')),
    node('x', 'agent_step', agentStepConfig('claude-subscription')),
    node('y', 'human_approval', HUMAN_APPROVAL_CONFIG),
    node('eh', 'error_handler', ERROR_HANDLER_CONFIG),
    node('vege', 'sub_workflow', SUB_WORKFLOW_CONFIG),
  ];
}

function baseEdges(): readonly SnapshotEdge[] {
  return [
    edge('e_sf', 'start', 'f'),
    edge('e_fa', 'f', 'a'),
    edge('e_aj', 'a', 'j'),
    edge('e_jb', 'j', 'b'),
    edge('e_bx', 'b', 'x', 'bal'),
    edge('e_by', 'b', 'y', 'jobb'),
    edge('e_xe', 'x', 'eh', 'on_error'),
    edge('e_xv', 'x', 'vege'),
    edge('e_yv', 'y', 'vege', 'approved'),
    edge('e_ev', 'eh', 'vege', 'exhausted'),
  ];
}

function validateBase(
  nodes: readonly SnapshotNode[] = baseNodes(),
  edges: readonly SnapshotEdge[] = baseEdges(),
): Outcome<ValidatedRun> {
  return validateRun(documentOf(nodes, edges), 'minimax', null);
}

describe('validateRun, az érvényes gráf', () => {
  it('minden ellenőrzésen átmegy, és a mellékterméket visszaadja', () => {
    const validated = expectOk(validateBase());

    expect(validated.startNodeId).toBe('start');
    expect(validated.graph.nodesById.size).toBe(9);
    expect(validated.loopBackEdgeIds).toStrictEqual(new Set());
    expect(validated.fanOutJoinPairing.joinToFanOut).toStrictEqual(new Map([['j', 'f']]));
    expect(validated.nodeConfigsById.get('j')).toStrictEqual(JOIN_MERGE_CONFIG);
    expect(validated.nodeConfigsById.size).toBe(9);
  });

  it('minden node-ra ad feloldott providert, a lépés szintű felülírással együtt', () => {
    const validated = expectOk(validateBase());

    expect(validated.effectiveProviderByNodeId.size).toBe(9);
    expect(validated.effectiveProviderByNodeId.get('x')).toBe('claude-subscription');
    expect(validated.effectiveProviderByNodeId.get('a')).toBe('minimax');
    expect(validated.effectiveProviderByNodeId.get('start')).toBe('minimax');
  });

  it('a szabályos loop node visszaélével együtt is érvényes', () => {
    const nodes = [
      node('start', 'start', START_CONFIG),
      node('L', 'loop', { type: 'loop', maxIterations: 5, continueExpression: 'megy', onUnhandledError: 'fail_run' }),
      node('t', 'agent_step', agentStepConfig(null)),
      node('vege', 'agent_step', agentStepConfig(null)),
    ];
    const edges = [
      edge('e_sL', 'start', 'L'),
      edge('e_Lt', 'L', 't', 'continue'),
      edge('e_tL', 't', 'L'),
      edge('e_Lv', 'L', 'vege', 'exit'),
    ];

    const validated = expectOk(validateRun(documentOf(nodes, edges), 'minimax', null));

    expect(validated.loopBackEdgeIds).toStrictEqual(new Set(['e_tL']));
    expect(validated.fanOutJoinPairing.joinToFanOut).toStrictEqual(new Map());
  });
});

describe('validateRun, a SPEC-004 4.7 táblázat tíz ellenőrzése', () => {
  it('két start node esetén invalid_start_node', () => {
    const nodes = [...baseNodes(), node('start2', 'start', START_CONFIG)];

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message: 'A gráfban pontosan egy start típusú node kell álljon, 2 darab áll benne (invalid_start_node).',
    });
  });

  it('nem létező node-ra mutató élre dangling_edge', () => {
    const edges = [...baseEdges(), edge('e_hib', 'vege', 'nincs')];

    expect(validateBase(baseNodes(), edges)).toStrictEqual({
      kind: 'error',
      message: 'A(z) e_hib él célja (nincs) nem létező node a pillanatképben (dangling_edge).',
    });
  });

  it('a start node-ból el nem érhető node-ra unreachable_node', () => {
    const nodes = [...baseNodes(), node('arva', 'agent_step', agentStepConfig(null))];

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message: 'A(z) arva node nem érhető el a(z) start start node-ból (unreachable_node).',
    });
  });

  it('script node-ra unimplemented_node_type', () => {
    const nodes = replacingNode(
      baseNodes(),
      node('x', 'script', { type: 'script', source: 'ertek', runtime: 'expression', onUnhandledError: 'fail_run' }),
    );

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message: 'A(z) x node a script node típus, amit az első verzió nem hajt végre (unimplemented_node_type).',
    });
  });

  it('script módú join node-ra unimplemented_node_type', () => {
    const nodes = replacingNode(
      baseNodes(),
      node('j', 'join', {
        type: 'join',
        mode: 'script',
        settings: { source: 'ertek', runtime: 'expression' },
        onUnhandledError: 'fail_run',
      }),
    );

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message: 'A(z) j node a join node script módja, amit az első verzió nem hajt végre (unimplemented_node_type).',
    });
  });

  it('ismeretlen branch él kulcsra branch_key_unknown', () => {
    const edges = replacingEdge(baseEdges(), edge('e_bx', 'b', 'x', 'kozepe'));

    expect(validateBase(baseNodes(), edges)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) b branch node e_bx élének branch_key értékét (kozepe) a branches lista nem tartalmazza (branch_key_unknown).',
    });
  });

  it('ismeretlen defaultBranchKey értékre branch_key_unknown', () => {
    const nodes = replacingNode(baseNodes(), node('b', 'branch', branchConfig(['bal', 'jobb'], 'kozepe')));

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) b branch node defaultBranchKey értékét (kozepe) a branches lista nem tartalmazza (branch_key_unknown).',
    });
  });

  it('nem error_handler célú on_error élre invalid_error_handler_edge', () => {
    const edges = replacingEdge(baseEdges(), edge('e_xe', 'x', 'vege', 'on_error'));
    const nodes = baseNodes().filter((current) => current.id !== 'eh');

    expect(
      validateBase(
        nodes,
        edges.filter((current) => current.id !== 'e_ev'),
      ),
    ).toStrictEqual({
      kind: 'error',
      message: 'A(z) e_xe on_error él célja (vege) nem error_handler típusú node (invalid_error_handler_edge).',
    });
  });

  it('a node típusához nem illeszkedő configra malformed_node_config', () => {
    const nodes = replacingNode(baseNodes(), node('y', 'human_approval', START_CONFIG));

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message: 'A(z) y node típusa human_approval, a configjáé viszont start (malformed_node_config).',
    });
  });

  it('hiányzó onUnhandledError értékre unhandled_error_policy_missing', () => {
    const nodes = replacingNode(
      baseNodes(),
      node('y', 'human_approval', { ...HUMAN_APPROVAL_CONFIG, onUnhandledError: null }),
    );

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message: 'A(z) y node configjában nincs onUnhandledError érték beállítva (unhandled_error_policy_missing).',
    });
  });

  it('nem üres merge settings rekordra unsupported_join_merge_setting', () => {
    const nodes = replacingNode(
      baseNodes(),
      node('j', 'join', { ...JOIN_MERGE_CONFIG, settings: { strategy: 'concat' } }),
    );

    expect(validateBase(nodes)).toStrictEqual({
      kind: 'error',
      message:
        'A(z) j join node merge módja ismeretlen beállítási kulcsot hordoz: strategy (unsupported_join_merge_setting).',
    });
  });
});

describe('validateRun, a 4.2 és a 4.8 szekció ellenőrzései', () => {
  it('fenntartott branch kulcsra reserved_branch_key_misuse', () => {
    const nodes = replacingNode(baseNodes(), node('b', 'branch', branchConfig(['bal', 'exit'], 'bal')));
    const edges = replacingEdge(baseEdges(), edge('e_by', 'b', 'y', 'exit'));

    expect(validateBase(nodes, edges)).toStrictEqual({
      kind: 'error',
      message: 'A(z) b branch node exit kulcsa fenntartott branch_key érték (reserved_branch_key_misuse).',
    });
  });

  it('feloldható provider nélkül no_default_provider', () => {
    const document = documentOf(baseNodes(), baseEdges());

    expect(validateRun(document, null, null)).toStrictEqual({
      kind: 'error',
      message: 'Nincs feloldható provider egyik szinten sem (no_default_provider).',
    });
  });

  it('a gráf alak hibái a run-graph és a branch-scope témából jönnek át', () => {
    const nodes = [...baseNodes(), node('kor', 'agent_step', agentStepConfig(null))];
    const edges = [...baseEdges(), edge('e_vk', 'vege', 'kor'), edge('e_kv', 'kor', 'vege')];

    expect(validateBase(nodes, edges)).toStrictEqual({
      kind: 'error',
      message: 'A gráf kört tartalmaz a következő node-okon át: vege, kor (graph_cycle_detected).',
    });
  });

  it('a hatókör kiegyensúlyozatlanság is a validáció része', () => {
    const nodes = baseNodes().filter((current) => current.id !== 'j');
    const edges = baseEdges()
      .filter((current) => current.id !== 'e_aj')
      .map((current) => (current.id === 'e_jb' ? edge('e_jb', 'a', 'b') : current));

    expect(validateBase(nodes, edges)).toStrictEqual({
      kind: 'error',
      message: 'A(z) vege terminális node-ig nyitva marad egy fan_out hatókör (unbalanced_fan_out_scope).',
    });
  });
});
