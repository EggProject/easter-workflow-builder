import type { StepRunStatus, WorkflowNodeInput } from '@easter-workflow-builder/protocol';
import type { Node } from '@xyflow/react';

/**
 * A futás nézet csomópont szintű összesítése (SPEC-008 6.3, AC22, AC24).
 * Három csomópont típusnak van mit összesíteni, a többinek nincs, ezért a
 * kártya adata elhagyható mezőben hordozza.
 *
 * - `fan_out`: hány ág keletkezett, és közülük hány lépés futás zárult
 *   sikeresen, illetve bukott el. A `branchCount === 0` a kimondott "nulla
 *   ág" eset, ami nem hiba (SPEC-004: a `join` üres listával azonnal lefut).
 * - `loop`: az aktuális iteráció és a `maxIterations` korlát.
 * - `sub_workflow`: az indult al-workflow futás azonosítója, amire a kártya
 *   navigálni tud.
 */
export type RunNodeSummary =
  | {
      readonly kind: 'fan_out';
      readonly branchCount: number;
      readonly succeededCount: number;
      readonly failedCount: number;
    }
  | { readonly kind: 'loop'; readonly iteration: number; readonly maxIterations: number }
  | { readonly kind: 'sub_workflow'; readonly subWorkflowRunId: string };

/**
 * Az összesítés és a hozzá tartozó navigáció EGYETLEN mezőben áll, nem két
 * elhagyható mezőben. Az ok a 100 százalékos, kizárás nélküli ág
 * lefedettség (`.claude/CLAUDE.md` 5. szekció): két független elhagyható
 * mező mellett létezne olyan kombináció (összesítés van, navigáció nincs),
 * ami a szerkesztőben és a futás nézetben sem fordulhat elő, tehát egy
 * sosem futó ág lenne.
 */
export interface GraphNodeRunDecoration {
  readonly summary: RunNodeSummary;
  readonly onOpenSubWorkflowRun: (subWorkflowRunId: string) => void;
}

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
    readonly runDecoration?: GraphNodeRunDecoration;
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
