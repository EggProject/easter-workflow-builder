/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` nullázható mezői (SPEC-003 5.1) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { EngineEvent } from '../engine-event/engine-event.ts';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { emitEngineEvent } from './emit-engine-event.ts';
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
    database.workflows.createWorkflow({ name: 'emit-engine-event teszt', description: null, providerId: null }),
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
  return { nowMs: () => 42, sleep: notCalled };
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

describe('emitEngineEvent', () => {
  it('sikeres esetben előbb a db felé írja, majd az élő nézetnek is kiadja ugyanazt az eseményt', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    // `run_finished`: a `startRun` (seedRun) már ír egy `run_started` sort ugyanabba
    // a futásba (T-003-21), ezért a teszt saját eseménye más `kind`-ot használ, hogy a
    // tárolt sorok száma ne a `startRun` belső viselkedésétől függjön.
    const event: EngineEvent = {
      kind: 'run_finished',
      runId,
      stepRunId: null,
      payload: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
    };

    okOrThrow(emitEngineEvent(event, ports));

    expect(published).toStrictEqual([event]);
    const stored = okOrThrow(database.events.readEventsSince(runId, 0, 10));
    expect(stored.filter((row) => row.kind === 'run_finished')).toHaveLength(1);
  });

  it('a db írás hibáját továbbadja, és nem publikál, ha a hivatkozott futás nem létezik', () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published);
    const event: EngineEvent = {
      kind: 'run_finished',
      runId: 'nincs-ilyen-futas',
      stepRunId: null,
      payload: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
    };

    const outcome = emitEngineEvent(event, ports);

    expect(outcome.kind).toBe('error');
    expect(published).toStrictEqual([]);
  });
});
