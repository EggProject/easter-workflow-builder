import type { Outcome } from '@easter-workflow-builder/core';
import type { RouteHandlerResult } from './route-handler.ts';

/**
 * A nyers bináris törzs olvasásának eredménye (SPEC-009 5.4 6. pont): vagy a
 * teljes törzs, vagy a jelzés, hogy a törzs túllépte a kezelő korlátját. A
 * korlát fölötti bájtokat az olvasó nem tartja meg.
 */
export type BinaryRequestBody = { readonly kind: 'complete'; readonly bytes: Buffer } | { readonly kind: 'too_large' };

/**
 * Egy nyers bináris törzsű végpont kezelőjének bemenete (SPEC-009 5.1, O-36):
 * az útvonal paraméterei és a beolvasott törzs.
 */
export interface BinaryRouteHandlerContext {
  readonly parameters: Readonly<Record<string, string>>;
  readonly body: BinaryRequestBody;
}

/**
 * A nyers bináris törzsű végpont kezelője: a törzs korlátját maga adja meg
 * (a `http-server` eddig olvas be), és a túllépés hibaágát is maga képzi, a
 * saját hibaosztályával. Típus-only fájl.
 */
export interface BinaryRouteHandler {
  readonly maxBodyBytes: number;
  readonly handle: (context: BinaryRouteHandlerContext) => Promise<Outcome<RouteHandlerResult>>;
}
