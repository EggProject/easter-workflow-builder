import { applyEdgeChanges, type Edge, type EdgeSelectionChange, type NodeSelectionChange } from '@xyflow/react';

/**
 * A vásznon kiválasztott élek azonosítói. Nem domain adat: a
 * `WorkflowEdgeInput` nem hordozza, a mentésbe nem kerül bele - a vászon
 * saját nézeti állapota, pontosan úgy, mint a mért csomópont méret
 * (`measured-node-sizes.ts`).
 */
export type SelectedEdgeIds = ReadonlySet<string>;

/**
 * A React Flow `select` típusú él változásainak beolvasztása a kiválasztott
 * él azonosítók halmazába, az `applyEdgeChanges` segédfüggvényen át (SPEC-008
 * 5.5, 15. szekció 9. kritérium, M-55): a halmaz a megadott élek `selected`
 * mezőjére leképezve megy át a könyvtár saját változás alkalmazásán, és a
 * `selected` élek azonosítói adják az új halmazt.
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
 * törölni (saját mérés, valós chromium, SPEC-008 5.5 "hatodik állapotdarab").
 *
 * Az eredmény csak a `flowEdges` között szereplő azonosítókat tartalmazza:
 * egy már nem létező él kiválasztás változását az `applyEdgeChanges` nem
 * alkalmazza, és a törölt él azonosítója a halmazból is kikerül.
 */
export function mergeEdgeSelection(
  previous: SelectedEdgeIds,
  changes: readonly EdgeSelectionChange[],
  flowEdges: readonly Edge[],
): SelectedEdgeIds {
  const markedEdges = flowEdges.map((edge) => ({ ...edge, selected: previous.has(edge.id) }));
  const changedEdges = applyEdgeChanges([...changes], markedEdges);
  return new Set(changedEdges.filter((edge) => edge.selected).map((edge) => edge.id));
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
 * csomópontot (és vele a rá kötött éleket) is törölné (saját mérés, valós
 * chromium, SPEC-008 5.5).
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
