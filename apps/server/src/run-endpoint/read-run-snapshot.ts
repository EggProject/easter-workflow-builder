import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `GET /api/runs/{runId}/snapshot` (SPEC-005 4.2 B táblázat 12. sora). A
 * `db` réteg `GraphSnapshotDocument` alakja mezőnként megegyezik a
 * drótszintű `RunSnapshotResponse` sémával (`packages/db`
 * `graph-snapshot-document.ts` és `packages/protocol` `run-snapshot.ts`),
 * ezért nincs átalakítás: a dokumentum változatlanul megy ki.
 */
export function createReadRunSnapshotHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const found = database.runs.readSnapshot(context.parameters['runId'] ?? '');
    if (found.kind === 'error') {
      return Promise.resolve(found);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: found.value } });
  };
}
