import { z } from 'zod';

/**
 * `GET /api/settings/concurrency-limits` egy sora, és a `PUT
 * .../concurrency-limits/{providerId}` válasza is (SPEC-005 4.2 E táblázat
 * 23. és 24. sora). A **beállított** korlát és a leíróból jövő **javaslat**
 * két, egyértelműen elkülönített mező: a mért javaslat sosem lép érvénybe,
 * amíg a felhasználó el nem menti, tehát a két szám a séma szintjén sem
 * keveredhet (SPEC-005 4.2 E táblázat).
 */
export const ConcurrencyLimitViewSchema = z
  .strictObject({
    providerId: z.string(),
    configuredMaxConcurrentSteps: z.number().int().positive().nullable(),
    suggestion: z
      .strictObject({
        suggestedLimit: z.number().int().positive().nullable(),
        note: z.string(),
      })
      .readonly(),
  })
  .readonly();

export type ConcurrencyLimitView = z.infer<typeof ConcurrencyLimitViewSchema>;

/**
 * `PUT /api/settings/concurrency-limits/{providerId}` kérés törzse
 * (SPEC-005 4.2 E táblázat 24. sora). A `packages/db`
 * `provider_concurrency_limit` tábla `CHECK (max_concurrent_steps > 0)`
 * constraintjét tükrözi a pozitív egész megkötés.
 */
export const SetConcurrencyLimitRequestSchema = z.strictObject({
  maxConcurrentSteps: z.number().int().positive(),
});

export type SetConcurrencyLimitRequest = z.infer<typeof SetConcurrencyLimitRequestSchema>;
