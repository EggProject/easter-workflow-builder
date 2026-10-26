import type { Outcome, OutcomeWithErrorType } from '@easter-workflow-builder/core';
import type { ServerLogger } from '@easter-workflow-builder/logger';

/**
 * A sablon és a kifejezés port eredményének továbbadása a motor felé, egy
 * naplóbejegyzéssel, ha a hibaág a `workflow-language` csomag tartalék ágáról
 * jön (előre nem látott kivétel, SPEC-010 O-22, user döntés 2026-10-25). A
 * bejegyzés a műveletet és a kivétel típusnevét rögzíti; az üzenetet, a
 * sablont, a kifejezést és a futás adatát nem, mert azok a felhasználó adatát
 * idézhetik. A motor portja változatlan `Outcome`-ot kap (SPEC-004 3.2).
 */
export function reportUnexpectedLanguageError<TValue>(
  outcome: OutcomeWithErrorType<TValue>,
  operation: 'template_compile' | 'template_render' | 'expression_compile' | 'expression_evaluate',
  logger: ServerLogger,
): Outcome<TValue> {
  if (outcome.kind === 'error' && outcome.unexpectedErrorType !== undefined) {
    logger.error(
      { operation, errorType: outcome.unexpectedErrorType },
      'A sablon vagy a kifejezés feldolgozása előre nem látott kivétellel zárult.',
    );
  }
  return outcome;
}
