/* eslint-disable unicorn/no-null -- a `WorkflowRepository`/`CreateStepRunInput`/`NodeExecutionInstance` nullázható mezői (SPEC-003 5.1, 9.2, SPEC-004 4.3) a teszt fixture valódi kezdő értékei, nem helyőrzők */
import { describe, expect, it } from 'vitest';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { CreateStepRunInput, DatabaseContext, ErrorHandlerNodeConfig } from '@easter-workflow-builder/db';
import { openDatabase } from '@easter-workflow-builder/db';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import { executeErrorHandler, type ExecuteErrorHandlerInput } from './execute-error-handler.ts';
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
    database.workflows.createWorkflow({ name: 'execute-error-handler teszt', description: null, providerId: null }),
  );
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'minimax',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: '0.0.0-teszt',
        workflow: { id: workflow.id, name: workflow.name, description: null },
        nodes: [],
        edges: [],
      },
    }),
  );
  return { runId: run.id };
}

const notCalled = (): never => {
  throw new Error('ebben a tesztben nem hívott port');
};

interface SleepCall {
  readonly ms: number;
}

function fakeClock(sleepCalls: SleepCall[], onSleep?: () => void): ClockPort {
  let now = 0;
  return {
    nowMs: () => {
      now += 5;
      return now;
    },
    sleep: (ms) => {
      sleepCalls.push({ ms });
      onSleep?.();
      return Promise.resolve();
    },
  };
}

function portsOf(database: DatabaseContext, published: unknown[], clock: ClockPort): NodeExecutorPorts {
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
    templateRenderer: { render: notCalled, compile: notCalled },
  };
}

function handlerInstance(runId: string): NodeExecutionInstance {
  return {
    runId,
    instance: { nodeId: 'kezelo', branchContext: [] },
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
  };
}

function retryInput(runId: string): CreateStepRunInput {
  return {
    runId,
    nodeId: 'agent',
    nodeType: 'agent_step',
    parentStepRunId: null,
    iteration: 0,
    attempt: 1,
    providerId: 'minimax',
    modelId: 'MiniMax-M3',
    sessionMode: 'isolated',
    structuredOutputStrategy: null,
    subWorkflowRunId: null,
  };
}

interface HandlerCase {
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly handledErrorKinds?: readonly string[];
  readonly failedAttempt?: number;
}

// A config mezőit közvetlenül veszi át (nem egy külön `configOf` hívásból),
// hogy a tesztek hívásai ne lépjék át az `unicorn/max-nested-calls` hármas
// mélységét.
function inputOf(runId: string, handlerCase: HandlerCase): ExecuteErrorHandlerInput {
  const config: ErrorHandlerNodeConfig = {
    type: 'error_handler',
    maxAttempts: handlerCase.maxAttempts,
    backoffMs: handlerCase.backoffMs,
    handledErrorKinds: handlerCase.handledErrorKinds ?? [],
    onUnhandledError: 'fail_run',
  };
  return {
    instance: handlerInstance(runId),
    config,
    failedErrorKind: 'provider_call_failed',
    failedAttempt: handlerCase.failedAttempt ?? 1,
  };
}

// A hibát adó lépés eredeti, `failed` sora. A 8.1 zárómondata szerint ez a sor
// `failed` állapotban MARAD, tehát minden újrapróbálkozási teszt ezt is méri.
function seedFailedStepRun(database: DatabaseContext, runId: string): string {
  const created = okOrThrow(database.stepRuns.createStepRun(retryInput(runId)));
  okOrThrow(database.stepRuns.markStepRunning(created.id));
  okOrThrow(database.stepRuns.markStepFailed(created.id, 'provider_call_failed', 'teszt hiba (provider_call_failed).'));
  return created.id;
}

function cancelRunningStep(database: DatabaseContext, runId: string): void {
  const rows = okOrThrow(database.stepRuns.listStepRuns(runId));
  const running = rows.find((row) => row.status === 'running');
  if (running !== undefined) {
    database.stepRuns.markStepCancelled(running.id);
  }
}

describe('executeErrorHandler', () => {
  it('üres handledErrorKinds mindent kezel: a következő kísérlet sorszáma attempt + 1, az eredeti sor failed marad', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const failedStepRunId = seedFailedStepRun(database, runId);
    const sleepCalls: SleepCall[] = [];
    const ports = portsOf(database, [], fakeClock(sleepCalls));

    const outcome = okOrThrow(
      await executeErrorHandler(inputOf(runId, { maxAttempts: 3, backoffMs: [100, 200] }), ports),
    );

    expect(outcome.kind).toBe('retry_scheduled');
    expect(outcome.kind === 'retry_scheduled' ? outcome.nextAttempt : -1).toBe(2);
    expect(outcome.kind === 'retry_scheduled' ? outcome.stepRun.status : '').toBe('succeeded');
    // A megismételt lépés sorát NEM ez a végrehajtó írja (T-005-25): a
    // futásban csak a hibát adó lépés eredeti sora és a kezelő saját sora áll.
    expect(okOrThrow(database.stepRuns.listStepRuns(runId))).toHaveLength(2);
    expect(okOrThrow(database.stepRuns.getStepRun(failedStepRunId)).status).toBe('failed');
  });

  it('a backoffMs a clock porton fogy: a backoffMs[attempt - 1] elem megy a sleep hívásba', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const sleepCalls: SleepCall[] = [];
    const ports = portsOf(database, [], fakeClock(sleepCalls));

    okOrThrow(
      await executeErrorHandler(
        inputOf(runId, { maxAttempts: 4, backoffMs: [100, 200, 300], failedAttempt: 2 }),
        ports,
      ),
    );

    expect(sleepCalls).toStrictEqual([{ ms: 200 }]);
  });

  it('nem üres, nem illeszkedő handledErrorKinds esetén unhandled_error_kind hibaosztállyal zár', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const sleepCalls: SleepCall[] = [];
    const ports = portsOf(database, [], fakeClock(sleepCalls));

    const outcome = okOrThrow(
      await executeErrorHandler(
        inputOf(runId, { maxAttempts: 3, backoffMs: [100, 200], handledErrorKinds: ['template_render_failed'] }),
        ports,
      ),
    );

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('unhandled_error_kind');
    expect(outcome.kind === 'failed' ? outcome.stepRun.status : '').toBe('failed');
    expect(sleepCalls).toStrictEqual([]);
  });

  it('a kísérletek elfogyása után retry_exhausted, retry_attempts_exhausted hibaosztállyal', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const sleepCalls: SleepCall[] = [];
    const ports = portsOf(database, [], fakeClock(sleepCalls));

    const outcome = okOrThrow(
      await executeErrorHandler(inputOf(runId, { maxAttempts: 2, backoffMs: [100], failedAttempt: 2 }), ports),
    );

    expect(outcome.kind).toBe('retry_exhausted');
    expect(outcome.kind === 'retry_exhausted' ? outcome.errorKind : '').toBe('retry_attempts_exhausted');
    expect(outcome.kind === 'retry_exhausted' ? outcome.stepRun.status : '').toBe('failed');
    expect(sleepCalls).toStrictEqual([]);
  });

  it('hiányzó backoff elem esetén insufficient_backoff_list hibaosztállyal zár, kitalált várakozás nélkül', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const sleepCalls: SleepCall[] = [];
    const ports = portsOf(database, [], fakeClock(sleepCalls));

    const outcome = okOrThrow(await executeErrorHandler(inputOf(runId, { maxAttempts: 4, backoffMs: [] }), ports));

    expect(outcome.kind).toBe('failed');
    expect(outcome.kind === 'failed' ? outcome.errorKind : '').toBe('insufficient_backoff_list');
    expect(sleepCalls).toStrictEqual([]);
  });

  it('a begin fázis hibáját továbbadja (nem létező runId)', async () => {
    const database = openMemoryDatabase();
    const ports = portsOf(database, [], fakeClock([]));

    const outcome = await executeErrorHandler(
      inputOf('nincs-ilyen-futas', { maxAttempts: 3, backoffMs: [100, 200] }),
      ports,
    );

    expect(outcome.kind).toBe('error');
  });

  it('a sikeres lezárás Outcome hibáját továbbadja, ha a kezelő sora a várakozás alatt más állapotba kerül', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const ports = portsOf(
      database,
      [],
      fakeClock([], () => {
        cancelRunningStep(database, runId);
      }),
    );

    const outcome = await executeErrorHandler(inputOf(runId, { maxAttempts: 3, backoffMs: [100, 200] }), ports);

    expect(outcome.kind).toBe('error');
  });

  it('a hibás lezárás Outcome hibáját továbbadja, ha a kezelő sora időközben más állapotba kerül', async () => {
    const database = openMemoryDatabase();
    const { runId } = seedRun(database);
    const racyDatabase: DatabaseContext = {
      ...database,
      stepRuns: {
        ...database.stepRuns,
        markStepFailed: (id, errorKind, errorMessage, markInput) => {
          database.stepRuns.markStepCancelled(id);
          return database.stepRuns.markStepFailed(id, errorKind, errorMessage, markInput);
        },
      },
    };
    const ports = portsOf(racyDatabase, [], fakeClock([]));

    const outcome = await executeErrorHandler(
      inputOf(runId, { maxAttempts: 2, backoffMs: [100], failedAttempt: 2 }),
      ports,
    );

    expect(outcome.kind).toBe('error');
  });
});
