import type { FetchFunction } from '@easter-workflow-builder/core';
import { PendingApprovalSchema, type PendingApproval } from '@easter-workflow-builder/protocol';
import { useCallback, useEffect, useState } from 'react';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';

export interface UsePendingApprovalsInput {
  readonly runId: string | undefined;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
}

export interface UsePendingApprovals {
  /**
   * A nézett futás függő jóváhagyásai. Betöltés alatt az UTOLSÓ sikeres
   * betöltés listája marad a helyén (a `run-history-screen.tsx`
   * `lastRuns`/`isReloading` mintája), hogy a panel ne villogjon egy döntés
   * utáni újratöltéskor.
   */
  readonly approvals: readonly PendingApproval[];
  readonly isLoading: boolean;
  readonly failureMessage: string | undefined;
  /**
   * Új betöltést indít. A jóváhagyás panel minden döntés VÁLASZA UTÁN hívja,
   * a válasz kimenetelétől függetlenül (SPEC-008 8. szekció: a `conflict`
   * hibaágra a lista frissül; sikeres döntés után a szerver már nem adja
   * vissza a lezárt jóváhagyást, SPEC-005 4.2, user döntés 2026-09-23).
   */
  readonly reload: () => void;
}

const PENDING_APPROVAL_LIST_SCHEMA = arraySchema(PendingApprovalSchema);

/**
 * A `GET /api/approvals` válasza, a SAJÁT `runId` értékére szűrve (SPEC-008
 * 8. szekció, T-009-27). A végpont MINDEN futás függő jóváhagyását adja
 * vissza, a szűrést a kliens végzi (PLAN-009 T-009-27 leírása).
 *
 * **Nincs élő (SSE) frissítés.** A lista a csatoláskor egyszer töltődik be,
 * és a hívó (`ApprovalPromptCard`) minden döntés válasza UTÁN explicit
 * `reload()` hívással frissíti - ez fedi a megkövetelt esetet (a `conflict`
 * hibaágra frissül a lista), és nem igényel egy külön, a `run-view`
 * `is-step-run-list-change-frame.ts` fájlától független jelző keret
 * predikátumot. Ha egy jövőbeli lépés megköveteli, hogy egy MÁSIK kliens
 * döntése is élőben megjelenjen, ez a hook bővíthető `subscribeToFrames`
 * paraméterrel, a `useLiveStepRuns` mintája szerint.
 */
export function usePendingApprovals(input: Readonly<UsePendingApprovalsInput>): UsePendingApprovals {
  const { runId, fetchFunction, apiOrigin } = input;
  const request = useRequestState<readonly PendingApproval[]>();
  const [lastApprovals, setLastApprovals] = useState<readonly PendingApproval[] | undefined>(undefined);

  const load = useCallback((): Promise<void> => {
    if (runId === undefined) {
      return Promise.resolve();
    }
    return request.run(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listPendingApprovals',
        responseSchema: PENDING_APPROVAL_LIST_SCHEMA,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind !== 'ok') {
        return outcome;
      }
      const ownApprovals = outcome.value.filter((approval) => approval.runId === runId);
      setLastApprovals(ownApprovals);
      return { kind: 'ok', value: ownApprovals };
    });
    // A `request.run` a `useRequestState` stabil `useCallback`-je (a hívó
    // oldali objektum nem az, de a projekt ESLint konfigurációja nem
    // tartalmazza a `react-hooks/exhaustive-deps` szabályt, ugyanúgy, mint a
    // `GraphEditorScreen` és a `RunViewScreen` más effektjeiben).
  }, [runId, fetchFunction, apiOrigin]);

  useEffect(() => {
    setLastApprovals(undefined);
  }, [runId]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    approvals: request.state.status === 'success' ? request.state.value : (lastApprovals ?? []),
    isLoading: request.state.status === 'pending',
    failureMessage: request.state.status === 'failure' ? request.state.message : undefined,
    reload: () => {
      void load();
    },
  };
}
