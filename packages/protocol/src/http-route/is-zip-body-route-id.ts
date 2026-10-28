import { ROUTE_TABLE, type RouteDefinition, type RouteId } from './route-table.ts';

/**
 * Azok a végpontok, amelyek kérés törzse nyers ZIP csomag (`requestBody:
 * 'application/zip'`, SPEC-009 5.1, O-36), nem JSON. A típus a `ROUTE_TABLE`
 * soraiból származik, így egy új bináris végpont kézi felsorolás nélkül kerül
 * bele.
 */
export type ZipBodyRouteId = keyof {
  readonly [
    K in RouteId as (typeof ROUTE_TABLE)[K] extends { readonly requestBody: 'application/zip' } ? K : never
  ]: true;
};

/**
 * Nyers ZIP törzsű végpont-e az azonosító (SPEC-009 5.1, O-36). A szerver
 * ezen dönt a JSON és a bináris törzs olvasó között.
 */
export function isZipBodyRouteId(routeId: RouteId): routeId is ZipBodyRouteId {
  const definition: RouteDefinition = ROUTE_TABLE[routeId];
  return definition.requestBody === 'application/zip';
}
