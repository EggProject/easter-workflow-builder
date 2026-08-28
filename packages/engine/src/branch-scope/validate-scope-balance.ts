import type { Outcome } from '@easter-workflow-builder/core';
import type { NodeType, SnapshotEdge } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { FanOutJoinPairing } from './fan-out-join-pairing.ts';
import type { StaticScopeStack } from './static-scope-stack.ts';

// A bejárás közben gyűlő két térkép: az élenként továbbadott hatókör verem és
// a `join` node-okhoz megtalált `fan_out` pár. Egyetlen objektumba fogva
// utaznak, hogy a node-onkénti lépés paraméterlistája rövid maradjon.
interface ScopeWalkState {
  readonly stackByEdgeId: Map<string, StaticScopeStack>;
  readonly joinToFanOut: Map<string, string>;
}

/**
 * A `start` node-ból elérhető rész topologikus sorrendje, a visszaélek
 * elhagyásával. A mélységi bejárás fordított befejezési sorrendje a maradék
 * gráf topologikus sorrendje; ez akkor helyes, ha a maradék gráf körmentes,
 * amit a hívó a `detectGraphCycle` előzetes lefuttatásával garantál
 * (SPEC-004 4.6, a validációs sorrend 2. lépése).
 *
 * A bejárás a nem létező node-ra mutató élt is követi: az ilyen célpont
 * kimenő él nélküli, hatókör szempontból semleges node-ként viselkedik, a
 * `dangling_edge` hibát pedig a `run-validation` téma adja (T-005-15).
 */
function buildTopologicalOrder(
  graph: ExecutableGraph,
  startNodeId: string,
  loopBackEdgeIds: ReadonlySet<string>,
): readonly string[] {
  const visited = new Set<string>();
  const finishOrder: string[] = [];

  function visit(nodeId: string): void {
    if (visited.has(nodeId)) {
      return;
    }
    visited.add(nodeId);
    const outgoing = graph.outgoingEdges.get(nodeId) ?? [];
    for (const edge of outgoing) {
      if (!loopBackEdgeIds.has(edge.id)) {
        visit(edge.targetNodeId);
      }
    }
    finishOrder.push(nodeId);
  }

  visit(startNodeId);
  finishOrder.reverse();
  return finishOrder;
}

// A node-ba érkező hatókör vermek: minden bejövő él közül azok, amikre a
// forrásuk lefutása már veremet írt. Hiányzó bejegyzés kétféleképpen
// keletkezik, és egyik sem itt dől el: a visszaélre szándékosan nem kerül
// verem (SPEC-004 4.6, a `loop` node "belépő élei" kontra "visszaélei"), a
// `start` node-ból el nem érhető forrás pedig `unreachable_node` hiba a
// `run-validation` témában (T-005-15).
function collectArrivingStacks(
  graph: ExecutableGraph,
  nodeId: string,
  stackByEdgeId: ReadonlyMap<string, StaticScopeStack>,
): readonly StaticScopeStack[] {
  const arriving: StaticScopeStack[] = [];
  const incoming = graph.incomingEdges.get(nodeId) ?? [];

  for (const edge of incoming) {
    const stack = stackByEdgeId.get(edge.id);
    if (stack !== undefined) {
      arriving.push(stack);
    }
  }

  return arriving;
}

// A verem összehasonlítható alakja. Nem elemenként, index szerint hasonlítunk,
// hanem egyetlen kulcson: a JSON alak a keretek sorrendjét, `kind` és
// `originNodeId` mezőjét is egyértelműen kódolja, elválasztó karakter
// félreértése nélkül.
function scopeStackKey(stack: StaticScopeStack): string {
  return JSON.stringify(stack.map((frame) => [frame.kind, frame.originNodeId]));
}

// A bejövő élek vermeinek egyeztetése (SPEC-004 4.5, első kiegyensúlyozatlansági
// forma): "Ha egy node két különböző úton két különböző mély veremmel érhető
// el, a gráf kiegyensúlyozatlan."
//
// A mélységnél szigorúbban, a verem **tartalmát** hasonlítjuk: két azonos mély,
// de más `fan_out` node-tól származó verem ugyanúgy futtathatatlan, mert a node
// példány nem tudná, melyik hatókörben áll.
//
// Üres listára a gyökér kontextust adja. Ez a `start` node esete: nincs bejövő
// éle, tehát a gyökér kontextus az üres verem (SPEC-004 4.3).
function mergeArrivingStacks(nodeId: string, arriving: readonly StaticScopeStack[]): Outcome<StaticScopeStack> {
  const distinctStacks = new Set(arriving.map((stack) => scopeStackKey(stack)));

  if (distinctStacks.size > 1) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unbalanced_fan_out_scope',
        `A(z) ${nodeId} node két különböző hatókör veremmel érhető el a start node-ból`,
      ),
    };
  }

  return { kind: 'ok', value: arriving[0] ?? [] };
}

// A `join` node hatókör lezárása és a párja megnevezése (SPEC-004 4.5): a
// `join` a verem tetején álló `fan_out` bejegyzést veszi le, és pontosan ez a
// bejegyzés mondja meg, melyik `fan_out` node nyitotta a hatókört.
//
// Ha a tetőn nincs `fan_out` bejegyzés (üres a verem, vagy egy `loop` keret áll
// felül), az a második kiegyensúlyozatlansági forma: "Ha egy `join` node olyan
// kontextusban érhető el, aminek a tetején nincs `fan_out` bejegyzés."
function popFanOutScope(
  nodeId: string,
  stack: StaticScopeStack,
): Outcome<{ readonly outerStack: StaticScopeStack; readonly fanOutNodeId: string }> {
  const top = stack.at(-1);

  if (top?.kind !== 'fan_out') {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unbalanced_fan_out_scope',
        `A(z) ${nodeId} join node hatókör vermének tetején nem fan_out bejegyzés áll`,
      ),
    };
  }

  return { kind: 'ok', value: { outerStack: stack.slice(0, -1), fanOutNodeId: top.originNodeId } };
}

// A harmadik kiegyensúlyozatlansági forma (SPEC-004 4.5): "Ha egy `fan_out`
// node által nyitott hatókör a futás bármely terminális node-jáig nyitva marad."
//
// Kizárólag a `fan_out` keretet vizsgáljuk, a `loop` keretet szándékosan nem, és
// nem is szabad: a `loop` hatókör a `loop` node `exit` ágán zár, a törzs egy
// terminális node-ja pedig szabályosan állhat nyitott `loop` keretben, amíg a
// visszaél a ciklust máshonnan zárja.
function ensureNoOpenFanOutScope(nodeId: string, stack: StaticScopeStack): Outcome<void> {
  if (stack.some((frame) => frame.kind === 'fan_out')) {
    return {
      kind: 'error',
      message: formatEngineErrorMessage(
        'unbalanced_fan_out_scope',
        `A(z) ${nodeId} terminális node-ig nyitva marad egy fan_out hatókör`,
      ),
    };
  }

  return { kind: 'ok', value: undefined };
}

/**
 * A node lefutása után egy adott kimenő élre kerülő verem:
 *
 * - `fan_out`: a kimenő élek egy új `fan_out` kerettel bővült vermet kapnak
 *   (SPEC-004 4.5). Kivétel az `on_error` él: hibára futó példány nem bomlik
 *   elemekre, tehát nem is nyit hatókört, a hiba útja a külső veremben marad
 *   (SPEC-004 4.4 5. pont).
 * - `loop`: a `continue` élek új `loop` keretet kapnak, minden más kimenő él
 *   (`exit`, `on_error`) a bejövő vermet, mert azokon a ciklus hatóköre nem
 *   nyílik meg, illetve lekerül a veremről (SPEC-004 4.6, 4. és 5. pont).
 * - minden más node típus változatlanul adja tovább a bejövő vermet; `join`
 *   node-nál ez a már levágott, külső verem.
 */
function stackOnOutgoingEdge(
  nodeType: NodeType | undefined,
  nodeId: string,
  edge: SnapshotEdge,
  baseStack: StaticScopeStack,
): StaticScopeStack {
  if (nodeType === 'fan_out' && edge.branchKey !== 'on_error') {
    return [...baseStack, { kind: 'fan_out', originNodeId: nodeId }];
  }
  if (nodeType === 'loop' && edge.branchKey === 'continue') {
    return [...baseStack, { kind: 'loop', originNodeId: nodeId }];
  }
  return baseStack;
}

// Egy node feldolgozása a topologikus sorrendben: a bejövő vermek egyeztetése,
// a `join` hatókör lezárása, a terminális ellenőrzés, végül a kimenő élek
// veremének kiosztása.
//
// **A terminális jelző a teljes kimenő él listán áll, a visszaéleket is
// beleértve.** A visszaél futásidőben valódi folytatás (a `loop` node újabb
// lefutását indítja, SPEC-004 4.6), ezért egy csak visszaélt kibocsátó node nem
// terminális, még ha a visszaél nélküli gráfban annak látszik is.
function walkNode(
  graph: ExecutableGraph,
  nodeId: string,
  loopBackEdgeIds: ReadonlySet<string>,
  state: ScopeWalkState,
): Outcome<void> {
  const merged = mergeArrivingStacks(nodeId, collectArrivingStacks(graph, nodeId, state.stackByEdgeId));
  if (merged.kind === 'error') {
    return merged;
  }

  const nodeType = graph.nodesById.get(nodeId)?.type;
  let baseStack = merged.value;
  if (nodeType === 'join') {
    const popped = popFanOutScope(nodeId, merged.value);
    if (popped.kind === 'error') {
      return popped;
    }
    state.joinToFanOut.set(nodeId, popped.value.fanOutNodeId);
    baseStack = popped.value.outerStack;
  }

  const outgoing = graph.outgoingEdges.get(nodeId) ?? [];
  if (outgoing.length === 0) {
    return ensureNoOpenFanOutScope(nodeId, baseStack);
  }

  for (const edge of outgoing) {
    if (!loopBackEdgeIds.has(edge.id)) {
      state.stackByEdgeId.set(edge.id, stackOnOutgoingEdge(nodeType, nodeId, edge, baseStack));
    }
  }
  return { kind: 'ok', value: undefined };
}

/**
 * A hatókör kiegyensúlyozottság ellenőrzése és a fan-out/join párosítás
 * levezetése (SPEC-004 4.5).
 *
 * A motor minden node-ra kiszámolja a hatókör vermet a `start` node-tól
 * kiindulva, az élek irányában bejárva, és a három kiegyensúlyozatlansági forma
 * bármelyikére `unbalanced_fan_out_scope` hibát ad: két különböző verem
 * ugyanahhoz a node-hoz, nyitott `fan_out` nélkül elért `join` node, és
 * terminális node-ig nyitva maradó `fan_out` hatókör.
 *
 * A sikeres ág a `join` node-ok párosítását adja vissza, mert az a bejárás
 * mellékterméke: a `join`-nál levett keret maga nevezi meg a `fan_out` node-ot.
 *
 * Tiszta függvény, adatbázis nélkül tesztelhető. Két előfeltétele van, mindkettő
 * a hívó dolga (SPEC-004 4.8 3. lépése egyetlen validációs blokként futtatja a
 * 4.5, 4.6 és 4.7 ellenőrzéseit): a `startNodeId` a gráf egyetlen `start`
 * típusú node-ja (`invalid_start_node`, T-005-15), és a `loopBackEdgeIds`
 * halmaz elhagyásával a gráf körmentes (`graph_cycle_detected`,
 * `detectGraphCycle`, T-005-10).
 */
export function validateScopeBalance(
  graph: ExecutableGraph,
  startNodeId: string,
  loopBackEdgeIds: ReadonlySet<string>,
): Outcome<FanOutJoinPairing> {
  const state: ScopeWalkState = { stackByEdgeId: new Map(), joinToFanOut: new Map() };

  for (const nodeId of buildTopologicalOrder(graph, startNodeId, loopBackEdgeIds)) {
    const walked = walkNode(graph, nodeId, loopBackEdgeIds, state);
    if (walked.kind === 'error') {
      return walked;
    }
  }

  return { kind: 'ok', value: { joinToFanOut: state.joinToFanOut } };
}
