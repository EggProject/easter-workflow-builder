import { describe, expect, it } from 'vitest';
import { COLLAPSED_TRANSCRIPT_ROW_HEIGHT } from './collapsed-transcript-row-height.ts';
import { isCompactTranscriptList } from './is-compact-transcript-list.ts';

describe('isCompactTranscriptList', () => {
  it('egy sornál kisebb tartalom dobozú lista szűk', () => {
    expect(isCompactTranscriptList({ height: COLLAPSED_TRANSCRIPT_ROW_HEIGHT - 0.5 })).toBe(true);
    expect(isCompactTranscriptList({ height: 0 })).toBe(true);
  });

  it('pontosan egy sornyi vagy nagyobb tartalom dobozú lista nem szűk', () => {
    expect(isCompactTranscriptList({ height: COLLAPSED_TRANSCRIPT_ROW_HEIGHT })).toBe(false);
    expect(isCompactTranscriptList({ height: 597 })).toBe(false);
  });
});
