import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * Ancestry alapú al-workflow ciklusfelismerés (SPEC-004 5.9 1. pont, F-20):
 * ha a hívni kívánt `targetWorkflowId` már szerepel a szülő futás
 * `workflow_ancestry` listájában (SPEC-003 4.8), a hívás kört zárna, tehát a
 * lépés `workflow_recursion_detected` osztállyal `failed` állapotban zár.
 *
 * **Nincs mélységi küszöb**, mert arra sem mérésünk, sem dokumentált
 * szabályunk nincs (`.claude/CLAUDE.md` 4. szekció). Az ancestry lista
 * viszont pontosan azt az információt hordozza, ami a kör felismeréséhez
 * kell, tetszőleges mélységben: két szintű (A -> B -> A) és három szintű
 * (A -> B -> C -> A) kört is ugyanaz az egyetlen `includes` vizsgálat fog el,
 * mert a lista a gyökértől a jelenlegi futásig minden workflow azonosítót
 * tartalmaz, sorrendben.
 *
 * **Tiszta függvény, adatbázis nélkül**: a `workflowAncestry` a hívó által
 * már betöltött szülő `WorkflowRunRecord` mezője. Ezért tesztelhető önmagában,
 * és ezért áll külön fájlban az `execute-sub-workflow.ts`-től.
 *
 * A sikeres ág `Outcome<void>`, nem `boolean`: a hibaüzenet a teljes ős
 * láncot megnevezi, és ezt egyetlen helyen érdemes megfogalmazni, hogy a
 * végrehajtó csak továbbadja.
 */
export function detectWorkflowRecursion(workflowAncestry: readonly string[], targetWorkflowId: string): Outcome<void> {
  if (!workflowAncestry.includes(targetWorkflowId)) {
    return { kind: 'ok', value: undefined };
  }

  const chain = [...workflowAncestry, targetWorkflowId].join(' -> ');
  return {
    kind: 'error',
    message: formatEngineErrorMessage(
      'workflow_recursion_detected',
      `A(z) "${targetWorkflowId}" workflow már szerepel a futás ős láncában, az al-workflow hívás kört zárna: ${chain}`,
    ),
  };
}
