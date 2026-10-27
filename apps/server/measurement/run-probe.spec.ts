import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REDACTED } from './mask-secrets.ts';
import { runProbe } from './run-probe.ts';

/**
 * A próba ellenőrzése valódi provider nélkül (PLAN-013 T-013-9): a gyermek
 * szerver a hamis ágenses szerver (`stub-agent-server.ts`): a valódi
 * `apps/server` HTTP réteg, útvonalak, stream nyilvántartás, motor és
 * fájl adatbázis, csak az ágens port hamis. A teljes REST és stream út tehát
 * hívás nélkül igazolt. Valódi `src/main.ts` és valódi SDK a T-013-10
 * (user engedély) dolga, ez a fájl azt nem indítja.
 */

const STUB_COMMAND = {
  executable: process.execPath,
  args: [fileURLToPath(new URL('stub-agent-server.ts', import.meta.url))],
};
const FAKE_SECRET = 'hamis-titok-nem-valodi';

function probeDirectories(): readonly string[] {
  return readdirSync(tmpdir()).filter((name) => name.startsWith('easter-probe-'));
}

describe('runProbe a hamis ágenses szerver ellen', () => {
  let requestDirectory: string;
  let requestFile: string;

  beforeEach(() => {
    requestDirectory = mkdtempSync(path.join(tmpdir(), 'easter-probe-spec-'));
    requestFile = path.join(requestDirectory, 'request.json');
  });

  afterEach(() => {
    rmSync(requestDirectory, { recursive: true, force: true });
  });

  function readRequest(): Record<string, unknown> {
    const parsed: unknown = JSON.parse(readFileSync(requestFile, 'utf8'));
    if (!isRecord(parsed)) {
      throw new Error('a rögzített kérés nem objektum');
    }
    return parsed;
  }

  function probe(
    providerId: 'minimax' | 'claude-subscription',
    extraEnvironment: NodeJS.ProcessEnv = {},
    signal: AbortSignal = new AbortController().signal,
    modelId?: string,
  ): ReturnType<typeof runProbe> {
    return runProbe({
      providerId,
      ...(modelId !== undefined && { modelId }),
      serverCommand: STUB_COMMAND,
      environment: {
        ...process.env,
        ANTHROPIC_AUTH_TOKEN: FAKE_SECRET,
        STUB_AGENT_REQUEST_FILE: requestFile,
        ...extraEnvironment,
      },
      secretValues: [FAKE_SECRET],
      signal,
    });
  }

  it('minimax: a futás sikeres, az összegzés a hamis ágens üzeneteiből áll, a kérés az 5.1 táblázat szerinti', async () => {
    const summary = await probe('minimax');
    expect(summary.runStatus).toBe('succeeded');
    expect(summary.stepStatus).toBe('succeeded');
    expect(summary.resultSubtype).toBe('success');
    expect(summary.numTurns).toBe(1);
    expect(summary.outputTextLength).toBe('hamis ágens válasz'.length);
    expect(summary.errorClass).toBeUndefined();

    const request = readRequest();
    expect(request['maxTurns']).toBe(1);
    // A leíró `clientModelIdentifier` mezője a kliensnek átadott alak (M-11, M-29, M-32).
    expect(request['model']).toBe('MiniMax-M3.1-Flash[1m]');
    expect(request['hasMaxBudgetUsd']).toBe(false);
    expect(JSON.stringify(summary)).not.toContain(FAKE_SECRET);
  });

  it('claude-subscription: modell nélkül a motor model_not_selected hibával elutasítja a futást (nincs hívás)', async () => {
    await expect(probe('claude-subscription')).rejects.toThrow(/model_not_selected/);
  });

  it('claude-subscription: a megadott modellel fut', async () => {
    const summary = await probe('claude-subscription', {}, new AbortController().signal, 'claude-haiku-4-5');
    expect(summary.runStatus).toBe('succeeded');
    const request = readRequest();
    expect(request['maxTurns']).toBe(1);
    expect(request['model']).toBe('claude-haiku-4-5');
    expect(request['hasMaxBudgetUsd']).toBe(false);
  });

  it('a szerver ideiglenes adatbázissal és napló útvonallal fut, ami a futás végén törlődik', async () => {
    await probe('minimax');
    const request = readRequest();
    const databaseFile = request['dbFile'];
    const logDirectory = request['logDirectory'];
    const temporaryPrefix = path.join(tmpdir(), 'easter-probe-');
    expect(String(databaseFile).startsWith(temporaryPrefix)).toBe(true);
    expect(String(logDirectory).startsWith(temporaryPrefix)).toBe(true);
    const databaseDirectory = path.dirname(String(databaseFile));
    expect(existsSync(databaseDirectory)).toBe(false);
  });

  it('a hamis ágens hibájánál a futás hibás, az összegzés hibaosztályt hordoz', async () => {
    const summary = await probe('minimax', { STUB_AGENT_BEHAVIOR: 'fail' });
    expect(summary.runStatus).toBe('failed');
    expect(summary.errorClass).toBeDefined();
  });

  it('megszakításnál a szerver leáll és az ideiglenes könyvtár törlődik', async () => {
    const before = probeDirectories();
    const controller = new AbortController();
    controller.abort();
    await expect(probe('minimax', {}, controller.signal)).rejects.toThrow();
    expect(probeDirectories()).toEqual(before);
  });

  it('ha a szerver a kapcsolat fogadása előtt kilép, a hibaüzenet maszkolt stderr-t hordoz', async () => {
    await expect(
      runProbe({
        providerId: 'minimax',
        serverCommand: {
          executable: process.execPath,
          args: ['-e', `console.error('${FAKE_SECRET}'); process.exit(3)`],
        },
        environment: process.env,
        secretValues: [FAKE_SECRET],
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow(new RegExp(`kilépési kód: 3.*${REDACTED}`, 's'));
  });
});
