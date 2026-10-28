export interface JsonResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
Egyetlen JSON kérés a szerver felé; a törzs `unknown`, a hívó a protokoll sémával ellenőrzi.
*/
export async function requestJson(
  baseUrl: string,
  method: string,
  routePath: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    signal,
    ...(body !== undefined && { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const parsed: unknown = await response.json();
  return { status: response.status, body: parsed };
}
