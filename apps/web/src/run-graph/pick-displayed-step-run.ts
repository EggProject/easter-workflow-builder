import type { StepRunRecord } from '@easter-workflow-builder/protocol';

/**
 * Egy csomóponthoz párosított lépés futások közül az, aminek az állapota a
 * kártyán megjelenik (SPEC-008 6.2: "a csomópont állapota | a hozzá tartozó
 * `StepRunRecord.status`").
 *
 * **A választás szabálya: a LEGKÉSŐBB létrejött sor.** Egy csomóponthoz több
 * sor is tartozhat (a `fan_out` ágai, a `loop` iterációi, az `error_handler`
 * újrapróbálkozásai), és a felhasználót az érdekli, hol tart a futás MOST,
 * nem az, mi történt az első iterációban. Holtverseny esetén (azonos
 * `createdAtMs`) a bemeneti lista későbbi eleme győz, mert a repository a
 * beszúrási sorrendben adja vissza a sorokat, tehát az a frissebb.
 */
export function pickDisplayedStepRun(stepRuns: readonly StepRunRecord[]): StepRunRecord | undefined {
  let displayed: StepRunRecord | undefined;
  for (const stepRun of stepRuns) {
    if (displayed === undefined || stepRun.createdAtMs >= displayed.createdAtMs) {
      displayed = stepRun;
    }
  }
  return displayed;
}
