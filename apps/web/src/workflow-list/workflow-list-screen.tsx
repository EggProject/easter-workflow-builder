import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  StartedRunResponseSchema,
  WorkflowSummarySchema,
  type WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import {
  Button,
  DataTable,
  ProgressBar,
  Skeleton,
  ToastViewport,
  useToasts,
  type DataTableColumn,
} from '@easter-workflow-builder/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import type { ClientRouteId } from '../client-route/client-route-table.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { requestRoute } from '../rest-client/request-route.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { CreateWorkflowModal } from './create-workflow-modal.tsx';
import { DeleteWorkflowModal } from './delete-workflow-modal.tsx';
import { RenameWorkflowModal } from './rename-workflow-modal.tsx';

export interface WorkflowListScreenProperties {
  readonly apiOrigin: string;
  readonly listLimit: number;
  readonly fetchFunction: FetchFunction;
  readonly navigate: (routeId: ClientRouteId) => void;
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('hu-HU');
}

/**
 * A workflow lista képernyő (`/`, SPEC-007 10.1). A tábla első betöltése
 * `Skeleton` sorral, minden ezt követő újratöltés a régi sorokat megtartva
 * `ProgressBar`-ral jelez (11. szekció 2. és 3. async pont).
 */
export function WorkflowListScreen(properties: Readonly<WorkflowListScreenProperties>): ReactElement {
  const { apiOrigin, listLimit, fetchFunction, navigate } = properties;

  const workflowsRequest = useRequestState<readonly WorkflowSummary[]>();
  const [lastWorkflows, setLastWorkflows] = useState<readonly WorkflowSummary[] | undefined>(undefined);
  const [workflowToRename, setWorkflowToRename] = useState<WorkflowSummary | undefined>(undefined);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowSummary | undefined>(undefined);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [startingRunWorkflowId, setStartingRunWorkflowId] = useState<string | undefined>(undefined);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToasts();

  const loadWorkflows = useCallback(() => {
    return workflowsRequest.run(async () => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'listWorkflows',
        query: { limit: String(listLimit) },
        responseSchema: arraySchema(WorkflowSummarySchema),
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setLastWorkflows(outcome.value);
      }
      return outcome;
    });
  }, [workflowsRequest.run, listLimit, fetchFunction, apiOrigin]);

  useEffect(() => {
    // Csak az első csatoláskor fut: a képernyő élettartama alatt egyszer
    // kell automatikusan induljon, a további hívásokat a felhasználói
    // művelet (létrehozás, átnevezés, törlés, indítás) váltja ki.
    void loadWorkflows();
  }, [loadWorkflows]);

  function handleStartRun(workflow: WorkflowSummary): void {
    setStartingRunWorkflowId(workflow.id);
    void (async () => {
      const outcome = await requestRoute({
        routeId: 'startRun',
        parameters: { workflowId: workflow.id },
        body: { input: {} },
        responseSchema: StartedRunResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      setStartingRunWorkflowId(undefined);
      if (outcome.kind === 'ok') {
        pushToast({ variant: 'success', title: 'Futás elindítva', message: workflow.name, duration: 5000 });
        navigate('runHistory');
        return;
      }
      pushToast({ variant: 'danger', title: 'A futás indítása sikertelen', message: outcome.message, duration: 8000 });
    })();
  }

  const rows = workflowsRequest.state.status === 'success' ? workflowsRequest.state.value : (lastWorkflows ?? []);
  const isFirstLoad = lastWorkflows === undefined && workflowsRequest.state.status !== 'failure';
  const isReloading = workflowsRequest.state.status === 'pending' && lastWorkflows !== undefined;

  const columns: readonly DataTableColumn<WorkflowSummary>[] = [
    { id: 'name', header: 'Név', value: (row) => row.name },
    { id: 'description', header: 'Leírás', value: (row) => row.description ?? '', secondary: true },
    { id: 'providerId', header: 'Provider', value: (row) => row.providerId ?? 'nincs megadva', secondary: true },
    { id: 'createdAtMs', header: 'Létrehozva', value: (row) => formatTimestamp(row.createdAtMs), mono: true },
    {
      id: 'actions',
      header: 'Műveletek',
      sortable: false,
      value: () => '',
      cell: (row) => (
        <>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setWorkflowToRename(row);
            }}
          >
            Átnevezés
          </Button>{' '}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setWorkflowToDelete(row);
            }}
          >
            Törlés
          </Button>{' '}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              handleStartRun(row);
            }}
            disabled={startingRunWorkflowId === row.id}
          >
            {startingRunWorkflowId === row.id ? 'Indítás...' : 'Indítás'}
          </Button>
        </>
      ),
    },
  ];

  return (
    <div>
      <div>
        <Button
          type="button"
          onClick={() => {
            setIsCreateModalOpen(true);
          }}
        >
          Új workflow
        </Button>
      </div>
      {isReloading && <ProgressBar isLabelVisible={false} ariaLabel="a lista frissítése folyamatban" value={100} />}
      {isFirstLoad ? (
        <Skeleton shape="text" lines={4} />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(row) => row.id}
          label="Workflow-k"
          emptyLabel="Még nincs workflow."
        />
      )}
      {workflowsRequest.state.status === 'failure' && <p role="alert">{workflowsRequest.state.message}</p>}

      <CreateWorkflowModal
        open={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
        }}
        onCreated={() => {
          void loadWorkflows();
        }}
        apiOrigin={apiOrigin}
        fetchFunction={fetchFunction}
      />
      <RenameWorkflowModal
        workflow={workflowToRename}
        onClose={() => {
          setWorkflowToRename(undefined);
        }}
        onRenamed={() => {
          void loadWorkflows();
        }}
        apiOrigin={apiOrigin}
        fetchFunction={fetchFunction}
      />
      <DeleteWorkflowModal
        workflow={workflowToDelete}
        onClose={() => {
          setWorkflowToDelete(undefined);
        }}
        onDeleted={() => {
          void loadWorkflows();
        }}
        apiOrigin={apiOrigin}
        fetchFunction={fetchFunction}
      />
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
