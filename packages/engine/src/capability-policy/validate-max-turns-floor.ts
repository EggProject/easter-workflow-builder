import type { Outcome } from '@easter-workflow-builder/core';
import type { StructuredOutputStrategy } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * A `maxTurns` alsó korlátja a választott stratégiához (SPEC-004 11.3 táblázat
 * 3. sora, leíró mező: `structuredOutput.strategies[].observedRoundTrips`):
 *
 * - `known`: a minimum a megfigyelt körszámok **maximuma**, alatta
 *   `insufficient_max_turns`.
 * - `unknown`: a motor nem kényszerít minimumot, mert a túl kicsi érték úgyis
 *   `error_max_turns` subtype-ot ad, ami amúgy is `failed` lépés (F-3).
 *
 * A küszöb tehát mindig a leíróból jön, sosem a motorban álló számból
 * (SPEC-004 17. szekció 62. kritérium).
 *
 * Két eset **nem** hibaág, mert egyikben sincs mihez hasonlítani: ha a lépés
 * nem állít `maxTurns` értéket (`AgentStepConfig.maxTurns` `null`), és ha a
 * megfigyelt körszámok listája üres. Az üres listát a `Math.max()`
 * `-Infinity` visszatérése kezeli, tehát nincs hozzá külön ág: megfigyelés
 * nélkül nincs alsó korlát.
 */
export function validateMaxTurnsFloor(
  strategy: StructuredOutputStrategy,
  configuredMaxTurns: number | null,
): Outcome<void> {
  if (configuredMaxTurns === null || !isKnownFact(strategy.observedRoundTrips)) {
    return { kind: 'ok', value: undefined };
  }

  const floor = Math.max(...strategy.observedRoundTrips.value);

  if (configuredMaxTurns < floor) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'insufficient_max_turns',
        `A lépés maxTurns értéke (${String(configuredMaxTurns)}) kisebb, mint a(z) ${strategy.id} stratégia megfigyelt körszámainak maximuma (${String(floor)})`,
      ),
    };
  }

  return { kind: 'ok', value: undefined };
}
