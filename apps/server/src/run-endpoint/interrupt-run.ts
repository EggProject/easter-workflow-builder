import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `POST /api/runs/{runId}/interrupt` (SPEC-005 4.2 B táblázat 15. sora). A
 * hívás **a motoron** megy át (`engine.interruptRun`): a
 * `InterruptSummary` alakja mezőnként megegyezik az
 * `InterruptSummaryResponse` sémával, ezért nincs átalakítás.
 */
export function createInterruptRunHandler(engine: Engine): RouteHandler {
  return async (context) => {
    const runId = context.parameters['runId'] ?? '';
    const result = await engine.interruptRun(runId);
    if (result.kind === 'error') {
      return result;
    }
    return { kind: 'ok', value: { status: 200, body: result.value } };
  };
}
