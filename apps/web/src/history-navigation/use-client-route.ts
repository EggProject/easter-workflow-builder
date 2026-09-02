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

  useEffect(() => {
    return port.addPopStateListener(() => {
      setPathname(port.pathname());
    });
  }, [port]);

  const navigate = useCallback(
    (routeId: ClientRouteId): void => {
      const path = CLIENT_ROUTE_TABLE[routeId].template;
      port.pushState(path);
      setPathname(path);
    },
    [port],
  );

  return { routeId: matchClientRoute(pathname), navigate };
}
