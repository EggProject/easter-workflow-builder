import type { SdkResultSubtype } from './sdk-result-subtype.ts';

/**
 * A `result` SDK üzenet motor számára releváns alakja (SPEC-004 3.3, 2.
 * szekció F-3 tény, 5.2 9. pont).
 *
 * A `structured_output` mező opcionális, és a valódi `sdk.d.ts`-ben is
 * `unknown` a típusa: a `SDKResultSuccess` (`subtype: 'success'`) hordozza,
 * a `SDKResultError` (a másik négy `subtype`) nem. A típus ezt a mezőnevet
 * szó szerint veszi át, mert a motort csak a **jelenléte** érdekli, a
 * tartalmát nem kell szűkíteni (`hasStructuredOutput`, külön fájlban).
 */
export interface SdkResultMessage {
  readonly type: 'result';
  readonly subtype: SdkResultSubtype;
  readonly structured_output?: unknown;
}
