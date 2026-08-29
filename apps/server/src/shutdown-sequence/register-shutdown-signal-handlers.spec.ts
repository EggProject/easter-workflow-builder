import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import process from 'node:process';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createEngine } from '@easter-workflow-builder/engine';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { buildEngineDependencies } from '../engine-assembly/build-engine-dependencies.ts';
import { registerShutdownSignalHandlers } from './register-shutdown-signal-handlers.ts';

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
      // szándékosan üres: ez a teszt a process.exitCode beállítását vizsgálja, nem a naplózott sorokat
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

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function waitForExitCode(): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (process.exitCode !== undefined) {
      return;
    }
    await yieldToEventLoop();
  }
  throw new Error('a process.exitCode nem állt be a leállás után');
}

describe('registerShutdownSignalHandlers', () => {
  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.exitCode = undefined;
  });

  it('SIGINT jelre lefuttatja a leállási sorrendet és beállítja a process.exitCode-ot', async () => {
    const database = openMemoryDatabase();
    const engine = createEngine(buildEngineDependencies(database));
    const server = createHttpServer({ handlers: buildRouteHandlers(database), devOrigin: undefined });
    await listen(server);
    const logger = createServerLogger({ secretValues: [] }, noopSink());

    registerShutdownSignalHandlers({ server, engine, database, logger });
    process.emit('SIGINT', 'SIGINT');
    await waitForExitCode();

    expect(process.exitCode).toBe(0);
  });
});
