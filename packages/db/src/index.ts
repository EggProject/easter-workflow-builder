// Barrel: csak nevesített újraexport (SPEC-002 6.6 6. szabálya). A csomag téma mappánként
// bővül, ahogy a SPEC-003 végrehajtási lépései elkészülnek.

// database-file: az adatbázis fájl helyének feloldása, env változó néven.
export { ENV_EASTER_DB_FILE } from './database-file/environment-variable-name.ts';
export { resolveDatabaseFilePath } from './database-file/resolve-database-file-path.ts';
export { defaultDatabaseFilePath } from './database-file/default-database-file-path.ts';
export { ensureDatabaseDirectory } from './database-file/ensure-database-directory.ts';

// sqlite-connection: az adatbázis kapcsolat megnyitása, tranzakció, zárás.
export { openDatabase } from './sqlite-connection/open-database.ts';
export type { DatabaseContext } from './sqlite-connection/database-context.ts';

// workflow-graph: a WorkflowRepository publikus felülete (T-003-12). A
// factory függvényt (`createWorkflowRepository`) szándékosan nem exportáljuk,
// csak a típust (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).
export type {
  WorkflowRepository,
  WorkflowRecord,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  WorkflowNodeInput,
  WorkflowNodeRecord,
  WorkflowEdgeInput,
  WorkflowEdgeRecord,
  WorkflowGraph,
  DeletionSummary,
  DeleteWorkflowInput,
} from './workflow-graph/workflow/workflow-repository.ts';

// workflow-run: a WorkflowRunRepository publikus felülete (T-003-16). A
// factory függvényt (`createWorkflowRunRepository`) szándékosan nem
// exportáljuk, csak a típust, ugyanaz a minta, mint a `WorkflowRepository`-nél
// (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).
export type {
  WorkflowRunRepository,
  StartRunInput,
  StartRunParentContext,
  WorkflowRunRecord,
} from './workflow-run/workflow-run-repository.ts';

// step-run: a StepRunRepository publikus felülete (T-003-18). A factory
// függvényt (`createStepRunRepository`) szándékosan nem exportáljuk, csak a
// típust, ugyanaz a minta, mint a `WorkflowRunRepository`-nél (SPEC-002 6.6
// 5. szabálya, SPEC-003 9.3 szekció).
export type {
  StepRunRepository,
  CreateStepRunInput,
  StepRunTokenUsage,
  MarkStepSucceededInput,
  MarkStepFailedInput,
  AttachSessionInput,
  StepRunRecord,
} from './step-run/step-run-repository.ts';

// run-event: a RunEventRepository publikus felülete (T-003-21). A factory
// függvényt (`createRunEventRepository`) szándékosan nem exportáljuk, csak a
// típust, ugyanaz a minta, mint a `WorkflowRunRepository`-nél (SPEC-002 6.6
// 5. szabálya, SPEC-003 9.3 szekció). A `RunEventKind`/`isRunEventKind` is
// itt kerül ki először a barrelbe (eddig csak a téma mappán belül élt).
export type {
  RunEventRepository,
  EngineRunEventKind,
  AppendSdkEventInput,
  AppendSdkEventResult,
  AppendEngineEventInput,
  RunEventRecord,
  RunEventTokenAggregate,
} from './run-event/event-record/run-event-repository.ts';
export type { RunEventKind } from './run-event/event-kind/run-event-kind.ts';
export { isRunEventKind } from './run-event/event-kind/is-run-event-kind.ts';

// app-setting: az AppSettingRepository publikus felülete (T-003-23). A
// factory függvényt (`createAppSettingRepository`) szándékosan nem
// exportáljuk, csak a típust, ugyanaz a minta, mint a `WorkflowRepository`-nél
// (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).
export type { AppSettingRepository, AppSettingsRecord } from './app-setting/app-setting-repository.ts';

// provider-concurrency: a ProviderConcurrencyRepository publikus felülete
// (T-003-23). A factory függvényt (`createProviderConcurrencyRepository`)
// szándékosan nem exportáljuk, csak a típust, ugyanaz a minta, mint a
// `WorkflowRepository`-nél (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció).
export type { ProviderConcurrencyRepository } from './provider-concurrency/provider-concurrency-repository.ts';

// human-approval: a HumanApprovalRepository publikus felülete (T-003-22). A
// factory függvényt (`createHumanApprovalRepository`) szándékosan nem
// exportáljuk, csak a típust, ugyanaz a minta, mint a `WorkflowRepository`-nél
// (SPEC-002 6.6 5. szabálya, SPEC-003 9.3 szekció). Az `ApprovalDecision`
// unió és az `isApprovalDecision` guard is itt kerül ki a barrelbe.
export type {
  HumanApprovalRepository,
  RequestApprovalInput,
  DecideApprovalInput,
  HumanApprovalRecord,
} from './human-approval/human-approval-repository.ts';
export type { ApprovalDecision } from './human-approval/approval-decision.ts';
export { isApprovalDecision } from './human-approval/is-approval-decision.ts';

// run-recovery: a RunRecovery publikus felülete (T-003-24). A factory
// függvényt (`createRunRecovery`) szándékosan nem exportáljuk, csak a
// típust, ugyanaz a minta, mint a `WorkflowRepository`-nél (SPEC-002 6.6
// 5. szabálya, SPEC-003 9.3 szekció). Ez a `packages/db/src` alatti 12.,
// egyben utolsó téma mappa (SPEC-003 8. szekció).
export type { RunRecovery, RecoverInterruptedRunsResult } from './run-recovery/run-recovery.ts';
