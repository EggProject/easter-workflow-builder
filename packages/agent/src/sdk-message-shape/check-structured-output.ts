import type { Outcome } from '@easter-workflow-builder/core';
import { describeStructuredOutputMismatch } from './describe-structured-output-mismatch.ts';
import type { StructuredOutputValidator } from './structured-output-validator.ts';

/**
 * A `result` üzenet `structured_output` értékének ellenőrzése a lefordított
 * sémára (SPEC-015 5.1, draft-07). Illeszkedésnél `ok`, eltérésnél a hibaág
 * üzenete az első hiba útvonalát és kulcsszavát nevezi meg.
 */
export function checkStructuredOutput(validator: StructuredOutputValidator, output: unknown): Outcome<void> {
  if (validator(output)) {
    return { kind: 'ok', value: undefined };
  }
  return { kind: 'error', message: describeStructuredOutputMismatch(validator.errors) };
}
