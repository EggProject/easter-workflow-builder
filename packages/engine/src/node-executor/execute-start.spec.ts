/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` nullázható mezői (SPEC-003 5.1) és a `NodeExecutionInstance.parentStepRunId` gyökér ág kontextusa (4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { executeStart } from './execute-start.ts';
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
    database.workflows.createWorkflow({ name: 'execute-start teszt', description: null, providerId: null }),
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

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'start', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
  };
}

describe('executeStart', () => {
  it('azonnal succeeded, a kimenete maga a bemenet, és minden él kap live jelölést (selectedBranchKey null)', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = okOrThrow(executeStart({ instance: instanceOf(runId), input: { szia: 'vilag' } }, ports));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : 'nincs-ilyen-ag').toBeNull();
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.output : undefined).toStrictEqual({ szia: 'vilag' });
    expect(published).toHaveLength(2);
    expect(published[0]).toMatchObject({ kind: 'step_started' });
    expect(published[1]).toMatchObject({ kind: 'step_finished' });
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = executeStart({ instance: instanceOf('nincs-ilyen-futas'), input: {} }, ports);

    expect(outcome.kind).toBe('error');
  });

  it('a záró fázis hibáját továbbadja, ha a sor a running és a succeeded átmenet között más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepRunning: (stepRunId) => {
          const running = database.stepRuns.markStepRunning(stepRunId);
          if (running.kind === 'ok') {
            database.stepRuns.markStepCancelled(stepRunId);
          }
          return running;
        },
      },
    };
    const ports = portsOf(racyDatabase, published);

    const outcome = executeStart({ instance: instanceOf(runId), input: {} }, ports);

    expect(outcome.kind).toBe('error');
  });
});
