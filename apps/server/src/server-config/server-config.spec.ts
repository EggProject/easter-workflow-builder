import { describe, expect, it } from 'vitest';
import type { EnvironmentReader } from '@easter-workflow-builder/core';
import { readServerConfig } from './server-config.ts';
import { DEFAULT_SERVER_CONFIG } from './default-server-config.ts';
import {
  ENV_LOG_DIRECTORY,
  ENV_LOG_LEVEL,
  ENV_LOG_RETAINED_FILE_COUNT,
  ENV_LOG_ROTATION_FREQUENCY,
  ENV_LOG_ROTATION_SIZE,
  ENV_SERVER_PORT,
  ENV_STREAM_DEV_ORIGIN,
  ENV_STREAM_KEEP_ALIVE_INTERVAL_MS,
} from './environment-variable-name.ts';

const VALID_ENVIRONMENT: EnvironmentReader = {
  [ENV_SERVER_PORT]: '4000',
  [ENV_LOG_DIRECTORY]: '/var/log/easter',
  [ENV_LOG_ROTATION_SIZE]: '10m',
  [ENV_LOG_ROTATION_FREQUENCY]: 'daily',
  [ENV_LOG_RETAINED_FILE_COUNT]: '5',
  [ENV_STREAM_KEEP_ALIVE_INTERVAL_MS]: '15000',
};

/**
 * Egy kulcs kihagyásával másolja az env olvasót, hogy a hiányzó mező
 * alapértékre esését lehessen tesztelni. Nem destrukturáló-omit mintával
 * (`const { [key]: _omitted, ...rest } = ...`) készül, mert a `no-unused-vars`
 * szabály a kihagyott változóra hibát adna.
 */
function withoutKey(environment: EnvironmentReader, key: string): EnvironmentReader {
  return Object.fromEntries(Object.entries(environment).filter(([entryKey]) => entryKey !== key));
}

const DEFAULTS_VALUE = {
  port: 3001,
  streamKeepAliveIntervalMs: 15_000,
  logDirectory: '.data/logs/server',
  logRotationSize: '10m',
  logRotationFrequency: 604_800_000,
  logRetainedFileCount: 4,
};

describe('readServerConfig', () => {
  it('sikeres esetben minden megadott mezőt beolvas, az alapértékek helyett', () => {
    const outcome = readServerConfig(VALID_ENVIRONMENT);
    expect(outcome).toEqual({
      kind: 'ok',
      value: {
        port: 4000,
        logDirectory: '/var/log/easter',
        logRotationSize: '10m',
        logRotationFrequency: 'daily',
        logRetainedFileCount: 5,
        streamKeepAliveIntervalMs: 15_000,
      },
    });
  });

  it('a SPEC-012 4.2 táblázat alapértékei a kódban: 3001, 15000, .data/logs/server, 10m, 604800000, 4', () => {
    expect(DEFAULT_SERVER_CONFIG).toStrictEqual(DEFAULTS_VALUE);
  });

  it('üres környezetre mind a hat alapértéket adja, a gyakoriság szám', () => {
    expect(readServerConfig({})).toStrictEqual({ kind: 'ok', value: DEFAULTS_VALUE });
  });

  it('az üres és csak szóközből álló érték is az alapértékre esik vissza', () => {
    const outcome = readServerConfig({
      [ENV_SERVER_PORT]: '',
      [ENV_LOG_DIRECTORY]: ' '.repeat(3),
      [ENV_LOG_ROTATION_SIZE]: '',
      [ENV_LOG_ROTATION_FREQUENCY]: '  ',
      [ENV_LOG_RETAINED_FILE_COUNT]: '',
      [ENV_STREAM_KEEP_ALIVE_INTERVAL_MS]: ' ',
    });
    expect(outcome).toStrictEqual({ kind: 'ok', value: DEFAULTS_VALUE });
  });

  it.each([
    ['port', ENV_SERVER_PORT, 'port', 4000],
    ['életben tartó gyakoriság', ENV_STREAM_KEEP_ALIVE_INTERVAL_MS, 'streamKeepAliveIntervalMs', 1000],
    ['megőrzött fájlszám', ENV_LOG_RETAINED_FILE_COUNT, 'logRetainedFileCount', 5],
  ] as const)(
    'a hiányzó %s az alapértékre esik, a megadott érvényes érték felülírja',
    (_label, name, key, override) => {
      const missing = readServerConfig(withoutKey(VALID_ENVIRONMENT, name));
      expect(missing.kind === 'ok' && missing.value[key]).toBe(DEFAULTS_VALUE[key]);
      const overridden = readServerConfig({ ...VALID_ENVIRONMENT, [name]: String(override) });
      expect(overridden.kind === 'ok' && overridden.value[key]).toBe(override);
    },
  );

  it.each([ENV_SERVER_PORT, ENV_STREAM_KEEP_ALIVE_INTERVAL_MS, ENV_LOG_RETAINED_FILE_COUNT])(
    'a(z) %s megadott érvénytelen értékére invalid_env_variable hibát ad, nem csendes alapértéket',
    (name) => {
      for (const invalid of ['0', '-1', 'abc', '1.5', '4000.5']) {
        const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [name]: invalid });
        expect(outcome.kind).toBe('error');
        expect(outcome.kind === 'error' && outcome.message).toContain(name);
        expect(outcome.kind === 'error' && outcome.message).toContain('invalid_env_variable');
      }
    },
  );

  it('a hiányzó napló könyvtár, méret és gyakoriság az alapértékre esik', () => {
    const environment = withoutKey(
      withoutKey(withoutKey(VALID_ENVIRONMENT, ENV_LOG_DIRECTORY), ENV_LOG_ROTATION_SIZE),
      ENV_LOG_ROTATION_FREQUENCY,
    );
    const outcome = readServerConfig(environment);
    expect(outcome.kind === 'ok' && outcome.value.logDirectory).toBe('.data/logs/server');
    expect(outcome.kind === 'ok' && outcome.value.logRotationSize).toBe('10m');
    expect(outcome.kind === 'ok' && outcome.value.logRotationFrequency).toBe(604_800_000);
  });

  it('numerikus rotációs gyakoriságot számmá alakít, a daily és hourly név változatlanul átmegy', () => {
    const numeric = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_LOG_ROTATION_FREQUENCY]: '3600000' });
    expect(numeric.kind === 'ok' && numeric.value.logRotationFrequency).toBe(3_600_000);
    for (const name of ['daily', 'hourly']) {
      const named = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_LOG_ROTATION_FREQUENCY]: name });
      expect(named.kind === 'ok' && named.value.logRotationFrequency).toBe(name);
    }
  });

  it('a devOrigin hiányában a mező elmarad, nem hibázik', () => {
    const outcome = readServerConfig(VALID_ENVIRONMENT);
    expect(outcome.kind === 'ok' && 'devOrigin' in outcome.value).toBe(false);
  });

  it('a devOrigin megadása esetén a mező trimmelve jelenik meg', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_STREAM_DEV_ORIGIN]: '  http://localhost:5173  ' });
    expect(outcome.kind === 'ok' && outcome.value.devOrigin).toBe('http://localhost:5173');
  });

  it('a logLevel hiányában a mező elmarad, nem hibázik', () => {
    const outcome = readServerConfig(VALID_ENVIRONMENT);
    expect(outcome.kind === 'ok' && 'logLevel' in outcome.value).toBe(false);
  });

  it('a logLevel megadása esetén a mező megjelenik', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_LOG_LEVEL]: 'debug' });
    expect(outcome.kind === 'ok' && outcome.value.logLevel).toBe('debug');
  });
});
