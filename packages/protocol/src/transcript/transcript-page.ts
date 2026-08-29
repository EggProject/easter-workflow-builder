import { z } from 'zod';
import { RunEventRecordSchema } from './run-event-record.ts';

/**
 * `GET /api/runs/{runId}/events` válasza (SPEC-005 4.2 B táblázat 14. sora):
 * a lekérdezett lap eseményei, a kérésben adott sorrendben.
 */
export const TranscriptPageSchema = z
  .strictObject({
    events: z.array(RunEventRecordSchema).readonly(),
  })
  .readonly();

export type TranscriptPage = z.infer<typeof TranscriptPageSchema>;
