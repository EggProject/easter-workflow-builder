import type { StepRunRecord, StepRunStatus } from '@easter-workflow-builder/protocol';
import { collectStepRunScope } from './collect-step-run-scope.ts';

/**
 * Az állapotok erőssége egy iteráció összesítésében (kisebb szám erősebb).
 * A `Record` kimerítő, tehát egy kilencedik állapot fordítási hibát ad.
 *
 * A sorrend user döntés (2026-10-17, "A legrosszabb", SPEC-008 6.3): elöl a
 * bukás, utána a többi nem sikeres lezárás (elutasítva, félbeszakítva,
 * megszakítva), utána a még tartó állapotok (jóváhagyásra vár, fut,
 * várakozik), végül a sikeres. Így az iteráció csak akkor sikeres, ha minden
 * lépése az, és amíg egy lépése tart, nem látszik lezártnak.
 */
const ITERATION_STATUS_STRENGTH: Readonly<Record<StepRunStatus, number>> = {
  failed: 0,
  rejected: 1,
  interrupted: 2,
  cancelled: 3,
  waiting_approval: 4,
  running: 5,
  pending: 6,
  succeeded: 7,
};

/**
 * Egy `loop` iteráció jelvényének állapota az iteráció lépéseiből (user
 * döntés 2026-10-17, "Az iteráció lépései alapján", SPEC-008 6.3), nem a
 * `loop` feltételének kiértékeléséből: az iteráció lépés futása és minden
 * leszármazottja közül a legerősebb állapot (`ITERATION_STATUS_STRENGTH`).
 *
 * A halmaz ugyanaz, amire a tétel kiválasztása a transcriptet szűkíti
 * (`resolve-branch-iteration-scope.ts`), tehát a jelvény azoknak a lépéseknek
 * az állapota, amiknek az eseményei a tétel alatt látszanak. A kiértékelés
 * saját állapota csak akkor dönt, ha az iterációnak nincs lépése: a
 * kiértékelés alatt (`running`), a ciklusból kilépő kiértékelésnél, és a
 * `maxIterations` miatt elbukó kiértékelésnél (SPEC-004 4.6); lépéssel
 * rendelkező iterációnál a lépések a kiértékelés `succeeded` állapotánál
 * mindig legalább olyan erősek.
 */
export function resolveLoopIterationStatus(
  iterationStepRun: StepRunRecord,
  stepRuns: readonly StepRunRecord[],
): StepRunStatus {
  const scope = collectStepRunScope([iterationStepRun.id], stepRuns);
  let strongest = iterationStepRun.status;
  for (const stepRun of stepRuns) {
    if (scope.has(stepRun.id) && ITERATION_STATUS_STRENGTH[stepRun.status] < ITERATION_STATUS_STRENGTH[strongest]) {
      strongest = stepRun.status;
    }
  }
  return strongest;
}
