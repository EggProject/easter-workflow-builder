import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import { createEngine } from '@easter-workflow-builder/engine';
import type { AgentQueryRunner } from '@easter-workflow-builder/agent';
import {
  createCelExpressionEvaluator,
  createMustacheTemplateRenderer,
} from '@easter-workflow-builder/workflow-language';
import type { ServerConfig } from '../server-config/server-config.ts';
import { buildProviderDescriptorLookup } from '../engine-assembly/build-provider-descriptor-lookup.ts';
import { createRealEventPublisher } from '../engine-assembly/create-real-event-publisher.ts';
import { createRandomUuidIdGenerator } from '../engine-assembly/create-random-uuid-id-generator.ts';
import { createProcessEnvironmentReader } from '../engine-assembly/create-process-environment-reader.ts';
import { createSkillLibraryReader } from '../engine-assembly/create-skill-library-reader.ts';
import { createSystemClock } from '../engine-assembly/create-system-clock.ts';
import { createStreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { buildRouteHandlers } from '../route-registry/build-route-handlers.ts';
import { createHttpServer } from '../http-server/create-http-server.ts';
import { continueStartupWithDatabase } from './continue-startup-with-database.ts';
import { PROBE_PORT_REPORT_PREFIX } from './probe-port-report.ts';
import { readListeningPort } from './read-listening-port.ts';
import { TEST_SKILL_LIBRARY } from '../skill-endpoint/test-skill-library.ts';
import { TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER } from '../engine-assembly/test-structured-output-schema-compiler.ts';
import { quickJsScriptRunner } from '../script-runner/quickjs-script-runner.ts';

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
    skillLibraryDirectory: '/nem-hasznalt-skill-konyvtar',
    skillMaxArchiveBytes: 30_000_000,
    skillMaxUnpackedBytes: 30_000_000,
    skillMaxEntryCount: 1024,
  };
}

/**
 * A szerver stdout jelentéseinek gyűjtése (`probe-port-report.ts`): a 0 portra
 * kötött szerver a ténylegesen lekötött portot itt jelenti.
 */
function captureStandardOutput(): { readonly written: string[]; readonly restore: () => void } {
  const written: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    written.push(String(chunk));
    return true;
  });
  return {
    written,
    restore: () => {
      spy.mockRestore();
    },
  };
}

function reportedPort(written: readonly string[]): number {
  const line = written.find((chunk) => chunk.startsWith(PROBE_PORT_REPORT_PREFIX));
  if (line === undefined) {
    throw new Error('a szerver nem jelentette a portját');
  }
  return Number(line.slice(PROBE_PORT_REPORT_PREFIX.length));
}

describe('continueStartupWithDatabase', () => {
  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.exitCode = undefined;
  });

  it('0 portra az operációs rendszer választ portot: a lekötött portot a stdout első sorában jelenti és naplózza, ott kiszolgál, 0 kilépési kóddal (SPEC-012 5.1)', async () => {
    const database = openMemoryDatabase();
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);
    const output = captureStandardOutput();

    try {
      await continueStartupWithDatabase(database, baseConfig(0), logger);
    } finally {
      output.restore();
    }

    const port = reportedPort(output.written);
    expect(output.written[0]).toBe(`${PROBE_PORT_REPORT_PREFIX}${String(port)}\n`);
    expect(port).toBeGreaterThan(0);
    expect(lines.some((line) => line.includes('A szerver elindult') && line.includes(`"port":${String(port)}`))).toBe(
      true,
    );
    const response = await fetch(`http://127.0.0.1:${String(port)}/api/providers`);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    expect(process.exitCode).toBeUndefined();
  });

  it('a kapcsolatok fogadása előtt törli a skill könyvtár gyökerének .staging-* maradékait (ZIP 8. találat)', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'skill-indulas-'));
    await mkdir(path.join(root, '.staging-maradek', 'ref'), { recursive: true });
    await mkdir(path.join(root, 'skills', 'jelentes'), { recursive: true });
    const database = openMemoryDatabase();
    const { sink, lines } = collectingSink();
    const logger = createServerLogger({ secretValues: [] }, sink);

    await continueStartupWithDatabase(database, { ...baseConfig(0), skillLibraryDirectory: root }, logger);

    expect(lines.some((line) => line.includes('A szerver elindult'))).toBe(true);
    expect(existsSync(path.join(root, '.staging-maradek'))).toBe(false);
    expect(existsSync(path.join(root, 'skills', 'jelentes'))).toBe(true);
    await rm(root, { recursive: true, force: true });
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
    // A foglaló szerver az operációs rendszertől kap portot és végig tartja,
    // tehát a foglalt port nem szabadulhat fel a próba előtt.
    const occupier = net.createServer();
    await new Promise<void>((resolve) => {
      occupier.listen(0, '127.0.0.1', () => {
        resolve();
      });
    });
    const port = readListeningPort(occupier);

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
      structuredOutputSchemaCompiler: TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER,
      scriptRunner: quickJsScriptRunner,
      expressionEvaluator: createCelExpressionEvaluator(),
      templateRenderer: createMustacheTemplateRenderer(),
      eventPublisher: createRealEventPublisher(streamRegistry, clock),
      clock,
      idGenerator: createRandomUuidIdGenerator(),
      processEnvironment: createProcessEnvironmentReader(),
      skillLibrary: createSkillLibraryReader(TEST_SKILL_LIBRARY.rootDirectory),
    });

    const { sink } = collectingSink();
    const server = createHttpServer({
      handlers: buildRouteHandlers(
        database,
        engine,
        streamRegistry,
        TEST_SKILL_LIBRARY,
        TEST_STRUCTURED_OUTPUT_SCHEMA_COMPILER,
      ),
      devOrigin: undefined,
      streamDependencies: { database, registry: streamRegistry, clock, keepAliveIntervalMs: 30_000 },
      logger: createServerLogger({ secretValues: [] }, sink),
      idGenerator: createRandomUuidIdGenerator(),
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
