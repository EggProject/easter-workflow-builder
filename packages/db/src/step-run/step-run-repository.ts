import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  isProviderId,
  type ProviderId,
  type StructuredOutputStrategyId,
} from '@easter-workflow-builder/provider-capability';
import type { Outcome } from '@easter-workflow-builder/core';
import type { NodeType } from '../workflow-graph/node-type/node-type.ts';
import type { SessionMode } from '../workflow-graph/agent-step-config/session-mode.ts';
import { stepRunTable } from './step-run.ts';
import { canTransitionStepRunStatus } from './can-transition-step-run-status.ts';
import { isStepRunStatus } from './is-step-run-status.ts';
import type { StepRunStatus } from './step-run-status.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört, ugyanaz a minta,
 * mint a `workflow-run-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

/**
 * A `createStepRun` bemenete (SPEC-003 9.2 szekció). A `parentStepRunId`,
 * `modelId`, `sessionMode`, `structuredOutputStrategy` és `subWorkflowRunId`
 * mező **kötelezően kitöltött, nullázható** (`T | null`), a `workflow-graph`
 * téma `CreateWorkflowInput`-jának mintáját követve (`description`,
 * `providerId`): a hívónak explicit `null`-t kell adnia hiányzó értékre,
 * nem hagyhatja ki a mezőt. Ez elkerüli az `unicorn/no-null` szabály elleni
 * belső `?? null` átalakítást a repositoryban, mert a `null` a hívó
 * felelőssége, nem itt keletkezik.
 *
 * Az `iteration` és `attempt` ezzel szemben **opcionális, alapértékkel**
 * (0, illetve 1): ez nem nullázhatóság kérdése, hanem technikai kezdőérték
 * (SPEC-003 4.10 "alapból" megjegyzései), ezért `?:` és belső `??`.
 */
export interface CreateStepRunInput {
  readonly runId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly parentStepRunId: string | null;
  readonly iteration?: number;
  readonly attempt?: number;
  readonly providerId: ProviderId;
  readonly modelId: string | null;
  readonly sessionMode: SessionMode | null;
  readonly structuredOutputStrategy: StructuredOutputStrategyId | null;
  readonly subWorkflowRunId: string | null;
}

/**
 * A négy token oszlop együtt (SPEC-003 4.10, "A token oszlopok származtatott
 * összesítések"): a hívó (a motor) az SDK `result` üzenetből olvassa ki, és
 * egyben adja át, mert a négy oszlop **egyszer**, a terminális átmenettel
 * egy tranzakcióban íródik, és utána nem változik.
 */
export interface StepRunTokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
}

/**
 * A `markStepSucceeded` bemenete. Az `output` hiánya (`undefined`) attól
 * függően engedett, hogy a lépés vár-e strukturált kimenetet: lásd a
 * `markStepSucceeded` függvény dokumentációját (SPEC-003 7.2, M-34
 * következménye).
 */
export interface MarkStepSucceededInput {
  readonly output?: unknown;
  readonly tokens?: StepRunTokenUsage;
}

export interface MarkStepFailedInput {
  readonly tokens?: StepRunTokenUsage;
}

/**
 * Az `attachSession` bemenete (SPEC-003 4.5 szekció): a `system` `init`
 * SDK üzenet feldolgozásakor a motor ezt hívja, hogy a session azonosítót a
 * már futó lépés futás sorába írja. A `resumedFrom` `isolated` módban
 * `null`, `continued` módban az előző lépés session azonosítója.
 */
export interface AttachSessionInput {
  readonly sessionId: string;
  readonly resumedFrom: string | null;
  readonly forked: boolean;
}

export interface StepRunRecord {
  readonly id: string;
  readonly runId: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly parentStepRunId: string | null;
  readonly iteration: number;
  readonly attempt: number;
  readonly status: StepRunStatus;
  readonly providerId: ProviderId;
  readonly modelId: string | null;
  readonly sessionMode: string | null;
  readonly sdkSessionId: string | null;
  readonly resumedFromSessionId: string | null;
  readonly forkedSession: boolean;
  readonly structuredOutputStrategy: string | null;
  readonly output: unknown;
  readonly resultSubtype: string | null;
  readonly numTurns: number | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
  readonly subWorkflowRunId: string | null;
  readonly errorKind: string | null;
  readonly errorMessage: string | null;
  readonly startedAtMs: Date | null;
  readonly finishedAtMs: Date | null;
  readonly createdAtMs: Date;
}

export interface StepRunRepository {
  createStepRun(input: CreateStepRunInput): Outcome<StepRunRecord>;
  listStepRuns(runId: string): Outcome<readonly StepRunRecord[]>;
  getStepRun(stepRunId: string): Outcome<StepRunRecord>;
  markStepRunning(stepRunId: string): Outcome<StepRunRecord>;
  markStepWaitingApproval(stepRunId: string): Outcome<StepRunRecord>;
  markStepSucceeded(stepRunId: string, input?: MarkStepSucceededInput): Outcome<StepRunRecord>;
  markStepFailed(
    stepRunId: string,
    errorKind: string,
    errorMessage: string,
    input?: MarkStepFailedInput,
  ): Outcome<StepRunRecord>;
  markStepRejected(stepRunId: string): Outcome<StepRunRecord>;
  markStepCancelled(stepRunId: string): Outcome<StepRunRecord>;
  markStepInterrupted(stepRunId: string): Outcome<StepRunRecord>;
  attachSession(stepRunId: string, input: AttachSessionInput): Outcome<StepRunRecord>;
}

const ALL_STEP_RUN_STATUSES: readonly StepRunStatus[] = [
  'pending',
  'running',
  'waiting_approval',
  'succeeded',
  'failed',
  'rejected',
  'cancelled',
  'interrupted',
];

function notFoundMessage(stepRunId: string): string {
  return `A(z) "${stepRunId}" azonosítójú lépés futás nem található (not_found).`;
}

function illegalTransitionMessage(stepRunId: string, to: StepRunStatus): string {
  return `A(z) "${stepRunId}" lépés futás nem vihető át "${to}" állapotba: nem létezik, vagy a jelenlegi állapota nem engedi ezt az átmenetet (illegal_status_transition).`;
}

function missingStructuredOutputMessage(stepRunId: string): string {
  return `A(z) "${stepRunId}" lépés futás strukturált kimenetet vár (structured_output_strategy kitöltve), de a markStepSucceeded hívás nem adott meg kimenetet (missing_structured_output).`;
}

/**
 * Ugyanaz az elv, mint a `workflow-run-repository.ts` `allowedFromStatuses`
 * függvényében: a `canTransitionStepRunStatus` átmeneti táblájából vezeti le
 * a `WHERE status IN (...)` feltételt a compare-and-set `UPDATE`-hez,
 * egyetlen igazságforrásból (SPEC-003 7.3 szekció).
 */
function allowedFromStatuses(to: StepRunStatus): readonly StepRunStatus[] {
  return ALL_STEP_RUN_STATUSES.filter((from) => canTransitionStepRunStatus(from, to));
}

/**
 * A négy token mezőt `UPDATE` oszloppá alakítja, vagy üres objektumot ad,
 * ha a hívó nem adott meg token összesítést (SPEC-003 4.10, "A token
 * oszlopok származtatott összesítések").
 */
function tokenColumns(tokens: StepRunTokenUsage | undefined): Partial<typeof stepRunTable.$inferInsert> {
  if (tokens === undefined) {
    return {};
  }
  return {
    inputTokens: tokens.inputTokens,
    outputTokens: tokens.outputTokens,
    cacheReadInputTokens: tokens.cacheReadInputTokens,
    cacheCreationInputTokens: tokens.cacheCreationInputTokens,
  };
}

/**
 * A nyers Drizzle sor típusos `StepRunRecord`-dá alakítása. Csak a
 * `provider_id` és a `status` oszlopot szűkíti typeguarddal (SPEC-003 9.4
 * szekció explicit listája `isProviderId`-t és `isStepRunStatus`-t nevezi
 * meg, `isNodeType`-ot nem sorolja ide): a `node_type` a pillanatképből
 * kimásolt, már ott (`isGraphSnapshotDocumentV1`/`isNodeConfig` révén)
 * ellenőrzött érték, a `session_mode` és a `structured_output_strategy`
 * pedig csak "kitöltött-e" alapon vizsgált a `markStepSucceeded`-ben, nem
 * ágaznak el a hívó logikájában - ezért ezek a mezők `string | null`
 * maradnak, a nyers oszloptípusnak megfelelően, új guard bevezetése nélkül
 * (részletek: `packages/db/CLAUDE.md`).
 */
function toStepRunRecord(row: typeof stepRunTable.$inferSelect): Outcome<StepRunRecord> {
  const providerId = row.providerId;
  if (!isProviderId(providerId)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" lépés futás provider_id mezője érvénytelen: "${providerId}" (invalid_provider_id).`,
    };
  }
  const status = row.status;
  if (!isStepRunStatus(status)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" lépés futás status mezője érvénytelen: "${status}" (invalid_step_run_status).`,
    };
  }
  return {
    kind: 'ok',
    value: {
      id: row.id,
      runId: row.runId,
      nodeId: row.nodeId,
      nodeType: row.nodeType,
      parentStepRunId: row.parentStepRunId,
      iteration: row.iteration,
      attempt: row.attempt,
      status,
      providerId,
      modelId: row.modelId,
      sessionMode: row.sessionMode,
      sdkSessionId: row.sdkSessionId,
      resumedFromSessionId: row.resumedFromSessionId,
      forkedSession: row.forkedSession,
      structuredOutputStrategy: row.structuredOutputStrategy,
      output: row.output,
      resultSubtype: row.resultSubtype,
      numTurns: row.numTurns,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cacheReadInputTokens: row.cacheReadInputTokens,
      cacheCreationInputTokens: row.cacheCreationInputTokens,
      subWorkflowRunId: row.subWorkflowRunId,
      errorKind: row.errorKind,
      errorMessage: row.errorMessage,
      startedAtMs: row.startedAtMs,
      finishedAtMs: row.finishedAtMs,
      createdAtMs: row.createdAtMs,
    },
  };
}

function collectStepRunRecords(rows: readonly (typeof stepRunTable.$inferSelect)[]): Outcome<readonly StepRunRecord[]> {
  const records: StepRunRecord[] = [];
  for (const row of rows) {
    const outcome = toStepRunRecord(row);
    if (outcome.kind === 'error') {
      return outcome;
    }
    records.push(outcome.value);
  }
  return { kind: 'ok', value: records };
}

/**
 * `packages/db/CLAUDE.md` "Outcome hibaosztály konvenció" szerint: a
 * hibaosztály neve szó szerint, zárójelben áll az emberi nyelvű üzenetben.
 */
export function createStepRunRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): StepRunRepository {
  /**
   * Nincs `.returning()`: a beszúrt sort a bemenetből és a technikai
   * kezdőértékekből építjük fel, ugyanúgy, ahogy a `workflow-run-repository.ts`
   * `startRun`-ja teszi. A frissen létrehozott lépés futás `pending`
   * állapotban indul (7.2 táblázat), tehát egyetlen opcionális mezőt sem
   * tölt ki még: a `null` itt a `StepRunRecord` nullázható mezőinek valódi
   * kezdő értéke, nem helyőrző.
   */
  function createStepRun(input: CreateStepRunInput): Outcome<StepRunRecord> {
    return transaction(() => {
      const row = {
        id: randomUUID(),
        runId: input.runId,
        nodeId: input.nodeId,
        nodeType: input.nodeType,
        parentStepRunId: input.parentStepRunId,
        iteration: input.iteration ?? 0,
        attempt: input.attempt ?? 1,
        status: 'pending' as const,
        providerId: input.providerId,
        modelId: input.modelId,
        sessionMode: input.sessionMode,
        structuredOutputStrategy: input.structuredOutputStrategy,
        subWorkflowRunId: input.subWorkflowRunId,
        createdAtMs: new Date(),
      };

      database.insert(stepRunTable).values(row).run();

      return {
        kind: 'ok',
        value: {
          ...row,
          /* eslint-disable unicorn/no-null -- lásd a függvény dokumentációját */
          sdkSessionId: null,
          resumedFromSessionId: null,
          forkedSession: false,
          output: null,
          resultSubtype: null,
          numTurns: null,
          inputTokens: null,
          outputTokens: null,
          cacheReadInputTokens: null,
          cacheCreationInputTokens: null,
          errorKind: null,
          errorMessage: null,
          startedAtMs: null,
          finishedAtMs: null,
          /* eslint-enable unicorn/no-null */
        },
      };
    });
  }

  /**
   * `created_at_ms` szerint **növekvő** sorrendben, a `step_run_run_created_idx`
   * indexet kihasználva: egy futáson belüli lépés lista a végrehajtás
   * időrendjét mutatja, szemben a `WorkflowRunRepository.listRuns` csökkenő
   * sorrendjével, ahol a legutóbbi futás a leghasznosabb elöl.
   */
  function listStepRuns(runId: string): Outcome<readonly StepRunRecord[]> {
    return transaction(() => {
      const rows = database
        .select()
        .from(stepRunTable)
        .where(eq(stepRunTable.runId, runId))
        .orderBy(asc(stepRunTable.createdAtMs))
        .all();
      return collectStepRunRecords(rows);
    });
  }

  function getStepRun(stepRunId: string): Outcome<StepRunRecord> {
    return transaction(() => {
      const row = database.select().from(stepRunTable).where(eq(stepRunTable.id, stepRunId)).get();
      if (row === undefined) {
        return { kind: 'error', message: notFoundMessage(stepRunId) };
      }
      return toStepRunRecord(row);
    });
  }

  /**
   * Compare-and-set állapotváltás (SPEC-003 7.3 szekció), ugyanaz a minta,
   * mint a `workflow-run-repository.ts` `transitionRun`-jában: egyetlen
   * `UPDATE ... WHERE id = ? AND status IN (...)`, a `RETURNING` záradékkal.
   * Nulla módosított sor (nincs ilyen lépés futás, vagy a jelenlegi állapota
   * nem engedi ezt az átmenetet) `illegal_status_transition` hibaágat ad.
   */
  function transitionStep(
    stepRunId: string,
    to: StepRunStatus,
    extraColumns: Partial<typeof stepRunTable.$inferInsert> = {},
  ): Outcome<StepRunRecord> {
    return transaction(() => {
      const allowedStatuses = allowedFromStatuses(to);
      const row = database
        .update(stepRunTable)
        .set({ status: to, ...extraColumns })
        .where(and(eq(stepRunTable.id, stepRunId), inArray(stepRunTable.status, allowedStatuses)))
        .returning()
        .get();
      // Ugyanaz a Drizzle tipizálási pontatlanság, mint a
      // `workflow-run-repository.ts` `transitionRun`-jában (részletes
      // indoklás ott): a `.returning().get()` deklarált típusa nem
      // tartalmaz `undefined`-et, holott nulla módosított sorra ténylegesen
      // azt ad vissza.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- lásd a fenti indoklást
      if (row === undefined) {
        return { kind: 'error', message: illegalTransitionMessage(stepRunId, to) };
      }
      return toStepRunRecord(row);
    });
  }

  function markStepRunning(stepRunId: string): Outcome<StepRunRecord> {
    return transitionStep(stepRunId, 'running', { startedAtMs: new Date() });
  }

  function markStepWaitingApproval(stepRunId: string): Outcome<StepRunRecord> {
    return transitionStep(stepRunId, 'waiting_approval');
  }

  /**
   * A `succeeded` átmenet a spec 7.2 szekció M-34 következménye miatt egy
   * plusz, a nevesített átmeneti szabályon (`canTransitionStepRunStatus`)
   * FELÜL álló üzleti ellenőrzést hordoz: "Strukturált kimenetet váró lépés
   * csak akkor lép `succeeded` állapotba, ha ... a kimenet ténylegesen
   * megvan". Ezt a repository réteg kényszeríti ki, nem bízva a hívóban
   * (defenzív, PLAN-003 T-003-18 döntése, dokumentálva `packages/db/CLAUDE.md`-ben):
   * ha a lépés futás tárolt `structured_output_strategy` mezője **nem**
   * NULL, és a hívó `output` nélkül hívja ezt a függvényt, a hívás
   * `missing_structured_output` hibaágat ad, és a sor **nem** kerül
   * `succeeded` állapotba - sem a státusza, sem semelyik oszlopa nem
   * változik, mert az ellenőrzés az `UPDATE` előtt, egy külön `SELECT`-tel
   * történik, ugyanabban a tranzakcióban.
   */
  function markStepSucceeded(stepRunId: string, input: MarkStepSucceededInput = {}): Outcome<StepRunRecord> {
    return transaction(() => {
      const currentRow = database.select().from(stepRunTable).where(eq(stepRunTable.id, stepRunId)).get();
      if (currentRow === undefined) {
        return { kind: 'error', message: illegalTransitionMessage(stepRunId, 'succeeded') };
      }
      if (currentRow.structuredOutputStrategy !== null && input.output === undefined) {
        return { kind: 'error', message: missingStructuredOutputMessage(stepRunId) };
      }

      const allowedStatuses = allowedFromStatuses('succeeded');
      const row = database
        .update(stepRunTable)
        .set({
          status: 'succeeded',
          finishedAtMs: new Date(),
          ...(input.output !== undefined && { output: input.output }),
          ...tokenColumns(input.tokens),
        })
        .where(and(eq(stepRunTable.id, stepRunId), inArray(stepRunTable.status, allowedStatuses)))
        .returning()
        .get();
      // Ugyanaz a Drizzle tipizálási pontatlanság, mint a `transitionStep`-ben.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- lásd a transitionStep indoklását
      if (row === undefined) {
        return { kind: 'error', message: illegalTransitionMessage(stepRunId, 'succeeded') };
      }
      return toStepRunRecord(row);
    });
  }

  function markStepFailed(
    stepRunId: string,
    errorKind: string,
    errorMessage: string,
    input: MarkStepFailedInput = {},
  ): Outcome<StepRunRecord> {
    return transitionStep(stepRunId, 'failed', {
      finishedAtMs: new Date(),
      errorKind,
      errorMessage,
      ...tokenColumns(input.tokens),
    });
  }

  function markStepRejected(stepRunId: string): Outcome<StepRunRecord> {
    return transitionStep(stepRunId, 'rejected', { finishedAtMs: new Date() });
  }

  function markStepCancelled(stepRunId: string): Outcome<StepRunRecord> {
    return transitionStep(stepRunId, 'cancelled', { finishedAtMs: new Date() });
  }

  /**
   * `pending -> interrupted`, `running -> interrupted` és `waiting_approval ->
   * interrupted` (SPEC-003 7.2 táblázat, "indulási helyreállítás", 7.4
   * szekció). A `canTransitionStepRunStatus` ezt az átmenetet a T-003-17 óta
   * ismeri, csak a nevesített metódus hiányzott a felületről (T-003-24). A
   * `run-recovery` téma (`run-recovery.ts`) a szerver indulási
   * helyreállítását **nem** ezen az egyenkénti hívón át, hanem tömeges
   * `UPDATE ... WHERE status IN (...)` utasítással végzi (lásd ott a
   * dokumentációt): ez a metódus önmagában, egyetlen lépés futásra hívva
   * marad a nyilvános, tesztelt állapotváltó, ugyanazzal a compare-and-set
   * mintával, mint a többi `markStep*` függvény.
   */
  function markStepInterrupted(stepRunId: string): Outcome<StepRunRecord> {
    return transitionStep(stepRunId, 'interrupted', { finishedAtMs: new Date() });
  }

  /**
   * Nem állapotváltás (SPEC-003 4.5 szekció): a `system` `init` üzenet
   * feldolgozásakor a motor már egy `running` lépés futáson tölti ki a
   * session mezőket, ezért itt nincs compare-and-set `status IN (...)`
   * feltétel, csak sima `UPDATE ... WHERE id = ?`. A hiányzó sor (ismeretlen
   * `stepRunId`) `not_found` hibaágat ad, nem `illegal_status_transition`-t,
   * mert ez a művelet nem állapotátmenet.
   */
  function attachSession(stepRunId: string, input: AttachSessionInput): Outcome<StepRunRecord> {
    return transaction(() => {
      const row = database
        .update(stepRunTable)
        .set({
          sdkSessionId: input.sessionId,
          resumedFromSessionId: input.resumedFrom,
          forkedSession: input.forked,
        })
        .where(eq(stepRunTable.id, stepRunId))
        .returning()
        .get();
      // Ugyanaz a Drizzle tipizálási pontatlanság, mint a `transitionStep`-ben.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- lásd a transitionStep indoklását
      if (row === undefined) {
        return { kind: 'error', message: notFoundMessage(stepRunId) };
      }
      return toStepRunRecord(row);
    });
  }

  return {
    createStepRun,
    listStepRuns,
    getStepRun,
    markStepRunning,
    markStepWaitingApproval,
    markStepSucceeded,
    markStepFailed,
    markStepRejected,
    markStepCancelled,
    markStepInterrupted,
    attachSession,
  };
}
