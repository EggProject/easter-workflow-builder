import type { FetchFunction } from '@easter-workflow-builder/core';
import { StepRunRecordSchema, type StepRunRecord } from '@easter-workflow-builder/protocol';
import { useEffect, useState } from 'react';
import { createCoalescedReload } from '../request-state/create-coalesced-reload.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { RouteFailure } from '../rest-client/route-outcome.ts';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { isStepRunListChangeFrame } from './is-step-run-list-change-frame.ts';

export interface UseLiveStepRunsInput {
  readonly runId: string | undefined;
  readonly subscribeToFrames: SubscribeToStreamFrames;
  readonly fetchFunction: FetchFunction;
  readonly apiOrigin: string;
  /**
   * Hányszor indult újra a szerver (`useStreamConnection`, SPEC-007 9.2,
   * AC44). Minden változása újratöltést vált ki: az újraindulás
   * helyreállítása a nem terminális lépéseket lépés szintű esemény nélkül
   * viszi `interrupted` állapotba (SPEC-004 10.1), és a SPEC-005 5.2 szerint
   * ilyenkor a nézet elavult, újra kell kérdezni, nem elég a feliratkozást
   * pótolni.
   */
  readonly serverRestartCount: number;
}

export interface LiveStepRuns {
  /**
   * Az utolsó SIKERES betöltés sorai, `undefined`, amíg egy sem sikerült. Az
   * újratöltés alatt a korábbi lista a helyén marad, hogy a rajz ne villogjon.
   */
  readonly stepRuns: readonly StepRunRecord[] | undefined;
  /**
   * A legutóbbi betöltés hibája, az átmeneti jelzővel együtt (a képernyő ebből
   * dönti el, hogy a korábbi lista mellett jelez, vagy a hibát mutatja a rajz
   * helyett); egy későbbi sikeres betöltés törli.
   */
  readonly failure: RouteFailure | undefined;
}

const STEP_RUN_LIST_SCHEMA = arraySchema(StepRunRecordSchema);
const EMPTY_LIVE_STEP_RUNS: LiveStepRuns = { stepRuns: undefined, failure: undefined };

/**
 * A nézett futás lépés futásai, élőben frissítve (SPEC-008 6.2, PLAN-009
 * T-009-25a): ebből jön a csomópontok állapota a rajzon.
 *
 * **Az állapot forrása a REST válasz, a keret csak jelzés.** A lépés futás
 * sorát a `GET /api/runs/{runId}/steps` adja, és a stream kerete
 * (`isStepRunListChangeFrame`) csak azt mondja meg, mikor kell újratölteni.
 * A keretből közvetlenül nem építhető sor: a `run_event.payload` a dróton
 * `unknown`, a `step_started` payloadja nem hordozza a `parentStepRunId`
 * mezőt (a `fan_out` összesítés alapja), és a megszakítás lépés szintű
 * esemény nélkül zárja le a lépéseket (`is-step-run-list-change-frame.ts`).
 *
 * A keretek a veszteségmentes `subscribeToFrames` úton jönnek, és az
 * újratöltés kérések összevonva futnak (`createCoalescedReload`): egyszerre
 * legfeljebb egy kérés áll folyamatban, tehát egy löketben érkező
 * keretsorozat sem indít kérés vihart.
 *
 * A képernyő ezt a hookot a futásra való szerver oldali feliratkozás ELŐTT
 * hívja, így a pótlás egyetlen kerete sem érkezhet feliratkozó nélkül. Egy
 * másik futásra váltáskor (vagy leszereléskor) a még folyamatban lévő kérés
 * válasza eldobódik, hogy a régi futás sorai ne íródjanak az újéba.
 *
 * **Szerver újraindulás után** (`serverRestartCount` változása) a lista
 * újratöltődik, a korábbi sorok viszont a helyükön maradnak, hogy a rajz ne
 * villogjon: az állapot törlése ezért külön effektben áll, és kizárólag a
 * futás váltására fut.
 */
export function useLiveStepRuns(input: Readonly<UseLiveStepRunsInput>): LiveStepRuns {
  const { runId, subscribeToFrames, fetchFunction, apiOrigin, serverRestartCount } = input;
  const [state, setState] = useState<LiveStepRuns>(EMPTY_LIVE_STEP_RUNS);

  useEffect(() => {
    setState(EMPTY_LIVE_STEP_RUNS);
  }, [runId]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }

    let isDisposed = false;
    const requestReload = createCoalescedReload(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listStepRuns',
        parameters: { runId },
        responseSchema: STEP_RUN_LIST_SCHEMA,
        fetchFunction,
        apiOrigin,
      });
      if (isDisposed) {
        return;
      }
      if (outcome.kind === 'ok') {
        setState({ stepRuns: outcome.value, failure: undefined });
        return;
      }
      setState((previous) => ({ ...previous, failure: outcome }));
    });

    requestReload();
    const unsubscribe = subscribeToFrames((frame) => {
      if (isStepRunListChangeFrame(frame, runId)) {
        requestReload();
      }
    });

    return () => {
      isDisposed = true;
      unsubscribe();
    };
    // A `serverRestartCount` szándékosan dependency, holott a törzs nem
    // olvassa: a változása ugyanazt a betöltést váltja ki, mint a csatolás,
    // elágazás nélkül, a `run-history-screen.tsx` mintájára.
  }, [runId, subscribeToFrames, fetchFunction, apiOrigin, serverRestartCount]);

  return state;
}
