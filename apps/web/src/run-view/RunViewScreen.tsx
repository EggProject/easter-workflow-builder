import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  RunDetailSchema,
  RunSnapshotResponseSchema,
  SubscriptionStateSchema,
  type RunDetail,
  type RunSnapshotResponse,
} from '@easter-workflow-builder/protocol';
import { Alert, Breadcrumb, type BreadcrumbAncestor } from '@easter-workflow-builder/ui';
import { useCallback, useEffect, useState, type MouseEvent, type ReactElement } from 'react';
import { ApprovalPromptPanel } from '../approval-prompt/ApprovalPromptPanel.tsx';
import { pendingApprovalRequestedAtByStepRun } from '../approval-prompt/pending-approval-requested-at-by-step-run.ts';
import { useApprovalDecisions } from '../approval-prompt/use-approval-decisions.ts';
import { usePendingApprovals } from '../approval-prompt/use-pending-approvals.ts';
import { CLIENT_ROUTE_TABLE, type ClientRouteId } from '../client-route/client-route-table.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { RouteFailure } from '../rest-client/route-outcome.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { RunControlBar } from '../run-control/RunControlBar.tsx';
import { RunGraphCanvas } from '../run-graph/RunGraphCanvas.tsx';
import { UnmatchedStepRunList } from '../run-graph/UnmatchedStepRunList.tsx';
import { buildRunGraphNodes } from '../run-graph/build-run-graph-nodes.ts';
import { mergeSnapshotStepRuns } from '../run-graph/merge-snapshot-step-runs.ts';
import { projectSnapshotGraph } from '../run-graph/project-snapshot-graph.ts';
import type { SubscribeToStreamFrames } from '../stream-client/subscribe-to-stream-frames.ts';
import { TranscriptPanel } from '../transcript-panel/TranscriptPanel.tsx';
import { useRunTranscript } from '../transcript-panel/use-run-transcript.ts';
import { RunViewLayout } from './RunViewLayout.tsx';
import { blockingFailureMessage } from './blocking-failure-message.ts';
import { isRunClosingFrame } from './is-run-closing-frame.ts';
import { readStoredRunViewLayoutSizes, storeRunViewLayoutSizes } from './run-view-layout.ts';
import { useLiveStepRuns } from './use-live-step-runs.ts';
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
   * Az app szintű, egyetlen SSE kapcsolat azonosítója (SPEC-007 9.1). A
   * futás nézet a SAJÁT futására iratkozik fel, mert amíg ez a képernyő áll,
   * a `run-history` képernyő (a másik fogyasztó) nincs felcsatolva.
   */
  readonly streamId: string;
  /**
   * Az app szintű SSE kapcsolat veszteségmentes keret feliratkozása: a
   * transcript panel, a csomópontok élő állapota és a futás lezárásának
   * felismerése is minden keretet ezen kap, egyenként
   * (`stream-client/subscribe-to-stream-frames.ts`, T-009-25, T-009-25a).
   */
  readonly subscribeToFrames: SubscribeToStreamFrames;
  readonly streamReplayLimit: number;
  /**
   * Hányszor váltott a szerver példány azonosítója (`stream_ready` keret,
   * SPEC-007 9.2, 16. szekció 44. kritérium). A szerver a feliratkozásokat
   * memóriában tartja, tehát egy újraindulás után a futás nézet újra
   * feliratkozik, és újratölti a futást és a lépéseket (SPEC-005 5.2).
   */
  readonly serverRestartCount: number;
}

function readRunId(search: string): string | undefined {
  return new URLSearchParams(search).get('runId') ?? undefined;
}

/**
 * A futás rekordjának utolsó sikeres betöltése és a legutóbbi betöltés hibája.
 * Egyetlen állapotban áll, a `useLiveStepRuns` mintájára: egy sikeres
 * betöltés a hibát is törli, egy hibás pedig a korábbi rekordot a helyén
 * hagyja.
 */
interface RunDetailLoad {
  readonly runDetail: RunDetail | undefined;
  readonly failure: RouteFailure | undefined;
}

const EMPTY_RUN_DETAIL_LOAD: RunDetailLoad = { runDetail: undefined, failure: undefined };

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
  readonly hasPendingApproval: boolean;
}

/**
 * A futás nézet fejléce (SPEC-008 6.2, 6.3, 6.4, 6.5, AC20, AC24, AC25,
 * AC26, AC27): az al-workflow hierarchia morzsasora, a workflow neve, a
 * kimondott figyelmeztetés, hogy a rajz a futás PILLANATKÉPE (a hozzá tartozó
 * `sdkVersionPin` értékkel), és a futás vezérlő sávja (állapot jelvény, a
 * függő jóváhagyás jelvénye, megszakítás vagy újraindítás, a futás hibája).
 *
 * A morzsasor saját, egyedi hozzáférhető nevet kap, mert a topnav alatt már
 * áll egy másik morzsasor (az útvonalé), és a W3C APG landmark mintája szerint
 * egy lapon minden `navigation` landmarknak egyedi neve kell
 * (<https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/examples/navigation.html>).
 */
function RunViewHeader(properties: Readonly<RunViewHeaderProperties>): ReactElement {
  const { snapshot, runDetail, navigate, apiOrigin, fetchFunction, onRestarted, hasPendingApproval } = properties;

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
        hasPendingApproval={hasPendingApproval}
      />
    </header>
  );
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
 * kapcsolaton, és minden, a futást lezáró keretre (`run_finished`,
 * `run_interrupted`, `is-run-closing-frame.ts`) újratölti a futás rekordját.
 * Enélkül a "megszakítás folyamatban" állapotot semmi nem zárná le, mert a
 * megszakítás REST válasza még nem a megszakítás befejezése (SPEC-004 9.,
 * SPEC-008 6.4), a szabályos leállás `run_interrupted` kerete után pedig az
 * "Újraindítás" gomb nem jelenne meg (SPEC-004 10.2). A keret a
 * veszteségmentes `subscribeToFrames` úton jön (T-009-25a): a szerver a
 * pótlás végén szinkron küldi a `replay_complete` keretet, tehát a lezáró
 * keret gyakran nem a löket UTOLSÓ kerete.
 *
 * SZERVER ÚJRAINDULÁS (SPEC-005 5.2, SPEC-007 AC44). A `serverRestartCount`
 * változására a képernyő újra kiadja a feliratkozást (a szerver a
 * feliratkozásokat memóriában tartja, tehát az újraindulással elvesztek), és
 * újratölti a futás rekordját és a lépés futásokat. A pillanatkép nem töltődik
 * újra, mert megváltoztathatatlan (SPEC-003 5.5).
 *
 * A TRANSCRIPT (T-009-25) a stream kereteiből épül, a `useRunTranscript`
 * hookkal, ami a betöltési ágak ELŐTT, a képernyő legelején iratkozik fel,
 * hogy a pótlás egyetlen kerete se érkezzen feliratkozó nélkül. A panel a
 * `TranscriptPanel`.
 *
 * A CSOMÓPONTOK ÉLŐ ÁLLAPOTA (T-009-25a) a `useLiveStepRuns` hookból jön: a
 * lépés futás lista a megnyitáskor betöltődik, majd minden jelző keretre
 * összevont újratöltéssel frissül, oldal újratöltés nélkül.
 *
 * A JÓVÁHAGYÁS (T-009-27, SPEC-008 8. szekció) három helyen látszik: a
 * fejléc vezérlő sávjában egy jelvény, a csomóponton a várakozás kezdete, és
 * a transcript sávban, a transcript fölött a döntési panel. Egyik sem a
 * vászon fölött áll, tehát a vászon magassága nem függ a jóváhagyások
 * számától (PLAN-009 5. szekció F6 sora). A lista a `usePendingApprovals`
 * hookból élőben frissül, a döntések állapota a `useApprovalDecisions`
 * hookban él; mindkettő itt, a képernyő szintjén, mert a transcript sáv a
 * reszponzív sáv váltásakor újra felcsatolódik.
 *
 * A futás rekordja saját `useState` értékben áll, nem `useRequestState`
 * állapotban: az újratöltés alatt egy `pending` állapot a csontvázat hozná
 * vissza, és az az egész rajzot villogtatná.
 *
 * ÁTMENETI HIBA ÚJRATÖLTÉSKOR (a szerver leállása). A szabályos leállás
 * `run_interrupted` kerete még a nyitott SSE kapcsolaton érkezik, de a rá
 * indított újratöltést a szerver már nem fogadja (a fejlesztői Vite proxy
 * 502-t ad). Ha a futás rekordjának vagy a lépés futásoknak az újratöltése
 * ÁTMENETI hibával bukik (`RouteFailure.isTransient`: hálózati hiba, 502,
 * 503), és van korábbi sikeres betöltés, az utolsó ismert rajz és transcript
 * a helyén marad, fölötte pedig figyelmeztetés jelzi a szerverre várakozást;
 * a szerver újraindulása (`serverRestartCount`) utáni újratöltés hozza
 * helyre. A döntés a HTTP válaszon áll, nem a stream fázisán: a fázis azt
 * mondja meg, hogy az SSE kapcsolat él-e, azt nem, hogy az adott hiba
 * átmeneti-e (egy 404 vagy 500 újracsatlakozás alatt sem az), és a hibás
 * válasz meg a kapcsolat bontása közti sorrend a leállás lefolyásától függ,
 * nem garantált. Minden más hiba, és az átmeneti hiba is, ha nincs mit
 * helyette mutatni, a képernyő helyén jelenik meg
 * (`blocking-failure-message.ts`). Ha a szerver nem jön vissza, a
 * figyelmeztetés marad, tehát a felület nem válik csendessé.
 */
export function RunViewScreen(properties: Readonly<RunViewScreenProperties>): ReactElement {
  const {
    apiOrigin,
    fetchFunction,
    search,
    navigate,
    streamId,
    subscribeToFrames,
    streamReplayLimit,
    serverRestartCount,
  } = properties;
  const runId = readRunId(search);
  const transcript = useRunTranscript(runId, subscribeToFrames);
  const liveStepRuns = useLiveStepRuns({ runId, subscribeToFrames, fetchFunction, apiOrigin, serverRestartCount });
  const pendingApprovals = usePendingApprovals({ runId, subscribeToFrames, fetchFunction, apiOrigin });
  const listedApprovals = pendingApprovals.approvals ?? [];
  const approvalDecisions = useApprovalDecisions({
    runId,
    approvals: listedApprovals,
    fetchFunction,
    apiOrigin,
    onDecided: pendingApprovals.reload,
  });

  const snapshotState = useRequestState<RunSnapshotResponse>();
  const [runDetailLoad, setRunDetailLoad] = useState<RunDetailLoad>(EMPTY_RUN_DETAIL_LOAD);
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
    async (currentRunId: string): Promise<void> => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'getRun',
        parameters: { runId: currentRunId },
        responseSchema: RunDetailSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setRunDetailLoad({ runDetail: outcome.value, failure: undefined });
        return;
      }
      setRunDetailLoad((previous) => ({ ...previous, failure: outcome }));
    },
    [fetchFunction, apiOrigin],
  );

  // Másik futásra váltáskor a korábbi futás rekordja és hibája törlődik, hogy
  // egy átmeneti hiba mellett ne a RÉGI futás rekordja álljon az új futás
  // rajza fölött (a `useLiveStepRuns` azonos mintája).
  useEffect(() => {
    setRunDetailLoad(EMPTY_RUN_DETAIL_LOAD);
  }, [runId]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    void loadRunDetail(runId);
    // A `serverRestartCount` szándékosan dependency, holott a törzs nem
    // olvassa: a szerver újraindulása ugyanazt a betöltést váltja ki, mint a
    // csatolás, elágazás nélkül (a `run-history-screen.tsx` mintája).
  }, [runId, loadRunDetail, serverRestartCount]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    void snapshotState.run(() =>
      requestRouteWithoutBody({
        routeId: 'readRunSnapshot',
        parameters: { runId },
        responseSchema: RunSnapshotResponseSchema,
        fetchFunction,
        apiOrigin,
      }),
    );
    // A `snapshotState.run` szándékosan nincs a dependency listán, ugyanabból az
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
    //
    // A `serverRestartCount` szándékosan dependency, holott a törzs nem
    // olvassa: a szerver a feliratkozásokat memóriában tartja, tehát az
    // újraindulás után a feliratkozást újra ki kell adni (SPEC-005 5.2). A
    // pótlás ekkor is `fromEventId: 0`-tól megy, a transcript kurzora
    // (`reduce-run-transcript-frame.ts`, `afterEventId`) a már látott
    // kereteket eldobja.
    void requestRoute({
      routeId: 'replaceStreamSubscriptions',
      parameters: { streamId },
      body: { runs: [{ runId, fromEventId: 0, replayLimit: streamReplayLimit }] },
      responseSchema: SubscriptionStateSchema,
      fetchFunction,
      apiOrigin,
    });
  }, [runId, streamId, streamReplayLimit, fetchFunction, apiOrigin, serverRestartCount]);

  useEffect(() => {
    if (runId === undefined) {
      return;
    }
    return subscribeToFrames((frame) => {
      if (isRunClosingFrame(frame, runId)) {
        void loadRunDetail(runId);
      }
    });
  }, [runId, subscribeToFrames, loadRunDetail]);

  if (runId === undefined) {
    return <p role="alert">Nincs megadva megtekintendő futás (hiányzó "runId" query paraméter).</p>;
  }

  const { runDetail, failure: runDetailFailure } = runDetailLoad;
  const { stepRuns, failure: stepRunsFailure } = liveStepRuns;
  // A sorrend a három végpont sorrendje: a felület egyetlen hibaüzenetet
  // mutat, és a végpontok ugyanahhoz a futáshoz tartoznak, tehát az elsőnek
  // elbukó megnevezése elég. A pillanatkép nem töltődik újra (SPEC-003 5.5),
  // tehát a hibájának sosincs korábbi értéke, ami helyette látszhatna.
  const blockingMessage =
    blockingFailureMessage(runDetailFailure, runDetail !== undefined) ??
    (snapshotState.state.status === 'failure' ? snapshotState.state.message : undefined) ??
    blockingFailureMessage(stepRunsFailure, stepRuns !== undefined);
  if (blockingMessage !== undefined) {
    return <p role="alert">{blockingMessage}</p>;
  }

  if (runDetail === undefined || stepRuns === undefined || snapshotState.state.status !== 'success') {
    // Várakozás jelzése: a betöltés alatt csontváz áll, nem üres képernyő
    // (`.claude/CLAUDE.md` 11. szekció).
    return (
      <div className="run-view-screen__loading" role="status">
        <ThemedSkeleton shape="text" lines={4} />
      </div>
    );
  }

  const snapshot = snapshotState.state.value;
  const projected = projectSnapshotGraph(snapshot);
  if (projected.kind === 'error') {
    return <p role="alert">{projected.message}</p>;
  }

  const merged = mergeSnapshotStepRuns(projected.value.nodes, stepRuns);
  const graphNodes = buildRunGraphNodes({
    nodes: projected.value.nodes,
    nodeStepRuns: merged.nodeStepRuns,
    stepRuns,
    onOpenSubWorkflowRun: navigateToRun,
    pendingApprovalRequestedAtByStepRunId: pendingApprovalRequestedAtByStepRun(listedApprovals),
  });
  // Ide csak átmeneti, korábbi értékkel rendelkező hiba juthat el: minden más
  // a fenti blokkoló ágon áll meg.
  const transientFailure = runDetailFailure ?? stepRunsFailure;

  return (
    <div className="run-view-screen">
      <RunViewHeader
        snapshot={snapshot}
        runDetail={runDetail}
        navigate={navigate}
        apiOrigin={apiOrigin}
        fetchFunction={fetchFunction}
        onRestarted={navigateToRun}
        hasPendingApproval={listedApprovals.length > 0}
      />
      {transientFailure !== undefined && (
        // Várakozás jelzése (`.claude/CLAUDE.md` 11. szekció): a design system
        // kész, tartós állapotjelző `Alert` blokkja, `role="status"` szereppel.
        <Alert variant="warning" title="Várakozás a szerverre" className="run-view-screen__server-wait">
          Az utolsó ismert állapot látszik, a szerver újraindulása után a nézet magától frissül. A legutóbbi frissítés
          hibája: {transientFailure.message}
        </Alert>
      )}
      <div className="run-view-screen__body">
        <RunViewLayout
          band={layoutBand}
          graph={<RunGraphCanvas nodes={graphNodes} edges={projected.value.edges} />}
          // A jóváhagyás panel a transcript sávban, a transcript FÖLÖTT áll
          // (PLAN-009 5. szekció F6: "a transcript mellé"); a kettő a sávot
          // a `run-view.css` szabálya szerint osztja meg. A `key` a futás
          // azonosítója: egy másik futásra navigálva a transcript panel (és a
          // görgetés állapota) tiszta lappal indul.
          transcript={
            <>
              <ApprovalPromptPanel
                isFirstLoadPending={
                  pendingApprovals.approvals === undefined && pendingApprovals.failureMessage === undefined
                }
                failureMessage={pendingApprovals.failureMessage}
                displayed={approvalDecisions.displayed}
                onDecide={approvalDecisions.decide}
                onDismiss={approvalDecisions.dismiss}
              />
              <TranscriptPanel
                key={runId}
                transcript={transcript}
                stepRuns={stepRuns}
                runStatus={runDetail.status}
                persistedStreamDeltas={runDetail.persistedStreamDeltas}
              />
            </>
          }
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
