import { describe, expect, it } from 'vitest';
import { describeWaitingApprovalSince } from './describe-waiting-approval-since.ts';

describe('describeWaitingApprovalSince', () => {
  it('a kérés abszolút időpontját adja a helyi időben, a transcript sorok időformázásával', () => {
    // Helyi időben megadott időpont: a teszt a futtató gép időzónájától
    // függetlenül ugyanazt az óra:perc:másodperc alakot várja.
    const requestedAtMs = new Date(2026, 8, 24, 10, 32, 5).getTime();

    expect(describeWaitingApprovalSince(requestedAtMs)).toBe('10:32:05 óta vár');
    expect(describeWaitingApprovalSince(requestedAtMs)).toBe(
      `${new Date(requestedAtMs).toLocaleTimeString('hu-HU')} óta vár`,
    );
  });
});
