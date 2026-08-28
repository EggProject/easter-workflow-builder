import SqliteDatabase from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describeError, type Outcome } from '@easter-workflow-builder/core';
import { describeTransactionError } from './describe-transaction-error.ts';
import { ensureDatabaseDirectory } from '../database-file/ensure-database-directory.ts';
import { migrateDatabase } from '../migration/migrate-database.ts';
import { MIGRATIONS_FOLDER } from '../migration/migrations-folder.ts';
import { createWorkflowRepository } from '../workflow-graph/workflow/workflow-repository.ts';
import { createWorkflowRunRepository } from '../workflow-run/workflow-run-repository.ts';
import { createStepRunRepository } from '../step-run/step-run-repository.ts';
import { createAppSettingRepository } from '../app-setting/app-setting-repository.ts';
import { createProviderConcurrencyRepository } from '../provider-concurrency/provider-concurrency-repository.ts';
import { createRunEventRepository } from '../run-event/event-record/run-event-repository.ts';
import { createHumanApprovalRepository } from '../human-approval/human-approval-repository.ts';
import { createRunRecovery } from '../run-recovery/run-recovery.ts';
import type { DatabaseContext } from './database-context.ts';

const DATABASE_CLOSED_MESSAGE =
  'A művelet nem hajtható végre, mert az adatbázis kapcsolat le van zárva (database_closed).';

/**
 * Belső jelzőosztály a tranzakción belüli, `Outcome` hibaágból kiváltott
 * visszagörgetéshez. A `better-sqlite3`/Drizzle tranzakció csak dobott
 * hibára görget vissza (F-4), egy normálisan visszaadott hiba `Outcome`-ot
 * csendben commitolna.
 */
class TransactionRollback extends Error {}

/**
 * Az adatbázis kapcsolat megnyitása a SPEC-003 10.2 szekció szerint: a
 * könyvtár létrehozása, `new Database`, `foreign_keys` pragma, majd
 * `journal_mode = WAL` fájl alapú adatbázison, a `drizzle()` bekötés séma
 * objektum nélkül, végül a commitolt migrációk lefuttatása. A `migrate()`
 * a `drizzle()` példányt igényli (nem a nyers `better-sqlite3` handle-t),
 * ezért a kódban a bekötés technikailag megelőzi a migrációt; ez nem tér el
 * a spec szándékától, mert az 5. pont lényege a séma nélküli bekötés, nem a
 * szó szerinti sorrend a 4. ponttal szemben.
 */
export function openDatabase(filePath: string): Outcome<DatabaseContext> {
  const directoryOutcome = ensureDatabaseDirectory(filePath);
  if (directoryOutcome.kind === 'error') {
    return directoryOutcome;
  }

  let sqlite: SqliteDatabase.Database;
  try {
    sqlite = new SqliteDatabase(filePath);
  } catch (error) {
    return {
      kind: 'error',
      message: `Nem sikerült megnyitni a(z) ${filePath} adatbázis fájlt: ${describeError(error)}`,
    };
  }

  sqlite.pragma('foreign_keys = ON');
  if (filePath !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }

  const database = drizzle(sqlite);

  const migrationOutcome = migrateDatabase(database, MIGRATIONS_FOLDER);
  if (migrationOutcome.kind === 'error') {
    sqlite.close();
    return migrationOutcome;
  }

  let isClosed = false;

  function transaction<TValue>(work: () => Outcome<TValue>): Outcome<TValue> {
    if (isClosed) {
      return { kind: 'error', message: DATABASE_CLOSED_MESSAGE };
    }
    try {
      const value = database.transaction((): TValue => {
        const result = work();
        if (result.kind === 'error') {
          throw new TransactionRollback(result.message);
        }
        return result.value;
      });
      return { kind: 'ok', value };
    } catch (error) {
      if (error instanceof TransactionRollback) {
        return { kind: 'error', message: error.message };
      }
      return { kind: 'error', message: describeTransactionError(error) };
    }
  }

  function close(): void {
    isClosed = true;
    sqlite.close();
  }

  const workflows = createWorkflowRepository(database, transaction);
  const runs = createWorkflowRunRepository(database, transaction);
  const stepRuns = createStepRunRepository(database, transaction);
  const events = createRunEventRepository(database, transaction);
  // A HumanApprovalRepository a StepRunRepository már létrehozott
  // példányát kapja meg (nem a factory függvényt), hogy a
  // markStepWaitingApproval/markStepSucceeded/markStepRejected hívások
  // ugyanazt a database/transaction zárványt használják, mint a
  // stepRuns mező (SPEC-003 9.2 szekció, `human-approval-repository.ts`).
  const approvals = createHumanApprovalRepository(database, transaction, stepRuns);
  const settings = createAppSettingRepository(database, transaction);
  const concurrencyLimits = createProviderConcurrencyRepository(database, transaction);
  const recovery = createRunRecovery(database, transaction);

  return {
    kind: 'ok',
    value: { workflows, runs, stepRuns, events, approvals, settings, concurrencyLimits, recovery, transaction, close },
  };
}
