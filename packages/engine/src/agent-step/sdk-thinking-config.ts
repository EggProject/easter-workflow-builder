/**
 * A kimenő `Options.thinking` mező alakja: a pinelt Agent SDK `ThinkingConfig` uniójának az a két
 * ága, amit a motor `ThinkingMode` értékei leképeznek (SPEC-013 5.2). A `sdk.d.ts` szerint a mező
 * objektum (`{ type: 'adaptive' }`, `{ type: 'disabled' }`), és a `sdk.mjs` a `type` mezőn ágazik;
 * a motor az SDK csomagtól nem függ, ezért az alak itt áll, és az SDK típussal való
 * kompatibilitását az `apps/server` típusszintű tesztje őrzi. A fix budget (`enabled`) ág a
 * `ThinkingMode` típusban nem létezik, ezért nincs itt.
 */
export type SdkThinkingConfig = { readonly type: 'adaptive' } | { readonly type: 'disabled' };
