/* eslint-disable unicorn/no-null -- a szintetikus WorkflowNodeInput fixture-ök nullázható mezői a dróton ténylegesen `null` értéket hordoznak */
import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { validateGraphForSave } from './validate-graph-for-save.ts';

const START_NODE: WorkflowNodeInput = {
  id: 'n-1',
  type: 'start',
  label: 'Indítás',
  positionX: 0,
  positionY: 0,
  config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
};

describe('validateGraphForSave', () => {
  it('érvényes gráfra ok Outcome-ot ad, a ReplaceGraphRequestSchema szerint felparszolt törzzsel', () => {
    const outcome = validateGraphForSave([START_NODE], []);
    expect(outcome).toEqual({ kind: 'ok', value: { nodes: [START_NODE], edges: [] } });
  });

  it(
    'hibás node mezőre (NaN egy number mezőn - saját méréssel igazolt zod@4.4.3 elutasítja) ' +
      'error Outcome-ot ad, ami megnevezi a hibás mező útvonalát',
    () => {
      // A `maxIterations` típusa `number`, a JavaScript `NaN` érték is `number`
      // típusú, tehát ez a fixture típushelyesen fordul (nincs `as`), de a
      // `z.number()` futásidejűleg elutasítja (saját méréssel igazolt zod@4.4.3
      // viselkedés: `z.number().safeParse(NaN).success === false`) - pontosan
      // az az eset, amikor a `node-inspector` (T-009-18) egy számmezőt üresen
      // hagyva `Number('')` -> `NaN` értéket termelne.
      const loopNode: WorkflowNodeInput = {
        id: 'n-2',
        type: 'loop',
        label: 'Ciklus',
        positionX: 0,
        positionY: 0,
        config: {
          type: 'loop',
          maxIterations: Number('nem szám'),
          continueExpression: 'i < 5',
          onUnhandledError: null,
        },
      };
      const outcome = validateGraphForSave([START_NODE, loopNode], []);
      expect(outcome.kind).toBe('error');
      if (outcome.kind === 'error') {
        expect(outcome.message).toContain('maxIterations');
      }
    },
  );

  it('a felvett ciklus kezdő konfigjára egy hívásban minden hibás mező útvonalát megnevezi (SPEC-008 81. kritérium)', () => {
    const loopNode: WorkflowNodeInput = {
      id: 'n-2',
      type: 'loop',
      label: '',
      positionX: 0,
      positionY: 0,
      config: { type: 'loop', maxIterations: NaN, continueExpression: '', onUnhandledError: null },
    };
    expect(validateGraphForSave([START_NODE, loopNode], [])).toEqual({
      kind: 'error',
      message:
        'A kérés törzse érvénytelen, hibás mező(k): nodes.1.config.maxIterations, ' +
        'nodes.1.config.continueExpression, nodes.1.config.onUnhandledError (invalid_request).',
    });
  });

  it('null onUnhandledError értékre error Outcome-ot ad, ami megnevezi a mező útvonalát (SPEC-008 5.4, O-29)', () => {
    const outcome = validateGraphForSave(
      [{ ...START_NODE, config: { ...START_NODE.config, onUnhandledError: null } }],
      [],
    );
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('nodes.0.config.onUnhandledError');
    }
  });

  it('választatlan join módra error Outcome-ot ad, ami megnevezi a mező útvonalát (SPEC-008 5.4, O-33)', () => {
    const joinNode: WorkflowNodeInput = {
      id: 'n-3',
      type: 'join',
      label: 'Összefésülés',
      positionX: 0,
      positionY: 0,
      config: { type: 'join', mode: null, onUnhandledError: 'fail_run' },
    };
    const outcome = validateGraphForSave([START_NODE, joinNode], []);
    expect(outcome.kind).toBe('error');
    if (outcome.kind === 'error') {
      expect(outcome.message).toContain('nodes.1.config.mode');
    }
  });

  it('hibás él mezőre (ismeretlen kulcs a strictObject sémán) error Outcome-ot ad', () => {
    const edgeWithExtraField = {
      id: 'e-1',
      sourceNodeId: 'n-1',
      targetNodeId: 'n-2',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
      unknownField: 'x',
    };
    const outcome = validateGraphForSave([START_NODE], [edgeWithExtraField]);
    expect(outcome.kind).toBe('error');
    // Az ismeretlen kulcs a strictObject saját hibája, az útvonala az él maga
    // (AC13, mérve 2026-10-18): az üzenet megnevezi, melyik él hibás.
    expect(outcome).toEqual({
      kind: 'error',
      message: 'A kérés törzse érvénytelen, hibás mező(k): edges.0 (invalid_request).',
    });
  });

  it('két azonos azonosítójú élre az üzenet a második él id mezőjét nevezi meg (AC13)', () => {
    const edge = {
      id: 'e-1',
      sourceNodeId: 'n-1',
      targetNodeId: 'n-2',
      sourceHandle: null,
      targetHandle: null,
      branchKey: null,
    };
    const outcome = validateGraphForSave([START_NODE], [edge, { ...edge, targetNodeId: 'n-3' }]);
    expect(outcome).toEqual({
      kind: 'error',
      message: 'A kérés törzse érvénytelen, hibás mező(k): edges.1.id (invalid_request).',
    });
  });

  it('nem pozitív egész szám mezőre error Outcome-ot ad, ami megnevezi a mező útvonalát (SPEC-008 5.4, O-37)', () => {
    const errorHandlerNode: WorkflowNodeInput = {
      id: 'n-4',
      type: 'error_handler',
      label: 'Hibakezelő',
      positionX: 0,
      positionY: 0,
      config: {
        type: 'error_handler',
        maxAttempts: 0,
        backoffMs: [100, -3, 1.5],
        handledErrorKinds: [],
        onUnhandledError: 'fail_run',
      },
    };
    expect(validateGraphForSave([START_NODE, errorHandlerNode], [])).toEqual({
      kind: 'error',
      message:
        'A kérés törzse érvénytelen, hibás mező(k): nodes.1.config.maxAttempts, ' +
        'nodes.1.config.backoffMs.1, nodes.1.config.backoffMs.2 (invalid_request).',
    });
  });

  describe('az agents bejegyzés kötelező mezői (SPEC-008 5.4, O-38)', () => {
    const AGENT_STEP_SETTINGS = {
      promptTemplate: 'sablon',
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
      sessionMode: 'isolated' as const,
      structuredOutput: null,
    };

    function agentNodeWith(agents: Readonly<Record<string, unknown>>, promptTemplate = 'sablon'): WorkflowNodeInput {
      return {
        id: 'n-agent',
        type: 'agent_step',
        label: 'Agent',
        positionX: 0,
        positionY: 0,
        config: { ...AGENT_STEP_SETTINGS, promptTemplate, agents, type: 'agent_step', onUnhandledError: 'fail_run' },
      };
    }

    it('az "Agent hozzáadása" által felvett üres bejegyzés a mentést megállítja, és mindkét mező útvonalát megnevezi', () => {
      expect(validateGraphForSave([START_NODE, agentNodeWith({ uj: { description: '', prompt: '' } })], [])).toEqual({
        kind: 'error',
        message:
          'A kérés törzse érvénytelen, hibás mező(k): nodes.1.config.agents.uj.description, ' +
          'nodes.1.config.agents.uj.prompt (invalid_request).',
      });
    });

    it('a séma hibái után az agents mezők útvonalát is megnevezi, egy üzenetben', () => {
      expect(
        validateGraphForSave([START_NODE, agentNodeWith({ uj: { description: 'Új', prompt: ' ' } }, '')], []),
      ).toEqual({
        kind: 'error',
        message:
          'A kérés törzse érvénytelen, hibás mező(k): nodes.1.config.promptTemplate, ' +
          'nodes.1.config.agents.uj.prompt (invalid_request).',
      });
    });

    it('kitöltött bejegyzéssel a mentés átmegy', () => {
      const agentNode = agentNodeWith({ uj: { description: 'Új', prompt: 'Dolgozz.' } });
      expect(validateGraphForSave([START_NODE, agentNode], [])).toEqual({
        kind: 'ok',
        value: { nodes: [START_NODE, agentNode], edges: [] },
      });
    });
  });
});
