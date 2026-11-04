import type { RejectedStructuredOutputSchema } from './rejected-structured-output-schema.ts';

/**
 * A strukturált kimenet sémájának két `config`-on belüli mezőútja egyike-e a
 * bemenet (`agent_step`, illetve a `join` `ai_synthesis` alobjektuma).
 */
export function isStructuredOutputSchemaFieldPath(
  value: unknown,
): value is RejectedStructuredOutputSchema['fieldPath'] {
  return value === 'structuredOutput.schema' || value === 'settings.structuredOutput.schema';
}
