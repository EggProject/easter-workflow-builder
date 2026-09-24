import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  PendingApprovalSchema,
  type ApprovalDecision,
  type ApprovalDecisionRequest,
  type PendingApproval,
} from '@easter-workflow-builder/protocol';
import { useEffect, useReducer } from 'react';
import { requestRoute } from '../rest-client/request-route.ts';
import { INITIAL_APPROVAL_DECISIONS_STATE, reduceApprovalDecisions } from './reduce-approval-decisions.ts';
import { selectDisplayedApprovals, type DisplayedApproval } from './select-displayed-approvals.ts';

export interface UseApprovalDecisionsInput {
  readonly runId: string | undefined;
  /**
   * A függő jóváhagyások friss listája (`use-pending-approvals.ts`).
   */
  readonly approvals: readonly PendingApproval[];
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
  /**
   * Minden döntés VÁLASZA UTÁN hívódik, a kimeneteltől függetlenül: a hívó
   * ebből tölti újra a listát (`use-pending-approvals.ts` `reload`).
   */
  readonly onDecided: () => void;
}

export interface ApprovalDecisions {
  /**
   * A panel kártyái, a döntés állapotával (`select-displayed-approvals.ts`).
   */
  readonly displayed: readonly DisplayedApproval[];
  readonly decide: (approval: PendingApproval, decision: ApprovalDecision) => void;
  readonly dismiss: (approvalId: string) => void;
}

/**
 * A jóváhagyás döntések kérése és állapota (SPEC-008 8. szekció, T-009-27):
 * `POST /api/approvals/{id}/decision`, és az eredmény megőrzése a user
 * nyugtázásáig (`reduce-approval-decisions.ts`).
 *
 * **Miért a képernyő szintjén fut, nem a panelben.** A panel a transcript
 * sávban áll (`RunViewLayout`), és a sáv a `--ep-screen-md` határon a
 * `Resizable` és a `Tabs` alak között vált, ami a panelt leszereli és újra
 * felcsatolja; egy panel szintű állapot ilyenkor a még nem nyugtázott
 * eredményt eldobná. Ugyanezért él a transcript állapota is a
 * `RunViewScreen` szintjén (`use-run-transcript.ts`).
 *
 * Egy másik futásra váltáskor az állapot törlődik.
 */
export function useApprovalDecisions(input: Readonly<UseApprovalDecisionsInput>): ApprovalDecisions {
  const { runId, approvals, fetchFunction, apiOrigin, onDecided } = input;
  const [state, dispatch] = useReducer(reduceApprovalDecisions, INITIAL_APPROVAL_DECISIONS_STATE);

  useEffect(() => {
    dispatch({ kind: 'reset' });
  }, [runId]);

  return {
    displayed: selectDisplayedApprovals(approvals, state),
    decide: (approval, decision) => {
      dispatch({ kind: 'sent', approval, decision });
      void requestRoute({
        routeId: 'decideApproval',
        parameters: { approvalId: approval.id },
        body: { decision } satisfies ApprovalDecisionRequest,
        responseSchema: PendingApprovalSchema,
        fetchFunction,
        apiOrigin,
      }).then((outcome) => {
        dispatch({ kind: 'answered', approval, decision, outcome });
        onDecided();
      });
    },
    dismiss: (approvalId) => {
      dispatch({ kind: 'dismissed', approvalId });
    },
  };
}
