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
import { shutdownActiveRuns } from './shutdown-active-runs.ts';
import type { ShutdownActiveRunsDependencies } from './shutdown-active-runs.ts';
import { createApprovalWaitRegistry } from '../node-executor/approval-wait-registry.ts';

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
 * Egy gyökér futás, egy `running` lépéssel. Ugyanaz a minta, mint az
 * `interrupt-run.spec.ts` `seedRootRun`-ja.
 */
function seedRootRun(database: DatabaseContext, name: string): SeededRun {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name, description: null, providerId: null }));
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
  const runningRun = okOrThrow(database.runs.markRunRunning(run.id));
  const runningStep = okOrThrow(database.stepRuns.markStepRunning(step.id));
  return { run: runningRun, step: runningStep };
}

const RESOLVED_SUCCESS: Outcome<RunCompletion> = {
  kind: 'ok',
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};

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
): ShutdownActiveRunsDependencies {
  const runSupervisor: Pick<RunSupervisor, 'listActiveRuns'> = { listActiveRuns: () => handles };
  return { database, runSupervisor, agentQueryRegistry, approvalRegistry: createApprovalWaitRegistry() };
}

describe('shutdownActiveRuns', () => {
  it('minden aktív futáson requestStop-ot és interrupt()-et hív, majd interrupted állapotban zár egy run_interrupted eseménnyel', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const first = seedRootRun(database, 'elso');
    const second = seedRootRun(database, 'masodik');
    const { query: firstQuery, interruptSpy: firstInterrupt } = fakeQuery();
    const { query: secondQuery, interruptSpy: secondInterrupt } = fakeQuery();
    registry.register(first.run.id, first.step.id, firstQuery);
    registry.register(second.run.id, second.step.id, secondQuery);
    const firstHandle = handleOf(first.run);
    const secondHandle = handleOf(second.run);

    const result = okOrThrow(await shutdownActiveRuns(dependenciesOf(database, [firstHandle, secondHandle], registry)));

    expect(result.recoveredRunCount).toBe(2);
    expect(firstHandle.requestStop).toHaveBeenCalledTimes(1);
    expect(secondHandle.requestStop).toHaveBeenCalledTimes(1);
    expect(firstInterrupt).toHaveBeenCalledTimes(1);
    expect(secondInterrupt).toHaveBeenCalledTimes(1);

    for (const seeded of [first, second]) {
      expect(okOrThrow(database.runs.getRun(seeded.run.id)).status).toBe('interrupted');
      expect(okOrThrow(database.stepRuns.getStepRun(seeded.step.id)).status).toBe('interrupted');
      const events = okOrThrow(database.events.readEventsSince(seeded.run.id, 0, 10));
      const interrupted = events.filter((event) => event.kind === 'run_interrupted');
      expect(interrupted).toHaveLength(1);
      expect(interrupted[0]?.payload).toStrictEqual({ reason: 'graceful_shutdown' });
    }

    database.close();
  });

  it('a db oldali hatókör a TELJES adatbázisra terjed, nem csak a kapott kézikönyvekre: egy nem regisztrált running futás is interrupted lesz', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const tracked = seedRootRun(database, 'nyilvantartott');
    const untracked = seedRootRun(database, 'nem-nyilvantartott');
    const { query, interruptSpy } = fakeQuery();
    registry.register(tracked.run.id, tracked.step.id, query);
    const trackedHandle = handleOf(tracked.run);

    // Az `untracked` futásra SZÁNDÉKOSAN nincs kézikönyv a listában: a
    // `recoverInterruptedRuns` mégis eléri, mert a hatóköre a teljes
    // adatbázis, nem a `listActiveRuns()` listája (10.1/10.2 szekció).
    const result = okOrThrow(await shutdownActiveRuns(dependenciesOf(database, [trackedHandle], registry)));

    expect(result.recoveredRunCount).toBe(2);
    expect(interruptSpy).toHaveBeenCalledTimes(1);
    expect(okOrThrow(database.runs.getRun(tracked.run.id)).status).toBe('interrupted');
    expect(okOrThrow(database.runs.getRun(untracked.run.id)).status).toBe('interrupted');

    database.close();
  });

  it('üres aktív futás listára is lefuttatja a db oldali helyreállítást (nincs mit megszakítani, de a helyreállítás fut)', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();

    const result = okOrThrow(await shutdownActiveRuns(dependenciesOf(database, [], registry)));

    expect(result.recoveredRunCount).toBe(0);

    database.close();
  });

  it('megvárja MINDEN kapott kézikönyv completion Promise-át, mielőtt a db oldali zárás lefut', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database, 'lassu');
    const { promise: completion, resolve } = Promise.withResolvers<Outcome<RunCompletion>>();
    const handle: ActiveRunHandle = {
      runId: seeded.run.id,
      rootRunId: seeded.run.rootRunId,
      workflowId: seeded.run.workflowId,
      completion,
      requestStop: () => {
        // nincs teendő: ez a teszt a sorrendet vizsgálja, nem a jelzést
      },
      isStopRequested: () => false,
    };

    let hasSettled = false;
    const call = (async (): Promise<void> => {
      await shutdownActiveRuns(dependenciesOf(database, [handle], registry));
      hasSettled = true;
    })();

    await Promise.resolve();
    await Promise.resolve();
    expect(hasSettled).toBe(false);
    expect(okOrThrow(database.runs.getRun(seeded.run.id)).status).toBe('running');

    resolve(RESOLVED_SUCCESS);
    await call;
    expect(hasSettled).toBe(true);
    expect(okOrThrow(database.runs.getRun(seeded.run.id)).status).toBe('interrupted');

    database.close();
  });

  it('a database.recovery.recoverInterruptedRuns hibaága változatlanul az Outcome hibaágán jelenik meg', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database, 'zart-kapcsolat');
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

    const outcome = await shutdownActiveRuns(dependenciesOf(database, [handle], registry));

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('database_closed');
  });
});
