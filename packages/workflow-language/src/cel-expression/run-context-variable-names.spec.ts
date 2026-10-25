import { describe, expect, it } from 'vitest';
import { RUN_CONTEXT_VARIABLE_NAMES } from './run-context-variable-names.ts';

describe('RUN_CONTEXT_VARIABLE_NAMES', () => {
  it('pontosan a RunContext hét mezőjének neve, ebben a sorrendben (SPEC-010 5.1)', () => {
    expect(RUN_CONTEXT_VARIABLE_NAMES).toStrictEqual([
      'input',
      'steps',
      'item',
      'itemIndex',
      'iteration',
      'joinInputs',
      'error',
    ]);
  });
});
