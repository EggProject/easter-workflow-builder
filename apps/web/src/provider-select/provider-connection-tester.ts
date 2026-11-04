import type { ConnectionTestResponse } from '@easter-workflow-builder/protocol';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';

/**
 * A "Kapcsolat teszt" hívás portja (SPEC-009 3.2, O-2): egy provider
 * azonosítóból elindítja a `POST /api/providers/:providerId/connection-test`
 * hívást. A `ProviderSelect` nem ismeri az API origint és a `fetch`-et, a
 * hívó adja át, így minden helyen (Beállítások, workflow modálisok, lépés
 * felülírás) ugyanaz a komponens fut.
 *
 * **Típus-only fájl, nincs `.spec.ts` párja** (`apps/web/CLAUDE.md` ## Fájlok
 * konvenció).
 */
export type ProviderConnectionTester = (providerId: string) => Promise<RouteOutcome<ConnectionTestResponse>>;
