import type { FetchFunction } from '@easter-workflow-builder/core';
import {
  StartedRunResponseSchema,
  WorkflowSummarySchema,
  type WorkflowSummary,
} from '@easter-workflow-builder/protocol';
import {
  Button,
  DataTable,
  Menu,
  MenuItem,
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
import './workflow-list-screen.css';

/**
 * Hárompontos (`MoreVertical`) ikon a sor műveletek menü triggeréhez. A
 * kör-pontok geometriája a projekt által vendorolt lucide 0.525.0
 * `MoreVertical` ikonjának valódi útvonal-adata (24x24 viewBox), a repóban
 * már meglévő ikon-konvenció (1.75px stroke, kerekített vonal) szerint
 * kézzel beágyazva - ugyanaz a módszer, mint a hamburger és a bezárás ikon
 * (`app-shell.tsx`, `Modal.tsx`), nem külön ikon csomag.
 */
function MoreVerticalIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

export interface WorkflowListScreenProperties {
  readonly apiOrigin: string;
  readonly listLimit: number;
  readonly fetchFunction: FetchFunction;
  readonly navigate: (routeId: ClientRouteId) => void;
  /**
   * Hányszor váltott a szerver példány azonosítója (`stream_ready` keret,
   * SPEC-007 9.2). Minden változása szerver újraindulást jelent, amire a
   * képernyő újratölti az adatát (16. szekció 44. kritérium).
   */
  readonly serverRestartCount: number;
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
  const { apiOrigin, listLimit, fetchFunction, navigate, serverRestartCount } = properties;

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
    // Csatoláskor fut, és minden szerver újraindulásra újra: a további
    // hívásokat a felhasználói művelet (létrehozás, átnevezés, törlés,
    // indítás) váltja ki. A `serverRestartCount` szándékosan dependency,
    // holott a törzs nem olvassa (SPEC-007 9.2, 16. szekció 44.
    // kritérium); elágazás nélkül, hogy ne keletkezzen sosem futó ág.
    void loadWorkflows();
  }, [loadWorkflows, serverRestartCount]);

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
        pushToast({ variant: 'success', title: 'Futás elindítva', message: workflow.name });
        navigate('runHistory');
        return;
      }
      pushToast({ variant: 'danger', title: 'A futás indítása sikertelen', message: outcome.message });
    })();
  }

  const rows = workflowsRequest.state.status === 'success' ? workflowsRequest.state.value : (lastWorkflows ?? []);
  const isFirstLoad = lastWorkflows === undefined && workflowsRequest.state.status !== 'failure';
  const isReloading = workflowsRequest.state.status === 'pending' && lastWorkflows !== undefined;

  const columns: readonly DataTableColumn<WorkflowSummary>[] = [
    { id: 'name', header: 'Név', value: (row) => row.name },
    { id: 'description', header: 'Leírás', value: (row) => row.description ?? '', secondary: true },
    { id: 'providerId', header: 'Provider', value: (row) => row.providerId ?? 'nincs megadva', secondary: true },
    {
      id: 'createdAtMs',
      header: 'Létrehozva',
      value: (row) => formatTimestamp(row.createdAtMs),
      mono: true,
      // Mobil szélességen a monospace időbélyeg három sorba törne, és
      // elvenné a helyet a művelet gomboktól (SPEC-007 5.3).
      tertiary: true,
    },
    {
      id: 'actions',
      header: 'Műveletek',
      hiddenHeader: true,
      fitContent: true,
      sortable: false,
      value: () => '',
      cell: (row) => (
        <Menu
          align="right"
          trigger={(triggerProperties) => (
            <Button
              {...triggerProperties}
              type="button"
              size="sm"
              variant="secondary"
              icon
              aria-label={`Műveletek – ${row.name}`}
            >
              <MoreVerticalIcon />
            </Button>
          )}
        >
          <MenuItem
            onSelect={() => {
              setWorkflowToRename(row);
            }}
          >
            Átnevezés
          </MenuItem>
          <MenuItem
            danger
            onSelect={() => {
              setWorkflowToDelete(row);
            }}
          >
            Törlés
          </MenuItem>
          <MenuItem
            disabled={startingRunWorkflowId === row.id}
            onSelect={() => {
              handleStartRun(row);
            }}
          >
            {startingRunWorkflowId === row.id ? 'Indítás...' : 'Indítás'}
          </MenuItem>
        </Menu>
      ),
    },
  ];

  return (
    <div>
      <div className="workflow-list__toolbar">
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
