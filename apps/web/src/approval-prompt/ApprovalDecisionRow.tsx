import type { ApprovalDecision, PendingApproval } from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';
import type { ApprovalDecisionProgress } from './reduce-approval-decisions.ts';
import './approval-prompt.css';

export interface ApprovalDecisionRowProperties {
  readonly approval: PendingApproval;
  /**
   * Az erre a jóváhagyásra elküldött döntés állapota, `undefined`, ha még
   * nem ment döntés (`reduce-approval-decisions.ts`).
   */
  readonly progress: ApprovalDecisionProgress | undefined;
  readonly onDecide: (decision: ApprovalDecision) => void;
}

const DECISION_LABELS: Readonly<Record<ApprovalDecision, string>> = {
  approved: 'jóváhagyva',
  rejected: 'elutasítva',
};

/**
 * Egy jóváhagyás döntési sora a panel alján álló döntési sávban (SPEC-008 8.
 * szekció 1. és 3. pont): a jóváhagyás címe, a két döntés gomb, és alatta az
 * eredmény. A sor `group` szerepkörű csoport, a nevét a látható cím adja,
 * mert több jóváhagyásnál minden sorban ugyanaz a két gomb felirat áll.
 *
 * A két gomb a küldés pillanatától letiltva (9. szekció 15. async pont), a
 * megnyomotton spinnerrel, és **egy elfogadott vagy véglegesen elbukott
 * döntés után többé nem kapcsol vissza**; csak az átmeneti hiba (hálózati
 * hiba, 502, 503) engedi az újrapróbálást. Az eredmény (siker vagy a
 * hibaüzenet) külön nyugtázás nélkül látszik, amíg a nézet ugyanazon a
 * futáson áll (user döntés 2026-09-24).
 */
export function ApprovalDecisionRow(properties: Readonly<ApprovalDecisionRowProperties>): ReactElement {
  const { approval, progress, onDecide } = properties;
  const labelId = useId();

  const isSending = progress?.status === 'sending';
  const isRetryable = progress?.status === 'failed' && !progress.isFinal;
  const areDecisionsDisabled = progress !== undefined && !isRetryable;

  return (
    <div className="approval-decision-row" role="group" aria-labelledby={labelId}>
      <div className="approval-decision-row__bar">
        <span id={labelId} className="approval-decision-row__label">
          {approval.title}
        </span>
        <div className="approval-decision-row__actions">
          <Button
            type="button"
            size="sm"
            variant="primary"
            isLoading={isSending && progress.decision === 'approved'}
            disabled={areDecisionsDisabled}
            onClick={() => {
              onDecide('approved');
            }}
          >
            Jóváhagyás
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isLoading={isSending && progress.decision === 'rejected'}
            disabled={areDecisionsDisabled}
            onClick={() => {
              onDecide('rejected');
            }}
          >
            Elutasítás
          </Button>
        </div>
      </div>
      {progress?.status === 'decided' && (
        <p className="approval-decision-row__result" role="status">
          Döntés rögzítve: {DECISION_LABELS[progress.decision]}.
        </p>
      )}
      {progress?.status === 'failed' && (
        <p className="approval-decision-row__failure" role="alert">
          {progress.message}
        </p>
      )}
    </div>
  );
}
