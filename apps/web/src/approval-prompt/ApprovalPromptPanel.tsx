import type { ApprovalDecision, PendingApproval } from '@easter-workflow-builder/protocol';
import { Alert, DrawerSections, Pagination, ProgressBar, type PaginationLabels } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { ApprovalDecisionActions } from './ApprovalDecisionActions.tsx';
import { ApprovalPromptCard } from './ApprovalPromptCard.tsx';
import type { ShownApproval } from './select-shown-approval.ts';
import './approval-prompt.css';

export interface ApprovalPromptPanelProperties {
  /**
   * Igaz, amíg az ELSŐ betöltés tart (`use-pending-approvals.ts`: még nincs
   * sikeres lista és hiba sincs).
   */
  readonly isFirstLoadPending: boolean;
  readonly failureMessage: string | undefined;
  /**
   * A megjelenített jóváhagyások száma: a lapozó "k / n" alakjának `n`
   * értéke (`select-displayed-approvals.ts`).
   */
  readonly approvalCount: number;
  /**
   * A látott jóváhagyás (`use-approval-selection.ts`), `undefined`, ha
   * nincs megjelenített jóváhagyás.
   */
  readonly shown: ShownApproval | undefined;
  /**
   * A lapozó választása, 1-től számozott oldallal.
   */
  readonly onSelectPage: (page: number) => void;
  readonly onDecide: (approval: PendingApproval, decision: ApprovalDecision) => void;
}

/**
 * A lapozó magyar szövegei; a meta "k / n" alakú (user döntés 2026-09-25).
 */
const APPROVAL_PAGINATION_LABELS: PaginationLabels = {
  navigation: 'Jóváhagyások lapozása',
  previous: 'Előző',
  next: 'Következő',
  pageMetaPrefix: '',
  pageMetaSeparator: ' / ',
  rangeMetaSeparator: ' / ',
};

/**
 * A lapozó szomszéd oldalszámainak száma. A forrás alapértéke (1) mellett
 * 375 pixelen, tíz jóváhagyásnál az első és az utolsó oldalon a "k / n"
 * helyjelző két sorba törik, mert az oldalszámok kiszorítják; nullával egy
 * sorban marad (mérve, `docs/research/2026-09-24-jovahagyas-panel-helye.md`
 * 8. szekció).
 */
const PAGINATION_SIBLINGS = 0;

/**
 * A futás nézet jóváhagyás panelje, a transcript sávban, a transcript fölött
 * (SPEC-008 8. szekció, PLAN-009 5. szekció F6 sora, T-009-27). A
 * `RunViewScreen` mindig felcsatolja, mert a "sáv helye már látszik": az
 * ELSŐ betöltés alatt a `ProgressBar` jelez (9. szekció 14. async pont); az
 * élő újratöltések alatt nem, hogy a panel ne villogjon minden jelző keretre.
 * Nulla jóváhagyásra semmi nem rajzolódik (üres `<div>`, doboz nélkül, tilos
 * a card in card).
 *
 * **Egyszerre egy jóváhagyás** (user döntés 2026-09-25, SPEC-008 8. szekció
 * 1. pont). Felül a design system lapozója vált a jóváhagyások között ("k /
 * n"), alatta a design system `drawer` törzs és lábléc szerkezete
 * (`DrawerSections`): a görgethető törzsben a "visszavonhatatlan" `Alert` és
 * a látott jóváhagyás teljes szövege és `payload` értéke, a tapadó
 * akciósávban csak az ő két gombja és a döntés eredménye. A gombok tehát
 * mindig a LÁTOTT jóváhagyásra döntenek, és görgetés nélkül látszanak. A
 * `key` a jóváhagyás azonosítója: lapozáskor a törzs a tetejéről indul, nem
 * az előző jóváhagyás görgetési helyéről.
 *
 * Csak megjelenít: a lista a `usePendingApprovals`, a döntések állapota a
 * `useApprovalDecisions`, a kiválasztás a `useApprovalSelection` hookból
 * jön, mindhárom a `RunViewScreen` szintjén.
 */
export function ApprovalPromptPanel(properties: Readonly<ApprovalPromptPanelProperties>): ReactElement {
  const { isFirstLoadPending, failureMessage, approvalCount, shown, onSelectPage, onDecide } = properties;

  return (
    <div className="approval-prompt-panel">
      {isFirstLoadPending && (
        <ProgressBar isLabelVisible={false} ariaLabel="a függő jóváhagyások betöltése folyamatban" value={100} />
      )}
      {failureMessage !== undefined && <p role="alert">{failureMessage}</p>}
      {shown !== undefined && (
        <section className="approval-prompt-panel__approval" aria-label="Függő jóváhagyások">
          <Pagination
            page={shown.index + 1}
            pageCount={approvalCount}
            siblings={PAGINATION_SIBLINGS}
            onChange={onSelectPage}
            labels={APPROVAL_PAGINATION_LABELS}
          />
          <DrawerSections
            key={shown.approval.id}
            footer={
              <ApprovalDecisionActions
                progress={shown.progress}
                onDecide={(decision) => {
                  onDecide(shown.approval, decision);
                }}
              />
            }
          >
            <Alert variant="warning" title="A döntés visszavonhatatlan">
              Elküldés után sem a jóváhagyás, sem az elutasítás nem módosítható.
            </Alert>
            <ApprovalPromptCard approval={shown.approval} />
          </DrawerSections>
        </section>
      )}
    </div>
  );
}
