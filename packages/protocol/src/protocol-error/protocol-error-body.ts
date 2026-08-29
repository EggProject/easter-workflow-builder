import { z } from 'zod';
import { ProtocolErrorCodeSchema } from './protocol-error-code.ts';

/**
 * Az egységes hiba alak, REST-en és SSE-n egyaránt (SPEC-005 8.1 szekció).
 * Nincs `details` szabad objektum, nincs `stack`, nincs `sql`, nincs `path`
 * mező: a séma szándékosan zárt (40. kritérium). A `protocol_error` SSE
 * keret ugyanezt az alakot hordozza, egy `runId` mezővel kiegészítve
 * (`event-stream` téma, 5.4 szekció).
 */
export const ProtocolErrorBodySchema = z
  .strictObject({
    code: ProtocolErrorCodeSchema,
    message: z.string(),
  })
  .readonly();

export type ProtocolErrorBody = z.infer<typeof ProtocolErrorBodySchema>;
