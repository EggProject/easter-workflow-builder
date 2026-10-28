import type { RouteId, ZipBodyRouteId } from '@easter-workflow-builder/protocol';
import type { BinaryRouteHandler } from './binary-route-handler.ts';
import type { RouteHandler } from './route-handler.ts';

/**
 * A `ROUTE_TABLE` minden azonosítójára kötelezően kitöltött kezelő rekord: a
 * nyers ZIP törzsű végpont (SPEC-009 5.1, O-36) `BinaryRouteHandler`, minden
 * más `RouteHandler`. Egy hiányzó vagy rossz fajtájú bejegyzés fordítási
 * hibát ad (SPEC-006 12. elfogadási kritérium). Típus-only fájl.
 */
export type RouteHandlers = {
  readonly [K in RouteId]: K extends ZipBodyRouteId ? BinaryRouteHandler : RouteHandler;
};
