import { isRecord } from '@easter-workflow-builder/typeguards';
import { isSdkResultSubtype } from './is-sdk-result-subtype.ts';
import type { SdkResultMessage } from './sdk-result-message.ts';

/**
 * A `messages: AsyncIterable<unknown>` folyam egy eleme a motor számára
 * releváns `result` alakot ölti-e (SPEC-004 3.3, 2. szekció F-3 tény). A
 * `structured_output` mező tartalmát nem szűkíti, mert a valódi SDK-ban is
 * `unknown`; a jelenlétét a `hasStructuredOutput` dönti el.
 */
export function isSdkResultMessage(value: unknown): value is SdkResultMessage {
  return isRecord(value) && value['type'] === 'result' && isSdkResultSubtype(value['subtype']);
}
