import { describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { createIdempotentShutdownHandler } from './create-idempotent-shutdown-handler.ts';

function okOrThrow<TValue>(outcome: Outcome<TValue>): TValue {
  if (!isOkOutcome(outcome)) {
    throw new Error(`váratlan hibaág: ${outcome.message}`);
  }
  return outcome.value;
}

function openMemoryDatabase(): DatabaseContext {
  return okOrThrow(openDatabase(':memory:'));
}

function noopSink(): DestinationStream {
  return {
    write: () => {
      // szándékosan üres: ez a teszt a leállás Promise azonosságát vizsgálja, nem a naplózott sorokat
    },
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
}

describe('createIdempotentShutdownHandler', () => {
  it('a második hívás ugyanazt a Promise-t adja, mint az első, nem indít újabb leállást', async () => {
    const database = openMemoryDatabase();
    const engine = createEngine(buildEngineDependencies(database));
    const server = createHttpServer({ handlers: buildRouteHandlers(database), devOrigin: undefined });
    await listen(server);
    const logger = createServerLogger({ secretValues: [] }, noopSink());

    const shutdown = createIdempotentShutdownHandler({ server, engine, database, logger });

    const first = shutdown();
    const second = shutdown();

    expect(first).toBe(second);
    await expect(first).resolves.toBe(0);
  });
});
