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

/**
 * Egy döntésre váró jóváhagyás a futásban: `waiting_approval` sor,
 * `decision` NULL (`interrupt-run.spec.ts` mintája).
 */
function seedWaitingApproval(database: DatabaseContext, runId: string): string {
  const stepRunId = okOrThrow(
    database.stepRuns.createStepRun({
      runId,
      nodeId: `jov-${runId}`,
      nodeType: 'human_approval',
      parentStepRunId: null,
      providerId: 'minimax',
      modelId: null,
      sessionMode: null,
      structuredOutputStrategy: null,
      subWorkflowRunId: null,
    }),
  ).id;
  okOrThrow(database.stepRuns.markStepRunning(stepRunId));
  okOrThrow(database.approvals.requestApproval({ runId, stepRunId, title: 'döntés', body: 'szöveg', payload: {} }));
  return stepRunId;
}

const RESOLVED_SUCCESS: Outcome<RunCompletion> = {
  kind: 'ok',
  value: { status: 'succeeded', errorKind: null, errorMessage: null, failedBranchCount: 0 },
};

function handleOf(run: WorkflowRunRecord): ActiveRunHandle & { readonly requestStop: ReturnType<typeof vi.fn> } {
  const requestStop = vi.fn<ActiveRunHandle['requestStop']>();
  return {
    runId: run.id,
    rootRunId: run.rootRunId,
    workflowId: run.workflowId,
    completion: Promise.resolve(RESOLVED_SUCCESS),
    requestStop,
    stopTargetStatus: () => requestStop.mock.calls[0]?.[0],
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

/**
 * A `published` tömb a kiadott események naplója, ugyanaz a minta, mint az
 * `interrupt-run.spec.ts` `dependenciesOf` függvényében.
 */
function dependenciesOf(
  database: DatabaseContext,
  handles: readonly ActiveRunHandle[],
  agentQueryRegistry: ReturnType<typeof createAgentQueryRegistry>,
  published: unknown[] = [],
  calls: string[] = [],
): ShutdownActiveRunsDependencies {
  const runSupervisor: Pick<RunSupervisor, 'listActiveRuns' | 'stopAcceptingRuns'> = {
    listActiveRuns: () => {
      calls.push('listActiveRuns');
      return handles;
    },
    stopAcceptingRuns: () => {
      calls.push('stopAcceptingRuns');
    },
  };
  return {
    database,
    eventPublisher: {
      publish: (event) => {
        published.push(event);
      },
    },
    runSupervisor,
    concurrencyGate: {
      close: () => {
        calls.push('concurrencyGate.close');
      },
      denyWaitingForRunIds: () => {
        calls.push('concurrencyGate.denyWaitingForRunIds');
      },
    },
    agentQueryRegistry,
    approvalRegistry: createApprovalWaitRegistry(),
  };
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
    expect(firstHandle.requestStop).toHaveBeenCalledExactlyOnceWith('interrupted');
    expect(secondHandle.requestStop).toHaveBeenCalledExactlyOnceWith('interrupted');
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
    const published: unknown[] = [];
    const result = okOrThrow(await shutdownActiveRuns(dependenciesOf(database, [trackedHandle], registry, published)));

    expect(result.recoveredRunCount).toBe(2);
    // Az élő kiadás a helyreállítás hatókörét követi, nem a kézikönyvekét:
    // a nem nyilvántartott futás lezáró eseménye is kimegy (SPEC-004 10.2).
    expect(published).toHaveLength(2);
    for (const runId of [tracked.run.id, untracked.run.id]) {
      expect(published).toContainEqual({
        kind: 'run_interrupted',
        runId,
        stepRunId: null,
        payload: { reason: 'graceful_shutdown' },
      });
      expect(okOrThrow(database.events.readEventsSince(runId, 0, 10)).map((row) => row.kind)).toContain(
        'run_interrupted',
      );
    }
    expect(interruptSpy).toHaveBeenCalledTimes(1);
    expect(okOrThrow(database.runs.getRun(tracked.run.id)).status).toBe('interrupted');
    expect(okOrThrow(database.runs.getRun(untracked.run.id)).status).toBe('interrupted');

    database.close();
  });

  it('az aktív futások lekérdezése ELŐTT tiltja le az új futást és zárja le a szabályozót (SPEC-004 10.2 1. pont)', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const calls: string[] = [];

    okOrThrow(await shutdownActiveRuns(dependenciesOf(database, [], registry, [], calls)));

    expect(calls).toStrictEqual([
      'stopAcceptingRuns',
      'concurrencyGate.close',
      'listActiveRuns',
      'concurrencyGate.denyWaitingForRunIds',
    ]);

    database.close();
  });

  it('üres aktív futás listára is lefuttatja a db oldali helyreállítást (nincs mit megszakítani, de a helyreállítás fut)', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();

    const published: unknown[] = [];
    const result = okOrThrow(await shutdownActiveRuns(dependenciesOf(database, [], registry, published)));

    expect(result.recoveredRunCount).toBe(0);
    expect(published).toStrictEqual([]);

    database.close();
  });

  it('megvárja MINDEN kapott kézikönyv completion Promise-át, mielőtt a db oldali zárás lefut', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database, 'lassu');
    const { promise: completion, resolve } = Promise.withResolvers<Outcome<RunCompletion>>();
    // Ez a teszt a sorrendet vizsgálja, nem a jelzést.
    const handle: ActiveRunHandle = { ...handleOf(seeded.run), completion };

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
    // Ez a teszt a lezárt kapcsolat hibaágát vizsgálja, nem a requestStop hívást.
    const handle: ActiveRunHandle = {
      ...handleOf(seeded.run),
      completion: (async () => {
        await Promise.resolve();
        database.close();
        return RESOLVED_SUCCESS;
      })(),
    };

    const published: unknown[] = [];
    const outcome = await shutdownActiveRuns(dependenciesOf(database, [handle], registry, published));

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('database_closed');
    // A DB zárás nem sikerült, tehát nincs mit élőben kiadni.
    expect(published).toStrictEqual([]);
  });

  it('REGRESSZIÓ: az aktív futások döntésre váró jóváhagyásának sora már a futó lépések leállásának kivárása ELŐTT interrupted (SPEC-004 10.2 3. pont, 8.3)', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const active = seedRootRun(database, 'aktiv');
    // Kézikönyv nélküli futás: nincs végrehajtója, ami a döntést várná, a
    // sorát a helyreállítás tranzakciója zárja.
    const orphan = seedRootRun(database, 'kezikonyv-nelkul');
    const activeApproval = seedWaitingApproval(database, active.run.id);
    const orphanApproval = seedWaitingApproval(database, orphan.run.id);
    const statuses = (): readonly string[] =>
      [activeApproval, orphanApproval].map((id) => okOrThrow(database.stepRuns.getStepRun(id)).status);
    // A futó lépés leállása a teszt kezében van: amíg a `completion` nem
    // teljesül, a leállás a leállási ablakban áll.
    const { promise: completion, resolve: finishRun } = Promise.withResolvers<Outcome<RunCompletion>>();
    const handle: ActiveRunHandle = { ...handleOf(active.run), completion };

    const shuttingDown = shutdownActiveRuns(dependenciesOf(database, [handle], registry));

    expect(statuses()).toStrictEqual(['interrupted', 'waiting_approval']);
    const late = database.approvals.decideApproval({ stepRunId: activeApproval, decision: 'approved' });
    expect(late.kind === 'error' ? late.message : '').toContain('(illegal_status_transition)');

    finishRun(RESOLVED_SUCCESS);
    okOrThrow(await shuttingDown);
    expect(statuses()).toStrictEqual(['interrupted', 'interrupted']);
    expect(okOrThrow(database.approvals.getApprovalForStep(activeApproval)).decision).toBeNull();

    database.close();
  });

  it('a jóváhagyás sorok lezárásának hibáját továbbadja, és sem a futásokat nem állítja le, sem a helyreállítást nem futtatja', async () => {
    const database = openMemoryDatabase();
    const registry = createAgentQueryRegistry();
    const seeded = seedRootRun(database, 'olvasasi-hiba');
    const { query, interruptSpy } = fakeQuery();
    registry.register(seeded.run.id, seeded.step.id, query);
    const handle = handleOf(seeded.run);
    const failing: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        listStepRuns: () => ({ kind: 'error', message: 'teszt: a lépés sorok nem olvashatók' }),
      },
    };

    const published: unknown[] = [];
    const outcome = await shutdownActiveRuns(dependenciesOf(failing, [handle], registry, published));

    expect(outcome.kind === 'error' ? outcome.message : '').toBe('teszt: a lépés sorok nem olvashatók');
    expect(handle.requestStop).not.toHaveBeenCalled();
    expect(interruptSpy).not.toHaveBeenCalled();
    expect(okOrThrow(database.runs.getRun(seeded.run.id)).status).toBe('running');
    expect(published).toStrictEqual([]);

    database.close();
  });
});
