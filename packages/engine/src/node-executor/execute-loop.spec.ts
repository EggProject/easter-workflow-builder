/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` és a `NodeExecutionInstance.parentStepRunId` nullázható mezői (SPEC-003 5.1, 4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { executeLoop, type ExecuteLoopInput } from './execute-loop.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';
import type { NodeExecutorPorts } from './node-executor-ports.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function seedRun(database: DatabaseContext): { readonly runId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'execute-loop teszt', description: null, providerId: null }),
  );
  const snapshot = {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflow.id, name: workflow.name, description: null },
    nodes: [],
    edges: [],
  } as const;
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshot,
    }),
  );
  return { runId: run.id };
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

function fakeClock(): ClockPort {
  let now = 0;
  return {
    nowMs: () => {
      now += 5;
      return now;
    },
    sleep: notCalled,
  };
}

function portsOf(
  database: DatabaseContext,
  published: unknown[],
  evaluate: ExpressionEvaluatorPort['evaluate'],
): NodeExecutorPorts {
  const publisher: EventPublisherPort = {
    publish: (event) => {
      published.push(event);
    },
  };
  return {
    database,
    clock: fakeClock(),
    idGenerator: { nextId: notCalled },
    eventPublisher: publisher,
    expressionEvaluator: { evaluate, compile: notCalled },
    templateRenderer: { render: notCalled, compile: notCalled },
  };
}

function instanceOf(runId: string, iteration = 0): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'loop', branchContext: [] },
    parentStepRunId: null,
    iteration,
    attempt: 1,
    providerId: 'minimax',
  };
}

const emptyRunContext: RunContext = {
  input: {},
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

function inputOf(runId: string, iteration = 0): ExecuteLoopInput {
  return {
    instance: instanceOf(runId, iteration),
    config: { type: 'loop', maxIterations: 3, continueExpression: 'folytat', onUnhandledError: 'fail_run' },
    runContext: emptyRunContext,
  };
}

function cancelRunningStep(database: DatabaseContext, runId: string): void {
  const rows = okOrThrow(database.stepRuns.listStepRuns(runId));
  const running = rows.find((row) => row.status === 'running');
  if (running !== undefined) {
    database.stepRuns.markStepCancelled(running.id);
  }
}

describe('executeLoop', () => {
  it('maxIterations elérésekor kifejezés kiértékelés nélkül loop_max_iterations_reached hibaosztállyal zár', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, notCalled);

    const outcome = okOrThrow(executeLoop(inputOf(runId, 3), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('loop_max_iterations_reached');
    expect(published).not.toContainEqual(expect.objectContaining({ kind: 'loop_iteration_started' }));
  });

  it('igaz eredménynél loop_advanced shouldContinue igaz, és loop_iteration_started eseményt ír', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: true }));

    const outcome = okOrThrow(executeLoop(inputOf(runId, 1), ports));

    expect(outcome.kind).toBe('loop_advanced');
    expect(outcome.kind === 'loop_advanced' ? outcome.shouldContinue : false).toBe(true);
    expect(outcome.kind === 'loop_advanced' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(outcome.kind === 'loop_advanced' ? outcome.stepRun.iteration : -1).toBe(1);
    expect(published).toContainEqual(
      expect.objectContaining({ kind: 'loop_iteration_started', payload: { iteration: 1, maxIterations: 3 } }),
    );
  });

  it('hamis eredménynél loop_advanced shouldContinue hamis, és nem ír loop_iteration_started eseményt', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: false }));

    const outcome = okOrThrow(executeLoop(inputOf(runId), ports));

    expect(outcome.kind).toBe('loop_advanced');
    expect(outcome.kind === 'loop_advanced' ? outcome.shouldContinue : true).toBe(false);
    expect(outcome.kind === 'loop_advanced' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(published).not.toContainEqual(expect.objectContaining({ kind: 'loop_iteration_started' }));
  });

  it('a port hibáját expression_evaluation_failed hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'error', message: 'teszt kiértékelési hiba' }));

    const outcome = okOrThrow(executeLoop(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('expression_evaluation_failed');
  });

  it('nem logikai eredmény esetén expression_evaluation_failed hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: 'nem logikai' }));

    const outcome = okOrThrow(executeLoop(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('expression_evaluation_failed');
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published, notCalled);

    const outcome = executeLoop(inputOf('nincs-ilyen-futas'), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a hiba lezárásának Outcome hibáját továbbadja, ha a sor időközben más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'error', message: 'teszt kiértékelési hiba' };
    });

    const outcome = executeLoop(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a sikeres lezárás Outcome hibáját továbbadja, ha a sor időközben más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'ok', value: true };
    });

    const outcome = executeLoop(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a záró fázis saját step_finished eseményének írási hibáját továbbadja, ha a kapcsolat időközben lezárul', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepSucceeded: (id, input) => {
          const succeeded = database.stepRuns.markStepSucceeded(id, input);
          database.close();
          return succeeded;
        },
      },
    };
    const ports = portsOf(racyDatabase, published, () => ({ kind: 'ok', value: true }));

    const outcome = executeLoop(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a loop_iteration_started esemény írásának hibáját továbbadja, ha a kapcsolat a step_finished után zárul le', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    // A step_started (1.) és a záró step_finished (2.) esemény sikeresen íródik; csak a
    // harmadik, a `loop_iteration_started` motor esemény írásakor zárul le a kapcsolat,
    // hogy a `loop_iteration_started`-re szabott hibaágat a `finishStepRunSucceeded`
    // saját hibaágától (fentebb lefedve) elkülönítve lehessen tesztelni.
    let appendCount = 0;
    const racyDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) => {
          appendCount += 1;
          if (appendCount === 3) {
            database.close();
          }
          return database.events.appendEngineEvent(input);
        },
      },
    };
    const ports = portsOf(racyDatabase, published, () => ({ kind: 'ok', value: true }));

    const outcome = executeLoop(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });
});
