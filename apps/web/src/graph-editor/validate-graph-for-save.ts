import type { Outcome } from '@easter-workflow-builder/core';
import {
  ReplaceGraphRequestSchema,
  zodErrorToProtocolErrorBody,
  type ReplaceGraphRequest,
  type WorkflowEdgeInput,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import { findBlankAgentDefinitionFields } from '../node-inspector/find-blank-agent-definition-fields.ts';

/**
 * A mentés előtti séma ellenőrzés (SPEC-008 5.5, T-009-17, AC12): a `PUT`
 * kérés **csak akkor indul**, ha ez a függvény `ok` értéket ad. Hibás alak
 * esetén a hívó a `message` mezőt írja ki - ez a `zodErrorToProtocolErrorBody`
 * jóvoltából a hibás node vagy él mező **útvonalát** nevezi meg
 * (`nodes.0.config.maxIterations` alakban), nem csak azt, hogy "hibás".
 *
 * A séma mellett az `agents` bejegyzések kötelező mezőinek űrlap oldali
 * szabálya is fut (SPEC-008 5.4, O-38; `findBlankAgentDefinitionFields`),
 * mert az nem a séma része: egy üres `description` vagy `prompt` is
 * megállítja a mentést, és az üzenet a séma hibái után az ő útvonalát is
 * megnevezi.
 */
export function validateGraphForSave(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): Outcome<ReplaceGraphRequest> {
  const parsed = ReplaceGraphRequestSchema.safeParse({ nodes, edges });
  const blankAgentFieldIssues = nodes.flatMap((node, index) =>
    findBlankAgentDefinitionFields(node.config).map((issue) => ({
      ...issue,
      path: ['nodes', index, 'config', ...issue.path],
    })),
  );
  if (!parsed.success || blankAgentFieldIssues.length > 0) {
    const schemaIssues = parsed.success ? [] : parsed.error.issues;
    return {
      kind: 'error',
      message: zodErrorToProtocolErrorBody({ issues: [...schemaIssues, ...blankAgentFieldIssues] }).message,
    };
  }
  return { kind: 'ok', value: parsed.data };
}
