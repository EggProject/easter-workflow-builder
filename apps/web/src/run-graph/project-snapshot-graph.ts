import type { Outcome } from '@easter-workflow-builder/core';
import {
  NodeConfigSchema,
  type ReplaceGraphRequest,
  type RunSnapshotResponse,
  type WorkflowNodeInput,
} from '@easter-workflow-builder/protocol';

/**
 * A `GET /api/runs/{runId}/snapshot` válaszának átfordítása a vászon domain
 * alakjára (SPEC-008 6.2, AC20). A pillanatkép node-ja `position: { x, y }`
 * alakban hordozza a helyét és `unknown` alakban a `config` mezőt
 * (`RunSnapshotResponseSchema`), a vászon egyedi node komponense viszont a
 * `WorkflowNodeInput` alakot rajzolja, `positionX`/`positionY` mezővel és
 * diszkriminált `NodeConfig` unióval - ez a függvény a kettő között fordít.
 *
 * **Miért az olvasó `NodeConfigSchema`, és nem a mentés sémája.** A `config`
 * a dróton `unknown`, tehát a diszkriminált unióra szűkítés futásidejű
 * ellenőrzést igényel. A mentés útja (`validate-graph-for-save.ts`) a
 * `ReplaceGraphRequestSchema`-t futtatja, ami 2026-09-28 óta a kötelező szöveg
 * mezők mentési szabályát is hordozza (SPEC-008 5.4, O-21); a pillanatkép
 * viszont megváltoztathatatlan (SPEC-003 5.5), és egy régi, üres kötelező
 * mezőt hordozó pillanatkép rajzának változatlanul ki kell rajzolódnia. A
 * vetítés ezért csomópontonként az olvasó sémán szűkít, a mentési szabály
 * nélkül, és az élek a pillanatkép saját, már szűkített alakjukban mennek át.
 *
 * A hibaág valódi: egy régebbi séma szerint írt vagy sérült pillanatkép a mai
 * olvasó sémán is elbukhat. Ilyenkor a felület a hibás mező ÚTVONALÁT nevezi
 * meg (`nodes.0.config.maxIterations` alakban), nem rajzol hiányos gráfot, és
 * a kapott értéket nem visszhangozza.
 */
export function projectSnapshotGraph(snapshot: RunSnapshotResponse): Outcome<ReplaceGraphRequest> {
  const nodes: WorkflowNodeInput[] = [];
  for (const [index, node] of snapshot.nodes.entries()) {
    const parsed = NodeConfigSchema.safeParse(node.config);
    if (!parsed.success) {
      const fieldPaths = parsed.error.issues.map((issue) =>
        ['nodes', index, 'config', ...issue.path].map(String).join('.'),
      );
      return { kind: 'error', message: `A pillanatkép érvénytelen, hibás mező(k): ${fieldPaths.join(', ')}.` };
    }
    nodes.push({
      id: node.id,
      type: node.type,
      label: node.label,
      positionX: node.position.x,
      positionY: node.position.y,
      config: parsed.data,
    });
  }
  return { kind: 'ok', value: { nodes, edges: snapshot.edges } };
}
