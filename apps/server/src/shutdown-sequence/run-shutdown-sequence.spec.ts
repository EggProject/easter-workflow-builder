import { describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine, type TemplateRendererPort } from '@easter-workflow-builder/engine';
import { decodeStreamFrame, type StreamFrame } from '@easter-workflow-builder/protocol';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { runShutdownSequence } from './run-shutdown-sequence.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function collectingSink(): { readonly sink: DestinationStream; readonly lines: string[] } {
  const lines: string[] = [];
  return {
    sink: {
      write: (message: string) => {
        lines.push(message);
      },
    },
    lines,
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
}

function baseUrlOf(server: Server): string {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('A teszt szerver nem kapott portot.');
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

const PASS_THROUGH_TEMPLATE_RENDERER: TemplateRendererPort = {
  render: (template) => ({ kind: 'ok', value: template }),
  compile: () => ({ kind: 'ok', value: undefined }),
};

/**
 * Egy `start -> human_approval` workflow, korlátlan várakozással: a futás a
 * jóváhagyáson áll, amíg valaki meg nem szakítja.
 */
/* eslint-disable unicorn/no-null -- a leírás, a `timeoutMs` (korlátlan várakozás, SPEC-004 5.8) és az él kezelő és ág kulcs mezői valódi NULL értéket tárolnak (SPEC-003 4.4) */
function seedWaitingApprovalWorkflow(database: DatabaseContext): string {
  const workflow = okOrThrow(
    database.workflows.createWorkflow({ name: 'leallas', description: null, providerId: 'claude-subscription' }),
  );
  okOrThrow(
    database.workflows.replaceGraph(
      workflow.id,
      [
        {
          id: 'start',
          label: 'start',
          positionX: 0,
          positionY: 0,
          config: { type: 'start', inputFields: [], onUnhandledError: 'fail_run' },
        },
        {
          id: 'jov',
          label: 'jov',
          positionX: 0,
          positionY: 0,
          config: {
            type: 'human_approval',
            title: 'Döntés',
            bodyTemplate: 'szöveg',
            timeoutMs: null,
            onUnhandledError: 'fail_run',
          },
        },
      ],
      [
        {
          id: 'e1',
          sourceNodeId: 'start',
          targetNodeId: 'jov',
          sourceHandle: null,
          targetHandle: null,
          branchKey: null,
        },
      ],
    ),
  );
  return workflow.id;
}
/* eslint-enable unicorn/no-null */

/**
 * Az SSE folyam olvasása, amíg a `isDone` igazat nem ad a már beérkezett
 * keretekre, vagy a szerver le nem zárja a kapcsolatot. Minden `data:` sor a
 * `protocol` `decodeStreamFrame` ellenőrzésén megy át.
 */
async function readFramesUntil(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  isDone: (frames: readonly StreamFrame[]) => boolean,
): Promise<readonly StreamFrame[]> {
  const decoder = new TextDecoder();
  const frames: StreamFrame[] = [];
  let buffered = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return frames;
    }
    buffered += decoder.decode(value, { stream: true });
    const blocks = buffered.split('\n\n');
    buffered = blocks.pop() ?? '';
    for (const block of blocks) {
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine !== undefined) {
        const parsed: unknown = JSON.parse(dataLine.slice('data: '.length));
        frames.push(okOrThrow(decodeStreamFrame(parsed)));
      }
    }
    if (isDone(frames)) {
      return frames;
    }
  }
}

describe('runShutdownSequence', () => {
  it('sikeres leállásra minden lépést végrehajt és 0 kilépési kódot ad', async () => {
    const database = openMemoryDatabase();
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    const engine = createEngine(buildEngineDependencies(database, streamRegistry, clock));
    const server = createHttpServer({
      handlers: buildRouteHandlers(database, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    const exitCode = await runShutdownSequence({ server, engine, database, logger, streamRegistry });

    expect(exitCode).toBe(0);
    expect(lines.some((line) => line.includes('A szerver leállt.'))).toBe(true);
  });

  it('nyitott SSE kapcsolat mellett nem akad el, és a run_interrupted keret élőben kimegy, mielőtt a kapcsolat lezárul', async () => {
    const database = openMemoryDatabase();
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    // Az átengedő sablon renderelő az egyetlen eltérés a valódi
    // összeállítástól: a szállított, elutasító renderelő mellett a
    // `human_approval` lépés azonnal elbukna (SPEC-004 O-1), tehát nem lenne
    // várakozó futás, amit a leállás megszakíthat.
    const engine = createEngine({
      ...buildEngineDependencies(database, streamRegistry, clock),
      templateRenderer: PASS_THROUGH_TEMPLATE_RENDERER,
    });
    const server = createHttpServer({
      handlers: buildRouteHandlers(database, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);
    const workflowId = seedWaitingApprovalWorkflow(database);

    const stream = await fetch(`${baseUrlOf(server)}/events?streamId=s1`);
    const reader = stream.body?.getReader();
    if (reader === undefined) {
      throw new Error('a stream válasz nem olvasható');
    }
    const started = okOrThrow(await engine.startRun({ workflowId, input: {} }));
    streamRegistry.replaceSubscriptions('s1', [{ runId: started.run.id, fromEventId: 0, replayLimit: 500 }]);
    const beforeShutdown = await readFramesUntil(reader, (frames) =>
      frames.some((frame) => frame.event === 'run_event' && frame.runEvent.kind === 'approval_requested'),
    );

    const exitCode = await runShutdownSequence({ server, engine, database, logger, streamRegistry });
    const afterShutdown = await readFramesUntil(reader, () => false);

    expect(exitCode).toBe(0);
    const interruptedFrames = [...beforeShutdown, ...afterShutdown].filter(
      (frame) => frame.event === 'run_event' && frame.runEvent.kind === 'run_interrupted',
    );
    expect(interruptedFrames).toHaveLength(1);
    expect(interruptedFrames[0]).toMatchObject({
      delivery: 'live',
      runEvent: { runId: started.run.id, payload: { reason: 'graceful_shutdown' } },
    });
  });

  it('a motor leállási hibaágán 1 kilépési kódot ad, az adatbázist mégis zárja', async () => {
    const database = openMemoryDatabase();
    const racyDatabase: DatabaseContext = {
      ...database,
      recovery: {
        ...database.recovery,
        recoverInterruptedRuns: () => ({ kind: 'error', message: 'teszt: helyreállítási hiba' }),
      },
    };
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const clock = createSystemClock();
    const engine = createEngine(buildEngineDependencies(racyDatabase, streamRegistry, clock));
    const server = createHttpServer({
      handlers: buildRouteHandlers(racyDatabase, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database: racyDatabase, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
    });
    await listen(server);
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    const exitCode = await runShutdownSequence({ server, engine, database: racyDatabase, logger, streamRegistry });

    expect(exitCode).toBe(1);
    expect(lines.some((line) => line.includes('A motor leállása hibával zárult.'))).toBe(true);
  });
});
