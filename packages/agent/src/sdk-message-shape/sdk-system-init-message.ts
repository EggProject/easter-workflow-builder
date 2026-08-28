/**
 * A `system` SDK üzenet motor számára releváns alakja: kizárólag az a három
 * mező, amiből a `session_id` kiolvasható (SPEC-004 3.3, 2. szekció F-3 tény).
 * A valódi `SDKSystemMessage` (pinelt `sdk.d.ts`, `export declare type
 * SDKSystemMessage`) ennél jóval több mezőt hordoz; azokat szándékosan nem
 * vesszük fel, mert a motor egyetlen sora sem függ az SDK
 * típusdefiníciójától.
 *
 * A `session_id` mezőnév a dróton is snake_case, nem camelCase: ez nem
 * átnevezett, hanem szó szerint az SDK mezőneve, ugyanúgy, ahogy a
 * `packages/db` `normalize-sdk-message.ts` is a nyers mezőnéven olvassa.
 */
export interface SdkSystemInitMessage {
  readonly type: 'system';
  readonly subtype: 'init';
  readonly session_id: string;
}
