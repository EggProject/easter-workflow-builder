import { ApprovalDecisionRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toPendingApproval } from './to-pending-approval.ts';

/**
 * `POST /api/approvals/{approvalId}/decision` (SPEC-005 4.2 C táblázat 18.
 * sora). A jóváhagyást az azonosítója szerint olvassa (`getApproval`, user
 * döntés 2026-09-23), nem a függő listából: a nem létező azonosító így
 * `not_found` (404), a létező, de már eldöntött vagy döntés nélkül lezárt
 * jóváhagyás viszont eljut a motorig, és a `db` compare and set döntése
 * bukik rajta: `already_decided`, illetve a lépés sorának terminális
 * állapotán `illegal_status_transition`, mindkettő `conflict` (409, SPEC-005
 * 8.2). A döntés a motor `decideApproval` metódusán át `stepRunId` alapján
 * megy (`ApprovalDecisionInput`).
 */
export function createDecideApprovalHandler(database: DatabaseContext, engine: Engine): RouteHandler {
  return async (context) => {
    const parsedBody = ApprovalDecisionRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return { kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message };
    }

    const approvalId = context.parameters['approvalId'] ?? '';
    const approval = database.approvals.getApproval(approvalId);
    if (approval.kind === 'error') {
      return approval;
    }

    const { stepRunId } = approval.value;
    const decided = await engine.decideApproval({ stepRunId, decision: parsedBody.data.decision });
    if (decided.kind === 'error') {
      return decided;
    }

    const updated = database.approvals.getApprovalForStep(stepRunId);
    if (updated.kind === 'error') {
      return updated;
    }

    return { kind: 'ok', value: { status: 200, body: toPendingApproval(updated.value) } };
  };
}
