import { useCallback, useEffect, useState } from 'react';
import { CLIENT_ROUTE_TABLE, type ClientRouteId } from '../client-route/client-route-table.ts';
import { matchClientRoute } from '../client-route/match-client-route.ts';
import type { HistoryLocationPort } from './history-location-port.ts';

export interface UseClientRouteResult {
  /**
   * A jelenlegi útvonalhoz illeszkedő azonosító; ismeretlen útvonalon `undefined` (10.3).
   */
  readonly routeId: ClientRouteId | undefined;
  /**
   * A jelenlegi query string, a kérdőjellel együtt vagy üres sztring
   * (SPEC-007 10.2, a `run-history` `?workflowId=` szűrője).
   */
  readonly search: string;
  /**
   * Navigáció a megadott útvonalra: `pushState` hívás, majd az állapot
   * azonnali frissítése, mert a `pushState` nem vált ki `popstate`
   * eseményt (SPEC-007 M-12).
   *
   * A `searchParameters` a query string a kérdőjel NÉLKÜL (`runId=r-1`
   * alakban), elhagyva üres. Erre azért van szükség, mert a `CLIENT_ROUTE_TABLE`
   * sablonjai paraméter nélküliek: a szerkesztett workflow és a nézett futás
   * azonosítója a query stringből jön (SPEC-008 5. szekció bevezetője), tehát
   * egy al-workflow futásra való navigáláshoz (SPEC-008 6.3, AC24) az
   * azonosítót is át kell adni.
   */
  readonly navigate: (routeId: ClientRouteId, searchParameters?: string) => void;
}

/**
 * A kliens oldali útvonal állapota, a befecskendezett `HistoryLocationPort`
 * fölött (SPEC-007 7.2). A vissza/előre navigáció (`popstate`, M-13) a
 * `location.pathname` értékéből számol újra.
 */
export function useClientRoute(port: HistoryLocationPort): UseClientRouteResult {
  const [pathname, setPathname] = useState<string>(port.pathname);
  const [search, setSearch] = useState<string>(port.search);

  useEffect(() => {
    return port.addPopStateListener(() => {
      setPathname(port.pathname());
      setSearch(port.search());
    });
  }, [port]);

  const navigate = useCallback(
    (routeId: ClientRouteId, searchParameters = ''): void => {
      const path = CLIENT_ROUTE_TABLE[routeId].template;
      // A CLIENT_ROUTE_TABLE sablonjai nem tartalmaznak query stringet, tehát
      // a navigáció után a keresés a hívó által megadott paraméterekre vált,
      // paraméter nélkül üresre (SPEC-007 7.2). A `search` állapot a
      // `location.search` konvencióját követi, tehát a kérdőjelet is hordozza.
      const search = searchParameters === '' ? '' : `?${searchParameters}`;
      port.pushState(`${path}${search}`);
      setPathname(path);
      setSearch(search);
    },
    [port],
  );

  return { routeId: matchClientRoute(pathname), search, navigate };
}
