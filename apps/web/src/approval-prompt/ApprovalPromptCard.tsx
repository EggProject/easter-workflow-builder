import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  PendingApprovalSchema,
  type ApprovalDecision,
  type ApprovalDecisionRequest,
  type PendingApproval,
} from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import { useId, useState, type ReactElement } from 'react';
import { requestRoute } from '../rest-client/request-route.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import './approval-prompt.css';

export interface ApprovalPromptCardProperties {
  readonly approval: PendingApproval;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
  /**
   * A döntés VÁLASZA UTÁN hívódik, a kimeneteltől függetlenül (sikeres
   * döntés, `conflict` vagy `not_found`): a hívó ebből tölti újra a listát
   * (`use-pending-approvals.ts` `reload`).
   */
  readonly onDecided: () => void;
}

/**
 * A `payload` mező formázott alakja, a `run-event-row` téma meglévő JSON
 * megjelenítési mintája szerint (`run-event-row.css` `.run-event-row__payload`):
 * `<pre>` elem, két szóközös behúzással szerializálva.
 */
function FormattedPayload(properties: Readonly<{ payload: unknown }>): ReactElement {
  return <pre className="approval-prompt-card__payload">{JSON.stringify(properties.payload, undefined, 2)}</pre>;
}

/**
 * Egy függő jóváhagyás panelje: a `title`, a `body`, a formázott `payload`,
 * és a két döntés gombja (SPEC-008 8. szekció, T-009-27, AC35). A döntés a
 * `POST /api/approvals/{id}/decision` hívás; a két gomb a küldés
 * pillanatától a válaszig letiltva (9. szekció 15. async pont), és a
 * megnyomott gombon spinner jelzi, melyik döntés van folyamatban.
 *
 * **A döntés visszavonhatatlan** (SPEC-008 8. szekció): egy második hívás
 * `conflict` hibát ad, amit a `perform-route-request.ts` már magyar
 * szöveggé alakít (`protocolErrorMessage`), ezért ez a komponens a
 * `useRequestState` `message` mezőjét közvetlenül megjelenítheti, saját
 * `conflict`/`not_found` leképezés nélkül.
 */
export function ApprovalPromptCard(properties: Readonly<ApprovalPromptCardProperties>): ReactElement {
  const { approval, apiOrigin, fetchFunction, onDecided } = properties;
  const decisionState = useRequestState<PendingApproval>();
  const [pendingDecision, setPendingDecision] = useState<ApprovalDecision | undefined>(undefined);
  const titleId = useId();

  function handleDecide(decision: ApprovalDecision): void {
    setPendingDecision(decision);
    void decisionState.run(async () => {
      const outcome = await requestRoute({
        routeId: 'decideApproval',
        parameters: { approvalId: approval.id },
        body: { decision } satisfies ApprovalDecisionRequest,
        responseSchema: PendingApprovalSchema,
        fetchFunction,
        apiOrigin,
      });
      onDecided();
      return outcome;
    });
  }

  const isSending = decisionState.state.status === 'pending';

  return (
    <article className="approval-prompt-card" aria-labelledby={titleId}>
      <h3 id={titleId} className="approval-prompt-card__title">
        {approval.title}
      </h3>
      <p className="approval-prompt-card__body">{approval.body}</p>
      <FormattedPayload payload={approval.payload} />
      <div className="approval-prompt-card__actions">
        <Button
          type="button"
          size="sm"
          variant="primary"
          isLoading={isSending && pendingDecision === 'approved'}
          disabled={isSending}
          onClick={() => {
            handleDecide('approved');
          }}
        >
          Jóváhagyás
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          isLoading={isSending && pendingDecision === 'rejected'}
          disabled={isSending}
          onClick={() => {
            handleDecide('rejected');
          }}
        >
          Elutasítás
        </Button>
      </div>
      {decisionState.state.status === 'failure' && <p role="alert">{decisionState.state.message}</p>}
    </article>
  );
}
