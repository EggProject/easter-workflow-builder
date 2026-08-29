import { afterEach, describe, expect, it } from 'vitest';
import net from 'node:net';
import process from 'node:process';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { openDatabase, type DatabaseContext } from '@easter-workflow-builder/db';
import { createServerLogger, type DestinationStream } from '@easter-workflow-builder/logger';
import type { ServerConfig } from '../server-config/server-config.ts';
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
});
