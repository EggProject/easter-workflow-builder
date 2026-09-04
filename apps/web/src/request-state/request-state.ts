/**
 * A négy állapotú async leíró, amit a felület minden várakozó pontja használ
 * (SPEC-007 8.1, 11. szekció, 12.2). Diszkriminált unió a `status` mezőn.
 */
export type RequestState<TValue> =
  | { readonly status: 'idle' }
  | { readonly status: 'pending' }
  | { readonly status: 'success'; readonly value: TValue }
  | { readonly status: 'failure'; readonly message: string };
