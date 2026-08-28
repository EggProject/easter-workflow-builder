import { describe, expect, it } from 'vitest';
import type { StepRunStatus } from './step-run-status.ts';
import { isStepRunStatus } from './is-step-run-status.ts';

// A SPEC-003 7.2 szekció mind a nyolc állapota. A `StepRunStatus[]`
// annotáció fordítási idejű állítás is: ha az unió bővül vagy szűkül, ez a
// lista nem maradhat érintetlenül.
const allStepRunStatuses: readonly StepRunStatus[] = [
  'pending',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'rejected',
  'cancelled',
  'interrupted',
];

describe('isStepRunStatus', () => {
  it('a nyolc állapot mindegyikére igazat ad', () => {
    expect(allStepRunStatuses.every((status) => isStepRunStatus(status))).toBe(true);
    expect(allStepRunStatuses).toHaveLength(8);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isStepRunStatus('unknown')).toBe(false);
    expect(isStepRunStatus('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isStepRunStatus('toString')).toBe(false);
    expect(isStepRunStatus('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isStepRunStatus(undefined)).toBe(false);
    expect(isStepRunStatus(7)).toBe(false);
    expect(isStepRunStatus({ status: 'pending' })).toBe(false);
    expect(isStepRunStatus(['pending'])).toBe(false);
  });
});
