import type { EdgeSelectionChange, NodeSelectionChange } from '@xyflow/react';

/**
 * A vásznon kiválasztott élek azonosítói. Nem domain adat: a
 * `WorkflowEdgeInput` nem hordozza, a mentésbe nem kerül bele - a vászon
 * saját nézeti állapota, pontosan úgy, mint a mért csomópont méret
 * (`measured-node-sizes.ts`).
 */
export type SelectedEdgeIds = ReadonlySet<string>;

/**
 * A React Flow `select` típusú él változásainak beolvasztása a kiválasztott
 * él azonosítók halmazába.
 *
 * **Miért van egyáltalán szükség erre a halmazra.** A vászon vezérelt
 * (SPEC-008 5.5): az `edges` prop a szülő domain állapotából, a
 * `workflowEdgeToFlowEdge` leképezésen át épül, tehát MINDEN renderen új
 * `Edge` objektum keletkezik, `selected` mező nélkül - a visszaút
 * (`flowEdgeToWorkflowEdge`) sem hordozza, mert a `WorkflowEdgeInput` a
 * dróton nem ismer ilyen mezőt. A React Flow viszont a saját store-jába a
 * propként kapott objektumot teszi, és a törlés billentyű kezelője onnan
 * olvassa ki, mi van kiválasztva
 * (`useGlobalKeyHandler`: `edges.filter(selected)`), a `.selected` CSS
 * osztályt is onnan kapja az él. Ha a `selected` nem jut vissza, az él
 * kattintásra sosem lesz kiválasztott, tehát a `deleteKeyCode`
 * alapértelmezése (`Backspace`, `@xyflow/react@12.11.6`) sem tud mit
 * törölni. Saját méréssel igazolva 2026-09-06, valós chromiumban: kattintás
 * után az él `class` attribútuma `selected` osztály nélkül maradt, és a
 * `Backspace` az élt nem törölte.
 *
 * A halmaz szándékosan nem tisztul a törölt élek azonosítóitól: kizárólag a
 * ténylegesen meglévő éleken olvassuk vissza, tehát egy él nélküli
 * azonosítónak nincs megfigyelhető hatása. Ugyanez a
 * `mergeMeasuredNodeSizes` viselkedése is a törölt csomópontok mért
 * méretére.
 */
export function mergeEdgeSelection(
  previous: SelectedEdgeIds,
  changes: readonly EdgeSelectionChange[],
): SelectedEdgeIds {
  const merged = new Set(previous);
  for (const change of changes) {
    if (change.selected) {
      merged.add(change.id);
    } else {
      merged.delete(change.id);
    }
  }
  return merged;
}

/**
 * Megszűnt-e a megadott csomópont kiválasztása a kapott változás listában.
 *
 * A csomópont kiválasztás a képernyő állapota (`selectedNodeId`, SPEC-008
 * 5.5), a vászon a `Node.selected` mezőre írja vissza. A kiválasztás
 * MEGSZŰNÉSÉT viszont a React Flow saját maga is kezdeményezi: egy élre
 * kattintva az `addSelectedEdges` minden kiválasztott csomópontra
 * `select: false` változást ad. Ez a változás a domain oda-vissza
 * leképezésen ugyanúgy elveszne, mint az él kiválasztása, és a csomópont
 * kiválasztva maradna - a `Backspace` ilyenkor a kiválasztott élen kívül a
 * csomópontot (és vele a rá kötött éleket) is törölné. Saját méréssel
 * igazolva 2026-09-06, valós chromiumban.
 *
 * A kiválasztás felvételét ez a függvény szándékosan nem kezeli: azt a
 * vászon `onNodeClick` propja adja vissza a szülőnek, és a React Flow a
 * `select: true` változást a saját kattintás kezelője UTÁN, de az
 * `onNodeClick` prop hívása ELŐTT küldi el, tehát a két út nem versenyzik
 * (`NodeWrapper.onSelectNodeHandler`, `@xyflow/react@12.11.6`).
 */
export function isNodeDeselected(changes: readonly NodeSelectionChange[], nodeId: string | undefined): boolean {
  return changes.some((change) => !change.selected && change.id === nodeId);
}
