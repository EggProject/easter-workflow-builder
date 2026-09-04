/**
 * A `protocol` csomag Zod sémáinak duck-típusos szerződése (SPEC-007 8.1,
 * 8.2). Az `apps/web` szándékosan NEM veszi fel a `zod` csomagot
 * függőségként (SPEC-007 3.2 táblázata csak a `core`, `protocol`, `ui`,
 * `react`, `react-dom` csomagot sorolja fel): a séma paraméter típusa ezért
 * kizárólag azt a felületet írja le, amit ez a réteg ténylegesen használ.
 * A `path` mezőnév és a `.success`/`.data`/`.error.issues` alak a `protocol`
 * csomag saját, már használt mintáját követi
 * (`event-stream/decode-stream-frame.ts`).
 */
export interface SafeParsableSchema<TValue> {
  readonly safeParse: (input: unknown) => SafeParseOutcome<TValue>;
}

export type SafeParseOutcome<TValue> =
  | { readonly success: true; readonly data: TValue }
  | {
      readonly success: false;
      readonly error: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] };
    };
