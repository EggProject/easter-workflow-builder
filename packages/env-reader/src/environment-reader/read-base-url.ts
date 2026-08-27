import type { EnvironmentReader } from './environment-reader.ts';

/**
 * Alapcím beolvasása környezeti változóból, záró perjelek levágásával. Hiányzó
 * vagy üres változó esetén a megadott alapértelmezés érvényes.
 */
export function readBaseUrl(environment: EnvironmentReader, variableName: string, fallbackUrl: string): string {
  const rawValue = environment[variableName];
  if (rawValue === undefined || rawValue.trim().length === 0) {
    return fallbackUrl;
  }
  let normalized = rawValue.trim();
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
