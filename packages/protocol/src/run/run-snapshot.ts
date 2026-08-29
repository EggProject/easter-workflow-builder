import { z } from 'zod';
import { NodeTypeSchema } from '../workflow/node-type.ts';

/**
 * `GET /api/runs/{runId}/snapshot` válasza (SPEC-005 4.2 B táblázat 12.
 * sora), a `packages/db` `GraphSnapshotDocumentV1` alakját tükrözve
 * (SPEC-003 5.1 szekció). A `version` a jelenleg egyetlen kiadott verzió
 * literálja: a `db` `GRAPH_DOCUMENT_VERSION` konstansa `1`
 * (`packages/db/src/graph-snapshot/snapshot-document/graph-snapshot-document.ts`).
 * A node `config` mezője itt is `unknown`, ugyanazon okból, mint a
 * `workflow-graph-document.ts` élő gráfjában.
 */
export const SnapshotNodeSchema = z
  .strictObject({
    id: z.string(),
    type: NodeTypeSchema,
    label: z.string(),
    position: z.strictObject({ x: z.number(), y: z.number() }).readonly(),
    config: z.unknown(),
    effectiveProviderId: z.string(),
  })
  .readonly();

export type SnapshotNode = z.infer<typeof SnapshotNodeSchema>;

export const SnapshotEdgeSchema = z
  .strictObject({
    id: z.string(),
    sourceNodeId: z.string(),
    targetNodeId: z.string(),
    sourceHandle: z.string().nullable(),
    targetHandle: z.string().nullable(),
    branchKey: z.string().nullable(),
  })
  .readonly();

export type SnapshotEdge = z.infer<typeof SnapshotEdgeSchema>;

export const RunSnapshotResponseSchema = z
  .strictObject({
    version: z.literal(1),
    sdkVersionPin: z.string(),
    workflow: z
      .strictObject({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable(),
      })
      .readonly(),
    nodes: z.array(SnapshotNodeSchema).readonly(),
    edges: z.array(SnapshotEdgeSchema).readonly(),
  })
  .readonly();

export type RunSnapshotResponse = z.infer<typeof RunSnapshotResponseSchema>;
