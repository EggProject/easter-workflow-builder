import {
  ReplaceGraphRequestSchema,
  zodErrorToProtocolErrorBody,
  type ReplaceGraphRequest,
} from '@easter-workflow-builder/protocol';
import type { DatabaseContext, WorkflowNodeInput } from '@easter-workflow-builder/db';
import type { Outcome } from '@easter-workflow-builder/core';
import type { RouteHandler, RouteHandlerResult } from '../route-dispatch/route-handler.ts';
import { toWorkflowGraphDocument } from './to-workflow-graph-document.ts';

/**
 * A wire `WorkflowNodeInputSchema.config` mezője a `protocol` saját,
 * duplikált `NodeConfig` uniója (PLAN-009 T-009-13, SPEC-005 7.7): a `protocol`
 * L1 réteg a `db` domain típusát változatlanul nem importálhatja, de a két
 * unió típusszinten azonos, tehát a `config` guard nélkül átadható a `db`
 * `WorkflowNodeInput` alakjának. A `db` `isNodeConfig` guard futásidejű
 * szabályait a mentési séma (`ReplaceGraphRequestSchema`) is érvényesíti, a
 * pozitív egész szám mezőkét is (SPEC-008 5.4, O-37), tehát egy itteni guard
 * hibaága a HTTP úton garantáltan sosem futna (`.claude/CLAUDE.md` 5. szekció,
 * `docs/research/2026-10-17-szam-es-agent-mezok.md`). A két oldal egyezését az
 * `apps/server` `node-config-drift-protection` regressziós tesztje őrzi. A wire
 * `type` mezőt a `db` `WorkflowNodeInput` nem kéri (a `config.type`
 * diszkriminátor már hordozza, `workflow-repository.ts` doksija), ezért itt
 * nem kerül át.
 */
function toDatabaseNode(node: ReplaceGraphRequest['nodes'][number]): WorkflowNodeInput {
  return { id: node.id, label: node.label, positionX: node.positionX, positionY: node.positionY, config: node.config };
}

/**
 * A kezelő szinkron, tesztelhető magja - lásd `update-workflow.ts` ugyanezen
 * mintáját a `Promise.resolve` egyetlen wrapoló pontjáról.
 */
function handleReplaceWorkflowGraph(
  workflowId: string,
  request: ReplaceGraphRequest,
  database: DatabaseContext,
): Outcome<RouteHandlerResult> {
  const databaseNodes = request.nodes.map((node) => toDatabaseNode(node));
  const replaced = database.workflows.replaceGraph(workflowId, databaseNodes, request.edges);
  if (replaced.kind === 'error') {
    return replaced;
  }

  const graph = database.workflows.readGraph(workflowId);
  if (graph.kind === 'error') {
    return graph;
  }

  return { kind: 'ok', value: { status: 200, body: toWorkflowGraphDocument(graph.value) } };
}

/**
 * `PUT /api/workflows/{workflowId}/graph` (SPEC-005 4.2 A táblázat 8. sora).
 * A `db` `replaceGraph` nem ellenőrzi a `workflowId` létezését (a hiányzó
 * workflow-ra idegen kulcs sértést adna, ami `conflict` kódra képződne, nem
 * `not_found`-ra), ezért a kezelő előbb `getWorkflow`-val ellenőriz, a spec
 * által elvárt `not_found` hibaágért.
 */
export function createReplaceWorkflowGraphHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedBody = ReplaceGraphRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const workflowId = context.parameters['workflowId'] ?? '';
    const existing = database.workflows.getWorkflow(workflowId);
    if (existing.kind === 'error') {
      return Promise.resolve(existing);
    }

    return Promise.resolve(handleReplaceWorkflowGraph(workflowId, parsedBody.data, database));
  };
}
