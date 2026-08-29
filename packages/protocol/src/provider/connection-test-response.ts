import { z } from 'zod';

/**
 * A "Kapcsolat teszt" menete (SPEC-004 11.3 táblázat 16. sora, `engine`
 * `ConnectionTestMode`). Nem tagja a hat sodródás védett felsorolásnak
 * (SPEC-005 7.6), önálló minőségi döntés.
 */
export const ConnectionTestModeSchema = z.enum(['sdk_model_list', 'minimal_query']);

export type ConnectionTestMode = z.infer<typeof ConnectionTestModeSchema>;

/**
 * `POST /api/providers/{providerId}/connection-test` válasza (SPEC-005 4.2 D
 * táblázat 20. sora), az `engine` `ConnectionTestResult` alakját tükrözve.
 */
export const ConnectionTestResponseSchema = z
  .strictObject({
    succeeded: z.boolean(),
    mode: ConnectionTestModeSchema,
    errorMessage: z.string().nullable(),
  })
  .readonly();

export type ConnectionTestResponse = z.infer<typeof ConnectionTestResponseSchema>;
