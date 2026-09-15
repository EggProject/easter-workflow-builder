import { z } from 'zod';

/**
 * A motor beépített hookjainak azonosítója, drótszintű felsorolásként
 * (`packages/db` `engine-hook-id.ts` dokumentációja). Első verzióban
 * pontosan egy érték. Szándékos duplikáció, ugyanazon okból, mint a
 * `provider-id.ts`.
 */
export const EngineHookIdSchema = z.enum(['emit_output_tool_stop']);

export type EngineHookId = z.infer<typeof EngineHookIdSchema>;
