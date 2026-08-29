import { z } from 'zod';
import { RunStatusSchema } from './run-status.ts';

/**
 * `POST /api/workflows/{workflowId}/runs` kérés törzse (SPEC-005 4.2 B
 * táblázat 9. sora). Az `input` mező szó szerint a `start` node
 * `inputFields` mezőire adott értékeket hordozza (SPEC-004 `StartRunRequest`
 * dokumentációja), tehát mező szerint olvasható rekord, nem `z.unknown()`.
 */
export const StartRunRequestSchema = z.strictObject({
  input: z.record(z.string(), z.unknown()),
});

export type StartRunRequest = z.infer<typeof StartRunRequestSchema>;

/**
 * A `startRun` és a `restartRun` motor művelet azonos alakú válasza
 * (SPEC-005 4.2 B táblázat 9. és 16. sora).
 */
export const StartedRunResponseSchema = z
  .strictObject({
    runId: z.string(),
    status: RunStatusSchema,
  })
  .readonly();

export type StartedRunResponse = z.infer<typeof StartedRunResponseSchema>;

/**
 * `POST /api/runs/{runId}/restart` kérés törzse: az `input` elhagyható,
 * elhagyva a motor az eredeti futás bemenetét használja (SPEC-005 4.2 B
 * táblázat 16. sora).
 */
export const RestartRunRequestSchema = z.strictObject({
  input: z.record(z.string(), z.unknown()).optional(),
});

export type RestartRunRequest = z.infer<typeof RestartRunRequestSchema>;
