/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`WorkflowRunRepository` és a `HumanApprovalNodeConfig`/`NodeExecutionInstance` nullázható mezői (SPEC-003 5.1, 4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { ApprovalDecision, DatabaseContext } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import { isRecord } from '@easter-workflow-builder/typeguards';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { ApprovalWaitRegistry } from './approval-wait-registry.ts';
import { createApprovalWaitRegistry } from './approval-wait-registry.ts';
import { executeHumanApproval, type ExecuteHumanApprovalInput } from './execute-human-approval.ts';
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
    database.workflows.createWorkflow({ name: 'execute-human-approval teszt', description: null, providerId: null }),
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

function fakeClock(sleep: ClockPort['sleep'] = notCalled): ClockPort {
  let now = 0;
  return {
    nowMs: () => {
      now += 5;
      return now;
    },
    sleep,
  };
}

function portsOf(
  database: DatabaseContext,
  published: unknown[],
  render: TemplateRendererPort['render'],
  clock: ClockPort = fakeClock(),
): NodeExecutorPorts {
  const publisher: EventPublisherPort = {
    publish: (event) => {
      published.push(event);
    },
  };
  return {
    database,
    clock,
    idGenerator: { nextId: notCalled },
    eventPublisher: publisher,
    expressionEvaluator: { evaluate: notCalled, compile: notCalled },
    templateRenderer: { render, compile: notCalled },
  };
}

function instanceOf(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'approval', branchContext: [] },
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

function inputOf(runId: string, timeoutMs: number | null = null): ExecuteHumanApprovalInput {
  return {
    instance: instanceOf(runId),
    config: {
      type: 'human_approval',
      title: 'Jóváhagyás szükséges',
      bodyTemplate: 'sablon',
      timeoutMs,
      onUnhandledError: 'fail_run',
    },
    runContext: emptyRunContext,
  };
}

const okRender: TemplateRendererPort['render'] = () => ({ kind: 'ok', value: 'renderelt szöveg' });

/**
 * Az `eventPublisher.publish(event: unknown)` port miatt a `published` tömb
 * eleme `unknown` (`event-publisher-port.ts` doksija). A projekt
 * `isRecord` typeguardjával szűkítve olvassuk ki az `approval_decided`
 * esemény `payload.decision` mezőjét, `as`/`any` nélkül.
 */
function findApprovalDecidedDecision(published: readonly unknown[]): unknown {
  const event = published.find((candidate) => isRecord(candidate) && candidate['kind'] === 'approval_decided');
  if (!isRecord(event) || !isRecord(event['payload'])) {
    return undefined;
  }
  return event['payload']['decision'];
}

function cancelRunningStep(database: DatabaseContext, runId: string): void {
  const rows = okOrThrow(database.stepRuns.listStepRuns(runId));
  const running = rows.find((row) => row.status === 'running');
  if (running !== undefined) {
    database.stepRuns.markStepCancelled(running.id);
  }
}

/**
 * Egy `createApprovalWaitRegistry`-t burkol: a `waitForDecision` regisztráció
 * megtörténte UTÁN, egy mikrotaszkban lefuttatja, amit éles futásban a
 * jövőbeli `decideApproval` motor művelet (T-005-28) tenne - ELŐSZÖR a `db`
 * `approvals.decideApproval(...)`-t (ez maga viszi a lépést `waiting_approval
 * -> succeeded`/`rejected` állapotba, `human-approval-repository.ts`
 * doksija), és CSAK ez UTÁN a `notifyDecided`-et. A sorrend lényegi: az
 * `execute-human-approval.ts` a döntés érkezésekor `getStepRun`-nal olvassa
 * vissza a sort, tehát a DB állapotváltásnak a `notifyDecided` előtt meg kell
 * történnie, különben a visszaolvasott sor még `waiting_approval` maradna.
 */
function registryDecidingImmediately(database: DatabaseContext, decision: ApprovalDecision): ApprovalWaitRegistry {
  const real = createApprovalWaitRegistry();
  return {
    waitForDecision: (stepRunId) => {
      const pending = real.waitForDecision(stepRunId);
      queueMicrotask(() => {
        okOrThrow(database.approvals.decideApproval({ stepRunId, decision }));
        real.notifyDecided(stepRunId, decision);
      });
      return pending;
    },
    notifyDecided: (stepRunId, decidedAs) => {
      real.notifyDecided(stepRunId, decidedAs);
    },
    cancelWait: (stepRunId) => {
      real.cancelWait(stepRunId);
    },
  };
}

/**
 * Egy `createApprovalWaitRegistry`-t burkol, ami a `cancelWait` hívásokat a
 * `calls` tömbbe gyűjti, a tényleges törlést változatlanul elvégezve.
 */
function registryTrackingCancelWait(calls: string[]): ApprovalWaitRegistry {
  const real = createApprovalWaitRegistry();
  return {
    waitForDecision: (stepRunId) => real.waitForDecision(stepRunId),
    notifyDecided: (stepRunId, decision) => {
      real.notifyDecided(stepRunId, decision);
    },
    cancelWait: (stepRunId) => {
      calls.push(stepRunId);
      real.cancelWait(stepRunId);
    },
  };
}

describe('executeHumanApproval', () => {
  it('korlátlan várakozás (timeoutMs: null): a döntésig vár, nincs sleep hívás, approved eredmény', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, okRender);
    const registry = registryDecidingImmediately(database, 'approved');

    const outcome = okOrThrow(await executeHumanApproval(inputOf(runId), ports, registry));

    expect(outcome.kind).toBe('approval_decided');
    expect(outcome.kind === 'approval_decided' ? outcome.decision : 'nincs-dontes').toBe('approved');
    expect(outcome.kind === 'approval_decided' ? outcome.stepRun.status : 'nincs-allapot').toBe('succeeded');
    expect(published).toContainEqual(expect.objectContaining({ kind: 'approval_requested' }));
    expect(findApprovalDecidedDecision(published)).toBe('approved');
  });

  it('elutasítás - a hívóra van bízva, hogy van-e kimenő rejected él: a kimenet ekkor is helyesen "rejected"-et jelez', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, okRender);
    const registry = registryDecidingImmediately(database, 'rejected');

    const outcome = okOrThrow(await executeHumanApproval(inputOf(runId), ports, registry));

    expect(outcome.kind).toBe('approval_decided');
    expect(outcome.kind === 'approval_decided' ? outcome.decision : 'nincs-dontes').toBe('rejected');
    expect(outcome.kind === 'approval_decided' ? outcome.stepRun.status : 'nincs-allapot').toBe('rejected');
  });

  it('elutasítás - akkor is helyesen jelez, ha a gráfban egyébként NINCS kimenő rejected él (az élválasztást a hívó végzi)', async () => {
    // Ugyanaz a végrehajtó kimenet, mint a fenti teszt: ez a végrehajtó nem kapja meg,
    // van-e kimenő `rejected` branch_key él (SPEC-004 5.8 utolsó pontja), ezért a
    // viselkedése attól függetlenül azonos, hogy a hívó gráfjában van-e ilyen él.
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, okRender);
    const registry = registryDecidingImmediately(database, 'rejected');

    const outcome = okOrThrow(await executeHumanApproval(inputOf(runId), ports, registry));

    expect(outcome.kind).toBe('approval_decided');
    expect(outcome.kind === 'approval_decided' ? outcome.decision : 'nincs-dontes').toBe('rejected');
  });

  it('időkorlátos várakozás, a döntés ELŐBB érkezik: a sleep megszakad (controller.abort), nem fut le a timeout hibaág', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const aborted = { value: false };
    const clock = fakeClock(
      (_ms, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              aborted.value = true;
              reject(new Error('megszakítva'));
            },
            { once: true },
          );
        }),
    );
    const ports = portsOf(database, published, okRender, clock);
    const registry = registryDecidingImmediately(database, 'approved');

    const outcome = okOrThrow(await executeHumanApproval(inputOf(runId, 60_000), ports, registry));

    expect(outcome.kind).toBe('approval_decided');
    expect(outcome.kind === 'approval_decided' ? outcome.decision : 'nincs-dontes').toBe('approved');
    expect(aborted.value).toBe(true);
  });

  it('időkorlátos várakozás, a LEJÁRAT érkezik előbb: failed approval_timed_out osztállyal, decision NULL marad', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const clock = fakeClock(() => Promise.resolve());
    const ports = portsOf(database, published, okRender, clock);
    const cancelWaitCalls: string[] = [];
    const registry = registryTrackingCancelWait(cancelWaitCalls);

    const outcome = okOrThrow(await executeHumanApproval(inputOf(runId, 1000), ports, registry));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-hiba').toBe('approval_timed_out');
    expect(outcome.kind === 'failed' ? outcome.stepRun.status : 'nincs-allapot').toBe('failed');
    expect(cancelWaitCalls).toStrictEqual([outcome.kind === 'failed' ? outcome.stepRun.id : 'nincs-step-run-id']);

    const approval = okOrThrow(
      database.approvals.getApprovalForStep(outcome.kind === 'failed' ? outcome.stepRun.id : 'nincs-step-run-id'),
    );
    expect(approval.decision).toBeNull();
  });

  it('a bodyTemplate renderelésének hibáját template_render_failed osztállyal zárja', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => ({ kind: 'error', message: 'teszt renderelési hiba' }));
    const registry = createApprovalWaitRegistry();

    const outcome = okOrThrow(await executeHumanApproval(inputOf(runId), ports, registry));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : 'nincs-hiba').toBe('template_render_failed');
  });

  it('a hiba lezárásának Outcome hibáját továbbadja, ha a sor időközben más állapotba kerül', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'error', message: 'teszt renderelési hiba' };
    });
    const registry = createApprovalWaitRegistry();

    const outcome = await executeHumanApproval(inputOf(runId), ports, registry);

    expect(outcome.kind).toBe('error');
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', async () => {
    const database = openMemoryDatabase();
    const published: unknown[] = [];
    const ports = portsOf(database, published, notCalled);
    const registry = createApprovalWaitRegistry();

    const outcome = await executeHumanApproval(inputOf('nincs-ilyen-futas'), ports, registry);

    expect(outcome.kind).toBe('error');
  });

  it('a requestApproval hibáját továbbadja, ha a lépés a renderelés és a kérés között más állapotba kerül', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const ports = portsOf(database, published, () => {
      cancelRunningStep(database, runId);
      return { kind: 'ok', value: 'renderelt szöveg' };
    });
    const registry = createApprovalWaitRegistry();

    const outcome = await executeHumanApproval(inputOf(runId), ports, registry);

    expect(outcome.kind).toBe('error');
  });

  it('az approval_requested esemény írásának hibáját továbbadja', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    let appendCount = 0;
    const racyDatabase: DatabaseContext = {
      ...database,
      events: {
        ...database.events,
        appendEngineEvent: (input) => {
          appendCount += 1;
          if (appendCount === 2) {
            database.close();
          }
          return database.events.appendEngineEvent(input);
        },
      },
    };
    const ports = portsOf(racyDatabase, published, okRender);
    const registry = createApprovalWaitRegistry();

    const outcome = await executeHumanApproval(inputOf(runId), ports, registry);

    expect(outcome.kind).toBe('error');
  });

  it('a getStepRun hibáját továbbadja, miután a döntés megérkezett', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        getStepRun: () => ({ kind: 'error', message: 'teszt: a step_run nem olvasható vissza' }),
      },
    };
    const ports = portsOf(racyDatabase, published, okRender);
    const registry = registryDecidingImmediately(database, 'approved');

    const outcome = await executeHumanApproval(inputOf(runId), ports, registry);

    expect(outcome.kind).toBe('error');
  });

  it('az approval_decided esemény írásának hibáját továbbadja', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const published: unknown[] = [];
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
    const ports = portsOf(racyDatabase, published, okRender);
    const registry = registryDecidingImmediately(database, 'approved');

    const outcome = await executeHumanApproval(inputOf(runId), ports, registry);

    expect(outcome.kind).toBe('error');
  });
});
