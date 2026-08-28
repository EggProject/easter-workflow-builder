import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A SPEC-004 4.7 táblázat 9. sora: "minden node configjában van
 * `onUnhandledError` érték", különben `unhandled_error_policy_missing`.
 *
 * A mező tárolt alakja `UnhandledErrorPolicy | null` (SPEC-003 4.3), ahol a
 * `null` a "nincs beállítva" állapot: a séma megengedi, a futás indítása nem.
 * Ez a user 1. döntése (SPEC-004 8.3): kezeletlen hiba esetén a futás áll le
 * (`fail_run`), vagy csak az adott ág hal el (`fail_branch`) - a motor a kettő
 * közül nem választ magától, ezért a hiányzó érték elutasítás, nem
 * alapértelmezés.
 */
export function validateUnhandledErrorPolicy(configsById: ReadonlyMap<string, ExecutableNodeConfig>): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    if (config.onUnhandledError === null) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'unhandled_error_policy_missing',
          `A(z) ${nodeId} node configjában nincs onUnhandledError érték beállítva`,
        ),
      };
    }
  }

  return { kind: 'ok', value: undefined };
}
