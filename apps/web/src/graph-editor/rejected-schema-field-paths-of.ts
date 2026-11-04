import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { readStructuredOutputSchema } from './read-structured-output-schema.ts';
import type { RejectedStructuredOutputSchema } from './rejected-structured-output-schema.ts';

/**
 * A csomópont azon mezőútjai, amiknek a sémáját a szerver a legutóbbi
 * mentéskor elutasította, és a séma azóta nem változott (hivatkozás szerint
 * ugyanaz az érték, SPEC-015 5.7). A beállítás panel ezek alatt jelez.
 */
export function rejectedSchemaFieldPathsOf(
  rejected: readonly RejectedStructuredOutputSchema[],
  node: WorkflowNodeInput,
): readonly string[] {
  return rejected
    .filter(
      (entry) => entry.nodeId === node.id && readStructuredOutputSchema(node.config, entry.fieldPath) === entry.schema,
    )
    .map((entry) => entry.fieldPath);
}
