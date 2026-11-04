import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  ConcurrencyLimitViewSchema,
  type ConcurrencyLimitView,
  type SetConcurrencyLimitRequest,
} from '@easter-workflow-builder/protocol';
import { useCallback, useEffect, useState } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { emptyResponseSchema } from '../rest-client/empty-response-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';

/**
 * A sor a beállított korlát nélkül: a javaslat érintetlen marad.
 */
function withoutLimit(limit: ConcurrencyLimitView): ConcurrencyLimitView {
  // eslint-disable-next-line unicorn/no-null -- a ConcurrencyLimitView beállított korlátja a dróton `null`, ha nincs sor (packages/protocol/src/settings/concurrency-limit-view.ts).
  return { ...limit, configuredMaxConcurrentSteps: null };
}

export interface UseConcurrencyLimitsResult {
  /**
   * A betöltés állapota; a betöltés után mindig a legutóbb ismert lista
   * (`success`), tehát egy későbbi mentés vagy törlés hibája nem dobja el a
   * megjelenített értékeket.
   */
  readonly state: RequestState<readonly ConcurrencyLimitView[]>;
  /**
   * `PUT /api/settings/concurrency-limits/{providerId}`: a válasz sora
   * lecseréli a lista azonos provider sorát.
   */
  readonly saveLimit: (providerId: string, maxConcurrentSteps: number) => Promise<RouteOutcome<ConcurrencyLimitView>>;
  /**
   * `DELETE /api/settings/concurrency-limits/{providerId}` (204): a sor
   * beállított korlátja `null` lesz, a javaslat érintetlen marad.
   */
  readonly clearLimit: (providerId: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A providerenkénti párhuzamossági korlátok közös állapota a Beállítások
 * képernyőn (SPEC-009 3.1 2. pont): egy betöltés (`GET
 * /api/settings/concurrency-limits`), soronként mentés és törlés. Alapérték
 * sehol nincs: a lista a szerver válasza, sor híján nincs korlát (SPEC-003 11.).
 */
export function useConcurrencyLimits(apiOrigin: string, fetchFunction: FetchFunction): UseConcurrencyLimitsResult {
  const loadRequest = useRequestState<readonly ConcurrencyLimitView[]>();
  const [limits, setLimits] = useState<readonly ConcurrencyLimitView[]>([]);
  const { run } = loadRequest;

  useEffect(() => {
    void run(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listConcurrencyLimits',
        responseSchema: arraySchema(ConcurrencyLimitViewSchema),
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLimits(outcome.value);
      }
      return outcome;
    });
  }, [run, apiOrigin, fetchFunction]);

  const saveLimit = useCallback(
    async (providerId: string, maxConcurrentSteps: number): Promise<RouteOutcome<ConcurrencyLimitView>> => {
      const body: SetConcurrencyLimitRequest = { maxConcurrentSteps };
      const outcome = await requestRoute({
        routeId: 'setConcurrencyLimit',
        parameters: { providerId },
        body,
        responseSchema: ConcurrencyLimitViewSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLimits((previous) => previous.map((limit) => (limit.providerId === providerId ? outcome.value : limit)));
      }
      return outcome;
    },
    [apiOrigin, fetchFunction],
  );

  const clearLimit = useCallback(
    async (providerId: string): Promise<RouteOutcome<undefined>> => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'clearConcurrencyLimit',
        parameters: { providerId },
        responseSchema: emptyResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLimits((previous) =>
          previous.map((limit) => (limit.providerId === providerId ? withoutLimit(limit) : limit)),
        );
      }
      return outcome;
    },
    [apiOrigin, fetchFunction],
  );

  const state: RequestState<readonly ConcurrencyLimitView[]> =
    loadRequest.state.status === 'success' ? { status: 'success', value: limits } : loadRequest.state;

  return { state, saveLimit, clearLimit };
}
