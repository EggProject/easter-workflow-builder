import { z } from 'zod';

/**
 * Az `Options.thinking` mód, drótszintű felsorolásként (research 1. szekció).
 * Szándékos duplikáció, ugyanazon okból, mint a `provider-id.ts` (a
 * `provider-capability` L1 csomagot a `protocol` L1 nem importálhatja).
 */
export const ThinkingModeSchema = z.enum(['disabled', 'adaptive', 'always_on']);

export type ThinkingMode = z.infer<typeof ThinkingModeSchema>;
