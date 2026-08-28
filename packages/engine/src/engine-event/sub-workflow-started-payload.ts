/**
 * A `sub_workflow_started` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `sub_workflow_started` sor): a gyerek futás indulásakor íródik.
 */
export interface SubWorkflowStartedPayload {
  readonly subWorkflowRunId: string;
  readonly targetWorkflowId: string;
  readonly depth: number;
}
