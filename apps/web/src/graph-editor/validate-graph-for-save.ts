import type { Outcome } from '@easter-workflow-builder/core';
import {
  ReplaceGraphRequestSchema,
  zodErrorToProtocolErrorBody,
  type ReplaceGraphRequest,
  type WorkflowEdgeInput,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';
import { fieldErrorsFromZodError } from '../node-inspector/field-errors-from-zod-error.ts';
import { findBlankAgentDefinitionFields } from '../node-inspector/find-blank-agent-definition-fields.ts';
import { findLanguageFieldIssues } from '../node-inspector/find-language-field-issues.ts';

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
 *
 * Utoljára minden csomópont sablon és kifejezés mezője lefordul a
 * `workflow-language` csomaggal (SPEC-010 10., AC44): a fordítási hiba is
 * megállítja a mentést, és az üzenet a csomópont és a mező útvonalát
 * (`nodes.1.config.expression`) nevezi meg. A fordítás csak sémahelyes
 * mezőn fut, tehát a séma hibás mezőjét az üzenet egyszer nevezi meg.
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
  const schemaIssues = [...(parsed.success ? [] : parsed.error.issues), ...blankAgentFieldIssues];
  const languageIssues = nodes.flatMap((node, index) => {
    const nodeSchemaIssues = schemaIssues
      .filter((issue) => issue.path[0] === 'nodes' && issue.path[1] === index && issue.path[2] === 'config')
      .map((issue) => ({ ...issue, path: issue.path.slice(3) }));
    return findLanguageFieldIssues(node.config, fieldErrorsFromZodError({ issues: nodeSchemaIssues })).map((issue) => ({
      ...issue,
      path: ['nodes', index, 'config', ...issue.path],
    }));
  });
  if (!parsed.success || schemaIssues.length > 0 || languageIssues.length > 0) {
    return {
      kind: 'error',
      message: zodErrorToProtocolErrorBody({ issues: [...schemaIssues, ...languageIssues] }).message,
    };
  }
  return { kind: 'ok', value: parsed.data };
}
