import { Graph, layout, type EdgeLabel, type GraphLabel } from '@dagrejs/dagre';
import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { GRAPH_NODE_CARD_HEIGHT, GRAPH_NODE_CARD_WIDTH } from '../graph-node-catalog/graph-node-catalog.ts';

/**
 * A dagre `NodeLabel` saját típusa a layout ELŐTTI és UTÁNI állapotot is
 * ugyanazzal az alakkal írja le, ezért az `x`/`y` mező nála opcionális - a
 * `layout()` hívás UTÁN viszont minden `setNode`-dal felvett csomópontra
 * ténylegesen kitöltött (dokumentált dagre viselkedés). Ahelyett, hogy egy
 * `x === undefined` ellenőrzést vezetnénk be, ami erre a hívási mintára
 * garantáltan sosem futna (`.claude/CLAUDE.md` 5. szekció), a gráf SAJÁT,
 * ennél szigorúbb node címke típussal épül, ahol az `x`/`y` kezdetben `0`
 * helyőrző (amit a `layout()` felülír), de a típus szintjén nem opcionális -
 * a `layout` és a `Graph` maga is generikus (`Graph<G, N, E>`), tehát ez a
 * szigorítás típushiba nélkül elfogadott.
 */
interface LayoutNodeLabel {
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Automatikus gráf elrendezés a `@dagrejs/dagre@3.1.1` könyvtárral, tiszta
 * függvényként (SPEC-008 5.7, AC61, AC62): a bemenete a domain szintű
 * `WorkflowNodeInput`/`WorkflowEdgeInput` lista, a kimenete a `nodes` lista
 * `positionX`/`positionY` mezővel felülírt másolata, UGYANOLYAN sorrendben és
 * elemszámmal - ez a hívó oldalon (`GraphEditorScreen`) kizárja a "van-e
 * pozíció ehhez az azonosítóhoz" Map-alapú keresést, ami itt garantáltan
 * mindig találna, tehát egy külön `undefined` ág garantáltan sosem futna
 * (`.claude/CLAUDE.md` 5. szekció). Nincs `@xyflow/react` import és DOM
 * hivatkozás - happy-dom alatt, szintetikus bemenettel közvetlenül
 * tesztelhető (12.2 szabály).
 *
 * **Az egyetlen felülírt dagre opció a `rankdir` (`LR`)**, mert a workflow
 * gráf balról jobbra olvasandó (a felület saját döntése). A `nodesep`, a
 * `ranksep`, az `edgesep`, a `marginx` és a `marginy` a csomag dokumentált
 * alapértékén marad (M-93, `docs/research/
 * 2026-09-05-grafszerkeszto-es-transcript.md` 6.3 szekció) - ezért ez az öt
 * opció név szerint SEM szerepelhet ebben a fájlban.
 *
 * **A csomópont méret a `graph-node-catalog` egyetlen mért konstansa**
 * (`GRAPH_NODE_CARD_WIDTH`/`GRAPH_NODE_CARD_HEIGHT`, T-009-19, M-94): ugyanezt
 * olvassa a kártya CSS-e is, egy custom propertyn át (`GraphEditorCanvas`).
 *
 * **Az `N = 0` és az `N = 1` eset nem külön ág**: üres gráfon és egyetlen
 * csomóponton a függvény ugyanazt az utat futja - a dagre gráfot felépíti,
 * elrendezi, és a kapott pozíciókat visszaírja (SPEC-008 5.7).
 */
export function layoutGraph(
  nodes: readonly WorkflowNodeInput[],
  edges: readonly WorkflowEdgeInput[],
): readonly WorkflowNodeInput[] {
  const graph = new Graph<GraphLabel, LayoutNodeLabel, EdgeLabel>();
  graph.setGraph({ rankdir: 'LR' });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    graph.setNode(node.id, { width: GRAPH_NODE_CARD_WIDTH, height: GRAPH_NODE_CARD_HEIGHT, x: 0, y: 0 });
  }
  for (const edge of edges) {
    graph.setEdge(edge.sourceNodeId, edge.targetNodeId);
  }

  layout(graph);

  return nodes.map((node) => {
    const layoutNode = graph.node(node.id);
    return {
      ...node,
      positionX: layoutNode.x - GRAPH_NODE_CARD_WIDTH / 2,
      positionY: layoutNode.y - GRAPH_NODE_CARD_HEIGHT / 2,
    };
  });
}
