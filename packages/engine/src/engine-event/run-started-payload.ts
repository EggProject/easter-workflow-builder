import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A `run_started` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `run_started` sor): a `startRun` tranzakciójában íródik (SPEC-003 9.2).
 */
export interface RunStartedPayload {
  readonly workflowId: string;
  readonly providerId: ProviderId;
  readonly graphSnapshotHash: string;
  readonly persistedStreamDeltas: boolean;
}
