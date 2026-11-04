import { z } from 'zod';

/**
 * `POST /api/providers/{providerId}/connection-test` válasza (SPEC-005 4.2 D
 * táblázat 20. sora), az `engine` `ConnectionTestResult` alakját tükrözve.
 */
export const ConnectionTestResponseSchema = z
  .strictObject({
    succeeded: z.boolean(),
    errorMessage: z.string().nullable(),
  })
  .readonly();

export type ConnectionTestResponse = z.infer<typeof ConnectionTestResponseSchema>;
