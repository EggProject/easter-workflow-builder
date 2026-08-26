/**
 * Ismeretlen típusú hibaobjektum egymondatos leírása. `unknown` a bemenet, mert
 * a `catch` blokk típusa az, és `as` kényszerítés tilos.
 */
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : 'ismeretlen hiba';
}
