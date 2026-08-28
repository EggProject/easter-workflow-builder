import type { SdkResultSubtype } from '@easter-workflow-builder/agent';
import type { StepRunTokenUsage } from '@easter-workflow-builder/db';
import type { AgentStepOutcome } from './agent-step-outcome.ts';

/**
 * Egy lefuttatott agent lépés teljes eredménye: az üzleti kimenetel és a
 * `step_run` sor záró tranzakciójába írandó számadatok (SPEC-004 5.2 8. és
 * 9. pont).
 *
 * A három számadat mező **mindkét kimenetelnél** kitöltött lehet: a lépés
 * hibás `subtype` mellett is elhasznált tokent, és a négy token oszlop a
 * terminális átmenettel azonos tranzakcióban íródik, függetlenül attól, hogy
 * az `markStepSucceeded` vagy `markStepFailed` (SPEC-003 4.10). Mindhárom
 * `undefined`, ha a folyam `result` üzenet nélkül ért véget, vagy ha a hiba
 * még a futtatás megkezdése előtt keletkezett.
 *
 * A `resultSubtype` a `step_run.result_subtype` oszlop forrása, és a hibás
 * ág üzenetében is szerepel (`agent_result_not_success`).
 */
export interface AgentStepExecution {
  readonly outcome: AgentStepOutcome;
  readonly resultSubtype: SdkResultSubtype | undefined;
  readonly numTurns: number | undefined;
  readonly tokens: StepRunTokenUsage | undefined;
}
