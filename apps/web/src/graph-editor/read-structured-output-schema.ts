import type { NodeConfig } from '@easter-workflow-builder/protocol';
import type { RejectedStructuredOutputSchema } from './rejected-structured-output-schema.ts';

/**
 * A csomópont strukturált kimenet sémájának értéke a megadott mezőúton: az
 * `agent_step` saját `structuredOutput` mezője, illetve a `join`
 * `ai_synthesis` módjának `settings` alobjektuma. Ha a mezőút a csomópont
 * típusán nem áll, vagy nincs strukturált kimenet, `undefined`.
 */
export function readStructuredOutputSchema(
  config: NodeConfig,
  fieldPath: RejectedStructuredOutputSchema['fieldPath'],
): unknown {
  if (fieldPath === 'structuredOutput.schema') {
    return config.type === 'agent_step' ? config.structuredOutput?.schema : undefined;
  }
  return config.type === 'join' && config.mode === 'ai_synthesis'
    ? config.settings.structuredOutput?.schema
    : undefined;
}
