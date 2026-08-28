/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` és a `NodeExecutionInstance.parentStepRunId` nullázható mezői (SPEC-003 5.1, 4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { executeJoinMerge, type ExecuteJoinMergeInput } from './execute-join-merge.ts';
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
    database.workflows.createWorkflow({ name: 'execute-join-merge teszt', description: null, providerId: null }),
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
    instance: { nodeId: 'join', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
  };
}

function inputOf(runId: string, joinInputs: readonly unknown[] = ['a', 'b']): ExecuteJoinMergeInput {
  return {
    instance: instanceOf(runId),
    config: { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' },
    joinInputs,
  };
}

describe('executeJoinMerge', () => {
  it('a bemenetek listáját változatlanul, elem sorrendben adja kimenetként, és join_resolved eseményt ír merge móddal', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = okOrThrow(executeJoinMerge(inputOf(runId, ['x', 'y', 'z']), ports));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : 'nincs-ilyen-ag').toBeNull();
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.output : undefined).toStrictEqual(['x', 'y', 'z']);
    expect(published).toContainEqual(
      expect.objectContaining({ kind: 'join_resolved', payload: { mode: 'merge', inputCount: 3 } }),
    );
  });

  it('üres bemeneti lista esetén is lezár, inputCount nulla', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = okOrThrow(executeJoinMerge(inputOf(runId, []), ports));

    expect(outcome.kind).toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.selectedBranchKey : 'nincs-ilyen-ag').toBeNull();
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.status : 'nincs-ilyen-allapot').toBe('succeeded');
    expect(outcome.kind === 'succeeded' ? outcome.stepRun.output : ['nincs-ilyen-elem']).toStrictEqual([]);
    expect(published).toContainEqual(
      expect.objectContaining({ kind: 'join_resolved', payload: { mode: 'merge', inputCount: 0 } }),
    );
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = executeJoinMerge(inputOf('nincs-ilyen-futas'), ports);

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

    const outcome = executeJoinMerge(inputOf(runId), ports);

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
    const ports = portsOf(racyDatabase, published);

    const outcome = executeJoinMerge(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a join_resolved esemény írásának hibáját továbbadja, ha a kapcsolat a step_finished után zárul le', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    // A step_started (1.) és a záró step_finished (2.) esemény sikeresen íródik; csak a
    // harmadik, a `join_resolved` motor esemény írásakor zárul le a kapcsolat, hogy a
    // `join_resolved`-re szabott hibaágat a `finishStepRunSucceeded` saját hibaágától
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
    const ports = portsOf(racyDatabase, published);

    const outcome = executeJoinMerge(inputOf(runId), ports);

    expect(outcome.kind).toBe('error');
  });
});
