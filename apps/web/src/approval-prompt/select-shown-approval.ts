import type { DisplayedApproval } from './select-displayed-approvals.ts';

export interface ShownApproval extends DisplayedApproval {
  /**
   * A látott jóváhagyás helye a megjelenített listában, 0-tól számozva: a
   * lapozó "k / n" alakjának `k - 1` értéke.
   */
  readonly index: number;
}

/**
 * Melyik jóváhagyás látszik a panelen (user döntés 2026-09-25: "egyszerre
 * egy", SPEC-008 8. szekció 1. pont). A kiválasztás a jóváhagyás
 * AZONOSÍTÓJA, nem a helye: ha a lista élő frissítéskor bővül vagy szűkül, a
 * látott jóváhagyás nem cserélődik ki a user alatt, csak a "k" szám követi
 * az új helyét.
 *
 * - Ha a kiválasztott azonosító a listában van, az látszik.
 * - Különben (nincs még kiválasztás, vagy a kiválasztott jóváhagyás döntés
 *   nélkül lezárult és kikerült) a lista ELSŐ eleme, azaz a legrégebbi
 *   kérés: a lista a kérés időpontja szerint rendezett
 *   (`select-displayed-approvals.ts`).
 * - Üres listára `undefined`.
 */
export function selectShownApproval(
  displayed: readonly DisplayedApproval[],
  selectedApprovalId: string | undefined,
): ShownApproval | undefined {
  const index = Math.max(
    0,
    displayed.findIndex((item) => item.approval.id === selectedApprovalId),
  );
  const item = displayed[index];
  return item === undefined ? undefined : { ...item, index };
}
