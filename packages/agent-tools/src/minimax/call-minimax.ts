import { postJson, type FetchFunction } from '@easter-workflow-builder/http-client';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/result';
import type { MiniMaxConfig } from '../config/minimax-config.ts';
import { isMiniMaxEnvelope } from './is-minimax-envelope.ts';

/**
 * Közös MiniMax hívás a kereső és a képértelmező végponthoz.
 *
 * A hibajelzés NEM a HTTP státuszban van: a mérésünk szerint hibás API kulcsra
 * is HTTP 200 érkezik, és a hiba csak a `base_resp.status_code` mezőben
 * látszik. Ezért a burkoló ellenőrzése kötelező, mielőtt a válasz sikeresnek
 * minősülne.
 */
export async function callMiniMax(
  config: MiniMaxConfig,
  path: string,
  body: unknown,
  fetchFunction: FetchFunction,
): Promise<Outcome<unknown>> {
  const response = await postJson(
    {
      url: `${config.baseUrl}${path}`,
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body,
      timeoutMs: config.timeoutMs,
    },
    fetchFunction,
  );
  if (!isOkOutcome(response)) {
    return response;
  }
  if (!isMiniMaxEnvelope(response.value)) {
    return {
      kind: 'error',
      message: 'A MiniMax válaszában nincs értelmezhető base_resp mező, ezért a hívás eredménye nem eldönthető.',
    };
  }
  const { status_code, status_msg } = response.value.base_resp;
  if (status_code !== 0) {
    return {
      kind: 'error',
      message: `A MiniMax hívás hibával tért vissza. Kód: ${String(status_code)}. Üzenet: ${status_msg}`,
    };
  }
  return { kind: 'ok', value: response.value };
}
