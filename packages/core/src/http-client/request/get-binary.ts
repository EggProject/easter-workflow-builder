import type { Outcome } from '../../result/outcome/outcome.ts';
import { describeError } from '../error-description/describe-error.ts';
import type { BinaryPayload } from './binary-payload.ts';
import type { FetchFunction } from './fetch-function.ts';

/**
 * Bináris tartalom letöltése GET kéréssel. Ugyanaz a hibakezelési elv, mint a
 * `postJson` esetén: nem dob, minden hibaág üzenet.
 */
export async function getBinary(
  url: string,
  timeoutMs: number,
  fetchFunction: FetchFunction,
): Promise<Outcome<BinaryPayload>> {
  let response: Response;
  try {
    response = await fetchFunction(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    return {
      kind: 'error',
      message: `A(z) ${url} címet nem sikerült elérni ${String(timeoutMs)} ezredmásodpercen belül: ${describeError(error)}`,
    };
  }
  if (!response.ok) {
    return { kind: 'error', message: `A(z) ${url} cím HTTP ${String(response.status)} státusszal válaszolt.` };
  }
  try {
    const buffer = await response.arrayBuffer();
    return {
      kind: 'ok',
      value: { bytes: new Uint8Array(buffer), contentType: response.headers.get('content-type') ?? '' },
    };
  } catch (error) {
    return { kind: 'error', message: `A(z) ${url} tartalmát nem sikerült beolvasni: ${describeError(error)}` };
  }
}
