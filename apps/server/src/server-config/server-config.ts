import type { EnvironmentReader, Outcome } from '@easter-workflow-builder/core';
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

/**
 * A szerver induláskor beolvasott konfigurációja (SPEC-006 4.2 1. lépés,
 * 9.1 `server-config` téma). Minden mező kötelező, alapérték nélkül,
 * kivéve a `devOrigin`-t (5.7, opcionális: hiányában nincs CORS) és a
 * `logLevel`-t (7.2, hiányában a pino dokumentált `'info'` alapértéke
 * érvényesül).
 */
export interface ServerConfig {
  readonly port: number;
  readonly devOrigin?: string;
  readonly logDirectory: string;
  readonly logLevel?: string;
  readonly logRotationSize: string;
  readonly logRotationFrequency: number | string;
  readonly logRetainedFileCount: number;
  readonly streamKeepAliveIntervalMs: number;
}

function missingVariableMessage(name: string): string {
  return `A(z) "${name}" kötelező env változó hiányzik vagy üres (missing_env_variable).`;
}

function invalidVariableMessage(name: string): string {
  return `A(z) "${name}" env változó értéke érvénytelen (invalid_env_variable).`;
}

function readRequiredString(environment: EnvironmentReader, name: string): Outcome<string> {
  const raw = environment[name];
  if (raw === undefined || raw.trim().length === 0) {
    return { kind: 'error', message: missingVariableMessage(name) };
  }
  return { kind: 'ok', value: raw.trim() };
}

function readPositiveInteger(environment: EnvironmentReader, name: string): Outcome<number> {
  const raw = readRequiredString(environment, name);
  if (raw.kind === 'error') {
    return raw;
  }
  const parsed = Number(raw.value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { kind: 'error', message: invalidVariableMessage(name) };
  }
  return { kind: 'ok', value: parsed };
}

/**
 * A `pino-roll` `frequency` mezője szám (ezredmásodperc) vagy elnevezett
 * gyakoriság sztring lehet (`'daily'`, `'hourly'`, `'weekly'`). Az env
 * változó mindig sztring, ezért a numerikus alakot itt számmá alakítjuk;
 * a nem numerikus értéket (pl. `'daily'`) változatlanul, sztringként adjuk
 * tovább.
 */
function readRotationFrequency(environment: EnvironmentReader, name: string): Outcome<number | string> {
  const raw = readRequiredString(environment, name);
  if (raw.kind === 'error') {
    return raw;
  }
  const parsed = Number(raw.value);
  if (Number.isSafeInteger(parsed) && parsed > 0) {
    return { kind: 'ok', value: parsed };
  }
  return { kind: 'ok', value: raw.value };
}

/**
 * A `process.env` másolatából `Outcome` alakot adó tiszta olvasó (SPEC-006
 * 4.2 1. lépés). A bind cím ("127.0.0.1") nem konfigurációs mező (3.5 2.
 * pont): a kódban áll, itt nem szerepel.
 */
export function readServerConfig(environment: EnvironmentReader): Outcome<ServerConfig> {
  const port = readPositiveInteger(environment, ENV_SERVER_PORT);
  if (port.kind === 'error') {
    return port;
  }

  const logDirectory = readRequiredString(environment, ENV_LOG_DIRECTORY);
  if (logDirectory.kind === 'error') {
    return logDirectory;
  }

  const logRotationSize = readRequiredString(environment, ENV_LOG_ROTATION_SIZE);
  if (logRotationSize.kind === 'error') {
    return logRotationSize;
  }

  const logRotationFrequency = readRotationFrequency(environment, ENV_LOG_ROTATION_FREQUENCY);
  if (logRotationFrequency.kind === 'error') {
    return logRotationFrequency;
  }

  const logRetainedFileCount = readPositiveInteger(environment, ENV_LOG_RETAINED_FILE_COUNT);
  if (logRetainedFileCount.kind === 'error') {
    return logRetainedFileCount;
  }

  const streamKeepAliveIntervalMs = readPositiveInteger(environment, ENV_STREAM_KEEP_ALIVE_INTERVAL_MS);
  if (streamKeepAliveIntervalMs.kind === 'error') {
    return streamKeepAliveIntervalMs;
  }

  const developmentOrigin = environment[ENV_STREAM_DEV_ORIGIN];
  const logLevel = environment[ENV_LOG_LEVEL];

  return {
    kind: 'ok',
    value: {
      port: port.value,
      logDirectory: logDirectory.value,
      logRotationSize: logRotationSize.value,
      logRotationFrequency: logRotationFrequency.value,
      logRetainedFileCount: logRetainedFileCount.value,
      streamKeepAliveIntervalMs: streamKeepAliveIntervalMs.value,
      ...(developmentOrigin !== undefined &&
        developmentOrigin.trim().length > 0 && { devOrigin: developmentOrigin.trim() }),
      ...(logLevel !== undefined && logLevel.trim().length > 0 && { logLevel: logLevel.trim() }),
    },
  };
}
