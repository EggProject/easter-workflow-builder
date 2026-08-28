import { describe, expect, it } from 'vitest';
import type { RunStatus } from './run-status.ts';
import { isRunStatus } from './is-run-status.ts';

// A SPEC-003 7.1 szekció mind a hat állapota. A `RunStatus[]` annotáció
// fordítási idejű állítás is: ha az unió bővül vagy szűkül, ez a lista nem
// maradhat érintetlenül.
const allRunStatuses: readonly RunStatus[] = ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted'];

describe('isRunStatus', () => {
  it('a hat állapot mindegyikére igazat ad', () => {
    expect(allRunStatuses.every((status) => isRunStatus(status))).toBe(true);
    expect(allRunStatuses).toHaveLength(6);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isRunStatus('waiting_approval')).toBe(false);
    expect(isRunStatus('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isRunStatus('toString')).toBe(false);
    expect(isRunStatus('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isRunStatus(undefined)).toBe(false);
    expect(isRunStatus(7)).toBe(false);
    expect(isRunStatus({ status: 'pending' })).toBe(false);
    expect(isRunStatus(['pending'])).toBe(false);
  });
});
