import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteId } from '@easter-workflow-builder/protocol';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import type { StreamRegistry } from '../stream-registry/create-stream-registry.ts';
import { createReplaceStreamSubscriptionsHandler } from '../stream-registry/create-replace-stream-subscriptions-handler.ts';
import { createListWorkflowsHandler } from '../workflow-endpoint/list-workflows.ts';
import { createCreateWorkflowHandler } from '../workflow-endpoint/create-workflow.ts';
import { createGetWorkflowHandler } from '../workflow-endpoint/get-workflow.ts';
import { createUpdateWorkflowHandler } from '../workflow-endpoint/update-workflow.ts';
import { createDeleteWorkflowHandler } from '../workflow-endpoint/delete-workflow.ts';
import { createSummarizeWorkflowDeletionHandler } from '../workflow-endpoint/summarize-workflow-deletion.ts';
import { createReadWorkflowGraphHandler } from '../workflow-endpoint/read-workflow-graph.ts';
import { createReplaceWorkflowGraphHandler } from '../workflow-endpoint/replace-workflow-graph.ts';
import { createStartRunHandler } from '../run-endpoint/start-run.ts';
import { createListRunsHandler } from '../run-endpoint/list-runs.ts';
import { createGetRunHandler } from '../run-endpoint/get-run.ts';
import { createReadRunSnapshotHandler } from '../run-endpoint/read-run-snapshot.ts';
import { createListStepRunsHandler } from '../run-endpoint/list-step-runs.ts';
import { createReadRunEventsHandler } from '../run-endpoint/read-run-events.ts';
import { createInterruptRunHandler } from '../run-endpoint/interrupt-run.ts';
import { createRestartRunHandler } from '../run-endpoint/restart-run.ts';
import { createListPendingApprovalsHandler } from '../approval-endpoint/list-pending-approvals.ts';
import { createDecideApprovalHandler } from '../approval-endpoint/decide-approval.ts';
import { createListProvidersHandler } from '../provider-endpoint/list-providers.ts';
import { createTestProviderConnectionHandler } from '../provider-endpoint/test-provider-connection.ts';
import { createReadSettingsHandler } from '../settings-endpoint/read-settings.ts';
import { createUpdateSettingsHandler } from '../settings-endpoint/update-settings.ts';
import { createListConcurrencyLimitsHandler } from '../settings-endpoint/list-concurrency-limits.ts';
import { createSetConcurrencyLimitHandler } from '../settings-endpoint/set-concurrency-limit.ts';
import { createClearConcurrencyLimitHandler } from '../settings-endpoint/clear-concurrency-limit.ts';

/**
 * A `ROUTE_TABLE` mind a 26 azonosítójára kitöltött kezelő rekord
 * (SPEC-006 `route-registry` téma, 12. elfogadási kritérium). A
 * `Record<RouteId, RouteHandler>` visszatérési típus miatt egy kimaradó
 * `RouteId` fordítási hibát ad, nem futásidejű "nincs kezelő" ágat.
 */
export function buildRouteHandlers(
  database: DatabaseContext,
  engine: Engine,
  streamRegistry: StreamRegistry,
): Readonly<Record<RouteId, RouteHandler>> {
  return {
    // A. Workflow (8 végpont)
    listWorkflows: createListWorkflowsHandler(database),
    createWorkflow: createCreateWorkflowHandler(database),
    getWorkflow: createGetWorkflowHandler(database),
    updateWorkflow: createUpdateWorkflowHandler(database),
    deleteWorkflow: createDeleteWorkflowHandler(database),
    summarizeWorkflowDeletion: createSummarizeWorkflowDeletionHandler(database),
    readWorkflowGraph: createReadWorkflowGraphHandler(database),
    replaceWorkflowGraph: createReplaceWorkflowGraphHandler(database),

    // B. Futás (8 végpont)
    startRun: createStartRunHandler(engine),
    listRuns: createListRunsHandler(database),
    getRun: createGetRunHandler(database),
    readRunSnapshot: createReadRunSnapshotHandler(database),
    listStepRuns: createListStepRunsHandler(database),
    readRunEvents: createReadRunEventsHandler(database),
    interruptRun: createInterruptRunHandler(engine),
    restartRun: createRestartRunHandler(engine),

    // C. Jóváhagyás (2 végpont)
    listPendingApprovals: createListPendingApprovalsHandler(database),
    decideApproval: createDecideApprovalHandler(database, engine),

    // D. Provider (2 végpont)
    listProviders: createListProvidersHandler(),
    testProviderConnection: createTestProviderConnectionHandler(engine),

    // E. Beállítás (5 végpont)
    readSettings: createReadSettingsHandler(database),
    updateSettings: createUpdateSettingsHandler(database),
    listConcurrencyLimits: createListConcurrencyLimitsHandler(database, engine),
    setConcurrencyLimit: createSetConcurrencyLimitHandler(database, engine),
    clearConcurrencyLimit: createClearConcurrencyLimitHandler(database),

    // F. Stream vezérlés (1 végpont)
    replaceStreamSubscriptions: createReplaceStreamSubscriptionsHandler(database, streamRegistry),
  };
}
