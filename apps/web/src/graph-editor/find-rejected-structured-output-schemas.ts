import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { isStructuredOutputSchemaFieldPath } from './is-structured-output-schema-field-path.ts';
import { readStructuredOutputSchema } from './read-structured-output-schema.ts';
import type { RejectedStructuredOutputSchema } from './rejected-structured-output-schema.ts';

/**
 * A szerver `invalid_request` mezőútjai közül a strukturált kimenet sémájáé
 * (`nodes.<index>.config.structuredOutput.schema`, a `join` alobjektumán
 * `nodes.<index>.config.settings.structuredOutput.schema`, SPEC-015 5.7).
 */
const SCHEMA_FIELD_PATH_PATTERN =
  /^nodes\.(?<index>\d+)\.config\.(?<fieldPath>(?:settings\.)?structuredOutput\.schema)$/u;

/**
 * A mentés szerver oldali elutasításából a strukturált kimenet sémájának
 * hibái, a mentett csomópont listához kötve (a mezőút indexe a `PUT` törzs
 * csomópont sorrendje, ami a `nodes` sorrendje). Minden más mezőút kimarad:
 * azokat a kliens mentés előtti ellenőrzése már a mező alatt jelzi.
 */
export function findRejectedStructuredOutputSchemas(
  fieldPaths: readonly string[],
  nodes: readonly WorkflowNodeInput[],
): readonly RejectedStructuredOutputSchema[] {
  return fieldPaths.flatMap((path): readonly RejectedStructuredOutputSchema[] => {
    const groups = SCHEMA_FIELD_PATH_PATTERN.exec(path)?.groups;
    const node = nodes[Number(groups?.['index'])];
    const fieldPath = groups?.['fieldPath'];
    if (node === undefined || !isStructuredOutputSchemaFieldPath(fieldPath)) {
      return [];
    }
    return [{ nodeId: node.id, fieldPath, schema: readStructuredOutputSchema(node.config, fieldPath) }];
  });
}
