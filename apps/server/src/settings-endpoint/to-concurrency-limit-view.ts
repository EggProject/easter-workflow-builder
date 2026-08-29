import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import type { Engine } from '@easter-workflow-builder/engine';
import type { ConcurrencyLimitView } from '@easter-workflow-builder/protocol';

/**
 * A `ConcurrencyLimitView` felépítése a beállított korlátból és a motor
 * mérésből jövő javaslatából (SPEC-005 4.2 E táblázat 23. sora). A kettő
 * soha nem keveredik: a `configuredMaxConcurrentSteps` a ténylegesen
 * beállított érték, a `suggestion` csak megjelenítendő ajánlás, ami nem lép
 * érvénybe, amíg a felhasználó el nem menti (SPEC-004 7.3). Két kezelő
 * használja (`list-concurrency-limits.ts`, `set-concurrency-limit.ts`),
 * ezért saját fájlt kapott.
 */
export function toConcurrencyLimitView(
  providerId: ProviderId,
  configuredMaxConcurrentSteps: number | null,
  engine: Engine,
): ConcurrencyLimitView {
  const suggestion = engine.suggestedConcurrencyLimit(providerId);
  return {
    providerId,
    configuredMaxConcurrentSteps,
    suggestion: {
      // eslint-disable-next-line unicorn/no-null -- a ConcurrencySuggestion.suggestedLimit undefined, a drótszintű ConcurrencyLimitView.suggestion.suggestedLimit viszont null
      suggestedLimit: suggestion.suggestedLimit ?? null,
      note: suggestion.note,
    },
  };
}
