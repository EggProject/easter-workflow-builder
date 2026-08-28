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
// Az `onUnhandledError` értéke végig váltakozik (`fail_run` / `fail_branch` /
// `null`), hogy mindhárom állapot lefedve legyen legalább egy érvényes configon.
const validConfigs: readonly NodeConfig[] = [
  {
    type: 'start',
    inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'text', required: true }],
    onUnhandledError: 'fail_run',
  },
  { ...agentStepConfig, type: 'agent_step', onUnhandledError: 'fail_branch' },
  {
    type: 'branch',
    expression: 'input.score > 5',
    branches: [{ key: 'high', label: 'Magas' }],
    defaultBranchKey: 'high',
    onUnhandledError: null,
  },
  {
    type: 'fan_out',
    itemsExpression: 'input.items',
    branchLabelTemplate: '{{item}}',
    onUnhandledError: 'fail_run',
  },
  { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_branch' },
  {
    type: 'join',
    mode: 'script',
    settings: { source: 'a + b', runtime: 'expression' },
    onUnhandledError: null,
  },
  { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig, onUnhandledError: 'fail_run' },
  { type: 'loop', maxIterations: 3, continueExpression: 'state.retry', onUnhandledError: 'fail_branch' },
  {
    type: 'human_approval',
    title: 'Jóváhagyás',
    bodyTemplate: '{{summary}}',
    timeoutMs: null,
    onUnhandledError: null,
  },
  {
    type: 'error_handler',
    maxAttempts: 2,
    backoffMs: [1000, 5000],
    handledErrorKinds: ['rate_limit'],
    onUnhandledError: 'fail_run',
  },
  {
    type: 'sub_workflow',
    targetWorkflowId: 'workflow-1',
    inputMapping: { topic: 'input.topic' },
    onUnhandledError: 'fail_branch',
  },
  { type: 'script', source: 'a + b', runtime: 'expression', onUnhandledError: null },
];

describe('isNodeConfig', () => {
  it('igazat ad mind a tíz node típus érvényes configjára', () => {
    expect(validConfigs.every((config) => isNodeConfig(config))).toBe(true);
    // Tíz típus, de tizenkét példány: a `join` mindhárom módja szerepel.
    expect(validConfigs).toHaveLength(12);
  });

  it('igazat ad üres start bemeneti mezőlistára és üres branch listára', () => {
    expect(isNodeConfig({ type: 'start', inputFields: [], onUnhandledError: null })).toBe(true);
    expect(
      isNodeConfig({ type: 'branch', expression: 'x', branches: [], defaultBranchKey: null, onUnhandledError: null }),
    ).toBe(true);
  });

  it('igazat ad számmal megadott human_approval timeoutMs értékre', () => {
    expect(
      isNodeConfig({
        type: 'human_approval',
        title: 'Jóváhagyás',
        bodyTemplate: '{{summary}}',
        timeoutMs: 5000,
        onUnhandledError: 'fail_run',
      }),
    ).toBe(true);
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
    ['start: onUnhandledError érvénytelen', { type: 'start', inputFields: [], onUnhandledError: 'unknown_policy' }],
    ['agent_step: hibás belső config', { type: 'agent_step', promptTemplate: 7 }],
    [
      'agent_step: onUnhandledError érvénytelen (isAgentStepConfig önmagában nem ellenőrzi)',
      { ...agentStepConfig, type: 'agent_step', onUnhandledError: 7 },
    ],
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
    [
      'branch: onUnhandledError érvénytelen',
      { type: 'branch', expression: 'x', branches: [], defaultBranchKey: null, onUnhandledError: 'unknown_policy' },
    ],
    ['fan_out: itemsExpression rossz típusú', { type: 'fan_out', itemsExpression: 7, branchLabelTemplate: '{{item}}' }],
    ['fan_out: branchLabelTemplate hiányzik', { type: 'fan_out', itemsExpression: 'input.items' }],
    [
      'fan_out: onUnhandledError érvénytelen',
      { type: 'fan_out', itemsExpression: 'input.items', branchLabelTemplate: '{{item}}', onUnhandledError: 7 },
    ],
    ['join: ismeretlen mód', { type: 'join', mode: 'concat', settings: {} }],
    ['join: hiányzó mód', { type: 'join', settings: {} }],
    ['join: merge alobjektum nem rekord', { type: 'join', mode: 'merge', settings: 'first' }],
    ['join: script alobjektum hibás', { type: 'join', mode: 'script', settings: { source: 'a', runtime: 'js' } }],
    ['join: ai_synthesis alobjektum hibás', { type: 'join', mode: 'ai_synthesis', settings: { promptTemplate: 7 } }],
    [
      'join: merge onUnhandledError érvénytelen',
      { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'unknown_policy' },
    ],
    [
      'join: script onUnhandledError érvénytelen (isScriptConfig önmagában nem ellenőrzi)',
      {
        type: 'join',
        mode: 'script',
        settings: { source: 'a + b', runtime: 'expression' },
        onUnhandledError: 7,
      },
    ],
    [
      'join: ai_synthesis onUnhandledError érvénytelen (isAgentStepConfig önmagában nem ellenőrzi)',
      { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig, onUnhandledError: 'unknown_policy' },
    ],
    ['loop: maxIterations nulla', { type: 'loop', maxIterations: 0, continueExpression: 'x' }],
    ['loop: maxIterations negatív', { type: 'loop', maxIterations: -1, continueExpression: 'x' }],
    ['loop: maxIterations tört', { type: 'loop', maxIterations: 1.5, continueExpression: 'x' }],
    ['loop: maxIterations nem szám', { type: 'loop', maxIterations: '3', continueExpression: 'x' }],
    ['loop: continueExpression rossz típusú', { type: 'loop', maxIterations: 3, continueExpression: 7 }],
    [
      'loop: onUnhandledError érvénytelen',
      { type: 'loop', maxIterations: 3, continueExpression: 'x', onUnhandledError: 7 },
    ],
    ['human_approval: title rossz típusú', { type: 'human_approval', title: 7, bodyTemplate: 'x' }],
    ['human_approval: bodyTemplate hiányzik', { type: 'human_approval', title: 'Jóváhagyás' }],
    [
      'human_approval: onUnhandledError érvénytelen',
      {
        type: 'human_approval',
        title: 'Jóváhagyás',
        bodyTemplate: 'x',
        timeoutMs: null,
        onUnhandledError: 'unknown_policy',
      },
    ],
    [
      'human_approval: timeoutMs érvénytelen',
      {
        type: 'human_approval',
        title: 'Jóváhagyás',
        bodyTemplate: 'x',
        timeoutMs: '5000',
        onUnhandledError: 'fail_run',
      },
    ],
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
    [
      'error_handler: onUnhandledError érvénytelen',
      { type: 'error_handler', maxAttempts: 2, backoffMs: [1000], handledErrorKinds: [], onUnhandledError: 7 },
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
    [
      'sub_workflow: onUnhandledError érvénytelen',
      {
        type: 'sub_workflow',
        targetWorkflowId: 'workflow-1',
        inputMapping: {},
        onUnhandledError: 'unknown_policy',
      },
    ],
    ['script: source rossz típusú', { type: 'script', source: 7, runtime: 'expression' }],
    ['script: ismeretlen runtime', { type: 'script', source: 'a + b', runtime: 'javascript' }],
    [
      'script: onUnhandledError érvénytelen (isScriptConfig önmagában nem ellenőrzi)',
      { type: 'script', source: 'a + b', runtime: 'expression', onUnhandledError: 7 },
    ],
  ];

  for (const [description, config] of rejectedConfigs) {
    it(`hamisat ad, ${description}`, () => {
      expect(isNodeConfig(config)).toBe(false);
    });
  }
});
