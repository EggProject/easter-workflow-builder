import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import process from 'node:process';
import type { EnvironmentReader } from '@easter-workflow-builder/core';
import { runStartupSequence } from './run-startup-sequence.ts';

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

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

async function waitUntil(isReady: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (isReady()) {
      return;
    }
    await yieldToEventLoop();
  }
  throw new Error('a feltétel nem teljesült időben');
}

function baseEnvironment(port: number, logDirectory: string): EnvironmentReader {
  return {
    EASTER_SERVER_PORT: String(port),
    EASTER_LOG_DIRECTORY: logDirectory,
    EASTER_LOG_ROTATION_SIZE: '10M',
    EASTER_LOG_ROTATION_FREQUENCY: 'daily',
    EASTER_LOG_RETAINED_FILE_COUNT: '5',
    EASTER_STREAM_KEEP_ALIVE_INTERVAL_MS: '15000',
    EASTER_DB_FILE: ':memory:',
    EASTER_SKILL_LIBRARY_DIRECTORY: path.join(logDirectory, 'skills'),
  };
}

describe('runStartupSequence', () => {
  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.exitCode = undefined;
  });

  it('megadott érvénytelen env változóra a szabványos hibakimenetre ír és 1-re állítja a kilépési kódot', async () => {
    // Az üres környezet az alapértékekkel érvényes konfiguráció (SPEC-012 4.2),
    // ezért a hibaágat egy megadott, de érvénytelen érték váltja ki.
    await runStartupSequence({ EASTER_SERVER_PORT: 'nem-szam' }, process.cwd());

    expect(process.exitCode).toBe(1);
  });

  it('érvénytelen plugin nevű skill könyvtárra nem indul el: a hibát a szabványos hibakimenetre írja, a kilépési kód 1 (SPEC-009 5.1)', async () => {
    const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'easter-server-log-'));
    const written: string[] = [];
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
      written.push(String(chunk));
      return true;
    });
    try {
      await runStartupSequence(
        {
          ...baseEnvironment(3999, logDirectory),
          EASTER_SKILL_LIBRARY_DIRECTORY: path.join(logDirectory, 'rossz,nev'),
        },
        process.cwd(),
      );
    } finally {
      writeSpy.mockRestore();
    }

    expect(process.exitCode).toBe(1);
    expect(written.join('')).toContain('("rossz,nev") a skill plugin neve');
    expect(written.join('')).toContain('(invalid_env_variable)');
  });

  it('olyan adatbázis útvonalra, aminek a könyvtára nem hozható létre, fatal naplóz és 1-re állítja a kilépési kódot', async () => {
    const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'easter-server-log-'));
    const blockingFile = fs.mkdtempSync(path.join(os.tmpdir(), 'easter-server-blocker-'));
    const blockingFilePath = path.join(blockingFile, 'nem-konyvtar');
    fs.writeFileSync(blockingFilePath, 'ez egy fájl, nem könyvtár');
    const unusablePort = await findFreePort();

    const environment: EnvironmentReader = {
      ...baseEnvironment(unusablePort, logDirectory),
      EASTER_DB_FILE: path.join(blockingFilePath, 'sub', 'db.sqlite'),
    };

    await runStartupSequence(environment, process.cwd());

    expect(process.exitCode).toBe(1);
  });

  it('valós, memóriabeli adatbázissal elindul, egy REST végpontot kiszolgál, majd SIGTERM-re szabályosan leáll', async () => {
    const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'easter-server-log-'));
    const port = await findFreePort();
    const environment: EnvironmentReader = { ...baseEnvironment(port, logDirectory), EASTER_LOG_LEVEL: 'debug' };

    await runStartupSequence(environment, process.cwd());
    expect(process.exitCode).toBeUndefined();

    const response = await fetch(`http://127.0.0.1:${String(port)}/api/workflows?limit=10`);
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual([]);

    process.emit('SIGTERM', 'SIGTERM');
    await waitUntil(() => process.exitCode !== undefined);
    expect(process.exitCode).toBe(0);
  });
});
