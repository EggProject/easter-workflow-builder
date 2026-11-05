import { describe, expect, it } from 'vitest';
import { waitForSettlement } from './wait-for-settlement.ts';

function neverSettles(): Promise<number> {
  return new Promise(() => {
    // Szándékosan soha nem oldódik fel: a határidő ágát vizsgáljuk.
  });
}

describe('waitForSettlement', () => {
  it('a határidő előtt feloldott ígéret értékét adja', async () => {
    await expect(waitForSettlement(Promise.resolve(7), Date.now() + 1000)).resolves.toStrictEqual({
      kind: 'settled',
      value: 7,
    });
  });

  it('a soha fel nem oldott ígéretre a határidő után timed_out', async () => {
    await expect(waitForSettlement(neverSettles(), Date.now() + 20)).resolves.toStrictEqual({
      kind: 'timed_out',
    });
  });

  it('a már lejárt határidő is timed_out', async () => {
    await expect(waitForSettlement(neverSettles(), Date.now() - 1000)).resolves.toStrictEqual({
      kind: 'timed_out',
    });
  });
});
