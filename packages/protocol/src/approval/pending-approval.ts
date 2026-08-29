import { z } from 'zod';
import { ApprovalDecisionSchema } from './approval-decision.ts';

/**
 * `GET /api/approvals` egy sora, és a `POST .../decision` válasza is, a
 * döntéssel kitöltve (SPEC-005 4.2 C táblázat 17. és 18. sora), a
 * `packages/db` `HumanApprovalRecord` mezőit tükrözve (SPEC-003 4.12
 * szekció). A `requestedAtMs` kötelező mező (9. kritérium): a felület ebből
 * tudja megjeleníteni, mióta vár a jóváhagyás.
 */
export const PendingApprovalSchema = z
  .strictObject({
    id: z.string(),
    runId: z.string(),
    stepRunId: z.string(),
    title: z.string(),
    body: z.string(),
    payload: z.unknown(),
    decision: ApprovalDecisionSchema.nullable(),
    requestedAtMs: z.number(),
    decidedAtMs: z.number().nullable(),
  })
  .readonly();

export type PendingApproval = z.infer<typeof PendingApprovalSchema>;

/**
 * `POST /api/approvals/{approvalId}/decision` kérés törzse (SPEC-005 4.2 C
 * táblázat 18. sora).
 */
export const ApprovalDecisionRequestSchema = z.strictObject({
  decision: ApprovalDecisionSchema,
});

export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;
