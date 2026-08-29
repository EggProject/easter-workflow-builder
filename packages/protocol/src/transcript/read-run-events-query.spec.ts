import { describe, expect, it } from 'vitest';
import { ReadRunEventsQuerySchema } from './read-run-events-query.ts';

describe('ReadRunEventsQuerySchema', () => {
  it('elfogadja a limit + afterEventId ágat', () => {
    expect(ReadRunEventsQuerySchema.safeParse({ limit: 50, afterEventId: 0 }).success).toBe(true);
  });

  it('elfogadja a limit + stepRunId ágat', () => {
    expect(ReadRunEventsQuerySchema.safeParse({ limit: 50, stepRunId: 'step-1' }).success).toBe(true);
  });

  it('elutasítja az afterEventId és stepRunId együttes küldését (17. kritérium)', () => {
    const outcome = ReadRunEventsQuerySchema.safeParse({ limit: 50, afterEventId: 0, stepRunId: 'step-1' });
    expect(outcome.success).toBe(false);
  });

  it('elutasítja, ha sem afterEventId, sem stepRunId nincs megadva', () => {
    expect(ReadRunEventsQuerySchema.safeParse({ limit: 50 }).success).toBe(false);
  });
});
