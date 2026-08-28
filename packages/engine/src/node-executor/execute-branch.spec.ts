/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` és a `BranchNodeConfig`/`NodeExecutionInstance` nullázható mezői (SPEC-003 5.1, 4.7) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { RunContext } from '../run-context/run-context.ts';
import { executeBranch, type ExecuteBranchInput } from './execute-branch.ts';
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
    database.workflows.createWorkflow({ name: 'execute-branch teszt', description: null, providerId: null }),
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

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'branch', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
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

function inputOf(runId: string, overrides: Partial<ExecuteBranchInput> = {}): ExecuteBranchInput {
  return {
    instance: instanceOf(runId),
    config: {
      type: 'branch',
      expression: 'ag',
      branches: [{ key: 'a', label: 'A' }],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    },
    runContext: emptyRunContext,
    availableBranchKeys: ['a'],
    ...overrides,
  };
}

function cancelRunningStep(database: DatabaseContext, runId: string): void {
  const rows = okOrThrow(database.stepRuns.listStepRuns(runId));
  const running = rows.find((row) => row.status === 'running');
  if (running !== undefined) {
    database.stepRuns.markStepCancelled(running.id);
  }
}

describe('executeBranch', () => {
  it('közvetlen egyezésnél a kiértékelt kulcsot választja, usedDefault hamis', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: 'a' }));

    const outcome = okOrThrow(executeBranch(inputOf(runId), ports));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : 'nincs-ilyen-ag').toBe('a');
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.output : undefined).toBeNull();
    expect(published).toContainEqual(
      expect.objectContaining({ kind: 'branch_taken', payload: { branchKey: 'a', usedDefault: false } }),
    );
  });

  it('egyezés hiányában az alapértelmezett ágat választja, usedDefault igaz, a branch_taken payload branchKey mezője null', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: 'ismeretlen' }));
    const baseInput = inputOf(runId);
    const request = inputOf(runId, {
      availableBranchKeys: ['a', 'b'],
      config: { ...baseInput.config, defaultBranchKey: 'b' },
    });

    const outcome = okOrThrow(executeBranch(request, ports));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : 'nincs-ilyen-ag').toBe('b');
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(published).toContainEqual(
      expect.objectContaining({ kind: 'branch_taken', payload: { branchKey: null, usedDefault: true } }),
    );
  });

  it('a port hibáját expression_evaluation_failed hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'error', message: 'teszt kiértékelési hiba' }));

    const outcome = okOrThrow(executeBranch(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('expression_evaluation_failed');
  });

  it('nincs egyező él és nincs alapértelmezett ág esetén branch_no_matching_edge hibaosztállyal zárja', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'ok', value: 'ismeretlen' }));

    const outcome = okOrThrow(executeBranch(inputOf(runId), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' && outcome.errorKind).toBe('branch_no_matching_edge');
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published, notCalled);

    const outcome = executeBranch(inputOf('nincs-ilyen-futas'), ports);

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

    const outcome = executeBranch(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a sikeres lezárás Outcome hibáját továbbadja, ha a sor időközben más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'ok', value: 'a' };
    });

    const outcome = executeBranch(inputOf(runId), ports);

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
    const ports = portsOf(racyDatabase, published, () => ({ kind: 'ok', value: 'a' }));

    const outcome = executeBranch(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a branch_taken esemény írásának hibáját továbbadja, ha a kapcsolat a step_finished után zárul le', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    // A step_started (1.) és a záró step_finished (2.) esemény sikeresen íródik; csak a
    // harmadik, a `branch_taken` motor esemény írásakor zárul le a kapcsolat, hogy a
    // `branch_taken`-re szabott hibaágat (execute-branch.ts, a `finishStepRunSucceeded`
    // hívása utáni `emitEngineEvent`) a `finishStepRunSucceeded` saját hibaágától
    // (fentebb lefedve) elkülönítve lehessen tesztelni.
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
    const ports = portsOf(racyDatabase, published, () => ({ kind: 'ok', value: 'a' }));

    const outcome = executeBranch(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });
});
