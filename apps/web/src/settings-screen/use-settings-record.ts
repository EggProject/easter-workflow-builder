import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  SettingsRecordSchema,
  type SettingsRecord,
  type UpdateSettingsRequest,
} from '@easter-workflow-builder/protocol';
import { useCallback, useEffect, useState } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';

export interface UseSettingsRecordResult {
  /**
   * A betöltés állapota; az első sikeres betöltés vagy mentés után mindig a
   * legutóbb ismert rekord (`success`), tehát egy későbbi mentés hibája nem
   * dobja el a megjelenített értéket.
   */
  readonly state: RequestState<SettingsRecord>;
  /**
   * Részleges frissítés (`PUT /api/settings`): a válasz a teljes rekord, ami a
   * kártyák közös állapotába kerül. A kártya a saját mentési állapotát
   * (`isLoading`, hibaüzenet) maga vezeti az eredményből.
   */
  readonly save: (update: UpdateSettingsRequest) => Promise<RouteOutcome<SettingsRecord>>;
}

/**
 * A `GET /api/settings` / `PUT /api/settings` rekord közös állapota a
 * Beállítások képernyőn (SPEC-009 3.1): egy betöltés, és minden kártya ugyanazt
 * a rekordot olvassa és írja (a Provider kártya a `defaultProviderId` mezőt, a
 * Futás napló kártya a `persistStreamDeltas` mezőt). A `PUT` válasza mindkét
 * mezőt hordozza, ezért egy mentés után az összes kártya friss értéket lát.
 */
export function useSettingsRecord(apiOrigin: string, fetchFunction: FetchFunction): UseSettingsRecordResult {
  const loadRequest = useRequestState<SettingsRecord>();
  const [latest, setLatest] = useState<SettingsRecord | undefined>(undefined);
  const { run } = loadRequest;

  useEffect(() => {
    void run(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'readSettings',
        responseSchema: SettingsRecordSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLatest(outcome.value);
      }
      return outcome;
    });
  }, [run, apiOrigin, fetchFunction]);

  const save = useCallback(
    async (update: UpdateSettingsRequest): Promise<RouteOutcome<SettingsRecord>> => {
      const outcome = await requestRoute({
        routeId: 'updateSettings',
        body: update,
        responseSchema: SettingsRecordSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLatest(outcome.value);
      }
      return outcome;
    },
    [apiOrigin, fetchFunction],
  );

  const state: RequestState<SettingsRecord> =
    latest === undefined ? loadRequest.state : { status: 'success', value: latest };

  return { state, save };
}
