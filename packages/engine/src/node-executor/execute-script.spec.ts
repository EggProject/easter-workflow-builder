/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository`, a `NodeExecutionInstance.parentStepRunId` és a JavaScript szkript nullázható mezői (SPEC-003 5.1, 4.3, SPEC-014 5.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, ScriptConfig } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { ScriptRunRequest } from '../engine-port/script-run-request.ts';
import type { ScriptRunnerPort } from '../engine-port/script-runner-port.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { executeScript, type ExecuteScriptInput } from './execute-script.ts';
import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutionResult } from './node-executor-result.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function seedRun(database: DatabaseContext): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'execute-script teszt', description: null, providerId: null }),
  );
  const snapshot = {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflow.id, name: workflow.name, description: null },
    nodes: [],
    edges: [],
  } as const;
  return okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshot,
    }),
  ).id;
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

const RUN_CONTEXT: RunContext = {
  input: { tema: 'nyuszi' },
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

const NOT_CALLED_RUNNER: ScriptRunnerPort = { compile: notCalled, run: notCalled };
const NOT_CALLED_EVALUATOR: ExpressionEvaluatorPort = { evaluate: notCalled, compile: notCalled };

interface Ports {
  readonly database: DatabaseContext;
  readonly published: unknown[];
}

function portsOf(
  { database, published }: Ports,
  expressionEvaluator: ExpressionEvaluatorPort,
  scriptRunner: ScriptRunnerPort,
): Parameters<typeof executeScript>[1] {
  let now = 0;
  return {
    database,
    clock: {
      nowMs: () => {
        now += 5;
        return now;
      },
      sleep: notCalled,
    },
    idGenerator: { nextId: notCalled },
    eventPublisher: {
      publish: (event) => {
        published.push(event);
      },
    },
    expressionEvaluator,
    templateRenderer: { render: notCalled, compile: notCalled },
    scriptRunner,
  };
}

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'sc', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
    failureStopsRun: false,
  };
}

const JAVASCRIPT: ScriptConfig = {
  runtime: 'javascript',
  source: 'return input.tema;',
  timeoutMs: 250,
  cwd: '/munka',
  memoryLimitMb: 64,
  fetchResponseLimitMb: null,
  fileReadLimitMb: null,
};
const EXPRESSION: ScriptConfig = { runtime: 'expression', source: 'input.tema' };

function inputOf(runId: string, script: ScriptConfig, stopSignal = new AbortController().signal): ExecuteScriptInput {
  return { instance: instanceOf(runId), nodeType: 'script', script, runContext: RUN_CONTEXT, stopSignal };
}

function setup(): Ports & { readonly runId: string } {
  const database = okOrThrow(openDatabase(':memory:'));
  return { database, published: [], runId: seedRun(database) };
}

function runnerReturning(result: Awaited<ReturnType<ScriptRunnerPort['run']>>, requests: ScriptRunRequest[] = []) {
  return {
    compile: notCalled,
    run: (request: ScriptRunRequest) => {
      requests.push(request);
      return Promise.resolve(result);
    },
  } satisfies ScriptRunnerPort;
}

async function runJavaScript(
  context: Ports & { readonly runId: string },
  runner: ScriptRunnerPort,
  stopSignal?: AbortSignal,
): Promise<NodeExecutionResult> {
  const ports = portsOf(context, NOT_CALLED_EVALUATOR, runner);
  return okOrThrow(await executeScript(inputOf(context.runId, JAVASCRIPT, stopSignal), ports));
}

describe('executeScript', () => {
  it('CEL ág: a kifejezés eredménye a lépés kimenete, a scriptRunner nem hívott', async () => {
    const context = setup();
    const contexts: unknown[] = [];
    const evaluator: ExpressionEvaluatorPort = {
      evaluate: (expression, runContext) => {
        contexts.push(runContext);
        return { kind: 'ok', value: { kifejezes: expression } };
      },
      compile: notCalled,
    };

    const result = okOrThrow(
      await executeScript(inputOf(context.runId, EXPRESSION), portsOf(context, evaluator, NOT_CALLED_RUNNER)),
    );

    expect(result).toMatchObject({ kind: 'succeeded', selectedBranchKey: null });
    expect(result.kind === 'succeeded' ? result.stepRun : undefined).toMatchObject({
      status: 'succeeded',
      nodeType: 'script',
      output: { kifejezes: 'input.tema' },
    });
    expect(contexts).toStrictEqual([RUN_CONTEXT]);
  });

  it('CEL ág: a kiértékelés hibája expression_evaluation_failed, a csomópont nevével', async () => {
    const context = setup();
    const evaluator: ExpressionEvaluatorPort = {
      evaluate: () => ({ kind: 'error', message: 'nincs ilyen mező' }),
      compile: notCalled,
    };

    const result = okOrThrow(
      await executeScript(inputOf(context.runId, EXPRESSION), portsOf(context, evaluator, NOT_CALLED_RUNNER)),
    );

    const errorMessage =
      'A(z) "sc" node szkriptjének futása sikertelen: nincs ilyen mező (expression_evaluation_failed).';
    expect(result).toMatchObject({ kind: 'failed', errorKind: 'expression_evaluation_failed', errorMessage });
    expect(result.kind === 'failed' ? result.stepRun : undefined).toMatchObject({
      status: 'failed',
      errorKind: 'expression_evaluation_failed',
      errorMessage,
    });
  });

  it('JavaScript ág: a futtató a tárolt mezőket, a kontextust és a leállítás jelét kapja, a kimenete a lépés kimenete', async () => {
    const context = setup();
    const requests: ScriptRunRequest[] = [];
    const stop = new AbortController();

    const result = await runJavaScript(
      context,
      runnerReturning({ kind: 'succeeded', output: ['x', 1] }, requests),
      stop.signal,
    );

    expect(requests).toStrictEqual([
      {
        source: 'return input.tema;',
        runContext: RUN_CONTEXT,
        timeoutMs: 250,
        cwd: '/munka',
        memoryLimitMb: 64,
        fetchResponseLimitMb: null,
        fileReadLimitMb: null,
        signal: stop.signal,
      },
    ]);
    expect(result.kind === 'succeeded' ? result.stepRun.output : undefined).toStrictEqual(['x', 1]);
  });

  it.each(['script_evaluation_failed', 'script_timed_out', 'script_output_not_json'] as const)(
    'JavaScript ág: a futtató %s hibája a lépés hibája, a motor mondatával és az osztállyal',
    async (errorKind) => {
      const context = setup();

      const result = await runJavaScript(
        context,
        runnerReturning({ kind: 'failed', errorKind, message: 'a futtató oka' }),
      );

      expect(result).toMatchObject({
        kind: 'failed',
        errorKind,
        errorMessage: `A(z) "sc" node szkriptjének futása sikertelen: a futtató oka (${errorKind}).`,
      });
      expect(result.kind === 'failed' ? result.stepRun.status : undefined).toBe('failed');
    },
  );

  it('JavaScript ág: a futtató aborted eredménye után interrupted, a sor running marad (a leállítást kérő zárja, SPEC-014 5.8)', async () => {
    const context = setup();

    const result = await runJavaScript(context, runnerReturning({ kind: 'aborted' }));

    expect(result).toStrictEqual({ kind: 'interrupted' });
    expect(okOrThrow(context.database.stepRuns.listStepRuns(context.runId)).map((row) => row.status)).toStrictEqual([
      'running',
    ]);
  });

  it('a tárolhatatlan kimenet step_output_not_storable osztállyal zárja a lépést', async () => {
    const context = setup();

    const tooLong = 'a'.repeat(MAX_STORED_OUTPUT_LENGTH);
    const result = await runJavaScript(context, runnerReturning({ kind: 'succeeded', output: tooLong }));

    expect(result).toMatchObject({ kind: 'failed', errorKind: 'step_output_not_storable' });
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', async () => {
    const context = setup();

    const outcome = await executeScript(
      inputOf('nincs-ilyen-futas', EXPRESSION),
      portsOf(context, NOT_CALLED_EVALUATOR, NOT_CALLED_RUNNER),
    );

    expect(outcome.kind).toBe('error');
  });

  it('a hibás zárás írási hibáját továbbadja, ha a kapcsolat a futtatás alatt lezárul', async () => {
    const context = setup();
    const runner: ScriptRunnerPort = {
      compile: notCalled,
      run: () => {
        context.database.close();
        return Promise.resolve({ kind: 'failed', errorKind: 'script_timed_out', message: 'lejárt' });
      },
    };

    const outcome = await executeScript(
      inputOf(context.runId, JAVASCRIPT),
      portsOf(context, NOT_CALLED_EVALUATOR, runner),
    );

    expect(outcome.kind).toBe('error');
  });

  it('a sikeres zárás írási hibáját továbbadja, ha a kapcsolat a futtatás alatt lezárul', async () => {
    const context = setup();
    const runner: ScriptRunnerPort = {
      compile: notCalled,
      run: () => {
        context.database.close();
        return Promise.resolve({ kind: 'succeeded', output: 1 });
      },
    };

    const outcome = await executeScript(
      inputOf(context.runId, JAVASCRIPT),
      portsOf(context, NOT_CALLED_EVALUATOR, runner),
    );

    expect(outcome.kind).toBe('error');
  });
});
