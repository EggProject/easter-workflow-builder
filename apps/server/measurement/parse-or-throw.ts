/**
A protokoll séma `safeParse` eredményének kibontása: nem illeszkedő válasznál a hívó hibát kap.
*/
export function parseOrThrow<TValue>(
  result: { readonly success: true; readonly data: TValue } | { readonly success: false; readonly error: Error },
  what: string,
): TValue {
  if (!result.success) {
    throw new Error(`A(z) ${what} nem illeszkedik a protokoll sémára: ${result.error.message}`);
  }
  return result.data;
}
