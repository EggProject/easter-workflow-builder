import type { RunStatus } from '@easter-workflow-builder/db';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';

/**
 * A `run_finished` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `run_finished` sor): terminális futás állapotban íródik. Az `errorKind` és
 * az `errorMessage` `null`, ha a futás hiba nélkül zárt.
 */
export interface RunFinishedPayload {
  readonly status: RunStatus;
  readonly errorKind: EngineErrorKind | null;
  readonly errorMessage: string | null;
  readonly failedBranchCount: number;
}
