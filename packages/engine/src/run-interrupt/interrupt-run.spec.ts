/* eslint-disable unicorn/no-null -- a `GraphSnapshotDocument.workflow.description` és a `RunCompletion` `succeeded` ágának mezői (SPEC-003 5.1, error-policy/run-completion.ts) itt tárolt `null` értéket hordoznak, nem helyőrző `undefined`-et */
import { describe, expect, it, vi } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type {
  DatabaseContext,
  GraphSnapshotDocument,
  StepRunRecord,
  WorkflowRunRecord,
} from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { AgentQuery } from '@easter-workflow-builder/agent';
import type { RunCompletion } from '../error-policy/run-completion.ts';
import type { ActiveRunHandle } from '../run-supervisor/active-run-registry.ts';
import type { RunSupervisor } from '../run-supervisor/run-supervisor.ts';
import { createAgentQueryRegistry } from './agent-query-registry.ts';
import { interruptRun } from './interrupt-run.ts';
import type { InterruptRunDependencies } from './interrupt-run.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function snapshotOf(workflowId: string, workflowName: string): GraphSnapshotDocument {
  return {
    version: 1,
    sdkVersionPin: '0.0.0-teszt',
    workflow: { id: workflowId, name: workflowName, description: null },
    nodes: [],
    edges: [],
  };
}

interface SeededRun {
  readonly run: WorkflowRunRecord;
  readonly step: StepRunRecord;
}

/**
 * Egy gyökér futás, egy `running` lépéssel. A `status` `running` (az
 * alapértelmezett) vagy `pending`: az utóbbi a "megszakítás indulás előtt"
 * esetkört szimulálja (SPEC-004 9. szekció).
 */
function seedRootRun(database: DatabaseContext, status: 'running' | 'pending' = 'running'): SeededRun {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'gyoker', description: null, providerId: null }),
  );
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshotOf(workflow.id, workflow.name),
    }),
  );
  const step = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'a',
      nodeType: 'agent_step',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: 'modell-1',
      sessionMode: 'isolated',
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  if (status === 'pending') {
    return { run, step };
  }
  const runningRun = okOrThrow(database.runs.markRunRunning(run.id));
  const runningStep = okOrThrow(database.stepRuns.markStepRunning(step.id));
  return { run: runningRun, step: runningStep };
}

/**
 * Egy al-workflow futás, azonos gyökérrel, mint a `root`, egy `running`
 * lépéssel.
 */
function seedChildRun(database: DatabaseContext, root: WorkflowRunRecord): SeededRun {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'gyerek', description: null, providerId: null }),
  );
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: snapshotOf(workflow.id, workflow.name),
      parent: { rootRunId: root.rootRunId, depth: root.depth, workflowAncestry: root.workflowAncestry },
    }),
  );
  const step = okOrThrow(
    database.stepRuns.createStepRun({
      runId: run.id,
      nodeId: 'gy-a',
      nodeType: 'agent_step',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: 'modell-1',
      sessionMode: 'isolated',
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  );
  const runningRun = okOrThrow(database.runs.markRunRunning(run.id));
  const runningStep = okOrThrow(database.stepRuns.markStepRunning(step.id));
  return { run: runningRun, step: runningStep };
}

const RESOLVED_SUCCESS: Outcome<RunCompletion> = {
  kind: 'ok',
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};

/**
 * Egy már lezárt `completion`-nel bíró kézikönyv: a várakozás sorrendje nem
 * ennek a fájlnak a tárgya (lásd `stop-and-await-run-tree.spec.ts`).
 */
function handleOf(run: WorkflowRunRecord): ActiveRunHandle & { readonly requestStop: ReturnType<typeof vi.fn> } {
  const requestStop = vi.fn();
  return {
    runId: run.id,
    rootRunId: run.rootRunId,
    workflowId: run.workflowId,
    completion: Promise.resolve(RESOLVED_SUCCESS),
    requestStop,
    isStopRequested: () => requestStop.mock.calls.length > 0,
  };
}

function fakeQuery(): { query: AgentQuery; interruptSpy: ReturnType<typeof vi.fn> } {
  const interruptSpy = vi.fn(() => Promise.resolve());
  return {
    query: {
      messages: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) },
      interrupt: interruptSpy,
    },
    interruptSpy,
  };
}

function dependenciesOf(
  database: DatabaseContext,
  handles: readonly ActiveRunHandle[],
  agentQueryRegistry: ReturnType<typeof createAgentQueryRegistry>,
): InterruptRunDependencies {
  const runSupervisor: Pick<RunSupervisor, 'listActiveRuns'> = { listActiveRuns: () => handles };
  return { database, runSupervisor, agentQueryRegistry };
}

describe('interruptRun', () => {
  it('ismeretlen runId-ra a not_found hiba változatlanul az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();

    const outcome = await interruptRun('nincs-ilyen-futas', dependenciesOf(database, [], registry));

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('not_found');

    database.close();
  });

  it('a cél futáson requestStop és interrupt fut, és cancelled állapotban zár egy run_finished eseménnyel', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database);
    const { query, interruptSpy } = fakeQuery();
    registry.register(seeded.run.id, seeded.step.id, query);
    const handle = handleOf(seeded.run);

    const outcome = okOrThrow(await interruptRun(seeded.run.id, dependenciesOf(database, [handle], registry)));

    expect(outcome.rootRunId).toBe(seeded.run.rootRunId);
    expect(outcome.cancelledRunIds).toStrictEqual([seeded.run.id]);
    expect(handle.requestStop).toHaveBeenCalledTimes(1);
    expect(interruptSpy).toHaveBeenCalledTimes(1);

    const runRow = okOrThrow(database.runs.getRun(seeded.run.id));
    expect(runRow.status).toBe('cancelled');
    const stepRow = okOrThrow(database.stepRuns.getStepRun(seeded.step.id));
    expect(stepRow.status).toBe('cancelled');

    const events = okOrThrow(database.events.readEventsSince(seeded.run.id, 0, 10));
    const finished = events.filter((event) => event.kind === 'run_finished');
    expect(finished).toHaveLength(1);
    expect(finished[0]?.payload).toStrictEqual({
      status: 'cancelled',
      errorKind: null,
      errorMessage: null,
      failedBranchCount: 0,
    });

    database.close();
  });

  it('egy másik futás fáját nem érinti: sem requestStop, sem interrupt nem fut rajta, a DB-je is érintetlen marad', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const target = seedRootRun(database);
    const other = seedRootRun(database);
    const { query: targetQuery, interruptSpy: targetInterrupt } = fakeQuery();
    const { query: otherQuery, interruptSpy: otherInterrupt } = fakeQuery();
    registry.register(target.run.id, target.step.id, targetQuery);
    registry.register(other.run.id, other.step.id, otherQuery);
    const targetHandle = handleOf(target.run);
    const otherHandle = handleOf(other.run);

    await interruptRun(target.run.id, dependenciesOf(database, [targetHandle, otherHandle], registry));

    expect(targetInterrupt).toHaveBeenCalledTimes(1);
    expect(otherInterrupt).not.toHaveBeenCalled();
    expect(otherHandle.requestStop).not.toHaveBeenCalled();

    const otherRunRow = okOrThrow(database.runs.getRun(other.run.id));
    expect(otherRunRow.status).toBe('running');

    database.close();
  });

  it('az al-workflow fáján is lefut az interrupt(), és mindkét futás cancelled állapotban zár egy tranzakcióban', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const root = seedRootRun(database);
    const child = seedChildRun(database, root.run);
    const { query: rootQuery, interruptSpy: rootInterrupt } = fakeQuery();
    const { query: childQuery, interruptSpy: childInterrupt } = fakeQuery();
    registry.register(root.run.id, root.step.id, rootQuery);
    registry.register(child.run.id, child.step.id, childQuery);
    const rootHandle = handleOf(root.run);
    const childHandle = handleOf(child.run);

    // A célazonosító a GYEREK futásé: a fa gyökere innen is felderíthető.
    const outcome = okOrThrow(
      await interruptRun(child.run.id, dependenciesOf(database, [rootHandle, childHandle], registry)),
    );

    expect(new Set(outcome.cancelledRunIds)).toStrictEqual(new Set([root.run.id, child.run.id]));
    expect(rootInterrupt).toHaveBeenCalledTimes(1);
    expect(childInterrupt).toHaveBeenCalledTimes(1);
    expect(rootHandle.requestStop).toHaveBeenCalledTimes(1);
    expect(childHandle.requestStop).toHaveBeenCalledTimes(1);

    expect(okOrThrow(database.runs.getRun(root.run.id)).status).toBe('cancelled');
    expect(okOrThrow(database.runs.getRun(child.run.id)).status).toBe('cancelled');
    expect(okOrThrow(database.stepRuns.getStepRun(root.step.id)).status).toBe('cancelled');
    expect(okOrThrow(database.stepRuns.getStepRun(child.step.id)).status).toBe('cancelled');

    database.close();
  });

  it('pending futásra (nincs aktív kézikönyv) is lezárja a DB-t, közvetlen pending -> cancelled átmenettel', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database, 'pending');

    const outcome = okOrThrow(await interruptRun(seeded.run.id, dependenciesOf(database, [], registry)));

    expect(outcome.cancelledRunIds).toStrictEqual([seeded.run.id]);
    expect(okOrThrow(database.runs.getRun(seeded.run.id)).status).toBe('cancelled');

    database.close();
  });

  it('már teljesen terminális célra üres cancelledRunIds, hiba nélkül', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database);
    okOrThrow(database.stepRuns.markStepSucceeded(seeded.step.id));
    okOrThrow(database.runs.markRunSucceeded(seeded.run.id));

    const outcome = okOrThrow(await interruptRun(seeded.run.id, dependenciesOf(database, [], registry)));

    expect(outcome.cancelledRunIds).toStrictEqual([]);
    expect(okOrThrow(database.runs.getRun(seeded.run.id)).status).toBe('succeeded');

    database.close();
  });

  it('a database.recovery.cancelRunTree hibaága változatlanul az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database);
    // Valódi, nem mockolt hibaforrás: a `completion` a várakozás közben
    // ténylegesen lezárja a kapcsolatot, ugyanaz a menet, mint a valós
    // szerver leállásnál (SPEC-004 9. szekció) - a `stopAndAwaitRunTree`
    // `await Promise.all(...)`-ja után a `cancelRunTree` a már zárt
    // kapcsolaton fut, a `transaction` `isClosed` ága valódi
    // `database_closed` hibát ad (`open-database.ts`).
    const handle: ActiveRunHandle = {
      runId: seeded.run.id,
      rootRunId: seeded.run.rootRunId,
      workflowId: seeded.run.workflowId,
      completion: (async () => {
        await Promise.resolve();
        database.close();
        return RESOLVED_SUCCESS;
      })(),
      requestStop: () => {
        // szándékosan nem csinál semmit: ez a teszt a lezárt kapcsolat
        // hibaágát vizsgálja, nem a requestStop hívást
      },
      isStopRequested: () => false,
    };

    const outcome = await interruptRun(seeded.run.id, dependenciesOf(database, [handle], registry));

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('database_closed');
  });
});
