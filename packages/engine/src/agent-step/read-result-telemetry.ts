import type { StepRunTokenUsage } from '@easter-workflow-builder/db';
import { isNumber, isRecord } from '@easter-workflow-builder/typeguards';
import type { ResultTelemetry } from './result-telemetry.ts';

// Egy szám mező kiolvasása egy rekordból, `undefined` értékkel hiány vagy nem
// szám típus esetén.
function readNumber(source: Readonly<Record<string, unknown>>, field: string): number | undefined {
  const value = source[field];
  return isNumber(value) ? value : undefined;
}

/**
 * A négy token mező kiolvasása a `result` üzenet `usage` objektumából. A négy
 * mezőnév szó szerint az SDK-é (agent-sdk research 1. szekció: `input_tokens`,
 * `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`, a
 * `result` ágon top-level `usage` mezőn).
 *
 * **Mind a négy kell, vagy egyik sem.** A `StepRunTokenUsage` a négy oszlopot
 * együtt, egyetlen írásban veszi át (SPEC-003 4.10), és hiányzó mezőt nem
 * pótolunk nullával, mert az hiányzó adatot álcázna valósnak. Részleges
 * `usage` objektum ezért ugyanúgy `undefined` eredményt ad, mint a teljesen
 * hiányzó.
 */
function readTokenUsage(message: Readonly<Record<string, unknown>>): StepRunTokenUsage | undefined {
  const usage = message['usage'];
  if (!isRecord(usage)) {
    return undefined;
  }

  const inputTokens = readNumber(usage, 'input_tokens');
  const outputTokens = readNumber(usage, 'output_tokens');
  const cacheReadInputTokens = readNumber(usage, 'cache_read_input_tokens');
  const cacheCreationInputTokens = readNumber(usage, 'cache_creation_input_tokens');

  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    cacheReadInputTokens === undefined ||
    cacheCreationInputTokens === undefined
  ) {
    return undefined;
  }

  return { inputTokens, outputTokens, cacheReadInputTokens, cacheCreationInputTokens };
}

/**
 * A `result` SDK üzenet motor által olvasott számadatai (SPEC-004 5.2 8. pont):
 * a `num_turns` és a négy `usage` mező.
 *
 * A bemenet `unknown`, nem a szűkített `SdkResultMessage`: az `agent` csomag
 * guardja a `type` és a `subtype` mezőt szűkíti, a számadatokat viszont nem
 * hordozza, és a motor nem is akarja az SDK típusdefinícióját duplikálni
 * (SPEC-004 3.3). A mezőneveket ezért ugyanúgy nyers rekordon olvassuk, ahogy
 * a `packages/db` normalizálója teszi, és minden mező hiánya megengedett.
 */
export function readResultTelemetry(message: unknown): ResultTelemetry {
  if (!isRecord(message)) {
    return { numTurns: undefined, tokens: undefined };
  }

  return { numTurns: readNumber(message, 'num_turns'), tokens: readTokenUsage(message) };
}
