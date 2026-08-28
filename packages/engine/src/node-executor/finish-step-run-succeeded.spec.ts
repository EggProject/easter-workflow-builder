/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository`/`CreateStepRunInput` nullázható mezői (SPEC-003 5.1, 9.2) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { finishStepRunSucceeded } from './finish-step-run-succeeded.ts';
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

function seedRunningStep(database: DatabaseContext): { readonly runId: string; readonly stepRunId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'finish-step-run-succeeded teszt', description: null, providerId: null }),
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
  const stepRun = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'start',
      nodeType: 'start',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  okOrThrow(database.stepRuns.markStepRunning(stepRun.id));
  return { runId: run.id, stepRunId: stepRun.id };
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

function portsOf(database: DatabaseContext, published: unknown[]): NodeExecutorPorts {
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
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: { render: notCalled, compile: notCalled },
  };
}

describe('finishStepRunSucceeded', () => {
  it('sikeres esetben succeeded állapotba viszi a sort, tárolja a kimenetet, és step_finished eseményt ír és ad ki', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const record = okOrThrow(
      finishStepRunSucceeded({ runId, stepRunId, startedAtMs: 0, output: { osszeg: 4 } }, ports),
    );

    expect(record.status).toBe('succeeded');
    expect(record.output).toStrictEqual({ osszeg: 4 });
    expect(published).toStrictEqual([
      {
        kind: 'step_finished',
        runId,
        stepRunId,
        payload: { status: 'succeeded', errorKind: null, durationMs: 5, tokens: null },
      },
    ]);
  });

  it('tokens megadása esetén a step_finished payload tokens mezőjében adja tovább (a mai öt node típus egyike sem küld tokent, de a bemeneti szerződés opcionális mezője)', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    const tokens = { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 };

    const record = okOrThrow(finishStepRunSucceeded({ runId, stepRunId, startedAtMs: 0, output: null, tokens }, ports));

    expect(record.status).toBe('succeeded');
    expect(published).toStrictEqual([
      {
        kind: 'step_finished',
        runId,
        stepRunId,
        payload: { status: 'succeeded', errorKind: null, durationMs: 5, tokens },
      },
    ]);
  });

  it('a markStepSucceeded hibáját továbbadja, ha a sor időközben nem running állapotú', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
    okOrThrow(database.stepRuns.markStepCancelled(stepRunId));
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = finishStepRunSucceeded({ runId, stepRunId, startedAtMs: 0, output: null }, ports);

    expect(outcome.kind).toBe('error');
    expect(published).toStrictEqual([]);
  });

  it('a step_finished esemény írásának hibáját továbbadja, ha a kapcsolat időközben lezárul', () => {
    const database = openMemoryDatabase();
    const { runId, stepRunId } = seedRunningStep(database);
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
    const ports = portsOf(racyDatabase, published);

    const outcome = finishStepRunSucceeded({ runId, stepRunId, startedAtMs: 0, output: null }, ports);

    expect(outcome.kind).toBe('error');
    expect(published).toStrictEqual([]);
  });
});
