import { z } from 'zod';

/**
 * A `ProtocolErrorCode` öt értékű zárt szótára (SPEC-005 8.2 szekció). Minden
 * REST hibaválasz és a `protocol_error` SSE keret is ebből a szótárból veszi
 * a `code` mezőt; a hozzá tartozó HTTP státuszt a `http-status-for-error-code.ts`
 * adja.
 */
export const ProtocolErrorCodeSchema = z.enum([
  'invalid_request',
  'not_found',
  'conflict',
  'unprocessable',
  'internal',
]);

export type ProtocolErrorCode = z.infer<typeof ProtocolErrorCodeSchema>;
