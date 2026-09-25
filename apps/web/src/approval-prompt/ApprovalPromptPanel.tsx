import { Pagination, ProgressBar, type PaginationLabels } from '@easter-workflow-builder/ui';
import type { ReactElement, ReactNode } from 'react';
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
  /**
   * A látott jóváhagyás döntés akciósávja (`ApprovalDecisionActions`), a
   * lapozó alatt; csak látott jóváhagyás mellett rajzolódik ki.
   */
  readonly decisionActions: ReactNode;
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
 * A futás nézet "Függő jóváhagyások" régiója a transcript oldal ALJÁN, a
 * húzható elválasztón kívül, közvetlenül a látott jóváhagyás szövege alatt
 * (SPEC-008 8. szekció 1. pont, T-009-27, user döntés 2026-09-25: "transcript
 * felül, kérdés alul", mint egy CLI engedélykérés). Benne felülről lefelé: az
 * ELSŐ betöltés alatt a `ProgressBar` (9. szekció 14. async pont; az élő
 * újratöltések alatt nem, hogy a panel ne villogjon minden jelző keretre), a
 * lista hibaüzenete, és látott jóváhagyás mellett a design system lapozója
 * ("k / n") és a döntés akciósávja (`decisionActions`).
 *
 * **Régió, és csak tartalommal.** A `<section>` a hozzáférhető nevétől régió
 * (W3C APG Landmark Regions); a név csak akkor áll, ha van mit mutatni, mert
 * egy üres régió a képernyőolvasó régió listájában tartalom nélküli találat
 * lenne. A látott jóváhagyás szövege a húzható panelben áll
 * (`ApprovalPromptBody`), tehát nem lehet ennek a régiónak a gyereke; a
 * döntés gombjainak csoportja azonosítóval kötődik hozzá
 * (`ApprovalDecisionActions`).
 *
 * **Egyszerre egy jóváhagyás** (user döntés 2026-09-25). Csak megjelenít: a
 * lista a `usePendingApprovals`, a kiválasztás a `useApprovalSelection`
 * hookból jön, a `RunViewScreen` szintjén.
 */
export function ApprovalPromptPanel(properties: Readonly<ApprovalPromptPanelProperties>): ReactElement {
  const { isFirstLoadPending, failureMessage, approvalCount, shown, onSelectPage, decisionActions } = properties;
  const hasContent = isFirstLoadPending || failureMessage !== undefined || shown !== undefined;

  return (
    <section className="approval-prompt-panel" aria-label={hasContent ? 'Függő jóváhagyások' : undefined}>
      {isFirstLoadPending && (
        <ProgressBar isLabelVisible={false} ariaLabel="a függő jóváhagyások betöltése folyamatban" value={100} />
      )}
      {failureMessage !== undefined && <p role="alert">{failureMessage}</p>}
      {shown !== undefined && (
        <>
          <Pagination
            page={shown.index + 1}
            pageCount={approvalCount}
            siblings={PAGINATION_SIBLINGS}
            onChange={onSelectPage}
            labels={APPROVAL_PAGINATION_LABELS}
          />
          {decisionActions}
        </>
      )}
    </section>
  );
}
