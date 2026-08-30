import { STREAM_PATH } from '@easter-workflow-builder/protocol';

/**
 * A CORS fejlécek kiszámítása (SPEC-006 5.7 szekció). Kizárólag a
 * `STREAM_PATH` útvonalra és kizárólag akkor ad fejlécet, ha a konfiguráció
 * megnevez egy fejlesztői origint - az engedélyezett érték mindig ez a
 * KONFIGURÁLT érték, sosem a kérés `Origin` fejlécének visszatükrözése és
 * sosem `*` (5.7 2. pont). Az `Access-Control-Allow-Credentials` fejléc
 * emiatt sehol nem szerepel (5.7 3. pont, `withCredentials` hamis marad).
 */
export function resolveCorsHeaders(
  pathname: string,
  developmentOrigin: string | undefined,
): Readonly<Record<string, string>> {
  if (pathname !== STREAM_PATH || developmentOrigin === undefined) {
    return {};
  }
  return { 'Access-Control-Allow-Origin': developmentOrigin };
}
