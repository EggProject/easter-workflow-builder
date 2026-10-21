import type { NodeConfig } from '@easter-workflow-builder/protocol';
import { Badge, Button } from '@easter-workflow-builder/ui';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { type GraphNodeOutputHandle, type GraphNodeOutputHandles } from '../graph-node-catalog/graph-node-catalog.ts';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { describeWaitingApprovalSince } from './describe-waiting-approval-since.ts';
import type { GraphNodeCardFlowNode, GraphNodeRunDecoration } from './graph-node-card-data.ts';
import { SCRIPT_UNIMPLEMENTED_ERROR_CLASS } from './script-unimplemented-error-class.ts';
import { describeStepRunStatusBadge } from './step-run-status-badge.ts';
import './graph-node-card.css';

/**
 * A `branch` node kimenő handle-ei a node saját `config.branches` listájából
 * jönnek, ágankénti egy, a saját `key` azonosítójával; kulcs nélküli kimenet
 * nincs (SPEC-008 5.1, O-23). Az alapértelmezett ág az, amelyik kulcsa a
 * `defaultBranchKey` mezőben áll, külön jelölés nélkül. A régi, kulcs nélküli
 * elágazás éleket a rajz előtt az `omit-keyless-branch-edges.ts` hagyja el (O-27).
 * A `config` a saját `type` mezőjén diszkriminált unió, tehát a `branch` ág
 * szűkítése `config.type === 'branch'` ellenőrzéssel megy, `unknown` és `as`
 * nélkül. A `WorkflowNodeInputSchema` a `type` és a `config.type` mezőt NEM
 * kapcsolja össze kereszt-mező ellenőrzéssel (SPEC-005), tehát a dróton
 * ténylegesen érkezhet olyan node, ahol a kettő eltér - ez esetben a kártya
 * nulla kimenő handle-t rajzol ahelyett, hogy összeomlana.
 */
function resolveOutputHandles(
  outputHandles: GraphNodeOutputHandles,
  config: NodeConfig,
): readonly GraphNodeOutputHandle[] {
  if (outputHandles.kind === 'fixed') {
    return outputHandles.handles;
  }
  if (config.type === 'branch') {
    return config.branches.map((branch) => ({ id: branch.key, label: branch.label }));
  }
  return [];
}

/**
 * Egyenletes függőleges elosztás a kártya jobb szélén, `N` kimenetre: az
 * `i`-edik handle a `(i + 1) / (N + 1)` arányos magasságban áll, tehát egy
 * kimenetnél középen (50%), kettőnél a felső és az alsó harmadban, és a
 * képlet tetszőleges kimenet számra (a `branch` dinamikus ágaira is) működik.
 * A `Handle` propjait és a `Position` típust az M-58 adja (SPEC-008 2.1); az
 * elosztás képlete sem a SPEC-008 5.1, sem az M-58 szerint nem rögzített:
 * nyitott kérdés: SPEC-008 O-35.
 */
function computeHandleTopPercent(index: number, count: number): number {
  return ((index + 1) * 100) / (count + 1);
}

function renderOutputHandle(handle: GraphNodeOutputHandle, topPercent: number): ReactElement {
  return (
    <Handle
      key={handle.id ?? 'default'}
      type="source"
      position={Position.Right}
      id={handle.id}
      style={{ top: `${String(topPercent)}%` }}
      aria-label={handle.label}
    />
  );
}

/**
 * A futás nézet csomópont szintű összesítése a kártyán (SPEC-008 6.3, AC22,
 * AC24). Kimerítő `switch` a `kind` mezőn, alapértelmezett ág nélkül: egy
 * negyedik összesítés típus fordítási hibát adna.
 *
 * A `fan_out` nulla ág esete KÜLÖN, kimondott feliratot kap, mert egy néma,
 * azonnal kész szétosztás egyébként hibának látszana (SPEC-008 6.3). A
 * `sub_workflow` navigációja valódi gomb, `sm` méretben (nem modális és nem
 * popup felület), hozzáférhető nevével a látható szövegéből. A
 * `waiting_approval` felirata a jóváhagyás kérésének abszolút időpontja
 * (`describeWaitingApprovalSince`, T-009-27, SPEC-008 8. szekció, user döntés
 * 2026-09-24): időzítő nélkül is naprakész marad.
 */
function renderRunSummary(decoration: GraphNodeRunDecoration): ReactElement {
  const { summary, onOpenSubWorkflowRun } = decoration;
  switch (summary.kind) {
    case 'fan_out': {
      return (
        <p className="graph-node-card__summary">
          {summary.branchCount === 0
            ? 'nulla ág: a szétosztás egyetlen ágat sem indított'
            : `${String(summary.branchCount)} ág, ${String(summary.succeededCount)} sikeres, ${String(summary.failedCount)} sikertelen`}
        </p>
      );
    }
    case 'loop': {
      return (
        <p className="graph-node-card__summary">
          {`iteráció: ${String(summary.iteration)} / ${String(summary.maxIterations)}`}
        </p>
      );
    }
    case 'sub_workflow': {
      return (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            onOpenSubWorkflowRun(summary.subWorkflowRunId);
          }}
        >
          Al-workflow futás megnyitása
        </Button>
      );
    }
    case 'waiting_approval': {
      return <p className="graph-node-card__summary">{describeWaitingApprovalSince(summary.requestedAtMs)}</p>;
    }
  }
}

/**
 * Az egyetlen egyedi node komponens a vásznon (SPEC-008 5.1, 5.5, M-56): a
 * tíz típus közötti különbséget a `GRAPH_NODE_CATALOG` adat tábla írja le,
 * nem tíz külön komponens. **Egyetlen ág sem függ mért node geometriától**
 * (SPEC-008 12.2): nincs `measured.` és `getBoundingClientRect()` hivatkozás,
 * a kártya mérete a CSS-é (M-57).
 *
 * **Az állapot betöltése** (SPEC-008 9. szekció 8. async pontja): amíg a lépés
 * futások töltődnek (`isStatusLoading`), az állapot jelvény helyén egy
 * `outline` jelvénybe zárt `Skeleton` áll, a jelvény magassága tehát a design
 * system jelvényéé, és a kártya mérete nem ugrik; a "állapot betöltése" szöveg
 * vizuálisan rejtve a képernyőolvasónak marad.
 *
 * **A fejléc jelvényei** (SPEC-008 6.6): az állapot jelvény mellett két
 * `outline` változatú `Badge` állhat. A "`N`. próbálkozás" csak 1 feletti
 * `attempt` értékre jelenik meg (1. döntés), az "alapértelmezett ág" pontosan
 * akkor, ha a csomópont legutóbbi döntése az alapértelmezett ágra lépett
 * (4. döntés, O-24). Az `outline` a státusz nélküli jelölés változata: a
 * színes változatok a lépés állapotát hordozzák, és pontot is rajzolnak.
 */
export function GraphNodeCard(properties: Readonly<NodeProps<GraphNodeCardFlowNode>>): ReactElement {
  const { data } = properties;
  const { workflowNode, status, attempt, usedDefaultBranch, runDecoration, isStatusLoading } = data;
  const catalogEntry = GRAPH_NODE_CATALOG[workflowNode.type];
  const statusBadge = status === undefined ? undefined : describeStepRunStatusBadge(status);
  const outputHandles = resolveOutputHandles(catalogEntry.outputHandles, workflowNode.config);

  return (
    <div className="graph-node-card">
      {catalogEntry.hasInputHandle && <Handle type="target" position={Position.Left} aria-label="Bemenet" />}
      <div className="graph-node-card__header">
        <span className="graph-node-card__type">{catalogEntry.label}</span>
        <span className="graph-node-card__badges">
          {isStatusLoading === true && (
            <Badge variant="outline">
              <span className="graph-node-card__status-loading-text">állapot betöltése</span>
              <ThemedSkeleton shape="text" w={48} />
            </Badge>
          )}
          {statusBadge !== undefined && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
          {attempt !== undefined && attempt > 1 && <Badge variant="outline">{`${String(attempt)}. próbálkozás`}</Badge>}
          {usedDefaultBranch === true && <Badge variant="outline">alapértelmezett ág</Badge>}
        </span>
      </div>
      <p className="graph-node-card__label">{workflowNode.label}</p>
      {runDecoration !== undefined && renderRunSummary(runDecoration)}
      {workflowNode.type === 'script' && (
        <p className="graph-node-card__warning">
          {`A motor a futtatáskor \`${SCRIPT_UNIMPLEMENTED_ERROR_CLASS}\` hibával elutasítja: nincs implementálva.`}
        </p>
      )}
      {outputHandles.map((handle, index) =>
        renderOutputHandle(handle, computeHandleTopPercent(index, outputHandles.length)),
      )}
    </div>
  );
}
