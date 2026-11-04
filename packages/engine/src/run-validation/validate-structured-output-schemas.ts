import { compileStructuredOutputSchema } from '@easter-workflow-builder/agent';
import type { Outcome } from '@easter-workflow-builder/core';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import { agentStepConfigOf } from './agent-step-config-of.ts';
import type { ExecutableNodeConfig } from './executable-node-config.ts';

/**
 * A futás indítási ellenőrzése a strukturált kimenetet váró lépések sémájára
 * (SPEC-015 5.4): minden `agent_step` és `join` `ai_synthesis` alobjektum
 * sémája lefordul az agent csomag fordítójával (az Ajv a meta-sémára is
 * ellenőriz, a draft-07-nél újabb `$schema` érvénytelen), különben
 * `invalid_structured_output_schema` hiba a csomópont nevével. Ugyanez a
 * fordító dönt a gráf mentésekor is (5.7).
 *
 * Indok: az SDK az érvénytelen sémát a lépés elején utasítaná el (K-3), a
 * futás többi lépése addigra már lefutott volna. A SPEC-004 4.8 3. lépésében
 * fut, a `validateRun` után, tehát egyetlen adatbázis sort sem ír; az első
 * hibánál megáll.
 */
export function validateStructuredOutputSchemas(configsById: ReadonlyMap<string, ExecutableNodeConfig>): Outcome<void> {
  for (const [nodeId, config] of configsById) {
    const structuredOutput = agentStepConfigOf(config)?.structuredOutput;
    if (structuredOutput === undefined || structuredOutput === null) {
      continue;
    }
    const compiled = compileStructuredOutputSchema(structuredOutput.schema);
    if (compiled.kind === 'error') {
      return {
        kind: 'error',
        message: formatEngineErrorMessage(
          'invalid_structured_output_schema',
          `A(z) ${nodeId} csomópont strukturált kimenet sémája nem fordítható: ${compiled.message}`,
        ),
      };
    }
  }
  return { kind: 'ok', value: undefined };
}
