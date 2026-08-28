import type { SdkResultMessage } from './sdk-result-message.ts';

/**
 * Megérkezett-e a strukturált kimenet a `result` üzenetben (SPEC-004 3.3, 5.2
 * 9. pont). Csak a `structured_output` mező **jelenlétét** nézi, nem a
 * tartalmát: az `success` subtype mellett releváns, a négy hibaágon a mező
 * eleve nem szerepel a valódi SDK-ban (`SDKResultError` nem hordozza), tehát
 * ott ez a függvény önmagától hamisat ad, `subtype` szerinti elágazás nélkül.
 */
export function hasStructuredOutput(message: SdkResultMessage): boolean {
  return Object.hasOwn(message, 'structured_output');
}
