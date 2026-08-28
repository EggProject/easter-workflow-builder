import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A kifejezés kiértékelő port (SPEC-004 3.2 táblázat, `expressionEvaluator`
 * sor). A `branch.expression`, a `fan_out.itemsExpression` és a
 * `loop.continueExpression` kiértékelését ezen a porton át végzi a motor. A
 * kifejezés nyelv megválasztása nem ennek a specnek a tárgya: port nélkül a
 * `branch`, `fan_out` és `loop` node-ot tartalmazó workflow indítása
 * `expression_evaluator_unavailable` hibával elutasít (SPEC-004 1. szekció
 * "Amit NEM dönt el", 15. szekció O-1 nyitott kérdés).
 */
export interface ExpressionEvaluatorPort {
  evaluate(expression: string, context: unknown): Outcome<unknown>;
  compile(expression: string): Outcome<void>;
}
