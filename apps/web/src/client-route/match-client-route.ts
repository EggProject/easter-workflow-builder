import { CLIENT_ROUTE_TABLE, type ClientRouteId } from './client-route-table.ts';

/**
 * A `CLIENT_ROUTE_TABLE` kulcsai listaként, típusosan (ugyanaz a minta, mint
 * a `protocol` csomag `is-route-id.ts` `ROUTE_ID_KEYS`-e): az
 * `Object.keys`/`Object.entries` a táblán mindig `string` kulcsot adna
 * vissza, sosem a szűkebb `ClientRouteId` uniót, és `as` kényszerítés
 * nélkül nem írható vissza (`.claude/CLAUDE.md` 5.).
 */
const CLIENT_ROUTE_IDS: readonly ClientRouteId[] = ['workflowList', 'runHistory', 'graphEditor', 'runView'];

/**
 * A `pathname` illesztése a `CLIENT_ROUTE_TABLE` egy bejegyzésére (SPEC-007
 * 7.2). Tiszta függvény, paraméteres szegmens ág nélkül: egyik útvonal sem
 * paraméteres, tehát egy ilyen ág nem lenne tesztelhető (13.3).
 */
export function matchClientRoute(pathname: string): ClientRouteId | undefined {
  return CLIENT_ROUTE_IDS.find((routeId) => CLIENT_ROUTE_TABLE[routeId].template === pathname);
}
