// Barrel: csak nevesített újraexport (SPEC-002 6.6 6. szabálya). A csomag téma mappánként
// bővül, ahogy a SPEC-005 végrehajtási lépései elkészülnek.

// http-route: az API_BASE_PATH és a STREAM_PATH konstans, a 26 végpont útvonal sablonja,
// és a paraméter behelyettesítő tiszta függvény.
export { API_BASE_PATH } from './http-route/api-base-path.ts';
export { STREAM_PATH } from './http-route/stream-path.ts';
export type { HttpMethod, RouteDefinition, RouteId } from './http-route/route-table.ts';
export { ROUTE_TABLE } from './http-route/route-table.ts';
export { buildRoutePath } from './http-route/build-route-path.ts';
