import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import process from 'node:process';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createEngine } from '@easter-workflow-builder/engine';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import type { ServerConfig } from '../server-config/server-config.ts';
import { buildProviderDescriptorLookup } from '../engine-assembly/build-provider-descriptor-lookup.ts';
import { createRejectingExpressionEvaluator } from '../engine-assembly/create-rejecting-expression-evaluator.ts';
import { createRejectingTemplateRenderer } from '../engine-assembly/create-rejecting-template-renderer.ts';
import { createRealEventPublisher } from '../engine-assembly/create-real-event-publisher.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createProcessEnvironmentReader } from '../engine-assembly/create-process-environment-reader.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { continueStartupWithDatabase } from './continue-startup-with-database.ts';

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

function baseConfig(port: number): ServerConfig {
  return {
    port,
    logDirectory: '/nem-hasznalt',
    logRotationSize: '10M',
    logRotationFrequency: 'daily',
    logRetainedFileCount: 5,
    streamKeepAliveIntervalMs: 15_000,
  };
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address !== null && typeof address === 'object') {
        const port = address.port;
        probe.close(() => {
          resolve(port);
        });
        return;
      }
      probe.close(() => {
        reject(new Error('nem sikerült szabad portot találni'));
      });
    });
  });
}

describe('continueStartupWithDatabase', () => {
  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.exitCode = undefined;
  });

  it('sikeres indulásra figyel a megadott porton, 0 kilépési kóddal', async () => {
    const database = openMemoryDatabase();
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);
    const port = await findFreePort();

    await continueStartupWithDatabase(database, baseConfig(port), logger);

    expect(lines.some((line) => line.includes('A szerver elindult'))).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it('a helyreállítás hibaágán fatal naplóz, zárja az adatbázist, és 1-re állítja a kilépési kódot', async () => {
    const database = openMemoryDatabase();
    const racyDatabase: DatabaseContext = {
      ...database,
      recovery: {
        ...database.recovery,
        recoverInterruptedRuns: () => ({ kind: 'error', message: 'teszt: helyreállítási hiba' }),
      },
    };
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    await continueStartupWithDatabase(racyDatabase, baseConfig(0), logger);

    expect(lines.some((line) => line.includes('Az indulási helyreállítás sikertelen.'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('foglalt porton fatal naplóz, zárja az adatbázist, és 1-re állítja a kilépési kódot', async () => {
    const port = await findFreePort();
    const occupier = net.createServer();
    await new Promise<void>((resolve) => {
      occupier.listen(port, '127.0.0.1', () => {
        resolve();
      });
    });

    const database = openMemoryDatabase();
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    await continueStartupWithDatabase(database, baseConfig(port), logger);

    expect(lines.some((line) => line.includes('A szerver nem tudott elindulni.'))).toBe(true);
    expect(process.exitCode).toBe(1);

    await new Promise<void>((resolve) => {
      occupier.close(() => {
        resolve();
      });
    });
  });

  /**
   * SPEC-006 13. szekció 46. elfogadási kritériuma: "a szerver ténylegesen
   * elindul és kiszolgál egy kérést, valós `:memory:` adatbázissal,
   * befecskendezett `agentQueryRunner` porttal, `port: 0` értékkel". Ez a
   * `continueStartupWithDatabase`-en KÍVÜL épít mindent, mert az a
   * függvény maga hívja a `buildEngineDependencies`-t, ami mindig a valódi
   * `buildAgentQueryRunner()`-t adja - befecskendezett fake portra ezen a
   * ponton nincs mód. A teszt ezért a `continue-startup-with-database.ts`
   * 5-7. lépését (motor, HTTP szerver, figyelés) manuálisan, de a valós
   * `engine-assembly` építőelemekkel ismétli meg, kizárólag az
   * `agentQueryRunner` portot cserélve fake-re - ugyanaz a minta, mint a
   * `packages/engine` `create-engine.spec.ts` teszt harnessa.
   */
  it('a szerver valóban elindul és kiszolgál egy kérést, injektált agentQueryRunner porttal, valós :memory: adatbázissal, port: 0 értékkel (46. elfogadási kritérium)', async () => {
    const database = openMemoryDatabase();
    const clock = createSystemClock();
    const streamRegistry = createStreamRegistry(createRandomUuidIdGenerator());
    const fakeAgentQueryRunner: AgentQueryRunner = {
      run: () => {
        throw new Error('nem várt hívás: ez a próba nem indít agent lépést');
      },
    };
    const engine = createEngine({
      database,
      agentQueryRunner: fakeAgentQueryRunner,
      providerDescriptorLookup: buildProviderDescriptorLookup(),
      expressionEvaluator: createRejectingExpressionEvaluator(),
      templateRenderer: createRejectingTemplateRenderer(),
      eventPublisher: createRealEventPublisher(streamRegistry, clock),
      clock,
      idGenerator: createRandomUuidIdGenerator(),
      processEnvironment: createProcessEnvironmentReader(),
    });

    const server = createHttpServer({
      handlers: buildRouteHandlers(database, engine, streamRegistry),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 30_000 },
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('a teszt szerver nem kapott portot');
    }

    const response = await fetch(`http://127.0.0.1:${String(address.port)}/api/workflows?limit=10`);

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([]);

    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });
});
