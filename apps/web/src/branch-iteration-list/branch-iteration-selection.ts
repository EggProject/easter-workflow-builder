import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { BranchIterationListKind } from './branch-iteration-list-kind.ts';

/**
 * A futás nézet tételes listájának kiválasztása (SPEC-008 6.3, O-39, user
 * döntés 2026-10-17): melyik csomópont listája nyílt ki, és a listából
 * melyik tétel szűkíti a transcriptet. `stepRunId: undefined` esetén a
 * transcript a csomópont minden tételének eseményeit mutatja.
 *
 * A csomópont és a lista fajtája a kattintáskor kerül ide, nem azonosító
 * szerinti visszakereséssel a rajzolásnál: a kattintás a vászon saját
 * csomópontjából jön, tehát a visszakeresés "nincs ilyen csomópont" ága
 * sosem futna (`.claude/CLAUDE.md` 5. szekció, halott ág tilalma).
 */
export interface BranchIterationSelection {
  readonly node: WorkflowNodeInput;
  readonly kind: BranchIterationListKind;
  readonly stepRunId: string | undefined;
}
