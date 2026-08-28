/**
 * A jóváhagyási döntés két lehetséges értéke (SPEC-003 4.12 szekció). A
 * `human_approval.decision` oszlop ezen felül NULL is lehet, amíg nincs
 * döntés; azt az állapotot a repository határon a `ApprovalDecision | null`
 * típus írja le, nem ez az unió (`human-approval-repository.ts`).
 */
export type ApprovalDecision = 'approved' | 'rejected';
