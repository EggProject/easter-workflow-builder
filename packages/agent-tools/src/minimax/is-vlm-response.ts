import { isRecord } from 'typeguards';
import type { MiniMaxVlmResponse } from './vlm-response.ts';

/**
Typeguard a képértelmező válaszra.
*/
export function isVlmResponse(value: unknown): value is MiniMaxVlmResponse {
  return isRecord(value) && typeof value['content'] === 'string';
}
