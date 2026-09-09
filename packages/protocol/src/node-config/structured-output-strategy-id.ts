import { z } from 'zod';

/**
 * A strukturált kimenet stratégiája, drótszintű felsorolásként (SPEC-003
 * 4.6). Szándékos duplikáció, ugyanazon okból, mint a `provider-id.ts`.
 */
export const StructuredOutputStrategyIdSchema = z.enum(['emit_output_tool', 'sdk_output_format']);

export type StructuredOutputStrategyId = z.infer<typeof StructuredOutputStrategyIdSchema>;
