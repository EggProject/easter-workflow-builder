import { z } from 'zod';
import { RunStatusSchema } from './run-status.ts';

/**
 * `GET /api/runs` és `GET /api/workflows/{workflowId}/runs`-hoz hasonló lista
 * nézet sora (SPEC-005 4.2 B táblázat 10. sora). A teljes bemenetet és a
 * belső mezőket (`workflowAncestry`, `graphSnapshotHash`) a `RunDetail`
 * hordozza, a lista nézet a felsoroláshoz szükséges mezőkre szorítkozik.
 */
export const RunSummarySchema = z
  .strictObject({
    id: z.string(),
    workflowId: z.string(),
    status: RunStatusSchema,
    providerId: z.string(),
    createdAtMs: z.number(),
    startedAtMs: z.number().nullable(),
    finishedAtMs: z.number().nullable(),
    errorKind: z.string().nullable(),
    errorMessage: z.string().nullable(),
  })
  .readonly();

export type RunSummary = z.infer<typeof RunSummarySchema>;

/**
 * `GET /api/runs/{runId}` válasza (SPEC-005 4.2 B táblázat 11. sora). A
 * `persistedStreamDeltas` mező kötelező (14. kritérium, SPEC-003 6.6): a
 * visszanéző felület ebből tudja megmondani, miért nincs delta sor egy adott
 * futás transcriptjében.
 */
export const RunDetailSchema = z
  .strictObject({
    id: z.string(),
    workflowId: z.string(),
    status: RunStatusSchema,
    input: z.unknown(),
    providerId: z.string(),
    rootRunId: z.string(),
    depth: z.number().int().nonnegative(),
    workflowAncestry: z.array(z.string()).readonly(),
    graphSnapshotHash: z.string(),
    persistedStreamDeltas: z.boolean(),
    restartedFromRunId: z.string().nullable(),
    createdAtMs: z.number(),
    startedAtMs: z.number().nullable(),
    finishedAtMs: z.number().nullable(),
    errorKind: z.string().nullable(),
    errorMessage: z.string().nullable(),
  })
  .readonly();

export type RunDetail = z.infer<typeof RunDetailSchema>;

/**
 * `GET /api/runs` query stringje: a `limit` kötelező (F-19), a `workflowId`
 * elhagyható (SPEC-005 4.2 B táblázat 10. sora, `listRuns` vagy
 * `listRunsForWorkflow`).
 */
export const ListRunsQuerySchema = z.strictObject({
  limit: z.number().int().positive(),
  workflowId: z.string().optional(),
});

export type ListRunsQuery = z.infer<typeof ListRunsQuerySchema>;
