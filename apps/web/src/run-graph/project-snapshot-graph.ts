import type { Outcome } from '@easter-workflow-builder/core';
import {
  ReplaceGraphRequestSchema,
  zodErrorToProtocolErrorBody,
  type ReplaceGraphRequest,
  type RunSnapshotResponse,
} from '@easter-workflow-builder/protocol';

/**
 * A `GET /api/runs/{runId}/snapshot` válaszának átfordítása a vászon domain
 * alakjára (SPEC-008 6.2, AC20). A pillanatkép node-ja `position: { x, y }`
 * alakban hordozza a helyét és `unknown` alakban a `config` mezőt
 * (`RunSnapshotResponseSchema`), a vászon egyedi node komponense viszont a
 * `WorkflowNodeInput` alakot rajzolja, `positionX`/`positionY` mezővel és
 * diszkriminált `NodeConfig` unióval - ez a függvény a kettő között fordít.
 *
 * **Miért egyetlen séma hívás, és miért a `ReplaceGraphRequestSchema`.** A
 * `config` a dróton `unknown`, tehát a diszkriminált unióra szűkítés
 * futásidejű ellenőrzést igényel; ugyanezt a szűkítést a mentés útja
 * (`validate-graph-for-save.ts`) már elvégzi a teljes node és él listára,
 * ugyanazzal a sémával. A pillanatkép ugyanazt az alakot hordozza (a
 * `graph_snapshot` dokumentum az élő gráfból készül, SPEC-003 5.1), tehát
 * nincs ok második, kézzel írt ellenőrzésre: egy `safeParse` hívás egyszerre
 * adja a tíz ágra szűkített `config` mezőt és a hibás mező ÚTVONALÁT is
 * (`nodes.0.config.maxIterations` alakban, `zodErrorToProtocolErrorBody`).
 *
 * A hibaág valódi: a `graph_snapshot` sor megváltoztathatatlan (SPEC-003
 * 5.5), tehát egy régebbi séma szerint írt vagy sérült pillanatkép a mai
 * ellenőrzésen elbukhat. Ilyenkor a felület a hibát nevezi meg, nem rajzol
 * hiányos gráfot.
 */
export function projectSnapshotGraph(snapshot: RunSnapshotResponse): Outcome<ReplaceGraphRequest> {
  const parsed = ReplaceGraphRequestSchema.safeParse({
    nodes: snapshot.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      positionX: node.position.x,
      positionY: node.position.y,
      config: node.config,
    })),
    edges: snapshot.edges,
  });
  if (!parsed.success) {
    return { kind: 'error', message: zodErrorToProtocolErrorBody(parsed.error).message };
  }
  return { kind: 'ok', value: parsed.data };
}
