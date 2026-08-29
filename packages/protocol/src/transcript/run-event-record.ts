import { z } from 'zod';
import { RunEventKindSchema, RunEventOriginSchema } from './run-event-kind.ts';

/**
 * A `run_event` sor drótszintű alakja (SPEC-005 9. szekció `transcript`
 * téma, SPEC-003 6.2 szekció mezői). A `payload` mező `z.unknown()`, nem
 * `any` (SPEC-005 T-006-7 elfogadási kritériuma): a payload alakja
 * `kind`-onként eltér, és a `protocol` nem importálhatja az SDK
 * üzenettípusait.
 */
export const RunEventRecordSchema = z
  .strictObject({
    id: z.number().int().positive(),
    runId: z.string(),
    stepRunId: z.string().nullable(),
    origin: RunEventOriginSchema,
    kind: RunEventKindSchema,
    occurredAtMs: z.number(),
    sdkMessageType: z.string().nullable(),
    sdkMessageSubtype: z.string().nullable(),
    sdkSessionId: z.string().nullable(),
    sdkUuid: z.string().nullable(),
    parentToolUseId: z.string().nullable(),
    toolName: z.string().nullable(),
    toolUseId: z.string().nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    cacheReadInputTokens: z.number().int().nonnegative().nullable(),
    cacheCreationInputTokens: z.number().int().nonnegative().nullable(),
    numTurns: z.number().int().nonnegative().nullable(),
    payload: z.unknown(),
  })
  .readonly();

export type RunEventRecord = z.infer<typeof RunEventRecordSchema>;
