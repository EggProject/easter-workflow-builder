import { Pagination, ProgressBar, type PaginationLabels } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
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
 * A futás nézet jóváhagyás felületének FEJE, a transcript oldal tetején, a
 * húzható elválasztón kívül (SPEC-008 8. szekció 1. pont, T-009-27, user
 * döntés 2026-09-25: "a lapozó és a döntés gombsora fix helyen áll"). A
 * `RunViewScreen` mindig felcsatolja, mert a "sáv helye már látszik": az ELSŐ
 * betöltés alatt a `ProgressBar` jelez (9. szekció 14. async pont); az élő
 * újratöltések alatt nem, hogy a panel ne villogjon minden jelző keretre.
 * Nulla jóváhagyásra semmi nem rajzolódik (üres `<div>`, doboz nélkül).
 *
 * **Egyszerre egy jóváhagyás** (user döntés 2026-09-25). A fej a design
 * system lapozóját adja ("k / n"); a látott jóváhagyás tartalma a húzható
 * elválasztó fölötti panelben (`ApprovalPromptBody`), a két döntés gombja a
 * transcript alatti tapadó akciósávban (`ApprovalDecisionActions`) áll, a
 * design system `drawer` törzs és lábléc szerkezete szerint.
 *
 * Csak megjelenít: a lista a `usePendingApprovals`, a kiválasztás a
 * `useApprovalSelection` hookból jön, a `RunViewScreen` szintjén.
 */
export function ApprovalPromptPanel(properties: Readonly<ApprovalPromptPanelProperties>): ReactElement {
  const { isFirstLoadPending, failureMessage, approvalCount, shown, onSelectPage } = properties;

  return (
    <div className="approval-prompt-panel">
      {isFirstLoadPending && (
        <ProgressBar isLabelVisible={false} ariaLabel="a függő jóváhagyások betöltése folyamatban" value={100} />
      )}
      {failureMessage !== undefined && <p role="alert">{failureMessage}</p>}
      {shown !== undefined && (
        <Pagination
          page={shown.index + 1}
          pageCount={approvalCount}
          siblings={PAGINATION_SIBLINGS}
          onChange={onSelectPage}
          labels={APPROVAL_PAGINATION_LABELS}
        />
      )}
    </div>
  );
}
