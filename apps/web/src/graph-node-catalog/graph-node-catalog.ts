/* eslint-disable unicorn/no-null -- a névtelen kimenő handle azonosítója a dróton ténylegesen `null`, nem helyőrző `undefined` (SPEC-008 5.1, M-88) */
import type { NodeType } from '@easter-workflow-builder/protocol';

/**
 * Egy kimenő handle a vásznon: az azonosítója a `WorkflowEdgeInput.branchKey`
 * fenntartott értéke (`continue`, `exit`, `approved`, `rejected`, `on_error`),
 * vagy `null` a névtelen, egyetlen kimenetre (SPEC-008 5.1, M-88). A felirat
 * a node beállítás panel és a kártya megjelenítés közös forrása.
 */
export interface GraphNodeOutputHandle {
  readonly id: string | null;
  readonly label: string;
}

/**
 * A `branch` node kimenő handle-ei a node saját `config.branches` listájából
 * jönnek futásidőben, nem statikus katalógus adatból (SPEC-008 5.1 táblázat:
 * "ágankénti egy... plusz az alapértelmezett"). A `dynamic-branch` érték ezt
 * az egyetlen kivételt jelöli; a másik kilenc típus `fixed`, statikus listát ad.
 */
export type GraphNodeOutputHandles =
  { readonly kind: 'fixed'; readonly handles: readonly GraphNodeOutputHandle[] } | { readonly kind: 'dynamic-branch' };

export interface GraphNodeCatalogEntry {
  readonly label: string;
  readonly hasInputHandle: boolean;
  readonly outputHandles: GraphNodeOutputHandles;
}

const SINGLE_UNNAMED_OUTPUT: GraphNodeOutputHandles = {
  kind: 'fixed',
  handles: [{ id: null, label: 'Kimenet' }],
};

/**
 * A tíz csomópont típus megjelenítési és handle táblája (SPEC-008 5.1
 * táblázat). A `satisfies Readonly<Record<NodeType, ...>>` alak miatt egy
 * hiányzó típus fordítási hibát ad, nem futásidejű ágat (SPEC-008 12.4,
 * AC7): a végrehajtás során ezt egy pillanatra szándékosan kivett `script`
 * bejegyzéssel is igazoltuk - a `bun run typecheck` `TS2741` hibával bukott
 * ("Property 'script' is missing"), majd a bejegyzés visszaállítása után
 * újra zöld lett.
 */
export const GRAPH_NODE_CATALOG = {
  start: { label: 'Indítás', hasInputHandle: false, outputHandles: SINGLE_UNNAMED_OUTPUT },
  agent_step: { label: 'Agent lépés', hasInputHandle: true, outputHandles: SINGLE_UNNAMED_OUTPUT },
  branch: { label: 'Elágazás', hasInputHandle: true, outputHandles: { kind: 'dynamic-branch' } },
  fan_out: { label: 'Szétosztás', hasInputHandle: true, outputHandles: SINGLE_UNNAMED_OUTPUT },
  join: { label: 'Összefésülés', hasInputHandle: true, outputHandles: SINGLE_UNNAMED_OUTPUT },
  loop: {
    label: 'Ciklus',
    hasInputHandle: true,
    outputHandles: {
      kind: 'fixed',
      handles: [
        { id: 'continue', label: 'Folytatás' },
        { id: 'exit', label: 'Kilépés' },
      ],
    },
  },
  human_approval: {
    label: 'Emberi jóváhagyás',
    hasInputHandle: true,
    outputHandles: {
      kind: 'fixed',
      handles: [
        { id: 'approved', label: 'Jóváhagyva' },
        { id: 'rejected', label: 'Elutasítva' },
      ],
    },
  },
  error_handler: {
    label: 'Hibakezelő',
    hasInputHandle: true,
    outputHandles: {
      kind: 'fixed',
      handles: [
        { id: null, label: 'Kimenet' },
        { id: 'on_error', label: 'Hiba esetén' },
      ],
    },
  },
  sub_workflow: { label: 'Al-workflow', hasInputHandle: true, outputHandles: SINGLE_UNNAMED_OUTPUT },
  script: { label: 'Szkript', hasInputHandle: true, outputHandles: SINGLE_UNNAMED_OUTPUT },
} as const satisfies Readonly<Record<NodeType, GraphNodeCatalogEntry>>;
