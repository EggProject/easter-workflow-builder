/* eslint-disable unicorn/no-null -- a node config nullázható mezői a tárolt JSON-ban `null` értéket hordoznak (SPEC-003 4.3); az `undefined` nem éli túl a JSON oszlopot, tehát a `null` itt adat, nem helyőrző */
import { describe, expect, it } from 'vitest';
import type { AgentStepConfig } from '../agent-step-config/agent-step-config.ts';
import type { NodeConfig, StartInputField } from './node-config.ts';
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
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
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
  { type: 'join', mode: 'merge', onUnhandledError: 'fail_branch' },
  {
    type: 'join',
    mode: 'script',
    settings: { source: 'a + b', runtime: 'expression' },
    onUnhandledError: null,
  },
  {
    type: 'join',
    mode: 'script',
    settings: {
      source: 'return 1;',
      runtime: 'javascript',
      timeoutMs: 120_000,
      cwd: 'munka/almappa',
      memoryLimitMb: null,
    },
    onUnhandledError: 'fail_run',
  },
  { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig, onUnhandledError: 'fail_run' },
  { type: 'join', mode: null, onUnhandledError: null },
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
  {
    type: 'script',
    source: 'return 1;',
    runtime: 'javascript',
    timeoutMs: null,
    cwd: null,
    memoryLimitMb: 256,
    onUnhandledError: null,
  },
];

describe('isNodeConfig', () => {
  it('igazat ad mind a tíz node típus érvényes configjára', () => {
    expect(validConfigs.every((config) => isNodeConfig(config))).toBe(true);
    // Tíz típus, de tizenöt példány: a `join` mindhárom módja (a `script` mindkét
    // `runtime` ággal, SPEC-014 5.3) és a választatlan (`mode: null`, SPEC-008
    // O-33) ága is szerepel, a `script` node pedig mindkét `runtime` ággal.
    expect(validConfigs).toHaveLength(15);
  });

  it('igazat ad a start bemeneti mező mind a hat valueKind értékére (SPEC-016 5.1)', () => {
    const fields: readonly StartInputField[] = [
      { name: 'a', label: 'A', valueKind: 'text', required: true },
      { name: 'b', label: 'B', valueKind: 'number', required: false },
      { name: 'c', label: 'C', valueKind: 'boolean', required: false },
      { name: 'd', label: 'D', valueKind: 'choice', options: ['piros', 'zöld'], required: true },
      { name: 'e', label: 'E', valueKind: 'list', required: false },
      { name: 'f', label: 'F', valueKind: 'json', required: false },
    ];

    expect(isNodeConfig({ type: 'start', inputFields: fields, onUnhandledError: null })).toBe(true);
    expect(fields.map((field) => field.valueKind)).toHaveLength(6);
  });

  it('igazat ad a choice egyetlen elemű, szóközt tartalmazó, de nem üres opcióira', () => {
    const field: StartInputField = { name: 'd', label: 'D', valueKind: 'choice', options: ['két szó'], required: true };

    expect(isNodeConfig({ type: 'start', inputFields: [field], onUnhandledError: null })).toBe(true);
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
    ['start: inputFields nem tömb', { type: 'start', onUnhandledError: null, inputFields: {} }],
    ['start: mező nem rekord', { type: 'start', onUnhandledError: null, inputFields: ['topic'] }],
    [
      'start: name hiányzik',
      { type: 'start', onUnhandledError: null, inputFields: [{ label: 'T', valueKind: 'text', required: true }] },
    ],
    [
      'start: label rossz típusú',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 'topic', label: 7, valueKind: 'text', required: true }],
      },
    ],
    [
      'start: valueKind rossz típusú',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 'topic', label: 'T', valueKind: 7, required: true }],
      },
    ],
    [
      'start: valueKind ismeretlen érték (a régi szabad szöveg, SPEC-016 5.2)',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 'topic', label: 'T', valueKind: 'string', required: true }],
      },
    ],
    [
      'start: valueKind hiányzik',
      { type: 'start', inputFields: [{ name: 'topic', label: 'T', required: true }], onUnhandledError: null },
    ],
    [
      'start: choice options nélkül',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', required: true }],
      },
    ],
    [
      'start: choice options nem szövegtömb',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', options: [1], required: true }],
      },
    ],
    [
      'start: choice üres options lista',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', options: [], required: true }],
      },
    ],
    [
      'start: choice üres elem',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', options: ['a', ''], required: true }],
      },
    ],
    [
      'start: choice csak szóközös elem',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', options: ['a', ' '.repeat(3)], required: true }],
      },
    ],
    [
      'start: choice duplikált elem',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', options: ['a', 'b', 'a'], required: true }],
      },
    ],
    [
      'start: choice name rossz típusú',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 7, label: 'T', valueKind: 'choice', options: ['a'], required: true }],
      },
    ],
    [
      'start: a choice ág required mezője nem logikai',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 't', label: 'T', valueKind: 'choice', options: ['a'], required: 'igen' }],
      },
    ],
    [
      'start: required nem logikai',
      {
        type: 'start',
        onUnhandledError: null,
        inputFields: [{ name: 'topic', label: 'T', valueKind: 'text', required: 'igen' }],
      },
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
    [
      'join: választatlan mód onUnhandledError érvénytelen',
      { type: 'join', mode: null, onUnhandledError: 'unknown_policy' },
    ],
    ['join: script alobjektum hibás', { type: 'join', mode: 'script', settings: { source: 'a', runtime: 'js' } }],
    [
      'join: script source rossz típusú',
      { type: 'join', mode: 'script', settings: { source: 7, runtime: 'expression' } },
    ],
    ['join: ai_synthesis alobjektum hibás', { type: 'join', mode: 'ai_synthesis', settings: { promptTemplate: 7 } }],
    ['join: merge onUnhandledError érvénytelen', { type: 'join', mode: 'merge', onUnhandledError: 'unknown_policy' }],
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
    ['script: ismeretlen runtime', { type: 'script', source: 'a + b', runtime: 'python' }],
    ['script: javascript ág timeoutMs és cwd nélkül', { type: 'script', source: 'a', runtime: 'javascript' }],
    [
      'script: expression ág timeoutMs kulccsal',
      { type: 'script', source: 'a', runtime: 'expression', timeoutMs: null },
    ],
    ['script: expression ág cwd kulccsal', { type: 'script', source: 'a', runtime: 'expression', cwd: null }],
    ...[
      ['nulla', 0],
      ['negatív', -1],
      ['nem egész', 1.5],
      ['a felső határ fölötti', 2_147_483_648],
      ['szöveg', '1000'],
      ['hiányzó', undefined],
    ].flatMap(([description, timeoutMs]): readonly (readonly [string, unknown])[] => [
      [
        `script: javascript ág ${String(description)} timeoutMs`,
        {
          type: 'script',
          source: 'a',
          runtime: 'javascript',
          timeoutMs,
          cwd: null,
          memoryLimitMb: null,
          onUnhandledError: null,
        },
      ],
      [
        `join script: javascript ág ${String(description)} timeoutMs`,
        {
          type: 'join',
          mode: 'script',
          settings: { source: 'a', runtime: 'javascript', timeoutMs, cwd: null, memoryLimitMb: null },
          onUnhandledError: null,
        },
      ],
    ]),
    [
      'script: javascript ág szám cwd',
      {
        type: 'script',
        source: 'a',
        runtime: 'javascript',
        timeoutMs: null,
        cwd: 7,
        memoryLimitMb: null,
        onUnhandledError: null,
      },
    ],
    [
      'script: javascript ág hiányzó cwd',
      { type: 'script', source: 'a', runtime: 'javascript', timeoutMs: null, onUnhandledError: null },
    ],
    [
      'join script: javascript ág szám cwd',
      {
        type: 'join',
        mode: 'script',
        settings: { source: 'a', runtime: 'javascript', timeoutMs: null, cwd: 7, memoryLimitMb: null },
      },
    ],
    [
      'join script: ismeretlen runtime',
      { type: 'join', mode: 'script', settings: { source: 'a', runtime: 'python' }, onUnhandledError: null },
    ],
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

  // SPEC-011 5.2: minden ellenőrzött objektum zárt kulcslistájú. A tíz típus
  // (a `join` mind a négy ága) egy-egy érvényes példánya egyetlen ismeretlen
  // kulccsal bővítve elbukik; a beágyazott objektumok ugyanígy.
  const UNKNOWN_KEY = 'ismeretlenKulcs';

  for (const config of validConfigs) {
    const label = config.type === 'join' ? `join ${String(config.mode)}` : config.type;
    it(`hamisat ad, ha a(z) ${label} config gyökere ismeretlen kulcsot hordoz`, () => {
      expect(isNodeConfig({ ...config, [UNKNOWN_KEY]: true })).toBe(false);
    });
  }

  const nestedUnknownKeyCases: readonly (readonly [string, unknown])[] = [
    [
      'a start bemeneti mezője',
      {
        type: 'start',
        inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'text', required: true, [UNKNOWN_KEY]: true }],
        onUnhandledError: null,
      },
    ],
    [
      'a choice ágú start bemeneti mező',
      {
        type: 'start',
        inputFields: [
          { name: 'szin', label: 'Szín', valueKind: 'choice', options: ['piros'], required: true, [UNKNOWN_KEY]: true },
        ],
        onUnhandledError: null,
      },
    ],
    [
      'az options kulcs a nem choice ágon (text)',
      {
        type: 'start',
        inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'text', options: ['a'], required: true }],
        onUnhandledError: null,
      },
    ],
    [
      'a branch opciója',
      {
        type: 'branch',
        expression: 'x',
        branches: [{ key: 'high', label: 'Magas', [UNKNOWN_KEY]: true }],
        defaultBranchKey: null,
        onUnhandledError: null,
      },
    ],
    [
      'a join script módjának settings alobjektuma',
      {
        type: 'join',
        mode: 'script',
        settings: { source: 'a + b', runtime: 'expression', [UNKNOWN_KEY]: true },
        onUnhandledError: null,
      },
    ],
    [
      'a join script módjának javascript ágú settings alobjektuma',
      {
        type: 'join',
        mode: 'script',
        settings: {
          source: 'return 1;',
          runtime: 'javascript',
          timeoutMs: null,
          cwd: null,
          memoryLimitMb: null,
          [UNKNOWN_KEY]: true,
        },
        onUnhandledError: null,
      },
    ],
    [
      'a join script módjának expression ágú settings alobjektuma a javascript ág kulcsával',
      {
        type: 'join',
        mode: 'script',
        settings: { source: 'a + b', runtime: 'expression', timeoutMs: null },
        onUnhandledError: null,
      },
    ],
    [
      'a join ai_synthesis módjának settings alobjektuma',
      {
        type: 'join',
        mode: 'ai_synthesis',
        settings: { ...agentStepConfig, [UNKNOWN_KEY]: true },
        onUnhandledError: null,
      },
    ],
    [
      'a join ai_synthesis settings alobjektuma a node burkoló kulcsával',
      {
        type: 'join',
        mode: 'ai_synthesis',
        settings: { ...agentStepConfig, type: 'agent_step' },
        onUnhandledError: null,
      },
    ],
    ['a választatlan join settings kulccsal', { type: 'join', mode: null, settings: {}, onUnhandledError: null }],
    ['a join merge módja settings kulccsal', { type: 'join', mode: 'merge', settings: {}, onUnhandledError: null }],
  ];

  for (const [description, config] of nestedUnknownKeyCases) {
    it(`hamisat ad, ha ${description} ismeretlen kulcsot hordoz`, () => {
      expect(isNodeConfig(config)).toBe(false);
    });
  }

  it('igazat ad a javascript szkript timeoutMs határértékeire és a cwd szövegére (SPEC-014 5.3)', () => {
    for (const timeoutMs of [1, 2_147_483_647, null]) {
      expect(
        isNodeConfig({
          type: 'script',
          source: 'a',
          runtime: 'javascript',
          timeoutMs,
          cwd: 'munka',
          memoryLimitMb: null,
          onUnhandledError: null,
        }),
      ).toBe(true);
    }
  });

  describe('a javascript szkript memoryLimitMb mezője null vagy 16 ... 2048 közötti egész (SPEC-014 5.3)', () => {
    const builders: readonly (readonly [string, (memoryLimitMb: unknown) => unknown])[] = [
      [
        'script',
        (memoryLimitMb) => ({
          type: 'script',
          source: 'a',
          runtime: 'javascript',
          timeoutMs: null,
          cwd: null,
          memoryLimitMb,
          onUnhandledError: null,
        }),
      ],
      [
        'join script',
        (memoryLimitMb) => ({
          type: 'join',
          mode: 'script',
          settings: { source: 'a', runtime: 'javascript', timeoutMs: null, cwd: null, memoryLimitMb },
          onUnhandledError: null,
        }),
      ],
    ];

    for (const [label, build] of builders) {
      for (const memoryLimitMb of [null, 16, 17, 128, 2047, 2048]) {
        it(`${label}: a(z) ${String(memoryLimitMb)} érvényes`, () => {
          expect(isNodeConfig(build(memoryLimitMb))).toBe(true);
        });
      }

      for (const [description, memoryLimitMb] of [
        ['a tartomány alatti (15)', 15],
        ['nulla', 0],
        ['negatív', -16],
        ['a tartomány fölötti (2049)', 2049],
        ['nem egész', 16.5],
        ['szöveg', '128'],
        ['hiányzó', undefined],
      ] as const) {
        it(`${label}: ${description} érték érvénytelen`, () => {
          expect(isNodeConfig(build(memoryLimitMb))).toBe(false);
        });
      }
    }
  });

  it('a szabad mező kulcsai tetszőlegesek: a sub_workflow inputMapping', () => {
    expect(
      isNodeConfig({
        type: 'sub_workflow',
        targetWorkflowId: 'workflow-1',
        inputMapping: { [UNKNOWN_KEY]: 'input.a', 'tetszőleges név': 'input.b' },
        onUnhandledError: null,
      }),
    ).toBe(true);
  });
});
