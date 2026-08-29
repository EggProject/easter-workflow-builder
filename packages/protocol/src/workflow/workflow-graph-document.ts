import { z } from 'zod';
import { NodeTypeSchema } from './node-type.ts';

/**
 * A node beállítása a dróton `unknown` marad (SPEC-005 3.3 szekció elve a
 * `run_event` payloadra: "a drótszintű alak amúgy sem azonos a tárolási
 * alakkal"). A tíz `NodeConfig` ág (`AgentStepConfig` és társai) a `db`
 * csomag domain típusa, amit a `protocol` L1 rétegként nem importálhat
 * (SPEC-005 F-23); egy tíz ágú, kézzel másolt duplikátum séma egy második,
 * elcsúszásra képes forrás lenne, épp amit a Zod séma réteg (7.1 szekció) el
 * akar kerülni. A mély ellenőrzést a szerver végzi a `db` `isNodeConfig`
 * guardjával, a validált értéket adva tovább (SPEC-005 7.2 utolsó bekezdése:
 * "a Zod a bemenet és a guard a kimenet felé áll").
 */
const NODE_CONFIG_SCHEMA = z.unknown();

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
