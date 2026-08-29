import { z } from 'zod';

/**
 * `GET /api/settings` és a `PUT /api/settings` válasza (SPEC-005 4.2 E
 * táblázat 21. és 22. sora). Mindkét mező kötelező a válaszban, hogy a
 * felület mindig tudja, mi az érvényes állapot (SPEC-005 4.2 E táblázat
 * "A delta kapcsoló a 22. végponton áll" bekezdés).
 */
export const SettingsRecordSchema = z
  .strictObject({
    defaultProviderId: z.string().nullable(),
    persistStreamDeltas: z.boolean(),
  })
  .readonly();

export type SettingsRecord = z.infer<typeof SettingsRecordSchema>;

/**
 * `PUT /api/settings` kérés törzse: mindkét mező elhagyható (SPEC-005 4.2 E
 * táblázat 22. sora). Ez **részleges frissítés**, nem alapértelmezés: a
 * séma ezt `optional()` mezővel fejezi ki, nem `.default()` értékkel - egy
 * elhagyott mező érintetlenül hagyja a tárolt beállítást.
 */
export const UpdateSettingsRequestSchema = z.strictObject({
  defaultProviderId: z.string().optional(),
  persistStreamDeltas: z.boolean().optional(),
});

export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;
