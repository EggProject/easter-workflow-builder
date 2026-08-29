import type { Outcome } from '@easter-workflow-builder/core';

/**
 * Egy végpont kezelőjének bemenete: az illesztett útvonal paraméterei, a
 * query string, és a Zod séma ellen még NEM ellenőrzött kérés törzs
 * (SPEC-006 9.1 `route-dispatch` téma). Az adatbázis és a motor SZÁNDÉKOSAN
 * nincs itt: a kezelő ezeket zárványként kapja a létrehozásakor (pl.
 * `createListWorkflowsHandler(database)`), nem a hívásonkénti kontextusban -
 * így a `route-dispatch` és a `http-server` téma egyáltalán nem függ a `db`
 * és az `engine` csomagtól, és a diszpécser tesztje egyszerű, önálló
 * függvényekkel dolgozhat valódi adatbázis vagy motor nélkül.
 */
export interface RouteHandlerContext {
  readonly parameters: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly body: unknown;
}

/**
 * Egy sikeres kezelés HTTP válasza. A `status` a SPEC-005 4.2 táblázat
 * szerinti alapértelmezett 200, kivéve a `clearConcurrencyLimit` végpontot
 * (204, üres törzzsel, 25. sor) - ott a kezelő explicit 204-et ad,
 * `body: undefined` mellett.
 */
export interface RouteHandlerResult {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Minden végpont kezelője ugyanezt az alakot ölti: a hibaágon az `Outcome`
 * üzenete a `error-mapping` témán megy át `ProtocolErrorCode`-dá
 * (`.claude/CLAUDE.md` "Outcome hibaosztály konvenció").
 */
export type RouteHandler = (context: RouteHandlerContext) => Promise<Outcome<RouteHandlerResult>>;
