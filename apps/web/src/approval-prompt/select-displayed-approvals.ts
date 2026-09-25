import type { PendingApproval } from '@easter-workflow-builder/protocol';
import type { ApprovalDecisionProgress, ApprovalDecisionsState } from './reduce-approval-decisions.ts';

export interface DisplayedApproval {
  readonly approval: PendingApproval;
  /**
   * `undefined`, ha erre a jóváhagyásra még nem ment döntés.
   */
  readonly progress: ApprovalDecisionProgress | undefined;
}

/**
 * A panelen megjelenő kártyák: a friss lista, kiegészítve azokkal az
 * elküldött döntésekkel, amiket a lista már nem tartalmaz
 * (`reduce-approval-decisions.ts`), hogy az eredményük a futás váltásáig
 * látsszon.
 *
 * **A sorrend a kérés időpontja** (`requestedAtMs`, növekvő), ugyanaz, amit a
 * `GET /api/approvals` is ad (`packages/db` `human-approval-repository.ts`
 * `listPendingApprovals`). Enélkül a listából kikerült, de még látható kártya
 * és a döntési sora a lista végére ugrana. A `toSorted` stabil, tehát azonos
 * időpontnál a lista sorrendje marad.
 */
export function selectDisplayedApprovals(
  listed: readonly PendingApproval[],
  decisions: ApprovalDecisionsState,
): readonly DisplayedApproval[] {
  const listedIds = new Set(listed.map((approval) => approval.id));
  const retained = decisions.tracked
    .values()
    .map((tracked) => tracked.approval)
    .filter((approval) => !listedIds.has(approval.id))
    .toArray();

  return [...listed, ...retained]
    .toSorted((first, second) => first.requestedAtMs - second.requestedAtMs)
    .map((approval) => ({ approval, progress: decisions.tracked.get(approval.id)?.progress }));
}
