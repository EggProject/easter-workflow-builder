/* eslint-disable unicorn/no-null -- a node config nullázható mezői a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3); az `undefined` nem éli túl a JSON oszlopot, tehát a `null` itt adat, nem helyőrző */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '../agent-step-config/agent-step-config.ts';
import type { NodeConfig } from './node-config.ts';
import { isNodeConfig } from './is-node-config.ts';

const agentStepConfig: AgentStepConfig = {
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

// Mind a tíz ág egy-egy érvényes példánya. A `NodeConfig[]` annotáció
// fordítási idejű állítás is: az unió minden ágának le kell fednie egy elemet.
const validConfigs: readonly NodeConfig[] = [
  { type: 'start', inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'text', required: true }] },
  { ...agentStepConfig, type: 'agent_step' },
  {
    type: 'branch',
    expression: 'input.score > 5',
    branches: [{ key: 'high', label: 'Magas' }],
    defaultBranchKey: 'high',
  },
  { type: 'fan_out', itemsExpression: 'input.items', branchLabelTemplate: '{{item}}' },
  { type: 'join', mode: 'merge', settings: {} },
  { type: 'join', mode: 'script', settings: { source: 'a + b', runtime: 'expression' } },
  { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig },
  { type: 'loop', maxIterations: 3, continueExpression: 'state.retry' },
  { type: 'human_approval', title: 'Jóváhagyás', bodyTemplate: '{{summary}}' },
  { type: 'error_handler', maxAttempts: 2, backoffMs: [1000, 5000], handledErrorKinds: ['rate_limit'] },
  { type: 'sub_workflow', targetWorkflowId: 'workflow-1', inputMapping: { topic: 'input.topic' } },
  { type: 'script', source: 'a + b', runtime: 'expression' },
];

describe('isNodeConfig', () => {
  it('igazat ad mind a tíz node típus érvényes configjára', () => {
    expect(validConfigs.every((config) => isNodeConfig(config))).toBe(true);
    // Tíz típus, de tizenkét példány: a `join` mindhárom módja szerepel.
    expect(validConfigs).toHaveLength(12);
  });

  it('igazat ad üres start bemeneti mezőlistára és üres branch listára', () => {
    expect(isNodeConfig({ type: 'start', inputFields: [] })).toBe(true);
    expect(isNodeConfig({ type: 'branch', expression: 'x', branches: [], defaultBranchKey: null })).toBe(true);
  });

  it('hamisat ad nem rekord bemenetre', () => {
    expect(isNodeConfig(null)).toBe(false);
    expect(isNodeConfig('start')).toBe(false);
    expect(isNodeConfig([{ type: 'start', inputFields: [] }])).toBe(false);
  });

  it('hamisat ad hiányzó vagy tizenegyedik type értékre', () => {
    expect(isNodeConfig({ inputFields: [] })).toBe(false);
    expect(isNodeConfig({ type: 'prompt', inputFields: [] })).toBe(false);
    expect(isNodeConfig({ type: 7, inputFields: [] })).toBe(false);
  });

  // Áganként legalább egy hibás mező. A guard minden operandusának a hamis
  // ágát is végig kell járni a 100 százalékos lefedettséghez.
  const rejectedConfigs: readonly (readonly [string, unknown])[] = [
    ['start: inputFields nem tömb', { type: 'start', inputFields: {} }],
    ['start: mező nem rekord', { type: 'start', inputFields: ['topic'] }],
    ['start: name hiányzik', { type: 'start', inputFields: [{ label: 'T', valueKind: 'text', required: true }] }],
    [
      'start: label rossz típusú',
      { type: 'start', inputFields: [{ name: 'topic', label: 7, valueKind: 'text', required: true }] },
    ],
    [
      'start: valueKind rossz típusú',
      { type: 'start', inputFields: [{ name: 'topic', label: 'T', valueKind: 7, required: true }] },
    ],
    [
      'start: required nem logikai',
      { type: 'start', inputFields: [{ name: 'topic', label: 'T', valueKind: 'text', required: 'igen' }] },
    ],
    ['agent_step: hibás belső config', { type: 'agent_step', promptTemplate: 7 }],
    ['branch: expression rossz típusú', { type: 'branch', expression: 7, branches: [], defaultBranchKey: null }],
    ['branch: branches nem tömb', { type: 'branch', expression: 'x', branches: {}, defaultBranchKey: null }],
    ['branch: ág nem rekord', { type: 'branch', expression: 'x', branches: ['high'], defaultBranchKey: null }],
    [
      'branch: ág key hiányzik',
      { type: 'branch', expression: 'x', branches: [{ label: 'Magas' }], defaultBranchKey: null },
    ],
    [
      'branch: ág label rossz típusú',
      { type: 'branch', expression: 'x', branches: [{ key: 'high', label: 7 }], defaultBranchKey: null },
    ],
    ['branch: defaultBranchKey rossz típusú', { type: 'branch', expression: 'x', branches: [], defaultBranchKey: 7 }],
    ['fan_out: itemsExpression rossz típusú', { type: 'fan_out', itemsExpression: 7, branchLabelTemplate: '{{item}}' }],
    ['fan_out: branchLabelTemplate hiányzik', { type: 'fan_out', itemsExpression: 'input.items' }],
    ['join: ismeretlen mód', { type: 'join', mode: 'concat', settings: {} }],
    ['join: hiányzó mód', { type: 'join', settings: {} }],
    ['join: merge alobjektum nem rekord', { type: 'join', mode: 'merge', settings: 'first' }],
    ['join: script alobjektum hibás', { type: 'join', mode: 'script', settings: { source: 'a', runtime: 'js' } }],
    ['join: ai_synthesis alobjektum hibás', { type: 'join', mode: 'ai_synthesis', settings: { promptTemplate: 7 } }],
    ['loop: maxIterations nulla', { type: 'loop', maxIterations: 0, continueExpression: 'x' }],
    ['loop: maxIterations negatív', { type: 'loop', maxIterations: -1, continueExpression: 'x' }],
    ['loop: maxIterations tört', { type: 'loop', maxIterations: 1.5, continueExpression: 'x' }],
    ['loop: maxIterations nem szám', { type: 'loop', maxIterations: '3', continueExpression: 'x' }],
    ['loop: continueExpression rossz típusú', { type: 'loop', maxIterations: 3, continueExpression: 7 }],
    ['human_approval: title rossz típusú', { type: 'human_approval', title: 7, bodyTemplate: 'x' }],
    ['human_approval: bodyTemplate hiányzik', { type: 'human_approval', title: 'Jóváhagyás' }],
    [
      'error_handler: maxAttempts nulla',
      { type: 'error_handler', maxAttempts: 0, backoffMs: [1000], handledErrorKinds: [] },
    ],
    [
      'error_handler: backoffMs nem tömb',
      { type: 'error_handler', maxAttempts: 2, backoffMs: 1000, handledErrorKinds: [] },
    ],
    [
      'error_handler: backoffMs eleme nem pozitív egész',
      { type: 'error_handler', maxAttempts: 2, backoffMs: [0], handledErrorKinds: [] },
    ],
    [
      'error_handler: handledErrorKinds nem szövegtömb',
      { type: 'error_handler', maxAttempts: 2, backoffMs: [1000], handledErrorKinds: [7] },
    ],
    ['sub_workflow: targetWorkflowId rossz típusú', { type: 'sub_workflow', targetWorkflowId: 7, inputMapping: {} }],
    [
      'sub_workflow: inputMapping nem rekord',
      { type: 'sub_workflow', targetWorkflowId: 'workflow-1', inputMapping: [] },
    ],
    [
      'sub_workflow: inputMapping értéke nem szöveg',
      { type: 'sub_workflow', targetWorkflowId: 'workflow-1', inputMapping: { topic: 7 } },
    ],
    ['script: source rossz típusú', { type: 'script', source: 7, runtime: 'expression' }],
    ['script: ismeretlen runtime', { type: 'script', source: 'a + b', runtime: 'javascript' }],
  ];

  for (const [description, config] of rejectedConfigs) {
    it(`hamisat ad, ${description}`, () => {
      expect(isNodeConfig(config)).toBe(false);
    });
  }
});
