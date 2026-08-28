import { describe, expect, it } from 'vitest';
import type { StepRunStatus } from './step-run-status.ts';
import { canTransitionStepRunStatus } from './can-transition-step-run-status.ts';

// A SPEC-003 7.2 táblázatának mind a nyolc állapota, a táblázat sorrendjében.
const ALL_STEP_RUN_STATUSES: readonly StepRunStatus[] = [
  'pending',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'rejected',
  'cancelled',
  'interrupted',
];

// A 7.2 táblázat pontosan tizenkettő érvényes átmenete, szó szerint átemelve
// (3 a `pending`, 5 a `running`, 4 a `waiting_approval` sorból). Ez a lista a
// teszt saját, a vizsgált függvénytől független elvárása: nem a
// `canTransitionStepRunStatus` kimenetéből származtatjuk, hogy a teszt ne
// tautológiává váljon.
const VALID_TRANSITIONS: ReadonlySet<`${StepRunStatus}->${StepRunStatus}`> = new Set([
  'pending->running',
  'pending->cancelled',
  'pending->interrupted',
  'running->waiting_approval',
  'running->succeeded',
  'running->failed',
  'running->cancelled',
  'running->interrupted',
  'waiting_approval->succeeded',
  'waiting_approval->rejected',
  'waiting_approval->cancelled',
  'waiting_approval->interrupted',
]);

describe('canTransitionStepRunStatus', () => {
  // A teljes 8x8 kereszttábla mind a 64 kombinációja, egyenként saját
  // teszteset. A 12 érvényes átmenetre igazat, a maradék 52 érvénytelenre
  // hamisat várunk; egyetlen kombináció sincs kihagyva.
  for (const from of ALL_STEP_RUN_STATUSES) {
    for (const to of ALL_STEP_RUN_STATUSES) {
      const key: `${StepRunStatus}->${StepRunStatus}` = `${from}->${to}`;
      const isValidTransition = VALID_TRANSITIONS.has(key);
      it(`${key} átmenet ${isValidTransition ? 'érvényes' : 'érvénytelen'}`, () => {
        expect(canTransitionStepRunStatus(from, to)).toBe(isValidTransition);
      });
    }
  }

  it('a tizenkettő érvényes átmenetet tartalmazza a vizsgálati lista', () => {
    expect(VALID_TRANSITIONS.size).toBe(12);
  });
});
