import { useCallback, useEffect, useRef, useState } from 'react';
import { CLIENT_ROUTE_TABLE, type ClientRouteId } from '../client-route/client-route-table.ts';
import { matchClientRoute } from '../client-route/match-client-route.ts';
import type { HistoryLocationPort } from './history-location-port.ts';

/**
 * A kliens útválasztó regisztrálható navigációs őre (SPEC-008 5.10, 1. és 3.
 * pont): regisztrált őrnél a `navigate` a navigációt nem hajtja végre, a
 * böngésző vissza és előre lépését (`popstate`) pedig visszafordítja, és
 * mindkét esetben a célra vezető végrehajtást az őrnek adja. A `proceed` a
 * navigációt az őr megkerülésével végrehajtja (a megerősítő modális "Kilépés
 * mentés nélkül" gombja).
 */
export type NavigationGuard = (proceed: () => void) => void;

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
  /**
   * Navigációs őr regisztrálása (SPEC-008 5.10, 1. és 3. pont). Egyszerre
   * egy őr áll, egyetlen regisztrálóval (a szerkesztő képernyő): egy újabb
   * regisztráció a korábbit lecseréli, a visszaadott függvény az őrt
   * eltávolítja. Őr nélkül a `navigate` és a `popstate` a fenti, változatlan
   * módon navigál. A hivatkozás stabil, tehát a hívó hatása nem fut újra
   * miatta.
   */
  readonly registerNavigationGuard: (guard: NavigationGuard) => () => void;
}

/**
 * A kliens oldali útvonal állapota, a befecskendezett `HistoryLocationPort`
 * fölött (SPEC-007 7.2). A vissza/előre navigáció (`popstate`, M-13) őr
 * nélkül a `location.pathname` értékéből számol újra, regisztrált őrnél a
 * lépést visszafordítja (SPEC-008 5.10, 3. pont).
 */
export function useClientRoute(port: HistoryLocationPort): UseClientRouteResult {
  const [pathname, setPathname] = useState<string>(port.pathname);
  const [search, setSearch] = useState<string>(port.search);
  // Ref, nem állapot: az őr regisztrálása és eltávolítása nem renderel újra,
  // a `navigate` és a `popstate` figyelő a hívás pillanatában olvassa.
  const guardReference = useRef<NavigationGuard | undefined>(undefined);

  useEffect(() => {
    return port.addPopStateListener(() => {
      const guard = guardReference.current;
      if (guard === undefined) {
        setPathname(port.pathname());
        setSearch(port.search());
        return;
      }
      // A `popstate` a bejegyzés váltása UTÁN fut, tehát a lépést nem
      // megakadályozzuk, hanem visszafordítjuk (SPEC-008 5.10, 3. pont, M-115):
      // a megjelenített útvonal marad, a cím az állapotban álló útvonalra és
      // query stringre íródik vissza, a cél pedig az őrhöz kerül. A `pathname`
      // és a `search` a hatás függősége, tehát a figyelő mindig a legutóbb
      // megjelenített címet írja vissza.
      const targetPathname = port.pathname();
      const targetSearch = port.search();
      port.pushState(`${pathname}${search}`);
      guard(() => {
        port.pushState(`${targetPathname}${targetSearch}`);
        setPathname(targetPathname);
        setSearch(targetSearch);
      });
    });
  }, [port, pathname, search]);

  const navigate = useCallback(
    (routeId: ClientRouteId, searchParameters = ''): void => {
      const path = CLIENT_ROUTE_TABLE[routeId].template;
      // A CLIENT_ROUTE_TABLE sablonjai nem tartalmaznak query stringet, tehát
      // a navigáció után a keresés a hívó által megadott paraméterekre vált,
      // paraméter nélkül üresre (SPEC-007 7.2). A `search` állapot a
      // `location.search` konvencióját követi, tehát a kérdőjelet is hordozza.
      const search = searchParameters === '' ? '' : `?${searchParameters}`;
      const applyNavigation = (): void => {
        port.pushState(`${path}${search}`);
        setPathname(path);
        setSearch(search);
      };
      const guard = guardReference.current;
      if (guard === undefined) {
        applyNavigation();
        return;
      }
      guard(applyNavigation);
    },
    [port],
  );

  const registerNavigationGuard = useCallback((guard: NavigationGuard): (() => void) => {
    guardReference.current = guard;
    return () => {
      guardReference.current = undefined;
    };
  }, []);

  return { routeId: matchClientRoute(pathname), search, navigate, registerNavigationGuard };
}
