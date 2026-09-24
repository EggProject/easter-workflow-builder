import type { FetchFunction } from '@easter-workflow-builder/core';
import { PendingApprovalSchema, type PendingApproval } from '@easter-workflow-builder/protocol';
import { useEffect, useRef, useState } from 'react';
import { createCoalescedReload } from '../request-state/create-coalesced-reload.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { isApprovalListChangeFrame } from './is-approval-list-change-frame.ts';

export interface UsePendingApprovalsInput {
  readonly runId: string | undefined;
  readonly subscribeToFrames: SubscribeToStreamFrames;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
}

export interface PendingApprovalsLoad {
  /**
   * A nézett futás függő jóváhagyásai az utolsó SIKERES betöltésből,
   * `undefined`, amíg egy sem sikerült. Az újratöltés alatt a korábbi lista a
   * helyén marad, hogy a panel ne villogjon (a `useLiveStepRuns` mintája).
   */
  readonly approvals: readonly PendingApproval[] | undefined;
  /**
   * A legutóbbi betöltés hibájának üzenete; egy későbbi sikeres betöltés
   * törli. Átmeneti hiba korábbi sikeres lista mellett nem ír ide.
   */
  readonly failureMessage: string | undefined;
}

export interface UsePendingApprovals extends PendingApprovalsLoad {
  /**
   * Újratöltést kér, ugyanazon az összevont úton, mint a jelző keretek. A
   * jóváhagyás panel minden döntés VÁLASZA UTÁN hívja, a kimeneteltől
   * függetlenül, hogy a lista akkor is frissüljön, ha a stream éppen nem él.
   */
  readonly reload: () => void;
}

const PENDING_APPROVAL_LIST_SCHEMA = arraySchema(PendingApprovalSchema);
const EMPTY_LOAD: PendingApprovalsLoad = { approvals: undefined, failureMessage: undefined };

/**
 * A `GET /api/approvals` válasza, a SAJÁT `runId` értékére szűrve, élőben
 * frissítve (SPEC-008 8. szekció, T-009-27). A végpont MINDEN futás függő
 * jóváhagyását adja vissza, a szűrést a kliens végzi.
 *
 * **Az állapot forrása a REST válasz, a keret csak jelzés**, pontosan úgy,
 * mint a lépés futás listánál (`run-view/use-live-step-runs.ts`, T-009-25a):
 * a lista a csatoláskor betöltődik, majd a veszteségmentes
 * `subscribeToFrames` úton érkező jelző keretre
 * (`is-approval-list-change-frame.ts`) újratöltődik, oldal újratöltés nélkül.
 * Az újratöltés kérések összevonva futnak (`createCoalescedReload`):
 * egyszerre legfeljebb egy kérés áll folyamatban, és a futása alatt érkező
 * bármennyi jelzés (a döntés utáni `reload` hívással együtt) egyetlen
 * utólagos kérést ad.
 *
 * Egy másik futásra váltáskor (vagy leszereléskor) a még folyamatban lévő
 * kérés válasza eldobódik, és a régi futás listája azonnal törlődik, hogy a
 * régi futás jóváhagyásai ne jelenjenek meg az új futás nézetében.
 */
export function usePendingApprovals(input: Readonly<UsePendingApprovalsInput>): UsePendingApprovals {
  const { runId, subscribeToFrames, fetchFunction, apiOrigin } = input;
  const [load, setLoad] = useState<PendingApprovalsLoad>(EMPTY_LOAD);
  // Az aktuális futás összevont újratöltője; `undefined`, amíg nincs nézett
  // futás. Ref, nem állapot: a cseréje nem igényel újrarenderelést.
  const reloadReference = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    setLoad(EMPTY_LOAD);
  }, [runId]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }

    let isDisposed = false;
    const requestReload = createCoalescedReload(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listPendingApprovals',
        responseSchema: PENDING_APPROVAL_LIST_SCHEMA,
        fetchFunction,
        apiOrigin,
      });
      if (isDisposed) {
        return;
      }
      if (outcome.kind === 'ok') {
        setLoad({
          approvals: outcome.value.filter((approval) => approval.runId === runId),
          failureMessage: undefined,
        });
        return;
      }
      // Átmeneti hiba (hálózati hiba, 502, 503; a szerver leállása) korábbi
      // sikeres lista mellett nem hibaüzenet: a lista a helyén marad, a
      // várakozást a futás nézet szerverre várakozás jelzése mondja ki, és a
      // szerver újraindulása utáni pótlás (`replay_complete`) újratölt. Ugyanaz
      // a szabály, mint a futás rekordjánál és a lépés futásoknál
      // (`run-view/blocking-failure-message.ts`).
      setLoad((previous) =>
        outcome.isTransient && previous.approvals !== undefined
          ? previous
          : { ...previous, failureMessage: outcome.message },
      );
    });

    reloadReference.current = requestReload;
    requestReload();
    const unsubscribe = subscribeToFrames((frame) => {
      if (isApprovalListChangeFrame(frame, runId)) {
        requestReload();
      }
    });

    return () => {
      isDisposed = true;
      reloadReference.current = undefined;
      unsubscribe();
    };
  }, [runId, subscribeToFrames, fetchFunction, apiOrigin]);

  return {
    ...load,
    reload: () => {
      reloadReference.current?.();
    },
  };
}
