import { z } from 'zod';
import { ProtocolErrorCodeSchema } from '../protocol-error/protocol-error-code.ts';
import { RunEventKindSchema } from '../transcript/run-event-kind.ts';
import { RunEventRecordSchema } from '../transcript/run-event-record.ts';
import { RunSubscriptionEntrySchema } from './stream-subscription.ts';

/**
 * Első keret a kapcsolat felépülésekor (SPEC-005 5.2 2. pont, 5.4 táblázat
 * `stream_ready` sora). Nincs `id:` sora (5.4). A `subscriptions` ugyanazt az
 * alakot hordozza, mint a `SubscriptionState.subscriptions` mezője
 * (`stream-subscription.ts`), a padlóval (`fromEventId`) együtt.
 */
export const StreamReadyFrameSchema = z
  .strictObject({
    event: z.literal('stream_ready'),
    streamId: z.string(),
    serverInstanceId: z.string(),
    subscriptions: z.array(RunSubscriptionEntrySchema.readonly()).readonly(),
  })
  .readonly();

/**
 * Perzisztált `run_event` sor, pótolva vagy élőben (SPEC-005 5.4 táblázat
 * `run_event` sora). **Ez az egyetlen keret, ami kódoláskor `id:` sort kap**
 * (SPEC-005 5.3, 22. kritérium): az érték a beágyazott `runEvent.id`
 * decimális alakja, nem külön mező a kereten, ezért az `encodeStreamFrame`
 * a `runEvent.id` mezőből olvassa ki (`encode-stream-frame.ts`).
 */
export const RunEventFrameSchema = z
  .strictObject({
    event: z.literal('run_event'),
    delivery: z.enum(['replayed', 'live']),
    runEvent: RunEventRecordSchema,
  })
  .readonly();

/**
 * Élő üzenet, aminek nincs perzisztált sora (SPEC-005 5.4 táblázat
 * `run_event_transient` sora, 6. szekció). Nincs `id:` sora, mert nincs
 * mögötte visszalapozható sor (5.4, 29. kritérium), és nincs `delivery`
 * mezője, mert definíció szerint mindig élő (6.3). A `kind` a teljes
 * `RunEventKindSchema` felsorolást fogadja: a 6.1 táblázat szerint ma
 * kizárólag a kikapcsolt delta kapcsolójú `sdk_stream_event` jár ezen az
 * úton, de az 5.4 táblázat ezt nem szűkíti le a sémaszinten, ezért a mező
 * nem kap ennél szűkebb, ki nem mondott megkötést.
 */
export const RunEventTransientFrameSchema = z
  .strictObject({
    event: z.literal('run_event_transient'),
    runId: z.string(),
    stepRunId: z.string().nullable(),
    kind: RunEventKindSchema,
    occurredAtMs: z.number(),
    payload: z.unknown(),
  })
  .readonly();

/**
 * Egy futás pótlása véget ért, innen élő adat jön (SPEC-005 5.4 táblázat
 * `replay_complete` sora, 5.6 4. pont). Nincs `id:` sora. A
 * `throughEventId` `null`, ha nem volt mit pótolni (28. kritérium).
 */
export const ReplayCompleteFrameSchema = z
  .strictObject({
    event: z.literal('replay_complete'),
    runId: z.string(),
    throughEventId: z.number().int().positive().nullable(),
  })
  .readonly();

/**
 * A stream szintjén történt hiba, ami nem zárja le a kapcsolatot (SPEC-005
 * 5.4 táblázat `protocol_error` sora, 8.1 szekció: "ugyanez az alak áll a
 * REST hibaválasz törzsében ..., utóbbi egy `runId` mezővel kiegészítve").
 * A `runId` **nullable**: a spec egyetlen konkrét előidéző esete (5.6 2.
 * pont, nem egész `Last-Event-ID` fejléc) kapcsolat szintű, nem egyetlen
 * futáshoz köthető hiba, tehát nincs mindig kitölthető `runId` érték; a
 * táblázat "plusz az érintett `runId`" megfogalmazása ezt nem zárja ki.
 */
export const ProtocolErrorFrameSchema = z
  .strictObject({
    event: z.literal('protocol_error'),
    code: ProtocolErrorCodeSchema,
    message: z.string(),
    runId: z.string().nullable(),
  })
  .readonly();

/**
 * Az öt keret diszkriminált uniója, az `event` mezőn (SPEC-005 7.3 4. pont,
 * 19. kritérium). A kliens bejövő, szöveges folyamból dekódolt kerete mindig
 * ezen az úton validálódik (7.4 táblázat "kliens, bejövő SSE keret" sora).
 */
export const StreamFrameSchema = z.discriminatedUnion('event', [
  StreamReadyFrameSchema,
  RunEventFrameSchema,
  RunEventTransientFrameSchema,
  ReplayCompleteFrameSchema,
  ProtocolErrorFrameSchema,
]);

export type StreamReadyFrame = z.infer<typeof StreamReadyFrameSchema>;
export type RunEventFrame = z.infer<typeof RunEventFrameSchema>;
export type RunEventTransientFrame = z.infer<typeof RunEventTransientFrameSchema>;
export type ReplayCompleteFrame = z.infer<typeof ReplayCompleteFrameSchema>;
export type ProtocolErrorFrame = z.infer<typeof ProtocolErrorFrameSchema>;
export type StreamFrame = z.infer<typeof StreamFrameSchema>;
