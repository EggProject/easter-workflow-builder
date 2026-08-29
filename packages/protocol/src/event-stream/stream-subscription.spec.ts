import { describe, expect, it } from 'vitest';
import { SubscriptionRequestSchema, SubscriptionStateSchema } from './stream-subscription.ts';

describe('SubscriptionRequestSchema', () => {
  it('elfogadja az üres listát (21. kritérium, üres eset)', () => {
    expect(SubscriptionRequestSchema.safeParse({ runs: [] }).success).toBe(true);
  });

  it('elfogadja a több elemű listát (21. kritérium)', () => {
    const outcome = SubscriptionRequestSchema.safeParse({
      runs: [
        { runId: 'run-1', fromEventId: 0, replayLimit: 100 },
        { runId: 'run-2', fromEventId: 40, replayLimit: 100 },
      ],
    });
    expect(outcome.success).toBe(true);
  });

  it('elutasítja, ha a replayLimit hiányzik (24. kritérium)', () => {
    const outcome = SubscriptionRequestSchema.safeParse({ runs: [{ runId: 'run-1', fromEventId: 0 }] });
    expect(outcome.success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot a törzsön (15. kritérium)', () => {
    expect(SubscriptionRequestSchema.safeParse({ runs: [], extra: 1 }).success).toBe(false);
  });

  it('elutasítja az ismeretlen kulcsot egy feliratkozás bejegyzésen (15. kritérium)', () => {
    const outcome = SubscriptionRequestSchema.safeParse({
      runs: [{ runId: 'run-1', fromEventId: 0, replayLimit: 100, extra: 1 }],
    });
    expect(outcome.success).toBe(false);
  });
});

describe('SubscriptionStateSchema', () => {
  it('elfogadja a streamId-t és a feliratkozás listát', () => {
    const outcome = SubscriptionStateSchema.safeParse({
      streamId: 'stream-1',
      subscriptions: [{ runId: 'run-1', fromEventId: 0, replayLimit: 100 }],
    });
    expect(outcome.success).toBe(true);
  });
});
