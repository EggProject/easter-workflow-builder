import type { ApprovalDecision, PendingApproval } from '@easter-workflow-builder/protocol';
import { Alert, ProgressBar } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { ApprovalDecisionRow } from './ApprovalDecisionRow.tsx';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';
import type { DisplayedApproval } from './select-displayed-approvals.ts';
import './approval-prompt.css';

export interface ApprovalPromptPanelProperties {
  /**
   * Igaz, amíg az ELSŐ betöltés tart (`use-pending-approvals.ts`: még nincs
   * sikeres lista és hiba sincs).
   */
  readonly isFirstLoadPending: boolean;
  readonly failureMessage: string | undefined;
  readonly displayed: readonly DisplayedApproval[];
  readonly onDecide: (approval: PendingApproval, decision: ApprovalDecision) => void;
}

/**
 * A futás nézet jóváhagyás panelje, a transcript sávban, a transcript fölött
 * (SPEC-008 8. szekció, PLAN-009 5. szekció F6 sora, T-009-27). A
 * `RunViewScreen` mindig felcsatolja, mert a "sáv helye már látszik": az
 * ELSŐ betöltés alatt a `ProgressBar` jelez (9. szekció 14. async pont); az
 * élő újratöltések alatt nem, hogy a panel ne villogjon minden jelző keretre.
 * Nulla kártyára semmi nem rajzolódik (üres `<div>`, doboz nélkül, tilos a
 * card in card).
 *
 * **Két rész, és a döntés gombjai mindig látszanak** (user döntés
 * 2026-09-24, SPEC-008 8. szekció 1. pont): felül a görgethető tartalom (a
 * "visszavonhatatlan" `Alert` és a kártyák: cím, törzs, `payload`), alul a
 * döntési sáv, ami nem görget el, és MINDEN megjelenített jóváhagyásnak egy
 * sort ad (`ApprovalDecisionRow`). Így több jóváhagyásnál is minden függő
 * döntés gombja görgetés nélkül elérhető; a helyet a tartalom adja át.
 *
 * Csak megjelenít: a lista a `usePendingApprovals`, a döntések állapota a
 * `useApprovalDecisions` hookból jön, mindkettő a `RunViewScreen` szintjén.
 */
export function ApprovalPromptPanel(properties: Readonly<ApprovalPromptPanelProperties>): ReactElement {
  const { isFirstLoadPending, failureMessage, displayed, onDecide } = properties;

  return (
    <div className="approval-prompt-panel">
      {isFirstLoadPending && (
        <ProgressBar isLabelVisible={false} ariaLabel="a függő jóváhagyások betöltése folyamatban" value={100} />
      )}
      {failureMessage !== undefined && <p role="alert">{failureMessage}</p>}
      {displayed.length > 0 && (
        <section className="approval-prompt-panel__list" aria-label="Függő jóváhagyások">
          <div className="approval-prompt-panel__content">
            <Alert variant="warning" title="A döntés visszavonhatatlan">
              Elküldés után sem a jóváhagyás, sem az elutasítás nem módosítható.
            </Alert>
            {displayed.map(({ approval }) => (
              <ApprovalPromptCard key={approval.id} approval={approval} />
            ))}
          </div>
          <div className="approval-prompt-panel__decisions">
            {displayed.map(({ approval, progress }) => (
              <ApprovalDecisionRow
                key={approval.id}
                approval={approval}
                progress={progress}
                onDecide={(decision) => {
                  onDecide(approval, decision);
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
