import { describe, expect, it } from 'vitest';
import { createRejectingTemplateRenderer } from './create-rejecting-template-renderer.ts';

describe('createRejectingTemplateRenderer', () => {
  it('a render hívás expression_evaluator_unavailable hibaosztályú hibát ad', () => {
    const port = createRejectingTemplateRenderer();
    const outcome = port.render('{{ x }}', {});
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain('(expression_evaluator_unavailable)');
  });

  it('a compile hívás is expression_evaluator_unavailable hibaosztályú hibát ad', () => {
    const port = createRejectingTemplateRenderer();
    const outcome = port.compile('{{ x }}');
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.message).toContain('(expression_evaluator_unavailable)');
  });
});
