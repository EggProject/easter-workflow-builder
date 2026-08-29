import type { NodeType, SnapshotEdge } from '@easter-workflow-builder/db';
import type { BranchContext, BranchScope } from '../branch-scope/branch-scope.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import { buildFanOutItemContext } from './build-fan-out-item-context.ts';
import { buildScopedKey } from './build-scoped-key.ts';
import type { EdgeMark } from './edge-mark.ts';
import type { FanOutExpansion } from './fan-out-expansion.ts';
import type { ReadyInstance } from './ready-instance.ts';
import { resolveInstanceReadiness } from './resolve-instance-readiness.ts';
import type { RunTopology } from './run-topology.ts';
import type { SchedulerState } from './scheduler-state.ts';
import type { SchedulingEvent } from './scheduling-event.ts';

// A `SchedulerState` mutálható másolata, amin egyetlen `advanceScheduler` hívás
// dolgozik. Szerkezetileg illeszkedik a `SchedulerState` alakra (a `Map`, a
// `Set` és a tömb is értékadható a readonly párjára), ezért a köztes állapot a
// tiszta olvasó függvényeknek átadható, és a kész draft maga a visszaadott
// állapot. A hívó által kapott állapot érintetlen marad, mert a másolás
// mezőnként megtörténik.
interface SchedulerDraft {
  readonly edgeMarks: Map<string, EdgeMark>;
  readonly fanOutExpansions: Map<string, FanOutExpansion>;
  readonly fanOutItems: Map<string, readonly unknown[]>;
  readonly loopScopeOwners: Map<string, string>;
  readonly loopRunCounts: Map<string, number>;
  readonly readyInstances: ReadyInstance[];
  readonly runningInstanceKeys: Set<string>;
  nextArrivalSequence: number;
}

// Egy jelölés kiírási menet: a draft, a változatlan topológia, és az érintett
// cél példányok, amiket a menet végén ki kell értékelni.
interface MarkBatch {
  readonly draft: SchedulerDraft;
  readonly topology: RunTopology;
  readonly touched: StepInstanceReference[];
}

// Halott példány kimenő élein egyetlen `live` jelölés sincs (SPEC-004 4.4
// 3. pont), ezért a halott ág terjedése ezzel az üres halmazzal megy.
const NO_LIVE_EDGE_IDS: ReadonlySet<string> = new Set();

function toDraft(state: SchedulerState): SchedulerDraft {
  return {
    edgeMarks: new Map(state.edgeMarks),
    fanOutExpansions: new Map(state.fanOutExpansions),
    fanOutItems: new Map(state.fanOutItems),
    loopScopeOwners: new Map(state.loopScopeOwners),
    loopRunCounts: new Map(state.loopRunCounts),
    readyInstances: [...state.readyInstances],
    runningInstanceKeys: new Set(state.runningInstanceKeys),
    nextArrivalSequence: state.nextArrivalSequence,
  };
}

function instanceKeyOf(instance: StepInstanceReference): string {
  return buildScopedKey(instance.nodeId, instance.branchContext);
}

// Egy node kimenő élei. A `buildExecutableGraph` csak azokhoz a node-okhoz
// vesz fel bejegyzést, amikhez tartozik él, tehát a terminális node-ra a
// térkép semmit nem ad; a hiány üres listát jelent, nem hibát.
function outgoingEdgesOf(topology: RunTopology, nodeId: string): readonly SnapshotEdge[] {
  return topology.graph.outgoingEdges.get(nodeId) ?? [];
}

// A futtathatóvá vált példány a sor végére kerül, és megkapja a következő
// érkezési sorszámot (SPEC-004 7.1).
//
// **A sorba állítás idempotens: egy példány egyszerre legfeljebb egyszer állhat
// a sorban.** Egy menet több úton is eljuthat ugyanahhoz a példányhoz - a
// `settleTouched` a jelölésenként érintett célokat járja be, a halott ág
// terjesztése (`settleInstance` `dead` ága) pedig saját, beágyazott menetben
// újra kiértékelheti ugyanazt a példányt. Egy `branch` node halott és élő ága
// ugyanabba a lentebbi node-ba visszatalálkozva pontosan így viselkedik, és a
// duplikálás **az élek pillanatképbeli sorrendjétől** függött: halott él elöl a
// példány kétszer került a sorba, élő él elöl egyszer. Kétszeri sorba állásból
// két `step_run` sor keletkezne ugyanarra a példányra, és a `run-supervisor`
// `inFlight` térképe (példány kulcs -> `Promise`) az egyik futó lépés
// eredményét el is veszítené. A sorrendfüggés a 4.4 2. pontjával is
// ellentmondott: a futtathatóság a jelöléseken áll, nem az élek felsorolásán.
function enqueue(draft: SchedulerDraft, instance: StepInstanceReference): void {
  const instanceKey = instanceKeyOf(instance);
  if (draft.readyInstances.some((ready) => instanceKeyOf(ready.instance) === instanceKey)) {
    return;
  }
  draft.readyInstances.push({ instance, arrivalSequence: draft.nextArrivalSequence });
  draft.nextArrivalSequence += 1;
}

// A `loop` node saját kontextusa egy visszaél forrásának kontextusából: a
// visszaél a törzsből mutat vissza, tehát a forrás vermében ott áll a ciklus
// hatókör bejegyzése, amit a jelöléshez le kell venni. A keretet a nyitó lépés
// futásának azonosítója azonosítja (`loopScopeOwners`), nem a verem tetején
// álló pozíció, mert a törzsben további hatókörök is nyílhatnak. A bejárás
// előre halad, ezért az utolsó találat a legbelső keret.
function findLoopOuterContext(draft: SchedulerDraft, context: BranchContext, loopNodeId: string): BranchContext {
  let cut = context.length;

  for (const [index, scope] of context.entries()) {
    if (scope.kind === 'loop' && draft.loopScopeOwners.get(scope.stepRunId) === loopNodeId) {
      cut = index;
    }
  }

  return context.slice(0, cut);
}

// Az élre kerülő jelölés ág kontextusa. Alapesetben a forrás példány
// kontextusa, mert a hatókört nyitó élekre nem itt kerül jelölés (lásd
// `isScopeOpeningEdge`). Visszaélnél a `loop` node saját, külső kontextusa.
function markContextOnEdge(batch: MarkBatch, sourceContext: BranchContext, edge: SnapshotEdge): BranchContext {
  return batch.topology.loopBackEdgeIds.has(edge.id)
    ? findLoopOuterContext(batch.draft, sourceContext, edge.targetNodeId)
    : sourceContext;
}

// Az élen álló jelölés által érintett példány. A `join` node kivétel: az élen
// a belső, `fan_out` kerettel bővült verem áll, a `join` példány viszont a
// külső veremben fut, és a verem tetején álló keretet éppen ő veszi le
// (SPEC-004 4.5). Hogy a levett keret `fan_out` fajtájú, azt a futás indítási
// validáció `unbalanced_fan_out_scope` ellenőrzése garantálja.
function targetInstanceOf(
  topology: RunTopology,
  edge: SnapshotEdge,
  markContext: BranchContext,
): StepInstanceReference {
  const targetType = topology.graph.nodesById.get(edge.targetNodeId)?.type;

  return {
    nodeId: edge.targetNodeId,
    branchContext: targetType === 'join' ? markContext.slice(0, -1) : markContext,
  };
}

// Egy jelölés kiírása, és a cél példány felvétele a kiértékelendők közé.
//
// **A halott visszaél nem indít lefutást.** A `loop` node visszaélei
// külön-külön indítanak egy újabb lefutást (SPEC-004 4.6, "A visszaél nem
// vár"), de ez kizárólag a `live` jelölésre igaz: a törzs egy halott ágából
// érkező `dead` jelölés a már lefutott `loop` példányon nem jelent új
// iterációt, és a példányt halottá sem teheti, hiszen a belépő élein `live`
// jelölés áll.
function placeMark(batch: MarkBatch, edge: SnapshotEdge, context: BranchContext, mark: EdgeMark): void {
  batch.draft.edgeMarks.set(buildScopedKey(edge.id, context), mark);

  if (mark === 'dead' && batch.topology.loopBackEdgeIds.has(edge.id)) {
    return;
  }

  batch.touched.push(targetInstanceOf(batch.topology, edge, context));
}

// Az az él, ami a forrás node lefutásakor **új hatókört nyit**: a `fan_out`
// nem hiba ágai és a `loop` `continue` ágai. Ugyanaz a két eset, amit a
// `branch-scope` téma `stackOnOutgoingEdge` függvénye is megkülönböztet.
function isScopeOpeningEdge(nodeType: NodeType | undefined, edge: SnapshotEdge): boolean {
  return (
    (nodeType === 'fan_out' && edge.branchKey !== 'on_error') || (nodeType === 'loop' && edge.branchKey === 'continue')
  );
}

// A `fan_out` kibontás bejegyzése, és a hozzá párosított `join` példányok
// felvétele a kiértékelendők közé. A `join` a jelölésekből nem tudná meg sem
// az `N = 0` esetet, sem azt, hogy a `fan_out` példány halott, mert egyik
// esetben sem nyílik belső kontextus; a bejegyzés pontosan ezt a két állapotot
// hordozza (SPEC-004 4.5).
function recordExpansion(batch: MarkBatch, instance: StepInstanceReference, expansion: FanOutExpansion): void {
  batch.draft.fanOutExpansions.set(instanceKeyOf(instance), expansion);

  for (const [joinNodeId, fanOutNodeId] of batch.topology.fanOutJoinPairing.joinToFanOut) {
    if (fanOutNodeId === instance.nodeId) {
      batch.touched.push({ nodeId: joinNodeId, branchContext: instance.branchContext });
    }
  }
}

// Egy lefutott vagy halott példány kimenő éleinek jelölése (SPEC-004 4.4
// 3., 4. és 5. pont): a `liveEdgeIds` halmazban álló élek `live`, a többi
// `dead` jelölést kap.
//
// **Meg nem nyílt hatókörbe nem kerül jelölés.** A hatókört nyitó élek
// (`isScopeOpeningEdge`) kimaradnak, mert a törzs példányai csak a hatókörön belül
// léteznek, oda pedig ez a lefutás nem nyitott keretet: halott vagy hibára
// futott `fan_out` és `loop` példánynak nincs is `step_run` sora, tehát a
// `BranchScope` bejegyzéshez szükséges `stepRunId` sem létezik. Emiatt egyetlen
// példány sem vár hiába: a futás indítási validáció hatókör
// kiegyensúlyozottsága garantálja, hogy a törzs node-jai kizárólag a hatókörön
// belülről kapnak jelölést (4.5), a `join` pedig a kibontás bejegyzésből tudja
// meg, hogy halott.
function applyOutgoingMarks(batch: MarkBatch, instance: StepInstanceReference, liveEdgeIds: ReadonlySet<string>): void {
  const nodeType = batch.topology.graph.nodesById.get(instance.nodeId)?.type;

  for (const edge of outgoingEdgesOf(batch.topology, instance.nodeId)) {
    if (isScopeOpeningEdge(nodeType, edge)) {
      continue;
    }
    const context = markContextOnEdge(batch, instance.branchContext, edge);
    placeMark(batch, edge, context, liveEdgeIds.has(edge.id) ? 'live' : 'dead');
  }

  if (nodeType === 'fan_out') {
    recordExpansion(batch, instance, { kind: 'dead' });
  }
}

// Egy érintett példány kiértékelése (SPEC-004 4.4 2. és 3. pont): futtatható
// példány a sorba kerül, halott példány `step_run` sor nélkül marad, és a
// halott jelölést továbbadja a kimenő élein. A továbbadás rekurzív, mert egy
// halott példány újabb példányokat tehet halottá.
function settleInstance(draft: SchedulerDraft, topology: RunTopology, instance: StepInstanceReference): void {
  const readiness = resolveInstanceReadiness(draft, topology, instance);

  if (readiness === 'waiting') {
    return;
  }
  if (readiness === 'live') {
    enqueue(draft, instance);
    return;
  }

  const deadBatch: MarkBatch = { draft, topology, touched: [] };
  applyOutgoingMarks(deadBatch, instance, NO_LIVE_EDGE_IDS);
  settleTouched(deadBatch);
}

// A menetben érintett példányok kiértékelése, a jelölések kiírása **után**.
// A sorrend számít: egy több bejövő élű node akkor is egyszer értékelődik ki
// helyesen, ha ugyanabban a menetben több élére is került jelölés.
function settleTouched(batch: MarkBatch): void {
  for (const instance of batch.touched) {
    settleInstance(batch.draft, batch.topology, instance);
  }
}

// A `fan_out` kibontása (SPEC-004 4.5): minden elemhez egy `fan_out` hatókör
// bejegyzés kerül a veremre, és a nem hiba ágú kimenő élek abban a
// kontextusban kapnak `live` jelölést. Az `on_error` él a külső veremben marad
// és `dead` jelölést kap, mert a sikeres kibontás nem hiba ág.
function applyFanOutExpanded(
  batch: MarkBatch,
  instance: StepInstanceReference,
  stepRunId: string,
  items: readonly unknown[],
): void {
  batch.draft.fanOutItems.set(stepRunId, items);
  const outgoing = outgoingEdgesOf(batch.topology, instance.nodeId);

  for (const itemIndex of items.keys()) {
    const itemContext = buildFanOutItemContext(instance.branchContext, stepRunId, itemIndex);
    for (const edge of outgoing) {
      if (edge.branchKey !== 'on_error') {
        placeMark(batch, edge, itemContext, 'live');
      }
    }
  }

  for (const edge of outgoing) {
    if (edge.branchKey === 'on_error') {
      placeMark(batch, edge, instance.branchContext, 'dead');
    }
  }

  recordExpansion(batch, instance, { kind: 'expanded', stepRunId, items });
}

// A `loop` példány egy lefutásának lezárása (SPEC-004 4.6 4. és 5. pont). A
// lefutásszám mindkét ágon nő, mert az `iteration` "a példány addigi
// lefutásainak a száma", nem a törzsbe lépések száma.
//
// **A két ág pontosan egy él csoportot jelöl meg, a másikat érintetlenül
// hagyja.** Folytatásnál a `continue` élek kapnak `live` jelölést a
// `[...ctx, { kind:'loop', stepRunId, iteration }]` kontextusban; kilépésnél az
// `exit` élek `live`, a maradék (`on_error`) `dead` jelölést kap a `loop`
// példány saját kontextusában.
//
// A 4.6 4. és 5. pontja az adott iteráció **nem választott** ágára `dead`
// jelölést mond, de az iterációnkénti jelölés nem végleges, a `dead` jelölés
// viszont a 4.4 3. pontja szerint azonnal halottá tenné a cél példányt:
//
// - Folytatáskor az `exit` élre tett `dead` jelölés a ciklus utáni node-ot
//   már az első iterációnál halottnak nyilvánítaná, holott a ciklus még
//   ki fog lépni ugyanezen az élen. Az `exit` ág sorsa csak a kilépő
//   lefutáskor dől el véglegesen, ezért addig jelöletlen marad.
// - Kilépéskor a `continue` élre tett `dead` jelölés egy meg nem nyílt
//   hatókörbe kerülne. Ott egyetlen példány sem áll, tehát nincs, ami várna
//   rá, és `step_run` sor híján a hatókör bejegyzéshez szükséges `stepRunId`
//   sem létezne. Ugyanez az elv áll az `applyOutgoingMarks` hatókört nyitó
//   élein.
function applyLoopAdvanced(
  batch: MarkBatch,
  instance: StepInstanceReference,
  stepRunId: string,
  shouldContinue: boolean,
): void {
  const instanceKey = instanceKeyOf(instance);
  const iteration = batch.draft.loopRunCounts.get(instanceKey) ?? 0;
  batch.draft.loopRunCounts.set(instanceKey, iteration + 1);

  const outgoing = outgoingEdgesOf(batch.topology, instance.nodeId);

  if (!shouldContinue) {
    for (const edge of outgoing) {
      if (edge.branchKey !== 'continue') {
        placeMark(batch, edge, instance.branchContext, edge.branchKey === 'exit' ? 'live' : 'dead');
      }
    }
    return;
  }

  batch.draft.loopScopeOwners.set(stepRunId, instance.nodeId);
  const scope: BranchScope = { kind: 'loop', stepRunId, iteration };
  const bodyContext: BranchContext = [...instance.branchContext, scope];

  for (const edge of outgoing) {
    if (edge.branchKey === 'continue') {
      placeMark(batch, edge, bodyContext, 'live');
    }
  }
}

/**
 * Az ütemező állapotának léptetése egy lezárult node példány eredményével
 * (SPEC-004 4.4 ... 4.6). Tiszta függvény: a kapott állapotot érintetlenül
 * hagyja, adatbázist és portot nem érint, és a determinizmusa kizárólag a
 * hívások sorrendjéből jön.
 *
 * A menet három lépése kötött:
 *
 * 1. A példány lekerül a futók közül, mert az esemény a lezárását jelenti.
 * 2. Az esemény fajtája szerinti jelölések kiírása a kimenő élekre.
 * 3. Az érintett cél példányok kiértékelése: a futtatható példány a sorba
 *    kerül érkezési sorszámmal, a halott példány `step_run` sor nélkül marad
 *    és továbbadja a halott jelölést.
 *
 * A második és a harmadik lépés szétválasztása azért kell, mert egy több
 * bejövő élű node ugyanabban a menetben több jelölést is kaphat, és a
 * futtathatóságát csak az összes kiírása után szabad eldönteni.
 */
export function advanceScheduler(state: SchedulerState, topology: RunTopology, event: SchedulingEvent): SchedulerState {
  const draft = toDraft(state);
  const batch: MarkBatch = { draft, topology, touched: [] };

  draft.runningInstanceKeys.delete(instanceKeyOf(event.instance));

  switch (event.kind) {
    case 'node_completed': {
      applyOutgoingMarks(batch, event.instance, event.liveEdgeIds);
      break;
    }
    case 'fan_out_expanded': {
      applyFanOutExpanded(batch, event.instance, event.stepRunId, event.items);
      break;
    }
    case 'loop_advanced': {
      applyLoopAdvanced(batch, event.instance, event.stepRunId, event.shouldContinue);
      break;
    }
  }

  settleTouched(batch);
  return draft;
}
