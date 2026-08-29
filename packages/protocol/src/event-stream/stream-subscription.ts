import { z } from 'zod';

/**
 * Egy futásra vonatkozó feliratkozás bejegyzés (SPEC-005 5.2 és 5.3
 * szekció). A `fromEventId` a feliratkozás **padlója** (5.3: "a szerver
 * futásonként megjegyzi azt a fromEventId padlót, amivel a feliratkozás
 * indult"), a `replayLimit` a pótlás lapmérete, a kérés **kötelező** mezője,
 * alapérték nélkül (F-19, 24. kritérium).
 */
export const RunSubscriptionEntrySchema = z.strictObject({
  runId: z.string(),
  fromEventId: z.number().int().nonnegative(),
  replayLimit: z.number().int().positive(),
});

export type RunSubscriptionEntry = z.infer<typeof RunSubscriptionEntrySchema>;

/**
 * `PUT /api/streams/{streamId}/subscriptions` kérés törzse (SPEC-005 4.2 F
 * táblázat 26. sora). A `runs` **lista**, és a `PUT` **teljes cserét**
 * jelent, nem hozzáadást (20. kritérium): a kérés a feliratkozás teljes,
 * kívánt állapotát írja le.
 */
export const SubscriptionRequestSchema = z.strictObject({
  runs: z.array(RunSubscriptionEntrySchema),
});

export type SubscriptionRequest = z.infer<typeof SubscriptionRequestSchema>;

/**
 * A `PUT` válasza, és a `stream_ready` keret `subscriptions` mezője is ezt
 * az alakot hordozza (SPEC-005 5.2 szekció 2. pont).
 */
export const SubscriptionStateSchema = z
  .strictObject({
    streamId: z.string(),
    subscriptions: z.array(RunSubscriptionEntrySchema.readonly()).readonly(),
  })
  .readonly();

export type SubscriptionState = z.infer<typeof SubscriptionStateSchema>;
