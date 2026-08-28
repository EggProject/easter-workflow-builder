import type { Outcome } from '@easter-workflow-builder/core';
import type { Fact } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { CapabilityFieldInclusion } from './capability-field-inclusion.ts';

/**
 * Az `effort` mező kiküldése (SPEC-004 11.3 táblázat 9. sora, leíró mező:
 * `effort.accepted`):
 *
 * - `known` igaz: a motor továbbadja a lépés értékét.
 * - `known` hamis: `effort_unsupported`, **ha** a lépés beállít effortot;
 *   egyébként egyszerűen elhagyja a mezőt.
 * - `unknown`: elhagyja.
 *
 * Ha a lépés nem állít effortot (`AgentStepConfig.effort` `null`), egyik
 * állapotban sincs se hiba, se kiküldendő mező.
 */
export function resolveEffortInclusion(
  accepted: Fact<boolean>,
  stepEffort: string | null,
): Outcome<CapabilityFieldInclusion> {
  if (stepEffort === null || !isKnownFact(accepted)) {
    return { kind: 'ok', value: 'omit' };
  }

  if (!accepted.value) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'effort_unsupported',
        'A lépés effort értéket állít be, amit a provider leírója szerint a provider nem fogad el',
      ),
    };
  }

  return { kind: 'ok', value: 'include' };
}
