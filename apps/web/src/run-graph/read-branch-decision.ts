import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { isBoolean, isRecord, isString } from '@easter-workflow-builder/typeguards';
import type { BranchDecision } from './branch-decision.ts';

/**
 * A nézett futás egy `branch_taken` keretéből olvasott döntés, vagy
 * `undefined`, ha a keret nem ilyen, vagy az alakja hibás (SPEC-008 6.6, 87.).
 *
 * **A payload olvasása.** A `run_event.payload` a dróton `unknown` (SPEC-005),
 * a motor alakja `{ branchKey: string | null, usedDefault: boolean }`
 * (`packages/engine` `branch-taken-payload.ts`, SPEC-008 2.8). Az `apps/web`
 * az `engine` csomagot nem importálhatja, ezért a két mezőt a `typeguards`
 * guardjaival olvassa, a `run-event-row` payload olvasóinak mintájára. A hibás
 * alakú payload kimarad: a felület nem törik el, csak a döntés hiányzik.
 *
 * A pótolt és az élő keret egyaránt döntés, mert a futás nézet a futás teljes
 * eseménysorának pótlását kéri (SPEC-008 M-107). Lépés futás nélküli keret
 * nem döntés: a motor a `branch_taken` eseményt mindig lépés futáshoz írja
 * (`packages/engine` `engine-event.ts`), tehát egy ilyen keret csomóponthoz
 * soha nem képezhető le. Az átmeneti (`run_event_transient`) keretnek nincs
 * `id` mezője, és a `branch_taken` mindig perzisztált esemény (SPEC-008 M-62).
 */
export function readBranchDecision(frame: StreamFrame, runId: string): BranchDecision | undefined {
  if (frame.event !== 'run_event') {
    return undefined;
  }
  const { runEvent } = frame;
  if (runEvent.runId !== runId || runEvent.kind !== 'branch_taken' || runEvent.stepRunId === null) {
    return undefined;
  }
  const { payload } = runEvent;
  if (!isRecord(payload)) {
    return undefined;
  }
  const { branchKey, usedDefault } = payload;
  if (!(branchKey === null || isString(branchKey)) || !isBoolean(usedDefault)) {
    return undefined;
  }
  return { eventId: runEvent.id, stepRunId: runEvent.stepRunId, branchKey, usedDefault };
}
