import { useState } from 'react';
import type { DisplayedApproval } from './select-displayed-approvals.ts';
import { selectShownApproval, type ShownApproval } from './select-shown-approval.ts';

export interface ApprovalSelection {
  /**
   * A látott jóváhagyás, `undefined`, ha nincs megjelenített jóváhagyás.
   */
  readonly shown: ShownApproval | undefined;
  /**
   * A lapozó 1-től számozott oldala szerinti jóváhagyást választja; egy
   * tartományon kívüli oldalra a legrégebbi látszik.
   */
  readonly selectPage: (page: number) => void;
}

/**
 * A jóváhagyás panel kiválasztása (SPEC-008 8. szekció 1. pont, user döntés
 * 2026-09-25: "egyszerre egy"). A szabály a `select-shown-approval.ts`
 * tiszta függvényében áll.
 *
 * **A látott jóváhagyás rögzül.** Amíg a user nem lapozott, a legrégebbi
 * látszik; ennek az azonosítója is azonnal a kiválasztásba íródik, hogy egy
 * később listázott, de korábbi időpontú jóváhagyás (a `GET /api/approvals`
 * két, egymáshoz közeli kérés közül a későbbit adhatja előbb) ne vegye át a
 * helyét a user alatt. Az átírás a render közben, feltételhez kötve történik,
 * a React dokumentált mintája szerint
 * (<https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes>,
 * <https://react.dev/reference/react/useState#storing-information-from-previous-renders>):
 * a második renderen a feltétel már hamis.
 *
 * **Miért a képernyő szintjén fut, nem a panelben.** Ugyanazért, amiért a
 * döntések állapota (`use-approval-decisions.ts`): a transcript sáv a
 * `--ep-screen-md` határon leszereli és újra felcsatolja a panelt. Egy
 * másik futásra váltáskor külön törlés nem kell: a jóváhagyás azonosítók
 * futásonként egyediek, tehát a régi kiválasztás az új listában nem
 * szerepel, és a legrégebbi látszik.
 */
export function useApprovalSelection(displayed: readonly DisplayedApproval[]): ApprovalSelection {
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | undefined>(undefined);
  const shown = selectShownApproval(displayed, selectedApprovalId);
  const shownApprovalId = shown?.approval.id;
  if (shownApprovalId !== selectedApprovalId) {
    setSelectedApprovalId(shownApprovalId);
  }

  return {
    shown,
    selectPage: (page) => {
      setSelectedApprovalId(displayed[page - 1]?.approval.id);
    },
  };
}
