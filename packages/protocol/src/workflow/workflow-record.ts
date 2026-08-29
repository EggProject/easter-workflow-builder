import { z } from 'zod';

/**
 * A workflow rekord alakja (SPEC-005 4.2 A táblázat). A `GET /api/workflows`
 * listázás ezt a nevet (`WorkflowSummary`) adja listaként, a workflow
 * szintű végpontok (2, 3, 4) a `WorkflowDetail` nevet - a két séma a spec
 * szerint ugyanazokat a mezőket hordozza, a workflow entitásnak nincs
 * kibővített, csak listázáskor elhagyott mezője (a gráf külön végponton,
 * a `workflow-graph-document.ts` `WorkflowGraphDocument` sémájával megy).
 * A `providerId` a `providerId | null` opaque szöveg: a `protocol` L1,
 * ugyanazon a rétegen áll, mint a `provider-capability`, tehát azt nem
 * importálhatja (SPEC-005 F-23), a provider azonosító a dróton egyszerű
 * szöveg.
 */
export const WorkflowSummarySchema = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    providerId: z.string().nullable(),
    createdAtMs: z.number(),
    updatedAtMs: z.number(),
  })
  .readonly();

export type WorkflowSummary = z.infer<typeof WorkflowSummarySchema>;

export const WorkflowDetailSchema = z
  .strictObject({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    providerId: z.string().nullable(),
    createdAtMs: z.number(),
    updatedAtMs: z.number(),
  })
  .readonly();

export type WorkflowDetail = z.infer<typeof WorkflowDetailSchema>;

// `POST /api/workflows` kérés törzse (SPEC-005 4.2 A táblázat 2. sora).
export const CreateWorkflowRequestSchema = z.strictObject({
  name: z.string(),
  description: z.string().nullable(),
  providerId: z.string().nullable(),
});

export type CreateWorkflowRequest = z.infer<typeof CreateWorkflowRequestSchema>;

/**
 * `PATCH /api/workflows/{workflowId}` kérés törzse: minden mező elhagyható
 * (SPEC-005 4.2 A táblázat 4. sora). Az `optional()` a részleges frissítést
 * fejezi ki, nem szállított alapértéket: egy elhagyott mező érintetlenül
 * hagyja a tárolt értéket (ugyanaz az elv, mint az `UpdateSettingsRequest`).
 */
export const UpdateWorkflowRequestSchema = z.strictObject({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  providerId: z.string().nullable().optional(),
});

export type UpdateWorkflowRequest = z.infer<typeof UpdateWorkflowRequestSchema>;

// `GET /api/workflows` query stringje: a `limit` kötelező (SPEC-005 F-19).
export const ListWorkflowsQuerySchema = z.strictObject({
  limit: z.number().int().positive(),
});

export type ListWorkflowsQuery = z.infer<typeof ListWorkflowsQuerySchema>;
