/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';
import { validateLanguageFields } from './validate-language-fields.ts';

function agentStepConfig(promptTemplate: string): AgentStepConfig {
  return {
    promptTemplate,
    providerId: null,
    modelId: 'modell-1',
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
}

/**
 * Mind a tíz végrehajtható node típus, a `join` mindhárom módjával, a szkript
 * mindkét nyelvével. A vizsgált mezők szövege egyedi, hogy a teszt lássa,
 * melyik port kapta meg; a JavaScript forrás egyik portra sem jut (SPEC-014
 * 5.7, `validate-script-sources.ts`).
 */
function allConfigs(): ReadonlyMap<string, WellFormedNodeConfig> {
  return new Map<string, WellFormedNodeConfig>([
    ['start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }],
    ['agent', { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig('sablon-agent') }],
    [
      'szintezis',
      { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig('sablon-join'), onUnhandledError: 'fail_run' },
    ],
    ['osszefuzes', { type: 'join', mode: 'merge', onUnhandledError: 'fail_run' }],
    [
      'jovahagyas',
      {
        type: 'human_approval',
        title: 'Cím',
        bodyTemplate: 'sablon-jovahagyas',
        timeoutMs: null,
        onUnhandledError: 'fail_run',
      },
    ],
    [
      'szetosztas',
      {
        type: 'fan_out',
        itemsExpression: 'kifejezes-elemek',
        branchLabelTemplate: 'sablon-cimke',
        onUnhandledError: 'fail_run',
      },
    ],
    [
      'elagazas',
      {
        type: 'branch',
        expression: 'kifejezes-ag',
        branches: [],
        defaultBranchKey: null,
        onUnhandledError: 'fail_run',
      },
    ],
    [
      'ciklus',
      { type: 'loop', maxIterations: 2, continueExpression: 'kifejezes-ciklus', onUnhandledError: 'fail_run' },
    ],
    [
      'hibakezelo',
      { type: 'error_handler', maxAttempts: 1, backoffMs: [], handledErrorKinds: [], onUnhandledError: 'fail_run' },
    ],
    ['al', { type: 'sub_workflow', targetWorkflowId: 'w', inputMapping: {}, onUnhandledError: 'fail_run' }],
    ['szkript', { type: 'script', source: 'kifejezes-szkript', runtime: 'expression', onUnhandledError: 'fail_run' }],
    [
      'js',
      {
        type: 'script',
        source: 'javascript-szkript',
        runtime: 'javascript',
        timeoutMs: null,
        cwd: null,
        memoryLimitMb: null,
        fetchResponseLimitMb: null,
        fileReadLimitMb: null,
        onUnhandledError: 'fail_run',
      },
    ],
    [
      'join-szkript',
      {
        type: 'join',
        mode: 'script',
        settings: { source: 'kifejezes-join', runtime: 'expression' },
        onUnhandledError: 'fail_run',
      },
    ],
    [
      'join-js',
      {
        type: 'join',
        mode: 'script',
        settings: {
          source: 'javascript-join',
          runtime: 'javascript',
          timeoutMs: null,
          cwd: null,
          memoryLimitMb: null,
          fetchResponseLimitMb: null,
          fileReadLimitMb: null,
        },
        onUnhandledError: 'fail_run',
      },
    ],
  ]);
}

interface RecordingPorts {
  readonly templateRenderer: TemplateRendererPort;
  readonly expressionEvaluator: ExpressionEvaluatorPort;
  readonly compiledTemplates: string[];
  readonly compiledExpressions: string[];
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port metódus');
};

/**
 * Hamis portok a két port saját típusával: a `compile` minden hívást
 * feljegyez, és a `failing` szövegre hibát ad.
 */
function recordingPorts(failing: string | undefined): RecordingPorts {
  const compiledTemplates: string[] = [];
  const compiledExpressions: string[] = [];
  const compileWith =
    (seen: string[]) =>
    (source: string): Outcome<void> => {
      seen.push(source);
      return source === failing ? { kind: 'error', message: 'a csomag hibaleírása' } : { kind: 'ok', value: undefined };
    };
  return {
    templateRenderer: { render: notCalled, compile: compileWith(compiledTemplates) },
    expressionEvaluator: { evaluate: notCalled, compile: compileWith(compiledExpressions) },
    compiledTemplates,
    compiledExpressions,
  };
}

describe('validateLanguageFields', () => {
  it('hibátlan mezőkre zöld, a négy sablon mezőt a sablon, az öt kifejezés mezőt a kifejezés port fordítja, a JavaScript forrást egyik sem', () => {
    const ports = recordingPorts(undefined);

    expect(validateLanguageFields(allConfigs(), ports)).toStrictEqual({ kind: 'ok', value: undefined });
    expect(ports.compiledTemplates).toStrictEqual(['sablon-agent', 'sablon-join', 'sablon-jovahagyas', 'sablon-cimke']);
    expect(ports.compiledExpressions).toStrictEqual([
      'kifejezes-elemek',
      'kifejezes-ag',
      'kifejezes-ciklus',
      'kifejezes-szkript',
      'kifejezes-join',
    ]);
  });

  it.each([
    ['agent', 'promptTemplate', 'sablon-agent', 'template_render_failed'],
    ['szintezis', 'settings.promptTemplate', 'sablon-join', 'template_render_failed'],
    ['jovahagyas', 'bodyTemplate', 'sablon-jovahagyas', 'template_render_failed'],
    ['szetosztas', 'branchLabelTemplate', 'sablon-cimke', 'template_render_failed'],
    ['elagazas', 'expression', 'kifejezes-ag', 'expression_evaluation_failed'],
    ['szetosztas', 'itemsExpression', 'kifejezes-elemek', 'expression_evaluation_failed'],
    ['ciklus', 'continueExpression', 'kifejezes-ciklus', 'expression_evaluation_failed'],
    ['szkript', 'source', 'kifejezes-szkript', 'expression_evaluation_failed'],
    ['join-szkript', 'settings.source', 'kifejezes-join', 'expression_evaluation_failed'],
  ])('a(z) %s csomópont %s mezőjének fordítási hibája elutasít', (nodeId, field, source, errorKind) => {
    const ports = recordingPorts(source);

    expect(validateLanguageFields(allConfigs(), ports)).toStrictEqual({
      kind: 'error',
      message: `A(z) ${nodeId} csomópont ${field} mezője nem fordítható le: a csomag hibaleírása (${errorKind}).`,
    });
  });

  it('az első hibánál megáll, a további mezőket nem fordítja', () => {
    const ports = recordingPorts('sablon-agent');

    validateLanguageFields(allConfigs(), ports);

    expect(ports.compiledTemplates).toStrictEqual(['sablon-agent']);
    expect(ports.compiledExpressions).toStrictEqual([]);
  });
});
