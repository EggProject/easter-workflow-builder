import { z } from 'zod';

/**
 * A lépés session módja, drótszintű felsorolásként (`packages/db`
 * `session-mode.ts` dokumentációja). Szándékos duplikáció, ugyanazon okból,
 * mint a `provider-id.ts`.
 */
export const SessionModeSchema = z.enum(['isolated', 'continued']);

export type SessionMode = z.infer<typeof SessionModeSchema>;
