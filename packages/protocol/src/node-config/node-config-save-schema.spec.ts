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
      onUnhandledError: null,
    }),
  },
  {
    field: 'start inputFields[].label',
    path: ['inputFields', 0, 'label'],
    build: (text) => ({
      type: 'start',
      inputFields: [{ name: 'topic', label: text, valueKind: 'string', required: true }],
      onUnhandledError: null,
    }),
  },
  {
    field: 'start inputFields[].valueKind',
    path: ['inputFields', 0, 'valueKind'],
    build: (text) => ({
      type: 'start',
      inputFields: [{ name: 'topic', label: 'Téma', valueKind: text, required: true }],
      onUnhandledError: null,
    }),
  },
  {
    field: 'agent_step promptTemplate',
    path: ['promptTemplate'],
    build: (text) => ({
      ...VALID_AGENT_STEP_SETTINGS,
      promptTemplate: text,
      type: 'agent_step',
      onUnhandledError: null,
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
      onUnhandledError: null,
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
      onUnhandledError: null,
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
      onUnhandledError: null,
    }),
  },
  {
    field: 'fan_out itemsExpression',
    path: ['itemsExpression'],
    build: (text) => ({
      type: 'fan_out',
      itemsExpression: text,
      branchLabelTemplate: '{{item}}',
      onUnhandledError: null,
    }),
  },
  {
    field: 'fan_out branchLabelTemplate',
    path: ['branchLabelTemplate'],
    build: (text) => ({ type: 'fan_out', itemsExpression: 'items', branchLabelTemplate: text, onUnhandledError: null }),
  },
  {
    field: 'join ai_synthesis settings.promptTemplate',
    path: ['settings', 'promptTemplate'],
    build: (text) => ({
      type: 'join',
      mode: 'ai_synthesis',
      settings: { ...VALID_AGENT_STEP_SETTINGS, promptTemplate: text },
      onUnhandledError: null,
    }),
  },
  {
    field: 'join script settings.source',
    path: ['settings', 'source'],
    build: (text) => ({
      type: 'join',
      mode: 'script',
      settings: { source: text, runtime: 'expression' },
      onUnhandledError: null,
    }),
  },
  {
    field: 'loop continueExpression',
    path: ['continueExpression'],
    build: (text) => ({ type: 'loop', maxIterations: 3, continueExpression: text, onUnhandledError: null }),
  },
  {
    field: 'human_approval title',
    path: ['title'],
    build: (text) => ({
      type: 'human_approval',
      title: text,
      bodyTemplate: 'Engedélyezed?',
      timeoutMs: null,
      onUnhandledError: null,
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
      onUnhandledError: null,
    }),
  },
  {
    field: 'sub_workflow targetWorkflowId',
    path: ['targetWorkflowId'],
    build: (text) => ({ type: 'sub_workflow', targetWorkflowId: text, inputMapping: {}, onUnhandledError: null }),
  },
  {
    field: 'script source',
    path: ['source'],
    build: (text) => ({ type: 'script', source: text, runtime: 'expression', onUnhandledError: null }),
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
      onUnhandledError: null,
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

  it('a join merge mód nyitott settings rekordjának üres szövege nem kötelező mező', () => {
    const config = {
      type: 'join',
      mode: 'merge',
      settings: { source: '', promptTemplate: '' },
      onUnhandledError: null,
    };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });

  it('a nullázható szöveg mező üres értéke nem kötelező mező (agent_step cwd)', () => {
    const config = { ...VALID_AGENT_STEP_SETTINGS, cwd: '', type: 'agent_step', onUnhandledError: null };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });

  it('az error_handler típusnak nincs kötelező szöveg mezője', () => {
    const config = {
      type: 'error_handler',
      maxAttempts: 3,
      backoffMs: [1000],
      handledErrorKinds: [''],
      onUnhandledError: null,
    };

    expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
  });

  it('alak hibánál a kötelező mező szabály nem fut, csak a séma saját hibája áll', () => {
    const parsed = NodeConfigSaveSchema.safeParse({ type: 'loop', continueExpression: '', onUnhandledError: null });

    expect(parsed.success).toBe(false);
    if (parsed.success) {
      return;
    }
    expect(issuePaths(parsed.error)).toEqual([['maxIterations']]);
  });

  it('a kimeneti típus ugyanaz, mint az olvasó sémáé', () => {
    expectTypeOf<z.infer<typeof NodeConfigSaveSchema>>().toEqualTypeOf<NodeConfig>();
  });
});
