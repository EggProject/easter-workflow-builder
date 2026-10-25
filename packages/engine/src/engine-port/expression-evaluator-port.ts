import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A kifejezés kiértékelő port (SPEC-004 3.2 táblázat, `expressionEvaluator`
 * sor). A `branch.expression`, a `fan_out.itemsExpression` és a
 * `loop.continueExpression` kiértékelését ezen a porton át végzi a motor. A
 * kifejezés nyelv a CEL (SPEC-004 O-1 lezárva, user döntés 2026-09-23); a
 * szállított implementációt a SPEC-010 írja le, a motor a nyelvet nem ismeri.
 * A `compile` a futás indításakor fut minden kifejezés mezőre, és a hibája
 * `expression_evaluation_failed` osztállyal utasítja el az indítást (SPEC-010
 * 9.2, `run-validation/validate-language-fields.ts`).
 */
export interface ExpressionEvaluatorPort {
  evaluate(expression: string, context: unknown): Outcome<unknown>;
  compile(expression: string): Outcome<void>;
}
