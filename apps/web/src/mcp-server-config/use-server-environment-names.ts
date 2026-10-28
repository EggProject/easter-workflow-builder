import type { FetchFunction } from '@easter-workflow-builder/core';
import { ServerEnvironmentNameListSchema } from '@easter-workflow-builder/protocol';
import { useEffect } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';

/**
 * A `GET /api/server-environment-names` válasza (SPEC-009 6.2, O-32 (a)): a
 * szerver gép környezeti változóinak NEVEI, értéket soha. Ebből a listából
 * választ a felhasználó szerver oldali nevet a hozzárendeléshez.
 */
export function useServerEnvironmentNames(
  apiOrigin: string,
  fetchFunction: FetchFunction,
): RequestState<readonly string[]> {
  const { state, run } = useRequestState<readonly string[]>();

  useEffect(() => {
    void run(() =>
      requestRouteWithoutBody({
        routeId: 'listServerEnvironmentNames',
        responseSchema: ServerEnvironmentNameListSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
  }, [run, apiOrigin, fetchFunction]);

  return state;
}
