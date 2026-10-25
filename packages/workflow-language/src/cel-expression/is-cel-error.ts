import { isInstanceof } from '@easter-workflow-builder/typeguards';
import { EvaluationError, ParseError, TypeError as CelTypeError } from '@marcbachmann/cel-js';

/**
 * A `@marcbachmann/cel-js` három hibaosztályának példánya-e az érték. Mindhárom
 * hordozza a `code` és a `range` mezőt (M-127, research 2. szekció (4b)).
 */
export function isCelError(value: unknown): value is ParseError | CelTypeError | EvaluationError {
  return isInstanceof(value, ParseError) || isInstanceof(value, CelTypeError) || isInstanceof(value, EvaluationError);
}
