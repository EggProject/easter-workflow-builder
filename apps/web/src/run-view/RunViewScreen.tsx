import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  RunDetailSchema,
  RunSnapshotResponseSchema,
  StepRunRecordSchema,
  SubscriptionStateSchema,
  type RunDetail,
  type RunSnapshotResponse,
  type StepRunRecord,
  type StreamFrame,
} from '@easter-workflow-builder/protocol';
import { Breadcrumb, Skeleton, type BreadcrumbAncestor } from '@easter-workflow-builder/ui';
import { useCallback, useEffect, useState, type MouseEvent, type ReactElement } from 'react';
import { CLIENT_ROUTE_TABLE, type ClientRouteId } from '../client-route/client-route-table.ts';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { RunControlBar } from '../run-control/RunControlBar.tsx';
import { RunGraphCanvas } from '../run-graph/RunGraphCanvas.tsx';
import { UnmatchedStepRunList } from '../run-graph/UnmatchedStepRunList.tsx';
import { buildRunGraphNodes } from '../run-graph/build-run-graph-nodes.ts';
import { mergeSnapshotStepRuns } from '../run-graph/merge-snapshot-step-runs.ts';
import { projectSnapshotGraph } from '../run-graph/project-snapshot-graph.ts';
import { RunViewLayout } from './RunViewLayout.tsx';
import { isRunFinishedFrame } from './is-run-finished-frame.ts';
import { readStoredRunViewLayoutSizes, storeRunViewLayoutSizes } from './run-view-layout.ts';
import { useRunViewLayoutBand } from './use-run-view-layout-band.ts';
import './run-view.css';

export interface RunViewScreenProperties {
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
  /**
   * A jelenlegi query string, a kérdőjellel együtt vagy üres sztring: a
   * nézett futás azonosítója ebből jön, `?runId=` alakban (SPEC-008 5.
   * szekció bevezetője).
   */
  readonly search: string;
  readonly navigate: (routeId: ClientRouteId, searchParameters?: string) => void;
  /**
   * Az app szintű, egyetlen SSE kapcsolat azonosítója és utolsó kerete
   * (SPEC-007 9.1). A futás nézet a SAJÁT futására iratkozik fel, mert amíg
   * ez a képernyő áll, a `run-history` képernyő (a másik fogyasztó) nincs
   * felcsatolva.
   */
  readonly streamId: string;
  readonly lastFrame: StreamFrame | undefined;
  readonly streamReplayLimit: number;
}

const STEP_RUN_LIST_SCHEMA = arraySchema(StepRunRecordSchema);

function readRunId(search: string): string | undefined {
  return new URLSearchParams(search).get('runId') ?? undefined;
}

/**
 * Az első hibás állapot üzenete a három párhuzamos betöltés közül, vagy
 * `undefined`, ha egyik sem hibás. Azért egy közös leolvasás, és nem három
 * egymás utáni `if`, mert a felület egyetlen hibaüzenetet mutat: a három
 * végpont ugyanahhoz a futáshoz tartozik, tehát az elsőnek elbukó
 * megnevezése elég.
 */
function firstFailureMessage(states: readonly RequestState<unknown>[]): string | undefined {
  for (const state of states) {
    if (state.status === 'failure') {
      return state.message;
    }
  }
  return undefined;
}

/**
 * Az al-workflow hierarchia morzsasora a `RunDetail.workflowAncestry`
 * listájából (SPEC-008 6.3, AC24). A lista a gyökértől IDÁIG vezető
 * `workflow.id` értékeket hordozza, tehát az UTOLSÓ elem a jelenleg nézett
 * futás workflow-ja (`packages/db` `workflow-run-repository.ts`: a gyerek
 * futás listája a szülő listája plusz a saját `workflowId`), ezért az
 * ősök a lista utolsó eleme NÉLKÜL állnak elő.
 *
 * Minden ős a saját workflow szerkesztőjére mutat (`/editor?workflowId=`),
 * mert a futás azonosítója az ősökre nem ismert: a lista workflow
 * azonosítókat tárol, nem futásokat. A `Breadcrumb` az `href` értéket
 * használja React kulcsként, ami itt egyedi, mert a motor rekurzió védelme
 * kizárja ugyanannak a workflow-nak a kétszeri szerepeltetését (SPEC-003 4.8).
 */
function buildAncestryAncestors(
  workflowAncestry: readonly string[],
  navigate: RunViewScreenProperties['navigate'],
): readonly BreadcrumbAncestor[] {
  return workflowAncestry.slice(0, -1).map((workflowId) => ({
    label: workflowId,
    href: `${CLIENT_ROUTE_TABLE.graphEditor.template}?workflowId=${workflowId}`,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      navigate('graphEditor', `workflowId=${workflowId}`);
    },
  }));
}

interface RunViewHeaderProperties {
  readonly snapshot: RunSnapshotResponse;
  readonly runDetail: RunDetail;
  readonly navigate: RunViewScreenProperties['navigate'];
  readonly apiOrigin: string;
  readonly fetchFunction: FetchFunction;
  readonly onRestarted: (newRunId: string) => void;
}

/**
 * A futás nézet fejléce (SPEC-008 6.2, 6.3, 6.4, 6.5, AC20, AC24, AC25,
 * AC26, AC27): az al-workflow hierarchia morzsasora, a workflow neve, a
 * kimondott figyelmeztetés, hogy a rajz a futás PILLANATKÉPE (a hozzá tartozó
 * `sdkVersionPin` értékkel), és a futás vezérlő sávja (állapot jelvény,
 * megszakítás vagy újraindítás, a futás hibája).
 *
 * A morzsasor saját, egyedi hozzáférhető nevet kap, mert a topnav alatt már
 * áll egy másik morzsasor (az útvonalé), és a W3C APG landmark mintája szerint
 * egy lapon minden `navigation` landmarknak egyedi neve kell
 * (<https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html>).
 */
function RunViewHeader(properties: Readonly<RunViewHeaderProperties>): ReactElement {
  const { snapshot, runDetail, navigate, apiOrigin, fetchFunction, onRestarted } = properties;

  return (
    <header className="run-view-screen__header">
      <Breadcrumb
        label="Al-workflow útvonal"
        ancestors={buildAncestryAncestors(runDetail.workflowAncestry, navigate)}
        current={snapshot.workflow.name}
      />
      <p className="run-view-screen__snapshot-note">
        A rajz a futás pillanatképe, nem a workflow mai gráfja. Agent SDK verzió: {snapshot.sdkVersionPin}
      </p>
      <RunControlBar
        runDetail={runDetail}
        apiOrigin={apiOrigin}
        fetchFunction={fetchFunction}
        onRestarted={onRestarted}
      />
    </header>
  );
}

/**
 * A transcript panel helye az osztott elrendezésben. A panel TARTALMA a
 * PLAN-009 T-009-25 hatóköre (virtualizált lista, automatikus görgetés); ez a
 * lépés az elrendezést állítja fel, tehát a panel egy kimondott, mindig
 * kirajzolódó felirattal áll itt. Elágazás nincs benne: egy "ha még nincs
 * transcript" ág garantáltan mindig ugyanarra futna, ami tiltott halott ág
 * lenne (`.claude/CLAUDE.md` 5. szekció).
 */
function TranscriptPlaceholder(): ReactElement {
  return <p className="run-view-screen__transcript-note">A futás eseményei itt jelennek meg.</p>;
}

/**
 * Az élő futás nézet képernyője (SPEC-008 6. szekció, 10., T-009-20,
 * T-009-22, T-009-23). Három végpontból épül: a futás rekordja
 * (`GET /api/runs/{runId}`) adja az al-workflow hierarchiát és az állapotot, a
 * pillanatkép (`GET /api/runs/{runId}/snapshot`) a rajzot, a lépés futások
 * (`GET /api/runs/{runId}/steps`) pedig a dekorációt.
 *
 * A rajz és a transcript panel a `RunViewLayout` osztott elrendezésében áll,
 * a `useRunViewLayoutBand` hook által kiválasztott reszponzív sáv szerint. Az
 * arány a `localStorage`-be mentődik, és a következő megnyitáskor visszatölt,
 * a gráf szerkesztő már bevált mintája szerint (`run-view-layout.ts`).
 *
 * A FUTÁS VEZÉRLÉSE (T-009-23). A megszakítás és az újraindítás a
 * `RunControlBar` komponensben áll, ez a képernyő a hozzá tartozó ÁLLAPOT
 * frissítését adja: feliratkozik a saját futására az app szintű SSE
 * kapcsolaton, és a `run_finished` keretre újratölti a futás rekordját. Enélkül
 * a "megszakítás folyamatban" állapotot semmi nem zárná le, mert a megszakítás
 * REST válasza még nem a megszakítás befejezése (SPEC-004 9., SPEC-008 6.4).
 * A lépés futások és a rajz ÉLŐ frissülése a T-009-25 és a T-009-30 hatóköre.
 *
 * A futás rekordja azért külön `useState` értékben is áll, nem csak a
 * `useRequestState` állapotában: az újratöltés alatt a kérés `pending`-re
 * vált, és a csontváz visszatérése ilyenkor az egész rajzot villogtatná. A
 * hibaág ellenben VÁLTOZATLAN: egy elbukó betöltés (az első vagy egy
 * újratöltés) a képernyő helyén a hibaüzenetet mutatja, mert a futás
 * rekordjának elérhetetlensége nem elhallgatható.
 */
export function RunViewScreen(properties: Readonly<RunViewScreenProperties>): ReactElement {
  const { apiOrigin, fetchFunction, search, navigate, streamId, lastFrame, streamReplayLimit } = properties;
  const runId = readRunId(search);

  const runState = useRequestState<RunDetail>();
  const snapshotState = useRequestState<RunSnapshotResponse>();
  const stepRunsState = useRequestState<readonly StepRunRecord[]>();
  const [runDetail, setRunDetail] = useState<RunDetail | undefined>(undefined);
  const layoutBand = useRunViewLayoutBand();

  // Az al-workflow futás megnyitása és az újraindítás UGYANERRE a képernyőre
  // navigál, másik `?runId=` paraméterrel (SPEC-008 6.3, 6.5, AC24).
  const navigateToRun = useCallback(
    (targetRunId: string): void => {
      navigate('runView', `runId=${targetRunId}`);
    },
    [navigate],
  );

  const loadRunDetail = useCallback(
    (currentRunId: string): Promise<void> => {
      return runState.run(async () => {
        const outcome = await requestRouteWithoutBody({
          routeId: 'getRun',
          parameters: { runId: currentRunId },
          responseSchema: RunDetailSchema,
          fetchFunction,
          apiOrigin,
        });
        if (outcome.kind === 'ok') {
          setRunDetail(outcome.value);
        }
        return outcome;
      });
    },
    [runState.run, fetchFunction, apiOrigin],
  );

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    void loadRunDetail(runId);
    void snapshotState.run(() =>
      requestRouteWithoutBody({
        routeId: 'readRunSnapshot',
        parameters: { runId },
        responseSchema: RunSnapshotResponseSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
    void stepRunsState.run(() =>
      requestRouteWithoutBody({
        routeId: 'listStepRuns',
        parameters: { runId },
        responseSchema: STEP_RUN_LIST_SCHEMA,
        fetchFunction,
        apiOrigin,
      }),
    );
    // A `run` hívások szándékosan nincsenek a dependency listán, ugyanabból az
    // okból, mint a `GraphEditorScreen`-ben: a `useRequestState` saját
    // `useCallback`-je stabil, de a hívó oldali objektum nem az, és a projekt
    // ESLint konfigurációja nem tartalmazza a `react-hooks/exhaustive-deps`
    // szabályt.
  }, [runId, apiOrigin, fetchFunction]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    // A stream feliratkozás a NÉZETT futásra szűkül, állapottól függetlenül: a
    // pótlás (`fromEventId: 0`) a már lezárt futásnál is a teljes előzményt
    // adja, ami a transcript panel bemenete lesz (T-009-25). Egy állapot
    // szerinti elágazás itt csak sosem futó ágat szülne.
    void requestRoute({
      routeId: 'replaceStreamSubscriptions',
      parameters: { streamId },
      body: { runs: [{ runId, fromEventId: 0, replayLimit: streamReplayLimit }] },
      responseSchema: SubscriptionStateSchema,
      fetchFunction,
      apiOrigin,
    });
  }, [runId, streamId, streamReplayLimit, fetchFunction, apiOrigin]);

  useEffect(() => {
    if (runId === undefined || !isRunFinishedFrame(lastFrame, runId)) {
      return;
    }
    void loadRunDetail(runId);
  }, [runId, lastFrame, loadRunDetail]);

  if (runId === undefined) {
    return <p role="alert">Nincs megadva megtekintendő futás (hiányzó "runId" query paraméter).</p>;
  }

  const failureMessage = firstFailureMessage([runState.state, snapshotState.state, stepRunsState.state]);
  if (failureMessage !== undefined) {
    return <p role="alert">{failureMessage}</p>;
  }

  if (runDetail === undefined || snapshotState.state.status !== 'success' || stepRunsState.state.status !== 'success') {
    // Várakozás jelzése: a betöltés alatt csontváz áll, nem üres képernyő
    // (`.claude/CLAUDE.md` 11. szekció).
    return (
      <div className="run-view-screen__loading" role="status">
        <Skeleton shape="text" lines={4} />
      </div>
    );
  }

  const snapshot = snapshotState.state.value;
  const projected = projectSnapshotGraph(snapshot);
  if (projected.kind === 'error') {
    return <p role="alert">{projected.message}</p>;
  }

  const stepRuns = stepRunsState.state.value;
  const merged = mergeSnapshotStepRuns(projected.value.nodes, stepRuns);
  const graphNodes = buildRunGraphNodes({
    nodes: projected.value.nodes,
    nodeStepRuns: merged.nodeStepRuns,
    stepRuns,
    onOpenSubWorkflowRun: navigateToRun,
  });

  return (
    <div className="run-view-screen">
      <RunViewHeader
        snapshot={snapshot}
        runDetail={runDetail}
        navigate={navigate}
        apiOrigin={apiOrigin}
        fetchFunction={fetchFunction}
        onRestarted={navigateToRun}
      />
      <div className="run-view-screen__body">
        <RunViewLayout
          band={layoutBand}
          graph={<RunGraphCanvas nodes={graphNodes} edges={projected.value.edges} />}
          transcript={<TranscriptPlaceholder />}
          // A tárolt arány MINDEN renderen újraolvasódik, nem egyszer,
          // csatoláskor: a `Resizable` a fül sávba váltáskor LESZEREL, és
          // visszaváltáskor a `defaultSizes` propból épül újra a kezdő
          // állapota. Egy csatoláskor beolvasott, `useState`-ben tartott érték
          // ilyenkor a kézzel húzott arányt eldobná (a T-009-22 független
          // ellenőrzésének él esete). A `localStorage` olvasás a
          // `readStoredRunViewLayoutSizes` saját `try`/`catch` ágán megy, és a
          // képernyő nem renderel újra húzás közben, tehát az olvasás nem
          // kerül forró útra.
          defaultSizes={readStoredRunViewLayoutSizes()}
          onSizesChange={storeRunViewLayoutSizes}
        />
      </div>
      {merged.unmatchedStepRuns.length > 0 && <UnmatchedStepRunList stepRuns={merged.unmatchedStepRuns} />}
    </div>
  );
}
