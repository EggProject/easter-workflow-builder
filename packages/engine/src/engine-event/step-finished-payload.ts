import type { StepRunStatus, StepRunTokenUsage } from '@easter-workflow-builder/db';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * A `step_finished` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `step_finished` sor): a lépés terminális állapotba lépésekor íródik. A
 * négy token mezőt közvetlenül a `db` csomag `StepRunTokenUsage` típusa adja,
 * nem duplikálva a mezőket; `tokens` `null`, ha a lépés fajtája nem termel
 * token adatot (pl. `branch`).
 */
export interface StepFinishedPayload {
  readonly status: StepRunStatus;
  readonly errorKind: EngineErrorKind | null;
  readonly durationMs: number;
  readonly tokens: StepRunTokenUsage | null;
}
