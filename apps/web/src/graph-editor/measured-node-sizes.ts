import type { NodeDimensionChange } from '@xyflow/react';
import type { GraphNodeCardFlowNode } from '../graph-node-card/graph-node-card-data.ts';

/**
 * Egy csomópont React Flow által MÉRT mérete. Nem domain adat: a
 * `WorkflowNodeInput` nem hordozza, a mentésbe nem kerül bele - a vászon
 * saját nézeti állapota.
 */
export interface MeasuredNodeSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Csomópont azonosító -> mért méret.
 */
export type MeasuredNodeSizes = Readonly<Record<string, MeasuredNodeSize>>;

/**
 * A React Flow `dimensions` típusú változásainak beolvasztása a mért méret
 * térképbe.
 *
 * **Miért van egyáltalán szükség erre a térképre.** A vászon vezérelt
 * (SPEC-008 5.5): a `nodes` prop a szülő domain állapotából, a
 * `workflowNodeToFlowNode` leképezésen át épül, tehát MINDEN renderen új
 * `Node` objektum keletkezik, `measured` mező nélkül. A React Flow
 * `adoptUserNodes` függvénye viszont a belső node-ot a propként kapott
 * objektumból építi újra, és a mért méretet is onnan veszi
 * (`measured: { width: userNode.measured?.width, ... }`, `@xyflow/system`
 * `adoptUserNodes`). Ha a `measured` nem jut vissza, a mérés minden körben
 * elvész: a `nodeHasDimensions` sosem teljesül (a csomópont tartósan
 * `visibility: hidden` marad, él nem rajzolódik), a `parseHandles` pedig a
 * handle határokat is nullázza, ami újabb mérést kényszerít - végtelen
 * `ResizeObserver` hurok. Saját méréssel igazolva 2026-09-05, valós
 * Chromiumban: 1920 `observe` és 960 callback hívás az első másodpercben,
 * miközben mindkét csomópont `visibility: hidden` maradt és nulla él
 * rajzolódott ki.
 *
 * A `dimensions` mező a típus szerint elhagyható (`NodeDimensionChange`), a
 * mező nélküli változás (pl. `resizing` jelzés) ezért nem ír a térképbe.
 */
export function mergeMeasuredNodeSizes(
  previous: MeasuredNodeSizes,
  changes: readonly NodeDimensionChange[],
): MeasuredNodeSizes {
  const merged: Record<string, MeasuredNodeSize> = { ...previous };
  for (const change of changes) {
    if (change.dimensions !== undefined) {
      merged[change.id] = change.dimensions;
    }
  }
  return merged;
}

/**
 * A mért méret visszaírása a vászonnak átadott `Node` objektumra. Mért méret
 * hiányában (az első render, a `ResizeObserver` első lefutása előtt) az
 * eredeti objektum megy tovább változatlanul, mert az
 * `exactOptionalPropertyTypes: true` mellett egy explicit `measured:
 * undefined` mező nem értékadható.
 */
export function withMeasuredNodeSize(
  flowNode: GraphNodeCardFlowNode,
  measuredSize: MeasuredNodeSize | undefined,
): GraphNodeCardFlowNode {
  return measuredSize === undefined ? flowNode : { ...flowNode, measured: measuredSize };
}
