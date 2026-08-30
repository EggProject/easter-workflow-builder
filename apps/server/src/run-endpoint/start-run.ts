import { StartRunRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `POST /api/workflows/{workflowId}/runs` (SPEC-005 4.2 B táblázat 9. sora).
 * A hívás **a motoron** megy át (`engine.startRun`), nem a repositoryn: a
 * validáció, a provider feloldás és a pillanatkép a motor felelőssége
 * (SPEC-004 4.8), a szerver ezt nem duplikálja.
 */
export function createStartRunHandler(engine: Engine): RouteHandler {
  return async (context) => {
    const parsedBody = StartRunRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return { kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message };
    }

    const workflowId = context.parameters['workflowId'] ?? '';
    const started = await engine.startRun({ workflowId, input: parsedBody.data.input });
    if (started.kind === 'error') {
      return started;
    }

    return {
      kind: 'ok',
      value: { status: 200, body: { runId: started.value.run.id, status: started.value.run.status } },
    };
  };
}
