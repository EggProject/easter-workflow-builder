import { describe, expect, it } from 'vitest';
import { reduceTranscriptAutoScroll } from './reduce-transcript-auto-scroll.ts';
import type { TranscriptAutoScrollState } from './transcript-auto-scroll-state.ts';

const FOLLOWING: TranscriptAutoScrollState = {
  isFollowing: true,
  settledRowCount: 10,
  unseenCount: 0,
  lastStopIndex: 9,
};

describe('reduceTranscriptAutoScroll', () => {
  describe('rows_rendered', () => {
    it('ha az utolsó sor látható, bekapcsolja a követést és nullázza a nem látott sorokat', () => {
      const scrolledUp: TranscriptAutoScrollState = { ...FOLLOWING, isFollowing: false, unseenCount: 3 };
      expect(reduceTranscriptAutoScroll(scrolledUp, { type: 'rows_rendered', stopIndex: 12, rowCount: 13 })).toEqual({
        isFollowing: true,
        settledRowCount: 10,
        unseenCount: 0,
        lastStopIndex: 12,
      });
    });

    it('felfelé mozdult tartomány mellett, ha az utolsó sor nem látható, kikapcsolja a követést', () => {
      const next = reduceTranscriptAutoScroll(FOLLOWING, { type: 'rows_rendered', stopIndex: 6, rowCount: 10 });
      expect(next.isFollowing).toBe(false);
      expect(next.lastStopIndex).toBe(6);
    });

    it('új sor érkezésekor a még el nem görgetett, változatlan tartomány nem kapcsolja ki a követést', () => {
      const next = reduceTranscriptAutoScroll(FOLLOWING, { type: 'rows_rendered', stopIndex: 9, rowCount: 11 });
      expect(next.isFollowing).toBe(true);
    });

    it('lefelé mozdult, de még nem az aljáig érő tartomány a kikapcsolt követést nem kapcsolja vissza', () => {
      const scrolledUp: TranscriptAutoScrollState = { ...FOLLOWING, isFollowing: false, lastStopIndex: 4 };
      const next = reduceTranscriptAutoScroll(scrolledUp, { type: 'rows_rendered', stopIndex: 6, rowCount: 10 });
      expect(next.isFollowing).toBe(false);
      expect(next.lastStopIndex).toBe(6);
    });
  });

  describe('rows_arrived', () => {
    it('változatlan sorszámra a kapott állapotot adja vissza', () => {
      expect(reduceTranscriptAutoScroll(FOLLOWING, { type: 'rows_arrived', rowCount: 10 })).toBe(FOLLOWING);
    });

    it('követés közben nem számol', () => {
      expect(reduceTranscriptAutoScroll(FOLLOWING, { type: 'rows_arrived', rowCount: 14 })).toEqual({
        ...FOLLOWING,
        settledRowCount: 14,
        unseenCount: 0,
      });
    });

    it('felgörgetett állapotban az érkezett sorokat a nem látottakhoz adja', () => {
      const scrolledUp: TranscriptAutoScrollState = { ...FOLLOWING, isFollowing: false, unseenCount: 2 };
      expect(reduceTranscriptAutoScroll(scrolledUp, { type: 'rows_arrived', rowCount: 13 })).toEqual({
        ...scrolledUp,
        settledRowCount: 13,
        unseenCount: 5,
      });
    });
  });

  it('jump_requested visszakapcsolja a követést és nullázza a nem látott sorokat', () => {
    const scrolledUp: TranscriptAutoScrollState = { ...FOLLOWING, isFollowing: false, unseenCount: 4 };
    expect(reduceTranscriptAutoScroll(scrolledUp, { type: 'jump_requested' })).toEqual({
      ...scrolledUp,
      isFollowing: true,
      unseenCount: 0,
    });
  });
});
