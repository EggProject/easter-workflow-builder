import type { StepInstanceReference } from './step-instance-reference.ts';

/**
 * Egy **lefutott** node példány a futás nyilvántartásában: a példány
 * azonosítója (SPEC-004 4.3) és a kimenete.
 *
 * **A nyilvántartás vezetése nem ennek a témának a dolga.** A listát a
 * `scheduling` téma (PLAN-005 T-005-17) tartja karban, ahogy a lépések zárnak;
 * itt a lista kizárólag **bemenet**, amin tiszta függvények dolgoznak. Ezért
 * nincs a sorban sem állapot, sem időbélyeg, sem `stepRunId`: a SPEC-004 6.2
 * feloldásához pontosan ez a három adat elég.
 *
 * **A lista sorrendje jelentést hordoz**: a későbbi elem a frissebb lefutás.
 * Erre épül a `findVisibleStepInstance` döntetlen szabálya, amikor ugyanannak a
 * példánynak több lefutása van (retry: minden kísérlet külön `step_run` sor,
 * változatlan ág kontextusban, SPEC-003 4.10).
 */
export interface ExecutedStepInstance extends StepInstanceReference {
  readonly output: unknown;
}
