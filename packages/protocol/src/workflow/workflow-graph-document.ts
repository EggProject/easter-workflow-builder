import { z } from 'zod';
import { NodeConfigSchema } from '../node-config/node-config.ts';
import { NodeTypeSchema } from './node-type.ts';

/**
 * A node beállítása a `NodeConfigSchema` tíz ágú diszkriminált uniója, a `db`
 * `NodeConfig` uniójának szándékos mirror sémája (SPEC-005 7.7,
 * `.claude/CLAUDE.md` 5. szekció "A `protocol` a `db` domain uniót is
 * duplikálhatja..."). A korábbi `z.unknown()` alak avval indokolta magát,
 * hogy a `protocol` L1 rétegként a `db` domain típusát nem importálhatja
 * (SPEC-005 F-23) - ez változatlanul igaz, de a duplikáció maga nem elcsúszó
 * forrás: az `apps/server` `node-config-drift-protection` regressziós tesztje
 * típusszinten kényszeríti ki a két oldal kölcsönös egyenlőségét, plusz
 * futásidejű ellenőrzést ad a `db` `isNodeConfig` guardján keresztül. A mély
 * ellenőrzést a szerver továbbra is elvégzi a `db` `isNodeConfig` guardjával
 * (SPEC-005 7.2 utolsó bekezdése: "a Zod a bemenet és a guard a kimenet felé
 * áll"), de a Zod séma innentől a helyes ágakra szűkít, nem `unknown`-ra.
 */
const NODE_CONFIG_SCHEMA = NodeConfigSchema;

export const WorkflowNodeInputSchema = z.strictObject({
  id: z.string(),
  type: NodeTypeSchema,
  label: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  config: NODE_CONFIG_SCHEMA,
});

export type WorkflowNodeInput = z.infer<typeof WorkflowNodeInputSchema>;

export const WorkflowNodeSchema = z
  .strictObject({
    id: z.string(),
    type: NodeTypeSchema,
    label: z.string(),
    positionX: z.number(),
    positionY: z.number(),
    config: NODE_CONFIG_SCHEMA,
    createdAtMs: z.number(),
    updatedAtMs: z.number(),
  })
  .readonly();

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;

export const WorkflowEdgeInputSchema = z.strictObject({
  id: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  sourceHandle: z.string().nullable(),
  targetHandle: z.string().nullable(),
  branchKey: z.string().nullable(),
});

export type WorkflowEdgeInput = z.infer<typeof WorkflowEdgeInputSchema>;

export const WorkflowEdgeSchema = z
  .strictObject({
    id: z.string(),
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    sourceHandle: z.string().nullable(),
    targetHandle: z.string().nullable(),
    branchKey: z.string().nullable(),
    createdAtMs: z.number(),
  })
  .readonly();

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;

/**
 * `GET`/`PUT` `/api/workflows/{workflowId}/graph` válasza (SPEC-005 4.2 A
 * táblázat 7. és 8. sora).
 */
export const WorkflowGraphDocumentSchema = z
  .strictObject({
    nodes: z.array(WorkflowNodeSchema).readonly(),
    edges: z.array(WorkflowEdgeSchema).readonly(),
  })
  .readonly();

export type WorkflowGraphDocument = z.infer<typeof WorkflowGraphDocumentSchema>;

/**
 * `PUT /api/workflows/{workflowId}/graph` kérés törzse: a teljes node és él
 * lista, teljes cserével (SPEC-005 4.2 A táblázat 8. sora, ugyanaz az elv,
 * mint a `SubscriptionRequest`-nél: egy `PUT`, egy állapot, egy válasz).
 *
 * **Egyediség ellenőrzés a kérésen belül (user döntés 2026-09-27).** A
 * `workflow_node.id` és a `workflow_edge.id` globális elsődleges kulcs
 * (`packages/db`), nem workflow-onkénti; egy kérésen belüli két azonos
 * csomópont vagy él azonosítót ezért a séma utasítja el, `400 invalid_request`
 * válasszal, adatbázis hívás nélkül. A csomópont és az él azonosító külön
 * névtér (egy csomópont és egy él azonos azonosítója nem ütközés): a
 * `superRefine` a két listát külön vizsgálja. A hiba a MÁSODIK előfordulás
 * mező útvonalára horgonyoz (`zod-error-to-protocol-error-body.ts`
 * `issue.path` alapú üzenete), az elutasított azonosító értéke a hibában nem
 * jelenik meg (SPEC-005 8.4, 28. kritérium).
 */
export const ReplaceGraphRequestSchema = z
  .strictObject({
    nodes: z.array(WorkflowNodeInputSchema).readonly(),
    edges: z.array(WorkflowEdgeInputSchema).readonly(),
  })
  .superRefine((value, context) => {
    const seenNodeIds = new Set<string>();
    for (const [index, node] of value.nodes.entries()) {
      if (seenNodeIds.has(node.id)) {
        context.addIssue({
          code: 'custom',
          path: ['nodes', index, 'id'],
          message: 'A csomópont azonosító nem egyedi.',
        });
        continue;
      }
      seenNodeIds.add(node.id);
    }

    const seenEdgeIds = new Set<string>();
    for (const [index, edge] of value.edges.entries()) {
      if (seenEdgeIds.has(edge.id)) {
        context.addIssue({ code: 'custom', path: ['edges', index, 'id'], message: 'Az él azonosító nem egyedi.' });
        continue;
      }
      seenEdgeIds.add(edge.id);
    }
  });

export type ReplaceGraphRequest = z.infer<typeof ReplaceGraphRequestSchema>;
