import { isOkOutcome, type EnvironmentReader, type Outcome } from '@easter-workflow-builder/core';
import type { FrontendConfig } from './frontend-config.ts';

/**
 * A négy kötelező környezeti változó neve. A Vite kizárólag a `VITE_`
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
 * A hibaüzenet kizárólag a változó NEVÉT nevezi meg, az értékét soha
 * (SPEC-007 16. szekció 46. kritérium, `.claude/CLAUDE.md` 9. szekció).
 */
function missingVariableMessage(variableName: string): string {
  return `Hiányzó kötelező konfiguráció: ${variableName}.`;
}

function readRequiredText(environment: EnvironmentReader, variableName: string): Outcome<string> {
  const rawValue = environment[variableName];
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return { kind: 'error', message: missingVariableMessage(variableName) };
  }
  return { kind: 'ok', value: rawValue.trim() };
}

function readRequiredPositiveInteger(environment: EnvironmentReader, variableName: string): Outcome<number> {
  const text = readRequiredText(environment, variableName);
  if (!isOkOutcome(text)) {
    return text;
  }
  const parsed = Number(text.value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return {
      kind: 'error',
      message: `A(z) ${variableName} konfiguráció értéke nem pozitív egész szám.`,
    };
  }
  return { kind: 'ok', value: parsed };
}

/**
 * A felület kötelező konfigurációjának beolvasása `Outcome` alakban, ALAPÉRTÉK
 * NÉLKÜL (SPEC-007 O-4, O-6, PLAN-008 T-008-17). Ha bármelyik változó hiányzik
 * vagy értelmezhetetlen, a hívó hibaágat kap, és a felület konfigurációs
 * hibaképernyőt rajzol; találgatás nincs.
 *
 * A bemenet az `import.meta.env` objektum, ami a `vite-env.d.ts` szerint
 * `string | undefined` értékű, csak olvasható rekord, tehát megfelel a `core`
 * csomag `EnvironmentReader` típusának.
 */
export function readFrontendConfig(environment: EnvironmentReader): Outcome<FrontendConfig> {
  const apiOrigin = readRequiredText(environment, API_ORIGIN_VARIABLE);
  if (!isOkOutcome(apiOrigin)) {
    return apiOrigin;
  }

  const streamOrigin = readRequiredText(environment, STREAM_ORIGIN_VARIABLE);
  if (!isOkOutcome(streamOrigin)) {
    return streamOrigin;
  }

  const listLimit = readRequiredPositiveInteger(environment, LIST_LIMIT_VARIABLE);
  if (!isOkOutcome(listLimit)) {
    return listLimit;
  }

  const streamReplayLimit = readRequiredPositiveInteger(environment, STREAM_REPLAY_LIMIT_VARIABLE);
  if (!isOkOutcome(streamReplayLimit)) {
    return streamReplayLimit;
  }

  return {
    kind: 'ok',
    value: {
      apiOrigin: apiOrigin.value,
      streamOrigin: streamOrigin.value,
      listLimit: listLimit.value,
      streamReplayLimit: streamReplayLimit.value,
    },
  };
}
