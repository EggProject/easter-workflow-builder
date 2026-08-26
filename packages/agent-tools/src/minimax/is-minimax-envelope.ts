import { isRecord } from 'typeguards';
import type { MiniMaxEnvelope } from './base-response.ts';

/**
 * Typeguard: megvan-e a `base_resp` burkoló a válaszban. Enélkül a státuszkód
 * nem olvasható, és a hívás sikeressége nem dönthető el.
 */
export function isMiniMaxEnvelope(value: unknown): value is MiniMaxEnvelope {
  if (!isRecord(value)) {
    return false;
  }
  const baseResponse = value['base_resp'];
  return (
    isRecord(baseResponse) &&
    typeof baseResponse['status_code'] === 'number' &&
    typeof baseResponse['status_msg'] === 'string'
  );
}
