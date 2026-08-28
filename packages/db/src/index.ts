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
} from './workflow-graph/workflow-repository.ts';

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
