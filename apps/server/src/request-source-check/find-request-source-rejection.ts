import type { IncomingHttpHeaders } from 'node:http';
import { isAllowedHostHeader } from './is-allowed-host-header.ts';
import { isAllowedRequestSource } from './is-allowed-request-source.ts';

/**
 * A kérés forrás ellenőrzés egyetlen belépési pontja (SPEC-017 5.1): minden
 * kérésre lefut, az útvonal illesztése és a törzs olvasása előtt, az SSE
 * végpontra is. Elutasításkor a `forbidden` hibatörzs üzenetét adja, a
 * hibaosztállyal zárójelben (SPEC-005 8.3), a kapott fejléc értékének
 * visszhangja nélkül (SPEC-006 3.5 4. pont); átengedéskor `undefined`.
 */
export function findRequestSourceRejection(
  headers: IncomingHttpHeaders,
  localPort: number | undefined,
  allowedOrigin: string,
): string | undefined {
  if (!isAllowedHostHeader(headers.host, localPort)) {
    return 'A kérés Host fejléce nem a szerver helyi neve (host_not_allowed).';
  }
  if (!isAllowedRequestSource(headers, allowedOrigin)) {
    return 'A kérés nem a beállított felület originjéről érkezett (origin_not_allowed).';
  }
  return undefined;
}
