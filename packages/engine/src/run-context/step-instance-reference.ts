import type { BranchContext } from '../branch-scope/branch-scope.ts';

/**
 * Egy node **példány** azonosítója: a `(nodeId, branchContext)` pár
 * (SPEC-004 4.3). Ugyanaz a node sokszor futhat (fan-out ágban ágonként,
 * ciklusban iterációnként, retrynél kísérletenként, SPEC-003 4.10), és a
 * példányokat kizárólag ez a pár különbözteti meg.
 *
 * A téma ezt a párt kétféle szerepben használja: a **jelenlegi** példányként,
 * aminek a kontextusát összeállítjuk, és a **lefutott** példányok azonosítójaként
 * (`ExecutedStepInstance`), amik közül a `steps` rekord értékei kikerülnek.
 */
export interface StepInstanceReference {
  readonly nodeId: string;
  readonly branchContext: BranchContext;
}
