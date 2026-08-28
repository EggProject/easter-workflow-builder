import { randomUUID } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { isProviderId, type ProviderId } from '@easter-workflow-builder/provider-capability';
import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';
import { canonicalizeSnapshotDocument } from '../graph-snapshot/canonicalize-snapshot-document.ts';
import { computeSnapshotHash } from '../graph-snapshot/compute-snapshot-hash.ts';
import { resolveSnapshotReuse } from '../graph-snapshot/resolve-snapshot-reuse.ts';
import { readGraphSnapshot } from '../graph-snapshot/read-graph-snapshot.ts';
import { graphSnapshotTable } from '../graph-snapshot/graph-snapshot.ts';
import type { GraphSnapshotDocument } from '../graph-snapshot/graph-snapshot-document.ts';
import { isStringArray } from '../workflow-graph/is-string-array.ts';
import { appSettingTable, APP_SETTING_ROW_ID } from '../app-setting/app-setting.ts';
import { insertEngineEventRow } from '../run-event/insert-engine-event-row.ts';
import { workflowRunTable } from './workflow-run.ts';
import { canTransitionRunStatus } from './can-transition-run-status.ts';
import { isRunStatus } from './is-run-status.ts';
import type { RunStatus } from './run-status.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört (`database-context.ts`
 * a `WorkflowRunRepository` típust importálja innen), ugyanaz a minta, mint a
 * `workflow-graph/workflow-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

/**
 * Egy al-workflow futás szülő láncának a `startRun` beszúráshoz szükséges
 * részlete: a hívó (a motor) ezt a saját, már betöltött futás rekordjából
 * adja át. Lásd a `StartRunInput.parent` mező dokumentációját.
 */
export interface StartRunParentContext {
  readonly rootRunId: string;
  readonly depth: number;
  readonly workflowAncestry: readonly string[];
}

/**
 * A `startRun` bemenete (SPEC-003 9.2 szekció). A `graphSnapshotDocument` már
 * kész, feloldott dokumentum: a háromszintű provider feloldást és a
 * pillanatkép összeállítását (a workflow gráfjának kiolvasását és
 * `GraphSnapshotDocument`-té alakítását) a motor (`@easter-workflow-builder/engine`)
 * végzi egy későbbi specifikációban, ez a repository csak a már kész
 * dokumentumot fogadja.
 *
 * A `providerId` a futásra feloldott, befagyasztott provider (4.8 szekció,
 * `workflow_run.provider_id` NOT NULL): ezt is a motor adja meg, már
 * feloldva, nem a repository oldja fel.
 *
 * A `parent` mező adja meg az al-workflow hívás szülő kontextusát. Ha
 * hiányzik, a futás gyökér: `rootRunId` a saját, most generált `id`, `depth`
 * 0, `workflowAncestry` a `[workflowId]` egyelemű lista (SPEC-003 4.8
 * szekció). Ha jelen van, a hívó a szülő futás már ismert
 * `rootRunId`/`depth`/`workflowAncestry` értékét adja át, és a repository
 * ebből vezeti le a gyerek futás `rootRunId` (= a szülőével azonos gyökér),
 * `depth` (= szülő `depth` + 1) és `workflowAncestry` (= szülő lista plusz a
 * mostani `workflowId`) mezőjét. Nincs külön `parentRunId` mező: a
 * `workflow_run` táblának nincs ilyen oszlopa, a szülő-gyerek kapcsolatot a
 * `step_run.sub_workflow_run_id` hordozza majd (T-003-17/18), nem a
 * `workflow_run` sor.
 */
export interface StartRunInput {
  readonly workflowId: string;
  readonly input: unknown;
  readonly providerId: ProviderId;
  readonly graphSnapshotDocument: GraphSnapshotDocument;
  readonly restartedFromRunId?: string;
  readonly parent?: StartRunParentContext;
}

export interface WorkflowRunRecord {
  readonly id: string;
  readonly workflowId: string;
  readonly status: RunStatus;
  readonly input: unknown;
  readonly providerId: ProviderId;
  readonly rootRunId: string;
  readonly depth: number;
  readonly workflowAncestry: readonly string[];
  readonly graphSnapshotHash: string;
  readonly persistedStreamDeltas: boolean;
  readonly restartedFromRunId: string | null;
  readonly createdAtMs: Date;
  readonly startedAtMs: Date | null;
  readonly finishedAtMs: Date | null;
  readonly errorKind: string | null;
  readonly errorMessage: string | null;
}

export interface WorkflowRunRepository {
  startRun(input: StartRunInput): Outcome<WorkflowRunRecord>;
  getRun(runId: string): Outcome<WorkflowRunRecord>;
  listRuns(): Outcome<readonly WorkflowRunRecord[]>;
  listRunsForWorkflow(workflowId: string): Outcome<readonly WorkflowRunRecord[]>;
  markRunRunning(runId: string): Outcome<WorkflowRunRecord>;
  markRunSucceeded(runId: string): Outcome<WorkflowRunRecord>;
  markRunFailed(runId: string, errorKind: string, errorMessage: string): Outcome<WorkflowRunRecord>;
  markRunCancelled(runId: string): Outcome<WorkflowRunRecord>;
  readSnapshot(runId: string): Outcome<GraphSnapshotDocument>;
}

const ALL_RUN_STATUSES: readonly RunStatus[] = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
];

function notFoundMessage(runId: string): string {
  return `A(z) "${runId}" azonosítójú futás nem található (not_found).`;
}

function illegalTransitionMessage(runId: string, to: RunStatus): string {
  return `A(z) "${runId}" futás nem vihető át "${to}" állapotba: nem létezik, vagy a jelenlegi állapota nem engedi ezt az átmenetet (illegal_status_transition).`;
}

/**
 * A `canTransitionRunStatus` átmeneti táblájából vezeti le, mely jelenlegi
 * állapotokból engedett a `to` állapotba lépés (SPEC-003 7.3 szekció, "két,
 * egymást erősítő mechanizmus"). Ez a `WHERE status IN (...)` feltétel
 * forrása a compare-and-set `UPDATE`-ben: egyetlen igazságforrás a két
 * mechanizmus között, nincs külön, kézzel karbantartott lista.
 */
function allowedFromStatuses(to: RunStatus): readonly RunStatus[] {
  return ALL_RUN_STATUSES.filter((from) => canTransitionRunStatus(from, to));
}

/**
 * A nyers Drizzle sor típusos `WorkflowRunRecord`-dá alakítása, a `status`,
 * `provider_id` és `workflow_ancestry` oszlop typeguard alapú szűkítésével
 * (SPEC-003 9.4 szekció): egyik oszlopon sincs DB szintű `CHECK`, tehát egy
 * korrupt sor lehetséges, és ezt itt kell kiszűrni, nem a hívónál.
 */
function toWorkflowRunRecord(row: typeof workflowRunTable.$inferSelect): Outcome<WorkflowRunRecord> {
  const providerId = row.providerId;
  if (!isProviderId(providerId)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" futás provider_id mezője érvénytelen: "${providerId}" (invalid_provider_id).`,
    };
  }
  const status = row.status;
  if (!isRunStatus(status)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" futás status mezője érvénytelen: "${status}" (invalid_run_status).`,
    };
  }
  const workflowAncestry = row.workflowAncestry;
  if (!isStringArray(workflowAncestry)) {
    return {
      kind: 'error',
      message: `A(z) "${row.id}" futás workflow_ancestry mezője nem szövegtömb (corrupt_workflow_ancestry).`,
    };
  }
  return {
    kind: 'ok',
    value: {
      id: row.id,
      workflowId: row.workflowId,
      status,
      input: row.input,
      providerId,
      rootRunId: row.rootRunId,
      depth: row.depth,
      workflowAncestry,
      graphSnapshotHash: row.graphSnapshotHash,
      persistedStreamDeltas: row.persistedStreamDeltas,
      restartedFromRunId: row.restartedFromRunId,
      createdAtMs: row.createdAtMs,
      startedAtMs: row.startedAtMs,
      finishedAtMs: row.finishedAtMs,
      errorKind: row.errorKind,
      errorMessage: row.errorMessage,
    },
  };
}

function collectRunRecords(
  rows: readonly (typeof workflowRunTable.$inferSelect)[],
): Outcome<readonly WorkflowRunRecord[]> {
  const records: WorkflowRunRecord[] = [];
  for (const row of rows) {
    const outcome = toWorkflowRunRecord(row);
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
export function createWorkflowRunRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): WorkflowRunRepository {
  /**
   * Nyers SQL `SELECT`, a Drizzle `graph_snapshot.document` oszlop
   * `mapFromDriverValue`-ja (`JSON.parse`) **megkerülésével**: a
   * `resolveSnapshotReuse` bájtra pontos szöveg-összehasonlítást igényel
   * (SPEC-003 5.6, "Ütközés kezelés"), egy `JSON.parse` utáni újra-
   * szerializálás pedig már nem adná vissza ugyanazt a bájtsort (F-26, lásd
   * a `startRun` beszúrás dokumentációja lent). A `document` oszlop a
   * sémában `NOT NULL TEXT` (`graph-snapshot.ts`), és ez a lekérdezés
   * ugyanebben a fájlban, ugyanerre a táblára íródik, tehát a sor alakja a
   * saját kódunk által garantált, nem külső/JSON payload tartalom - ezért
   * nincs itt typeguard, csak explicit generikus típusparaméter, ahogy a
   * Drizzle dokumentációja is mutatja nyers `sql` lekérdezésekre
   * (https://orm.drizzle.team/docs/goodies#raw-sql-queries-execution).
   */
  function readStoredCanonicalText(hash: string): string | null {
    const row = database.get<{ document: string }>(sql`SELECT document FROM graph_snapshot WHERE hash = ${hash}`);
    // A Drizzle `BaseSQLiteDatabase.get<T>()` deklarált visszatérési típusa
    // (`DBResult<'sync', T>`, ami `sync` módban pontosan `T`) NEM tartalmazza
    // az `undefined`-et, holott a mögöttes `better-sqlite3` `stmt.get()`
    // ténylegesen `undefined`-et ad nulla találatra (`drizzle-orm/better-
    // sqlite3/session.js`, `PreparedQuery.get`: `if (!fields && !customResultMapper)
    // { return stmt.get(...params); }` - típusannotáció nélküli továbbadás).
    // Ez a Drizzle csomag típusdefiníciójának pontatlansága, nem a mi
    // kódunk hibája, ezért a védelem indokolt, a `null` pedig valódi adat
    // ("nincs ilyen lenyomat"), nem helyőrző.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison, unicorn/no-null -- lásd a fenti indoklást
    return row === undefined ? null : row.document;
  }

  /**
   * A globális `persist_stream_deltas` beállítás olvasása, ugyanabban a
   * tranzakcióban, mint a `startRun` többi lépése (SPEC-003 6.6 szekció:
   * "A `startRun` a saját tranzakcióján belül olvassa ki az akkor érvényes
   * globális beállítást, és beírja a futás sorába"). Nem az
   * `AppSettingRepository.readSettings()`-et hívja: az egy saját, önálló
   * `transaction()` hívást indítana ugyanazon a `better-sqlite3` kapcsolaton,
   * amíg a `startRun` tranzakciója már fut - ehelyett közvetlen, típusos
   * `select` az `app_setting` táblára, ugyanaz az elv, mint a
   * `readStoredCanonicalText`-nél (a `graph_snapshot` táblát is közvetlenül
   * olvassa a saját fájlján belül, nem egy másik repository-n át). Üres
   * táblán (nincs sor, 4.13 szekció "A sor életciklusa") a séma szintű
   * `DEFAULT`-tal egyező hamis alapértéket ad.
   */
  function isPersistStreamDeltasEnabled(): boolean {
    const row = database
      .select({ persistStreamDeltas: appSettingTable.persistStreamDeltas })
      .from(appSettingTable)
      .where(eq(appSettingTable.id, APP_SETTING_ROW_ID))
      .get();
    return row === undefined ? false : row.persistStreamDeltas;
  }

  /**
   * `startRun`, az egyetlen beszúrási út a `workflow_run` táblára (SPEC-003
   * 15. kritérium). Egy tranzakcióban:
   *
   * 1. Kanonizálja a dokumentumot, lenyomatot képez, és a `resolveSnapshotReuse`
   *    dönti el, kell-e beszúrni a `graph_snapshot` sort (5.6 szekció).
   * 2. **A beszúrás nyers SQL-lel történik, nem a Drizzle típusos
   *    `insert(graphSnapshotTable)` hívásával.** A `graph_snapshot.document`
   *    Drizzle oszlop `mode: 'json'`, tehát `mapToDriverValue` íráskor
   *    `JSON.stringify`-t futtatna a kanonikus szövegből visszaparsolt
   *    objektumon - ez viszont **nem** garantáltan ugyanaz a bájtsor, mint a
   *    kanonikus szöveg: a `JSON.stringify` az egész indexű kulcsokat (`"9"`,
   *    `"10"`) mindig növekvő számsorrendben írja ki, az RFC 8785 viszont
   *    UTF-16 sorrendet ír elő, ahol a `"10"` megelőzi a `"9"` kulcsot (F-26,
   *    SPEC-003 5.6 szekció, 2. pont). Egy ilyen dokumentum esetén a
   *    típusos beszúrás **eltérő** szöveget írna be, mint amiből a `hash`
   *    lett, és a 45. kritérium (`crypto.hash('sha256', document) = hash`
   *    minden sorra) sérülne. A nyers `sql` INSERT a kanonikus szöveget
   *    változtatás nélkül, bájtra pontosan írja be a `document` oszlopba.
   * 3. A delta kapcsoló befagyasztása: a globális `app_setting.persist_stream_deltas`
   *    beállítás olvasása ugyanebben a tranzakcióban (`isPersistStreamDeltasEnabled`,
   *    lent), és az akkor érvényes érték beírása a `workflow_run.persisted_stream_deltas`
   *    oszlopba (SPEC-003 6.6 szekció, "Futás közben nem változhat"; T-003-23
   *    zárta le a korábbi NYITOTT PONTot, ami a szállított hamis alapértéket
   *    írta be helyette).
   * 4. A `workflow_run` sor beszúrása, `status: 'pending'` kezdő állapottal
   *    (7.1 táblázat): a `startRun` nem viszi `running`-ba, azt a motor teszi
   *    a `markRunRunning` hívással, amikor ténylegesen elindítja az első
   *    lépést.
   * 5. A `run_started` esemény írása, ugyanebben a tranzakcióban
   *    (`insertEngineEventRow`, lásd lent).
   */
  function startRun(input: StartRunInput): Outcome<WorkflowRunRecord> {
    return transaction(() => {
      const canonicalOutcome = canonicalizeSnapshotDocument(input.graphSnapshotDocument);
      if (!isOkOutcome(canonicalOutcome)) {
        return canonicalOutcome;
      }
      const canonicalText = canonicalOutcome.value;
      const hash = computeSnapshotHash(canonicalText);

      const storedDocument = readStoredCanonicalText(hash);
      const reuseOutcome = resolveSnapshotReuse(storedDocument, canonicalText);
      if (!isOkOutcome(reuseOutcome)) {
        return reuseOutcome;
      }

      const now = new Date();

      if (reuseOutcome.value === 'insert') {
        database.run(sql`
          INSERT INTO graph_snapshot (hash, document_version, document, first_captured_at_ms)
          VALUES (${hash}, ${input.graphSnapshotDocument.version}, ${canonicalText}, ${now.getTime()})
        `);
      }

      const id = randomUUID();
      const rootRunId = input.parent === undefined ? id : input.parent.rootRunId;
      const depth = input.parent === undefined ? 0 : input.parent.depth + 1;
      const workflowAncestry =
        input.parent === undefined ? [input.workflowId] : [...input.parent.workflowAncestry, input.workflowId];

      const row = {
        id,
        workflowId: input.workflowId,
        status: 'pending' as const,
        input: input.input,
        providerId: input.providerId,
        rootRunId,
        depth,
        workflowAncestry,
        graphSnapshotHash: hash,
        // A globális beállítás befagyasztott értéke, ugyanebben a
        // tranzakcióban olvasva (lásd `isPersistStreamDeltasEnabled` fent,
        // SPEC-003 6.6 szekció, 38. és 57. kritérium).
        persistedStreamDeltas: isPersistStreamDeltasEnabled(),
        // `input.restartedFromRunId` a `StartRunInput`-ban opcionális
        // (`?: string`, tehát hiányzó mezőnél `undefined`), a DB oszlop
        // viszont nullázható (`string | null`, SPEC-003 4.8): a `null` itt
        // a "nincs újraindítás" valódi tárolt értéke, nem helyőrző.
        // eslint-disable-next-line unicorn/no-null -- lásd a fenti indoklást
        restartedFromRunId: input.restartedFromRunId ?? null,
        createdAtMs: now,
      };

      database.insert(workflowRunTable).values(row).run();

      // A `run_started` esemény írása, ugyanabban a tranzakcióban, mint a
      // fenti futás sor (SPEC-003 6.6 szekció, T-003-21 zárja le a T-003-16
      // "NYITOTT PONT" kommentjét). Az `insertEngineEventRow`
      // (`run-event/insert-engine-event-row.ts`) PLAIN, tranzakció nélküli
      // segédfüggvény - nem nyit saját `database.transaction()`-t, ezért itt,
      // a `startRun` saját tranzakciós kontextusában közvetlenül hívható,
      // beágyazott tranzakció nélkül. Ugyanezt a függvényt használja a
      // `RunEventRepository.appendEngineEvent` is, a saját `transaction()`
      // hívásába csomagolva. `stepRunId: null`, mert ez futás szintű esemény
      // (6.2 szekció).
      //
      // A visszaadott `Outcome`-ot szándékosan nem ágaztatjuk el: a
      // `not_found` hibaág kizárólag akkor jönne, ha a `row.id` futás nem
      // létezne a `workflow_run` táblában, ez viszont a fenti `insert()`
      // sikeres lefutása után, UGYANEBBEN a tranzakcióban, UGYANAZON a
      // kapcsolaton logikailag kizárt (a SQLite egy kapcsolat egy, még nem
      // commitolt tranzakcióján belül mindig látja a saját írását). Egy
      // elágazás ide egy soha nem futó ágat vinne be, amit a SPEC-003 12.4
      // szekció 100 százalékos, kizárás nélküli lefedettségi küszöbe nem
      // engedne meg; a `not_found` ág valós tesztje a
      // `run-event-repository.spec.ts` `appendEngineEvent`-jén fut, ismeretlen
      // `runId`-val.
      insertEngineEventRow(database, {
        runId: row.id,
        // eslint-disable-next-line unicorn/no-null -- futás szintű esemény: a run_event.step_run_id valódi NULL értéke, nem helyőrző (SPEC-003 6.2 szekció)
        stepRunId: null,
        kind: 'run_started',
        occurredAtMs: now,
        payload: { runId: row.id, workflowId: row.workflowId },
      });

      return {
        kind: 'ok',
        value: {
          id: row.id,
          workflowId: row.workflowId,
          status: row.status,
          input: row.input,
          providerId: row.providerId,
          rootRunId: row.rootRunId,
          depth: row.depth,
          workflowAncestry: row.workflowAncestry,
          graphSnapshotHash: row.graphSnapshotHash,
          persistedStreamDeltas: row.persistedStreamDeltas,
          restartedFromRunId: row.restartedFromRunId,
          createdAtMs: row.createdAtMs,
          // A frissen létrehozott sor még egyik időbélyeget vagy hiba mezőt
          // sem tölti ki (7.1 táblázat: `pending` a kezdő állapot), a `null`
          // itt a `WorkflowRunRecord` nullázható mezőinek valódi kezdő
          // értéke, nem helyőrző.
          /* eslint-disable unicorn/no-null -- lásd a fenti indoklást */
          startedAtMs: null,
          finishedAtMs: null,
          errorKind: null,
          errorMessage: null,
          /* eslint-enable unicorn/no-null */
        },
      };
    });
  }

  function getRun(runId: string): Outcome<WorkflowRunRecord> {
    return transaction(() => {
      const row = database.select().from(workflowRunTable).where(eq(workflowRunTable.id, runId)).get();
      if (row === undefined) {
        return { kind: 'error', message: notFoundMessage(runId) };
      }
      return toWorkflowRunRecord(row);
    });
  }

  /**
   * `created_at_ms` szerint csökkenő sorrendben, ugyanaz az elv, mint a
   * `WorkflowRepository.listWorkflows`-nál: a legutóbb indított futás a
   * leghasznosabb elöl.
   */
  function listRuns(): Outcome<readonly WorkflowRunRecord[]> {
    return transaction(() => {
      const rows = database.select().from(workflowRunTable).orderBy(desc(workflowRunTable.createdAtMs)).all();
      return collectRunRecords(rows);
    });
  }

  /**
   * A `workflow_run_workflow_created_idx` (4.8 szekció) a `(workflow_id,
   * created_at_ms)` oszlopokon áll, pontosan ezt a szűrést és rendezést
   * szolgálja ki.
   */
  function listRunsForWorkflow(workflowId: string): Outcome<readonly WorkflowRunRecord[]> {
    return transaction(() => {
      const rows = database
        .select()
        .from(workflowRunTable)
        .where(eq(workflowRunTable.workflowId, workflowId))
        .orderBy(desc(workflowRunTable.createdAtMs))
        .all();
      return collectRunRecords(rows);
    });
  }

  /**
   * Compare-and-set állapotváltás (SPEC-003 7.3 szekció): egyetlen `UPDATE
   * ... WHERE id = ? AND status IN (...)`, a megengedett jelenlegi
   * állapotokat a `canTransitionRunStatus`-ból vezetve le. A `RETURNING`
   * záradék (SQLite 3.35+, `better-sqlite3` 13.0.3) egy kérésben adja vissza
   * a frissített sort, tehát nincs külön újraolvasás - és nincs olyan
   * (elméletben elérhetetlen) ág sem, ahol az `UPDATE` sikeres, de az
   * utólagos `SELECT` mégsem találná a sort.
   *
   * Nulla módosított sor (nincs ilyen futás, vagy a jelenlegi állapota nem
   * engedi ezt az átmenetet) `illegal_status_transition` hibaágat ad, nem
   * csendben nem csinál semmit.
   */
  function transitionRun(
    runId: string,
    to: RunStatus,
    extraColumns: Partial<typeof workflowRunTable.$inferInsert>,
  ): Outcome<WorkflowRunRecord> {
    return transaction(() => {
      const allowedStatuses = allowedFromStatuses(to);
      const row = database
        .update(workflowRunTable)
        .set({ status: to, ...extraColumns })
        .where(and(eq(workflowRunTable.id, runId), inArray(workflowRunTable.status, allowedStatuses)))
        .returning()
        .get();
      // Ugyanaz a Drizzle tipizálási pontatlanság, mint a
      // `readStoredCanonicalText`-ben: a `.returning().get()` deklarált
      // típusa nem tartalmazza az `undefined`-et, holott nulla módosított
      // sorra ténylegesen azt ad vissza (ugyanaz a `better-sqlite3`
      // `stmt.get()` mögöttes viselkedés).
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, sonarjs/different-types-comparison -- lásd a fenti indoklást
      if (row === undefined) {
        return { kind: 'error', message: illegalTransitionMessage(runId, to) };
      }
      return toWorkflowRunRecord(row);
    });
  }

  function markRunRunning(runId: string): Outcome<WorkflowRunRecord> {
    return transitionRun(runId, 'running', { startedAtMs: new Date() });
  }

  function markRunSucceeded(runId: string): Outcome<WorkflowRunRecord> {
    return transitionRun(runId, 'succeeded', { finishedAtMs: new Date() });
  }

  function markRunFailed(runId: string, errorKind: string, errorMessage: string): Outcome<WorkflowRunRecord> {
    return transitionRun(runId, 'failed', { finishedAtMs: new Date(), errorKind, errorMessage });
  }

  function markRunCancelled(runId: string): Outcome<WorkflowRunRecord> {
    return transitionRun(runId, 'cancelled', { finishedAtMs: new Date() });
  }

  /**
   * A futás pillanatképének visszaolvasása: `workflow_run.graph_snapshot_hash`
   * -> `graph_snapshot.document` -> `readGraphSnapshot` verziódiszpécser
   * (SPEC-003 9.2 szekció). Itt a típusos Drizzle `select` elég (nem kell a
   * `startRun` bájt-pontos nyers SQL-je): olvasáskor a `readGraphSnapshot`
   * úgyis `unknown`-ként dolgozik a parsolt objektumon, nincs
   * szöveg-összehasonlítás.
   *
   * A hiányzó pillanatkép sor (`snapshotRow === undefined`) a bekapcsolt
   * `ON DELETE RESTRICT` (F-27) miatt rendes úton megnyitott kapcsolaton nem
   * fordulhat elő; a defenzív ág egy `foreign_keys` pragma nélkül nyitott
   * (tehát megsérült hivatkozású) adatbázison mutatkozhat meg, ugyanúgy,
   * ahogy a 12. kritérium már tesztel egy hasonló, pragma nélküli esetet.
   */
  function readSnapshot(runId: string): Outcome<GraphSnapshotDocument> {
    return transaction(() => {
      const runRow = database
        .select({ graphSnapshotHash: workflowRunTable.graphSnapshotHash })
        .from(workflowRunTable)
        .where(eq(workflowRunTable.id, runId))
        .get();
      if (runRow === undefined) {
        return { kind: 'error', message: notFoundMessage(runId) };
      }

      const snapshotRow = database
        .select({ document: graphSnapshotTable.document })
        .from(graphSnapshotTable)
        .where(eq(graphSnapshotTable.hash, runRow.graphSnapshotHash))
        .get();
      if (snapshotRow === undefined) {
        return {
          kind: 'error',
          message: `A(z) "${runId}" futáshoz tartozó gráf pillanatkép nem található (not_found).`,
        };
      }

      return readGraphSnapshot(snapshotRow.document);
    });
  }

  return {
    startRun,
    getRun,
    listRuns,
    listRunsForWorkflow,
    markRunRunning,
    markRunSucceeded,
    markRunFailed,
    markRunCancelled,
    readSnapshot,
  };
}
