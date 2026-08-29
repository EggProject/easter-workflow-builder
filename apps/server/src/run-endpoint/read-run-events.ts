import { ReadRunEventsQuerySchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { DatabaseContext, RunEventRecord } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

function parseQuery(query: URLSearchParams): Readonly<Record<string, unknown>> {
  const limit = query.get('limit');
  const afterEventId = query.get('afterEventId');
  const stepRunId = query.get('stepRunId');
  return {
    ...(limit !== null && { limit: Number(limit) }),
    ...(afterEventId !== null && { afterEventId: Number(afterEventId) }),
    ...(stepRunId !== null && { stepRunId }),
  };
}

/**
 * A `db` réteg `RunEventRecord`-ja a drótszintű `RunEventRecord` alakra
 * (SPEC-005 `transcript` téma): a `Date` mező egész milliszekundum lesz, az
 * `origin` a `db` oldalon raw string (nincs hozzá guard, `packages/db`
 * `run-event.ts`), a kimenő oldalon nem validálunk, ezért változatlanul megy.
 */
function toWireRunEvent(record: RunEventRecord) {
  return {
    id: record.id,
    runId: record.runId,
    stepRunId: record.stepRunId,
    origin: record.origin,
    kind: record.kind,
    occurredAtMs: record.occurredAtMs.getTime(),
    sdkMessageType: record.sdkMessageType,
    sdkMessageSubtype: record.sdkMessageSubtype,
    sdkSessionId: record.sdkSessionId,
    sdkUuid: record.sdkUuid,
    parentToolUseId: record.parentToolUseId,
    toolName: record.toolName,
    toolUseId: record.toolUseId,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadInputTokens: record.cacheReadInputTokens,
    cacheCreationInputTokens: record.cacheCreationInputTokens,
    numTurns: record.numTurns,
    payload: record.payload,
  };
}

/**
 * `GET /api/runs/{runId}/events` (SPEC-005 4.2 B táblázat 14. sora). A
 * query két, egymást kizáró alakja Zod unió (`afterEventId` VAGY
 * `stepRunId`), ezért a kezelő a validált érték kulcsán dönt, nem egy saját
 * elágazáson: `'stepRunId' in parsedQuery.data` (SPEC-005 4.2 "A 14. végpont
 * két alakja egy sémaunió, nem feltételes mező").
 */
export function createReadRunEventsHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedQuery = ReadRunEventsQuerySchema.safeParse(parseQuery(context.query));
    if (!parsedQuery.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedQuery.error).message });
    }

    const runId = context.parameters['runId'] ?? '';
    const run = database.runs.getRun(runId);
    if (run.kind === 'error') {
      return Promise.resolve(run);
    }

    const query = parsedQuery.data;
    const events =
      'stepRunId' in query
        ? database.events.readEventsForStep(query.stepRunId, query.limit)
        : database.events.readEventsSince(runId, query.afterEventId, query.limit);
    if (events.kind === 'error') {
      return Promise.resolve(events);
    }

    return Promise.resolve({
      kind: 'ok',
      value: { status: 200, body: { events: events.value.map((record) => toWireRunEvent(record)) } },
    });
  };
}
