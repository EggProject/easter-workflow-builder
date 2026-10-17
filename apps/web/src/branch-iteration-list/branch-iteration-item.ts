import type { StepRunStatus } from '@easter-workflow-builder/protocol';

/**
 * A tételes lista egy sora (SPEC-008 6.3, O-39): egy lépés futás, a
 * felirata és az állapota. A felirat a sorszámmal kezdődik, így két azonos
 * nevű lépés (egy `fan_out` több ágában futó ugyanaz a csomópont) gombjának
 * hozzáférhető neve is különbözik.
 */
export interface BranchIterationItem {
  readonly stepRunId: string;
  readonly label: string;
  readonly status: StepRunStatus;
}
