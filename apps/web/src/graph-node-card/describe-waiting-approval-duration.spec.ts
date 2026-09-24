import { describe, expect, it } from 'vitest';
import { describeWaitingApprovalDuration } from './describe-waiting-approval-duration.ts';

describe('describeWaitingApprovalDuration', () => {
  it('60 másodperc alatt másodpercben ad feliratot', () => {
    expect(describeWaitingApprovalDuration(1000, 1000)).toBe('0 másodperce vár');
    expect(describeWaitingApprovalDuration(1000, 1000 + 45_000)).toBe('45 másodperce vár');
  });

  it('60 másodperctől óráig percben ad feliratot', () => {
    expect(describeWaitingApprovalDuration(0, 60_000)).toBe('1 perce vár');
    expect(describeWaitingApprovalDuration(0, 59 * 60_000)).toBe('59 perce vár');
  });

  it('egy óra fölött órában ad feliratot', () => {
    expect(describeWaitingApprovalDuration(0, 60 * 60_000)).toBe('1 órája vár');
    expect(describeWaitingApprovalDuration(0, 3 * 60 * 60_000 + 1000)).toBe('3 órája vár');
  });

  it('a nowMs sosem ad negatív időtartamot (óra csúszás esetén nullára szorít)', () => {
    expect(describeWaitingApprovalDuration(5000, 1000)).toBe('0 másodperce vár');
  });
});
