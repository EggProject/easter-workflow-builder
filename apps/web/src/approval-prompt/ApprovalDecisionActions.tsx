import type { ApprovalDecision } from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import type { ApprovalDecisionProgress } from './reduce-approval-decisions.ts';
import './approval-prompt.css';

export interface ApprovalDecisionActionsProperties {
  /**
   * A LÁTOTT jóváhagyásra elküldött döntés állapota, `undefined`, ha még nem
   * ment döntés (`reduce-approval-decisions.ts`).
   */
  readonly progress: ApprovalDecisionProgress | undefined;
  readonly onDecide: (decision: ApprovalDecision) => void;
}

const DECISION_LABELS: Readonly<Record<ApprovalDecision, string>> = {
  approved: 'jóváhagyva',
  rejected: 'elutasítva',
};

/**
 * A látott jóváhagyás tapadó akciósávjának tartalma (SPEC-008 8. szekció 1.
 * és 3. pont, user döntés 2026-09-25: "egyszerre egy"): a két `sm` döntés
 * gomb, és előttük a döntés eredménye. A sáv maga a design system
 * `.drawer__footer` eleme (`DrawerSections` `footer` szlotja), ez a
 * komponens a gyerekeit adja, burkoló nélkül, hogy a sáv saját térköze és
 * igazítása érvényesüljön.
 *
 * A két gomb a küldés pillanatától letiltva (9. szekció 15. async pont), a
 * megnyomotton spinnerrel, és **egy elfogadott vagy véglegesen elbukott
 * döntés után többé nem kapcsol vissza**; csak az átmeneti hiba (hálózati
 * hiba, 502, 503) engedi az újrapróbálást. Az eredmény (siker vagy a
 * hibaüzenet) külön nyugtázás nélkül látszik, amíg a nézet ugyanazon a
 * futáson áll (user döntés 2026-09-24); a sáv nem görget, tehát görgetés
 * nélkül.
 */
export function ApprovalDecisionActions(properties: Readonly<ApprovalDecisionActionsProperties>): ReactElement {
  const { progress, onDecide } = properties;

  const isSending = progress?.status === 'sending';
  const isRetryable = progress?.status === 'failed' && !progress.isFinal;
  const areDecisionsDisabled = progress !== undefined && !isRetryable;

  return (
    <>
      {progress?.status === 'decided' && (
        <p className="approval-decision-actions__result" role="status">
          Döntés rögzítve: {DECISION_LABELS[progress.decision]}.
        </p>
      )}
      {progress?.status === 'failed' && (
        <p className="approval-decision-actions__failure" role="alert">
          {progress.message}
        </p>
      )}
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
    </>
  );
}
