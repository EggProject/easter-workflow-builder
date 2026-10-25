import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A CEL kifejezés kiértékelő műveletei, a motor `ExpressionEvaluatorPort`
 * portjának alakjában (SPEC-010 3.1, 7.2). A csomag a motortól nem függ, ezért
 * az alakot itt deklarálja; a szerkezeti egyezést a bekötés helye, az
 * `apps/server` ellenőrzi. Az `evaluate` a T-010-10 lépésben kerül ide.
 */
export interface CelExpressionEvaluator {
  readonly compile: (expression: string) => Outcome<void>;
}
