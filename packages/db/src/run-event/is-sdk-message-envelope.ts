import { isNonEmptyString, isRecord } from '@easter-workflow-builder/typeguards';

/**
 * A nyers SDK üzenet borítéka: kulcs-érték objektum, aminek van nem üres,
 * szöveges `type` mezője. Ez a legkisebb alak, amiből a normalizáló egyáltalán
 * dolgozni tud (SPEC-003 6.2 szekció: a `sdk_message_type` oszlop az
 * `SDKMessage` `type` mezője szó szerint).
 *
 * A többi mezőt a típus szándékosan **nem** szűkíti. Az `SDKMessage` unió ágai
 * áganként eltérő mezőket hordoznak, a 6.2 szabálya szerint pedig minden
 * normalizált mező hiányozhat, tehát a mezőnkénti szűkítés a
 * `normalize-sdk-message.ts` dolga, `unknown` értékről indulva.
 */
export type SdkMessageEnvelope = Readonly<Record<string, unknown>> & { readonly type: string };

/**
 * Nyers SDK üzenet boríték-e az érték. Az üres `type` szöveget elutasítja: az
 * nem diszkriminátor, és a 6.4 szekció zárt `kind` listáján sem szerepel.
 */
export function isSdkMessageEnvelope(value: unknown): value is SdkMessageEnvelope {
  return isRecord(value) && isNonEmptyString(value['type']);
}
