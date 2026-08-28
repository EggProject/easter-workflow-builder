import type { ExecutableGraph } from '../run-graph/executable-graph.ts';

// Egy node bejövő élei közül azok a források, amiket a bejárás még nem látott.
// A `seen` halmazt menet közben frissíti, ezért ugyanaz a node egyetlen hullámba
// sem kerül be kétszer.
function collectUnseenSources(graph: ExecutableGraph, nodeId: string, seen: Set<string>): readonly string[] {
  const discovered: string[] = [];
  const incoming = graph.incomingEdges.get(nodeId) ?? [];

  for (const edge of incoming) {
    if (seen.has(edge.sourceNodeId)) {
      continue;
    }
    seen.add(edge.sourceNodeId);
    discovered.push(edge.sourceNodeId);
  }

  return discovered;
}

/**
 * A `nodeId` node **gráfbeli ősei**: azok a node azonosítók, amikből a
 * `nodeId` az élek irányában elérhető (SPEC-004 6.2, "a node a jelenlegi node
 * egyik gráfbeli őse").
 *
 * **Miért lokális segéd, és miért nem a `computeReachableNodeIds`.** A
 * `run-graph` téma bejárása az élek irányában, egy kiindulási node-ból számol
 * elérhetőséget; itt a **fordított** irány kell. A `computeReachableNodeIds`
 * ezt csak úgy tudná megadni, ha a gráf minden node-jára külön lefutna, és
 * mindegyik eredményében megnéznénk, benne van-e a `nodeId`. A bejövő él
 * térképen futó egyetlen, visszafelé haladó szélességi bejárás ugyanazt az
 * eredményt adja egy menetben, ezért a `run-graph` téma bővítése helyett itt
 * áll egy lokális segéd. A bejárás alakja szándékosan a
 * `computeReachableNodeIds` alakja, csak a `outgoingEdges`/`targetNodeId` pár
 * helyén az `incomingEdges`/`sourceNodeId` pár áll.
 *
 * **A kiindulási node soha nincs az eredményben.** Egy node nem őse önmagának,
 * és a `seen` halmaz eleve a `nodeId` értékkel indul, ezért egy ciklusban álló
 * node sem kerül be a saját ősei közé.
 *
 * **A bejárás a teljes élhalmazon megy, a visszaéleket is követve**
 * (SPEC-004 4.6). Ez nem tágítja a láthatóságot: egy ciklus törzsében a
 * visszaél miatt a törzs node-jai kölcsönösen őseivé válnak egymásnak, de a
 * feloldás második feltétele, az ág kontextus előtag egyezés, a `loop` keret
 * `iteration` értékén megbukik minden olyan példányra, ami nem a jelenlegi
 * iterációban futott, azonos iterációban pedig a törzs egy lejjebbi node-ja még
 * nem futott le (a visszaélek elhagyása után a maradék gráf körmentes, amit a
 * `detectGraphCycle` a futás indításakor garantál).
 */
export function collectAncestorNodeIds(graph: ExecutableGraph, nodeId: string): ReadonlySet<string> {
  const ancestors = new Set<string>();
  const seen = new Set<string>([nodeId]);
  let frontier: readonly string[] = [nodeId];

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const current of frontier) {
      for (const sourceNodeId of collectUnseenSources(graph, current, seen)) {
        ancestors.add(sourceNodeId);
        nextFrontier.push(sourceNodeId);
      }
    }
    frontier = nextFrontier;
  }

  return ancestors;
}
