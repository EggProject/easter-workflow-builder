import type { Outcome } from '@easter-workflow-builder/core';
import type { Fact, ThinkingMode } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { CapabilityFieldInclusion } from './capability-field-inclusion.ts';

/**
 * A megengedett `thinking` mód a modell családjához (SPEC-004 11.3 táblázat
 * 8. sora, leíró mező: `thinking.byModelFamily`):
 *
 * - `known`: a lépés módjának szerepelnie kell a család listáján, különben
 *   `thinking_mode_unsupported`.
 * - `unknown`: a motor **elhagyja** a `thinking` mezőt, hiba nélkül. Ez a
 *   konzervatív visszaesés: mérés nélkül a motor nem küld ki thinking módot
 *   (SPEC-004 11.2).
 *
 * Ha a lépés nem állít thinking módot (`AgentStepConfig.thinking` `null`),
 * nincs mit kiküldeni és nincs mit ellenőrizni sem: a mező elmarad.
 *
 * Ha a családhoz egyáltalán nincs bejegyzés a rekordban, az ugyanaz az
 * információhiány, mint az `unknown` állapot, tehát ugyanaz a visszaesés
 * érvényes.
 */
export function resolveThinkingMode(
  byModelFamily: Readonly<Record<string, Fact<readonly ThinkingMode[]>>>,
  modelFamily: string,
  stepThinking: ThinkingMode | null,
): Outcome<CapabilityFieldInclusion> {
  if (stepThinking === null) {
    return { kind: 'ok', value: 'omit' };
  }

  const allowedModes = byModelFamily[modelFamily];

  if (allowedModes === undefined || !isKnownFact(allowedModes)) {
    return { kind: 'ok', value: 'omit' };
  }

  if (!allowedModes.value.includes(stepThinking)) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'thinking_mode_unsupported',
        `A(z) ${stepThinking} thinking mód nem szerepel a(z) ${modelFamily} modellcsalád megengedett módjai között`,
      ),
    };
  }

  return { kind: 'ok', value: 'include' };
}
