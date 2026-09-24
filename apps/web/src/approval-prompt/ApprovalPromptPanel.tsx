import type { FetchFunction } from '@easter-workflow-builder/core';
import type { PendingApproval } from '@easter-workflow-builder/protocol';
import { ProgressBar } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';
import './approval-prompt.css';

export interface ApprovalPromptPanelProperties {
  readonly approvals: readonly PendingApproval[];
  readonly isLoading: boolean;
  readonly failureMessage: string | undefined;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
  readonly onDecided: () => void;
}

/**
 * A futás nézet jóváhagyás sávja (SPEC-008 8. szekció, 9. szekció 14. és 15.
 * async pont, T-009-27). A `RunViewScreen` mindig felcsatolja, mert a "sáv
 * helye már látszik": betöltés alatt a `ProgressBar` jelez, utána vagy a
 * kártyák, vagy - nulla függő jóváhagyásra - semmi (üres `<div>`, doboz
 * nélkül, tilos a card in card).
 *
 * A `usePendingApprovals` hook a hívó (`RunViewScreen`) szintjén fut, mert az
 * adatra a rajz csomópont dekorációja is rászorul
 * (`pending-approval-requested-at-by-step-run.ts`); ez a komponens csak
 * megjelenít, nem tölt be.
 */
export function ApprovalPromptPanel(properties: Readonly<ApprovalPromptPanelProperties>): ReactElement {
  const { approvals, isLoading, failureMessage, apiOrigin, fetchFunction, onDecided } = properties;

  return (
    <div className="approval-prompt-panel">
      {isLoading && (
        <ProgressBar isLabelVisible={false} ariaLabel="a függő jóváhagyások betöltése folyamatban" value={100} />
      )}
      {failureMessage !== undefined && <p role="alert">{failureMessage}</p>}
      {approvals.length > 0 && (
        <section className="approval-prompt-panel__list" aria-label="Függő jóváhagyások">
          {approvals.map((approval) => (
            <ApprovalPromptCard
              key={approval.id}
              approval={approval}
              apiOrigin={apiOrigin}
              fetchFunction={fetchFunction}
              onDecided={onDecided}
            />
          ))}
        </section>
      )}
    </div>
  );
}
