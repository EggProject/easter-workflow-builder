/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`StepRunRepository` nullázható mezői (description, stepRunId, parentStepRunId, modelId, sessionMode, structuredOutputStrategy, subWorkflowRunId) és az `EngineEvent` futás szintű `stepRunId`/payload `errorKind` mezői tárolt/visszaadott `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EngineEvent } from './engine-event.ts';
import { writeEngineEvent } from './write-engine-event.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

/**
 * Hamis óra port, ami mindig a konstruktorban kapott értéket adja vissza: a
 * teszt ezzel bizonyítja, hogy az `occurredAtMs` a `clock` portból jön, nem a
 * rendszeridőből (SPEC-004 14.2 determinizmus tábla).
 */
function fakeClock(nowMs: number): ClockPort {
  return {
    nowMs: () => nowMs,
    sleep: () => Promise.reject(new Error('nem használt ebben a tesztben')),
  };
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

/**
 * A `run_event` idegen kulcsa miatt kell egy valódi `workflow` és
 * `workflow_run` sor. Az `engine` csomag a `db` barreljén kívül semmit nem
 * importálhat (SPEC-002 6.6), ezért a nyilvános `WorkflowRepository`/
 * `WorkflowRunRepository` felületen keresztül épül a fixture, nem a
 * `run-event-repository.spec.ts` nyers tábla beszúrásos mintájával.
 */
function seedRun(database: DatabaseContext): { workflowId: string; runId: string } {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'engine-event teszt', description: null, providerId: null }),
  );
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: '0.0.0-test',
        workflow: { id: workflow.id, name: workflow.name, description: null },
        nodes: [],
        edges: [],
      },
    }),
  );
  return { workflowId: workflow.id, runId: run.id };
}

describe('writeEngineEvent', () => {
  it('futás szintű eseményt ír, occurredAtMs a clock portból jön', () => {
    const database = openMemoryDatabase();
    const { workflowId, runId } = seedRun(database);
    const clock = fakeClock(12_345);

    const event: EngineEvent = {
      kind: 'run_started',
      runId,
      stepRunId: null,
      payload: { workflowId, providerId: 'minimax', graphSnapshotHash: 'hash-1', persistedStreamDeltas: false },
    };
    const result = okOrThrow(writeEngineEvent(event, { database, clock }));

    const rows = okOrThrow(database.events.readEventsSince(runId, 0, 10));
    const written = rows.find((row) => row.id === result.eventId);
    expect(written?.kind).toBe('run_started');
    expect(written?.stepRunId).toBeNull();
    expect(written?.occurredAtMs).toStrictEqual(new Date(12_345));
    expect(written?.payload).toStrictEqual(event.payload);

    database.close();
  });

  it('lépés szintű eseményt ír, a stepRunId és a payload a bemenetből jön', () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const stepRun = okOrThrow(
      database.stepRuns.createStepRun({
        runId,
        nodeId: 'node-agent',
        nodeType: 'agent_step',
        parentStepRunId: null,
        providerId: 'minimax',
        modelId: null,
        sessionMode: null,
        structuredOutputStrategy: null,
        subWorkflowRunId: null,
      }),
    );
    const clock = fakeClock(99_999);

    const event: EngineEvent = {
      kind: 'step_started',
      runId,
      stepRunId: stepRun.id,
      payload: { nodeId: 'node-agent', nodeType: 'agent_step', providerId: 'minimax', attempt: 1, iteration: 0 },
    };
    const result = okOrThrow(writeEngineEvent(event, { database, clock }));

    const rows = okOrThrow(database.events.readEventsForStep(stepRun.id, 10));
    const written = rows.find((row) => row.id === result.eventId);
    expect(written?.kind).toBe('step_started');
    expect(written?.stepRunId).toBe(stepRun.id);
    expect(written?.occurredAtMs).toStrictEqual(new Date(99_999));
    expect(written?.payload).toStrictEqual(event.payload);

    database.close();
  });

  it('not_found hibaágat ad ismeretlen runId-ra', () => {
    const database = openMemoryDatabase();
    const clock = fakeClock(0);

    const event: EngineEvent = {
      kind: 'run_started',
      runId: 'nincs-ilyen',
      stepRunId: null,
      payload: { workflowId: 'w', providerId: 'minimax', graphSnapshotHash: 'h', persistedStreamDeltas: false },
    };
    const outcome = writeEngineEvent(event, { database, clock });
    expect(isOkOutcome(outcome)).toBe(false);

    database.close();
  });
});

/**
 * A 13 kind lista fordítási időben ellenőrzött: az `EngineEvent['kind']`
 * típusra szűkített tömb csak ezt a 13 literált fogadja el, tehát ha egy ág
 * megszűnik, a tömb fordítási hibát ad. A darabszámot futásidejűleg a
 * `toHaveLength(13)` igazolja (SPEC-004 13. szekció, F-17: az
 * `sdk_context_usage` nincs köztük, mert nincs saját `EngineEvent` ága).
 * Ugyanaz a minta, mint a `run-event-repository.spec.ts` `ALL_ENGINE_KINDS`
 * tömbje.
 */
describe('EngineEvent kind unió', () => {
  const ALL_KINDS: readonly EngineEvent['kind'][] = [
    'run_started',
    'run_finished',
    'run_interrupted',
    'step_started',
    'step_finished',
    'branch_taken',
    'fan_out_expanded',
    'join_resolved',
    'loop_iteration_started',
    'approval_requested',
    'approval_decided',
    'sub_workflow_started',
    'sub_workflow_finished',
  ];

  it('pontosan 13 értéket tartalmaz', () => {
    expect(ALL_KINDS).toHaveLength(13);
  });
});
