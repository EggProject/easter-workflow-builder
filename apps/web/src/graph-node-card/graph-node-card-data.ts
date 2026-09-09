import type { StepRunStatus, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { Node } from '@xyflow/react';

/**
 * A vászon egyetlen egyedi node típusa, `nodeTypes` kulcsa `workflowNode`
 * (SPEC-008 5.1: "a vászon egyetlen egyedi node komponenst regisztrál"). A
 * `data` alak közvetlenül, típus literálként áll a `Node<...>` generikus
 * paraméterében - ugyanaz a minta, mint a hivatalos `NodeProps` doksi
 * példája (`Node<{ initialCount?: number }, 'counter'>`), mert egy külön
 * nevesített `interface` a `Record<string, unknown>` megszorításnak
 * `exactOptionalPropertyTypes: true` mellett nem felel meg (TS2344, "Index
 * signature for type 'string' is missing").
 */
export type GraphNodeCardFlowNode = Node<
  {
    readonly workflowNode: WorkflowNodeInput;
    readonly status?: StepRunStatus;
  },
  'workflowNode'
>;

/**
 * A `GraphNodeCard` `data` propjának alakja, a `GraphNodeCardFlowNode`-ból
 * származtatva (nem fordítva), hogy egyetlen helyen álljon a mező lista.
 *
 * **Típus-only fájl, nincs `.spec.ts` párja** (`apps/web/CLAUDE.md` ## Fájlok
 * konvenció): a fájl kizárólag típusdefiníciót tartalmaz, futásidejű kód
 * nélkül.
 */
export type GraphNodeCardData = GraphNodeCardFlowNode['data'];
