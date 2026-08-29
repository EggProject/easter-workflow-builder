import type { RouteId } from '@easter-workflow-builder/protocol';
import type { RouteHandler } from './route-handler.ts';

/**
 * Helyőrző kezelő azoknak a `RouteId` végpontoknak, amikhez ebben a
 * lépésben nem készült valódi implementáció (a run/approval/provider/
 * settings/stream végpont csoportok, lásd a záró jelentés hiánylistáját).
 * A `Record<RouteId, RouteHandler>` kimerítő típusa (SPEC-006 12.
 * elfogadási kritérium) megköveteli, hogy MINDEN azonosítóhoz tartozzon
 * kezelő - ez az egyetlen, újrahasznált függvény adja ki azt a tizennyolc
 * végpontot, aminek a valódi kezelője még nem készült el, `internal` kódra
 * képződő, őszinte hibaüzenettel, nem csendes 200-as válasszal.
 */
export function createNotImplementedHandler(routeId: RouteId): RouteHandler {
  return () =>
    Promise.resolve({
      kind: 'error',
      message: `A(z) "${routeId}" végpont kezelője ebben a verzióban nincs megvalósítva (not_implemented).`,
    });
}
