import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  InterruptSummaryResponseSchema,
  StartedRunResponseSchema,
  type InterruptSummaryResponse,
  type RunDetail,
  type StartedRunResponse,
} from '@easter-workflow-builder/protocol';
import { Badge, Button } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { useRequestState } from '../request-state/use-request-state.ts';
import { describeRunStatusBadge } from '../run-history/run-status-badge.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { isRunInterruptible } from './run-control-availability.ts';
import './run-control.css';

export interface RunControlBarProperties {
  readonly runDetail: RunDetail;
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
  /**
   * Az újraindítás után hívódik, az ÚJ futás azonosítójával: a hívó erre
   * navigál (9. szekció 13. async pont).
   */
  readonly onRestarted: (newRunId: string) => void;
  /**
   * Van-e a futásnak függő jóváhagyása (SPEC-008 8. szekció: "a futás nézet
   * fejlécénél" a jelzés, T-009-27). A jelvény az állapot jelvény mellett,
   * UGYANABBAN a sorban áll, tehát a fejléc magassága nem függ tőle, és a
   * vászon sem zsugorodik, amikor egy jóváhagyás megjelenik.
   */
  readonly hasPendingApproval: boolean;
}

const CANCELLED_RUNS_TITLE_DOM_ID = 'run-control-cancelled-runs-title';

/**
 * A futás állapota és a két vezérlő művelet (SPEC-008 6.4, 6.5, T-009-23,
 * AC25, AC26, AC27). Egyszerre PONTOSAN EGY gomb áll itt, mert a hat futás
 * állapot két, egymást kizáró csoportra oszlik (`run-control-availability.ts`):
 * nem terminális állapotban a megszakítás, terminálisban az újraindítás.
 *
 * A "MEGSZAKÍTÁS FOLYAMATBAN" ÁLLAPOT (SPEC-008 6.4: "A megszakítás nem
 * azonnali, és ezt a felület kimondja"). A motor a jelzés után kimeríti a
 * generátorokat, minden üzenetet beír, és csak utána zár tranzakcióban
 * (SPEC-004 9.), tehát a `POST /api/runs/{runId}/interrupt` válasza NEM a
 * megszakítás befejezését jelenti. Az állapot ezért két szakaszból áll, és
 * addig tart, amíg a futás állapota terminálisra nem vált:
 *
 * 1. a kérés maga folyamatban van (`pending`),
 * 2. a kérés lefutott, de a futás állapota még nem terminális.
 *
 * A második szakaszt a `run_finished` esemény zárja le: a `RunViewScreen` arra
 * a keretre tölti újra a futás rekordját (`GET /api/runs/{runId}`), és az új,
 * terminális állapot érkezésekor az `isRunInterruptible` hamisra vált. Ez a
 * lánc az egyetlen forrás: nincs második, párhuzamos jelző, ami elcsúszhatna
 * tőle. A gomb mindkét szakaszban letiltva és spinnerrel áll, mert a
 * várakozás mindkettőben tart (9. szekció 12. async pont).
 */
export function RunControlBar(properties: Readonly<RunControlBarProperties>): ReactElement {
  const { runDetail, apiOrigin, fetchFunction, onRestarted, hasPendingApproval } = properties;

  const interruptState = useRequestState<InterruptSummaryResponse>();
  const restartState = useRequestState<StartedRunResponse>();

  function handleInterrupt(): void {
    void interruptState.run(() =>
      requestRouteWithoutBody({
        routeId: 'interruptRun',
        parameters: { runId: runDetail.id },
        responseSchema: InterruptSummaryResponseSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
  }

  function handleRestart(): void {
    void restartState.run(async () => {
      const outcome = await requestRoute({
        routeId: 'restartRun',
        parameters: { runId: runDetail.id },
        body: {},
        responseSchema: StartedRunResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        onRestarted(outcome.value.runId);
      }
      return outcome;
    });
  }

  const badge = describeRunStatusBadge(runDetail.status);
  const isInterruptible = isRunInterruptible(runDetail.status);
  const isCancelling =
    interruptState.state.status === 'pending' || (interruptState.state.status === 'success' && isInterruptible);
  const isRestarting = restartState.state.status === 'pending';

  // A megszakítás az al-workflow futásokat is elviszi (M-89): a lista akkor
  // jelenik meg, ha NEM csak a gyökér futás szerepel benne (AC26). Az összegzés
  // külön `const` kötésben áll, mert a `interruptState.state` szűkítését a
  // TypeScript nem viszi át a `filter` callback zárványába.
  const interruptSummary = interruptState.state.status === 'success' ? interruptState.state.value : undefined;
  const cancelledSubRunIds =
    interruptSummary === undefined
      ? []
      : interruptSummary.cancelledRunIds.filter((runId) => runId !== interruptSummary.rootRunId);

  return (
    <div className="run-control">
      <div className="run-control__bar">
        <Badge variant={badge.variant}>{badge.label}</Badge>
        {hasPendingApproval && <Badge variant="warning">jóváhagyásra vár</Badge>}
        {isCancelling && (
          <span className="run-control__pending" role="status">
            Megszakítás folyamatban
          </span>
        )}
        <span className="run-control__actions">
          {isInterruptible ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isLoading={isCancelling}
              disabled={isCancelling}
              onClick={handleInterrupt}
            >
              Megszakítás
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              isLoading={isRestarting}
              disabled={isRestarting}
              onClick={handleRestart}
            >
              Újraindítás
            </Button>
          )}
        </span>
      </div>
      {cancelledSubRunIds.length > 0 && (
        <section className="run-control__cancelled-runs" aria-labelledby={CANCELLED_RUNS_TITLE_DOM_ID}>
          <h2 id={CANCELLED_RUNS_TITLE_DOM_ID} className="run-control__cancelled-runs-title">
            Megszakított al-workflow futások
          </h2>
          <ul className="run-control__cancelled-runs-items">
            {cancelledSubRunIds.map((runId) => (
              <li key={runId}>{runId}</li>
            ))}
          </ul>
        </section>
      )}
      {interruptState.state.status === 'failure' && <p role="alert">{interruptState.state.message}</p>}
      {restartState.state.status === 'failure' && <p role="alert">{restartState.state.message}</p>}
      {/* A futás hibája a fejléc ALATT, teljes szélességben (SPEC-008 6.4). A
          `errorKind` és a `errorMessage` két, egymástól független nullázható
          mező a drótszintű alakban, ezért két külön ág. */}
      {(runDetail.errorKind !== null || runDetail.errorMessage !== null) && (
        <div className="run-control__run-error" role="alert">
          {runDetail.errorKind !== null && <p className="run-control__run-error-kind">{runDetail.errorKind}</p>}
          {runDetail.errorMessage !== null && (
            <p className="run-control__run-error-message">{runDetail.errorMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}
