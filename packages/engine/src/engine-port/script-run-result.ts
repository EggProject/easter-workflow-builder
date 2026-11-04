import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * Egy JavaScript szkript lépés eredménye (SPEC-014 5.6, 5.7, 5.8).
 *
 * - `succeeded`: a visszatérési érték a sandboxban `JSON.stringify`, a gazdán
 *   `JSON.parse` után; a tárolási korlátot a motor ellenőrzi
 *   (`step_output_not_storable`), nem a futtató.
 * - `failed`: a három futásidejű hibaosztály egyike, a futtató saját üzenetével.
 * - `aborted`: a kérés `signal` jele szakította meg a lépést; a motor a lépést
 *   `cancelled` állapotban zárja, hibaosztály nélkül.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export type ScriptRunResult =
  | { readonly kind: 'succeeded'; readonly output: unknown }
  | {
      readonly kind: 'failed';
      readonly errorKind: Extract<
        EngineErrorKind,
        'script_evaluation_failed' | 'script_timed_out' | 'script_output_not_json'
      >;
      readonly message: string;
    }
  | { readonly kind: 'aborted' };
