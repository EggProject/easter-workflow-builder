import { describe, expect, it } from 'vitest';
import { RunStatusSchema, StepRunStatusSchema } from './run-status.ts';

describe('RunStatusSchema', () => {
  it('a SPEC-003 7.1 szekció mind a hat állapotát elfogadja', () => {
    const statuses = ['pending', 'running', 'succeeded', 'failed', 'cancelled', 'interrupted'];
    for (const status of statuses) {
      expect(RunStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(statuses).toHaveLength(6);
  });

  it('elutasítja a lépés futás "waiting_approval" állapotát (nem futás szintű)', () => {
    expect(RunStatusSchema.safeParse('waiting_approval').success).toBe(false);
  });
});

describe('StepRunStatusSchema', () => {
  it('a SPEC-003 7.2 szekció mind a nyolc állapotát elfogadja', () => {
    const statuses = [
      'pending',
      'running',
      'waiting_approval',
      'succeeded',
      'failed',
      'rejected',
      'cancelled',
      'interrupted',
    ];
    for (const status of statuses) {
      expect(StepRunStatusSchema.safeParse(status).success).toBe(true);
    }
    expect(statuses).toHaveLength(8);
  });

  it('ismeretlen állapotot elutasít', () => {
    expect(StepRunStatusSchema.safeParse('unknown').success).toBe(false);
  });
});
