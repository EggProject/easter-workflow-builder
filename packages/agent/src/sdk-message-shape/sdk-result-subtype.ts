/**
 * A `result` SDK üzenet öt lehetséges `subtype` értéke (SPEC-004 3.3, 2.
 * szekció F-3 tény, a pinelt `sdk.d.ts` `SDKResultSuccess` és `SDKResultError`
 * uniójának szó szerinti táblázata). A `success` a `SDKResultSuccess` ága, a
 * másik négy a `SDKResultError` négy hibaága.
 */
export type SdkResultSubtype =
  | 'success'
  | 'error_during_execution'
  | 'error_max_turns'
  | 'error_max_budget_usd'
  | 'error_max_structured_output_retries';
