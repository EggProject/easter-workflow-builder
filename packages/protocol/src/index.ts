// Barrel: csak nevesített újraexport (SPEC-002 6.6 6. szabálya). A csomag téma mappánként
// bővül, ahogy a SPEC-005 végrehajtási lépései elkészülnek.

// http-route: az API_BASE_PATH és a STREAM_PATH konstans, a 26 végpont útvonal sablonja,
// és a paraméter behelyettesítő tiszta függvény.
export { API_BASE_PATH } from './http-route/api-base-path.ts';
export { STREAM_PATH } from './http-route/stream-path.ts';
export type { HttpMethod, RouteDefinition, RouteId } from './http-route/route-table.ts';
export { ROUTE_TABLE } from './http-route/route-table.ts';
export { buildRoutePath } from './http-route/build-route-path.ts';

// protocol-error: a ProtocolErrorCode szótár, a ProtocolErrorBody séma, a HTTP státusz
// leképezés, és a Zod hiba lista fordítása a boríték alakra.
export type { ProtocolErrorCode } from './protocol-error/protocol-error-code.ts';
export { ProtocolErrorCodeSchema } from './protocol-error/protocol-error-code.ts';
export type { ProtocolErrorBody } from './protocol-error/protocol-error-body.ts';
export { ProtocolErrorBodySchema } from './protocol-error/protocol-error-body.ts';
export { httpStatusForErrorCode } from './protocol-error/http-status-for-error-code.ts';
export { zodErrorToProtocolErrorBody } from './protocol-error/zod-error-to-protocol-error-body.ts';

// workflow: a node típus felsorolás, a workflow rekord, a gráf dokumentum, a létrehozás,
// a módosítás, a teljes gráf csere és a törlés kérés és válasz alakja.
export type { NodeType } from './workflow/node-type.ts';
export { NodeTypeSchema } from './workflow/node-type.ts';
export type {
  CreateWorkflowRequest,
  ListWorkflowsQuery,
  UpdateWorkflowRequest,
  WorkflowDetail,
  WorkflowSummary,
} from './workflow/workflow-record.ts';
export {
  CreateWorkflowRequestSchema,
  ListWorkflowsQuerySchema,
  UpdateWorkflowRequestSchema,
  WorkflowDetailSchema,
  WorkflowSummarySchema,
} from './workflow/workflow-record.ts';
export type {
  ReplaceGraphRequest,
  WorkflowEdge,
  WorkflowEdgeInput,
  WorkflowGraphDocument,
  WorkflowNode,
  WorkflowNodeInput,
} from './workflow/workflow-graph-document.ts';
export {
  ReplaceGraphRequestSchema,
  WorkflowEdgeInputSchema,
  WorkflowEdgeSchema,
  WorkflowGraphDocumentSchema,
  WorkflowNodeInputSchema,
  WorkflowNodeSchema,
} from './workflow/workflow-graph-document.ts';
export type { DeletionSummary, DeleteWorkflowRequest } from './workflow/delete-workflow-request.ts';
export { DeletionSummarySchema, DeleteWorkflowRequestSchema } from './workflow/delete-workflow-request.ts';

// run: a futás és a lépés futás állapot felsorolása, a futás rekord, az indítás, a
// listázás, a megszakítás, az újraindítás és a pillanatkép alakja.
export type { RunStatus, StepRunStatus } from './run/run-status.ts';
export { RunStatusSchema, StepRunStatusSchema } from './run/run-status.ts';
export type { ListRunsQuery, RunDetail, RunSummary } from './run/run-record.ts';
export { ListRunsQuerySchema, RunDetailSchema, RunSummarySchema } from './run/run-record.ts';
export type { RestartRunRequest, StartedRunResponse, StartRunRequest } from './run/start-run-request.ts';
export { RestartRunRequestSchema, StartedRunResponseSchema, StartRunRequestSchema } from './run/start-run-request.ts';
export type { RunSnapshotResponse, SnapshotEdge, SnapshotNode } from './run/run-snapshot.ts';
export { RunSnapshotResponseSchema, SnapshotEdgeSchema, SnapshotNodeSchema } from './run/run-snapshot.ts';
export type { StepRunRecord } from './run/step-run-record.ts';
export { StepRunRecordSchema } from './run/step-run-record.ts';
export type { InterruptSummaryResponse } from './run/interrupt-summary.ts';
export { InterruptSummaryResponseSchema } from './run/interrupt-summary.ts';

// transcript: az esemény origin és kind felsorolás, a run_event drótszintű rekordja, a
// kurzoros lekérdezés kérése és a lapja.
export type { RunEventKind, RunEventOrigin } from './transcript/run-event-kind.ts';
export { RunEventKindSchema, RunEventOriginSchema } from './transcript/run-event-kind.ts';
export type { RunEventRecord } from './transcript/run-event-record.ts';
export { RunEventRecordSchema } from './transcript/run-event-record.ts';
export type { ReadRunEventsQuery } from './transcript/read-run-events-query.ts';
export { ReadRunEventsQuerySchema } from './transcript/read-run-events-query.ts';
export type { TranscriptPage } from './transcript/transcript-page.ts';
export { TranscriptPageSchema } from './transcript/transcript-page.ts';

// approval: a döntés felsorolás, a várakozó jóváhagyás rekordja, és a döntés kérés alakja.
export type { ApprovalDecision } from './approval/approval-decision.ts';
export { ApprovalDecisionSchema } from './approval/approval-decision.ts';
export type { ApprovalDecisionRequest, PendingApproval } from './approval/pending-approval.ts';
export { ApprovalDecisionRequestSchema, PendingApprovalSchema } from './approval/pending-approval.ts';

// provider: a provider összefoglaló alakja és a kapcsolat teszt válasza.
export type { ProviderSummary } from './provider/provider-summary.ts';
export { ProviderSummarySchema } from './provider/provider-summary.ts';
export type { ConnectionTestMode, ConnectionTestResponse } from './provider/connection-test-response.ts';
export { ConnectionTestModeSchema, ConnectionTestResponseSchema } from './provider/connection-test-response.ts';
