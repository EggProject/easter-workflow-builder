import type { Outcome } from '@easter-workflow-builder/core';
import {
  ReplaceGraphRequestSchema,
  zodErrorToProtocolErrorBody,
  type ReplaceGraphRequest,
  type WorkflowEdgeInput,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';

/**
 * A mentés előtti séma ellenőrzés (SPEC-008 5.5, T-009-17, AC12): a `PUT`
 * kérés **csak akkor indul**, ha ez a függvény `ok` értéket ad. Hibás alak
 * esetén a hívó a `message` mezőt írja ki - ez a `zodErrorToProtocolErrorBody`
 * jóvoltából a hibás node vagy él mező **útvonalát** nevezi meg
 * (`nodes.0.config.maxIterations` alakban), nem csak azt, hogy "hibás".
 */
export function validateGraphForSave(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): Outcome<ReplaceGraphRequest> {
  const parsed = ReplaceGraphRequestSchema.safeParse({ nodes, edges });
  if (!parsed.success) {
    return { kind: 'error', message: zodErrorToProtocolErrorBody(parsed.error).message };
  }
  return { kind: 'ok', value: parsed.data };
}
