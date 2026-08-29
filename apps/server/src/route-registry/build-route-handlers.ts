import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteId } from '@easter-workflow-builder/protocol';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { createNotImplementedHandler } from '../route-dispatch/create-not-implemented-handler.ts';
import { createListWorkflowsHandler } from '../workflow-endpoint/list-workflows.ts';
import { createCreateWorkflowHandler } from '../workflow-endpoint/create-workflow.ts';
import { createGetWorkflowHandler } from '../workflow-endpoint/get-workflow.ts';
import { createUpdateWorkflowHandler } from '../workflow-endpoint/update-workflow.ts';
import { createDeleteWorkflowHandler } from '../workflow-endpoint/delete-workflow.ts';
import { createSummarizeWorkflowDeletionHandler } from '../workflow-endpoint/summarize-workflow-deletion.ts';
import { createReadWorkflowGraphHandler } from '../workflow-endpoint/read-workflow-graph.ts';
import { createReplaceWorkflowGraphHandler } from '../workflow-endpoint/replace-workflow-graph.ts';

/**
 * A `ROUTE_TABLE` mind a 26 azonosítójára kitöltött kezelő rekord
 * (SPEC-006 `route-registry` téma, 12. elfogadási kritérium). A nyolc
 * workflow végpont valódi kezelőt kap, a maradék tizennyolc (futás,
 * jóváhagyás, provider, beállítás, stream vezérlés) `createNotImplementedHandler`
 * stubot - ez dokumentált, nyitott hiány (lásd a záró jelentés hiánylistáját),
 * nem elfogadott végállapot. A `Record<RouteId, RouteHandler>` visszatérési
 * típus miatt egy kimaradó `RouteId` fordítási hibát ad, nem futásidejű
 * "nincs kezelő" ágat.
 */
export function buildRouteHandlers(database: DatabaseContext): Readonly<Record<RouteId, RouteHandler>> {
  return {
    // A. Workflow (8 végpont) - valódi kezelő
    listWorkflows: createListWorkflowsHandler(database),
    createWorkflow: createCreateWorkflowHandler(database),
    getWorkflow: createGetWorkflowHandler(database),
    updateWorkflow: createUpdateWorkflowHandler(database),
    deleteWorkflow: createDeleteWorkflowHandler(database),
    summarizeWorkflowDeletion: createSummarizeWorkflowDeletionHandler(database),
    readWorkflowGraph: createReadWorkflowGraphHandler(database),
    replaceWorkflowGraph: createReplaceWorkflowGraphHandler(database),

    // B. Futás (8 végpont) - még nem implementált
    startRun: createNotImplementedHandler('startRun'),
    listRuns: createNotImplementedHandler('listRuns'),
    getRun: createNotImplementedHandler('getRun'),
    readRunSnapshot: createNotImplementedHandler('readRunSnapshot'),
    listStepRuns: createNotImplementedHandler('listStepRuns'),
    readRunEvents: createNotImplementedHandler('readRunEvents'),
    interruptRun: createNotImplementedHandler('interruptRun'),
    restartRun: createNotImplementedHandler('restartRun'),

    // C. Jóváhagyás (2 végpont) - még nem implementált
    listPendingApprovals: createNotImplementedHandler('listPendingApprovals'),
    decideApproval: createNotImplementedHandler('decideApproval'),

    // D. Provider (2 végpont) - még nem implementált
    listProviders: createNotImplementedHandler('listProviders'),
    testProviderConnection: createNotImplementedHandler('testProviderConnection'),

    // E. Beállítás (5 végpont) - még nem implementált
    readSettings: createNotImplementedHandler('readSettings'),
    updateSettings: createNotImplementedHandler('updateSettings'),
    listConcurrencyLimits: createNotImplementedHandler('listConcurrencyLimits'),
    setConcurrencyLimit: createNotImplementedHandler('setConcurrencyLimit'),
    clearConcurrencyLimit: createNotImplementedHandler('clearConcurrencyLimit'),

    // F. Stream vezérlés (1 végpont) - még nem implementált
    replaceStreamSubscriptions: createNotImplementedHandler('replaceStreamSubscriptions'),
  };
}
