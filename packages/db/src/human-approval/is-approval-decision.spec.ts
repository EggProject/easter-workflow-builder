/* eslint-disable unicorn/no-null -- a `null` a tárolt `decision` oszlopból ténylegesen érkezhet (még el nem döntött jóváhagyás), ezért azt kell elutasítani, nem az `undefined` helyőrzőt */
import { describe, expect, it } from 'vitest';
import type { ApprovalDecision } from './approval-decision.ts';
import { isApprovalDecision } from './is-approval-decision.ts';

// A SPEC-003 4.12 szekció mindkét döntése. Az `ApprovalDecision[]` annotáció
// fordítási idejű állítás is: ha az unió bővül vagy szűkül, ez a lista nem
// maradhat érintetlenül.
const allApprovalDecisions: readonly ApprovalDecision[] = ['approved', 'rejected'];

describe('isApprovalDecision', () => {
  it('a két döntés mindegyikére igazat ad', () => {
    expect(allApprovalDecisions.every((decision) => isApprovalDecision(decision))).toBe(true);
    expect(allApprovalDecisions).toHaveLength(2);
  });

  it('hamisat ad ismeretlen szövegre', () => {
    expect(isApprovalDecision('pending')).toBe(false);
    expect(isApprovalDecision('')).toBe(false);
    // A `Record` alapú keresés nem eshet át a prototípus láncra.
    expect(isApprovalDecision('toString')).toBe(false);
    expect(isApprovalDecision('constructor')).toBe(false);
  });

  it('hamisat ad nem szöveg bemenetre', () => {
    expect(isApprovalDecision(undefined)).toBe(false);
    expect(isApprovalDecision(null)).toBe(false);
    expect(isApprovalDecision(7)).toBe(false);
    expect(isApprovalDecision({ decision: 'approved' })).toBe(false);
    expect(isApprovalDecision(['approved'])).toBe(false);
  });
});
