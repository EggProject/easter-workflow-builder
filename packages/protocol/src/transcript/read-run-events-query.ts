import { z } from 'zod';

/**
 * `GET /api/runs/{runId}/events` query stringje (SPEC-005 4.2 B táblázat
 * 14. sora, 17. kritérium). A kliens vagy a futás egészét kéri, `afterEventId`
 * kurzorral, vagy egyetlen lépés eseményeit, `stepRunId` szűréssel - a kettő
 * együtt nem küldhető. Mindkét ág `z.strictObject`, tehát a másik ág
 * kulcsát is elutasítja: a `stepRunId` és az `afterEventId` együttes
 * küldése egyik ágra sem illeszkedik, ezért a teljes unió `invalid_request`
 * hibát ad, nem a szerver dönt el egy "melyik mező van kitöltve" elágazást
 * (SPEC-005 4.2 B táblázat, "A 14. végpont két alakja egy sémaunió").
 */
const ReadEventsSinceQuerySchema = z.strictObject({
  limit: z.number().int().positive(),
  afterEventId: z.number().int().nonnegative(),
});

const ReadEventsForStepQuerySchema = z.strictObject({
  limit: z.number().int().positive(),
  stepRunId: z.string(),
});

export const ReadRunEventsQuerySchema = z.union([ReadEventsSinceQuerySchema, ReadEventsForStepQuerySchema]);

export type ReadRunEventsQuery = z.infer<typeof ReadRunEventsQuerySchema>;
