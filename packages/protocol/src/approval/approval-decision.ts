import { z } from 'zod';

/**
 * A jóváhagyási döntés két lehetséges értéke, drótszintű felsorolásként
 * (SPEC-003 4.12 szekció, SPEC-005 7.6 szekció). A `protocol` L1, tehát a
 * `db` (L2) `ApprovalDecision` unióját nem importálhatja: szándékos
 * duplikáció, a sodródás védelmét az `apps/server` regressziós tesztje adja
 * (T-006-12), az `isApprovalDecision` futásidejű guardra is kiterjedően.
 */
export const ApprovalDecisionSchema = z.enum(['approved', 'rejected']);

export type ApprovalDecision = z.infer<typeof ApprovalDecisionSchema>;
