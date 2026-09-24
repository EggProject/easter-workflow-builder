import type { ApprovalDecision, PendingApproval } from '@easter-workflow-builder/protocol';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';

/**
 * Egy jóváhagyásra elküldött döntés állapota a felületen (SPEC-008 8.
 * szekció, T-009-27).
 *
 * - `sending`: a `POST /api/approvals/{id}/decision` válaszára vár.
 * - `decided`: a szerver elfogadta a döntést.
 * - `failed`: a hívás hibát adott. Az `isFinal` hamis, ha a hiba ÁTMENETI
 *   (`RouteFailure.isTransient`: hálózati hiba, 502, 503), tehát nem tudni,
 *   hogy a döntés megtörtént-e, és az újrapróbálás értelmes; minden más hiba
 *   (`conflict`, `not_found`) végleges: a jóváhagyás már el van döntve vagy
 *   döntés nélkül lezárult (SPEC-005 4.2).
 */
export type ApprovalDecisionProgress =
  | { readonly status: 'sending'; readonly decision: ApprovalDecision }
  | { readonly status: 'decided'; readonly decision: ApprovalDecision }
  | { readonly status: 'failed'; readonly message: string; readonly isFinal: boolean };

export interface TrackedApprovalDecision {
  /**
   * A jóváhagyás a döntés pillanatában: a kártya ebből rajzolódik akkor is,
   * ha a friss `GET /api/approvals` válasz már nem tartalmazza.
   */
  readonly approval: PendingApproval;
  readonly progress: ApprovalDecisionProgress;
}

export interface ApprovalDecisionsState {
  /**
   * Az elküldött döntések, a jóváhagyás azonosítója szerint.
   */
  readonly tracked: ReadonlyMap<string, TrackedApprovalDecision>;
  /**
   * A user által nyugtázott, lezárt döntések jóváhagyás azonosítói: ezek a
   * kártyák a nézet élete alatt többé nem jelennek meg, akkor sem, ha egy
   * elbukott újratöltés miatt a lista még a régi állapotot mutatja.
   */
  readonly hiddenIds: ReadonlySet<string>;
}

export type ApprovalDecisionsAction =
  | { readonly kind: 'sent'; readonly approval: PendingApproval; readonly decision: ApprovalDecision }
  | {
      readonly kind: 'answered';
      readonly approval: PendingApproval;
      readonly decision: ApprovalDecision;
      readonly outcome: RouteOutcome<unknown>;
    }
  | { readonly kind: 'dismissed'; readonly approvalId: string }
  | { readonly kind: 'reset' };

export const INITIAL_APPROVAL_DECISIONS_STATE: ApprovalDecisionsState = {
  tracked: new Map(),
  hiddenIds: new Set(),
};

function withTracked(
  state: ApprovalDecisionsState,
  approval: PendingApproval,
  progress: ApprovalDecisionProgress,
): ApprovalDecisionsState {
  return { ...state, tracked: new Map(state.tracked).set(approval.id, { approval, progress }) };
}

/**
 * A jóváhagyás panel döntés állapotának átmenetei (T-009-27 javítás, egy
 * független ellenőrzés nyomán).
 *
 * **Egy eldöntött vagy véglegesen elbukott kártya gombjai soha nem
 * kapcsolnak vissza**, és az eredmény üzenet addig látszik, amíg a user
 * nyugtázza (`dismissed`). A döntés állapota ezért NEM a kártya saját
 * állapota: a kártya leszerelődik, amikor a friss lista már nem tartalmazza a
 * jóváhagyást (ez pont a sikeres döntés és a `conflict` után történik), és
 * vele az eredmény is elveszne.
 *
 * A nyugtázás a lezárt döntést (`decided`, végleges `failed`) elrejti a nézet
 * élete alatt; az átmeneti hibát viszont csak törli, hogy ha a jóváhagyás a
 * szerver szerint még függ, a kártya újra döntésre kínálja.
 *
 * A `reset` egy másik futásra váltáskor mindent töröl, és egy olyan
 * jóváhagyásra érkező válasz, amit az állapot nem követ (a váltás előtt
 * elküldött döntés késve érkező válasza), nem íródik be, hogy a régi futás
 * kártyája ne jelenjen meg az új futás nézetében.
 */
export function reduceApprovalDecisions(
  state: ApprovalDecisionsState,
  action: ApprovalDecisionsAction,
): ApprovalDecisionsState {
  switch (action.kind) {
    case 'sent': {
      return withTracked(state, action.approval, { status: 'sending', decision: action.decision });
    }
    case 'answered': {
      const { outcome } = action;
      if (!state.tracked.has(action.approval.id)) {
        return state;
      }
      return withTracked(
        state,
        action.approval,
        outcome.kind === 'ok'
          ? { status: 'decided', decision: action.decision }
          : { status: 'failed', message: outcome.message, isFinal: !outcome.isTransient },
      );
    }
    case 'dismissed': {
      const progress = state.tracked.get(action.approvalId)?.progress;
      const tracked = new Map(state.tracked);
      tracked.delete(action.approvalId);
      const isRetryable = progress?.status === 'failed' && !progress.isFinal;
      return {
        tracked,
        hiddenIds: isRetryable ? state.hiddenIds : new Set(state.hiddenIds).add(action.approvalId),
      };
    }
    case 'reset': {
      return INITIAL_APPROVAL_DECISIONS_STATE;
    }
  }
}
