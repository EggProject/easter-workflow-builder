import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  InterruptSummaryResponseSchema,
  RunSummarySchema,
  StartedRunResponseSchema,
  SubscriptionStateSchema,
  WorkflowSummarySchema,
  type RunStatus,
  type RunSummary,
  type StreamFrame,
  type WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import {
  Badge,
  DataTable,
  ProgressBar,
  Skeleton,
  Tabs,
  ToastViewport,
  useToasts,
  type DataTableColumn,
} from '@easter-workflow-builder/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { describeRunStatusBadge } from './run-status-badge.ts';

export interface RunHistoryScreenProperties {
  readonly apiOrigin: string;
  readonly listLimit: number;
  readonly streamReplayLimit: number;
  readonly fetchFunction: FetchFunction;
  /**
   * A jelenlegi query string, a kérdőjellel együtt vagy üres sztring
   * (`useClientRoute` `search` mezője).
   */
  readonly search: string;
  /**
   * Az app szintű, egyetlen SSE kapcsolat azonosítója és utolsó kerete
   * (SPEC-007 9.1): ez a képernyő az egyetlen fogyasztója.
   */
  readonly streamId: string;
  readonly lastFrame: StreamFrame | undefined;
}

const NON_CLOSED_STATUSES: ReadonlySet<RunStatus> = new Set(['pending', 'running']);
const RELOAD_TRIGGERING_FRAME_EVENTS: ReadonlySet<StreamFrame['event']> = new Set([
  'run_event',
  'run_event_transient',
  'replay_complete',
]);

function formatTimestamp(ms: number | null): string {
  // Nagykötőjel (en dash), NEM gondolatjel (em dash) - a gyökér CLAUDE.md 6.
  // szekciója a gondolatjelet kivétel nélkül tiltja.
  return ms === null ? '–' : new Date(ms).toLocaleString('hu-HU');
}

function readWorkflowIdFilter(search: string): string | undefined {
  return new URLSearchParams(search).get('workflowId') ?? undefined;
}

/**
 * A futás előzmények képernyő (`/runs`, SPEC-007 10.2). A fülek, a tábla, a
 * két soronkénti művelet, és az élő állapot feliratkozás egyetlen
 * komponensben, mert mindegyik ugyanazt a listaadatot forgatja.
 */
export function RunHistoryScreen(properties: Readonly<RunHistoryScreenProperties>): ReactElement {
  const { apiOrigin, listLimit, streamReplayLimit, fetchFunction, search, streamId, lastFrame } = properties;
  const workflowIdFilter = readWorkflowIdFilter(search);

  const [activeTabId, setActiveTabId] = useState<string>(workflowIdFilter === undefined ? 'all' : 'workflow');
  useEffect(() => {
    setActiveTabId(workflowIdFilter === undefined ? 'all' : 'workflow');
  }, [workflowIdFilter]);

  const runsRequest = useRequestState<readonly RunSummary[]>();
  const [lastRuns, setLastRuns] = useState<readonly RunSummary[] | undefined>(undefined);
  const workflowsRequest = useRequestState<readonly WorkflowSummary[]>();
  const [pendingActionRunId, setPendingActionRunId] = useState<string | undefined>(undefined);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const isWorkflowScoped = activeTabId === 'workflow' && workflowIdFilter !== undefined;

  const loadRuns = useCallback(() => {
    return runsRequest.run(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listRuns',
        query: isWorkflowScoped
          ? { limit: String(listLimit), workflowId: workflowIdFilter }
          : { limit: String(listLimit) },
        responseSchema: arraySchema(RunSummarySchema),
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLastRuns(outcome.value);
      }
      return outcome;
    });
  }, [runsRequest.run, listLimit, fetchFunction, apiOrigin, isWorkflowScoped, workflowIdFilter]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (lastFrame === undefined) {
      return;
    }
    if (RELOAD_TRIGGERING_FRAME_EVENTS.has(lastFrame.event)) {
      void loadRuns();
    }
  }, [lastFrame, loadRuns]);

  useEffect(() => {
    void workflowsRequest.run(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listWorkflows',
        query: { limit: String(listLimit) },
        responseSchema: arraySchema(WorkflowSummarySchema),
        fetchFunction,
        apiOrigin,
      });
      return outcome;
    });
    // A workflow lista csak egyszer, csatoláskor tölt: a workflow-workflowId
    // párosítás nem függ a futás listától vagy a fülváltástól.
  }, []);

  const rows = runsRequest.state.status === 'success' ? runsRequest.state.value : (lastRuns ?? []);
  const isFirstLoad = lastRuns === undefined && runsRequest.state.status !== 'failure';
  const isReloading = runsRequest.state.status === 'pending' && lastRuns !== undefined;

  const workflowNamesById =
    workflowsRequest.state.status === 'success'
      ? new Map(workflowsRequest.state.value.map((workflow) => [workflow.id, workflow.name]))
      : new Map<string, string>();

  const nonClosedRunIds = rows.filter((run) => NON_CLOSED_STATUSES.has(run.status)).map((run) => run.id);
  const subscriptionKey = nonClosedRunIds.join(',');

  useEffect(() => {
    void requestRoute({
      routeId: 'replaceStreamSubscriptions',
      parameters: { streamId },
      body: {
        runs: nonClosedRunIds.map((runId) => ({ runId, fromEventId: 0, replayLimit: streamReplayLimit })),
      },
      responseSchema: SubscriptionStateSchema,
      fetchFunction,
      apiOrigin,
    });
    // A nonClosedRunIds tömb minden renderben új referencia; a
    // subscriptionKey a tartalmának stabil, összehasonlítható lenyomata,
    // ezért ez a dependency, nem maga a tömb.
  }, [streamId, subscriptionKey, streamReplayLimit, fetchFunction, apiOrigin]);

  function handleInterrupt(run: RunSummary): void {
    setPendingActionRunId(run.id);
    void (async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'interruptRun',
        parameters: { runId: run.id },
        responseSchema: InterruptSummaryResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      setPendingActionRunId(undefined);
      if (outcome.kind === 'ok') {
        pushToast({ variant: 'success', title: 'Futás megszakítva', message: run.id });
        void loadRuns();
        return;
      }
      pushToast({ variant: 'danger', title: 'A megszakítás sikertelen', message: outcome.message });
    })();
  }

  function handleRestart(run: RunSummary): void {
    setPendingActionRunId(run.id);
    void (async () => {
      const outcome = await requestRoute({
        routeId: 'restartRun',
        parameters: { runId: run.id },
        body: {},
        responseSchema: StartedRunResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      setPendingActionRunId(undefined);
      if (outcome.kind === 'ok') {
        pushToast({ variant: 'success', title: 'Futás újraindítva', message: run.id });
        void loadRuns();
        return;
      }
      pushToast({ variant: 'danger', title: 'Az újraindítás sikertelen', message: outcome.message });
    })();
  }

  const columns: readonly DataTableColumn<RunSummary>[] = [
    {
      id: 'id',
      header: 'Azonosító',
      value: (row) => row.id,
      mono: true,
      // Mobil szélességen a futás azonosító elveszi a helyet a workflow
      // névtől, az állapottól és a művelet gombtól; mérés szerint nélküle
      // fér el a "Megszakítás" gomb 320px-en (SPEC-007 5.3).
      tertiary: true,
    },
    {
      id: 'workflowName',
      header: 'Workflow',
      value: (row) => workflowNamesById.get(row.workflowId) ?? row.workflowId,
    },
    {
      id: 'status',
      header: 'Állapot',
      value: (row) => describeRunStatusBadge(row.status).label,
      cell: (row) => {
        const descriptor = describeRunStatusBadge(row.status);
        return <Badge variant={descriptor.variant}>{descriptor.label}</Badge>;
      },
    },
    {
      id: 'startedAtMs',
      header: 'Indult',
      value: (row) => formatTimestamp(row.startedAtMs),
      mono: true,
      secondary: true,
    },
    {
      id: 'finishedAtMs',
      header: 'Befejezve',
      value: (row) => formatTimestamp(row.finishedAtMs),
      mono: true,
      secondary: true,
    },
    {
      id: 'actions',
      header: 'Műveletek',
      sortable: false,
      value: () => '',
      cell: (row) => {
        const isBusy = pendingActionRunId === row.id;
        // A hat állapot két, egymást kizáró csoportra oszlik (a
        // NON_CLOSED_STATUSES és a CLOSED_STATUSES együtt fedi mind a
        // hatot): a ternary emiatt kimerítő, harmadik ág nélkül.
        const isInterruptible = row.status === 'pending' || row.status === 'running';
        return isInterruptible ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              handleInterrupt(row);
            }}
          >
            {isBusy ? 'Megszakítás...' : 'Megszakítás'}
          </button>
        ) : (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              handleRestart(row);
            }}
          >
            {isBusy ? 'Újraindítás...' : 'Újraindítás'}
          </button>
        );
      },
    },
  ];

  const tabItems =
    workflowIdFilter === undefined
      ? [{ id: 'all', label: 'Minden futás' }]
      : [
          { id: 'all', label: 'Minden futás' },
          { id: 'workflow', label: 'Egy workflow futásai' },
        ];

  return (
    <div>
      <Tabs items={tabItems} active={activeTabId} onChange={setActiveTabId} aria-label="Futás lista fülek" />
      {isReloading && <ProgressBar isLabelVisible={false} ariaLabel="a lista frissítése folyamatban" value={100} />}
      {isFirstLoad ? (
        <Skeleton shape="text" lines={4} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          label="Futások"
          emptyLabel="Még nincs futás."
        />
      )}
      {runsRequest.state.status === 'failure' && <p role="alert">{runsRequest.state.message}</p>}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
