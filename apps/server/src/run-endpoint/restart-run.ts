import { RestartRunRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `POST /api/runs/{runId}/restart` (SPEC-005 4.2 B táblázat 16. sora). A
 * hívás **a motoron** megy át (`engine.restartRun`).
 *
 * **Eltérés a specifikációtól, dokumentálva.** A `RestartRunRequest.input`
 * mező a drótszinten opcionális felülírás lenne, de az `Engine.restartRun`
 * (SPEC-004 3.1 `Engine` felület) csak `runId`-t fogad, felülírás nélkül: a
 * motor mindig az EREDETI futás bemenetét használja
 * (`packages/engine/src/run-supervisor/restart-run.ts`). A jelen lépés a
 * `protocol`, az `engine` és a `db` felületét nem bővíti (SPEC-006 1.
 * szekció "Amit NEM dönt el"), ezért a kérés törzsének `input` mezője
 * validálódik, de a motor hívásában nem vesz részt - a végpont mindig az
 * eredeti bemenettel indít újra, ami a spec dokumentált alapviselkedése
 * ("input, elhagyható, alapból az eredeti bemenet"), csak a felülírás út
 * nincs bekötve.
 */
export function createRestartRunHandler(engine: Engine): RouteHandler {
  return async (context) => {
    const parsedBody = RestartRunRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return { kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message };
    }

    const runId = context.parameters['runId'] ?? '';
    const restarted = await engine.restartRun(runId);
    if (restarted.kind === 'error') {
      return restarted;
    }

    return {
      kind: 'ok',
      value: { status: 200, body: { runId: restarted.value.run.id, status: restarted.value.run.status } },
    };
  };
}
