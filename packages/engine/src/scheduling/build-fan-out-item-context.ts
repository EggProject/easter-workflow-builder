import type { BranchContext, BranchScope } from '../branch-scope/branch-scope.ts';

/**
 * A `fan_out` kibontás `itemIndex`-edik ágának ág kontextusa
 * (SPEC-004 4.5): "Minden `i` elemhez a kimenő élek `live` jelölést kapnak a
 * `[...ctx, { kind:'fan_out', stepRunId, itemIndex: i }]` kontextusban."
 *
 * Három helyen kell ugyanez a verem, ezért áll külön: a `fan_out` kibontáskor
 * a jelölések kiírásához, a `join` futtathatóságának eldöntésekor és a `join`
 * bemeneteinek összegyűjtésekor. A `join` az utóbbi kettőben a **saját**,
 * külső kontextusát adja `outerContext` értéknek, mert pontosan azt a hatókört
 * veszi le a veremről.
 */
export function buildFanOutItemContext(
  outerContext: BranchContext,
  stepRunId: string,
  itemIndex: number,
): BranchContext {
  const scope: BranchScope = { kind: 'fan_out', stepRunId, itemIndex };
  return [...outerContext, scope];
}
