import type { StepRunRecord } from '@easter-workflow-builder/protocol';

function addWithDescendants(
  stepRunId: string,
  childIdsByParentId: ReadonlyMap<string, readonly string[]>,
  scope: Set<string>,
): void {
  scope.add(stepRunId);
  const childIds = childIdsByParentId.get(stepRunId) ?? [];
  for (const childId of childIds) {
    addWithDescendants(childId, childIdsByParentId, scope);
  }
}

/**
 * A megadott lépés futások és MINDEN leszármazottjuk azonosítója, a
 * `parent_step_run_id` láncon lefelé (SPEC-008 6.3, O-39).
 *
 * **Miért a lánc, és miért elég.** A motor a `step_run.parent_step_run_id`
 * oszlopba a hatókör verem tetején álló bejegyzés lépés futását írja
 * (SPEC-004 4.3 táblázat, `packages/engine/src/run-supervisor/advance-run.ts`
 * `parentStepRunIdOf`): a `fan_out` ágaiban futó lépések szülője a `fan_out`
 * lépés futása, a `loop` törzsében futóké az adott iteráció `loop` lépés
 * futása (SPEC-004 4.6, "Iterációnként új példány a törzsben"). Egy
 * beágyazott hatókör (például egy ágban futó ciklus) lépései a belső
 * hatókört nyitó lépés futásra mutatnak, ezért a lánc bejárása a beágyazott
 * szinteket is összegyűjti. A `join` és a ciklusból kilépő ág a hatókört
 * leveszi a veremről, tehát a lépés futásuk már nem tartozik ide.
 *
 * A lánc körmentes, mert a szülő lépés futás mindig a gyereke előtt jön
 * létre, ezért a bejárásnak nincs "már láttam" ága.
 */
export function collectStepRunScope(
  rootStepRunIds: readonly string[],
  stepRuns: readonly StepRunRecord[],
): ReadonlySet<string> {
  const childIdsByParentId = new Map<string, string[]>();
  for (const stepRun of stepRuns) {
    if (stepRun.parentStepRunId === null) {
      continue;
    }
    const siblings = childIdsByParentId.get(stepRun.parentStepRunId);
    if (siblings === undefined) {
      childIdsByParentId.set(stepRun.parentStepRunId, [stepRun.id]);
    } else {
      siblings.push(stepRun.id);
    }
  }

  const scope = new Set<string>();
  for (const rootStepRunId of rootStepRunIds) {
    addWithDescendants(rootStepRunId, childIdsByParentId, scope);
  }
  return scope;
}
