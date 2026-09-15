import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  RunDetailSchema,
  RunSnapshotResponseSchema,
  StepRunRecordSchema,
  type RunDetail,
  type RunSnapshotResponse,
  type StepRunRecord,
} from '@easter-workflow-builder/protocol';
import { Breadcrumb, Skeleton, type BreadcrumbAncestor } from '@easter-workflow-builder/ui';
import { useEffect, type MouseEvent, type ReactElement } from 'react';
import { CLIENT_ROUTE_TABLE, type ClientRouteId } from '../client-route/client-route-table.ts';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { RunGraphCanvas } from '../run-graph/RunGraphCanvas.tsx';
import { UnmatchedStepRunList } from '../run-graph/UnmatchedStepRunList.tsx';
import { buildRunGraphNodes } from '../run-graph/build-run-graph-nodes.ts';
import { mergeSnapshotStepRuns } from '../run-graph/merge-snapshot-step-runs.ts';
import { projectSnapshotGraph } from '../run-graph/project-snapshot-graph.ts';
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
}

/**
 * A futás nézet fejléce (SPEC-008 6.2, 6.3, AC20, AC24): az al-workflow
 * hierarchia morzsasora, a workflow neve, és a kimondott figyelmeztetés, hogy
 * a rajz a futás PILLANATKÉPE, a hozzá tartozó `sdkVersionPin` értékkel.
 *
 * A morzsasor saját, egyedi hozzáférhető nevet kap, mert a topnav alatt már
 * áll egy másik morzsasor (az útvonalé), és a W3C APG landmark mintája szerint
 * egy lapon minden `navigation` landmarknak egyedi neve kell
 * (<https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html>).
 */
function RunViewHeader(properties: Readonly<RunViewHeaderProperties>): ReactElement {
  const { snapshot, runDetail, navigate } = properties;

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
    </header>
  );
}

/**
 * Az élő futás nézet képernyője (SPEC-008 6. szekció, T-009-20). Három
 * végpontból épül: a futás rekordja (`GET /api/runs/{runId}`) adja az
 * al-workflow hierarchiát, a pillanatkép (`GET /api/runs/{runId}/snapshot`) a
 * rajzot, a lépés futások (`GET /api/runs/{runId}/steps`) pedig a dekorációt.
 *
 * Az osztott elrendezés, a három reszponzív sáv és a futás vezérlése a
 * PLAN-009 T-009-22 és T-009-23 lépésének hatóköre; ez a lépés a rajzot és a
 * fejlécet állítja fel.
 */
export function RunViewScreen(properties: Readonly<RunViewScreenProperties>): ReactElement {
  const { apiOrigin, fetchFunction, search, navigate } = properties;
  const runId = readRunId(search);

  const runState = useRequestState<RunDetail>();
  const snapshotState = useRequestState<RunSnapshotResponse>();
  const stepRunsState = useRequestState<readonly StepRunRecord[]>();

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    void runState.run(() =>
      requestRouteWithoutBody({
        routeId: 'getRun',
        parameters: { runId },
        responseSchema: RunDetailSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
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

  if (runId === undefined) {
    return <p role="alert">Nincs megadva megtekintendő futás (hiányzó "runId" query paraméter).</p>;
  }

  const failureMessage = firstFailureMessage([runState.state, snapshotState.state, stepRunsState.state]);
  if (failureMessage !== undefined) {
    return <p role="alert">{failureMessage}</p>;
  }

  if (
    runState.state.status !== 'success' ||
    snapshotState.state.status !== 'success' ||
    stepRunsState.state.status !== 'success'
  ) {
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
  const graphNodes = buildRunGraphNodes(projected.value.nodes, merged.nodeStepRuns);

  return (
    <div className="run-view-screen">
      <RunViewHeader snapshot={snapshot} runDetail={runState.state.value} navigate={navigate} />
      <RunGraphCanvas nodes={graphNodes} edges={projected.value.edges} />
      {merged.unmatchedStepRuns.length > 0 && <UnmatchedStepRunList stepRuns={merged.unmatchedStepRuns} />}
    </div>
  );
}
