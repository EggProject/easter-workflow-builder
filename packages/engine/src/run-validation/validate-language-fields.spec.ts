/* eslint-disable unicorn/no-null -- az `AgentStepConfig` nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';
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
 * Mind a kilenc végrehajtható node típus, a `join` mindkét módjával. A hét
 * vizsgált mező szövege egyedi, hogy a teszt lássa, melyik port kapta meg.
 */
function allConfigs(): ReadonlyMap<string, ExecutableNodeConfig> {
  return new Map<string, ExecutableNodeConfig>([
    ['start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }],
    ['agent', { type: 'agent_step', onUnhandledError: 'fail_run', ...agentStepConfig('sablon-agent') }],
    [
      'szintezis',
      { type: 'join', mode: 'ai_synthesis', settings: agentStepConfig('sablon-join'), onUnhandledError: 'fail_run' },
    ],
    ['osszefuzes', { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' }],
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
  it('hibátlan mezőkre zöld, a négy sablon mezőt a sablon, a három kifejezés mezőt a kifejezés port fordítja', () => {
    const ports = recordingPorts(undefined);

    expect(validateLanguageFields(allConfigs(), ports)).toStrictEqual({ kind: 'ok', value: undefined });
    expect(ports.compiledTemplates).toStrictEqual(['sablon-agent', 'sablon-join', 'sablon-jovahagyas', 'sablon-cimke']);
    expect(ports.compiledExpressions).toStrictEqual(['kifejezes-elemek', 'kifejezes-ag', 'kifejezes-ciklus']);
  });

  it.each([
    ['agent', 'promptTemplate', 'sablon-agent', 'template_render_failed'],
    ['szintezis', 'settings.promptTemplate', 'sablon-join', 'template_render_failed'],
    ['jovahagyas', 'bodyTemplate', 'sablon-jovahagyas', 'template_render_failed'],
    ['szetosztas', 'branchLabelTemplate', 'sablon-cimke', 'template_render_failed'],
    ['elagazas', 'expression', 'kifejezes-ag', 'expression_evaluation_failed'],
    ['szetosztas', 'itemsExpression', 'kifejezes-elemek', 'expression_evaluation_failed'],
    ['ciklus', 'continueExpression', 'kifejezes-ciklus', 'expression_evaluation_failed'],
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
