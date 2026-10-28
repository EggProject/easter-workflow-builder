import type { Fact, MeasurementId } from '@easter-workflow-builder/provider-capability';

/**
 * Egy `unknown` képességmező a `MiniMax-M3.1-Flash` modellre (SPEC-013 3.2): a mezőt az előző
 * modellre mérték, a mérés a Flash-re nem vihető át. A `blockedBy` a megismétlendő mérések
 * azonosítója; a `reason` szándékosan nem tartalmaz mérési azonosítót, mert arra a `blockedBy`
 * mutat (SPEC-001 16. szekció 35. kritérium).
 */
export function notMeasuredOnFlash<TValue>(blockedBy: readonly [MeasurementId, ...MeasurementId[]]): Fact<TValue> {
  return {
    state: 'unknown',
    reason: 'Az előző modellre mérve, a MiniMax-M3.1-Flash modellre nem mérve (SPEC-013 3.2).',
    blockedBy,
  };
}
