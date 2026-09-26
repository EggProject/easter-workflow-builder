import { describe, expect, it } from 'vitest';
import { reduceTranscriptAutoScroll } from './reduce-transcript-auto-scroll.ts';
import type { TranscriptAutoScrollState } from './transcript-auto-scroll-state.ts';

const FOLLOWING: TranscriptAutoScrollState = {
  isFollowing: true,
  settledRowCount: 10,
  unseenCount: 0,
  lastStopIndex: 9,
  isPausedByToggle: false,
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
        isPausedByToggle: false,
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
      expect(reduceTranscriptAutoScroll(FOLLOWING, { type: 'rows_arrived', rowCount: 10, isFollowed: true })).toBe(
        FOLLOWING,
      );
    });

    it('a követett érkezést nem számolja', () => {
      expect(reduceTranscriptAutoScroll(FOLLOWING, { type: 'rows_arrived', rowCount: 14, isFollowed: true })).toEqual({
        ...FOLLOWING,
        settledRowCount: 14,
        unseenCount: 0,
      });
    });

    it('a nem követett érkezés sorait a nem látottakhoz adja', () => {
      const scrolledUp: TranscriptAutoScrollState = { ...FOLLOWING, isFollowing: false, unseenCount: 2 };
      expect(reduceTranscriptAutoScroll(scrolledUp, { type: 'rows_arrived', rowCount: 13, isFollowed: false })).toEqual(
        {
          ...scrolledUp,
          settledRowCount: 13,
          unseenCount: 5,
        },
      );
    });
  });

  it('jump_requested visszakapcsolja a követést, nullázza a nem látott sorokat, és lezárja a sor váltás szünetét', () => {
    const waiting: TranscriptAutoScrollState = {
      ...FOLLOWING,
      isFollowing: false,
      unseenCount: 4,
      isPausedByToggle: true,
    };
    expect(reduceTranscriptAutoScroll(waiting, { type: 'jump_requested' })).toEqual({
      ...waiting,
      isFollowing: true,
      unseenCount: 0,
      isPausedByToggle: false,
    });
  });

  describe('sor kinyitása vagy becsukása', () => {
    const TOGGLED: TranscriptAutoScrollState = { ...FOLLOWING, isFollowing: false, isPausedByToggle: true };

    it('row_toggle_started kikapcsolja a követést, és szünetet indít', () => {
      expect(reduceTranscriptAutoScroll(FOLLOWING, { type: 'row_toggle_started' })).toEqual(TOGGLED);
    });

    it('a szünet alatti jelentés akkor sem kapcsolja vissza a követést, ha szerinte az utolsó sor látható', () => {
      expect(reduceTranscriptAutoScroll(TOGGLED, { type: 'rows_rendered', stopIndex: 9, rowCount: 10 })).toEqual(
        TOGGLED,
      );
    });

    it('a szünet alatti, felfelé mozdult tartományt jelző jelentést rögzíti', () => {
      expect(reduceTranscriptAutoScroll(TOGGLED, { type: 'rows_rendered', stopIndex: 6, rowCount: 10 })).toEqual({
        ...TOGGLED,
        lastStopIndex: 6,
      });
    });

    it('row_toggle_settled visszakapcsolja a követést, ha az utolsó jelentés szerint az utolsó sor látható', () => {
      expect(reduceTranscriptAutoScroll(TOGGLED, { type: 'row_toggle_settled' })).toEqual(FOLLOWING);
    });

    it('row_toggle_settled kikapcsolva hagyja a követést, ha az utolsó jelentés szerint az utolsó sor nem látható', () => {
      const pushedOut: TranscriptAutoScrollState = { ...TOGGLED, lastStopIndex: 6 };
      expect(reduceTranscriptAutoScroll(pushedOut, { type: 'row_toggle_settled' })).toEqual({
        ...pushedOut,
        isPausedByToggle: false,
      });
    });

    it('bottom_reached_while_paused lezárja a szünetet, visszakapcsolja a követést és nullázza a nem látott sorokat', () => {
      const waiting: TranscriptAutoScrollState = { ...TOGGLED, unseenCount: 3, lastStopIndex: 12, settledRowCount: 13 };
      expect(reduceTranscriptAutoScroll(waiting, { type: 'bottom_reached_while_paused' })).toEqual({
        ...waiting,
        isFollowing: true,
        unseenCount: 0,
        isPausedByToggle: false,
      });
    });

    it('row_toggle_settled a szünet alatt érkezett, még nem látott sorokat nem nullázza', () => {
      const arrived = reduceTranscriptAutoScroll(TOGGLED, { type: 'rows_arrived', rowCount: 11, isFollowed: false });
      expect(arrived.unseenCount).toBe(1);
      expect(reduceTranscriptAutoScroll(arrived, { type: 'row_toggle_settled' })).toEqual({
        ...arrived,
        isPausedByToggle: false,
      });
    });
  });
});
