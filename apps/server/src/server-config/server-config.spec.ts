import { describe, expect, it } from 'vitest';
import type { EnvironmentReader } from '@easter-workflow-builder/core';
import { readServerConfig } from './server-config.ts';
import {
  ENV_LOG_DIRECTORY,
  ENV_LOG_LEVEL,
  ENV_LOG_RETAINED_FILE_COUNT,
  ENV_LOG_ROTATION_FREQUENCY,
  ENV_LOG_ROTATION_SIZE,
  ENV_SERVER_PORT,
  ENV_STREAM_DEV_ORIGIN,
} from './environment-variable-name.ts';

const VALID_ENVIRONMENT: EnvironmentReader = {
  [ENV_SERVER_PORT]: '4000',
  [ENV_LOG_DIRECTORY]: '/var/log/easter',
  [ENV_LOG_ROTATION_SIZE]: '10m',
  [ENV_LOG_ROTATION_FREQUENCY]: 'daily',
  [ENV_LOG_RETAINED_FILE_COUNT]: '5',
};

/**
 * Egy kulcs kihagyásával másolja az env olvasót, hogy a hiányzó kötelező
 * mező esetét lehessen tesztelni. Nem destrukturáló-omit mintával (`const {
 * [key]: _omitted, ...rest } = ...`) készül, mert a `no-unused-vars` szabály
 * a kihagyott változóra hibát adna.
 */
function withoutKey(environment: EnvironmentReader, key: string): EnvironmentReader {
  return Object.fromEntries(Object.entries(environment).filter(([entryKey]) => entryKey !== key));
}

describe('readServerConfig', () => {
  it('sikeres esetben minden kötelező mezőt beolvas', () => {
    const outcome = readServerConfig(VALID_ENVIRONMENT);
    expect(outcome).toEqual({
      kind: 'ok',
      value: {
        port: 4000,
        logDirectory: '/var/log/easter',
        logRotationSize: '10m',
        logRotationFrequency: 'daily',
        logRetainedFileCount: 5,
      },
    });
  });

  it('a hiányzó port env változó nevét adja meg, az értéket nem', () => {
    const outcome = readServerConfig(withoutKey(VALID_ENVIRONMENT, ENV_SERVER_PORT));
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain(ENV_SERVER_PORT);
  });

  it('nem szám port értékre hibát ad', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_SERVER_PORT]: 'nem-szam' });
    expect(outcome.kind).toBe('error');
  });

  it('nulla vagy negatív port értékre hibát ad', () => {
    expect(readServerConfig({ ...VALID_ENVIRONMENT, [ENV_SERVER_PORT]: '0' }).kind).toBe('error');
    expect(readServerConfig({ ...VALID_ENVIRONMENT, [ENV_SERVER_PORT]: '-1' }).kind).toBe('error');
  });

  it('tört port értékre hibát ad', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_SERVER_PORT]: '4000.5' });
    expect(outcome.kind).toBe('error');
  });

  it('a hiányzó napló könyvtárra hibát ad, a nevet megnevezve', () => {
    const outcome = readServerConfig(withoutKey(VALID_ENVIRONMENT, ENV_LOG_DIRECTORY));
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain(ENV_LOG_DIRECTORY);
  });

  it('az üres string napló könyvtárra is hibát ad', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_LOG_DIRECTORY]: ' '.repeat(3) });
    expect(outcome.kind).toBe('error');
  });

  it('a hiányzó rotációs méretre hibát ad', () => {
    expect(readServerConfig(withoutKey(VALID_ENVIRONMENT, ENV_LOG_ROTATION_SIZE)).kind).toBe('error');
  });

  it('a hiányzó rotációs gyakoriságra hibát ad', () => {
    expect(readServerConfig(withoutKey(VALID_ENVIRONMENT, ENV_LOG_ROTATION_FREQUENCY)).kind).toBe('error');
  });

  it('numerikus rotációs gyakoriságot számmá alakít', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_LOG_ROTATION_FREQUENCY]: '3600000' });
    expect(outcome.kind === 'ok' && outcome.value.logRotationFrequency).toBe(3_600_000);
  });

  it('a hiányzó megőrzött fájlszámra hibát ad', () => {
    expect(readServerConfig(withoutKey(VALID_ENVIRONMENT, ENV_LOG_RETAINED_FILE_COUNT)).kind).toBe('error');
  });

  it('nem egész megőrzött fájlszámra hibát ad', () => {
    const outcome = readServerConfig({ ...VALID_ENVIRONMENT, [ENV_LOG_RETAINED_FILE_COUNT]: '1.5' });
    expect(outcome.kind).toBe('error');
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
