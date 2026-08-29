import { describe, expect, it } from 'vitest';
import { RestartRunRequestSchema, StartedRunResponseSchema, StartRunRequestSchema } from './start-run-request.ts';

describe('StartRunRequestSchema', () => {
  it('elfogadja a mező szerint olvasható input rekordot', () => {
    expect(StartRunRequestSchema.safeParse({ input: { name: 'Ada' } }).success).toBe(true);
  });

  it('elfogadja az üres inputot', () => {
    expect(StartRunRequestSchema.safeParse({ input: {} }).success).toBe(true);
  });

  it('elutasítja, ha az input hiányzik', () => {
    expect(StartRunRequestSchema.safeParse({}).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(StartRunRequestSchema.safeParse({ input: {}, extra: 1 }).success).toBe(false);
  });
});

describe('StartedRunResponseSchema', () => {
  it('elfogadja a runId és status mezőt', () => {
    expect(StartedRunResponseSchema.safeParse({ runId: 'run-1', status: 'pending' }).success).toBe(true);
  });
});

describe('RestartRunRequestSchema', () => {
  it('elfogadja az üres törzset (az input elhagyható)', () => {
    expect(RestartRunRequestSchema.safeParse({}).success).toBe(true);
  });

  it('elfogadja a megadott inputot is', () => {
    expect(RestartRunRequestSchema.safeParse({ input: { name: 'Ada' } }).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot (15. kritérium)', () => {
    expect(RestartRunRequestSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});
