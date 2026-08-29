/* eslint-disable unicorn/no-null -- az AppendEngineEventInput.stepRunId mezője valódi string | null, futás szintű eseményre null */
import { describe, expect, it } from 'vitest';
import type { ClockPort } from '@easter-workflow-builder/engine';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { handleStreamConnection, type StreamConnectionDependencies } from './handle-stream-connection.ts';
import type { StreamSink } from './stream-sink.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function createTestRun(database: DatabaseContext): string {
  const workflow = okOrThrow(database.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null }));
  okOrThrow(
    database.workflows.replaceGraph(
      workflow.id,
      [
        {
          id: 'start-1',
          label: 'Start',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: null },
        },
      ],
      [],
    ),
  );
  const graph = okOrThrow(database.workflows.readGraph(workflow.id));
  const run = okOrThrow(
    database.runs.startRun({
      workflowId: workflow.id,
      input: {},
      providerId: 'claude-subscription',
      graphSnapshotDocument: {
        version: 1,
        sdkVersionPin: 'test',
        workflow: { id: workflow.id, name: workflow.name, description: workflow.description },
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          type: 'start',
          label: node.label,
          position: { x: node.positionX, y: node.positionY },
          config: node.config,
          effectiveProviderId: 'claude-subscription',
        })),
        edges: [],
      },
    }),
  );
  return run.id;
}

function appendEvent(database: DatabaseContext, runId: string): number {
  return okOrThrow(database.events.appendEngineEvent({ runId, stepRunId: null, kind: 'run_started', payload: {} }))
    .eventId;
}

/**
`origin: 'sdk'` esemény, a `toWireOrigin` mindkét ágának lefedéséhez (a `appendEvent` `'engine'` ágat ad).
*/
function appendSdkEvent(database: DatabaseContext, runId: string): number {
  const appended = okOrThrow(
    database.events.appendSdkEvent({ runId, stepRunId: null, message: { type: 'assistant', message: {} } }),
  );
  if (appended.status !== 'written') {
    throw new Error('váratlanul kihagyott SDK esemény');
  }
  return appended.eventId;
}

function buildFakeSink(): { readonly sink: StreamSink; readonly chunks: string[]; readonly isClosed: () => boolean } {
  const chunks: string[] = [];
  let isClosed = false;
  return {
    sink: {
      write: (chunk) => {
        chunks.push(chunk);
      },
      close: () => {
        isClosed = true;
      },
    },
    chunks,
    isClosed: () => isClosed,
  };
}

function buildControllableClock(): {
  readonly clock: ClockPort;
  readonly calls: number[];
  readonly triggerTick: () => void;
} {
  let resolveCurrent: (() => void) | undefined;
  const calls: number[] = [];
  const clock: ClockPort = {
    nowMs: () => 0,
    sleep: (ms, signal) => {
      calls.push(ms);
      return new Promise((resolve, reject) => {
        resolveCurrent = resolve;
        signal.addEventListener(
          'abort',
          () => {
            reject(new Error('megszakítva'));
          },
          { once: true },
        );
      });
    },
  };
  return {
    clock,
    calls,
    triggerTick: () => {
      const resolver = resolveCurrent;
      resolveCurrent = undefined;
      resolver?.();
    },
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

function buildDependencies(database: DatabaseContext, clock: ClockPort): StreamConnectionDependencies {
  return {
    database,
    registry: createStreamRegistry(createRandomUuidIdGenerator()),
    clock,
    keepAliveIntervalMs: 30_000,
  };
}

describe('handleStreamConnection', () => {
  it('az első keret mindig stream_ready, a jelenlegi feliratkozásokkal', () => {
    const database = openMemoryDatabase();
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId: 'run-x', fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);

    expect(chunks[0]).toContain('event: stream_ready');
    expect(chunks[0]).toContain('"streamId":"s1"');
    expect(chunks[0]).toContain(dependencies.registry.serverInstanceId);
    expect(chunks[0]).toContain('"runId":"run-x"');
  });

  it('sdk eredetű esemény pótlására a keret origin mezője "sdk" (a toWireOrigin másik ága)', () => {
    const database = openMemoryDatabase();
    // A createTestRun (database.runs.startRun) már beszúr egy run_started
    // eseményt (1. azonosítóval, origin: engine); a fromEventId: 1 ezt hagyja ki,
    // hogy a pótlás kizárólag az itt hozzáadott sdk eseményt lássa.
    const runId = createTestRun(database);
    appendSdkEvent(database, runId);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 1, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);

    const replayed = chunks.find((chunk) => chunk.includes('"delivery":"replayed"'));
    expect(replayed).toContain('"origin":"sdk"');
  });

  it('a pótlás lapozva megy, amíg a lap tele jön vissza, majd replay_complete-tel zár', () => {
    const database = openMemoryDatabase();
    // A createTestRun már beszúr egy run_started eseményt (1. azonosítóval);
    // a fromEventId: 1 ezt hagyja ki, hogy a pótlás pontosan az itt hozzáadott
    // öt eseményt lássa.
    const runId = createTestRun(database);
    for (let index = 0; index < 5; index += 1) {
      appendEvent(database, runId);
    }
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 1, replayLimit: 2 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);

    const replayed = chunks.filter((chunk) => chunk.includes('"delivery":"replayed"'));
    expect(replayed).toHaveLength(5);
    const complete = chunks.find((chunk) => chunk.includes('event: replay_complete'));
    expect(complete).toBeDefined();
    expect(complete).not.toContain('"throughEventId":null');
  });

  it('nulla pótolt eseményre is replay_complete megy, throughEventId null értékkel', () => {
    const database = openMemoryDatabase();
    // A createTestRun már beszúr egy run_started eseményt (1. azonosítóval);
    // a fromEventId: 1 ezt hagyja ki, hogy a pótlás ténylegesen nulla eseményt
    // lásson.
    const runId = createTestRun(database);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 1, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);

    const complete = chunks.find((chunk) => chunk.includes('event: replay_complete'));
    expect(complete).toContain('"throughEventId":null');
  });

  it('nem egész Last-Event-ID fejlécre protocol_error keretet küld runId null mezővel, a nyelő nyitva marad', () => {
    const database = openMemoryDatabase();
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    const { sink, chunks, isClosed } = buildFakeSink();

    handleStreamConnection('s1', 'nem-szam', sink, dependencies);

    const errorFrame = chunks.find((chunk) => chunk.includes('event: protocol_error'));
    expect(errorFrame).toBeDefined();
    expect(errorFrame).toContain('"runId":null');
    expect(isClosed()).toBe(false);
  });

  it('a padló és az egész Last-Event-ID fejléc közül a nagyobbtól pótol (max szabály)', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const firstId = appendEvent(database, runId);
    appendEvent(database, runId);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', String(firstId), sink, dependencies);

    const replayed = chunks.filter((chunk) => chunk.includes('"delivery":"replayed"'));
    expect(replayed).toHaveLength(1);
  });

  it('élő jelzésre a lecsapolt sorok delivery live jelöléssel mennek ki', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    appendEvent(database, runId);
    dependencies.registry.notifyRunChanged({ runId, transientFrame: undefined });

    const live = chunks.filter((chunk) => chunk.includes('"delivery":"live"'));
    expect(live).toHaveLength(1);
  });

  it('üres lecsapolásra, ha van transientFrame jelölt, azt küldi ki', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    dependencies.registry.notifyRunChanged({
      runId,
      transientFrame: {
        event: 'run_event_transient',
        runId,
        stepRunId: 'step-1',
        kind: 'sdk_stream_event',
        occurredAtMs: 1,
        payload: {},
      },
    });

    expect(chunks.some((chunk) => chunk.includes('event: run_event_transient'))).toBe(true);
  });

  it('üres lecsapolásra transientFrame nélkül semmit nem küld', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    const before = chunks.length;
    dependencies.registry.notifyRunChanged({ runId, transientFrame: undefined });

    expect(chunks).toHaveLength(before);
  });

  it('nem figyelt futásra érkező jelzést figyelmen kívül hagy', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    const before = chunks.length;
    dependencies.registry.notifyRunChanged({ runId: 'masik-run', transientFrame: undefined });

    expect(chunks).toHaveLength(before);
  });

  it('a feliratkozás bővítése (PUT kapcsolat közben) az újonnan felvett futásra pótol', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    appendEvent(database, runId);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    expect(chunks.some((chunk) => chunk.includes('"delivery":"replayed"'))).toBe(false);

    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);

    expect(chunks.some((chunk) => chunk.includes('"delivery":"replayed"'))).toBe(true);
  });

  it('a feliratkozás szűkítése után a korábban figyelt futásra érkező jelzést már nem küldi ki', () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    dependencies.registry.replaceSubscriptions('s1', []);
    const before = chunks.length;
    appendEvent(database, runId);
    dependencies.registry.notifyRunChanged({ runId, transientFrame: undefined });

    expect(chunks).toHaveLength(before);
  });

  it('az életben tartás a clock porton megy, és a nyelőre megjegyzés sort ír', async () => {
    const database = openMemoryDatabase();
    const { clock, calls, triggerTick } = buildControllableClock();
    const dependencies = buildDependencies(database, clock);
    const { sink, chunks } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, { ...dependencies, keepAliveIntervalMs: 5000 });
    expect(calls).toStrictEqual([5000]);

    triggerTick();
    await flushMicrotasks();

    expect(chunks.some((chunk) => chunk.startsWith(': keep-alive'))).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('handleClientClosed leállítja az életben tartást és leiratkozik, további jelzés nem ír a nyelőre', async () => {
    const database = openMemoryDatabase();
    const runId = createTestRun(database);
    const { clock, calls } = buildControllableClock();
    const dependencies = buildDependencies(database, clock);
    dependencies.registry.replaceSubscriptions('s1', [{ runId, fromEventId: 0, replayLimit: 10 }]);
    const { sink, chunks } = buildFakeSink();

    const connection = handleStreamConnection('s1', undefined, sink, dependencies);
    connection.handleClientClosed();
    await flushMicrotasks();

    const before = chunks.length;
    appendEvent(database, runId);
    dependencies.registry.notifyRunChanged({ runId, transientFrame: undefined });

    expect(chunks).toHaveLength(before);
    expect(calls).toHaveLength(1);
  });

  it('a szerver kényszerített lezárása (forceClose) leállítja az életben tartást és zárja a nyelőt', () => {
    const database = openMemoryDatabase();
    const dependencies = buildDependencies(database, buildControllableClock().clock);
    const { sink, isClosed } = buildFakeSink();

    handleStreamConnection('s1', undefined, sink, dependencies);
    dependencies.registry.closeAllConnections();

    expect(isClosed()).toBe(true);
  });
});
