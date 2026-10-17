import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import { isInstanceof } from '@easter-workflow-builder/typeguards';

/**
 * A két billentyű, ami a fókuszált csomóponton a kattintással azonos módon
 * nyitja a tételes listát (user döntés 2026-10-17, "Enter és szóköz
 * nyissa", SPEC-008 6.3, O-41). Az `Escape` a React Flow kijelölő
 * billentyűi közül (`@xyflow/system` 0.0.82 `elementSelectionKeys`) nem
 * tartozik ide, mert a kijelölés visszavonása, nem aktiválás.
 */
const ACTIVATION_KEYS: ReadonlySet<string> = new Set(['Enter', ' ']);

/**
 * A React Flow csomópont dobozának osztálya és azonosító attribútuma a
 * telepített `@xyflow/react` 12.11.6 `NodeWrapper` komponensében
 * (`dist/esm/index.js` 2345. sor `'react-flow__node'`, 2366. sor
 * `"data-id": id`); a fókuszálható doboz maga ez az elem (`tabIndex: 0`).
 */
const NODE_WRAPPER_CLASS = 'react-flow__node';

/**
 * A billentyűzetről aktivált csomópont, vagy `undefined`, ha a billentyű
 * nem az `Enter` vagy a szóköz, vagy a billentyű célpontja nem maga a
 * csomópont doboza (például a kártyán álló gomb, ami a saját billentyűit
 * kezeli, vagy egy él), vagy a doboz azonosítója nem a megadott csomópontok
 * egyike.
 *
 * Tiszta függvény, hogy a vászon `keydown` figyelője (`RunGraphCanvas.tsx`)
 * a React Flow nélkül is tesztelhető legyen.
 */
export function findKeyboardActivatedNode(
  event: Readonly<{ key: string; target: EventTarget | null }>,
  nodes: readonly WorkflowNodeInput[],
): WorkflowNodeInput | undefined {
  const { key, target } = event;
  if (
    !ACTIVATION_KEYS.has(key) ||
    !isInstanceof(target, HTMLElement) ||
    !target.classList.contains(NODE_WRAPPER_CLASS)
  ) {
    return undefined;
  }
  const nodeId = target.dataset['id'];
  return nodes.find((node) => node.id === nodeId);
}
