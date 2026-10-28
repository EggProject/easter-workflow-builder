import type { Outcome } from '@easter-workflow-builder/core';
import type { RouteHandlerResult } from './route-handler.ts';

/**
 * A nyers bináris törzs olvasásának eredménye (SPEC-009 5.4 6. pont): vagy a
 * teljes törzs, vagy a jelzés, hogy a törzs túllépte a kezelő korlátját. A
 * korlát fölötti bájtokat az olvasó nem tartja meg.
 */
export type BinaryRequestBody = { readonly kind: 'complete'; readonly bytes: Buffer } | { readonly kind: 'too_large' };

/**
 * A beolvasott törzs feldolgozója, amit a kezelő az útvonal paramétereinek
 * elfogadása után ad.
 */
export type BinaryBodyProcessor = (body: BinaryRequestBody) => Promise<Outcome<RouteHandlerResult>>;

/**
 * A nyers bináris törzsű végpont kezelője (SPEC-009 5.1, O-36): a törzs
 * korlátját maga adja meg (a `http-server` eddig olvas be), és a túllépés
 * hibaágát is maga képzi, a saját hibaosztályával. Az `accept` az útvonal
 * paramétereit a törzs olvasása ELŐTT dönti el (PLAN-012 T-012-27, ZIP 9.
 * találat): a hibája a törzs feldolgozása nélkül válasz, sikere a törzs
 * feldolgozója, tehát a törzs csak elfogadott paraméterekkel jut a kezelőhöz.
 * Típus-only fájl.
 */
export interface BinaryRouteHandler {
  readonly maxBodyBytes: number;
  readonly accept: (parameters: Readonly<Record<string, string>>) => Outcome<BinaryBodyProcessor>;
}
