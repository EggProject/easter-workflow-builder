import type { Outcome } from '../../result/outcome/outcome.ts';
import { describeError } from '../error-description/describe-error.ts';
import type { FetchFunction } from './fetch-function.ts';

/**
Egy JSON POST kérés leírása.
*/
export interface PostJsonRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly timeoutMs: number;
}

/**
 * JSON POST kérés, feldolgozatlan JSON válasszal. Nem dob: a hálózati hiba, a
 * nem sikeres HTTP státusz és az értelmezhetetlen törzs egyaránt hibaág.
 * Nincs újrapróbálkozás: erre nincs dokumentált szabályunk, és az agent maga
 * dönthet arról, hogy megismétli-e a hívást.
 */
export async function postJson(request: PostJsonRequest, fetchFunction: FetchFunction): Promise<Outcome<unknown>> {
  let response: Response;
  try {
    response = await fetchFunction(request.url, {
      method: 'POST',
      headers: { ...request.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch (error) {
    return {
      kind: 'error',
      message: `A(z) ${request.url} címet nem sikerült elérni ${String(request.timeoutMs)} ezredmásodpercen belül: ${describeError(error)}`,
    };
  }
  if (!response.ok) {
    return { kind: 'error', message: `A(z) ${request.url} cím HTTP ${String(response.status)} státusszal válaszolt.` };
  }
  try {
    const parsedBody: unknown = await response.json();
    return { kind: 'ok', value: parsedBody };
  } catch (error) {
    return { kind: 'error', message: `A(z) ${request.url} válasza nem értelmezhető JSON: ${describeError(error)}` };
  }
}
