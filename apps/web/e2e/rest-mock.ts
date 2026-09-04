// Közös REST mockolás segédfüggvények minden e2e spec fájlhoz (T-008-27).
// Minden REST hívás `page.route()` mockon megy, valós backend szervert
// egyetlen teszt sem szólít meg (a `sse-reconnect.spec.ts` az egyetlen,
// mérten indokolt kivétel az SSE csatornán,
// docs/research/2026-08-30-sse-mockolas-meres.md 3. szekció).
import type { Page, Route } from '@playwright/test';
import { ROUTE_TABLE, type RouteId } from '@easter-workflow-builder/protocol';
import { API_ORIGIN } from './api-origin.ts';

export interface MockRoute {
  readonly method: string;
  readonly pathname: RegExp;
  readonly handle: (route: Route, url: URL) => Promise<void> | void;
}

/**
 * A `ROUTE_TABLE` sablonját (`:paramNév` helyőrzőkkel) illesztő reguláris
 * kifejezéssé alakítja. A sablonok kizárólag betűt, kötőjelet és `/`
 * karaktert tartalmaznak (lásd `route-table.ts`), regex speciális karakter
 * nincs bennük, tehát külön escape-elés nélkül is biztonságos.
 */
function pathnamePattern(routeId: RouteId): RegExp {
  const { template } = ROUTE_TABLE[routeId];
  return new RegExp(`^${template.replaceAll(/:[A-Za-z]+/g, '[^/]+')}$`);
}

/**
 * Egy `routeId`-hez tartozó mock bejegyzés: a metódus és az útvonal minta a
 * `ROUTE_TABLE`-ből jön, a hívónak csak a válasz kiszolgálását kell megadnia.
 */
export function mockRoute(routeId: RouteId, handle: MockRoute['handle']): MockRoute {
  return { method: ROUTE_TABLE[routeId].method, pathname: pathnamePattern(routeId), handle };
}

/**
 * Egyetlen `page.route()` regisztráció az `API_ORIGIN` minden útvonalára: a
 * kérés metódusa és pathname-je alapján a megfelelő `MockRoute` bejegyzést
 * hívja. Nem illeszkedő kérésre 404-es protokoll hibaválasz megy, hogy egy
 * hiányzó mock azonnal, hangosan kiderüljön, ne csendben akadjon el.
 */
export async function installApiMocks(page: Page, routes: readonly MockRoute[]): Promise<void> {
  // Kizárólag `/api/**` alá regisztrál (nem `${API_ORIGIN}/**`), hogy a
  // minta STRUKTURÁLISAN se ütközzön a `sse-mock.ts` `/events**` mintájával,
  // regisztrálási sorrendtől függetlenül (a Playwright a legutóbb
  // regisztrált route-ot próbálja először).
  await page.route(`${API_ORIGIN}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const matched = routes.find((entry) => entry.method === request.method() && entry.pathname.test(url.pathname));
    if (matched === undefined) {
      await route.fulfill(
        jsonBody({ code: 'not_found', message: `nincs mock: ${request.method()} ${url.pathname}` }, 404),
      );
      return;
    }
    await matched.handle(route, url);
  });
}

export function jsonBody(value: unknown, status = 200): { status: number; contentType: string; body: string } {
  return { status, contentType: 'application/json', body: JSON.stringify(value) };
}
