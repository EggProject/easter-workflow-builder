import type { OutcomeWithErrorType } from '@easter-workflow-builder/core';

/**
 * A CEL kifejezés kiértékelő műveletei, a motor `ExpressionEvaluatorPort`
 * portjának alakjában (SPEC-010 3.1, 7.2 ... 7.4). A csomag a motortól nem
 * függ, ezért az alakot itt deklarálja; a szerkezeti egyezést a bekötés helye,
 * az `apps/server` ellenőrzi. A hibaág a tartalék mondatnál a kivétel
 * típusnevét is hordozza (`OutcomeWithErrorType`, SPEC-010 O-22); a szerver ezt
 * naplózza, a motor portja `Outcome`-ként kapja.
 */
export interface CelExpressionEvaluator {
  readonly compile: (expression: string) => OutcomeWithErrorType<void>;
  readonly evaluate: (expression: string, context: unknown) => OutcomeWithErrorType<unknown>;
}
