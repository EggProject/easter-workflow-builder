/* eslint-disable unicorn/no-null -- a node config nullázható mezői a dróton ténylegesen `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import { NodeConfigSaveSchema } from './node-config-save-schema.ts';
import { NodeConfigSchema, type NodeConfig } from './node-config.ts';
import {
  ReplaceGraphRequestSchema,
  WorkflowGraphDocumentSchema,
  WorkflowNodeInputSchema,
  WorkflowNodeSchema,
} from '../workflow/workflow-graph-document.ts';

// A `JSON.parse` saját `__proto__` tulajdonságot hoz létre (egy objektum literál a prototípust állítaná).
const OWN_PROTO_KEY_1: unknown = JSON.parse('{"__proto__":{"envBindings":{},"authEnvName":null}}');
const OWN_PROTO_KEY_2: unknown = JSON.parse('{"github":{"envBindings":{"__proto__":"X"},"authEnvName":null}}');

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
  cwd: null,
  additionalDirectories: [],
  sandbox: null,
  sessionMode: 'isolated',
  structuredOutput: null,
};

interface RequiredFieldCase {
  readonly field: string;
  readonly path: readonly (string | number)[];
  readonly build: (text: string) => unknown;
}

/**
 * A SPEC-008 5.4 táblázatának tizenhat mezője, mezőnként egy egyébként
 * érvényes konfiggal, amiben csak a vizsgált mező szövege változik.
 */
const REQUIRED_FIELD_CASES: readonly RequiredFieldCase[] = [
  {
    field: 'start inputFields[].name',
    path: ['inputFields', 0, 'name'],
    build: (text) => ({
      type: 'start',
      inputFields: [{ name: text, label: 'Téma', valueKind: 'string', required: true }],
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'start inputFields[].label',
    path: ['inputFields', 0, 'label'],
    build: (text) => ({
      type: 'start',
      inputFields: [{ name: 'topic', label: text, valueKind: 'string', required: true }],
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'start inputFields[].valueKind',
    path: ['inputFields', 0, 'valueKind'],
    build: (text) => ({
      type: 'start',
      inputFields: [{ name: 'topic', label: 'Téma', valueKind: text, required: true }],
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'agent_step promptTemplate',
    path: ['promptTemplate'],
    build: (text) => ({
      ...VALID_AGENT_STEP_SETTINGS,
      promptTemplate: text,
      type: 'agent_step',
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'branch expression',
    path: ['expression'],
    build: (text) => ({
      type: 'branch',
      expression: text,
      branches: [{ key: 'pos', label: 'Pozitív' }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'branch branches[].key',
    path: ['branches', 0, 'key'],
    build: (text) => ({
      type: 'branch',
      expression: 'x > 0',
      branches: [{ key: text, label: 'Pozitív' }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'branch branches[].label',
    path: ['branches', 0, 'label'],
    build: (text) => ({
      type: 'branch',
      expression: 'x > 0',
      branches: [{ key: 'pos', label: text }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'fan_out itemsExpression',
    path: ['itemsExpression'],
    build: (text) => ({
      type: 'fan_out',
      itemsExpression: text,
      branchLabelTemplate: '{{item}}',
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'fan_out branchLabelTemplate',
    path: ['branchLabelTemplate'],
    build: (text) => ({
      type: 'fan_out',
      itemsExpression: 'items',
      branchLabelTemplate: text,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'join ai_synthesis settings.promptTemplate',
    path: ['settings', 'promptTemplate'],
    build: (text) => ({
      type: 'join',
      mode: 'ai_synthesis',
      settings: { ...VALID_AGENT_STEP_SETTINGS, promptTemplate: text },
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'join script settings.source',
    path: ['settings', 'source'],
    build: (text) => ({
      type: 'join',
      mode: 'script',
      settings: { source: text, runtime: 'expression' },
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'loop continueExpression',
    path: ['continueExpression'],
    build: (text) => ({ type: 'loop', maxIterations: 3, continueExpression: text, onUnhandledError: 'fail_run' }),
  },
  {
    field: 'human_approval title',
    path: ['title'],
    build: (text) => ({
      type: 'human_approval',
      title: text,
      bodyTemplate: 'Engedélyezed?',
      timeoutMs: null,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'human_approval bodyTemplate',
    path: ['bodyTemplate'],
    build: (text) => ({
      type: 'human_approval',
      title: 'Jóváhagyás',
      bodyTemplate: text,
      timeoutMs: null,
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'sub_workflow targetWorkflowId',
    path: ['targetWorkflowId'],
    build: (text) => ({ type: 'sub_workflow', targetWorkflowId: text, inputMapping: {}, onUnhandledError: 'fail_run' }),
  },
  {
    field: 'script source',
    path: ['source'],
    build: (text) => ({ type: 'script', source: text, runtime: 'expression', onUnhandledError: 'fail_run' }),
  },
];

function issuePaths(error: z.ZodError): readonly (readonly PropertyKey[])[] {
  return error.issues.map((issue) => issue.path);
}

function nodeWith(config: unknown): Readonly<Record<string, unknown>> {
  return { id: 'node-1', type: 'start', label: '', positionX: 0, positionY: 0, config };
}

function storedNodeWith(config: unknown): Readonly<Record<string, unknown>> {
  return { ...nodeWith(config), createdAtMs: 1, updatedAtMs: 2 };
}

describe('NodeConfigSaveSchema: a kötelező szöveg mezők (SPEC-008 5.4, O-21)', () => {
  it('a tizenhat mező mindegyike szerepel az esetek között', () => {
    expect(REQUIRED_FIELD_CASES).toHaveLength(16);
  });

  for (const { field, path, build } of REQUIRED_FIELD_CASES) {
    describe(field, () => {
      it('a nem üres érték átmegy', () => {
        expect(NodeConfigSaveSchema.safeParse(build('érték')).success).toBe(true);
      });

      for (const [description, blank] of [
        ['üres', ''],
        ['csak szóközös', ' '.repeat(3)],
      ] as const) {
        it(`az ${description} érték elbukik, a hiba a mező útvonalán áll, és üzenete nem tartalmazza az értéket`, () => {
          const parsed = NodeConfigSaveSchema.safeParse(build(blank));

          expect(parsed.success).toBe(false);
          if (parsed.success) {
            return;
          }
          expect(issuePaths(parsed.error)).toEqual([path]);
          expect(parsed.error.issues[0]?.message).toBe('A mező nem lehet üres.');
        });

        it(`a WorkflowNodeInputSchema és a ReplaceGraphRequestSchema az ${description} értéket a teljes útvonalon utasítja el`, () => {
          const node = WorkflowNodeInputSchema.safeParse(nodeWith(build(blank)));
          const request = ReplaceGraphRequestSchema.safeParse({ nodes: [nodeWith(build(blank))], edges: [] });

          expect(node.success).toBe(false);
          expect(request.success).toBe(false);
          if (node.success || request.success) {
            return;
          }
          expect(issuePaths(node.error)).toEqual([['config', ...path]]);
          expect(issuePaths(request.error)).toEqual([['nodes', 0, 'config', ...path]]);
        });

        it(`az olvasó NodeConfigSchema, WorkflowNodeSchema és WorkflowGraphDocumentSchema az ${description} értéket elfogadja`, () => {
          const config = build(blank);
          const storedNode = storedNodeWith(config);

          expect(NodeConfigSchema.safeParse(config).success).toBe(true);
          expect(WorkflowNodeSchema.safeParse(storedNode).success).toBe(true);
          expect(WorkflowGraphDocumentSchema.safeParse({ nodes: [storedNode], edges: [] }).success).toBe(true);
        });
      }
    });
  }

  it('egy lista több üres eleme mind külön hibát ad, a saját indexével', () => {
    const parsed = NodeConfigSaveSchema.safeParse({
      type: 'branch',
      expression: 'x > 0',
      branches: [
        { key: 'pos', label: '' },
        { key: '', label: 'Negatív' },
      ],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([
      ['branches', 1, 'key'],
      ['branches', 0, 'label'],
    ]);
  });

  it('a join merge módnak nincs kötelező szöveg mezője', () => {
    const config = {
      type: 'join',
      mode: 'merge',
      onUnhandledError: 'fail_run',
    };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });

  it('a nullázható szöveg mező üres értéke nem kötelező mező (agent_step cwd)', () => {
    const config = { ...VALID_AGENT_STEP_SETTINGS, cwd: '', type: 'agent_step', onUnhandledError: 'fail_run' };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });

  it('az error_handler típusnak nincs kötelező szöveg mezője', () => {
    const config = {
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [1000],
      handledErrorKinds: [''],
      onUnhandledError: 'fail_run',
    };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });

  it('a kimeneti típus ugyanaz, mint az olvasó sémáé', () => {
    expectTypeOf<z.infer<typeof NodeConfigSaveSchema>>().toEqualTypeOf<NodeConfig>();
  });
});

/**
 * Típusonként (a `join` minden kiválasztott módjával) egy egyébként
 * mentésre kész konfig: csak az `onUnhandledError` értéke változik.
 */
const SAVABLE_CONFIG_BY_VARIANT: readonly {
  readonly variant: string;
  readonly config: Readonly<Record<string, unknown>>;
}[] = [
  {
    variant: 'start',
    config: { type: 'start', inputFields: [{ name: 'topic', label: 'Téma', valueKind: 'string', required: true }] },
  },
  { variant: 'agent_step', config: { ...VALID_AGENT_STEP_SETTINGS, type: 'agent_step' } },
  {
    variant: 'branch',
    config: {
      type: 'branch',
      expression: 'x > 0',
      branches: [{ key: 'pos', label: 'Pozitív' }],
      defaultBranchKey: null,
    },
  },
  { variant: 'fan_out', config: { type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: '{{item}}' } },
  { variant: 'join merge', config: { type: 'join', mode: 'merge' } },
  {
    variant: 'join script',
    config: { type: 'join', mode: 'script', settings: { source: 'x', runtime: 'expression' } },
  },
  { variant: 'join ai_synthesis', config: { type: 'join', mode: 'ai_synthesis', settings: VALID_AGENT_STEP_SETTINGS } },
  { variant: 'loop', config: { type: 'loop', maxIterations: 3, continueExpression: 'i < 3' } },
  {
    variant: 'human_approval',
    config: { type: 'human_approval', title: 'Jóváhagyás', bodyTemplate: 'Engedélyezed?', timeoutMs: null },
  },
  {
    variant: 'error_handler',
    config: { type: 'error_handler', maxAttempts: 3, backoffMs: [1000], handledErrorKinds: [] },
  },
  { variant: 'sub_workflow', config: { type: 'sub_workflow', targetWorkflowId: 'wf-1', inputMapping: {} } },
  { variant: 'script', config: { type: 'script', source: 'x + 1', runtime: 'expression' } },
];

describe('NodeConfigSaveSchema: az onUnhandledError nem lehet null (SPEC-008 5.4, O-29)', () => {
  it('mind a tíz típus szerepel az esetek között', () => {
    expect(new Set(SAVABLE_CONFIG_BY_VARIANT.map(({ config }) => config['type'])).size).toBe(10);
  });

  for (const { variant, config } of SAVABLE_CONFIG_BY_VARIANT) {
    describe(variant, () => {
      it('a null érték elbukik, a hiba a mező útvonalán áll', () => {
        const parsed = NodeConfigSaveSchema.safeParse({ ...config, onUnhandledError: null });

        expect(parsed.success).toBe(false);
        if (parsed.success) {
          return;
        }
        expect(issuePaths(parsed.error)).toEqual([['onUnhandledError']]);
        expect(parsed.error.issues[0]?.message).toBe('A mező nem lehet üres.');
      });

      it('a WorkflowNodeInputSchema és a ReplaceGraphRequestSchema a null értéket a teljes útvonalon utasítja el', () => {
        const blankNode = nodeWith({ ...config, onUnhandledError: null });
        const node = WorkflowNodeInputSchema.safeParse(blankNode);
        const request = ReplaceGraphRequestSchema.safeParse({ nodes: [blankNode], edges: [] });

        expect(node.success).toBe(false);
        expect(request.success).toBe(false);
        if (node.success || request.success) {
          return;
        }
        expect(issuePaths(node.error)).toEqual([['config', 'onUnhandledError']]);
        expect(issuePaths(request.error)).toEqual([['nodes', 0, 'config', 'onUnhandledError']]);
      });

      for (const policy of ['fail_run', 'fail_branch'] as const) {
        it(`a(z) ${policy} érték átmegy`, () => {
          expect(NodeConfigSaveSchema.safeParse({ ...config, onUnhandledError: policy }).success).toBe(true);
        });
      }

      it('az olvasó NodeConfigSchema, WorkflowNodeSchema és WorkflowGraphDocumentSchema a null értéket elfogadja', () => {
        const stored = { ...config, onUnhandledError: null };
        const storedNode = storedNodeWith(stored);

        expect(NodeConfigSchema.safeParse(stored).success).toBe(true);
        expect(WorkflowNodeSchema.safeParse(storedNode).success).toBe(true);
        expect(WorkflowGraphDocumentSchema.safeParse({ nodes: [storedNode], edges: [] }).success).toBe(true);
      });
    });
  }

  it('az üres kötelező szöveg mező és a null onUnhandledError együtt két külön hibát ad', () => {
    const parsed = NodeConfigSaveSchema.safeParse({
      type: 'loop',
      maxIterations: 3,
      continueExpression: '',
      onUnhandledError: null,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['continueExpression'], ['onUnhandledError']]);
  });
});

describe('NodeConfigSaveSchema: a join mode nem lehet null (SPEC-008 5.4, O-33)', () => {
  const unselectedJoin = { type: 'join', mode: null, onUnhandledError: 'fail_run' } as const;

  it('a választatlan join elbukik, a hiba a mode útvonalán áll', () => {
    const parsed = NodeConfigSaveSchema.safeParse(unselectedJoin);

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['mode']]);
    expect(parsed.error.issues[0]?.message).toBe('A mező nem lehet üres.');
  });

  it('a WorkflowNodeInputSchema és a ReplaceGraphRequestSchema a teljes útvonalon utasítja el', () => {
    const node = WorkflowNodeInputSchema.safeParse(nodeWith(unselectedJoin));
    const request = ReplaceGraphRequestSchema.safeParse({ nodes: [nodeWith(unselectedJoin)], edges: [] });

    expect(node.success).toBe(false);
    expect(request.success).toBe(false);
    if (node.success || request.success) {
      return;
    }
    expect(issuePaths(node.error)).toEqual([['config', 'mode']]);
    expect(issuePaths(request.error)).toEqual([['nodes', 0, 'config', 'mode']]);
  });

  it('null onUnhandledError mellett mindkét mező külön hibát ad', () => {
    const parsed = NodeConfigSaveSchema.safeParse({ ...unselectedJoin, onUnhandledError: null });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['onUnhandledError'], ['mode']]);
  });

  it('az olvasó NodeConfigSchema, WorkflowNodeSchema és WorkflowGraphDocumentSchema elfogadja', () => {
    const storedNode = storedNodeWith(unselectedJoin);

    expect(NodeConfigSchema.safeParse(unselectedJoin).success).toBe(true);
    expect(WorkflowNodeSchema.safeParse(storedNode).success).toBe(true);
    expect(WorkflowGraphDocumentSchema.safeParse({ nodes: [storedNode], edges: [] }).success).toBe(true);
  });
});

interface MalformedConfigCase {
  readonly description: string;
  readonly config: unknown;
  readonly issues: readonly (readonly [code: string, path: string])[];
}

/**
 * A típushibás konfig esetei (user döntés 2026-10-16, "Egyszerre látsszon
 * mind", SPEC-008 81. kritérium): ha a diszkriminált unió ágat választott, a
 * három szabály a típushiba mellett is lefut, és minden hiba egy
 * kísérletben, a saját mezőútvonalán jelenik meg; ha nem választott, csak a
 * séma saját hibája áll.
 */
const MALFORMED_CONFIG_CASES: readonly MalformedConfigCase[] = [
  {
    description: 'a felvett loop (NaN maxIterations, üres continueExpression, null onUnhandledError)',
    config: { type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null },
    issues: [
      ['invalid_type', 'maxIterations'],
      ['custom', 'continueExpression'],
      ['custom', 'onUnhandledError'],
    ],
  },
  {
    description: 'a felvett error_handler (NaN maxAttempts, null onUnhandledError)',
    config: {
      type: 'error_handler',
      maxAttempts: NaN,
      backoffMs: [],
      handledErrorKinds: [],
      onUnhandledError: null,
    },
    issues: [
      ['invalid_type', 'maxAttempts'],
      ['custom', 'onUnhandledError'],
    ],
  },
  {
    description: 'a dróton érkező loop (a JSON a NaN értéket null-ként írja)',
    config: { type: 'loop', maxIterations: null, continueExpression: '  ', onUnhandledError: null },
    issues: [
      ['invalid_type', 'maxIterations'],
      ['custom', 'continueExpression'],
      ['custom', 'onUnhandledError'],
    ],
  },
  {
    description: 'a hiányzó mező és az ismeretlen kulcs mellett is',
    config: { type: 'loop', continueExpression: '', onUnhandledError: 'fail_run', extra: true },
    issues: [
      ['invalid_type', 'maxIterations'],
      ['unrecognized_keys', ''],
      ['custom', 'continueExpression'],
    ],
  },
  {
    description: 'a választatlan join érvénytelen onUnhandledError értékkel',
    config: { type: 'join', mode: null, onUnhandledError: 'ismeretlen' },
    issues: [
      ['invalid_value', 'onUnhandledError'],
      ['custom', 'mode'],
    ],
  },
  {
    description: 'a választott módú join érvénytelen settings mezővel',
    config: { type: 'join', mode: 'script', settings: { source: '', runtime: 'ismeretlen' }, onUnhandledError: null },
    issues: [
      ['invalid_value', 'settings.runtime'],
      ['custom', 'settings.source'],
      ['custom', 'onUnhandledError'],
    ],
  },
  {
    description: 'a típushibás kötelező szöveg mező nem kap második, üres mező hibát',
    config: { type: 'loop', maxIterations: NaN, continueExpression: 5, onUnhandledError: 'fail_run' },
    issues: [
      ['invalid_type', 'maxIterations'],
      ['invalid_type', 'continueExpression'],
    ],
  },
  {
    description: 'nem objektum bemenet: csak a séma hibája',
    config: 'loop',
    issues: [['invalid_type', '']],
  },
  {
    description: 'null bemenet: csak a séma hibája',
    config: null,
    issues: [['invalid_type', '']],
  },
  {
    description: 'ismeretlen type: csak a séma hibája, a null onUnhandledError nem jelez',
    config: { type: 'ismeretlen', continueExpression: '', onUnhandledError: null },
    issues: [['invalid_union', 'type']],
  },
  {
    description: 'nem szöveg type: csak a séma hibája',
    config: { type: 5, onUnhandledError: null },
    issues: [['invalid_union', 'type']],
  },
  {
    description: 'a join ismeretlen móddal: csak a séma hibája, a null onUnhandledError nem jelez',
    config: { type: 'join', mode: 'ismeretlen', onUnhandledError: null },
    issues: [['invalid_union', 'mode']],
  },
  {
    description: 'a join nem szöveg móddal: csak a séma hibája',
    config: { type: 'join', mode: 5, onUnhandledError: null },
    issues: [['invalid_union', 'mode']],
  },
];

describe('NodeConfigSaveSchema: a szabályok a típushiba mellett is lefutnak (SPEC-008 81. kritérium)', () => {
  for (const { description, config, issues } of MALFORMED_CONFIG_CASES) {
    it(description, () => {
      const parsed = NodeConfigSaveSchema.safeParse(config);

      expect(parsed.success).toBe(false);
      if (parsed.success) {
        return;
      }
      expect(parsed.error.issues.map((issue) => [issue.code, issue.path.join('.')])).toEqual(issues);
    });
  }

  it('a felvett loop minden hibája a ReplaceGraphRequestSchema teljes útvonalán áll', () => {
    const request = ReplaceGraphRequestSchema.safeParse({
      nodes: [nodeWith({ type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null })],
      edges: [],
    });

    expect(request.success).toBe(false);
    if (request.success) {
      return;
    }
    expect(issuePaths(request.error)).toEqual([
      ['nodes', 0, 'config', 'maxIterations'],
      ['nodes', 0, 'config', 'continueExpression'],
      ['nodes', 0, 'config', 'onUnhandledError'],
    ]);
  });

  it('az olvasó NodeConfigSchema típushibánál csak a saját hibáját adja', () => {
    const parsed = NodeConfigSchema.safeParse({
      type: 'loop',
      maxIterations: NaN,
      continueExpression: '',
      onUnhandledError: null,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['maxIterations']]);
  });
});

const NOT_POSITIVE_INTEGER_MESSAGE = 'A mező értéke nem pozitív egész szám.';

interface PositiveIntegerFieldCase {
  readonly field: string;
  readonly path: readonly (string | number)[];
  readonly build: (value: number) => unknown;
}

/**
 * A három pozitív egész szám mező (SPEC-008 5.4, O-37), mezőnként egy
 * egyébként mentésre kész konfiggal; a `backoffMs` lista minden helyén
 * külön eset, hogy a szabály minden elemre igazolt legyen.
 */
const POSITIVE_INTEGER_FIELD_CASES: readonly PositiveIntegerFieldCase[] = [
  {
    field: 'loop maxIterations',
    path: ['maxIterations'],
    build: (value) => ({
      type: 'loop',
      maxIterations: value,
      continueExpression: 'i < 3',
      onUnhandledError: 'fail_run',
    }),
  },
  {
    field: 'error_handler maxAttempts',
    path: ['maxAttempts'],
    build: (value) => ({
      type: 'error_handler',
      maxAttempts: value,
      backoffMs: [100, 200, 400],
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    }),
  },
  ...[0, 1, 2].map((index): PositiveIntegerFieldCase => ({
    field: `error_handler backoffMs[${String(index)}]`,
    path: ['backoffMs', index],
    build: (value) => ({
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [100, 200, 400].map((delay, position) => (position === index ? value : delay)),
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    }),
  })),
];

describe('NodeConfigSaveSchema: a szám mezők pozitív egészek (SPEC-008 5.4, O-37)', () => {
  for (const { field, path, build } of POSITIVE_INTEGER_FIELD_CASES) {
    describe(field, () => {
      for (const value of [1, 7]) {
        it(`a(z) ${String(value)} pozitív egész átmegy`, () => {
          expect(NodeConfigSaveSchema.safeParse(build(value)).success).toBe(true);
        });
      }

      for (const [description, value] of [
        ['nulla', 0],
        ['negatív', -3],
        ['nem egész', 1.5],
      ] as const) {
        it(`a ${description} érték (${String(value)}) elbukik, a hiba a mező útvonalán áll`, () => {
          const parsed = NodeConfigSaveSchema.safeParse(build(value));

          expect(parsed.success).toBe(false);
          if (parsed.success) {
            return;
          }
          expect(issuePaths(parsed.error)).toEqual([path]);
          expect(parsed.error.issues[0]?.message).toBe(NOT_POSITIVE_INTEGER_MESSAGE);
        });

        it(`a WorkflowNodeInputSchema és a ReplaceGraphRequestSchema a ${description} értéket a teljes útvonalon utasítja el`, () => {
          const node = WorkflowNodeInputSchema.safeParse(nodeWith(build(value)));
          const request = ReplaceGraphRequestSchema.safeParse({ nodes: [nodeWith(build(value))], edges: [] });

          expect(node.success).toBe(false);
          expect(request.success).toBe(false);
          if (node.success || request.success) {
            return;
          }
          expect(issuePaths(node.error)).toEqual([['config', ...path]]);
          expect(issuePaths(request.error)).toEqual([['nodes', 0, 'config', ...path]]);
        });

        it(`az olvasó NodeConfigSchema, WorkflowNodeSchema és WorkflowGraphDocumentSchema a ${description} értéket elfogadja`, () => {
          const config = build(value);
          const storedNode = storedNodeWith(config);

          expect(NodeConfigSchema.safeParse(config).success).toBe(true);
          expect(WorkflowNodeSchema.safeParse(storedNode).success).toBe(true);
          expect(WorkflowGraphDocumentSchema.safeParse({ nodes: [storedNode], edges: [] }).success).toBe(true);
        });
      }
    });
  }

  it('a backoffMs több hibás eleme mind külön hibát ad, a saját indexével', () => {
    const parsed = NodeConfigSaveSchema.safeParse({
      type: 'error_handler',
      maxAttempts: 0,
      backoffMs: [100, 0, -3, 1.5],
      handledErrorKinds: [],
      onUnhandledError: 'fail_run',
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['maxAttempts'], ['backoffMs', 1], ['backoffMs', 2], ['backoffMs', 3]]);
  });

  it('a nem pozitív egész szám a többi szabály hibája mellett is jelez, egy kísérletben', () => {
    const parsed = NodeConfigSaveSchema.safeParse({
      type: 'loop',
      maxIterations: 0,
      continueExpression: '',
      onUnhandledError: null,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['continueExpression'], ['onUnhandledError'], ['maxIterations']]);
  });

  it('a más típusú szám mező nem tartozik a szabály alá (human_approval timeoutMs)', () => {
    const config = {
      type: 'human_approval',
      title: 'Jóváhagyás',
      bodyTemplate: 'Engedélyezed?',
      timeoutMs: 0,
      onUnhandledError: 'fail_run',
    };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });
});

function agentStepWithReferences(mcpServerReferences: unknown): unknown {
  return { type: 'agent_step', ...VALID_AGENT_STEP_SETTINGS, mcpServerReferences, onUnhandledError: 'fail_run' };
}

function aiSynthesisWithReferences(mcpServerReferences: unknown): unknown {
  return {
    type: 'join',
    mode: 'ai_synthesis',
    settings: { ...VALID_AGENT_STEP_SETTINGS, mcpServerReferences },
    onUnhandledError: 'fail_run',
  };
}

describe('NodeConfigSaveSchema: az MCP hivatkozás szerver oldali nevei env változó nevek (SPEC-009 6.1, T-012-27)', () => {
  const INVALID = { github: { envBindings: { GITHUB_TOKEN: 'ghp-titok' }, authEnvName: '' } };

  it('az érvényes nevek átmennek', () => {
    const valid = { github: { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, authEnvName: 'AUTH' } };

    expect(NodeConfigSaveSchema.safeParse(agentStepWithReferences(valid)).success).toBe(true);
    expect(NodeConfigSaveSchema.safeParse(aiSynthesisWithReferences(valid)).success).toBe(true);
  });

  it('a név alakon kívüli envBindings érték és authEnvName elbukik, a mező útvonalán, az érték nélkül', () => {
    const parsed = NodeConfigSaveSchema.safeParse(agentStepWithReferences(INVALID));

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.path)).toStrictEqual([
      ['mcpServerReferences', 'github', 'envBindings', 'GITHUB_TOKEN'],
      ['mcpServerReferences', 'github', 'authEnvName'],
    ]);
    expect(parsed.error?.issues.map((issue) => issue.message).join(' ')).not.toContain('ghp-titok');
  });

  it('a join ai_synthesis settings mezőjében is, a settings útvonalán', () => {
    const parsed = NodeConfigSaveSchema.safeParse(aiSynthesisWithReferences(INVALID));

    expect(parsed.error?.issues.map((issue) => issue.path)).toStrictEqual([
      ['settings', 'mcpServerReferences', 'github', 'envBindings', 'GITHUB_TOKEN'],
      ['settings', 'mcpServerReferences', 'github', 'authEnvName'],
    ]);
  });

  it('az olvasó NodeConfigSchema a név alakon kívüli értéket elfogadja (a pillanatkép olvasható marad)', () => {
    expect(NodeConfigSchema.safeParse(agentStepWithReferences(INVALID)).success).toBe(true);
  });

  it('a saját __proto__ kulcs a hivatkozás rekordban és az envBindings rekordban mindkét sémán elbukik', () => {
    for (const references of [OWN_PROTO_KEY_1, OWN_PROTO_KEY_2]) {
      expect(NodeConfigSchema.safeParse(agentStepWithReferences(references)).success).toBe(false);
      expect(NodeConfigSaveSchema.safeParse(agentStepWithReferences(references)).success).toBe(false);
    }
  });
});
