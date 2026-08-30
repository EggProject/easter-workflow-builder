import type { ExpressionEvaluatorPort } from '@easter-workflow-builder/engine';

const REJECTION_MESSAGE =
  'A szerver nem ismer kifejezés nyelvet, a branch/fan_out/loop node kiértékelése nem elérhető (expression_evaluator_unavailable).';

/**
 * A kifejezés kiértékelő port kimondottan elutasító implementációja
 * (SPEC-004 1. szekció "Amit NEM dönt el", 15. szekció O-1 nyitott kérdés):
 * a kifejezés nyelv megválasztása nem ennek a lépésnek a tárgya, ezért a
 * `branch`/`fan_out`/`loop` node-ot tartalmazó workflow indítása
 * `expression_evaluator_unavailable` hibával elutasít, ahelyett hogy egy
 * nem dokumentált kifejezés nyelvet találna ki.
 */
export function createRejectingExpressionEvaluator(): ExpressionEvaluatorPort {
  return {
    evaluate: () => ({ kind: 'error', message: REJECTION_MESSAGE }),
    compile: () => ({ kind: 'error', message: REJECTION_MESSAGE }),
  };
}
