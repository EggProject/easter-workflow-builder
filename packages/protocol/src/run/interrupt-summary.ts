import { z } from 'zod';

/**
 * `POST /api/runs/{runId}/interrupt` válasza (SPEC-005 4.2 B táblázat 15.
 * sora), az `engine` `InterruptSummary` alakját tükrözve (SPEC-004
 * `interrupt-run.ts`, `InterruptRunResult`).
 */
export const InterruptSummaryResponseSchema = z
  .strictObject({
    rootRunId: z.string(),
    cancelledRunIds: z.array(z.string()).readonly(),
  })
  .readonly();

export type InterruptSummaryResponse = z.infer<typeof InterruptSummaryResponseSchema>;
