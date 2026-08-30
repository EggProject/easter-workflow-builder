import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toPendingApproval } from './to-pending-approval.ts';

/**
`GET /api/approvals` (SPEC-005 4.2 C táblázat 17. sora). Saját hibaága nincs.
*/
export function createListPendingApprovalsHandler(database: DatabaseContext): RouteHandler {
  return () => {
    const listed = database.approvals.listPendingApprovals();
    if (listed.kind === 'error') {
      return Promise.resolve(listed);
    }
    return Promise.resolve({
      kind: 'ok',
      value: { status: 200, body: listed.value.map((record) => toPendingApproval(record)) },
    });
  };
}
