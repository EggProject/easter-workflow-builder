import { isOkOutcome, type EnvironmentReader, type Outcome } from '@easter-workflow-builder/core';
import { DEFAULT_FRONTEND_CONFIG } from './default-frontend-config.ts';
import type { FrontendConfig } from './frontend-config.ts';

/**
 * A négy környezeti változó neve. A Vite kizárólag a `VITE_`
 * előtagú változókat teszi elérhetővé a kliens kódnak
 * (https://vite.dev/guide/env-and-mode, SPEC-007 M-11). A `streamOrigin` a
 * SPEC-008 3.3 szekció szerinti port döntés miatt vált külön az `apiOrigin`
 * mezőtől: fejlesztéskor a REST hívás a Vite proxyn megy (`apiOrigin` a dev
 * szerver saját originje), az SSE csatorna viszont a proxyt megkerülve
 * közvetlenül a backend originre kapcsolódik (`streamOrigin`).
 */
const API_ORIGIN_VARIABLE = 'VITE_API_ORIGIN';
const STREAM_ORIGIN_VARIABLE = 'VITE_STREAM_ORIGIN';
const LIST_LIMIT_VARIABLE = 'VITE_LIST_LIMIT';
const STREAM_REPLAY_LIMIT_VARIABLE = 'VITE_STREAM_REPLAY_LIMIT';

/**
 * Az env változó levágott értéke, vagy `undefined`, ha nincs beállítva vagy
 * üres: mindkettő az alapértéket jelenti (SPEC-012 4.2).
 */
function readGivenText(environment: EnvironmentReader, variableName: string): string | undefined {
  const rawValue = environment[variableName]?.trim();
  return rawValue === undefined || rawValue.length === 0 ? undefined : rawValue;
}

function readTextOrDefault(environment: EnvironmentReader, variableName: string, defaultValue: string): string {
  return readGivenText(environment, variableName) ?? defaultValue;
}

/**
 * Az alapérték csak a hiányra jár; a megadott, de nem pozitív egész érték
 * hibaág, az értéket meg nem nevezve (`.claude/CLAUDE.md` 9. szekció).
 */
function readPositiveIntegerOrDefault(
  environment: EnvironmentReader,
  variableName: string,
  defaultValue: number,
): Outcome<number> {
  const text = readGivenText(environment, variableName);
  if (text === undefined) {
    return { kind: 'ok', value: defaultValue };
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return {
      kind: 'error',
      message: `A(z) ${variableName} konfiguráció értéke nem pozitív egész szám.`,
    };
  }
  return { kind: 'ok', value: parsed };
}

/**
 * A felület konfigurációjának beolvasása `Outcome` alakban. Minden változónak
 * van alapértéke a `default-frontend-config.ts` fájlban (SPEC-012 4.2, user
 * döntés 2026-10-26, ami a SPEC-007 O-4 és O-6 "alapérték nélkül" döntését
 * felülírja): a hiányzó vagy üres változó az alapértéket adja, a megadott,
 * de értelmezhetetlen lapméret hibaág, és a felület konfigurációs
 * hibaképernyőt rajzol; csendes visszaesés nincs.
 *
 * A bemenet az `import.meta.env` objektum, ami a `vite-env.d.ts` szerint
 * `string | undefined` értékű, csak olvasható rekord, tehát megfelel a `core`
 * csomag `EnvironmentReader` típusának.
 */
export function readFrontendConfig(environment: EnvironmentReader): Outcome<FrontendConfig> {
  const listLimit = readPositiveIntegerOrDefault(environment, LIST_LIMIT_VARIABLE, DEFAULT_FRONTEND_CONFIG.listLimit);
  if (!isOkOutcome(listLimit)) {
    return listLimit;
  }

  const streamReplayLimit = readPositiveIntegerOrDefault(
    environment,
    STREAM_REPLAY_LIMIT_VARIABLE,
    DEFAULT_FRONTEND_CONFIG.streamReplayLimit,
  );
  if (!isOkOutcome(streamReplayLimit)) {
    return streamReplayLimit;
  }

  return {
    kind: 'ok',
    value: {
      apiOrigin: readTextOrDefault(environment, API_ORIGIN_VARIABLE, DEFAULT_FRONTEND_CONFIG.apiOrigin),
      streamOrigin: readTextOrDefault(environment, STREAM_ORIGIN_VARIABLE, DEFAULT_FRONTEND_CONFIG.streamOrigin),
      listLimit: listLimit.value,
      streamReplayLimit: streamReplayLimit.value,
    },
  };
}
