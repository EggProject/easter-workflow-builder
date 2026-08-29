import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from './api-base-path.ts';
import { STREAM_PATH } from './stream-path.ts';

describe('STREAM_PATH', () => {
  it('értéke "/events"', () => {
    expect(STREAM_PATH).toBe('/events');
  });

  it('nem kezdődik az API_BASE_PATH értékével (SPEC-005 12. kritérium)', () => {
    expect(STREAM_PATH.startsWith(API_BASE_PATH)).toBe(false);
  });
});
