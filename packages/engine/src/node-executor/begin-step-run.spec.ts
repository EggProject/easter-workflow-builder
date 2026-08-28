/* eslint-disable unicorn/no-null -- a `CreateStepRunInput` és a `WorkflowRepository`/`WorkflowRunRepository` nullázható mezői (SPEC-003 5.1, 9.2) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { CreateStepRunInput, DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { beginStepRun } from './begin-step-run.ts';
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
    database.workflows.createWorkflow({ name: 'begin-step-run teszt', description: null, providerId: null }),
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

function createInputOf(runId: string): CreateStepRunInput {
  return {
    runId,
    nodeId: 'start',
    nodeType: 'start',
    parentStepRunId: null,
    providerId: 'minimax',
    modelId: null,
    sessionMode: null,
    structuredOutputStrategy: null,
    subWorkflowRunId: null,
  };
}

describe('beginStepRun', () => {
  it('sikeres esetben létrehozza, running állapotba viszi a sort, és step_started eseményt ír és ad ki', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const began = okOrThrow(beginStepRun(createInputOf(runId), ports));

    expect(began.stepRun.status).toBe('running');
    expect(began.stepRun.nodeId).toBe('start');
    expect(began.startedAtMs).toBeGreaterThan(0);
    expect(published).toStrictEqual([
      {
        kind: 'step_started',
        runId,
        stepRunId: began.stepRun.id,
        payload: { nodeId: 'start', nodeType: 'start', providerId: 'minimax', attempt: 1, iteration: 0 },
      },
    ]);
  });

  it('a createStepRun hibáját (nem létező runId, idegen kulcs sértés) továbbadja', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published);

    const outcome = beginStepRun(createInputOf('nincs-ilyen-futas'), ports);

    expect(outcome.kind).toBe('error');
    expect(published).toStrictEqual([]);
  });

  it('a markStepRunning hibáját továbbadja, ha a sor a createStepRun és a markStepRunning között más állapotba kerül', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        createStepRun: (input) => {
          const created = database.stepRuns.createStepRun(input);
          if (created.kind === 'ok') {
            database.stepRuns.markStepCancelled(created.value.id);
          }
          return created;
        },
      },
    };
    const ports = portsOf(racyDatabase, published);

    const outcome = beginStepRun(createInputOf(runId), ports);

    expect(outcome.kind).toBe('error');
    expect(published).toStrictEqual([]);
  });

  it('a step_started esemény írásának hibáját továbbadja, ha a kapcsolat időközben lezárul', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepRunning: (stepRunId) => {
          const running = database.stepRuns.markStepRunning(stepRunId);
          database.close();
          return running;
        },
      },
    };
    const ports = portsOf(racyDatabase, published);

    const outcome = beginStepRun(createInputOf(runId), ports);

    expect(outcome.kind).toBe('error');
    expect(published).toStrictEqual([]);
  });
});
