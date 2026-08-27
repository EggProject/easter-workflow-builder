import type { Outcome } from '@easter-workflow-builder/result';
import type { EnvironmentReader } from './environment-reader.ts';

/**
 * Egy ezredmásodperc értékű környezeti változó beolvasása. Hiányzó vagy üres
 * változó esetén a megadott alapértelmezés érvényes; értelmezhetetlen érték
 * esetén hibaág, mert egy elgépelt timeout csendben nem cserélhető le az
 * alapértelmezésre.
 */
export function readTimeoutMs(
  environment: EnvironmentReader,
  variableName: string,
  fallbackMs: number,
): Outcome<number> {
  const rawValue = environment[variableName];
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return { kind: 'ok', value: fallbackMs };
  }
  const parsedValue = Number(rawValue.trim());
  if (!Number.isSafeInteger(parsedValue) || parsedValue <= 0) {
    return {
      kind: 'error',
      message: `A(z) ${variableName} környezeti változó értéke csak pozitív egész ezredmásodperc lehet, most viszont "${rawValue}".`,
    };
  }
  return { kind: 'ok', value: parsedValue };
}
