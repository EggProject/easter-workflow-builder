import { z } from 'zod';
import { NodeTypeSchema } from '../workflow/node-type.ts';
import { StepRunStatusSchema } from './run-status.ts';

/**
 * `GET /api/runs/{runId}/steps` egy sora (SPEC-005 4.2 B táblázat 13. sora),
 * a `packages/db` `StepRunRecord` mezőit tükrözve (SPEC-003 4.10 szekció).
 * A `sessionMode` és a `structuredOutputStrategy` mezőt a `db` réteg raw
 * `string | null` alakban tárolja (nincs rá bejegyzett domain guard,
 * `packages/db` CLAUDE.md); a `sessionMode`-ot itt mégis zárt felsorolásként
 * modellezzük (`isolated`/`continued`, SPEC-003 4.5), mert ez egy jól ismert,
 * kétértékű dokumentált halmaz - ez a séma nem tagja a hat sodródás védett
 * felsorolásnak (SPEC-005 7.6), tehát önálló minőségi döntés, nem
 * kikényszerített kontraktus.
 */
export const StepRunRecordSchema = z
  .strictObject({
    id: z.string(),
    runId: z.string(),
    nodeId: z.string(),
    nodeType: NodeTypeSchema,
    parentStepRunId: z.string().nullable(),
    iteration: z.number().int().nonnegative(),
    attempt: z.number().int().positive(),
    status: StepRunStatusSchema,
    providerId: z.string(),
    modelId: z.string().nullable(),
    sessionMode: z.enum(['isolated', 'continued']).nullable(),
    sdkSessionId: z.string().nullable(),
    resumedFromSessionId: z.string().nullable(),
    forkedSession: z.boolean(),
    structuredOutputStrategy: z.string().nullable(),
    output: z.unknown(),
    resultSubtype: z.string().nullable(),
    numTurns: z.number().int().nonnegative().nullable(),
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable(),
    cacheReadInputTokens: z.number().int().nonnegative().nullable(),
    cacheCreationInputTokens: z.number().int().nonnegative().nullable(),
    subWorkflowRunId: z.string().nullable(),
    errorKind: z.string().nullable(),
    errorMessage: z.string().nullable(),
    startedAtMs: z.number().nullable(),
    finishedAtMs: z.number().nullable(),
    createdAtMs: z.number(),
  })
  .readonly();

export type StepRunRecord = z.infer<typeof StepRunRecordSchema>;
