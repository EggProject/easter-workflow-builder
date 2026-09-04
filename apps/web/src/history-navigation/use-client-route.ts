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
   */
  readonly navigate: (routeId: ClientRouteId) => void;
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
    (routeId: ClientRouteId): void => {
      const path = CLIENT_ROUTE_TABLE[routeId].template;
      port.pushState(path);
      setPathname(path);
      // A CLIENT_ROUTE_TABLE sablonjai nem tartalmaznak query stringet, tehát
      // a navigáció után a valódi böngésző URL-nek megfelelően a keresés is
      // üresre vált (SPEC-007 7.2).
      setSearch('');
    },
    [port],
  );

  return { routeId: matchClientRoute(pathname), search, navigate };
}
