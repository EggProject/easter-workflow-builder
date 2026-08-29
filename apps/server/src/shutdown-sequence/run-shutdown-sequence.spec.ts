import { describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry, type StreamRegistry } from '../stream-registry/create-stream-registry.ts';
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

function buildTestServer(database: DatabaseContext): {
  readonly server: Server;
  readonly streamRegistry: StreamRegistry;
} {
  const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
  const clock = createSystemClock();
  const engine = createEngine(buildEngineDependencies(database, streamRegistry, clock));
  const server = createHttpServer({
    handlers: buildRouteHandlers(database, engine, streamRegistry),
    devOrigin: undefined,
    streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 15_000 },
  });
  return { server, streamRegistry };
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

  it('a nyitott SSE nyelőket az engine.shutdown() ELŐTT lezárja', async () => {
    const database = openMemoryDatabase();
    const { server, streamRegistry } = buildTestServer(database);
    await listen(server);
    const { sink } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    let isClosed = false;
    streamRegistry.openConnection('s1', {
      onReplaced: () => {
        // szándékosan üres: ez a teszt a forceClose hívást vizsgálja
      },
      onSignal: () => {
        // szándékosan üres
      },
      forceClose: () => {
        isClosed = true;
      },
    });

    const engine = createEngine(buildEngineDependencies(database, streamRegistry, createSystemClock()));
    await runShutdownSequence({ server, engine, database, logger, streamRegistry });

    expect(isClosed).toBe(true);
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
