import { randomUUID } from 'node:crypto';
import { CreateWorkflowRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { Outcome } from '@easter-workflow-builder/core';
import type { DatabaseContext, WorkflowNodeInput, WorkflowRecord } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toWorkflowDetail } from './to-workflow-detail.ts';

function invalidProviderIdMessage(value: string): string {
  return `A(z) "${value}" providerId nem ismert provider azonosító (invalid_request).`;
}

/**
 * Az új workflow gráfjának egyetlen csomópontja (SPEC-008 5.8, O-20): üres
 * címke, a vászon origója, üres bemeneti mező lista, a kezeletlen hiba
 * szabálya nincs beállítva. Az `onUnhandledError` értékét a mentési szabály
 * a felhasználóval választatja ki, alapértéket itt nem választunk (SPEC-008
 * 5.4, O-29).
 */
function buildStartNode(): WorkflowNodeInput {
  return {
    id: randomUUID(),
    label: '',
    positionX: 0,
    positionY: 0,
    // eslint-disable-next-line unicorn/no-null -- a StartNodeConfig.onUnhandledError mezője valódi `UnhandledErrorPolicy | null`
    config: { type: 'start', inputFields: [], onUnhandledError: null },
  };
}

/**
 * `POST /api/workflows` (SPEC-005 4.2 A táblázat 2. sora). A `providerId`
 * wire alakja sima szöveg (a `protocol` L1 réteg nem importálhatja a
 * `provider-capability` `ProviderId` unióját, SPEC-005 F-23); ezen a rétegen
 * (`apps/server`, L6) viszont igen, ezért a szűkítést itt, a `db` hívása
 * előtt végezzük el.
 *
 * A workflow egyetlen Start csomóponttal jön létre (SPEC-008 5.8, O-20): a
 * `createWorkflow` és a `replaceGraph` egy `DatabaseContext.transaction`
 * hívásban fut, tehát bármelyik hibaága a másikat is visszagörgeti, Start
 * nélküli, félkész workflow nem marad. A beágyazott hívások SAVEPOINT-ot
 * használnak (a `human-approval-repository.ts` dokumentált precedense).
 */
export function createCreateWorkflowHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedBody = CreateWorkflowRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const { name, description, providerId } = parsedBody.data;
    if (providerId !== null && !isProviderId(providerId)) {
      return Promise.resolve({ kind: 'error', message: invalidProviderIdMessage(providerId) });
    }

    const created = database.transaction((): Outcome<WorkflowRecord> => {
      const workflow = database.workflows.createWorkflow({ name, description, providerId });
      if (workflow.kind === 'error') {
        return workflow;
      }
      const graph = database.workflows.replaceGraph(workflow.value.id, [buildStartNode()], []);
      if (graph.kind === 'error') {
        return graph;
      }
      return workflow;
    });
    if (created.kind === 'error') {
      return Promise.resolve(created);
    }

    return Promise.resolve({ kind: 'ok', value: { status: 200, body: toWorkflowDetail(created.value) } });
  };
}
