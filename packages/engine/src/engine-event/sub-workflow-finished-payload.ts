import type { RunStatus } from '@easter-workflow-builder/db';

/**
 * A `sub_workflow_finished` esemény payloadja (SPEC-004 13. szekció
 * táblázat, `sub_workflow_finished` sor): a gyerek futás terminális
 * állapotba lépésekor íródik.
 */
export interface SubWorkflowFinishedPayload {
  readonly subWorkflowRunId: string;
  readonly status: RunStatus;
}
