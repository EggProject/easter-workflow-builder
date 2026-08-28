import { describe, expect, it } from 'vitest';
import type { RunStatus } from './run-status.ts';
import { canTransitionRunStatus } from './can-transition-run-status.ts';

// A SPEC-003 7.1 táblázatának mind a hat állapota, a táblázat sorrendjében.
const ALL_RUN_STATUSES: readonly RunStatus[] = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
];

// A 7.1 táblázat pontosan hét érvényes átmenete, szó szerint átemelve. Ez a
// lista a teszt saját, a vizsgált függvénytől független elvárása: nem a
// `canTransitionRunStatus` kimenetéből származtatjuk, hogy a teszt ne
// tautológiává váljon.
const VALID_TRANSITIONS: ReadonlySet<`${RunStatus}->${RunStatus}`> = new Set([
  'pending->running',
  'pending->cancelled',
  'pending->interrupted',
  'running->succeeded',
  'running->failed',
  'running->cancelled',
  'running->interrupted',
]);

describe('canTransitionRunStatus', () => {
  // A teljes 6x6 kereszttábla mind a 36 kombinációja, egyenként saját
  // teszteset. A 7 érvényes átmenetre igazat, a maradék 29 érvénytelenre
  // hamisat várunk; egyetlen kombináció sincs kihagyva.
  for (const from of ALL_RUN_STATUSES) {
    for (const to of ALL_RUN_STATUSES) {
      const key: `${RunStatus}->${RunStatus}` = `${from}->${to}`;
      const isValidTransition = VALID_TRANSITIONS.has(key);
      it(`${key} átmenet ${isValidTransition ? 'érvényes' : 'érvénytelen'}`, () => {
        expect(canTransitionRunStatus(from, to)).toBe(isValidTransition);
      });
    }
  }

  it('a hét érvényes átmenetet tartalmazza a vizsgálati lista', () => {
    expect(VALID_TRANSITIONS.size).toBe(7);
  });
});
