import { describe, expect, it } from 'vitest';
import { waitForSettlement } from './wait-for-settlement.ts';

function neverSettles(): Promise<number> {
  return new Promise(() => {
    // Szándékosan soha nem oldódik fel: a határidő és a jel ágát vizsgáljuk.
  });
}

describe('waitForSettlement', () => {
  it('a határidő előtt feloldott ígéret értékét adja', async () => {
    const signal = new AbortController().signal;
    await expect(waitForSettlement(Promise.resolve(7), Date.now() + 1000, signal)).resolves.toStrictEqual({
      kind: 'settled',
      value: 7,
    });
  });

  it('a soha fel nem oldott ígéretre a határidő után timed_out', async () => {
    const signal = new AbortController().signal;
    await expect(waitForSettlement(neverSettles(), Date.now() + 20, signal)).resolves.toStrictEqual({
      kind: 'timed_out',
    });
  });

  it('a már lejárt határidő is timed_out', async () => {
    const signal = new AbortController().signal;
    await expect(waitForSettlement(neverSettles(), Date.now() - 1000, signal)).resolves.toStrictEqual({
      kind: 'timed_out',
    });
  });

  it('a jel megszakítására aborted, és a figyelő utána lekerül', async () => {
    const controller = new AbortController();
    const waiting = waitForSettlement(neverSettles(), Date.now() + 10_000, controller.signal);
    controller.abort();
    await expect(waiting).resolves.toStrictEqual({ kind: 'aborted' });
  });

  it('a feloldás után a jel megszakítása már nem hat', async () => {
    const controller = new AbortController();
    const result = await waitForSettlement(Promise.resolve('kész'), Date.now() + 10_000, controller.signal);
    controller.abort();
    expect(result).toStrictEqual({ kind: 'settled', value: 'kész' });
  });
});
