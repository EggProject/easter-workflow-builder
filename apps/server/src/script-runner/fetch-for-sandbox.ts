import { describeErrorType } from '@easter-workflow-builder/core';
import { isString } from '@easter-workflow-builder/typeguards';
import type { HostCallOutcome } from './host-call-outcome.ts';
import { isSandboxFetchInit } from './is-sandbox-fetch-init.ts';

const ALLOWED_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/**
 * A sandbox `fetch` gazda oldala (SPEC-014 5.4 "Hálózat", 5.10 2. és 4. pont).
 *
 * - Kizárólag `http:` és `https:` séma; más séma és érvénytelen cím elutasított
 *   ígéret (`TypeError`), kérés nélkül. Címszűrés nincs (O-6 user döntés).
 * - A Node beépített `fetch`-e `redirect: 'manual'`-lal: a Node (undici) ilyenkor
 *   a tényleges 3xx választ adja, nem a böngésző `opaqueredirect` válaszát
 *   (undici 8.9.0 `lib/web/fetch/index.js` 1228 ... 1234. sor), tehát a szkript a
 *   `status` és a `location` fejléc alapján maga dönt.
 * - A kérés a `signal`-on szakad meg (a lépés vége, határideje, külső
 *   megszakítása); a gazda csak a dokumentált mezőket adja tovább.
 * - A válasz `{ status, headers, body }`: a fejlécek a `Headers` bejárásából
 *   (kisbetűs név), a törzs szöveg.
 * - A hálózati hiba elutasított ígéret, az üzenetben a gazda hiba típusneve.
 */
export async function fetchForSandbox(url: unknown, init: unknown, signal: AbortSignal): Promise<HostCallOutcome> {
  if (!isString(url)) {
    return typeError('a fetch címe szöveg kell legyen');
  }
  const target = URL.parse(url);
  if (target === null) {
    return typeError(`a fetch címe nem érvényes URL: ${url}`);
  }
  if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
    return typeError(`a fetch csak http: és https: címet fogad, ez ${target.protocol} séma`);
  }
  if (init !== undefined && !isSandboxFetchInit(init)) {
    return typeError('a fetch beállítása csak method, headers és body mezőt tartalmazhat, szöveg értékkel');
  }
  try {
    const response = await fetch(target, { ...init, redirect: 'manual', signal });
    const body = await response.text();
    return {
      kind: 'resolved',
      json: JSON.stringify({ status: response.status, headers: Object.fromEntries(response.headers), body }),
    };
  } catch (error) {
    return typeError(`a hálózati kérés nem sikerült (${describeErrorType(error)})`);
  }
}

function typeError(message: string): HostCallOutcome {
  return { kind: 'rejected', name: 'TypeError', message };
}
