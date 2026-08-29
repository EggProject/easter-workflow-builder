import { ListWorkflowsQuerySchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toWorkflowDetail } from './to-workflow-detail.ts';

/**
 * A query string `limit` mezőjét számmá alakítja, mielőtt a Zod sémán
 * átmenne (a `URLSearchParams` minden értéke sztring, a séma viszont
 * `z.number()`-t vár). Hiányzó `limit`-re `undefined`-et ad, hogy a séma a
 * saját "kötelező mező hiányzik" hibáját adja, ne egy itt kitalált üzenetet.
 */
function parseLimitQuery(query: URLSearchParams): Readonly<Record<string, unknown>> {
  const raw = query.get('limit');
  return raw === null ? {} : { limit: Number(raw) };
}

/**
 * `GET /api/workflows` (SPEC-005 4.2 A táblázat 1. sora): a `db` réteg
 * `listWorkflows` nem ismer `limit`-et, a válasz méretét a kezelő vágja le a
 * legutóbb módosított elöl rendezett listából (`workflow-repository.ts`
 * `listWorkflows` doksija).
 */
export function createListWorkflowsHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedQuery = ListWorkflowsQuerySchema.safeParse(parseLimitQuery(context.query));
    if (!parsedQuery.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedQuery.error).message });
    }

    const listed = database.workflows.listWorkflows();
    if (listed.kind === 'error') {
      return Promise.resolve(listed);
    }

    const limited = listed.value.slice(0, parsedQuery.data.limit);
    return Promise.resolve({
      kind: 'ok',
      value: { status: 200, body: limited.map((record) => toWorkflowDetail(record)) },
    });
  };
}
