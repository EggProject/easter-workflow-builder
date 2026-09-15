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
 */
export const ReplaceGraphRequestSchema = z.strictObject({
  nodes: z.array(WorkflowNodeInputSchema).readonly(),
  edges: z.array(WorkflowEdgeInputSchema).readonly(),
});

export type ReplaceGraphRequest = z.infer<typeof ReplaceGraphRequestSchema>;
