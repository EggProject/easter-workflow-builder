import type { FetchFunction } from '@easter-workflow-builder/core';
import { ProviderSummarySchema, type ProviderSummary } from '@easter-workflow-builder/protocol';
import { useEffect } from 'react';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RequestState } from '../request-state/request-state.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';

/**
 * A `GET /api/providers` válasza a Beállítások képernyőn (SPEC-009 3.1): a
 * képernyő egyszer tölti be, és minden kártya ugyanazt a listát olvassa
 * (a Provider kártya választója, a párhuzamossági korlát sorai), így nincs
 * kártyánként ismételt kérés.
 */
export function useProviderList(
  apiOrigin: string,
  fetchFunction: FetchFunction,
): RequestState<readonly ProviderSummary[]> {
  const { state, run } = useRequestState<readonly ProviderSummary[]>();

  useEffect(() => {
    void run(() =>
      requestRouteWithoutBody({
        routeId: 'listProviders',
        responseSchema: arraySchema(ProviderSummarySchema),
        fetchFunction,
        apiOrigin,
      }),
    );
  }, [run, apiOrigin, fetchFunction]);

  return state;
}
