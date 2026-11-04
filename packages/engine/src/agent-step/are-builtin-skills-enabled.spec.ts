/* eslint-disable unicorn/no-null -- a lépés és a workflow szintű érték `null` értéke az öröklés (SPEC-009 O-44) */
import { describe, expect, it } from 'vitest';
import { areBuiltinSkillsEnabled } from './are-builtin-skills-enabled.ts';

describe('areBuiltinSkillsEnabled', () => {
  it.each([
    ['a lépés hamis értéke felülírja az igaz workflow és globális értéket', false, true, true, false],
    ['a lépés igaz értéke felülírja a hamis workflow és globális értéket', true, false, false, true],
    ['null lépés mellett a workflow hamis értéke nyer az igaz globálissal szemben', null, false, true, false],
    ['null lépés mellett a workflow igaz értéke nyer a hamis globálissal szemben', null, true, false, true],
    ['a hiányzó lépés érték a null jelentése: a workflow dönt', undefined, false, true, false],
    ['null lépés és null workflow mellett a globális igaz érték hat', null, null, true, true],
    ['null lépés és null workflow mellett a globális hamis érték hat', null, null, false, false],
    ['hiányzó lépés és null workflow mellett a globális érték hat', undefined, null, false, false],
  ] as const)('%s', (_label, stepValue, workflowValue, isGloballyEnabled, expected) => {
    expect(areBuiltinSkillsEnabled(stepValue, workflowValue, isGloballyEnabled)).toBe(expected);
  });
});
