import { afterEach, describe, expect, it } from 'vitest';
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
    EASTER_DB_FILE: ':memory:',
  };
}

describe('runStartupSequence', () => {
  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    process.exitCode = undefined;
  });

  it('hiányzó kötelező env változóra a szabványos hibakimenetre ír és 1-re állítja a kilépési kódot', async () => {
    await runStartupSequence({}, process.cwd());

    expect(process.exitCode).toBe(1);
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
