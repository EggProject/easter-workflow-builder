import path from 'node:path';
import type { EnvironmentReader, Outcome } from '@easter-workflow-builder/core';
import {
  ENV_LOG_DIRECTORY,
  ENV_LOG_LEVEL,
  ENV_LOG_RETAINED_FILE_COUNT,
  ENV_LOG_ROTATION_FREQUENCY,
  ENV_LOG_ROTATION_SIZE,
  ENV_SERVER_PORT,
  ENV_SKILL_LIBRARY_DIRECTORY,
  ENV_SKILL_MAX_ARCHIVE_BYTES,
  ENV_SKILL_MAX_ENTRY_COUNT,
  ENV_SKILL_MAX_UNPACKED_BYTES,
  ENV_STREAM_DEV_ORIGIN,
  ENV_STREAM_KEEP_ALIVE_INTERVAL_MS,
} from './environment-variable-name.ts';
import { DEFAULT_SERVER_CONFIG } from './default-server-config.ts';
import { isValidSkillPluginName } from './is-valid-skill-plugin-name.ts';

/**
 * A szerver induláskor beolvasott konfigurációja (SPEC-006 4.2 1. lépés,
 * 9.1 `server-config` téma). Minden mezőnek alapértéke van
 * (`DEFAULT_SERVER_CONFIG`, SPEC-012 4.2), kivéve a `devOrigin`-t (5.7,
 * opcionális: hiányában nincs CORS), a `logLevel`-t (7.2, hiányában a pino
 * dokumentált `'info'` alapértéke érvényesül) és a `skillLibraryDirectory`-t
 * (SPEC-009 5.1: kötelező, alapérték nélkül; hiányában a szerver nem indul).
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
  readonly skillLibraryDirectory: string;
  readonly skillMaxArchiveBytes: number;
  readonly skillMaxUnpackedBytes: number;
  readonly skillMaxEntryCount: number;
}

function missingVariableMessage(name: string): string {
  return `A(z) "${name}" kötelező env változó hiányzik vagy üres (missing_env_variable).`;
}

function invalidVariableMessage(name: string): string {
  return `A(z) "${name}" env változó értéke érvénytelen (invalid_env_variable).`;
}

function invalidSkillPluginNameMessage(pluginName: string): string {
  return `A(z) "${ENV_SKILL_LIBRARY_DIRECTORY}" env változó értéke érvénytelen: a könyvtár neve ("${pluginName}") a skill plugin neve, ami nem lehet üres, nem kezdődhet szóközzel, és nem tartalmazhat zárójelet, vesszőt vagy vezérlő karaktert (invalid_env_variable).`;
}

/**
 * A hiányzó (nincs beállítva, vagy üres) env változó az alapértéket adja; a
 * megadott értéket trimmelve adja tovább.
 */
function readStringOrDefault(environment: EnvironmentReader, name: string, defaultValue: string): string {
  const raw = environment[name];
  if (raw === undefined || raw.trim().length === 0) {
    return defaultValue;
  }
  return raw.trim();
}

function readPositiveIntegerOrDefault(
  environment: EnvironmentReader,
  name: string,
  defaultValue: number,
): Outcome<number> {
  const raw = environment[name];
  if (raw === undefined || raw.trim().length === 0) {
    return { kind: 'ok', value: defaultValue };
  }
  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return { kind: 'error', message: invalidVariableMessage(name) };
  }
  return { kind: 'ok', value: parsed };
}

/**
 * A `pino-roll` `frequency` mezője szám (ezredmásodperc) vagy elnevezett
 * gyakoriság sztring lehet (`'daily'`, `'hourly'`; a `pino-roll` 4.0.0 a
 * `'weekly'` nevet nem ismeri, research 10.5). Az env változó mindig sztring,
 * ezért a numerikus alakot itt számmá alakítjuk; a nem numerikus értéket
 * (pl. `'daily'`) változatlanul, sztringként adjuk tovább. Hiányában az
 * alapérték (szám) érvényesül.
 */
function readRotationFrequency(environment: EnvironmentReader, name: string): number | string {
  const raw = readStringOrDefault(environment, name, String(DEFAULT_SERVER_CONFIG.logRotationFrequency));
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : raw;
}

/**
 * A `process.env` másolatából `Outcome` alakot adó tiszta olvasó (SPEC-006
 * 4.2 1. lépés). A bind cím ("127.0.0.1") nem konfigurációs mező (3.5 2.
 * pont): a kódban áll, itt nem szerepel.
 */
export function readServerConfig(environment: EnvironmentReader): Outcome<ServerConfig> {
  const port = readPositiveIntegerOrDefault(environment, ENV_SERVER_PORT, DEFAULT_SERVER_CONFIG.port);
  if (port.kind === 'error') {
    return port;
  }

  const logRetainedFileCount = readPositiveIntegerOrDefault(
    environment,
    ENV_LOG_RETAINED_FILE_COUNT,
    DEFAULT_SERVER_CONFIG.logRetainedFileCount,
  );
  if (logRetainedFileCount.kind === 'error') {
    return logRetainedFileCount;
  }

  const streamKeepAliveIntervalMs = readPositiveIntegerOrDefault(
    environment,
    ENV_STREAM_KEEP_ALIVE_INTERVAL_MS,
    DEFAULT_SERVER_CONFIG.streamKeepAliveIntervalMs,
  );
  if (streamKeepAliveIntervalMs.kind === 'error') {
    return streamKeepAliveIntervalMs;
  }

  const skillLibraryDirectory = readStringOrDefault(environment, ENV_SKILL_LIBRARY_DIRECTORY, '');
  if (skillLibraryDirectory.length === 0) {
    return { kind: 'error', message: missingVariableMessage(ENV_SKILL_LIBRARY_DIRECTORY) };
  }
  // A plugin neve az abszolút útvonal utolsó tagja (a relatív érték az induló könyvtárhoz képest
  // oldódik fel, ugyanúgy, mint a `continueStartupWithDatabase`-ben), és a `query()` az érvénytelen
  // alakra dob (M-136 5b), ezért a szerver ilyenkor el sem indul (SPEC-009 5.1).
  const skillPluginName = path.basename(path.resolve(skillLibraryDirectory));
  if (!isValidSkillPluginName(skillPluginName)) {
    return { kind: 'error', message: invalidSkillPluginNameMessage(skillPluginName) };
  }

  const skillMaxArchiveBytes = readPositiveIntegerOrDefault(
    environment,
    ENV_SKILL_MAX_ARCHIVE_BYTES,
    DEFAULT_SERVER_CONFIG.skillMaxArchiveBytes,
  );
  if (skillMaxArchiveBytes.kind === 'error') {
    return skillMaxArchiveBytes;
  }

  const skillMaxUnpackedBytes = readPositiveIntegerOrDefault(
    environment,
    ENV_SKILL_MAX_UNPACKED_BYTES,
    DEFAULT_SERVER_CONFIG.skillMaxUnpackedBytes,
  );
  if (skillMaxUnpackedBytes.kind === 'error') {
    return skillMaxUnpackedBytes;
  }

  const skillMaxEntryCount = readPositiveIntegerOrDefault(
    environment,
    ENV_SKILL_MAX_ENTRY_COUNT,
    DEFAULT_SERVER_CONFIG.skillMaxEntryCount,
  );
  if (skillMaxEntryCount.kind === 'error') {
    return skillMaxEntryCount;
  }

  const developmentOrigin = environment[ENV_STREAM_DEV_ORIGIN];
  const logLevel = environment[ENV_LOG_LEVEL];

  return {
    kind: 'ok',
    value: {
      port: port.value,
      logDirectory: readStringOrDefault(environment, ENV_LOG_DIRECTORY, DEFAULT_SERVER_CONFIG.logDirectory),
      logRotationSize: readStringOrDefault(environment, ENV_LOG_ROTATION_SIZE, DEFAULT_SERVER_CONFIG.logRotationSize),
      logRotationFrequency: readRotationFrequency(environment, ENV_LOG_ROTATION_FREQUENCY),
      logRetainedFileCount: logRetainedFileCount.value,
      streamKeepAliveIntervalMs: streamKeepAliveIntervalMs.value,
      skillLibraryDirectory,
      skillMaxArchiveBytes: skillMaxArchiveBytes.value,
      skillMaxUnpackedBytes: skillMaxUnpackedBytes.value,
      skillMaxEntryCount: skillMaxEntryCount.value,
      ...(developmentOrigin !== undefined &&
        developmentOrigin.trim().length > 0 && { devOrigin: developmentOrigin.trim() }),
      ...(logLevel !== undefined && logLevel.trim().length > 0 && { logLevel: logLevel.trim() }),
    },
  };
}
