import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import type { StepRunRepository } from '../step-run/step-run-repository.ts';
import { humanApprovalTable } from './human-approval.ts';
import { isApprovalDecision } from './is-approval-decision.ts';
import type { ApprovalDecision } from './approval-decision.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört, ugyanaz a minta,
 * mint a `workflow-run-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

/**
 * A `requestApproval` bemenete (SPEC-003 4.12 szekció). A `body` és a
 * `payload` a hívó (a motor) által **már kirenderelt** szöveg/adat: a
 * repository változtatás nélkül rögzíti, nem ő végzi a sablonozást (4.12
 * szekció, "a kérés pillanatában rögzül").
 */
export interface RequestApprovalInput {
  readonly runId: string;
  readonly stepRunId: string;
  readonly title: string;
  readonly body: string;
  readonly payload: unknown;
}

/**
 * A `decideApproval` bemenete. Egyetlen mezőpár, a plan T-003-22 sora
 * szerint (`decideApproval(input)`, "bemenet stepRunId, decision").
 */
export interface DecideApprovalInput {
  readonly stepRunId: string;
  readonly decision: ApprovalDecision;
}

export interface HumanApprovalRecord {
  readonly id: string;
  readonly runId: string;
  readonly stepRunId: string;
  readonly title: string;
  readonly body: string;
  readonly payload: unknown;
  readonly decision: ApprovalDecision | null;
  readonly requestedAtMs: Date;
  readonly decidedAtMs: Date | null;
}

export interface HumanApprovalRepository {
  requestApproval(input: RequestApprovalInput): Outcome<HumanApprovalRecord>;
  decideApproval(input: DecideApprovalInput): Outcome<HumanApprovalRecord>;
  getApprovalForStep(stepRunId: string): Outcome<HumanApprovalRecord>;
  listPendingApprovals(): Outcome<readonly HumanApprovalRecord[]>;
}

function notFoundMessage(stepRunId: string): string {
  return `A(z) "${stepRunId}" lépés futáshoz nem tartozik jóváhagyási kérés (not_found).`;
}

function alreadyDecidedMessage(stepRunId: string): string {
  return `A(z) "${stepRunId}" lépés futáshoz tartozó jóváhagyás már el van döntve (already_decided).`;
}

/**
 * A nyers Drizzle sor típusos `HumanApprovalRecord`-dá alakítása. A
 * `decision` oszlopon nincs DB szintű `CHECK` a két megengedett értékkel
 * (SPEC-003 4.12 szekció), ezért egy korrupt, nem NULL, de érvénytelen
 * érték `isApprovalDecision` guarddal szűrve `invalid_approval_decision`
 * hibaágat ad (SPEC-003 9.4 szekció), ugyanaz a minta, mint a
 * `WorkflowRunRepository.toWorkflowRunRecord`-ban a `status`/`provider_id`
 * oszlopnál.
 */
function toHumanApprovalRecord(row: typeof humanApprovalTable.$inferSelect): Outcome<HumanApprovalRecord> {
  const decision = row.decision;
  if (decision !== null && !isApprovalDecision(decision)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" jóváhagyás decision mezője érvénytelen: "${decision}" (invalid_approval_decision).`,
    };
  }
  return {
    kind: 'ok',
    value: {
      id: row.id,
      runId: row.runId,
      stepRunId: row.stepRunId,
      title: row.title,
      body: row.body,
      payload: row.payload,
      decision,
      requestedAtMs: row.requestedAtMs,
      decidedAtMs: row.decidedAtMs,
    },
  };
}

/**
 * A `listPendingApprovals` sor-leképezője, SZÁNDÉKOSAN nem a
 * `toHumanApprovalRecord`-on át: az a `decision !== null && !isApprovalDecision(...)`
 * ellenőrzést a `decision IS NULL` szűrésű lekérdezésre alkalmazva egy
 * típusilag garantáltan holt ágat vinne be (a `decision !== null` mindig
 * hamis, hiszen a `WHERE` feltétel ezt már kikényszerítette), ami a
 * SPEC-003 12.4 szekció 100 százalékos, kizárás nélküli lefedettségi
 * küszöbét sértené - ugyanaz az elv, mint a `run-event-repository.ts`
 * `insertEngineEventRow`/`appendEngineEvent` szétválasztásánál
 * (`packages/db/CLAUDE.md`, "Az `appendSdkEvent` és az `appendEngineEvent`
 * SZÁNDÉKOSAN két külön SQL utasítás"). A `decision: null` mező itt ezért
 * nem a nyers `row.decision` értékét adja tovább, hanem a lekérdezés által
 * garantált tényt írja le közvetlenül.
 */
function toPendingApprovalRecord(row: typeof humanApprovalTable.$inferSelect): HumanApprovalRecord {
  return {
    id: row.id,
    runId: row.runId,
    stepRunId: row.stepRunId,
    title: row.title,
    body: row.body,
    payload: row.payload,
    // eslint-disable-next-line unicorn/no-null -- lásd a fenti indoklást
    decision: null,
    requestedAtMs: row.requestedAtMs,
    decidedAtMs: row.decidedAtMs,
  };
}

/**
 * `packages/db/CLAUDE.md` "Outcome hibaosztály konvenció" szerint: a
 * hibaosztály neve szó szerint, zárójelben áll az emberi nyelvű üzenetben.
 *
 * **A `stepRuns` paraméter a már létrehozott `StepRunRepository` példány**
 * (SPEC-003 9.2 szekció: "`requestApproval` ... a `decideApproval` ...
 * `markStepWaitingApproval`/`markStepSucceeded`/`markStepRejected`
 * hívásokat egyetlen tranzakcióban végzi). Ez a fájl NEM importálja a
 * `createStepRunRepository` factory függvényt, csak a `StepRunRepository`
 * TÍPUST (`import type`, tehát fordítás után nyoma sincs): a tényleges
 * példányt az `open-database.ts` adja át, ahol a `stepRuns` mező már
 * létezik, mielőtt a `createHumanApprovalRepository` meghívódna - így egy
 * hívás sem hoz létre második, a `database`/`transaction` párra kötött
 * `StepRunRepository` példányt (ami két, egymástól független zárvány
 * lenne ugyanazon a táblán), és nem is kell a `step-run-repository.ts`
 * futásidejű importja, csak a típusa.
 *
 * **A `requestApproval` és a `decideApproval` a `stepRuns` állapotváltóját
 * a SAJÁT `transaction()` hívásán BELÜL hívja.** A `stepRuns.markStep*`
 * függvények maguk is a megosztott `transaction` függvényt hívják meg
 * (ugyanazzal az aláírással, lásd fent) - ez nem beágyazott
 * `database.transaction()`, hanem a `better-sqlite3`/Drizzle SAVEPOINT
 * alapú, dokumentált tranzakció-beágyazása (`db.inTransaction` esetén a
 * `better-sqlite3` `SAVEPOINT`/`RELEASE`/`ROLLBACK TO` hármast használ a
 * `BEGIN`/`COMMIT`/`ROLLBACK` helyett, forrásból ellenőrizve:
 * `better-sqlite3/lib/methods/transaction.js`, `wrapTransaction`). Ha a
 * belső hívás `Outcome` hibaágat ad (pl. `illegal_status_transition`, mert
 * a lépés futás már nem `waiting_approval`/`running` állapotú), ezt a
 * függvény **továbbadja a saját hibaágaként**: a külső `transaction()`
 * hívás emiatt maga is hibaágat ad, ami a teljes (a `human_approval` sor
 * módosítását is tartalmazó) tranzakciót visszagörgeti - ez a "döntés és a
 * lépés állapotváltás egy tranzakcióban fut" kritikus garancia (T-003-22
 * elfogadási kritérium), futtatott teszttel igazolva
 * (`human-approval-repository.spec.ts`).
 */
export function createHumanApprovalRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
  stepRuns: StepRunRepository,
): HumanApprovalRepository {
  /**
   * Beszúr egy `human_approval` sort `decision: null` értékkel, majd
   * ugyanabban a tranzakcióban `running -> waiting_approval` állapotba
   * viszi a hozzá tartozó lépés futást (SPEC-003 9.2 szekció). Ha az
   * állapotváltás hibázik (pl. a lépés futás nem `running` állapotú), a
   * teljes tranzakció - a most beszúrt `human_approval` sorral együtt -
   * visszagördül.
   */
  function requestApproval(input: RequestApprovalInput): Outcome<HumanApprovalRecord> {
    return transaction(() => {
      const now = new Date();
      const row = {
        id: randomUUID(),
        runId: input.runId,
        stepRunId: input.stepRunId,
        title: input.title,
        body: input.body,
        payload: input.payload,
        requestedAtMs: now,
      };

      database.insert(humanApprovalTable).values(row).run();

      const stepOutcome = stepRuns.markStepWaitingApproval(input.stepRunId);
      if (!isOkOutcome(stepOutcome)) {
        return stepOutcome;
      }

      return {
        kind: 'ok',
        value: {
          ...row,
          /* eslint-disable unicorn/no-null -- a frissen létrehozott jóváhagyás még nincs eldöntve, ez a HumanApprovalRecord valódi kezdő értéke, nem helyőrző */
          decision: null,
          decidedAtMs: null,
          /* eslint-enable unicorn/no-null */
        },
      };
    });
  }

  /**
   * Compare-and-set jellegű döntés (SPEC-003 7.3 szekció elve, "két,
   * egymást erősítő mechanizmus"): az `UPDATE ... WHERE step_run_id = ? AND
   * decision IS NULL` csak akkor módosít sort, ha még nincs döntés. Nulla
   * módosított sor esetén egy külön `SELECT` dönti el, hogy a sor
   * hiányzik-e (`not_found`) vagy már el van döntve (`already_decided`) -
   * ez a diagnosztikai olvasás nem versenyhelyzet-érzékeny, mert mindkettő
   * ugyanabban, a hívó számára láthatatlan tranzakcióban fut, és SQLite
   * egyetlen író kapcsolatán belül a saját írás mindig látszik.
   *
   * Sikeres `UPDATE` után a lépés futás állapotváltása következik,
   * ugyanabban a tranzakcióban: `approved` esetén `markStepSucceeded`,
   * `rejected` esetén `markStepRejected` (SPEC-003 7.2 táblázat,
   * `waiting_approval -> succeeded`/`rejected`). A `human_approval` node
   * configja (4.3 szekció: `title`, `bodyTemplate`) nem hordoz strukturált
   * kimenet mezőt, ezért a `markStepSucceeded` `output` paraméter nélkül
   * hívva helyes. Ha ez az állapotváltás hibázik, a hívás a hibát
   * továbbadja, ami a teljes tranzakciót - a fenti `UPDATE`-tel együtt -
   * visszagörgeti.
   */
  function decideApproval(input: DecideApprovalInput): Outcome<HumanApprovalRecord> {
    return transaction(() => {
      const now = new Date();
      const row = database
        .update(humanApprovalTable)
        .set({ decision: input.decision, decidedAtMs: now })
        .where(and(eq(humanApprovalTable.stepRunId, input.stepRunId), isNull(humanApprovalTable.decision)))
        .returning()
        .get();
      // Ugyanaz a Drizzle tipizálási pontatlanság, mint a
      // `step-run-repository.ts` `transitionStep`-jében: a
      // `.returning().get()` deklarált típusa nem tartalmaz `undefined`-et,
      // holott nulla módosított sorra ténylegesen azt ad vissza.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- lásd a fenti indoklást
      if (row === undefined) {
        const existing = database
          .select({ id: humanApprovalTable.id })
          .from(humanApprovalTable)
          .where(eq(humanApprovalTable.stepRunId, input.stepRunId))
          .get();
        if (existing === undefined) {
          return { kind: 'error', message: notFoundMessage(input.stepRunId) };
        }
        return { kind: 'error', message: alreadyDecidedMessage(input.stepRunId) };
      }

      const stepOutcome =
        input.decision === 'approved'
          ? stepRuns.markStepSucceeded(input.stepRunId)
          : stepRuns.markStepRejected(input.stepRunId);
      if (!isOkOutcome(stepOutcome)) {
        return stepOutcome;
      }

      return toHumanApprovalRecord(row);
    });
  }

  function getApprovalForStep(stepRunId: string): Outcome<HumanApprovalRecord> {
    return transaction(() => {
      const row = database.select().from(humanApprovalTable).where(eq(humanApprovalTable.stepRunId, stepRunId)).get();
      if (row === undefined) {
        return { kind: 'error', message: notFoundMessage(stepRunId) };
      }
      return toHumanApprovalRecord(row);
    });
  }

  /**
   * `decision IS NULL`, `requested_at_ms` szerint növekvő sorrendben: a
   * `human_approval_pending_idx` `(decision, requested_at_ms)` indexet
   * használja ki (SPEC-003 4.12 szekció, F-10: SQLite az indexben tárolja a
   * NULL értékeket is).
   */
  function listPendingApprovals(): Outcome<readonly HumanApprovalRecord[]> {
    return transaction(() => {
      const rows = database
        .select()
        .from(humanApprovalTable)
        .where(isNull(humanApprovalTable.decision))
        .orderBy(asc(humanApprovalTable.requestedAtMs))
        .all();
      return { kind: 'ok', value: rows.map((row) => toPendingApprovalRecord(row)) };
    });
  }

  return { requestApproval, decideApproval, getApprovalForStep, listPendingApprovals };
}
