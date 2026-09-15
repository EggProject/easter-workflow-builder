import type { NodeConfig } from '@easter-workflow-builder/protocol';
import { Badge, Button } from '@easter-workflow-builder/ui';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import { type GraphNodeOutputHandle, type GraphNodeOutputHandles } from '../graph-node-catalog/graph-node-catalog.ts';
import { GRAPH_NODE_CATALOG } from '../graph-node-catalog/graph-node-catalog.ts';
import type { GraphNodeCardFlowNode, GraphNodeRunDecoration } from './graph-node-card-data.ts';
import { describeStepRunStatusBadge } from './step-run-status-badge.ts';
import './graph-node-card.css';

/**
 * A `branch` node kimenő handle-ei a node saját `config.branches` listájából
 * jönnek, plusz egy alapértelmezett (`id: null`) handle a `defaultBranchKey`
 * ágnak (SPEC-008 5.1 táblázat: "ágankénti egy... plusz az alapértelmezett").
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
    return [
      ...config.branches.map((branch) => ({ id: branch.key, label: branch.label })),
      // eslint-disable-next-line unicorn/no-null -- a handle azonosítója a dróton ténylegesen `null`, a névtelen alapértelmezett ágat jelöli (SPEC-008 5.1)
      { id: null, label: 'Alapértelmezett' },
    ];
  }
  return [];
}

/**
 * Egyenletes függőleges elosztás a kártya jobb szélén, `N` kimenetre: az
 * `i`-edik handle a `(i + 1) / (N + 1)` arányos magasságban áll, tehát egy
 * kimenetnél középen (50%), kettőnél a felső és az alsó harmadban, és a
 * képlet tetszőleges kimenet számra (a `branch` dinamikus ágaira is) működik
 * (SPEC-008 5.1, M-58 `Position`).
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
 * popup felület), hozzáférhető nevével a látható szövegéből.
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
  }
}

/**
 * Az egyetlen egyedi node komponens a vásznon (SPEC-008 5.1, 5.5, M-56): a
 * tíz típus közötti különbséget a `GRAPH_NODE_CATALOG` adat tábla írja le,
 * nem tíz külön komponens. **Egyetlen ág sem függ mért node geometriától**
 * (SPEC-008 12.2): nincs `measured.` és `getBoundingClientRect()` hivatkozás,
 * a kártya mérete a CSS-é (M-57).
 */
export function GraphNodeCard(properties: Readonly<NodeProps<GraphNodeCardFlowNode>>): ReactElement {
  const { data } = properties;
  const { workflowNode, status, runDecoration } = data;
  const catalogEntry = GRAPH_NODE_CATALOG[workflowNode.type];
  const statusBadge = status === undefined ? undefined : describeStepRunStatusBadge(status);
  const outputHandles = resolveOutputHandles(catalogEntry.outputHandles, workflowNode.config);

  return (
    <div className="graph-node-card">
      {catalogEntry.hasInputHandle && <Handle type="target" position={Position.Left} aria-label="Bemenet" />}
      <div className="graph-node-card__header">
        <span className="graph-node-card__type">{catalogEntry.label}</span>
        {statusBadge !== undefined && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
      </div>
      <p className="graph-node-card__label">{workflowNode.label}</p>
      {runDecoration !== undefined && renderRunSummary(runDecoration)}
      {workflowNode.type === 'script' && (
        <p className="graph-node-card__warning">A motor a futtatáskor elutasítja: nincs implementálva.</p>
      )}
      {outputHandles.map((handle, index) =>
        renderOutputHandle(handle, computeHandleTopPercent(index, outputHandles.length)),
      )}
    </div>
  );
}
