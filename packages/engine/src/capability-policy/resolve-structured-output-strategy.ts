import type { Outcome } from '@easter-workflow-builder/core';
import type {
  StructuredOutputStrategy,
  StructuredOutputStrategyId,
} from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { StructuredOutputStrategyDecision } from './structured-output-strategy-decision.ts';

/**
 * A lépés által választott strukturált kimenet stratégia használhatósága
 * (SPEC-004 11.3 táblázat 1. sora, leíró mező:
 * `structuredOutput.strategies[].usable`):
 *
 * - `known` igaz: a stratégia használható.
 * - `known` hamis: `structured_output_strategy_unsupported`, validációs
 *   hibaágban.
 * - `unknown`: használható, de a döntés `strategyUnproven` jelölést hoz, ami a
 *   `step_started` esemény payloadjába kerül. A motor tehát nem tiltja le, de
 *   nem is hallgatja el, hogy a mérés hiányzik (SPEC-004 11.2).
 *
 * A stratégia kiválasztása (a `[]` indexelés a táblázat mezőjében) itt
 * történik, mert a leíró és a lépés config összepárosítása ennek a viselkedésnek
 * a része. Ha a leíró **egyáltalán nem írja le** a kért stratégiát, az ugyanaz a
 * hibaosztály: bizonyíték nélkül a motor nem állíthatja, hogy a stratégia
 * működik ezzel a providerrel (SPEC-004 11.2, a tippelés tilalma).
 *
 * A `Stop` hook összeállítása (a táblázat 2. sora) szándékosan **nem** itt áll:
 * az nem önálló leíró mező, hanem a most kiválasztott stratégia következménye,
 * és az `Options` összeállításához tartozik (`agent-step` téma, T-005-19).
 */
export function resolveStructuredOutputStrategy(
  strategies: readonly StructuredOutputStrategy[],
  requestedStrategyId: StructuredOutputStrategyId,
): Outcome<StructuredOutputStrategyDecision> {
  const strategy = strategies.find((candidate) => candidate.id === requestedStrategyId);

  if (strategy === undefined) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'structured_output_strategy_unsupported',
        `A(z) ${requestedStrategyId} strukturált kimenet stratégiát a provider leírója nem írja le`,
      ),
    };
  }

  if (isKnownFact(strategy.usable)) {
    if (!strategy.usable.value) {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'structured_output_strategy_unsupported',
          `A(z) ${requestedStrategyId} strukturált kimenet stratégia a provider leírója szerint nem használható`,
        ),
      };
    }

    return { kind: 'ok', value: { strategy, strategyUnproven: false } };
  }

  return { kind: 'ok', value: { strategy, strategyUnproven: true } };
}
