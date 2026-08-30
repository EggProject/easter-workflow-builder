import { ApprovalDecisionRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toPendingApproval } from './to-pending-approval.ts';

function notFoundMessage(approvalId: string): string {
  return `A(z) "${approvalId}" azonosítójú, függőben lévő jóváhagyás nem található (not_found).`;
}

/**
 * `POST /api/approvals/{approvalId}/decision` (SPEC-005 4.2 C táblázat 18.
 * sora). A `HumanApprovalRepository` nem ismer `getApprovalById` metódust
 * (a repository felülete `packages/db/src/human-approval` alatt zárt, a
 * jelen lépés nem bővíti, SPEC-006 1. szekció "Amit NEM dönt el"), a döntés
 * viszont a motor `decideApproval` metódusán át `stepRunId` alapján megy
 * (`ApprovalDecisionInput`). A kezelő ezért a `listPendingApprovals`
 * listájában keresi meg az `approvalId`-t: ha nincs a függőben lévők
 * között, `not_found`-ot ad - ez a döntött vagy sosem létezett esetet
 * egységesen kezeli, mert a repository nem ad módot a kettő szétválasztására
 * `stepRunId` nélkül.
 */
export function createDecideApprovalHandler(database: DatabaseContext, engine: Engine): RouteHandler {
  return async (context) => {
    const parsedBody = ApprovalDecisionRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return { kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message };
    }

    const approvalId = context.parameters['approvalId'] ?? '';
    const pending = database.approvals.listPendingApprovals();
    if (pending.kind === 'error') {
      return pending;
    }
    const match = pending.value.find((record) => record.id === approvalId);
    if (match === undefined) {
      return { kind: 'error', message: notFoundMessage(approvalId) };
    }

    const decided = await engine.decideApproval({ stepRunId: match.stepRunId, decision: parsedBody.data.decision });
    if (decided.kind === 'error') {
      return decided;
    }

    const updated = database.approvals.getApprovalForStep(match.stepRunId);
    if (updated.kind === 'error') {
      return updated;
    }

    return { kind: 'ok', value: { status: 200, body: toPendingApproval(updated.value) } };
  };
}
