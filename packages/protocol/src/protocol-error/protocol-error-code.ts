import { z } from 'zod';

/**
 * A `ProtocolErrorCode` hat értékű zárt szótára (SPEC-005 8.2 szekció). Minden
 * REST hibaválasz és a `protocol_error` SSE keret is ebből a szótárból veszi
 * a `code` mezőt; a hozzá tartozó HTTP státuszt a `http-status-for-error-code.ts`
 * adja.
 *
 * A `service_unavailable` a folyamat átmeneti állapota, nem a kérésé: a leálló
 * szerver elutasítja az új futást (SPEC-004 10.2 1. pont). Ez a 503 jelentése
 * (RFC 9110 15.6.4, https://www.rfc-editor.org/rfc/rfc9110.html#name-503-service-unavailable).
 */
export const ProtocolErrorCodeSchema = z.enum([
  'invalid_request',
  'not_found',
  'conflict',
  'unprocessable',
  'internal',
  'service_unavailable',
]);

export type ProtocolErrorCode = z.infer<typeof ProtocolErrorCodeSchema>;
