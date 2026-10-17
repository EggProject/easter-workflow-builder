import type { BranchIterationSelection } from './branch-iteration-selection.ts';

/**
 * Egy tétel gombjának megnyomása (user döntés 2026-10-17, SPEC-008 6.3): a
 * nem kiválasztott tétel kiválasztódik, és a transcript csak az ő eseményeit
 * mutatja; a már kiválasztott tétel ismételt megnyomása visszaállítja a
 * csomópont minden tételére szűkített nézetet. A gomb lenyomott állapota
 * (`aria-pressed`) ugyanezt mondja ki.
 */
export function toggleBranchIterationItem(
  selection: BranchIterationSelection,
  stepRunId: string,
): BranchIterationSelection {
  return { ...selection, stepRunId: selection.stepRunId === stepRunId ? undefined : stepRunId };
}
