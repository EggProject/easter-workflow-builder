import { describe, expect, it } from 'vitest';
import { createRejectingExpressionEvaluator } from './create-rejecting-expression-evaluator.ts';

describe('createRejectingExpressionEvaluator', () => {
  it('az evaluate hívás expression_evaluator_unavailable hibaosztályú hibát ad', () => {
    const port = createRejectingExpressionEvaluator();
    const outcome = port.evaluate('1 + 1', {});
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain('(expression_evaluator_unavailable)');
  });

  it('a compile hívás is expression_evaluator_unavailable hibaosztályú hibát ad', () => {
    const port = createRejectingExpressionEvaluator();
    const outcome = port.compile('1 + 1');
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain('(expression_evaluator_unavailable)');
  });
});
