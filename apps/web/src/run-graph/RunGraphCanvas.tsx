import type { WorkflowEdgeInput, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { Background, Controls, ReactFlow, type NodeChange, type NodeDimensionChange } from '@xyflow/react';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { GraphNodeCard } from '../graph-node-card/GraphNodeCard.tsx';
import { GraphNodeCardSizeStyle } from '../graph-node-card/GraphNodeCardSizeStyle.tsx';
import type { GraphNodeCardData, GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';
import { omitKeylessBranchEdges } from '../graph-node-card/omit-keyless-branch-edges.ts';
import {
  mergeMeasuredNodeSizes,
  withMeasuredNodeSize,
  type MeasuredNodeSizes,
} from '../graph-editor/measured-node-sizes.ts';
import { BranchHighlightToggle } from './BranchHighlightToggle.tsx';
import type { BranchDecision } from './branch-decision.ts';
import { readStoredBranchHighlightMode, storeBranchHighlightMode } from './branch-highlight-mode-storage.ts';
import { buildRunGraphFlowEdges } from './build-run-graph-flow-edges.ts';
import { findKeyboardActivatedNode } from './find-keyboard-activated-node.ts';
import { resolveHighlightedBranchEdgeIds } from './resolve-highlighted-branch-edge-ids.ts';
import '@xyflow/react/dist/style.css';
import '../graph-editor/graph-canvas-theme.css';
import './run-graph.css';

/**
 * A futás nézet vászna ugyanazt az egyetlen egyedi node komponenst
 * regisztrálja, mint a szerkesztő (SPEC-008 5.1), modul szintű `const`-ként,
 * hogy a hivatkozás két render között azonos maradjon (M-56).
 */
const NODE_TYPES = { workflowNode: GraphNodeCard };

export interface RunGraphCanvasProperties {
  /**
   * A pillanatkép csomópontjai, a lépés futásokból származó dekorációval
   * együtt (`build-run-graph-nodes.ts`).
   */
  readonly nodes: readonly GraphNodeCardData[];
  readonly edges: readonly WorkflowEdgeInput[];
  /**
   * Csomópont azonosító -> a hozzá leképezett `branch_taken` döntések, növekvő
   * `eventId` szerint (`group-branch-decisions-by-node.ts`): ebből számolódik
   * a kiemelendő élek halmaza (SPEC-008 6.6).
   */
  readonly branchDecisionsByNodeId: ReadonlyMap<string, readonly BranchDecision[]>;
  /**
   * Egy csomópontra kattintás, vagy a fókuszált csomóponton az `Enter` és a
   * szóköz (SPEC-008 6.3, O-39, O-41): a hívó dönti el, mit nyit ki (a
   * `fan_out` és a `loop` tételes listáját). A vászon a csomópont pillanatkép
   * szerinti alakját adja át, nem az azonosítóját, hogy a hívónak ne kelljen
   * visszakeresnie.
   */
  readonly onNodeClick: (workflowNode: WorkflowNodeInput) => void;
}

/**
 * A futás pillanatképéből épülő, CSAK OLVASHATÓ vászon (SPEC-008 6.2, AC19,
 * AC20). Három prop kapcsolja ki a szerkesztést: `nodesDraggable`,
 * `nodesConnectable` és `elementsSelectable`, mindhárom hamis. A vászon
 * PÁSZTÁZHATÓ és NAGYÍTHATÓ marad, mert az nem szerkesztés, hanem a nagy
 * gráfok megtekintésének egyetlen módja.
 *
 * **A kattintás kezelő nem old fel semmit a három tiltásból** (SPEC-008 6.3,
 * O-39, AC19, AC118). A telepített `@xyflow/react` 12.11.6 `NodeWrapper`
 * komponense (`dist/esm/index.js`) a csomópont `onClick` kezelőjében a
 * kijelölést csak `isSelectable` mellett végzi, az `onNodeClick` hívása
 * ettől független; az `isSelectable`, az `isDraggable` és az `isConnectable`
 * kizárólag a három propból (és a csomópont saját, itt nem adott
 * `selectable`/`draggable`/`connectable` mezőjéből) számolódik. A kezelő
 * egyetlen mellékhatása, hogy a csomópont doboza `pointer-events: all`
 * értéket kap (`hasPointerEvents`), tehát a kártyán álló gombok is
 * kattinthatók. A mérés és a forrás idézete:
 * `docs/research/2026-10-17-ag-iteracio-lista.md`.
 *
 * **A billentyűs út** (user döntés 2026-10-17, "Enter és szóköz nyissa",
 * SPEC-008 6.3, O-41): a fókuszált csomóponton az `Enter` és a szóköz
 * ugyanazt a hívást adja, mint a kattintás. A React Flow a csomópont saját
 * billentyű kezelőjében ezt nem teszi meg (az `Enter`/szóköz csak
 * kijelölhető csomópontot jelöl ki, az `onNodeClick` billentyűre nem fut),
 * ezért a figyelő a vászon `keydown` eseményén áll, és csak akkor lép, ha a
 * célpont maga a csomópont doboza (`find-keyboard-activated-node.ts`). A
 * React Flow saját billentyűivel nem ütközik, és a kijelölést sem oldja fel;
 * a telepített forrás és a mérés: a research fájl.
 *
 * **A mért csomópont méret itt is nézeti állapot**, ugyanabból az okból, mint
 * a szerkesztőben (`graph-editor/measured-node-sizes.ts` doksija): a `nodes`
 * prop minden lépés futás frissüléskor új objektumokból épül újra, `measured`
 * mező nélkül, és a React Flow a belső node-ot a propként kapott objektumból
 * építi újra. Mért méret nélkül a csomópont tartósan `visibility: hidden`
 * marad, egyetlen él sem rajzolódik ki, és a mérési hurok nem konvergál. A
 * modul ezért a `graph-editor` téma már mért, tesztelt segédfüggvényeit
 * használja, nem egy másolatot; az import irány egyirányú (`run-graph` ->
 * `graph-editor`).
 *
 * **Egyetlen ág sem függ mért csomópont geometriától** (SPEC-008 12.2): a
 * `measured.` tulajdonság-elérés és a `getBoundingClientRect(` hívás
 * egyaránt hiányzik, a mért méret kizárólag a React Flow saját `dimensions`
 * változásából jut a térképbe.
 *
 * **Az ág kiemelés** (SPEC-008 6.6): a választott ág élei egy osztályt kapnak,
 * amit a `run-graph.css` fest. A mód ("csak a legutóbbi választás" vagy
 * "minden eddig bejárt ág") a vászon nézeti állapota, a böngésző megjegyzi
 * (`branch-highlight-mode-storage.ts`), és a kapcsolója a vezérlő panel
 * utolsó gombja, ami csak `branch` csomópontot tartalmazó pillanatképen
 * jelenik meg.
 *
 * **A régi, kulcs nélküli elágazás élek** (SPEC-008 5.1 3. pont, O-27) a
 * pillanatkép vetítése után, a vászon élleképezése előtt maradnak ki
 * (`omit-keyless-branch-edges.ts`): a rajzon nem jelennek meg, és kiemelni sem
 * lehet őket; a pillanatkép sora változatlan marad.
 */
export function RunGraphCanvas(properties: Readonly<RunGraphCanvasProperties>): ReactElement {
  const { nodes, edges, branchDecisionsByNodeId, onNodeClick } = properties;

  const [measuredNodeSizes, setMeasuredNodeSizes] = useState<MeasuredNodeSizes>({});
  const [branchHighlightMode, setBranchHighlightMode] = useState(readStoredBranchHighlightMode);

  const flowNodes = useMemo(
    () =>
      nodes.map((data) =>
        withMeasuredNodeSize(
          {
            id: data.workflowNode.id,
            type: 'workflowNode',
            position: { x: data.workflowNode.positionX, y: data.workflowNode.positionY },
            data,
          },
          measuredNodeSizes[data.workflowNode.id],
        ),
      ),
    [nodes, measuredNodeSizes],
  );
  const visibleEdges = useMemo(
    () =>
      omitKeylessBranchEdges(
        nodes.map((data) => data.workflowNode),
        edges,
      ),
    [nodes, edges],
  );
  const flowEdges = useMemo(
    () =>
      buildRunGraphFlowEdges(
        visibleEdges,
        resolveHighlightedBranchEdgeIds({
          decisionsByNodeId: branchDecisionsByNodeId,
          nodes: nodes.map((data) => data.workflowNode),
          edges: visibleEdges,
          mode: branchHighlightMode,
        }),
      ),
    [visibleEdges, nodes, branchDecisionsByNodeId, branchHighlightMode],
  );
  const hasBranchNode = nodes.some((data) => data.workflowNode.type === 'branch');

  const toggleBranchHighlightMode = useCallback(() => {
    const nextMode = branchHighlightMode === 'latest' ? 'all' : 'latest';
    storeBranchHighlightMode(nextMode);
    setBranchHighlightMode(nextMode);
  }, [branchHighlightMode]);

  // A csak olvasható vásznon a React Flow egyetlen érdemi változást küld: a
  // `dimensions` típusú mérési eredményt. Minden más változás típus (húzás,
  // kiválasztás, kapcsolás) a három kikapcsoló prop miatt nem keletkezhet,
  // ezért a kezelő azokat egyszerűen elhagyja - nem hibaág, hanem szűrés.
  const onNodesChange = useCallback((changes: NodeChange<GraphNodeCardFlowNode>[]) => {
    const dimensionChanges: NodeDimensionChange[] = [];
    for (const change of changes) {
      if (change.type === 'dimensions') {
        dimensionChanges.push(change);
      }
    }
    if (dimensionChanges.length > 0) {
      setMeasuredNodeSizes((previous) => mergeMeasuredNodeSizes(previous, dimensionChanges));
    }
  }, []);

  return (
    // A `graph-canvas-theme` a szerkesztővel közös React Flow téma: nélküle a
    // vezérlő gombok és az attribúció sötét témában a szállított világos
    // alapértelmezést festették (2026-09-23).
    <div className="run-graph-canvas graph-canvas-theme">
      <GraphNodeCardSizeStyle />
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_event, node) => {
          onNodeClick(node.data.workflowNode);
        }}
        onKeyDown={(event) => {
          const activatedNode = findKeyboardActivatedNode(
            event,
            nodes.map((data) => data.workflowNode),
          );
          if (activatedNode !== undefined) {
            onNodeClick(activatedNode);
          }
        }}
        /* A betöltött pillanatkép beleillik a vászonba, ahelyett hogy az
           alapértelmezett `{ x: 0, y: 0, zoom: 1 }` nézetben a jobb szélen
           levágódna. A prop dokumentált jelentése kizárólag a KEZDETI nézetre
           szól; a futás nézetben nincs olyan művelet, ami a pozíciókat
           átírná, tehát későbbi újraillesztésre sincs szükség. */
        fitView
      >
        <Background />
        <Controls>
          {hasBranchNode && <BranchHighlightToggle mode={branchHighlightMode} onToggle={toggleBranchHighlightMode} />}
        </Controls>
      </ReactFlow>
    </div>
  );
}
