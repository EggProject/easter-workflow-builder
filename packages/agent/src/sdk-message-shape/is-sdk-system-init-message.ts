import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import type { SdkSystemInitMessage } from './sdk-system-init-message.ts';

/**
 * A `messages: AsyncIterable<unknown>` folyam egy eleme a motor számára
 * releváns `system` `init` alakot ölti-e (SPEC-004 3.3, 2. szekció F-3 tény).
 */
export function isSdkSystemInitMessage(value: unknown): value is SdkSystemInitMessage {
  return isRecord(value) && value['type'] === 'system' && value['subtype'] === 'init' && isString(value['session_id']);
}
