import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { SessionSourceNodes } from './session-source-nodes.ts';

// Egy node az előre bejárás hullámában: a node azonosítója és a session
// forráshoz képest mért `fan_out` hatókör mélysége.
interface WalkFrontierNode {
  readonly nodeId: string;
  readonly depth: number;
}

// Az előre bejárás gyűlő állapota. Nem `readonly` mezőkkel: a bejárás
// menet közben tölti, és a hullámokon át ugyanaz az objektum utazik.
interface ForwardWalkState {
  readonly seen: Set<string>;
  readonly reachableContinuedNodeIds: Set<string>;
  targetFanOutDepth: number | undefined;
}

// Egy node bejövő élei közül azok a források, amiket a bejárás még nem
// látott. A megtalált session forrásokat a `nearest` halmazba teszi és nem
// adja tovább a hullámnak, mert a forráson túlra nem lépünk; minden más
// forrás bekerül a következő hullámba.
function expandBackward(
  graph: ExecutableGraph,
  nodeId: string,
  sourceNodeIds: ReadonlySet<string>,
  state: { readonly seen: Set<string>; readonly nearest: Set<string> },
): readonly string[] {
  const discovered: string[] = [];
  const incoming = graph.incomingEdges.get(nodeId) ?? [];

  for (const edge of incoming) {
    if (state.seen.has(edge.sourceNodeId)) {
      continue;
    }
    state.seen.add(edge.sourceNodeId);
    if (sourceNodeIds.has(edge.sourceNodeId)) {
      state.nearest.add(edge.sourceNodeId);
    } else {
      discovered.push(edge.sourceNodeId);
    }
  }

  return discovered;
}

/**
 * A `nodeId` node **legközelebbi** session forrás ősei: a bejövő éleken
 * visszafelé haladó szélességi bejárás, ami minden megtalált session forrásnál
 * megáll, tehát a forráson túlra nem lép.
 *
 * Több találat akkor keletkezik, ha a node-ot két, egymástól független ág éri
 * el, és mindkettőn áll agent lépés. A futás egyetlen sessiont folytat majd
 * (a 6.3 szerinti feloldás dönti el, melyiket), a `forkSession` viszont akkor
 * is igaz, ha **bármelyik** jelölt forrás sessionjét egynél több példány
 * folytathatná: a fork az eredeti sessiont hagyja érintetlenül, tehát a
 * szigorúbb válasz a helyes (6.4 indoklása, F-16).
 */
function findNearestSourceNodeIds(
  graph: ExecutableGraph,
  nodeId: string,
  sourceNodeIds: ReadonlySet<string>,
): ReadonlySet<string> {
  const state = { seen: new Set<string>([nodeId]), nearest: new Set<string>() };
  let frontier: readonly string[] = [nodeId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const current of frontier) {
      nextFrontier.push(...expandBackward(graph, current, sourceNodeIds, state));
    }
    frontier = nextFrontier;
  }

  return state.nearest;
}

// Egy node saját `fan_out` hatókör mélysége a rá érkező mélységből: a `join`
// node a `fan_out` keretet leveszi, mielőtt lefutna (SPEC-004 4.5), ezért ott
// eggyel kevesebb a mélység, mint a bejövő élen.
function fanOutDepthAtNode(graph: ExecutableGraph, nodeId: string, arrivingDepth: number): number {
  return graph.nodesById.get(nodeId)?.type === 'join' ? arrivingDepth - 1 : arrivingDepth;
}

// A node kimenő élére kerülő `fan_out` mélység: a `fan_out` node minden
// kimenő éle egy szinttel mélyebb hatókört nyit, kivéve az `on_error` élt,
// ami nem bomlik elemekre, tehát nem is nyit hatókört (SPEC-004 4.4 5. pont,
// ugyanaz a szabály, mint a `validateScopeBalance` `stackOnOutgoingEdge`
// függvényében).
function fanOutDepthOnEdge(nodeType: string | undefined, branchKey: string | null, depth: number): number {
  return nodeType === 'fan_out' && branchKey !== 'on_error' ? depth + 1 : depth;
}

// Egy node kimenő éleinek feldolgozása: a keresett node mélységének
// feljegyzése, a `continued` session források gyűjtése, és a következő hullám
// összeállítása. Session forrásnál a bejárás megáll, mert a 6.4 mindkét
// feltétele "anélkül, hogy közben másik session forráson átmenne"
// megszorítással áll.
function expandForward(
  graph: ExecutableGraph,
  current: WalkFrontierNode,
  targetNodeId: string,
  sessionSourceNodes: SessionSourceNodes,
  state: ForwardWalkState,
): readonly WalkFrontierNode[] {
  const discovered: WalkFrontierNode[] = [];
  const nodeType = graph.nodesById.get(current.nodeId)?.type;
  const outgoing = graph.outgoingEdges.get(current.nodeId) ?? [];

  for (const edge of outgoing) {
    if (state.seen.has(edge.targetNodeId)) {
      continue;
    }
    state.seen.add(edge.targetNodeId);
    const arrivingDepth = fanOutDepthOnEdge(nodeType, edge.branchKey, current.depth);
    const depth = fanOutDepthAtNode(graph, edge.targetNodeId, arrivingDepth);
    if (edge.targetNodeId === targetNodeId) {
      state.targetFanOutDepth = depth;
    }
    if (!sessionSourceNodes.sourceNodeIds.has(edge.targetNodeId)) {
      discovered.push({ nodeId: edge.targetNodeId, depth });
    } else if (sessionSourceNodes.continuedNodeIds.has(edge.targetNodeId)) {
      state.reachableContinuedNodeIds.add(edge.targetNodeId);
    }
  }

  return discovered;
}

/**
 * Előre bejárás egyetlen session forrásból: a `fan_out` hatókör mélységet
 * élenként továbbvezetve megkeresi a `targetNodeId` mélységét, és összegyűjti
 * a forrásból **másik session forrás érintése nélkül** elérhető `continued`
 * session forrásokat.
 *
 * A látogatott halmaz miatt a `loop` visszaéle nem okoz végtelen bejárást, és
 * külön visszaél halmazra sincs szükség: a hatókör kiegyensúlyozottság
 * garantálja, hogy egy node-hoz egyetlen hatókör verem tartozik, tehát az
 * első érkezés mélysége a node mélysége (`validateScopeBalance`).
 */
function walkFromSource(
  graph: ExecutableGraph,
  sourceNodeId: string,
  targetNodeId: string,
  sessionSourceNodes: SessionSourceNodes,
): ForwardWalkState {
  const state: ForwardWalkState = {
    seen: new Set<string>([sourceNodeId]),
    reachableContinuedNodeIds: new Set<string>(),
    targetFanOutDepth: undefined,
  };
  let frontier: readonly WalkFrontierNode[] = [{ nodeId: sourceNodeId, depth: 0 }];

  while (frontier.length > 0) {
    const nextFrontier: WalkFrontierNode[] = [];
    for (const current of frontier) {
      nextFrontier.push(...expandForward(graph, current, targetNodeId, sessionSourceNodes, state));
    }
    frontier = nextFrontier;
  }

  return state;
}

/**
 * Eldönti, hogy a `nodeId` node `continued` lépése `forkSession: true`
 * értékkel induljon-e (SPEC-004 6.4).
 *
 * A vezérelv a 6.4 nyitó mondata: a fork akkor kell, ha a folytatandó session
 * azonosítót a gráf szerkezete szerint **egynél több lépés példány
 * folytathatja**. Ez két esetben áll fenn, és a függvény pontosan ezt a kettőt
 * vizsgálja, egyetlen, a session forrásból induló előre bejárásban:
 *
 * 1. **A `continued` lépés a session forrásához képest `fan_out` hatókörön
 *    belül van**, tehát elemenként egy-egy példány folytatná ugyanazt a
 *    sessiont. Ez a `targetFanOutDepth > 0` feltétel.
 * 2. **A session forrásából egynél több út vezet ki, ami `continued` lépést
 *    ér el** anélkül, hogy közben másik session forráson átmenne. A "több út"
 *    mérése a forrásból elérhető **különböző** `continued` node-ok száma, nem
 *    a gráfbeli utak száma: két út ugyanahhoz a `continued` node-hoz
 *    (rombusz alak) továbbra is egyetlen lépés példányt jelent, tehát nincs mit
 *    forkolni. A vezérelv így közvetlenül leképezve marad, és az útszámlálás
 *    kombinatorikus robbanása is elmarad.
 *
 * **Statikus felülbecslés, szándékosan.** A bejárás nem tudja, melyik `branch`
 * ág fut le, tehát két, egymást kizáró ágon álló `continued` lépés is
 * `forkSession: true` értéket ad. Ez a 6.4 első mondatából következik ("a
 * döntés determinisztikus és a pillanatképből számolható, nem futásidejű
 * versenyhelyzetből"), és a rossz irányban téved: a fork az eredeti sessiont
 * érintetlenül hagyja (F-16), a fork elmaradása viszont két párhuzamos
 * folytatót engedne ugyanarra a sessionre.
 *
 * Ha a node-nak egyetlen session forrás őse sincs, a válasz `false`: nincs mit
 * forkolni. A hiányzó ős **nem itt** ad hibát, hanem a session azonosító
 * feloldásában (`no_resumable_session`, 6.3).
 */
/* eslint-disable-next-line unicorn/consistent-boolean-name -- a függvény neve nem választás kérdése: a SPEC-004 6.4 szekció szó szerint `resolveForkSession(graph, nodeId): boolean` alakban nevezi meg, és a PLAN-005 T-005-19 elfogadási kritériuma is ezen a néven hivatkozik rá. A `shouldForkSession` alak eltérne a specifikációtól, ami a kereshetőséget rontaná */
export function resolveForkSession(
  graph: ExecutableGraph,
  sessionSourceNodes: SessionSourceNodes,
  nodeId: string,
): boolean {
  for (const sourceNodeId of findNearestSourceNodeIds(graph, nodeId, sessionSourceNodes.sourceNodeIds)) {
    const walk = walkFromSource(graph, sourceNodeId, nodeId, sessionSourceNodes);
    const depth = walk.targetFanOutDepth;
    if (depth !== undefined && depth > 0) {
      return true;
    }
    if (walk.reachableContinuedNodeIds.size > 1) {
      return true;
    }
  }

  return false;
}
