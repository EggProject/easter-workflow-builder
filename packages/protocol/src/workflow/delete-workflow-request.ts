import { z } from 'zod';

/**
 * `DELETE /api/workflows/{workflowId}` kérés törzse (SPEC-005 4.2 A táblázat
 * 5. sora). Az `acknowledgeIrreversible` mezőn a `true` **literál** kötelező,
 * nem `boolean`: a `false` érték, a hiányzó mező és a hiányzó törzs mind
 * `invalid_request` hibát ad (11. és 13. kritérium), ugyanaz a minta, mint a
 * `packages/db` `DeleteWorkflowInput` mezőjén (SPEC-003 9.2).
 */
export const DeleteWorkflowRequestSchema = z.strictObject({
  acknowledgeIrreversible: z.literal(true),
});

export type DeleteWorkflowRequest = z.infer<typeof DeleteWorkflowRequestSchema>;

/**
 * A törlés előtti (előzetes, `GET .../deletion-summary`) és a tényleges
 * törlés utáni (`DELETE`) válasz azonos alakja (SPEC-005 4.2 A táblázat 5.
 * és 6. sora), a `packages/db` `DeletionSummary` mezőit tükrözve.
 */
export const DeletionSummarySchema = z
  .strictObject({
    runCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
    snapshotCount: z.number().int().nonnegative(),
  })
  .readonly();

export type DeletionSummary = z.infer<typeof DeletionSummarySchema>;
