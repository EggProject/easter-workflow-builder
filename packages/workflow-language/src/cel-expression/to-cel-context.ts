import { isInt, isRecord } from '@easter-workflow-builder/typeguards';
import { RUN_CONTEXT_VARIABLE_NAMES } from './run-context-variable-names.ts';

// A CEL `null` értéke. A `unicorn/no-null` a literált tiltja, ezért elemzés adja;
// a CEL-ben a `null` érték, az `undefined` nem (research 2. szekció (3)).
const CEL_NULL: unknown = JSON.parse('null');

// A két egész számláló, ami CEL `int` értékként érkezik (SPEC-010 7.3).
const INTEGER_COUNTER_NAMES: ReadonlySet<string> = new Set(['itemIndex', 'iteration']);

/**
 * A porton `unknown` típussal érkező kontextus leképezése a CEL felé (SPEC-010
 * 7.3), a hét deklarált névre egyenként: a felső szintű `undefined` (és a nem
 * objektum kontextus minden neve) `null`, az `itemIndex` és az `iteration` egész
 * értéke `BigInt`, minden más érték változatlan. A bemenetet nem módosítja.
 */
export function toCelContext(context: unknown): Record<string, unknown> {
  const source: Readonly<Record<string, unknown>> = isRecord(context) ? context : {};
  const celContext: Record<string, unknown> = {};
  for (const name of RUN_CONTEXT_VARIABLE_NAMES) {
    const value = source[name];
    if (value === undefined) {
      celContext[name] = CEL_NULL;
    } else if (INTEGER_COUNTER_NAMES.has(name) && isInt(value)) {
      celContext[name] = BigInt(value);
    } else {
      celContext[name] = value;
    }
  }
  return celContext;
}
